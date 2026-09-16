import { protect } from '../_shared/access.ts';
import { aiFetch as fetch, getAIKey } from '../_shared/ai.ts';
import { serve as denoServe } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2.75.0";

// ============================================================
// CATALOGO COMPLETO DELLE DISPOSIZIONI
// Legge il testo normativo articolo per articolo dalla knowledge base
// (chunk con intestazione "[REG, ..., Art. N: Titolo. Par. K]") e chiede
// all'AI di estrarre ogni obbligo che grava sull'organizzazione, con
// gravità, condizione di applicabilità e cosa deve risultare dai documenti.
// Il risultato finisce in regulatory_requirements e alimenta la gap analysis.
// Solo amministratori. Paginato per articoli (offset/limit) per restare
// entro i limiti di esecuzione.
// ============================================================

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const REGULATION_DOC_TITLE: Record<string, string> = {
  'GDPR': 'GDPR - Regolamento (UE) 2016/679%',
  'NIS2': 'NIS2 - Direttiva (UE) 2022/2555%',
  'DORA': 'DORA - Regolamento (UE) 2022/2554%',
  'AI Act': 'AI Act - Regolamento (UE) 2024/1689%',
  'CRA': 'CRA - Regolamento (UE) 2024/2847%',
  'Data Act': 'Data Act - Regolamento (UE) 2023/2854%',
};

// Chi è il destinatario degli obblighi, per normativa: guida l'estrazione
const REGULATED_SUBJECTS: Record<string, string> = {
  'GDPR': 'titolare del trattamento, responsabile del trattamento, rappresentante, DPO (in quanto funzione interna del titolare)',
  'NIS2': 'soggetti essenziali e importanti (imprese e organizzazioni destinatarie degli obblighi di gestione del rischio e di notifica), loro organi di gestione',
  'DORA': 'entità finanziarie e fornitori terzi di servizi TIC',
  'AI Act': 'fornitori, deployer (utilizzatori), importatori, distributori e rappresentanti autorizzati di sistemi di IA, fornitori di modelli di IA per finalità generali',
  'CRA': 'fabbricanti, importatori, distributori e rappresentanti autorizzati di prodotti con elementi digitali, gestori di software open source',
  'Data Act': 'titolari dei dati, utenti, destinatari dei dati, fabbricanti di prodotti connessi, fornitori di servizi di trattamento dei dati (cloud)',
};

interface ArticleText { number: string; title: string; paragraphs: Array<{ par: string; text: string }> }

function parseHeader(content: string): { reg: string; article: string; title: string; par: string } | null {
  const firstLine = content.split('\n')[0] || '';
  const m = firstLine.match(/^\[([^,\]]+),[^\]]*?Art\.\s*(\d+[a-z]?)\s*:\s*(.*?)(?:\.\s*Par\.\s*([^\]]+))?\]\s*$/);
  if (!m) return null;
  return { reg: m[1].trim(), article: m[2], title: m[3].trim(), par: (m[4] || '').trim() };
}

function slugify(text: string): string {
  return text.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '').substring(0, 40) || 'obbligo';
}

function extractJson(text: string): any | null {
  const cleaned = (text || '').replace(/```json|```/gi, '').trim();
  try { return JSON.parse(cleaned); } catch { /* continue */ }
  const s = cleaned.indexOf('{'); const e = cleaned.lastIndexOf('}');
  if (s >= 0 && e > s) { try { return JSON.parse(cleaned.substring(s, e + 1)); } catch { return null; } }
  return null;
}

async function extractBatch(apiKey: string, regulation: string, articles: ArticleText[]): Promise<Map<string, any[]>> {
  const systemPrompt = `Sei un giurista esperto di compliance. Leggi articoli di una normativa europea e ne estrai gli OBBLIGHI che gravano sull'organizzazione regolata, per costruire una checklist di gap analysis documentale.

Normativa: ${regulation}. Soggetti regolati: ${REGULATED_SUBJECTS[regulation] || 'le organizzazioni destinatarie'}.

Rispondi SOLO con un oggetto JSON:
{"articles":[{"article":"N","requirements":[{
  "slug":"parole_chiave_brevi",
  "paragraphs":"1-2" oppure "" se l'obbligo riguarda l'intero articolo,
  "short_title":"titolo breve dell'obbligo (max 8 parole)",
  "description_it":"cosa deve fare l'organizzazione, 1-2 frasi precise, con i contenuti obbligatori",
  "description_en":"same in English",
  "evidence_expected_it":"quali documenti o contenuti devono risultare per considerare soddisfatto l'obbligo (elenco concreto)",
  "risk_level":"critical|high|medium|low",
  "remediation_effort":"very_high|high|medium|low",
  "conditional":true|false,
  "applicability_note_it":"se conditional: in quali situazioni si applica (ruolo, soglia, tipo di trattamento o prodotto); altrimenti \\"\\"",
  "coverage_keywords":["8-12 termini pratici in italiano e inglese, sinonimi, sigle"],
  "gap_description_it":"cosa manca se l'obbligo non è documentato (1 frase)",
  "gap_description_en":"same in English",
  "recommended_action_it":"azione concreta per rimediare (1-2 frasi, senza stime di tempo o costo)",
  "recommended_action_en":"same in English"
}]}]}

Regole:
- Includi SOLO obblighi verificabili tramite documentazione aziendale (policy, procedure, registri, contratti, informative, valutazioni, evidenze tecniche o organizzative).
- ESCLUDI: definizioni, oggetto e ambito, disposizioni rivolte a Stati membri, Commissione, autorità di controllo o vigilanza, comitati, organismi notificati, ENISA/EDPB; sanzioni e poteri correttivi; atti delegati, comitatologia, entrata in vigore, riesami e norme transitorie; diritti degli interessati descritti dal punto di vista del soggetto tutelato (includi invece l'obbligo corrispondente dell'organizzazione, es. "gestire le richieste di accesso").
- Se un articolo contiene un solo obbligo con più paragrafi che lo dettagliano, produci UN requisito; se contiene obblighi realmente distinti, al massimo 3 requisiti per articolo.
- "conditional" = true quando l'obbligo vale solo in presenza di una condizione (ruolo specifico, soglia dimensionale, tipo di trattamento, categoria di prodotto o sistema, situazione particolare). Un obbligo generale che vale per ogni soggetto regolato è conditional = false.
- risk_level: critical per obblighi fondamentali con la fascia sanzionatoria più alta (principi, basi di liceità, diritti delle persone, sicurezza, categorie particolari, pratiche vietate, gestione e notifica di incidenti e violazioni, requisiti essenziali di sicurezza dei prodotti); high per obblighi organizzativi chiave (registri, valutazioni d'impatto o dei rischi, contratti con fornitori, governance, formazione, resilienza, test); medium per obblighi procedurali, documentali o di cooperazione; low per adempimenti formali o accessori.
- Non inventare obblighi non presenti nel testo. Restituisci ogni articolo ricevuto, anche con "requirements": [] se non contiene obblighi per l'organizzazione.`;

  const userMessage = articles.map((a) => {
    const body = a.paragraphs.map(p => (p.par ? `[Par. ${p.par}] ` : '') + p.text).join('\n').substring(0, 7000);
    return `### Articolo ${a.number} - ${a.title}\n${body}`;
  }).join('\n\n==========\n\n');

  const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: 'google/gemini-3-pro-preview',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userMessage },
      ],
      temperature: 0,
      max_tokens: 12000,
      reasoning_effort: 'low',
      response_format: { type: 'json_object' },
    }),
  });
  if (!response.ok) {
    throw new Error(`AI error ${response.status}: ${(await response.text()).substring(0, 300)}`);
  }
  const data = await response.json();
  const parsed = extractJson(data.choices?.[0]?.message?.content || '');
  const result = new Map<string, any[]>();
  const list: any[] = Array.isArray(parsed?.articles) ? parsed.articles : [];
  for (const item of list) {
    if (item && item.article !== undefined) result.set(String(item.article), Array.isArray(item.requirements) ? item.requirements : []);
  }
  return result;
}

denoServe(protect(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }
  const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

  try {
    const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
    const apiKey = getAIKey();
    if (!apiKey) return json({ error: 'AI key not configured' }, 503);

    const { regulation, offset = 0, limit = 24, dryRun = false } = await req.json();
    const titlePattern = REGULATION_DOC_TITLE[regulation];
    if (!titlePattern) return json({ error: `Regulation not supported for extraction: ${regulation}. Supported: ${Object.keys(REGULATION_DOC_TITLE).join(', ')}` }, 400);

    const { data: docs } = await supabase.from('documents').select('id, title').like('title', titlePattern).limit(1);
    if (!docs || docs.length === 0) return json({ error: `Regulation document not found for ${regulation}` }, 404);
    const doc = docs[0];

    // Legge tutti i chunk del documento (paginazione interna)
    const allChunks: Array<{ content: string }> = [];
    for (let from = 0; ; from += 1000) {
      const { data, error } = await supabase.from('chunks').select('content').eq('document_id', doc.id).range(from, from + 999);
      if (error) throw error;
      if (!data || data.length === 0) break;
      allChunks.push(...data);
      if (data.length < 1000) break;
    }

    // Raggruppa per articolo
    const articles = new Map<string, ArticleText>();
    for (const c of allChunks) {
      const h = parseHeader(c.content);
      if (!h) continue;
      const body = c.content.split('\n').slice(1).join('\n').trim();
      if (!body) continue;
      if (!articles.has(h.article)) articles.set(h.article, { number: h.article, title: h.title, paragraphs: [] });
      const art = articles.get(h.article)!;
      const existing = art.paragraphs.find(p => p.par === h.par);
      if (existing) {
        if (!existing.text.includes(body.substring(0, 80))) existing.text += '\n' + body;
      } else {
        art.paragraphs.push({ par: h.par, text: body });
      }
    }
    const ordered = Array.from(articles.values()).sort((a, b) => parseInt(a.number) - parseInt(b.number) || a.number.localeCompare(b.number));
    for (const a of ordered) a.paragraphs.sort((x, y) => (parseInt(x.par) || 0) - (parseInt(y.par) || 0));

    const slice = ordered.slice(offset, offset + limit);
    console.log(`📑 ${regulation}: ${ordered.length} articles, processing ${offset + 1}-${offset + slice.length}`);

    // Estrazione a lotti di 6 articoli, 3 lotti in parallelo
    const BATCH = 6;
    const batches: ArticleText[][] = [];
    for (let i = 0; i < slice.length; i += BATCH) batches.push(slice.slice(i, i + BATCH));
    const extracted = new Map<string, any[]>();
    for (let i = 0; i < batches.length; i += 3) {
      const group = batches.slice(i, i + 3);
      const results = await Promise.all(group.map(async (b) => {
        for (let attempt = 1; attempt <= 2; attempt++) {
          try { return await extractBatch(apiKey, regulation, b); }
          catch (e) { console.error(`Batch failed (attempt ${attempt}):`, e instanceof Error ? e.message : e); }
        }
        return new Map<string, any[]>();
      }));
      for (const m of results) for (const [k, v] of m) extracted.set(k, v);
    }

    const regPrefix = regulation.toLowerCase().replace(/[^a-z0-9]+/g, '_');
    const rows: any[] = [];
    const usedIds = new Set<string>();
    for (const a of slice) {
      const reqs = extracted.get(a.number) || [];
      for (const r of reqs.slice(0, 3)) {
        if (!r || typeof r.description_it !== 'string' || !r.description_it.trim()) continue;
        let requirementId = `${regPrefix}_art${a.number}_${slugify(String(r.slug || r.short_title || 'obbligo'))}`;
        while (usedIds.has(requirementId)) requirementId += '_2';
        usedIds.add(requirementId);
        const paragraphs = typeof r.paragraphs === 'string' ? r.paragraphs.trim() : '';
        const shortTitle = String(r.short_title || a.title).trim();
        const keywords: string[] = (Array.isArray(r.coverage_keywords) ? r.coverage_keywords : [])
          .filter((k: any) => typeof k === 'string' && k.trim().length >= 3).map((k: string) => k.trim().toLowerCase()).slice(0, 14);
        rows.push({
          requirement_id: requirementId,
          regulation,
          reference: `Articolo ${a.number}${paragraphs ? `, paragraf${/[-,]/.test(paragraphs) ? 'i' : 'o'} ${paragraphs}` : ''} ${regulation} - ${shortTitle}`,
          article_number: parseInt(a.number) || null,
          paragraph: paragraphs || null,
          article_title: a.title,
          description_it: String(r.description_it).trim(),
          description_en: String(r.description_en || r.description_it).trim(),
          evidence_expected_it: String(r.evidence_expected_it || '').trim() || null,
          risk_level: ['critical', 'high', 'medium', 'low'].includes(r.risk_level) ? r.risk_level : 'medium',
          remediation_effort: ['very_high', 'high', 'medium', 'low'].includes(r.remediation_effort) ? r.remediation_effort : 'medium',
          conditional: r.conditional === true,
          applicability_note_it: r.conditional === true ? String(r.applicability_note_it || '').trim() || null : null,
          coverage_keywords: keywords,
          rag_validation_keywords: [`articolo ${a.number}`, `art. ${a.number}`, `art ${a.number}`],
          gap_description_it: String(r.gap_description_it || `Non risulta documentato: ${shortTitle}`).trim(),
          gap_description_en: String(r.gap_description_en || `Not documented: ${shortTitle}`).trim(),
          recommended_action_it: String(r.recommended_action_it || '').trim() || `Documentare quanto richiesto dall'articolo ${a.number} ${regulation}.`,
          recommended_action_en: String(r.recommended_action_en || '').trim() || `Document what Article ${a.number} ${regulation} requires.`,
          action_hours: 0,
          action_cost_eur: 0,
          coverage_threshold: 0.10,
          min_keyword_matches: 1,
          source: 'llm_extracted_v2',
          verified: false,
          active: true,
          source_document_id: doc.id,
          generated_at: new Date().toISOString(),
        });
      }
    }

    let written = 0;
    if (!dryRun) {
      // Rimuove le voci precedenti degli stessi articoli (rigenerazione idempotente)
      const articleNumbers = slice.map(a => parseInt(a.number)).filter(n => !isNaN(n));
      if (articleNumbers.length > 0) {
        await supabase.from('regulatory_requirements').delete().eq('regulation', regulation).in('article_number', articleNumbers);
      }
      for (let i = 0; i < rows.length; i += 20) {
        const { error } = await supabase.from('regulatory_requirements').upsert(rows.slice(i, i + 20), { onConflict: 'requirement_id' });
        if (error) { console.error('Upsert error:', error.message); throw error; }
        written += Math.min(20, rows.length - i);
      }
    }

    const hasMore = offset + limit < ordered.length;
    return json({
      regulation,
      document: doc.title,
      total_articles: ordered.length,
      processed: slice.map(a => a.number),
      requirements: rows.length,
      written,
      has_more: hasMore,
      next_offset: hasMore ? offset + limit : null,
      preview: dryRun ? rows : rows.map(r => ({ id: r.requirement_id, reference: r.reference, risk: r.risk_level, conditional: r.conditional })),
    });
  } catch (error) {
    console.error('Extract requirements error:', error);
    return json({ error: error instanceof Error ? error.message : 'Unknown error' }, 500);
  }
}, true, false));
