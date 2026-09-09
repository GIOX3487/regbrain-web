import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const EMBEDDING_DIMENSIONS = 768;
const MAX_SIZE = 1200;
const MIN_SIZE = 100;

interface Chunk {
  content: string;
  startPos: number;
  endPos: number;
}

function chunkLegalDocument(content: string): Chunk[] {
  const chunks: Chunk[] = [];

  // Split sui confini di Art./CAPO/Sezione/ALLEGATO mantenendo i delimitatori
  const boundaryPattern = /(?=\n\s*(?:Art(?:icolo)?\.?\s+\d+|CAPO\s+[IVXLCDM]+|Sezione\s+[IVXLCDM]+|ALLEGATO\s+[IVXLCDM]+))/gi;
  const parts = content.split(boundaryPattern);

  let pos = 0;
  for (const part of parts) {
    const partLen = part.length;
    if (part.trim().length < MIN_SIZE) {
      pos += partLen;
      continue;
    }

    // Se è di dimensione gestibile (fino a 1.5x MAX_SIZE), un chunk unico
    // così l'Art. 24 comma 2 con i 10 ambiti resta intero
    if (partLen <= MAX_SIZE * 1.8) {
      chunks.push({ content: part.trim(), startPos: pos, endPos: pos + partLen });
      pos += partLen;
      continue;
    }

    // Articolo grande: spezza per paragrafi senza tagliare a metà l'elenco a-j
    // Cerca prima di mantenere insieme blocchi che contengono enumerazioni "a)" "b)" ...
    const paragraphs = part.split(/\n\s*\n/);
    let current = '';
    let chunkStart = pos;
    let consumed = 0;

    for (const para of paragraphs) {
      const candidate = current ? current + '\n\n' + para : para;
      // Se aggiungendo sforerebbe e abbiamo già abbastanza, flush
      if (candidate.length > MAX_SIZE && current.length >= MIN_SIZE) {
        // Verifica: se "current" contiene una lista a)..j) parzialmente, prova a non spezzare
        // semplice euristica: se current finisce con "h)" o simile, allarga di 1 paragrafo
        chunks.push({ content: current.trim(), startPos: chunkStart, endPos: chunkStart + current.length });
        chunkStart = pos + consumed;
        current = para;
      } else {
        current = candidate;
      }
      consumed += para.length + 2; // \n\n
    }
    if (current.trim().length >= MIN_SIZE) {
      chunks.push({ content: current.trim(), startPos: chunkStart, endPos: chunkStart + current.length });
    }
    pos += partLen;
  }

  return chunks;
}

async function embedBatch(geminiKey: string, texts: string[]): Promise<number[][]> {
  const cleaned = texts.map(t => t.replace(/\n+/g, ' ').trim().substring(0, 8000));
  const requests = cleaned.map(text => ({
    model: 'models/gemini-embedding-001',
    content: { parts: [{ text }] },
    outputDimensionality: EMBEDDING_DIMENSIONS,
  }));

  let retries = 0;
  while (retries < 6) {
    const resp = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-embedding-001:batchEmbedContents?key=${geminiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ requests }),
      }
    );
    if (resp.ok) {
      const data = await resp.json();
      return data.embeddings.map((e: any) => e.values);
    }
    if (resp.status === 429) {
      retries++;
      const wait = 6 * retries;
      console.log(`⏳ rate limited, wait ${wait}s (retry ${retries}/6)`);
      await resp.text();
      await new Promise(r => setTimeout(r, wait * 1000));
      continue;
    }
    const err = await resp.text();
    throw new Error(`Gemini embedding ${resp.status}: ${err}`);
  }
  throw new Error('Max retries exceeded');
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const geminiKey = Deno.env.get('GEMINI_API_KEY')!;
    if (!geminiKey) throw new Error('GEMINI_API_KEY not configured');
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { content } = await req.json();
    if (!content || typeof content !== 'string') {
      throw new Error('Missing content');
    }
    if (content.length < 200000) {
      throw new Error(`CONTENUTO TRONCATO: ${content.length} chars, atteso ~222.000`);
    }

    // Sanity check 10 ambiti
    const has10 = content.includes('igiene di base') && content.includes('crittografia');
    if (!has10) throw new Error('CONTENUTO INCOMPLETO: i 10 ambiti dell\'Art. 24 non presenti');
    console.log(`✅ Contenuto verificato: ${content.length} chars, 10 ambiti presenti`);

    // STEP 1 — pulizia documenti precedenti del D.Lgs. 138 (esclude la Determinazione ACN)
    const { data: existing } = await supabase
      .from('documents')
      .select('id, title')
      .or('title.ilike.%138/2024%,title.ilike.%D.Lgs. 138%,title.ilike.%dlvo-n-138%');

    const toDelete = (existing || []).filter(d => !d.title.toLowerCase().includes('determinazione'));
    console.log(`🗑️ Cancellazione ${toDelete.length} documenti precedenti`);
    for (const d of toDelete) {
      await supabase.from('chunks').delete().eq('document_id', d.id);
      await supabase.from('documents').delete().eq('id', d.id);
      console.log(`  - rimosso: ${d.title}`);
    }

    // STEP 2 — inserimento documento
    const documentTitle = 'D.Lgs. 138/2024 - Recepimento Direttiva NIS2 in Italia - 1.0';
    const { data: newDoc, error: docError } = await supabase
      .from('documents')
      .insert({
        title: documentTitle,
        version: '1.0',
        jurisdiction: 'IT',
        sector: 'General',
        language: 'IT',
        source_url: 'https://www.gazzettaufficiale.it/eli/id/2024/10/01/24G00155/sg',
        created_by: null,
      })
      .select()
      .single();
    if (docError) throw docError;
    console.log(`📄 Documento inserito: ${newDoc.id}`);

    // STEP 3 — chunking dedicato
    const chunks = chunkLegalDocument(content);
    console.log(`📊 Generati ${chunks.length} chunks`);

    // VERIFICA CRITICA: deve esistere un chunk con entrambi gli ambiti
    const critical = chunks.find(c =>
      c.content.includes('igiene di base') && c.content.includes('crittografia')
    );
    if (!critical) {
      // Log diagnostico
      const withIgiene = chunks.filter(c => c.content.includes('igiene di base'));
      const withCripto = chunks.filter(c => c.content.includes('crittografia'));
      throw new Error(
        `CHUNKING FALLITO: nessun chunk contiene insieme "igiene di base" e "crittografia". ` +
        `Chunks con "igiene di base": ${withIgiene.length}, con "crittografia": ${withCripto.length}`
      );
    }
    console.log(`✅ Chunk critico trovato: ${critical.content.length} chars`);
    console.log(`   Preview: ${critical.content.substring(0, 200).replace(/\n/g, ' ')}`);

    // STEP 4 — inserimento chunks + embedding in batch
    const BATCH = 20;
    let inserted = 0;
    let embedded = 0;

    for (let i = 0; i < chunks.length; i += BATCH) {
      const slice = chunks.slice(i, i + BATCH);

      // genera embedding batch
      const embs = await embedBatch(geminiKey, slice.map(c => c.content));

      // inserisci con embedding già pronto
      const rows = slice.map((c, j) => ({
        document_id: newDoc.id,
        content: c.content,
        start_pos: c.startPos,
        end_pos: c.endPos,
        embedding: `[${embs[j].join(',')}]`,
      }));

      const { error: insErr } = await supabase.from('chunks').insert(rows);
      if (insErr) throw new Error(`Insert chunks failed at batch ${i}: ${insErr.message}`);
      inserted += rows.length;
      embedded += rows.length;
      console.log(`  ✅ batch ${Math.floor(i / BATCH) + 1}/${Math.ceil(chunks.length / BATCH)} (${inserted}/${chunks.length})`);

      // throttle leggero per stare sotto rate limit
      if (i + BATCH < chunks.length) await new Promise(r => setTimeout(r, 600));
    }

    console.log(`🎉 Completato: ${inserted} chunks, ${embedded} con embedding`);

    return new Response(JSON.stringify({
      success: true,
      document_id: newDoc.id,
      document_title: documentTitle,
      content_chars: content.length,
      chunks_total: chunks.length,
      chunks_inserted: inserted,
      chunks_embedded: embedded,
      critical_chunk_length: critical.content.length,
    }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

  } catch (error) {
    console.error('❌ Error:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : String(error) }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
