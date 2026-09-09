import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface RegulationConfig {
  title: string;
  celex: string;
  version: string;
  jurisdiction: string;
  sector: string;
  language: string;
}

const REGULATIONS: RegulationConfig[] = [
  {
    title: "General Data Protection Regulation (GDPR)",
    celex: "32016R0679",
    version: "Regulation (EU) 2016/679",
    jurisdiction: "EU",
    sector: "data_protection",
    language: "IT"
  },
  {
    title: "Direttiva NIS 2",
    celex: "32022L2555",
    version: "Directive (EU) 2022/2555",
    jurisdiction: "EU",
    sector: "cybersecurity",
    language: "IT"
  },
  {
    title: "DORA - Digital Operational Resilience Act",
    celex: "32022R2554",
    version: "Regulation (EU) 2022/2554",
    jurisdiction: "EU",
    sector: "financial",
    language: "IT"
  },
  {
    title: "AI Act - Regolamento sull'Intelligenza Artificiale",
    celex: "32024R1689",
    version: "Regulation (EU) 2024/1689",
    jurisdiction: "EU",
    sector: "technology",
    language: "IT"
  },
  {
    title: "Cyber Resilience Act (CRA)",
    celex: "32024R2847",
    version: "Regulation (EU) 2024/2847",
    jurisdiction: "EU",
    sector: "cybersecurity",
    language: "IT"
  },
  {
    title: "Direttiva CER - Critical Entities Resilience",
    celex: "32022L2557",
    version: "Directive (EU) 2022/2557",
    jurisdiction: "EU",
    sector: "critical_infrastructure",
    language: "IT"
  }
];

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    console.log('Starting EUR-Lex monitoring for', REGULATIONS.length, 'regulations');

    const results = [];

    for (const regulation of REGULATIONS) {
      try {
        console.log(`Checking ${regulation.title} (${regulation.celex})`);
        
        // Costruisci URL EUR-Lex
        const eurLexUrl = `https://eur-lex.europa.eu/legal-content/IT/TXT/?uri=CELEX:${regulation.celex}`;
        
        // Fetch della pagina per verificare se ci sono aggiornamenti
        const response = await fetch(eurLexUrl, {
          headers: {
            'User-Agent': 'Mozilla/5.0 (compatible; RegBrain/1.0; +https://regbrain.com)'
          }
        });

        if (!response.ok) {
          console.error(`Failed to fetch ${regulation.celex}: ${response.status}`);
          results.push({
            regulation: regulation.title,
            status: 'error',
            message: `HTTP ${response.status}`
          });
          continue;
        }

        const html = await response.text();
        
        // Estrai la data di ultima modifica dalla pagina
        const dateMatch = html.match(/Data di pubblicazione|Data dell'ultima modifica|Data di entrata in vigore.*?(\d{2}\/\d{2}\/\d{4})/);
        const lastModified = dateMatch ? dateMatch[1] : null;

        // Verifica se il documento esiste già nel database
        const { data: existingDoc, error: checkError } = await supabase
          .from('documents')
          .select('id, updated_at, title, version')
          .eq('version', regulation.version)
          .eq('title', regulation.title)
          .maybeSingle();

        if (checkError) {
          console.error('Error checking existing document:', checkError);
        }

        let needsUpdate = false;
        let reason = '';

        if (!existingDoc) {
          needsUpdate = true;
          reason = 'Documento non presente nel database';
        } else if (lastModified) {
          reason = `Ultima modifica rilevata: ${lastModified}`;
          // Potremmo confrontare con existingDoc.updated_at per decidere se aggiornare
          // Per semplicità, segnaliamo solo che c'è una data di modifica
        }

        results.push({
          regulation: regulation.title,
          celex: regulation.celex,
          url: eurLexUrl,
          status: existingDoc ? 'existing' : 'missing',
          needsUpdate,
          reason,
          lastModified,
          existingDocId: existingDoc?.id
        });

      } catch (error) {
        console.error(`Error processing ${regulation.title}:`, error);
        results.push({
          regulation: regulation.title,
          status: 'error',
          message: error instanceof Error ? error.message : 'Unknown error'
        });
      }

      // Rate limiting: attendi 2 secondi tra una richiesta e l'altra
      await new Promise(resolve => setTimeout(resolve, 2000));
    }

    // Conta i documenti mancanti
    const missingDocs = results.filter(r => r.status === 'missing');
    const existingDocs = results.filter(r => r.status === 'existing');
    const errors = results.filter(r => r.status === 'error');

    console.log(`Monitoring complete: ${existingDocs.length} existing, ${missingDocs.length} missing, ${errors.length} errors`);

    return new Response(
      JSON.stringify({
        success: true,
        summary: {
          total: REGULATIONS.length,
          existing: existingDocs.length,
          missing: missingDocs.length,
          errors: errors.length
        },
        results,
        message: missingDocs.length > 0 
          ? `${missingDocs.length} normative mancanti nel database. Usa /admin/batch-upload per caricarle.`
          : 'Tutte le normative sono già presenti nel database.'
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );

  } catch (error) {
    console.error('Monitor EUR-Lex error:', error);
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
