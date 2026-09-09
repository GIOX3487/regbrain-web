import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface DocumentUpload {
  title: string;
  content: string;
  version: string;
  jurisdiction: string;
  sector: string;
  language: string;
  source_url?: string;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { documents } = await req.json() as { documents: DocumentUpload[] };
    
    if (!documents || !Array.isArray(documents) || documents.length === 0) {
      throw new Error('No documents provided');
    }

    console.log(`Processing ${documents.length} documents...`);

    // Get authenticated user from JWT (handled by Supabase when verify_jwt = true)
    const authHeader = req.headers.get('Authorization');
    console.log('Auth header present:', !!authHeader);
    
    // Create a client with the user's JWT for RLS
    const supabaseClient = createClient(
      supabaseUrl,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      {
        global: {
          headers: {
            Authorization: authHeader!
          }
        }
      }
    );

    const { data: { user }, error: authError } = await supabaseClient.auth.getUser();
    
    if (authError || !user) {
      console.error('Auth error:', authError);
      throw new Error('Authentication required');
    }

    console.log('User authenticated:', user.id);

    const results = [];

    for (const doc of documents) {
      try {
        console.log(`Processing: ${doc.title}`);

        // Check if document already exists
        const { data: existing } = await supabase
          .from('documents')
          .select('id')
          .eq('title', doc.title)
          .eq('version', doc.version)
          .single();

        if (existing) {
          console.log(`Document already exists: ${doc.title}`);
          results.push({ 
            title: doc.title, 
            status: 'skipped', 
            reason: 'Already exists' 
          });
          continue;
        }

        // Insert document
        const { data: document, error: docError } = await supabase
          .from('documents')
          .insert({
            title: doc.title,
            version: doc.version,
            jurisdiction: doc.jurisdiction,
            sector: doc.sector,
            language: doc.language,
            source_url: doc.source_url,
            created_by: user.id,
          })
          .select()
          .single();

        if (docError) throw docError;

        console.log(`Document created: ${document.id}`);

        // Split content into chunks (max 1000 chars per chunk)
        const chunkSize = 1000;
        const chunks = [];
        
        for (let i = 0; i < doc.content.length; i += chunkSize) {
          const chunkContent = doc.content.slice(i, i + chunkSize);
          chunks.push({
            document_id: document.id,
            content: chunkContent,
            start_pos: i,
            end_pos: Math.min(i + chunkSize, doc.content.length),
            embedding: generateEmbedding(chunkContent)
          });
        }

        console.log(`Created ${chunks.length} chunks for ${doc.title}`);

        // Insert chunks in batches of 100
        const batchSize = 100;
        for (let i = 0; i < chunks.length; i += batchSize) {
          const batch = chunks.slice(i, i + batchSize);
          const { error: chunkError } = await supabase
            .from('chunks')
            .insert(batch);

          if (chunkError) {
            console.error('Error inserting chunk batch:', chunkError);
            throw chunkError;
          }
        }

        results.push({ 
          title: doc.title, 
          status: 'success',
          chunks: chunks.length 
        });

        console.log(`Completed: ${doc.title}`);

      } catch (error) {
        console.error(`Error processing ${doc.title}:`, error);
        results.push({ 
          title: doc.title, 
          status: 'error', 
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    }

    return new Response(
      JSON.stringify({ 
        message: `Processed ${results.length} documents`,
        results 
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Batch upload error:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});

// Generate deterministic embedding based on text content
function generateEmbedding(text: string): number[] {
  const embedding = new Array(768).fill(0);
  const hash = simpleHash(text);
  
  for (let i = 0; i < 768; i++) {
    embedding[i] = ((hash + i) % 1000) / 1000;
  }
  
  return embedding;
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
