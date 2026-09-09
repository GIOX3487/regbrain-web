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

    console.log('🚀 Loading Cyber Resilience Act from client-extracted text...');

    // Get content from request body (extracted by client from PDF)
    const { content } = await req.json();
    
    if (!content) {
      throw new Error('No content provided in request body');
    }
    
    console.log(`📄 Document received: ${content.length} characters (${Math.round(content.length / 1024)} KB)`);

    // 1. Remove existing CRA documents
    const { data: existingDocs } = await supabase
      .from('documents')
      .select('id')
      .or('title.ilike.%cyber resilience act%,title.ilike.%cra%');

    if (existingDocs && existingDocs.length > 0) {
      console.log(`🗑️ Removing ${existingDocs.length} existing CRA documents...`);
      
      for (const doc of existingDocs) {
        await supabase.from('chunks').delete().eq('document_id', doc.id);
        await supabase.from('documents').delete().eq('id', doc.id);
      }
      
      console.log('✅ Removed all existing CRA documents');
    }

    // 2. Create new document
    const { data: document, error: docError } = await supabase
      .from('documents')
      .insert({
        title: 'Cyber Resilience Act (CRA) - Regolamento UE 2024/2847',
        version: 'Reg. 2024/2847',
        jurisdiction: 'EU',
        sector: 'Cybersecurity',
        source_url: 'https://eur-lex.europa.eu/legal-content/IT/TXT/?uri=CELEX:32024R2847',
        language: 'IT',
        created_by: null
      })
      .select()
      .single();

    if (docError) throw docError;
    console.log('📄 Document created:', document.id);

    // 3. Generate chunks with overlap - larger chunks for better coverage
    const chunkSize = 3000;
    const overlap = 300;
    const chunks = [];
    
    let startPos = 0;
    while (startPos < content.length) {
      const endPos = Math.min(startPos + chunkSize, content.length);
      const chunkContent = content.substring(startPos, endPos).trim();
      
      if (chunkContent.length > 100) {
        const embedding = generateEmbedding(chunkContent);
        
        chunks.push({
          document_id: document.id,
          content: chunkContent,
          start_pos: startPos,
          end_pos: endPos,
          embedding,
        });
      }
      
      startPos += chunkSize - overlap;
    }

    console.log(`Generated ${chunks.length} chunks`);

    // 4. Insert chunks in batches
    const batchSize = 100;
    for (let i = 0; i < chunks.length; i += batchSize) {
      const batch = chunks.slice(i, i + batchSize);
      const { error: chunkError } = await supabase
        .from('chunks')
        .insert(batch);

      if (chunkError) throw chunkError;
      console.log(`Inserted batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(chunks.length / batchSize)}`);
    }

    console.log('✅ Cyber Resilience Act loaded successfully!');

    return new Response(
      JSON.stringify({
        success: true,
        document_id: document.id,
        chunks_created: chunks.length,
        total_chars: content.length,
        message: `CRA caricato: ${chunks.length} chunks da ${Math.round(content.length / 1024)}KB`
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error:', error);
    const errorMessage = error instanceof Error ? error.message : String(error);
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
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
