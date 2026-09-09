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

    const { assessmentId, workflowType = 'semi_automated' } = await req.json();

    // Fetch assessment and gaps
    const [assessmentRes, gapsRes, actionsRes] = await Promise.all([
      supabase.from('compliance_assessments').select('*').eq('id', assessmentId).single(),
      supabase.from('identified_gaps').select('*').eq('assessment_id', assessmentId).eq('status', 'open'),
      supabase.from('action_plans').select('*').eq('assessment_id', assessmentId)
    ]);

    const assessment = assessmentRes.data;
    const gaps = gapsRes.data || [];
    const actions = actionsRes.data || [];

    // Analyze dependencies and create orchestration plan
    const systemPrompt = `Sei un esperto di project management e compliance orchestration. Analizza i gap e le azioni di remediation e crea un piano di orchestrazione ottimale.

Considera:
- Dipendenze tra azioni (alcune devono essere completate prima di altre)
- Priorità (basate su risk_score e potential_fine_eur)
- Risorse disponibili
- Timeline realistiche
- Quick wins vs long-term improvements

Crea milestones logiche e raggruppa azioni per fase.`;

    const userPrompt = `Crea piano di orchestrazione per:
- Assessment: ${assessment?.title}
- ${gaps.length} gap identificati
- ${actions.length} azioni pianificate

Gap prioritari:
${gaps.slice(0, 10).map(g => `- ${g.requirement_reference}: ${g.gap_description} (Risk: ${g.risk_level}, Score: ${g.risk_score})`).join('\n')}

Azioni esistenti:
${actions.slice(0, 10).map(a => `- ${a.title} (Priority: ${a.priority}, Days: ${a.estimated_hours ? Math.ceil(a.estimated_hours / 8) : 'N/A'})`).join('\n')}

Genera un workflow orchestrato con fasi, dipendenze e milestones.`;

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
            name: 'create_orchestration_plan',
            description: 'Create remediation orchestration plan',
            parameters: {
              type: 'object',
              properties: {
                workflow_name: { type: 'string' },
                phases: {
                  type: 'array',
                  items: {
                    type: 'object',
                    properties: {
                      name: { type: 'string' },
                      description: { type: 'string' },
                      duration_days: { type: 'number' },
                      action_ids: { type: 'array', items: { type: 'string' } }
                    }
                  }
                },
                dependencies: {
                  type: 'array',
                  items: {
                    type: 'object',
                    properties: {
                      action_id: { type: 'string' },
                      depends_on: { type: 'array', items: { type: 'string' } }
                    }
                  }
                },
                milestones: {
                  type: 'array',
                  items: {
                    type: 'object',
                    properties: {
                      name: { type: 'string' },
                      description: { type: 'string' },
                      target_date_offset_days: { type: 'number' },
                      completion_criteria: { type: 'array', items: { type: 'string' } }
                    }
                  }
                },
                orchestration_rules: {
                  type: 'object',
                  properties: {
                    auto_progress: { type: 'boolean' },
                    notification_triggers: { type: 'array', items: { type: 'string' } },
                    escalation_rules: { type: 'array', items: { type: 'object' } }
                  }
                },
                estimated_total_days: { type: 'number' }
              },
              required: ['workflow_name', 'phases', 'dependencies', 'milestones', 'estimated_total_days']
            }
          }
        }],
        tool_choice: { type: 'function', function: { name: 'create_orchestration_plan' } }
      }),
    });

    if (!aiResponse.ok) {
      throw new Error(`AI API error: ${aiResponse.statusText}`);
    }

    const aiData = await aiResponse.json();
    const toolCall = aiData.choices[0].message.tool_calls[0];
    const orchestrationPlan = JSON.parse(toolCall.function.arguments);

    // Create workflow
    const targetDate = new Date();
    targetDate.setDate(targetDate.getDate() + orchestrationPlan.estimated_total_days);

    const { data: workflow, error: workflowError } = await supabase
      .from('remediation_workflows')
      .insert({
        user_id: user.id,
        assessment_id: assessmentId,
        workflow_name: orchestrationPlan.workflow_name,
        workflow_type: workflowType,
        total_actions: actions.length,
        completed_actions: 0,
        current_phase: 'planning',
        orchestration_rules: orchestrationPlan.orchestration_rules || {},
        dependencies: orchestrationPlan.dependencies,
        milestones: orchestrationPlan.milestones,
        start_date: new Date().toISOString(),
        target_completion_date: targetDate.toISOString()
      })
      .select()
      .single();

    if (workflowError) throw workflowError;

    return new Response(JSON.stringify({ 
      success: true,
      workflow,
      plan: orchestrationPlan
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error in orchestrate-remediation:', error);
    return new Response(JSON.stringify({ 
      error: error instanceof Error ? error.message : 'Unknown error'
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
