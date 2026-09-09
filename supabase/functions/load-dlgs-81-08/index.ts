import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    console.log('🚀 Starting D.Lgs 81/08 full text load from Storage...');

    // Download the full TXT file from Supabase Storage
    const { data: fileData, error: downloadError } = await supabase.storage
      .from('regulatory-documents')
      .download('dlgs-81-08-testo-unico-sicurezza-lavoro.txt');

    if (downloadError || !fileData) {
      throw new Error(`Failed to download from storage: ${downloadError?.message || 'No data'}`);
    }

    const textContent = await fileData.text();
    console.log(`📄 TXT loaded from storage: ${textContent.length} characters (${Math.round(textContent.length / 1024)} KB)`);

    const title = 'D.Lgs 81/08 - Testo Unico Sicurezza Lavoro';
    const version = 'D.Lgs. 81/2008 - Ed. Gennaio 2025';
    const contentSizeKB = Math.round(textContent.length / 1024);

    // Remove existing documents
    const { data: existingDocs } = await supabase
      .from('documents')
      .select('id')
      .or('title.ilike.%81/08%,title.ilike.%81-08%,title.ilike.%Sicurezza Lavoro%,title.ilike.%Testo Unico%');

    if (existingDocs && existingDocs.length > 0) {
      console.log(`🗑️ Removing ${existingDocs.length} existing D.Lgs 81/08 documents...`);
      for (const doc of existingDocs) {
        await supabase.from('chunks').delete().eq('document_id', doc.id);
        await supabase.from('documents').delete().eq('id', doc.id);
      }
    }

    // Create document
    const { data: document, error: docError } = await supabase
      .from('documents')
      .insert({
        title: `${title} - ${version}`,
        version,
        jurisdiction: 'IT',
        sector: 'Workplace Safety',
        source_url: 'https://www.normattiva.it/uri-res/N2Ls?urn:nir:stato:decreto.legislativo:2008-04-09;81',
        language: 'IT',
        created_by: null
      })
      .select()
      .single();

    if (docError) throw docError;
    console.log(`📄 Document created: ${document.id}`);

    // Chunk and insert
    const chunkSize = 2000;
    const overlap = 200;
    const batchSize = 250;
    
    let startPos = 0;
    let totalChunks = 0;
    let batchChunks: any[] = [];
    
    while (startPos < textContent.length) {
      const endPos = Math.min(startPos + chunkSize, textContent.length);
      const chunkContent = textContent.substring(startPos, endPos).trim();
      
      if (chunkContent.length > 100) {
        batchChunks.push({
          document_id: document.id,
          content: chunkContent,
          start_pos: startPos,
          end_pos: endPos,
          embedding: generateEmbedding(chunkContent),
        });
        totalChunks++;
        
        if (batchChunks.length >= batchSize) {
          const { error } = await supabase.from('chunks').insert(batchChunks);
          if (error) throw error;
          console.log(`✅ Inserted ${totalChunks} chunks...`);
          batchChunks = [];
        }
      }
      startPos += chunkSize - overlap;
    }

    if (batchChunks.length > 0) {
      const { error } = await supabase.from('chunks').insert(batchChunks);
      if (error) throw error;
    }

    console.log(`🎉 D.Lgs 81/08 loaded: ${totalChunks} chunks from ${contentSizeKB}KB (780 pagine)`);

    return new Response(
      JSON.stringify({
        success: true,
        document_id: document.id,
        chunks_created: totalChunks,
        content_size_kb: contentSizeKB,
        message: `D.Lgs 81/08 Ed. Gennaio 2025: ${totalChunks} chunks creati da ${contentSizeKB}KB (780 pagine)`
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

function generateEmbedding(text: string): string {
  const normalized = text.toLowerCase().replace(/[^\w\s]/g, '');
  const hash = simpleHash(normalized);
  const embedding = new Array(768).fill(0).map((_, i) => {
    const val = Math.sin(hash * (i + 1) * 0.01) * Math.cos(hash * (i + 1) * 0.02);
    return parseFloat(val.toFixed(6));
  });
  return JSON.stringify(embedding);
}

function simpleHash(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return Math.abs(hash);
}
