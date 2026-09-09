import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

const EMBEDDING_DIMENSIONS = 768;

/**
 * Generate real semantic embeddings using Google Gemini text-embedding-004.
 * 
 * Modes:
 * 1. Single text: { text: "..." } → returns { embedding: [...] }
 * 2. Batch texts: { texts: ["...", "..."] } → returns { embeddings: [[...], [...]] }
 * 3. Reindex document: { reindex_document_id: "uuid" } → re-embeds all chunks of a document
 * 4. Reindex all: { reindex_all: true } → re-embeds ALL chunks in the database
 */
serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const geminiKey = Deno.env.get('GEMINI_API_KEY');
    if (!geminiKey) {
      throw new Error('GEMINI_API_KEY not configured');
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const body = await req.json();
    const { text, texts, reindex_document_id, reindex_all } = body;

    if (text && typeof text === 'string') {
      const embedding = await generateEmbedding(geminiKey, text);
      return jsonResponse({ embedding });
    }

    if (texts && Array.isArray(texts)) {
      const embeddings = await generateBatchEmbeddings(geminiKey, texts);
      return jsonResponse({ embeddings });
    }

    if (reindex_document_id) {
      const result = await reindexDocument(supabase, geminiKey, reindex_document_id);
      return jsonResponse(result);
    }

    if (reindex_all === true) {
      const result = await reindexAll(supabase, geminiKey);
      return jsonResponse(result);
    }

    return new Response(
      JSON.stringify({ error: 'Provide text, texts[], reindex_document_id, or reindex_all' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Embedding error:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : String(error) }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

// ── Core embedding generation using Gemini ─────────────────────────────

async function generateEmbedding(apiKey: string, text: string): Promise<number[]> {
  const cleaned = text.replace(/\n+/g, ' ').trim().substring(0, 8000);
  
  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-embedding-001:embedContent?key=${apiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'models/gemini-embedding-001',
        content: { parts: [{ text: cleaned }] },
        outputDimensionality: EMBEDDING_DIMENSIONS,
      }),
    }
  );

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`Gemini Embedding API error ${response.status}: ${err}`);
  }

  const data = await response.json();
  return data.embedding.values;
}

async function generateBatchEmbeddings(apiKey: string, texts: string[]): Promise<number[][]> {
  const cleaned = texts.map(t => t.replace(/\n+/g, ' ').trim().substring(0, 8000));
  const batchSize = 20; // Small batches to stay well under rate limits
  const allEmbeddings: number[][] = [];

  for (let i = 0; i < cleaned.length; i += batchSize) {
    const batch = cleaned.slice(i, i + batchSize);
    
    const requests = batch.map(text => ({
      model: 'models/gemini-embedding-001',
      content: { parts: [{ text }] },
      outputDimensionality: EMBEDDING_DIMENSIONS,
    }));

    let retries = 0;
    let success = false;
    while (retries < 5 && !success) {
      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-embedding-001:batchEmbedContents?key=${apiKey}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ requests }),
        }
      );

      if (response.ok) {
        const data = await response.json();
        for (const emb of data.embeddings) {
          allEmbeddings.push(emb.values);
        }
        console.log(`Batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(cleaned.length / batchSize)}: embedded ${batch.length} texts`);
        success = true;
      } else if (response.status === 429) {
        retries++;
        const waitSec = 8 * retries;
        console.log(`⏳ Rate limited, waiting ${waitSec}s (retry ${retries}/5)...`);
        await response.text();
        await new Promise(r => setTimeout(r, waitSec * 1000));
      } else {
        const err = await response.text();
        throw new Error(`Gemini Batch Embedding API error ${response.status}: ${err}`);
      }
    }
    if (!success) throw new Error('Max retries exceeded for batch embedding');
    
    // Delay between batches to respect rate limits (free tier: 100 req/min)
    if (i + batchSize < cleaned.length) {
      await new Promise(r => setTimeout(r, 800));
    }
  }

  return allEmbeddings;
}

// ── Reindexing functions ───────────────────────────────────────────────

async function reindexDocument(supabase: any, apiKey: string, documentId: string, maxChunks?: number) {
  console.log(`🔄 Reindexing document: ${documentId}`);
  
  // Paginate to get all chunks (default limit is 1000)
  const allChunks: any[] = [];
  const pageSize = 1000;
  let from = 0;
  while (true) {
    const { data: page, error } = await supabase
      .from('chunks')
      .select('id, content')
      .eq('document_id', documentId)
      .order('start_pos', { ascending: true })
      .range(from, from + pageSize - 1);
    
    if (error) throw error;
    if (!page || page.length === 0) break;
    allChunks.push(...page);
    if (page.length < pageSize) break;
    from += pageSize;
  }

  if (allChunks.length === 0) {
    return { success: true, message: 'No chunks found', chunks_updated: 0 };
  }

  // Optionally limit chunks to process (for large docs within time constraints)
  const chunks = maxChunks ? allChunks.slice(0, maxChunks) : allChunks;
  console.log(`📊 Found ${allChunks.length} chunks, processing ${chunks.length}`);

  const texts = chunks.map((c: any) => c.content);
  const embeddings = await generateBatchEmbeddings(apiKey, texts);

  let updated = 0;
  for (let i = 0; i < chunks.length; i++) {
    const embeddingStr = `[${embeddings[i].join(',')}]`;
    const { error: updateError } = await supabase
      .from('chunks')
      .update({ embedding: embeddingStr })
      .eq('id', chunks[i].id);

    if (!updateError) updated++;
    
    if ((i + 1) % 100 === 0) {
      console.log(`✅ Updated ${updated}/${chunks.length} chunks`);
    }
  }

  console.log(`🎉 Document reindexed: ${updated}/${chunks.length} chunks (total: ${allChunks.length})`);
  return { success: true, document_id: documentId, chunks_updated: updated, total_chunks: allChunks.length };
}

async function reindexAll(supabase: any, apiKey: string) {
  console.log('🔄 Starting full reindex with Gemini text-embedding-004...');

  const { data: documents, error: docError } = await supabase
    .from('documents')
    .select('id, title')
    .order('created_at', { ascending: true });

  if (docError) throw docError;
  if (!documents || documents.length === 0) {
    return { success: true, message: 'No documents found', documents_processed: 0 };
  }

  console.log(`📚 Found ${documents.length} documents to reindex`);

  let totalChunksUpdated = 0;
  const results: any[] = [];

  for (const doc of documents) {
    try {
      console.log(`\n📄 Processing: ${doc.title}`);
      const result = await reindexDocument(supabase, apiKey, doc.id);
      totalChunksUpdated += result.chunks_updated;
      results.push({ document_id: doc.id, title: doc.title, ...result });
    } catch (e) {
      console.error(`❌ Error reindexing ${doc.title}:`, e);
      results.push({ document_id: doc.id, title: doc.title, error: String(e) });
    }
  }

  console.log(`\n🎉 Full reindex complete: ${totalChunksUpdated} chunks updated across ${documents.length} documents`);
  return {
    success: true,
    documents_processed: documents.length,
    total_chunks_updated: totalChunksUpdated,
    details: results,
  };
}

function jsonResponse(data: any) {
  return new Response(JSON.stringify(data), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}
