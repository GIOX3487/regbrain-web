import { protect } from '../_shared/access.ts';
import { aiFetch as fetch, getAIKey, getAIModel } from '../_shared/ai.ts';
import { serve as denoServe } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2.75.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

denoServe(protect(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const lovableApiKey = getAIKey()!;
    
    if (!lovableApiKey) {
      throw new Error('LOVABLE_API_KEY not configured');
    }

    const supabase = createClient(supabaseUrl, supabaseKey);
    const { regulation, offset = 0, limit = 30 } = await req.json();

    if (!regulation) {
      return new Response(JSON.stringify({ error: 'regulation is required' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log(`📋 Extracting requirements for: ${regulation} (offset=${offset}, limit=${limit})`);

    // 1) Find documents matching this regulation
    const regSearchTerms: Record<string, string[]> = {
      'GDPR': ['gdpr', 'regolamento 2016/679', 'protezione dati'],
      'NIS2': ['nis2', 'nis 2', '2022/2555', 'direttiva nis'],
      'DORA': ['dora', '2022/2554', 'resilienza operativa'],
      'AI Act': ['ai act', '2024/1689', 'intelligenza artificiale'],
      'CRA': ['cra', 'cyber resilience', 'resilienza informatica'],
      'Data Act': ['data act', '2023/2854'],
      'ISO 27001': ['iso 27001', 'iso27001'],
      'D.Lgs 81/08': ['81/08', 'sicurezza lavoro', 'testo unico sicurezza'],
      'Legge 124/2024 Albania': ['124/2024', 'albania', 'protezione dati albania'],
    };

    const searchTerms = regSearchTerms[regulation] || [regulation.toLowerCase()];
    
    const { data: documents } = await supabase
      .from('documents')
      .select('id, title')
      .or(searchTerms.map(t => `title.ilike.%${t}%`).join(','));

    if (!documents || documents.length === 0) {
      return new Response(JSON.stringify({ 
        error: `No documents found for regulation: ${regulation}`,
        suggestion: 'Load the regulation documents first via the admin panel',
      }), { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    console.log(`📄 Found ${documents.length} documents for ${regulation}`);
    const docIds = documents.map(d => d.id);

    // 2) Fetch all chunks
    const { data: chunks } = await supabase
      .from('chunks')
      .select('id, content, document_id')
      .in('document_id', docIds)
      .order('start_pos', { ascending: true });

    const { data: structuredChunks } = await supabase
      .from('structured_chunks')
      .select('id, chunk_text, article_reference, article_number, regulation, section_hierarchy')
      .in('document_id', docIds)
      .order('article_number', { ascending: true });

    console.log(`📦 Found ${chunks?.length || 0} chunks + ${structuredChunks?.length || 0} structured chunks`);

    // 3) Group chunks by article
    const articleGroups: Record<string, { articleNum: number; reference: string; texts: string[] }> = {};

    if (structuredChunks) {
      for (const sc of structuredChunks) {
        if (sc.article_number) {
          const key = `art_${sc.article_number}`;
          if (!articleGroups[key]) {
            articleGroups[key] = {
              articleNum: sc.article_number,
              reference: sc.article_reference || `Articolo ${sc.article_number}`,
              texts: [],
            };
          }
          articleGroups[key].texts.push(sc.chunk_text);
        }
      }
    }

    if (chunks) {
      const artRegex = /(?:articol[oi]|article|art\.?)\s*(\d+)/gi;
      for (const chunk of chunks) {
        const matches = [...chunk.content.matchAll(artRegex)];
        for (const match of matches) {
          const artNum = parseInt(match[1]);
          const key = `art_${artNum}`;
          if (!articleGroups[key]) {
            articleGroups[key] = { articleNum: artNum, reference: `Articolo ${artNum}`, texts: [] };
          }
          const snippet = chunk.content.substring(
            Math.max(0, match.index! - 200),
            Math.min(chunk.content.length, match.index! + 2000)
          );
          if (!articleGroups[key].texts.some(t => t.includes(snippet.substring(0, 100)))) {
            articleGroups[key].texts.push(snippet);
          }
        }
      }
    }

    const allArticleKeys = Object.keys(articleGroups).sort((a, b) => {
      return parseInt(a.replace('art_', '')) - parseInt(b.replace('art_', ''));
    });

    const totalArticles = allArticleKeys.length;
    // Apply pagination
    const articleKeys = allArticleKeys.slice(offset, offset + limit);
    const hasMore = offset + limit < totalArticles;

    console.log(`📑 Processing articles ${offset + 1}-${offset + articleKeys.length} of ${totalArticles}`);

    // 4) Process articles — send 10 articles per LLM call, run 3 calls in parallel
    const BATCH_SIZE = 10;
    const PARALLEL = 3;
    const allRequirements: any[] = [];
    const processedArticles: string[] = [];
    const regIdPrefix = regulation.toLowerCase().replace(/[\s.\/]/g, '_');

    const processBatch = async (batchKeys: string[]) => {
      const articlesText = batchKeys.map(key => {
        const group = articleGroups[key];
        const combinedText = group.texts.join('\n\n').substring(0, 3000);
        return `--- ${group.reference} ---\n${combinedText}`;
      }).join('\n\n==========\n\n');

      const userPrompt = `Analizza questi articoli della normativa "${regulation}" ed estrai SOLO i requisiti che impongono OBBLIGHI CONCRETI E VERIFICABILI alle organizzazioni.

NON includere: definizioni, ambito di applicazione, disposizioni transitorie, riferimenti senza obbligo.

${articlesText}

Per ogni requisito, restituisci un JSON array con:
- "requirement_id": "${regIdPrefix}_artN_topic"
- "article_number": integer
- "reference": "Articolo N ${regulation} - Titolo"
- "description_it": 2-3 frasi italiano
- "description_en": 2-3 frasi inglese
- "risk_level": "critical"|"high"|"medium"|"low"
- "remediation_effort": "very_high"|"high"|"medium"|"low"
- "coverage_keywords": ALMENO 8 termini PRATICI aziendali (IT+EN), sinonimi, abbreviazioni (DPO,DPIA,ROPA,DSAR)
- "gap_description_it": cosa manca se NON coperto
- "gap_description_en": same in English
- "recommended_action_it": azione concreta
- "recommended_action_en": same in English
- "action_hours": integer

Se un articolo non contiene obblighi concreti, restituisci array vuoto [].
Restituisci SOLO un JSON array valido, SENZA markdown, commenti o backtick.`;

      const aiResponse = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${lovableApiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'google/gemini-2.5-flash',
          messages: [{ role: 'user', content: userPrompt }],
          temperature: 0,
          max_tokens: 8000,
        }),
      });

      if (!aiResponse.ok) {
        console.error(`AI error: ${await aiResponse.text()}`);
        return [];
      }

      const aiData = await aiResponse.json();
      const content = aiData.choices?.[0]?.message?.content || '';
      
      try {
        const jsonStr = content.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
        let parsed = JSON.parse(jsonStr);
        if (!Array.isArray(parsed)) parsed = [parsed];
        return parsed;
      } catch {
        console.error(`Failed to parse response for articles: ${batchKeys.join(',')}`);
        return [];
      }
    };

    // Create all batches
    const batches: string[][] = [];
    for (let i = 0; i < articleKeys.length; i += BATCH_SIZE) {
      batches.push(articleKeys.slice(i, i + BATCH_SIZE));
    }

    // Process in parallel groups
    for (let i = 0; i < batches.length; i += PARALLEL) {
      const parallelBatches = batches.slice(i, i + PARALLEL);
      const results = await Promise.all(parallelBatches.map(b => processBatch(b)));
      
      for (let j = 0; j < parallelBatches.length; j++) {
        const parsed = results[j];
        for (const req of parsed) {
          if (req.requirement_id && req.description_it && req.coverage_keywords?.length >= 3) {
            allRequirements.push({
              requirement_id: req.requirement_id,
              regulation,
              reference: req.reference || `Articolo ${req.article_number} ${regulation}`,
              article_number: req.article_number,
              description_it: req.description_it,
              description_en: req.description_en || req.description_it,
              risk_level: req.risk_level || 'high',
              remediation_effort: req.remediation_effort || 'medium',
              coverage_keywords: req.coverage_keywords,
              rag_validation_keywords: req.coverage_keywords.slice(0, 5),
              gap_description_it: req.gap_description_it || `Mancata conformità a ${req.reference}`,
              gap_description_en: req.gap_description_en || `Non-compliance with ${req.reference}`,
              recommended_action_it: req.recommended_action_it || `Implementare le misure richieste da ${req.reference}`,
              recommended_action_en: req.recommended_action_en || `Implement measures required by ${req.reference}`,
              action_hours: req.action_hours || 24,
              action_cost_eur: (req.action_hours || 24) * 85,
              coverage_threshold: 0.10,
              min_keyword_matches: 1,
              source: 'auto_extracted',
              verified: false,
              active: false,
            });
          }
        }
        for (const key of parallelBatches[j]) {
          processedArticles.push(articleGroups[key].reference);
        }
      }

      console.log(`✅ Processed ${Math.min((i + PARALLEL) * BATCH_SIZE, articleKeys.length)}/${articleKeys.length} articles`);
    }

    console.log(`📊 Total requirements extracted: ${allRequirements.length}`);

    // 5) Upsert into database
    let inserted = 0;
    let skipped = 0;
    
    // Batch upsert for speed
    const UPSERT_BATCH = 20;
    for (let i = 0; i < allRequirements.length; i += UPSERT_BATCH) {
      const batch = allRequirements.slice(i, i + UPSERT_BATCH);
      const { error } = await supabase
        .from('regulatory_requirements')
        .upsert(batch, { onConflict: 'requirement_id' });
      
      if (error) {
        console.error(`Upsert error batch ${i}:`, error.message);
        skipped += batch.length;
      } else {
        inserted += batch.length;
      }
    }

    const report = {
      regulation,
      total_articles: totalArticles,
      articles_processed: processedArticles.length,
      requirements_extracted: allRequirements.length,
      inserted,
      skipped,
      has_more: hasMore,
      next_offset: hasMore ? offset + limit : null,
      articles_list: processedArticles,
    };

    console.log(`✅ Extraction complete: ${inserted} inserted, ${skipped} skipped`);

    return new Response(JSON.stringify(report), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Extract requirements error:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
}, true, false));
