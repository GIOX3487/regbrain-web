import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const sectorKeywords: Record<string, string[]> = {
  'Technology': ['cybersecurity', 'AI Act', 'data protection', 'digital services', 'software compliance', 'CRA'],
  'Healthcare': ['health data', 'patient privacy', 'medical devices', 'GDPR healthcare', 'clinical data'],
  'Finance': ['DORA', 'financial services', 'banking regulation', 'PSD2', 'AML', 'financial compliance'],
  'Energy': ['critical infrastructure', 'NIS2 energy', 'smart grid security', 'energy regulation'],
  'Manufacturing': ['industrial cybersecurity', 'supply chain', 'product safety', 'CRA manufacturing'],
  'Public Administration': ['public sector', 'government cybersecurity', 'eIDAS', 'digital government'],
  'Retail': ['consumer data', 'e-commerce regulation', 'payment security', 'retail compliance'],
  'Transport': ['transport security', 'logistics compliance', 'vehicle cybersecurity', 'NIS2 transport']
};

const jurisdictionKeywords: Record<string, string[]> = {
  'IT': ['Italy', 'Italian', 'Garante Privacy', 'ACN', 'Italia'],
  'EU': ['European Union', 'EDPB', 'European Commission', 'EU regulation'],
  'DE': ['Germany', 'German', 'BfDI', 'BSI'],
  'FR': ['France', 'French', 'CNIL', 'ANSSI'],
  'ES': ['Spain', 'Spanish', 'AEPD']
};

// Generate deterministic cache key from input parameters
function generateCacheKey(sector: string, jurisdiction: string, role: string): string {
  return `${sector.toLowerCase()}_${jurisdiction.toLowerCase()}_${role.toLowerCase()}`;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { sector, jurisdiction, role, forceRefresh } = await req.json();

    if (!sector || !jurisdiction || !role) {
      return new Response(
        JSON.stringify({ error: 'Missing required parameters: sector, jurisdiction, role' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const cacheKey = generateCacheKey(sector, jurisdiction, role);

    // Check cache first (unless forceRefresh is true)
    if (!forceRefresh) {
      const { data: cachedData, error: cacheError } = await supabase
        .from('market_intelligence_cache')
        .select('intelligence_data, created_at, expires_at')
        .eq('cache_key', cacheKey)
        .gt('expires_at', new Date().toISOString())
        .single();

      if (!cacheError && cachedData) {
        console.log('Returning cached market intelligence for:', cacheKey);
        return new Response(
          JSON.stringify({
            ...cachedData.intelligence_data,
            cached: true,
            cached_at: cachedData.created_at,
            expires_at: cachedData.expires_at
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    // No valid cache, generate new data
    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');

    const sectorTerms = sectorKeywords[sector] || [sector];
    const jurisdictionTerms = jurisdictionKeywords[jurisdiction] || [jurisdiction];

    const currentYear = new Date().getFullYear();
    const currentMonth = new Date().toLocaleString('it-IT', { month: 'long' });

    console.log('Generating new market intelligence - sector:', sector, 'jurisdiction:', jurisdiction);

    const systemPrompt = `Sei un analista esperto di compliance, privacy e cybersecurity. Rispondi SEMPRE in italiano.

DATA CORRENTE: ${currentMonth} ${currentYear}

FOCUS ESCLUSIVO: Le tue risposte devono riguardare ESCLUSIVAMENTE:
- Privacy e protezione dei dati personali (GDPR, sanzioni Garante Privacy, data breach)
- Cybersecurity e sicurezza informatica (NIS2, incidenti cyber, vulnerabilità, threat landscape)
- Compliance normativa in ambito privacy/security (AI Act, DORA, CRA, eIDAS)
- Sanzioni e provvedimenti delle autorità (Garante Privacy, ACN, EDPB, ENISA)

NON includere notizie su:
- Politica generale, economia, finanza non legata a compliance
- Tecnologia generica non legata a privacy/security
- Notizie di cronaca non pertinenti

TARGET: DPO, CISO, consulenti privacy, legal compliance in ambito cybersecurity e privacy.`;

    const userPrompt = `Cerca le ultime notizie ESCLUSIVAMENTE su privacy, cybersecurity e compliance normativa per:
- Settore: ${sector} 
- Giurisdizione: ${jurisdiction}
- Ruolo: ${role}

TOPIC OBBLIGATORI (almeno uno per ogni news):
- Sanzioni GDPR e provvedimenti Garante Privacy
- Incidenti cybersecurity e data breach
- Aggiornamenti normativi (NIS2, DORA, AI Act, CRA)
- Linee guida EDPB, ENISA, ACN
- Minacce cyber e vulnerabilità rilevanti
- Best practice sicurezza e privacy

Genera un JSON con questa struttura:
{
  "sector_trends": [
    {
      "title": "Titolo trend privacy/cybersecurity",
      "summary": "Descrizione (2-3 frasi) focalizzata su privacy o sicurezza",
      "relevance": "Impatto su ${role} nel settore ${sector}",
      "category": "trend",
      "impact_level": "high|medium|low",
      "date": "YYYY-MM-DD"
    }
  ],
  "regulatory_updates": [
    {
      "title": "Aggiornamento normativo privacy/security",
      "summary": "Descrizione dell'aggiornamento",
      "relevance": "Impatto compliance per ${sector}",
      "category": "regulation",
      "impact_level": "high|medium|low",
      "date": "YYYY-MM-DD"
    }
  ],
  "market_statistics": [
    {
      "stat": "Statistica privacy/cybersecurity",
      "value": "Valore",
      "source": "Fonte ufficiale (ENISA, Garante, ACN, Clusit)"
    }
  ],
  "recommendations": [
    "Azione operativa per migliorare compliance privacy/security"
  ]
}

Genera 3 trend, 3 aggiornamenti normativi, 4 statistiche e 4 raccomandazioni.
TUTTO deve essere strettamente legato a PRIVACY, CYBERSECURITY o COMPLIANCE NORMATIVA.
Rispondi SOLO con il JSON.`;

    let content: string | null = null;
    let citations: string[] = [];
    let usedProvider = 'unknown';

    // Generazione tramite il provider AI configurato
    if (!content && LOVABLE_API_KEY) {
      console.log('Using Lovable AI fallback for market intelligence');
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
            { role: 'user', content: userPrompt }
          ],
          temperature: 0.2,
          max_tokens: 3000,
        }),
      });

      if (!aiResponse.ok) {
        const errText = await aiResponse.text();
        console.error('Lovable AI fallback also failed:', aiResponse.status, errText);
        if (aiResponse.status === 429) {
          return new Response(JSON.stringify({ error: 'Rate limit exceeded, riprova tra poco' }), {
            status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }
        if (aiResponse.status === 402) {
          return new Response(JSON.stringify({ error: 'Crediti AI esauriti' }), {
            status: 402, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }
        throw new Error(`AI fallback error: ${aiResponse.status}`);
      }

      const aiData = await aiResponse.json();
      content = aiData.choices?.[0]?.message?.content;
      usedProvider = 'lovable-ai';
      console.log('Lovable AI fallback response received');
    }

    if (!content) {
      throw new Error('Nessun provider AI configurato.');
    }

    // Parse JSON from response
    let marketData;
    try {
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        marketData = JSON.parse(jsonMatch[0]);
      } else {
        throw new Error('No JSON found in response');
      }
    } catch (parseError) {
      console.error('JSON parse error:', parseError);
      marketData = {
        sector_trends: [],
        regulatory_updates: [],
        market_statistics: [],
        recommendations: []
      };
    }

    // Arricchimento con le citazioni disponibili
    if (citations && citations.length > 0) {
      // Add real source URLs to trends
      if (marketData.sector_trends) {
        marketData.sector_trends = marketData.sector_trends.map((trend: any, i: number) => ({
          ...trend,
          source_url: citations[i % citations.length] || null,
          source_title: extractDomainName(citations[i % citations.length])
        }));
      }

      // Add real source URLs to regulatory updates
      if (marketData.regulatory_updates) {
        const startIdx = marketData.sector_trends?.length || 0;
        marketData.regulatory_updates = marketData.regulatory_updates.map((update: any, i: number) => ({
          ...update,
          source_url: citations[(startIdx + i) % citations.length] || null,
          source_title: extractDomainName(citations[(startIdx + i) % citations.length])
        }));
      }
    }

    // Add metadata
    const now = new Date();
    const expiresAt = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000); // 7 days
    
    marketData.generated_at = now.toISOString();
    marketData.sources_count = citations?.length || 0;

    // Save to cache
    const { error: upsertError } = await supabase
      .from('market_intelligence_cache')
      .upsert({
        cache_key: cacheKey,
        sector,
        jurisdiction,
        user_role: role,
        intelligence_data: marketData,
        created_at: now.toISOString(),
        expires_at: expiresAt.toISOString()
      }, {
        onConflict: 'cache_key'
      });

    if (upsertError) {
      console.error('Cache upsert error:', upsertError);
      // Continue anyway, just log the error
    } else {
      console.log('Market intelligence cached successfully for:', cacheKey);
    }

    return new Response(
      JSON.stringify({
        ...marketData,
        cached: false,
        expires_at: expiresAt.toISOString()
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Market intelligence error:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

function extractDomainName(url: string | null): string {
  if (!url) return 'Fonte';
  try {
    const domain = new URL(url).hostname.replace('www.', '');
    const domainNames: Record<string, string> = {
      'eur-lex.europa.eu': 'EUR-Lex',
      'enisa.europa.eu': 'ENISA',
      'edpb.europa.eu': 'EDPB',
      'garanteprivacy.it': 'Garante Privacy',
      'acn.gov.it': 'ACN',
      'digital-strategy.ec.europa.eu': 'European Commission',
      'ec.europa.eu': 'European Commission',
      'normattiva.it': 'Normattiva',
      'agendadigitale.eu': 'Agenda Digitale',
      'cybersecurity360.it': 'Cybersecurity360',
      'corrierecomunicazioni.it': 'CorCom',
    };
    return domainNames[domain] || domain;
  } catch {
    return 'Fonte';
  }
}
