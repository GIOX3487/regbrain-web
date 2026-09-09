import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import { validateRequest, unauthorizedResponse, forbiddenResponse, corsHeaders } from "../_shared/partner-auth.ts";

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const auth = await validateRequest(req);
  if (!auth) return unauthorizedResponse();
  if (!auth.scopes.includes('assessments')) return forbiddenResponse('assessments');

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) throw new Error('LOVABLE_API_KEY not configured');

    if (req.method !== 'POST') {
      return new Response(JSON.stringify({ status: 'error', error: 'Method not allowed' }), {
        status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const body = await req.json();
    const { action } = body;

    // ACTION: submit-assessment
    if (action === 'submit-assessment') {
      const { assessment } = body;
      if (!assessment || !assessment.regulations || !assessment.sector) {
        return new Response(JSON.stringify({ status: 'error', error: 'Bad Request – assessment object with regulations and sector is required' }), {
          status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const systemPrompt = `Sei un analista di compliance normativa EU.
Analizza i dati dell'assessment ricevuto dalla piattaforma partner e restituisci un JSON con:
- "overall_compliance_percentage": numero 0-100
- "risk_score": numero 0-10
- "identified_gaps": array di oggetti con { "regulation", "requirement_reference", "gap_description", "risk_level", "priority", "recommended_actions" }
- "cross_regulation_synergies": array di sinergie tra normative identificate
- "action_plan_summary": array di azioni prioritarie con timeline stimata

Rispondi SOLO con il JSON.`;

      const aiResponse = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${LOVABLE_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'google/gemini-3-flash-preview',
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: JSON.stringify(assessment) },
          ],
          temperature: 0.3,
          max_tokens: 4000,
        }),
      });

      if (!aiResponse.ok) {
        if (aiResponse.status === 429) {
          return new Response(JSON.stringify({ status: 'error', error: 'Rate limit exceeded' }), {
            status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }
        throw new Error(`AI gateway error: ${aiResponse.status}`);
      }

      const aiData = await aiResponse.json();
      let rawContent = aiData.choices?.[0]?.message?.content || '';
      rawContent = rawContent.replace(/^```json\s*/i, '').replace(/```\s*$/i, '').trim();

      let analysis: any;
      try { analysis = JSON.parse(rawContent); } catch { analysis = { raw_analysis: rawContent }; }

      await supabase.from('partner_api_log').insert({
        partner_id: auth.partner_id,
        endpoint: '/v1/assessments',
        action: 'submit-assessment',
        request_summary: { regulations: assessment.regulations, sector: assessment.sector, tenant_id: auth.tenant_id },
        response_summary: { compliance_percentage: analysis.overall_compliance_percentage, gaps_count: analysis.identified_gaps?.length || 0 },
      });

      return new Response(JSON.stringify({
        status: 'success',
        data: { gap_analysis: analysis, source: 'regbrain-ai-engine', timestamp: new Date().toISOString() },
        meta: { tenant_id: auth.tenant_id },
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // ACTION: get-benchmarks
    if (action === 'get-benchmarks') {
      const { sector, jurisdiction, regulations } = body;
      if (!sector) {
        return new Response(JSON.stringify({ status: 'error', error: 'Bad Request – sector is required' }), {
          status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      let query = supabase.from('sector_benchmarks').select('*').eq('sector', sector);
      if (jurisdiction) query = query.eq('jurisdiction', jurisdiction);
      if (regulations?.length > 0) query = query.in('regulation', regulations);

      const { data, error } = await query.limit(50);
      if (error) throw error;

      return new Response(JSON.stringify({
        status: 'success',
        data: { benchmarks: data || [], sector, jurisdiction: jurisdiction || 'all', count: data?.length || 0 },
        meta: { tenant_id: auth.tenant_id },
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // ACTION: get-knowledge
    if (action === 'get-knowledge') {
      const { query: userQuery, regulations } = body;
      if (!userQuery) {
        return new Response(JSON.stringify({ status: 'error', error: 'Bad Request – query is required' }), {
          status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const { data: chunks } = await supabase
        .from('chunks')
        .select('content, document_id, documents!inner(title, jurisdiction)')
        .textSearch('content', userQuery.split(' ').slice(0, 5).join(' & '))
        .limit(10);

      const contextText = chunks?.map(c => c.content).join('\n\n') || '';

      const systemPrompt = `Sei un esperto di compliance normativa. Usa il contesto fornito dalla knowledge base RegBrain per rispondere alla domanda in modo preciso e con riferimenti normativi.
${regulations ? `Focalizzati su: ${regulations.join(', ')}` : ''}

CONTESTO DALLA KNOWLEDGE BASE:
${contextText.substring(0, 8000)}

Rispondi in modo strutturato con riferimenti precisi ad articoli e commi.`;

      const aiResponse = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${LOVABLE_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'google/gemini-3-flash-preview',
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userQuery },
          ],
          temperature: 0.3,
          max_tokens: 2000,
        }),
      });

      if (!aiResponse.ok) throw new Error(`AI error: ${aiResponse.status}`);

      const aiData = await aiResponse.json();
      const answer = aiData.choices?.[0]?.message?.content || '';

      return new Response(JSON.stringify({
        status: 'success',
        data: {
          answer,
          sources: chunks?.map(c => ({
            document: (c as any).documents?.title,
            excerpt: c.content.substring(0, 200),
          })) || [],
        },
        meta: { tenant_id: auth.tenant_id },
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({ status: 'error', error: `Bad Request – unknown action "${action}". Valid: submit-assessment, get-benchmarks, get-knowledge` }), {
      status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('api-v1-sync-assessments error:', error);
    return new Response(JSON.stringify({ status: 'error', error: 'Internal Server Error' }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
