import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Detect regulation names in question
function detectRegulations(question: string): string[] {
  const patterns: { pattern: RegExp; searchTerm: string }[] = [
    { pattern: /data\s*act/i, searchTerm: 'Data Act' },
    { pattern: /ai\s*act/i, searchTerm: 'AI Act' },
    { pattern: /cyber\s*resilience\s*act|cra/i, searchTerm: 'Cyber Resilience Act' },
    { pattern: /nis\s*2|nis2/i, searchTerm: 'NIS2' },
    { pattern: /dora/i, searchTerm: 'DORA' },
    { pattern: /gdpr/i, searchTerm: 'GDPR' },
    { pattern: /codice\s*(della\s*)?cybersicurezza/i, searchTerm: 'Codice della Cybersicurezza' },
    { pattern: /iso\s*27001|iso\/iec\s*27001/i, searchTerm: 'ISO 27001' },
    { pattern: /d\.?\s*lgs\.?\s*81/i, searchTerm: 'D.Lgs 81/08' },
    { pattern: /agid/i, searchTerm: 'AgID' },
  ];
  const detected: string[] = [];
  for (const { pattern, searchTerm } of patterns) {
    if (pattern.test(question)) detected.push(searchTerm);
  }
  return detected;
}

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function extractReferencedNormativeItems(answer: string): Array<{ fullMatch: string; type: 'article' | 'section'; value: string; citationNum: number | null }> {
  const refs: Array<{ fullMatch: string; type: 'article' | 'section'; value: string; citationNum: number | null }> = [];
  const pattern = /((?:articolo|art\.?|article|sezione|section)\s+([0-9IVX]+(?:\.[0-9]+)?))\s*(?:\[(\d+)\])?/gi;
  let match;
  while ((match = pattern.exec(answer)) !== null) {
    const rawType = match[1].toLowerCase();
    refs.push({
      fullMatch: match[0],
      type: rawType.includes('sezione') || rawType.includes('section') ? 'section' : 'article',
      value: match[2],
      citationNum: match[3] ? parseInt(match[3]) : null,
    });
  }
  return refs;
}

function chunkContainsReference(chunkContent: string, type: 'article' | 'section', value: string): boolean {
  const escaped = escapeRegex(value);
  if (type === 'article') {
    return new RegExp(`(?:articolo|art\\.?|article)\\s+${escaped}`, 'i').test(chunkContent);
  }
  return new RegExp(`(?:sezione|section|capo|chapter)\\s+${escaped}`, 'i').test(chunkContent);
}

function sanitizeUnverifiableReferences(answer: string, refs: Array<{ fullMatch: string; citationNum: number | null }>): string {
  let sanitized = answer;
  for (const ref of refs) {
    const replacement = ref.citationNum
      ? `la disposizione citata [${ref.citationNum}]`
      : 'la disposizione citata';
    sanitized = sanitized.replaceAll(ref.fullMatch, replacement);
  }
  return sanitized;
}

// Retrieve RAG chunks relevant to the question
async function retrieveRAGChunks(
  supabase: any,
  question: string,
  detectedRegulations: string[]
): Promise<{ chunks: any[]; docMap: Map<string, any> }> {
  // 1. Generate query embedding — prefer real OpenAI embeddings
  const openaiKey = Deno.env.get('OPENAI_API_KEY');
  let finalEmbedding: number[];

  if (openaiKey) {
    try {
      const embResponse = await fetch('https://api.openai.com/v1/embeddings', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${openaiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'text-embedding-3-small',
          input: question.replace(/\n+/g, ' ').trim().substring(0, 8000),
          dimensions: 768,
        }),
      });
      if (embResponse.ok) {
        const embData = await embResponse.json();
        finalEmbedding = embData.data[0].embedding;
        console.log('Using real OpenAI embedding for vector search');
      } else {
        console.warn('OpenAI embedding failed, using fallback');
        finalEmbedding = generateFallbackEmbedding(question);
      }
    } catch {
      finalEmbedding = generateFallbackEmbedding(question);
    }
  } else {
    finalEmbedding = generateFallbackEmbedding(question);
  }

  // 2. Get regulation-specific chunks
  let regulationChunks: any[] = [];
  let regulationDocIds: string[] = [];

  if (detectedRegulations.length > 0) {
    for (const regName of detectedRegulations) {
      const { data: regDocs } = await supabase
        .from('documents')
        .select('id, title')
        .ilike('title', `%${regName}%`)
        .limit(2);

      if (regDocs && regDocs.length > 0) {
        regulationDocIds.push(...regDocs.map((d: any) => d.id));
        const docIds = regDocs.map((d: any) => d.id);
        const { data: chunks } = await supabase
          .from('chunks')
          .select('id, document_id, content')
          .in('document_id', docIds)
          .limit(10);
        if (chunks) {
          regulationChunks.push(...chunks.map((c: any) => ({ ...c, similarity: 0.9 })));
        }
      }
    }
  }

  // 3. Vector search
  const { data: vectorMatches } = await supabase.rpc('match_chunks', {
    query_embedding: finalEmbedding,
    match_threshold: 0.2,
    match_count: 30
  });

  let diversifiedChunks: any[] = [];
  if (vectorMatches && vectorMatches.length > 0) {
    let filtered = vectorMatches;
    if (regulationDocIds.length > 0) {
      filtered = vectorMatches.filter((c: any) => regulationDocIds.includes(c.document_id));
    }
    const byDoc = new Map<string, any[]>();
    for (const chunk of filtered) {
      if (!byDoc.has(chunk.document_id)) byDoc.set(chunk.document_id, []);
      byDoc.get(chunk.document_id)!.push(chunk);
    }
    const docs = Array.from(byDoc.entries());
    let idx = 0;
    while (diversifiedChunks.length < 15 && docs.some(([_, c]) => c.length > 0)) {
      const [docId, chunks] = docs[idx % docs.length];
      if (chunks.length > 0) {
        const chunk = chunks.shift()!;
        if (diversifiedChunks.filter(c => c.document_id === docId).length < 5) {
          diversifiedChunks.push(chunk);
        }
      }
      idx++;
    }
  }

  // 4. Article-specific text search
  const articleRefs = question.match(/(?:articolo|art\.?|article)\s+(\d+)/gi) || [];
  if (articleRefs.length > 0) {
    for (const ref of articleRefs) {
      const num = ref.match(/\d+/)?.[0];
      if (!num) continue;
      const { data: articleChunks } = await supabase
        .from('chunks')
        .select('id, document_id, content')
        .or(`content.ilike.%articolo ${num}%,content.ilike.%art. ${num}%,content.ilike.%article ${num}%`)
        .limit(5);
      if (articleChunks) {
        const existingIds = new Set([...regulationChunks, ...diversifiedChunks].map(c => c.id));
        for (const c of articleChunks) {
          if (!existingIds.has(c.id)) {
            diversifiedChunks.push({ ...c, similarity: 0.85 });
          }
        }
      }
    }
  }

  // 5. Merge regulation + vector chunks
  if (regulationChunks.length > 0) {
    const regIds = new Set(regulationChunks.map(c => c.id));
    const filtered = diversifiedChunks.filter(c => !regIds.has(c.id));
    diversifiedChunks = [...regulationChunks, ...filtered].slice(0, 15);
  }

  // Fallback: text search if too few chunks
  if (diversifiedChunks.length < 3) {
    const keywords = question.toLowerCase().split(/\s+/).filter(w => w.length > 4).slice(0, 5);
    for (const kw of keywords) {
      const { data } = await supabase
        .from('chunks')
        .select('id, document_id, content')
        .ilike('content', `%${kw}%`)
        .limit(5);
      if (data) {
        const existingIds = new Set(diversifiedChunks.map(c => c.id));
        for (const c of data) {
          if (!existingIds.has(c.id) && diversifiedChunks.length < 15) {
            diversifiedChunks.push({ ...c, similarity: 0.5 });
          }
        }
      }
    }
  }

  // 6. Get document metadata
  const documentIds = [...new Set(diversifiedChunks.map(c => c.document_id))];
  const { data: documents } = await supabase
    .from('documents')
    .select('*')
    .in('id', documentIds);
  const docMap = new Map<string, any>((documents || []).map((d: any): [string, any] => [String(d.id), d]));

  return { chunks: diversifiedChunks, docMap };
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const lovableApiKey = Deno.env.get('LOVABLE_API_KEY')!;

    const supabase = createClient(supabaseUrl, supabaseKey);

    const authHeader = req.headers.get('Authorization')!;
    const token = authHeader.replace('Bearer ', '');
    const { data: { user } } = await supabase.auth.getUser(token);

    if (!user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { question, conversationHistory = [] } = await req.json();

    if (!question || !question.trim()) {
      return new Response(JSON.stringify({ error: 'Question is required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log('AI Copilot RAG query:', question);

    // Load user profile
    const { data: profile } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .single();

    // Load recent assessments for context
    const { data: recentAssessments } = await supabase
      .from('compliance_assessments')
      .select('title, scope_regulations, overall_risk_score, overall_compliance_percentage')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(3);

    // RAG Retrieval
    const detectedRegs = detectRegulations(question);
    // Also check conversation history for regulation context
    const historyText = conversationHistory.map((m: any) => m.content).join(' ');
    const historyRegs = detectRegulations(historyText);
    const allRegs = [...new Set([...detectedRegs, ...historyRegs])];

    console.log('Detected regulations:', allRegs);

    const { chunks, docMap } = await retrieveRAGChunks(supabase, question, allRegs);
    console.log(`RAG retrieved ${chunks.length} chunks from ${docMap.size} documents`);

    // Format context with citations
    const contextWithCitations = chunks.map((chunk: any, idx: number) => {
      const doc = docMap.get(chunk.document_id);
      return `[${idx + 1}] ${doc?.title || 'Unknown'} (${doc?.version || ''})\nContenuto: ${chunk.content}\n`;
    }).join('\n---\n');

    // Build citations array for frontend
    const citations = chunks.map((chunk: any, idx: number) => {
      const doc = docMap.get(chunk.document_id);
      return {
        index: idx + 1,
        documentTitle: doc?.title || 'Unknown',
        documentId: chunk.document_id,
        content: chunk.content,
        version: doc?.version || '',
      };
    });

    // Build RAG-grounded system prompt
    const systemPrompt = `[REGOLE TASSATIVE DI INGAGGIO E FORMATTAZIONE - OVERRIDE]

Il tuo obiettivo è comportarti come un consulente esperto e diretto. Non sei un generatore di report formali.

CONTESTO UTENTE:
- Ruolo: ${profile?.compliance_role || 'Non specificato'}
- Settore: ${profile?.sector || 'Non specificato'}
- Giurisdizione: ${profile?.jurisdiction || 'Non specificata'}

${recentAssessments && recentAssessments.length > 0 ? `ASSESSMENT RECENTI:
${recentAssessments.map((a: any) => `- ${a.title}: ${a.overall_compliance_percentage}% compliance, risk score ${a.overall_risk_score}`).join('\n')}` : ''}

STILE DI RISPOSTA E DIVIETI:

1. DIVIETO DI PREAMBOLI: Inizia a rispondere immediatamente alla domanda. Niente saluti formali, niente giri di parole e MAI iniziare con frasi come "In qualità di professionista...", "Di seguito l'analisi..." o "Ecco i dettagli".

2. DIVIETO DI SCARICABARILE: Se l'utente chiede "La mia organizzazione deve fare X?" o "Devo adempiere a questo obbligo?", NON dirgli mai di "redigere un documento", "fare un assessment interno" o "consultare un legale". Sei TU che devi guidarlo nell'assessment attraverso le tue domande.

3. ZERO ASSUNZIONI: Usa il settore e il ruolo dell'utente solo per contestualizzare, ma NON dare per scontato che bastino per determinare un obbligo di legge (es. un'azienda "Tech" non ha in automatico gli stessi obblighi di un'altra). Se il contesto utente dice "Non specificato", trattalo come sconosciuto.

STRUTTURA OBBLIGATORIA DELLA RISPOSTA (REGOLE DI IMPAGINAZIONE):

Devi formattare il testo in modo arioso e leggibile. Usa SEMPRE un doppio ritorno a capo (riga vuota) per separare i paragrafi e le sezioni.

Dividi la risposta esattamente in queste tre sezioni:

**1. Regola Generale**

Fornisci una sintesi secca e chiara dell'obbligo o requisito normativo. Usa le fonti [N] per giustificarla punto per punto. Se ci sono più scenari o requisiti, NON scriverli di seguito ma usa SEMPRE un elenco puntato, andando a capo per ogni punto.

**2. Applicazione al tuo contesto**

Se conosci il settore o il ruolo dell'utente, fai esempi pertinenti di come la regola si applica generalmente a quel mondo (es. per il settore Tech: tracciamento online, profilazione). Usa paragrafi brevi e separati da una riga vuota. Se non lo conosci, salta questa parte.

**3. Domande per te**

Se l'utente chiede una valutazione specifica sulla sua situazione e non hai tutti i dettagli operativi per rispondere con un "Sì" o "No" definitivo, elenca le domande usando SEMPRE un elenco numerato (1., 2., 3.). Manda a capo ogni singola domanda. Non scriverle mai sulla stessa riga. Concludi chiedendogli di rispondere per permetterti di dargli una valutazione esatta.

REGOLE DI FORMATTAZIONE TASSATIVE:

- DIVIETO di "Muri di testo" (Wall of text): non scrivere mai più di 3-4 righe senza andare a capo.
- Usa i ritorni a capo prima e dopo ogni titolo in grassetto.
- Usa gli elenchi puntati (- o *) per rendere la lettura più fluida quando elenchi regole o sanzioni.
- NON usare intestazioni con # o ### — usa SOLO titoli in grassetto con **Titolo** su riga isolata.
- Niente emoji. Usa il **grassetto** per enfatizzare i concetti chiave.

REGOLE ANTI-ALLUCINAZIONE:

- Rispondi SOLO con informazioni presenti nella documentazione normativa fornita.
- CITA SEMPRE la fonte usando [N] per ogni affermazione normativa.
- OGNI articolo, obbligo o requisito menzionato DEVE avere [N] subito dopo.
- Se NON trovi informazioni nel contesto fornito, dillo esplicitamente: "Non ho trovato informazioni specifiche su questo tema nella documentazione disponibile."
- MAI inventare articoli, numeri o riferimenti non presenti nelle fonti.
- Usa la terminologia ESATTA presente nei documenti citati.
- CITA SOLO fonti DIRETTAMENTE pertinenti alla domanda specifica — NON citare fonti su normative o argomenti diversi.
- Usa un tono professionale ma diretto, come un collega esperto che va al punto.
- Sii conciso ma completo (max 3-4 paragrafi per la risposta principale).

DOCUMENTAZIONE NORMATIVA (BASE DI CONOSCENZA — CITA SEMPRE [N]):
${contextWithCitations || 'Nessuna documentazione normativa trovata per questa domanda.'}

CHECKLIST INTERNA (Assicurati di rispettare questi punti prima di generare l'output):
□ Ho risposto direttamente senza preamboli inutili?
□ Ho inserito le citazioni [N] dove necessario?
□ Ho evitato di dire all'utente di "farsi un assessment interno"?
□ Se l'utente chiede una valutazione specifica e mancano dati, ho posto 2-3 domande mirate per aiutarlo?
□ La risposta è basata SOLO sulle fonti fornite?`;

    // Build messages
    const messages = [
      { role: 'system', content: systemPrompt },
      ...conversationHistory.slice(-6).map((msg: any) => ({
        role: msg.role,
        content: msg.content
      })),
      { role: 'user', content: question }
    ];

    // Call Lovable AI
    const aiResponse = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${lovableApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-3-pro-preview',
        messages,
        temperature: 0.1,
        max_tokens: 1500
      }),
    });

    if (!aiResponse.ok) {
      const errorText = await aiResponse.text();
      console.error('AI API error:', errorText);
      if (aiResponse.status === 429) {
        return new Response(JSON.stringify({ error: 'Rate limit exceeded, riprova tra poco' }), {
          status: 429,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      if (aiResponse.status === 402) {
        return new Response(JSON.stringify({ error: 'Crediti AI esauriti' }), {
          status: 402,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      throw new Error(`AI API error: ${aiResponse.status}`);
    }

    const aiData = await aiResponse.json();
    const rawAnswer = aiData.choices[0].message.content;

    // Validate references like "Articolo X [N]" / "Sezione X [N]" against cited chunk content
    const refs = extractReferencedNormativeItems(rawAnswer);
    const invalidRefs = refs.filter((ref) => {
      if (!ref.citationNum) return true;
      const citedChunk = citations.find((c: any) => c.index === ref.citationNum);
      if (!citedChunk) return true;
      return !chunkContainsReference(citedChunk.content, ref.type, ref.value);
    });

    const answer = invalidRefs.length > 0
      ? sanitizeUnverifiableReferences(rawAnswer, invalidRefs)
      : rawAnswer;

    if (invalidRefs.length > 0) {
      console.warn(`Sanitized ${invalidRefs.length} unverifiable article/section references`);
    }

    // Post-process: only return citations actually referenced [N] in the answer
    const citedNumbers = new Set<number>();
    const citationMatches = answer.matchAll(/\[(\d+)\]/g);
    for (const m of citationMatches) {
      citedNumbers.add(parseInt(m[1]));
    }
    
    const filteredCitations = citations.filter((c: any) => citedNumbers.has(c.index));
    console.log(`Citations: ${citations.length} total, ${filteredCitations.length} actually cited in answer`);

    // Save to query log only for registered (non-demo, non-anonymous) users
    const isDemoUser = user.email?.endsWith('@demo.regbrain.com');
    const isAnonymous = (user as any).is_anonymous === true || !user.email;
    if (!isDemoUser && !isAnonymous) {
      await supabase
        .from('query_log')
        .insert({
          user_id: user.id,
          question,
          answer,
          model: 'google/gemini-3-pro-preview',
          citations: filteredCitations.length > 0 ? filteredCitations : null
        });
    }

    console.log('AI Copilot RAG response generated successfully');

    return new Response(JSON.stringify({ answer, citations: filteredCitations }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error: any) {
    console.error('Error in ai-compliance-copilot:', error);
    return new Response(
      JSON.stringify({
        error: error.message,
        details: 'Errore durante l\'elaborazione della richiesta'
      }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});

function generateFallbackEmbedding(question: string): number[] {
  const words = question.toLowerCase().split(/\s+/);
  const questionEmbedding: number[] = [];
  for (let i = 0; i < 768; i++) {
    let value = 0;
    words.forEach((word, idx) => {
      const charCode = word.charCodeAt(idx % word.length) || 0;
      value += Math.sin(charCode * (i + 1)) * 0.1;
    });
    questionEmbedding.push(value);
  }
  const magnitude = Math.sqrt(questionEmbedding.reduce((sum, val) => sum + val * val, 0));
  return questionEmbedding.map(val => val / magnitude);
}
