import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { validateRequest, unauthorizedResponse, forbiddenResponse, corsHeaders } from "../_shared/partner-auth.ts";

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ status: 'error', error: 'Method not allowed' }), {
      status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const auth = await validateRequest(req);
  if (!auth) return unauthorizedResponse();
  if (!auth.scopes.includes('analyze')) return forbiddenResponse('analyze');

  try {
    const body = await req.json();
    const { documentText, documentType } = body;

    if (!documentText || typeof documentText !== 'string' || !documentText.trim()) {
      return new Response(JSON.stringify({ status: 'error', error: 'Bad Request – "documentText" is required' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (documentText.length > 100000) {
      return new Response(JSON.stringify({ status: 'error', error: 'Bad Request – documentText exceeds 100k characters' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) throw new Error('LOVABLE_API_KEY not configured');

    const systemPrompt = `Sei un analista documentale esperto in normative EU di compliance e cybersecurity.
Analizza il documento fornito e restituisci un JSON strutturato con i seguenti campi:
- "summary": riassunto del documento (max 300 parole)
- "key_topics": array di argomenti chiave identificati
- "regulations_referenced": array di normative citate o rilevanti (es. "GDPR Art. 25", "NIS2 Art. 21")
- "risk_indicators": array di possibili rischi o criticità individuate
- "compliance_score": punteggio stimato di compliance da 0 a 100
- "recommendations": array di raccomandazioni pratiche

Tipo documento: ${documentType || 'non specificato'}

IMPORTANTE: Rispondi SOLO con il JSON, senza testo aggiuntivo.`;

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
          { role: 'user', content: documentText },
        ],
        temperature: 0.3,
        max_tokens: 3000,
      }),
    });

    if (!aiResponse.ok) {
      if (aiResponse.status === 429) {
        return new Response(JSON.stringify({ status: 'error', error: 'Rate limit exceeded, retry later' }), {
          status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      if (aiResponse.status === 402) {
        return new Response(JSON.stringify({ status: 'error', error: 'Payment required' }), {
          status: 402, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      throw new Error(`AI gateway error: ${aiResponse.status}`);
    }

    const aiData = await aiResponse.json();
    let rawContent = aiData.choices?.[0]?.message?.content || '';
    rawContent = rawContent.replace(/^```json\s*/i, '').replace(/```\s*$/i, '').trim();

    let analysis: any;
    try {
      analysis = JSON.parse(rawContent);
    } catch {
      analysis = { raw_analysis: rawContent };
    }

    return new Response(JSON.stringify({
      status: 'success',
      data: { analysis },
      meta: { tenant_id: auth.tenant_id },
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('api-v1-analyze-doc error:', error);
    return new Response(JSON.stringify({ status: 'error', error: 'Internal Server Error' }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
