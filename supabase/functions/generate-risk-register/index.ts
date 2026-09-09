import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
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

    const { assessmentId } = await req.json();

    // Fetch user profile and assessment
    const [profileRes, assessmentRes, gapsRes] = await Promise.all([
      supabase.from('profiles').select('*').eq('id', user.id).single(),
      supabase.from('compliance_assessments').select('*').eq('id', assessmentId).single(),
      supabase.from('identified_gaps').select('*').eq('assessment_id', assessmentId)
    ]);

    const profile = profileRes.data;
    const assessment = assessmentRes.data;
    const gaps = gapsRes.data || [];

    // System prompt per generazione registro rischi
    const systemPrompt = `Sei un esperto di risk management NIS2 e cybersecurity. Genera un registro rischi completo conforme al D.lgs. 138/2024 e linee guida ACN.

Per ogni rischio identifica:
- Categoria (cyber, operational, compliance, strategic)
- Fonte della minaccia
- Vulnerabilità sfruttabili
- Likelihood (probabilità): very_low, low, medium, high, very_high
- Impact (impatto): very_low, low, medium, high, very_high
- Score intrinseco (prima dei controlli)
- Controlli esistenti
- Score residuo (dopo i controlli)
- Strategia di trattamento (accept, mitigate, transfer, avoid)
- Piano di trattamento
- Owner del rischio

Usa metodologia ISO 27005 e considera contesto NIS2 italiano.`;

    const userPrompt = `Genera registro rischi per:
- Settore: ${profile?.sector}
- Giurisdizione: ${profile?.jurisdiction}
- Assessment: ${assessment?.title}
- Scope: ${assessment?.scope_regulations?.join(', ')}

Gap identificati da considerare:
${gaps.map(g => `- ${g.requirement_reference}: ${g.gap_description} (Risk: ${g.risk_level})`).join('\n')}

Genera almeno 10-15 rischi specifici per il contesto, coprendo tutte le categorie.`;

    // Call Lovable AI
    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
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
            name: 'generate_risk_register',
            description: 'Generate complete risk register',
            parameters: {
              type: 'object',
              properties: {
                risks: {
                  type: 'array',
                  items: {
                    type: 'object',
                    properties: {
                      risk_id: { type: 'string' },
                      risk_category: { type: 'string', enum: ['cyber', 'operational', 'compliance', 'strategic'] },
                      risk_title: { type: 'string' },
                      risk_description: { type: 'string' },
                      threat_source: { type: 'string' },
                      vulnerability: { type: 'string' },
                      likelihood: { type: 'string', enum: ['very_low', 'low', 'medium', 'high', 'very_high'] },
                      impact: { type: 'string', enum: ['very_low', 'low', 'medium', 'high', 'very_high'] },
                      inherent_risk_score: { type: 'number' },
                      existing_controls: { type: 'array', items: { type: 'string' } },
                      residual_risk_score: { type: 'number' },
                      risk_appetite: { type: 'string', enum: ['accept', 'mitigate', 'transfer', 'avoid'] },
                      treatment_plan: { type: 'string' },
                      owner: { type: 'string' }
                    },
                    required: ['risk_id', 'risk_category', 'risk_title', 'risk_description', 'likelihood', 'impact', 'inherent_risk_score', 'residual_risk_score', 'risk_appetite']
                  }
                }
              },
              required: ['risks']
            }
          }
        }],
        tool_choice: { type: 'function', function: { name: 'generate_risk_register' } }
      }),
    });

    if (!aiResponse.ok) {
      throw new Error(`AI API error: ${aiResponse.statusText}`);
    }

    const aiData = await aiResponse.json();
    const toolCall = aiData.choices[0].message.tool_calls[0];
    const { risks } = JSON.parse(toolCall.function.arguments);

    // Save risks to database
    const risksToInsert = risks.map((risk: any) => ({
      user_id: user.id,
      assessment_id: assessmentId,
      ...risk,
      existing_controls: risk.existing_controls || [],
      review_frequency: 'quarterly',
      next_review_date: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString()
    }));

    const { data: savedRisks, error: saveError } = await supabase
      .from('risk_register')
      .insert(risksToInsert)
      .select();

    if (saveError) throw saveError;

    return new Response(JSON.stringify({ 
      success: true,
      risks: savedRisks,
      count: savedRisks.length
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error in generate-risk-register:', error);
    return new Response(JSON.stringify({ 
      error: error instanceof Error ? error.message : 'Unknown error'
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
