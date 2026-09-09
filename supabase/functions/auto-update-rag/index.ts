import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Normative rilevanti per questo progetto
const RELEVANT_REGULATIONS = {
  'CRA': {
    keywords: ['cyber resilience act', 'cra', '2024/2847'],
    jurisdiction: 'EU',
    sector: 'Cybersecurity'
  },
  'GDPR': {
    keywords: ['general data protection regulation', 'gdpr', '2016/679'],
    jurisdiction: 'EU',
    sector: 'Data Protection'
  },
  'NIS2': {
    keywords: ['nis2', 'directive (eu) 2022/2555', 'network and information security'],
    jurisdiction: 'EU',
    sector: 'Cybersecurity'
  },
  'DORA': {
    keywords: ['dora', 'digital operational resilience', '2022/2554'],
    jurisdiction: 'EU',
    sector: 'Financial'
  },
  'AI Act': {
    keywords: ['artificial intelligence act', 'ai act', '2024/1689'],
    jurisdiction: 'EU',
    sector: 'Technology'
  },
  'CER': {
    keywords: ['critical entities resilience', 'cer', '2022/2557'],
    jurisdiction: 'EU',
    sector: 'Critical Infrastructure'
  },
  'D.Lgs 81/08': {
    keywords: ['testo unico sicurezza', 'd.lgs 81', 'decreto legislativo 81', 'sicurezza sul lavoro', 'salute e sicurezza nei luoghi di lavoro', '81/2008'],
    jurisdiction: 'IT',
    sector: 'Workplace Safety'
  }
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    console.log('🔍 Checking for regulatory updates...');

    // 1. Cerca nuove notizie normative non ancora processate
    const { data: newsUpdates, error: newsError } = await supabase
      .from('news_updates')
      .select('*')
      .gte('published_at', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()) // ultimi 30 giorni
      .order('published_at', { ascending: false });

    if (newsError) throw newsError;

    console.log(`📰 Found ${newsUpdates?.length || 0} recent news updates`);

    const updatesProcessed = [];

    // 2. Per ogni aggiornamento, verifica se è rilevante e se il documento è già nel RAG
    for (const news of newsUpdates || []) {
      const regulationType = news.regulation_type;
      const config = RELEVANT_REGULATIONS[regulationType as keyof typeof RELEVANT_REGULATIONS];

      if (!config) {
        console.log(`⏭️ Skipping ${news.title} - not a relevant regulation`);
        continue;
      }

      // Verifica se abbiamo già questo documento nel RAG
      const { data: existingDocs, error: docError } = await supabase
        .from('documents')
        .select('id, title, version, source_url')
        .eq('jurisdiction', config.jurisdiction)
        .eq('sector', config.sector);

      if (docError) {
        console.error('Error checking existing documents:', docError);
        continue;
      }

      // Verifica se questo specifico aggiornamento è già stato caricato
      const alreadyLoaded = existingDocs?.some(doc => 
        doc.source_url === news.source_url || 
        doc.title.toLowerCase().includes(news.title.toLowerCase().substring(0, 30))
      );

      if (alreadyLoaded) {
        console.log(`✅ Document already in RAG: ${news.title}`);
        continue;
      }

      console.log(`📥 New regulatory update found: ${news.title}`);

      // 3. Se è un documento EUR-Lex, scarica e processa
      if (news.source_url?.includes('eur-lex.europa.eu')) {
        try {
          console.log(`🌐 Fetching document from EUR-Lex: ${news.source_url}`);
          
          // Scarica il documento HTML da EUR-Lex
          const response = await fetch(news.source_url);
          const html = await response.text();
          
          // Estrai il testo dal HTML (rimozione tag HTML basilare)
          const text = html
            .replace(/<script[^>]*>.*?<\/script>/gi, '')
            .replace(/<style[^>]*>.*?<\/style>/gi, '')
            .replace(/<[^>]+>/g, ' ')
            .replace(/\s+/g, ' ')
            .trim();

          if (text.length < 500) {
            console.log('⚠️ Extracted text too short, skipping');
            continue;
          }

          // Crea il documento nel RAG
          const { data: newDoc, error: createError } = await supabase
            .from('documents')
            .insert({
              title: news.title,
              version: news.regulation_type,
              jurisdiction: config.jurisdiction,
              sector: config.sector,
              source_url: news.source_url,
              language: 'IT',
              created_by: '00000000-0000-0000-0000-000000000000' // System user
            })
            .select()
            .single();

          if (createError) {
            console.error('Error creating document:', createError);
            continue;
          }

          // Split in chunks
          const words = text.split(/\s+/);
          const chunkSize = 500;
          const chunks = [];

          for (let i = 0; i < words.length; i += chunkSize) {
            const chunkWords = words.slice(i, i + chunkSize);
            const content = chunkWords.join(' ');
            
            if (content.trim().length > 50) {
              const embedding = generateEmbedding(content);
              
              chunks.push({
                document_id: newDoc.id,
                content,
                start_pos: i,
                end_pos: i + chunkWords.length,
                embedding,
              });
            }
          }

          // Insert chunks in batches
          const batchSize = 100;
          for (let i = 0; i < chunks.length; i += batchSize) {
            const batch = chunks.slice(i, i + batchSize);
            await supabase.from('chunks').insert(batch);
          }

          console.log(`✅ Processed ${chunks.length} chunks for: ${news.title}`);
          updatesProcessed.push({
            title: news.title,
            chunks: chunks.length,
            regulation: regulationType
          });

        } catch (error) {
          console.error(`Error processing ${news.title}:`, error);
        }
      }
    }

    // 4. Verifica chunks del CRA
    const { data: craDoc } = await supabase
      .from('documents')
      .select('id')
      .ilike('title', '%cyber resilience%')
      .single();

    let craStatus = 'ok';
    if (craDoc) {
      const { count } = await supabase
        .from('chunks')
        .select('*', { count: 'exact', head: true })
        .eq('document_id', craDoc.id);
      
      if (!count || count < 50) {
        console.log(`📄 CRA has only ${count} chunks, needs more content`);
        craStatus = 'needs_update';
      }
    } else {
      craStatus = 'missing';
    }

    return new Response(
      JSON.stringify({ 
        success: true,
        updates_processed: updatesProcessed.length,
        details: updatesProcessed,
        cra_status: craStatus,
        message: updatesProcessed.length > 0 
          ? `Processed ${updatesProcessed.length} new regulatory documents` 
          : 'No new updates found'
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('Error in auto-update-rag:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});

function generateEmbedding(text: string): number[] {
  const embedding: number[] = [];
  const hash = simpleHash(text);
  
  for (let i = 0; i < 768; i++) {
    const seed = hash + i;
    embedding.push(Math.sin(seed) * 0.5);
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
  return hash;
}
