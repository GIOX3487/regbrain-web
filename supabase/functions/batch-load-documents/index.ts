import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface DocumentToLoad {
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
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    // Authenticate the caller
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const authClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const token = authHeader.replace('Bearer ', '');
    const { data: claimsData, error: claimsError } = await authClient.auth.getClaims(token);
    if (claimsError || !claimsData?.claims) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const userId = claimsData.claims.sub;

    // Verify admin role
    const adminClient = createClient(supabaseUrl, supabaseServiceKey);
    const { data: isAdmin, error: roleError } = await adminClient.rpc('has_role', {
      _user_id: userId,
      _role: 'admin',
    });

    if (roleError || !isAdmin) {
      return new Response(JSON.stringify({ error: 'Admin access required' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { documents } = await req.json() as { documents: DocumentToLoad[] };

    if (!documents || !Array.isArray(documents) || documents.length === 0) {
      return new Response(JSON.stringify({ error: 'No documents provided' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (documents.length > 50) {
      return new Response(JSON.stringify({ error: 'Max 50 documents per batch' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log(`Processing ${documents.length} documents for admin ${userId}...`);

    const supabase = adminClient;
    const results = [];

    for (const doc of documents) {
      console.log(`Processing: ${doc.title}`);
      
      try {
        const { data: existingDocs } = await supabase
          .from('documents')
          .select('id')
          .eq('title', doc.title)
          .eq('version', doc.version);

        if (existingDocs && existingDocs.length > 0) {
          console.log(`Document already exists: ${doc.title}`);
          results.push({ title: doc.title, status: 'skipped', reason: 'already_exists' });
          continue;
        }

        const { data: insertedDoc, error: docError } = await supabase
          .from('documents')
          .insert({
            title: doc.title,
            version: doc.version,
            jurisdiction: doc.jurisdiction,
            sector: doc.sector,
            language: doc.language,
            source_url: doc.source_url || null
          })
          .select()
          .single();

        if (docError) throw docError;

        const CHUNK_SIZE = 1000;
        const chunks = [];
        for (let i = 0; i < doc.content.length; i += CHUNK_SIZE) {
          chunks.push(doc.content.slice(i, i + CHUNK_SIZE));
        }

        const chunksToInsert = chunks.map((content, index) => ({
          document_id: insertedDoc.id,
          content,
          start_pos: index * CHUNK_SIZE,
          end_pos: Math.min((index + 1) * CHUNK_SIZE, doc.content.length),
          embedding: generateEmbedding(content)
        }));

        for (let i = 0; i < chunksToInsert.length; i += 50) {
          const batch = chunksToInsert.slice(i, i + 50);
          const { error: chunkError } = await supabase
            .from('chunks')
            .insert(batch);
          if (chunkError) {
            console.error(`Error inserting chunk batch for ${doc.title}:`, chunkError);
          }
        }

        results.push({ title: doc.title, status: 'success', chunks: chunks.length });
        console.log(`Successfully loaded: ${doc.title}`);
        
      } catch (error) {
        console.error(`Error processing ${doc.title}:`, error);
        results.push({ title: doc.title, status: 'error', error: 'Processing failed' });
      }
    }

    return new Response(
      JSON.stringify({ success: true, message: `Processed ${results.length} documents`, results }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
    );

  } catch (error) {
    console.error('Error in batch-load-documents:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    );
  }
});

function generateEmbedding(text: string): string {
  const embedding = new Array(768).fill(0);
  const hash = simpleHash(text);
  for (let i = 0; i < 768; i++) {
    embedding[i] = Math.sin(hash + i) * 0.5 + 0.5;
  }
  return JSON.stringify(embedding);
}

function simpleHash(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return hash;
}
