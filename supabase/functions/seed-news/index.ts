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
    // Validate request method
    if (req.method !== 'POST') {
      return new Response(
        JSON.stringify({ error: 'Method not allowed' }),
        { 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 405 
        }
      );
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Verify admin role
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 401 
        }
      );
    }

    const { data: authUser, error: authError } = await supabase.auth.getUser(
      authHeader.replace('Bearer ', '')
    );

    if (authError || !authUser?.user) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 401 
        }
      );
    }

    const { data: isAdmin, error: roleError } = await supabase.rpc('has_role', {
      _user_id: authUser.user.id,
      _role: 'admin'
    });

    if (roleError || !isAdmin) {
      return new Response(
        JSON.stringify({ error: 'Forbidden: Admin access required' }),
        { 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 403 
        }
      );
    }

    // Check if sample news already exists (idempotency)
    const { data: existing } = await supabase
      .from('news_updates')
      .select('id')
      .eq('source', 'EDPB')
      .eq('title', 'GDPR: Nuove Linee Guida EDPB sui Cookie Wall')
      .single();

    if (existing) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          message: 'Sample news already seeded',
          inserted: 0 
        }),
        { 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200 
        }
      );
    }

    // Dati di esempio per popolate il database
    const sampleNews = [
      {
        title: 'GDPR: Nuove Linee Guida EDPB sui Cookie Wall',
        summary: 'Il Comitato Europeo per la Protezione dei Dati (EDPB) ha pubblicato nuove linee guida che chiariscono quando i cookie wall sono considerati un consenso valido secondo il GDPR. Le linee guida stabiliscono criteri più restrittivi per l\'uso di questi meccanismi.',
        source: 'EDPB',
        source_url: 'https://edpb.europa.eu',
        published_at: '2025-10-10T00:00:00Z',
        regulation_type: 'GDPR',
        jurisdiction: 'EU',
        impact_level: 'high'
      },
      {
        title: 'NIS2: Implementazione degli Stati Membri',
        summary: 'Aggiornamenti sull\'implementazione della Direttiva NIS2 da parte degli Stati membri dell\'UE. Nuovi settori critici identificati e obblighi di notifica degli incidenti rafforzati per garantire una maggiore resilienza digitale.',
        source: 'Consiglio UE',
        source_url: 'https://eur-lex.europa.eu',
        published_at: '2025-09-15T00:00:00Z',
        regulation_type: 'NIS2',
        jurisdiction: 'EU',
        impact_level: 'high'
      },
      {
        title: 'AI Act: Linee Guida Tecniche per Sistemi ad Alto Rischio',
        summary: 'La Commissione Europea ha pubblicato linee guida dettagliate per la classificazione e la gestione dei sistemi AI ad alto rischio. Include requisiti specifici per la trasparenza, la governance dei dati e la sorveglianza umana.',
        source: 'Commissione Europea',
        source_url: 'https://eur-lex.europa.eu',
        published_at: '2025-08-20T00:00:00Z',
        regulation_type: 'AI Act',
        jurisdiction: 'EU',
        impact_level: 'high'
      },
      {
        title: 'DORA: Standard Tecnici per Testing ICT',
        summary: 'L\'EBA pubblica gli standard tecnici finali per i test di resilienza ICT nel settore finanziario. Include requisiti per penetration testing, vulnerability assessment e scenari di stress test digitali.',
        source: 'EBA',
        source_url: 'https://www.eba.europa.eu',
        published_at: '2025-07-05T00:00:00Z',
        regulation_type: 'DORA',
        jurisdiction: 'EU',
        impact_level: 'medium'
      },
      {
        title: 'CRA: Requisiti Essenziali per Prodotti Digitali',
        summary: 'Pubblicati i requisiti essenziali di cybersecurity per prodotti con elementi digitali. I fabbricanti devono garantire la sicurezza by design e la gestione delle vulnerabilità per tutto il ciclo di vita del prodotto.',
        source: 'Commissione Europea',
        source_url: 'https://ec.europa.eu',
        published_at: '2025-06-12T00:00:00Z',
        regulation_type: 'CRA',
        jurisdiction: 'EU',
        impact_level: 'medium'
      },
      {
        title: 'CER: Identificazione Entità Critiche Nazionali',
        summary: 'Gli Stati membri pubblicano i primi elenchi delle entità critiche identificate nei settori energia, trasporti, sanità e infrastrutture digitali. Nuovi obblighi di resilienza e reporting per gli operatori designati.',
        source: 'Parlamento Europeo',
        source_url: 'https://eur-lex.europa.eu',
        published_at: '2025-05-18T00:00:00Z',
        regulation_type: 'CER',
        jurisdiction: 'EU',
        impact_level: 'high'
      }
    ];

    // Inserisci le news nel database
    const { data, error } = await supabase
      .from('news_updates')
      .insert(sampleNews)
      .select();

    if (error) throw error;

    return new Response(
      JSON.stringify({ success: true, inserted: data?.length || 0, data }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200 
      }
    );
  } catch (err) {
    const error = err as Error;
    console.error('Error:', error);
    return new Response(
      JSON.stringify({ error: 'An error occurred while seeding news. Please try again.' }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500 
      }
    );
  }
});
