import { protect } from '../_shared/access.ts';
import { aiFetch as fetch, getAIKey, getAIModel } from '../_shared/ai.ts';
import { serve as denoServe } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'npm:@supabase/supabase-js@2.75.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Map document titles to regulation codes
function detectRegulation(docTitle: string, content: string): string {
  const title = docTitle.toLowerCase();
  const text = content.toLowerCase().substring(0, 2000);

  if (title.includes('gdpr') || title.includes('2016/679') || title.includes('protezione dei dati') || title.includes('regolamento generale')) return 'GDPR';
  if (title.includes('nis2') || title.includes('nis 2') || title.includes('2022/2555')) return 'NIS2';
  if (title.includes('dora') || title.includes('2022/2554') || title.includes('resilienza operativa digitale')) return 'DORA';
  if (title.includes('ai act') || title.includes('intelligenza artificiale') || title.includes('2024/1689')) return 'AI_ACT';
  if (title.includes('cyber resilience') || title.includes('cra') || title.includes('ciberresilienza')) return 'CRA';
  if (title.includes('data act') || title.includes('2023/2854')) return 'DATA_ACT';
  if (title.includes('codice cyber') || title.includes('cybersicurezza')) return 'CODICE_CYBER';
  if (title.includes('iso 27001') || title.includes('iso27001')) return 'ISO27001';
  if (title.includes('81/08') || title.includes('sicurezza lavoro') || title.includes('testo unico')) return 'DLGS_81_08';
  if (title.includes('albania') || title.includes('protezione dati personali') || title.includes('124/2024')) return 'ALBANIAN_DPL';
  if (title.includes('agid')) return 'AGID';

  // Fallback: check content
  if (text.includes('regolamento (ue) 2016/679') || text.includes('gdpr')) return 'GDPR';
  if (text.includes('direttiva (ue) 2022/2555') || text.includes('nis 2') || text.includes('nis2')) return 'NIS2';
  if (text.includes('regolamento (ue) 2022/2554') || text.includes('dora')) return 'DORA';
  if (text.includes('regolamento (ue) 2024/1689') || text.includes('ai act')) return 'AI_ACT';
  if (text.includes('cyber resilience act') || text.includes('ciberresilienza')) return 'CRA';

  return 'OTHER';
}

// Extract article references from chunk text
function extractArticleInfo(content: string): { reference: string | null; number: number | null; allRefs: string[] } {
  const allRefs: string[] = [];
  const articleRegex = /(?:articolo|art\.?|article)\s+(\d+(?:\.\d+)?)/gi;
  let match;
  let firstRef: string | null = null;
  let firstNum: number | null = null;

  while ((match = articleRegex.exec(content)) !== null) {
    const num = parseInt(match[1]);
    const ref = match[0].trim();
    allRefs.push(ref);
    if (!firstRef) {
      firstRef = ref;
      firstNum = num;
    }
  }

  return { reference: firstRef, number: firstNum, allRefs: [...new Set(allRefs)] };
}

// Extract section hierarchy (Capo, Titolo, Sezione)
function extractSectionHierarchy(content: string): string | null {
  const parts: string[] = [];
  const titoloMatch = content.match(/(?:TITOLO|Titolo)\s+([IVXLCDM]+(?:\s*[-–]\s*[^\n]+)?)/i);
  const capoMatch = content.match(/(?:CAPO|Capo)\s+([IVXLCDM]+(?:\s*[-–]\s*[^\n]+)?)/i);
  const sezioneMatch = content.match(/(?:SEZIONE|Sezione)\s+(\d+(?:\s*[-–]\s*[^\n]+)?)/i);

  if (titoloMatch) parts.push(`Titolo ${titoloMatch[1].trim().substring(0, 60)}`);
  if (capoMatch) parts.push(`Capo ${capoMatch[1].trim().substring(0, 60)}`);
  if (sezioneMatch) parts.push(`Sezione ${sezioneMatch[1].trim().substring(0, 60)}`);

  return parts.length > 0 ? parts.join(' > ') : null;
}

// Extract cross-references to other articles
function extractCrossReferences(content: string): string[] {
  const refs: string[] = [];
  const patterns = [
    /(?:di cui al|ai sensi del|conformemente al|previsto dal)(?:l')?(?:articolo|art\.?)\s+(\d+)/gi,
    /(?:see|referred to in)\s+(?:article|art\.?)\s+(\d+)/gi,
  ];
  for (const regex of patterns) {
    let m;
    while ((m = regex.exec(content)) !== null) {
      refs.push(`Art. ${m[1]}`);
    }
  }
  return [...new Set(refs)];
}

// Detect if chunk contains obligations
function isObligation(content: string): boolean {
  const lower = content.toLowerCase();
  const obligationPatterns = [
    /\b(?:deve|devono|è tenuto|sono tenuti|è obbligato|sono obbligati)\b/,
    /\b(?:shall|must|is required|are required|obliged)\b/,
    /\b(?:obbligo|obblighi|requisito|requisiti)\b/,
    /\b(?:assicura|garantisce|provvede|adotta)\b/,
  ];
  return obligationPatterns.some(p => p.test(lower));
}

// Generate embedding via Gemini
async function generateEmbedding(geminiKey: string, text: string): Promise<number[] | null> {
  try {
    const truncated = text.substring(0, 8000);
    const resp = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/text-embedding-004:embedContent?key=${geminiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: 'models/text-embedding-004',
          content: { parts: [{ text: truncated }] },
        }),
      }
    );
    if (!resp.ok) return null;
    const data = await resp.json();
    return data?.embedding?.values || null;
  } catch {
    return null;
  }
}

denoServe(protect(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const geminiKey = Deno.env.get('GEMINI_API_KEY') || '';
    const supabase = createClient(supabaseUrl, serviceKey);

    const { batchSize = 50, offset = 0, regenerateEmbeddings = false } = await req.json().catch(() => ({}));

    console.log(`Starting restructure-chunks: batchSize=${batchSize}, offset=${offset}`);

    // Get all documents for title-based regulation detection
    const { data: allDocs } = await supabase.from('documents').select('id, title');
    const docMap = new Map<string, string>();
    if (allDocs) allDocs.forEach((d: any) => docMap.set(d.id, d.title));

    // Fetch batch of chunks
    const { data: chunks, error: chunkError } = await supabase
      .from('chunks')
      .select('id, document_id, content, start_pos, end_pos, embedding')
      .order('document_id')
      .range(offset, offset + batchSize - 1);

    if (chunkError) throw chunkError;
    if (!chunks || chunks.length === 0) {
      return new Response(JSON.stringify({ message: 'No more chunks to process', processed: 0 }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log(`Processing ${chunks.length} chunks...`);

    let processed = 0;
    let skipped = 0;
    let embeddingsGenerated = 0;
    const errors: string[] = [];

    for (const chunk of chunks) {
      try {
        const docTitle = docMap.get(chunk.document_id) || '';
        const regulation = detectRegulation(docTitle, chunk.content);
        const articleInfo = extractArticleInfo(chunk.content);
        const hierarchy = extractSectionHierarchy(chunk.content);
        const crossRefs = extractCrossReferences(chunk.content);
        const obligation = isObligation(chunk.content);

        // Check if already exists
        const { data: existing } = await supabase
          .from('structured_chunks')
          .select('id')
          .eq('document_id', chunk.document_id)
          .eq('chunk_text', chunk.content.substring(0, 500))
          .limit(1);

        if (existing && existing.length > 0 && !regenerateEmbeddings) {
          skipped++;
          continue;
        }

        // Use existing embedding or generate new one
        let embeddingValue: string | null = null;
        if (chunk.embedding) {
          let embStr = typeof chunk.embedding === 'string' ? chunk.embedding : JSON.stringify(chunk.embedding);
          // Log first chunk embedding format for debugging
          if (processed === 0 && skipped === 0) {
            console.log(`Embedding type: ${typeof chunk.embedding}, starts: ${embStr.substring(0, 10)}, ends: ${embStr.substring(embStr.length - 10)}`);
          }
          // Remove any wrapping quotes and double brackets
          embStr = embStr.replace(/^"+|"+$/g, '');
          while (embStr.startsWith('[[') && embStr.endsWith(']]')) {
            embStr = embStr.slice(1, -1);
          }
          // Ensure it starts/ends with single brackets
          if (!embStr.startsWith('[')) embStr = '[' + embStr;
          if (!embStr.endsWith(']')) embStr = embStr + ']';
          embeddingValue = embStr;
        } else if (geminiKey) {
          const newEmb = await generateEmbedding(geminiKey, chunk.content);
          if (newEmb) {
            embeddingValue = `[${newEmb}]`;
            embeddingsGenerated++;
          }
          // Rate limit: ~90 RPM
          await new Promise(r => setTimeout(r, 700));
        }

        const structuredChunk = {
          document_id: chunk.document_id,
          regulation,
          article_reference: articleInfo.reference,
          article_number: articleInfo.number,
          section_hierarchy: hierarchy,
          chunk_text: chunk.content,
          embedding: embeddingValue,
          cross_references: crossRefs,
          is_obligation: obligation,
        };

        const { error: insertError } = await supabase
          .from('structured_chunks')
          .insert(structuredChunk);

        if (insertError) {
          errors.push(`Chunk ${chunk.id}: ${insertError.message}`);
        } else {
          processed++;
        }
      } catch (e) {
        errors.push(`Chunk ${chunk.id}: ${e instanceof Error ? e.message : 'Unknown error'}`);
      }
    }

    const hasMore = chunks.length === batchSize;
    const nextOffset = offset + batchSize;

    console.log(`Batch complete: processed=${processed}, skipped=${skipped}, embeddings=${embeddingsGenerated}, errors=${errors.length}`);

    return new Response(JSON.stringify({
      processed,
      skipped,
      embeddingsGenerated,
      errors: errors.slice(0, 10),
      hasMore,
      nextOffset,
      totalInBatch: chunks.length,
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Restructure error:', error);
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
}, true, false));
