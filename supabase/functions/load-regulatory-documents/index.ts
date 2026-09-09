import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const EMBEDDING_DIMENSIONS = 768;

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { content, title, version, jurisdiction, sector, sourceUrl } = await req.json();
    
    if (!content || !title) {
      throw new Error('Missing required fields: content and title');
    }
    
    const contentSizeKB = Math.round(content.length / 1024);
    console.log(`📄 Starting load: ${title}`);
    console.log(`📊 Content size: ${content.length} chars (${contentSizeKB} KB)`);

    // 1. Remove existing documents with same title
    const { data: existingDocs } = await supabase
      .from('documents')
      .select('id')
      .ilike('title', `%${title}%`);

    if (existingDocs && existingDocs.length > 0) {
      console.log(`🗑️ Removing ${existingDocs.length} existing documents...`);
      for (const doc of existingDocs) {
        await supabase.from('chunks').delete().eq('document_id', doc.id);
        await supabase.from('documents').delete().eq('id', doc.id);
      }
      console.log('✅ Existing documents removed');
    }

    // 2. Create new document
    const documentTitle = `${title} - ${version}`;
    const { data: document, error: docError } = await supabase
      .from('documents')
      .insert({
        title: documentTitle,
        version: version || '1.0',
        jurisdiction: jurisdiction || 'EU',
        sector: sector || 'General',
        source_url: sourceUrl || null,
        language: 'IT',
        created_by: null
      })
      .select()
      .single();

    if (docError) throw docError;
    console.log(`📄 Document created: ${document.id} - ${documentTitle}`);

    // 3. Generate chunks
    const chunkSize = 2000;
    const overlap = 200;
    let startPos = 0;
    const batchTexts: string[] = [];
    const batchMeta: Array<{ start_pos: number; end_pos: number; content: string }> = [];
    
    while (startPos < content.length) {
      const endPos = Math.min(startPos + chunkSize, content.length);
      const chunkContent = content.substring(startPos, endPos).trim();
      if (chunkContent.length > 100) {
        batchTexts.push(chunkContent);
        batchMeta.push({ start_pos: startPos, end_pos: endPos, content: chunkContent });
      }
      startPos += chunkSize - overlap;
    }

    const totalChunks = batchTexts.length;
    console.log(`📊 Total chunks to embed: ${totalChunks}`);

    // 4. Generate embeddings with Gemini
    const geminiKey = Deno.env.get('GEMINI_API_KEY');
    const useRealEmbeddings = !!geminiKey;
    
    const allEmbeddings: string[] = [];

    if (useRealEmbeddings) {
      console.log('✅ Using Gemini gemini-embedding-001 for semantic embeddings');
      const gemBatchSize = 100;
      let geminiTemporarilyUnavailable = false;
      
      for (let i = 0; i < batchTexts.length; i += gemBatchSize) {
        const originalBatch = batchTexts.slice(i, i + gemBatchSize);
        const batch = originalBatch.map(t =>
          t.replace(/\n+/g, ' ').trim().substring(0, 8000)
        );

        if (geminiTemporarilyUnavailable) {
          for (const text of originalBatch) {
            allEmbeddings.push(generateFallbackEmbedding(text));
          }
          console.log(`⚠️ Batch ${Math.floor(i / gemBatchSize) + 1}/${Math.ceil(batchTexts.length / gemBatchSize)} embedded with fallback (Gemini rate limited)`);
          continue;
        }

        const requests = batch.map(text => ({
          model: 'models/gemini-embedding-001',
          content: { parts: [{ text }] },
          outputDimensionality: EMBEDDING_DIMENSIONS,
        }));

        let retries = 0;
        let success = false;
        while (retries < 5 && !success) {
          const embResponse = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/models/gemini-embedding-001:batchEmbedContents?key=${geminiKey}`,
            {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ requests }),
            }
          );

          if (embResponse.ok) {
            const embData = await embResponse.json();
            for (const emb of embData.embeddings) {
              allEmbeddings.push(`[${emb.values.join(',')}]`);
            }
            success = true;
          } else if (embResponse.status === 429) {
            retries++;
            const waitSec = 5 * retries;
            console.log(`⏳ Rate limited, waiting ${waitSec}s (retry ${retries}/5)...`);
            await embResponse.text();
            await new Promise(r => setTimeout(r, waitSec * 1000));
          } else {
            const errText = await embResponse.text();
            throw new Error(`Gemini embedding failed: ${embResponse.status} - ${errText}`);
          }
        }

        if (!success) {
          geminiTemporarilyUnavailable = true;
          for (const text of originalBatch) {
            allEmbeddings.push(generateFallbackEmbedding(text));
          }
          console.log(`⚠️ Gemini still rate limited after retries. Falling back for current and next batches.`);
        }
        
        console.log(`✅ Embedded batch ${Math.floor(i / gemBatchSize) + 1}/${Math.ceil(batchTexts.length / gemBatchSize)}`);
      }
    } else {
      console.log('⚠️ GEMINI_API_KEY not set, using fallback hash embeddings');
      for (const text of batchTexts) {
        allEmbeddings.push(generateFallbackEmbedding(text));
      }
    }

    // 5. Insert chunks
    const insertBatchSize = 250;
    for (let i = 0; i < batchMeta.length; i += insertBatchSize) {
      const insertBatch = batchMeta.slice(i, i + insertBatchSize).map((meta, j) => ({
        document_id: document.id,
        content: meta.content,
        start_pos: meta.start_pos,
        end_pos: meta.end_pos,
        embedding: allEmbeddings[i + j],
      }));

      const { error: chunkError } = await supabase.from('chunks').insert(insertBatch);
      if (chunkError) throw chunkError;
      console.log(`✅ Inserted ${Math.min(i + insertBatchSize, batchMeta.length)}/${batchMeta.length} chunks`);
    }

    console.log(`🎉 ${title} loaded! ${totalChunks} chunks (${useRealEmbeddings ? 'Gemini' : 'fallback'} embeddings)`);

    return new Response(
      JSON.stringify({
        success: true,
        document_id: document.id,
        document_title: documentTitle,
        chunks_created: totalChunks,
        content_size_kb: contentSizeKB,
        embedding_type: useRealEmbeddings ? 'gemini-text-embedding-004' : 'fallback-hash',
        message: `${title}: ${totalChunks} chunks created from ${contentSizeKB}KB`
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('❌ Error:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : String(error) }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

function generateFallbackEmbedding(text: string): string {
  const normalized = text.toLowerCase().replace(/[^\w\s]/g, '');
  let hash = 0;
  for (let i = 0; i < normalized.length; i++) {
    hash = ((hash << 5) - hash) + normalized.charCodeAt(i);
    hash = hash & hash;
  }
  hash = Math.abs(hash);
  const embedding = new Array(768).fill(0).map((_, i) => {
    return parseFloat((Math.sin(hash * (i + 1) * 0.01) * Math.cos(hash * (i + 1) * 0.02)).toFixed(6));
  });
  return JSON.stringify(embedding);
}
