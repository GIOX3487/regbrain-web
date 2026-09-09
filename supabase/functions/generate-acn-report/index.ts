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

    const { reportType, periodStart, periodEnd, assessmentIds = [] } = await req.json();

    // Fetch relevant data
    const [profileRes, assessmentsRes, risksRes] = await Promise.all([
      supabase.from('profiles').select('*').eq('id', user.id).single(),
      assessmentIds.length > 0 
        ? supabase.from('compliance_assessments').select('*').in('id', assessmentIds)
        : supabase.from('compliance_assessments').select('*').eq('user_id', user.id),
      supabase.from('risk_register').select('*').eq('user_id', user.id)
    ]);

    const profile = profileRes.data;
    const assessments = assessmentsRes.data || [];
    const risks = risksRes.data || [];

    // System prompt per report ACN
    const systemPrompt = `Sei un esperto di compliance NIS2 e reporting verso l'Agenzia per la Cybersicurezza Nazionale (ACN).

Genera un report formale conforme ai requisiti ACN per il D.lgs. 138/2024, con:
- Riepilogo esecutivo
- Stato generale della sicurezza
- Misure di sicurezza implementate
- Gap e azioni correttive
- Incidenti rilevanti (se applicabile)
- Piani di miglioramento
- Attestazioni e dichiarazioni

Il report deve essere professionale, completo e compliance-ready per submission ad ACN.`;

    const userPrompt = `Genera report ACN tipo "${reportType}" per:
- Periodo: ${periodStart} - ${periodEnd}
- Settore: ${profile?.sector}
- Assessments completati: ${assessments.length}
- Rischi in registro: ${risks.length}

Compliance overview:
${assessments.map(a => `- ${a.title}: ${a.overall_compliance_percentage}% compliance, Risk score: ${a.overall_risk_score}`).join('\n')}

Top risks:
${risks.filter(r => r.residual_risk_score > 7).slice(0, 5).map(r => `- ${r.risk_title} (Score: ${r.residual_risk_score})`).join('\n')}

Genera un report completo e submission-ready per ACN.`;

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
            name: 'generate_acn_report',
            description: 'Generate ACN compliance report',
            parameters: {
              type: 'object',
              properties: {
                executive_summary: { type: 'string' },
                organization_info: {
                  type: 'object',
                  properties: {
                    name: { type: 'string' },
                    sector: { type: 'string' },
                    entity_type: { type: 'string' },
                    contact_person: { type: 'string' }
                  }
                },
                security_status: {
                  type: 'object',
                  properties: {
                    overall_compliance_level: { type: 'string' },
                    maturity_level: { type: 'string' },
                    key_metrics: { type: 'object' }
                  }
                },
                implemented_measures: {
                  type: 'array',
                  items: {
                    type: 'object',
                    properties: {
                      category: { type: 'string' },
                      description: { type: 'string' },
                      implementation_date: { type: 'string' },
                      effectiveness: { type: 'string' }
                    }
                  }
                },
                identified_gaps: {
                  type: 'array',
                  items: {
                    type: 'object',
                    properties: {
                      requirement: { type: 'string' },
                      gap_description: { type: 'string' },
                      remediation_plan: { type: 'string' },
                      target_date: { type: 'string' }
                    }
                  }
                },
                risk_assessment_summary: {
                  type: 'object',
                  properties: {
                    total_risks: { type: 'number' },
                    high_risks: { type: 'number' },
                    medium_risks: { type: 'number' },
                    low_risks: { type: 'number' },
                    risk_treatment_status: { type: 'string' }
                  }
                },
                incidents: {
                  type: 'array',
                  items: {
                    type: 'object',
                    properties: {
                      date: { type: 'string' },
                      type: { type: 'string' },
                      severity: { type: 'string' },
                      description: { type: 'string' },
                      response: { type: 'string' }
                    }
                  }
                },
                improvement_plan: {
                  type: 'object',
                  properties: {
                    short_term: { type: 'array', items: { type: 'string' } },
                    medium_term: { type: 'array', items: { type: 'string' } },
                    long_term: { type: 'array', items: { type: 'string' } }
                  }
                },
                attestation: {
                  type: 'object',
                  properties: {
                    statement: { type: 'string' },
                    signatory_role: { type: 'string' },
                    date: { type: 'string' }
                  }
                }
              },
              required: ['executive_summary', 'security_status', 'implemented_measures', 'risk_assessment_summary']
            }
          }
        }],
        tool_choice: { type: 'function', function: { name: 'generate_acn_report' } }
      }),
    });

    if (!aiResponse.ok) {
      throw new Error(`AI API error: ${aiResponse.statusText}`);
    }

    const aiData = await aiResponse.json();
    const toolCall = aiData.choices[0].message.tool_calls[0];
    const reportContent = JSON.parse(toolCall.function.arguments);

    // Save report
    const { data: savedReport, error: saveError } = await supabase
      .from('acn_reports')
      .insert({
        user_id: user.id,
        report_type: reportType,
        reporting_period_start: periodStart,
        reporting_period_end: periodEnd,
        content: reportContent,
        assessment_ids: assessmentIds,
        status: 'draft'
      })
      .select()
      .single();

    if (saveError) throw saveError;

    return new Response(JSON.stringify({ 
      success: true,
      report: savedReport
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error in generate-acn-report:', error);
    return new Response(JSON.stringify({ 
      error: error instanceof Error ? error.message : 'Unknown error'
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
