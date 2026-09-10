import { protect } from '../_shared/access.ts';
import { aiFetch as fetch, getAIKey, getAIModel } from '../_shared/ai.ts';
import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve as denoServe } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2.75.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

denoServe(protect(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      throw new Error('Missing authorization header');
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      throw new Error('Unauthorized');
    }

    const { policyType, assessmentId, organizationContext } = await req.json();

    // Fetch user profile for context
    const { data: profile } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .single();

    // Fetch assessment data if provided
    let assessmentData = null;
    if (assessmentId) {
      const { data } = await supabase
        .from('compliance_assessments')
        .select('*')
        .eq('id', assessmentId)
        .single();
      assessmentData = data;
    }

    // System prompt per generazione policy
    const systemPrompt = `Sei un esperto di compliance NIS2 e cybersecurity. Genera una policy aziendale completa e conforme al D.lgs. 138/2024 (NIS2 italiana) e alle linee guida ACN.

La policy deve essere:
- Conforme a NIS2 e ACN
- Specifica per il settore ${profile?.sector || 'generico'}
- Applicabile in Italia
- Pratica e implementabile
- Con ruoli e responsabilità chiare
- Con procedure operative dettagliate

Struttura richiesta:
1. Scopo e campo di applicazione
2. Riferimenti normativi (D.lgs. 138/2024, ACN, ISO 27001, etc.)
3. Definizioni
4. Ruoli e responsabilità
5. Procedure operative
6. Controlli e verifiche
7. Gestione delle eccezioni
8. Review e aggiornamento`;

    const userPrompt = `Genera una policy di tipo "${policyType}" per:
- Settore: ${profile?.sector || 'generico'}
- Giurisdizione: ${profile?.jurisdiction || 'IT'}
- Ruolo: ${profile?.compliance_role || 'DPO'}
${organizationContext ? `- Contesto: ${organizationContext}` : ''}
${assessmentData ? `- Assessment: ${assessmentData.title}` : ''}

La policy deve essere completa, operativa e conforme NIS2/ACN.`;

    // Call Lovable AI
    const LOVABLE_API_KEY = getAIKey();
    const aiResponse = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${LOVABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ],
        tools: [{
          type: 'function',
          function: {
            name: 'generate_policy',
            description: 'Generate a complete compliance policy',
            parameters: {
              type: 'object',
              properties: {
                title: { type: 'string', description: 'Policy title' },
                scope: { type: 'string', description: 'Scope and applicability' },
                regulatory_references: { type: 'array', items: { type: 'string' } },
                definitions: { type: 'object', additionalProperties: { type: 'string' } },
                roles_responsibilities: { type: 'array', items: { 
                  type: 'object',
                  properties: {
                    role: { type: 'string' },
                    responsibilities: { type: 'array', items: { type: 'string' } }
                  }
                }},
                procedures: { type: 'array', items: {
                  type: 'object',
                  properties: {
                    title: { type: 'string' },
                    steps: { type: 'array', items: { type: 'string' } }
                  }
                }},
                controls: { type: 'array', items: { type: 'string' } },
                exceptions: { type: 'string' },
                review_frequency: { type: 'string' }
              },
              required: ['title', 'scope', 'regulatory_references', 'roles_responsibilities', 'procedures', 'controls']
            }
          }
        }],
        tool_choice: { type: 'function', function: { name: 'generate_policy' } }
      }),
    });

    if (!aiResponse.ok) {
      throw new Error(`AI API error: ${aiResponse.statusText}`);
    }

    const aiData = await aiResponse.json();
    const toolCall = aiData.choices[0].message.tool_calls[0];
    const policyContent = JSON.parse(toolCall.function.arguments);

    // Save policy to database
    const { data: savedPolicy, error: saveError } = await supabase
      .from('generated_policies')
      .insert({
        user_id: user.id,
        assessment_id: assessmentId,
        policy_type: policyType,
        title: policyContent.title,
        content: policyContent,
        version: 1,
        status: 'draft'
      })
      .select()
      .single();

    if (saveError) throw saveError;

    return new Response(JSON.stringify({ 
      success: true,
      policy: savedPolicy
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error in generate-policy:', error);
    return new Response(JSON.stringify({ 
      error: error instanceof Error ? error.message : 'Unknown error'
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
}, false, true));
