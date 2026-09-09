import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface NewsItem {
  title: string;
  summary: string;
  source: string;
  source_url: string;
  regulation_type: string;
  jurisdiction: string;
  published_at: string;
  impact_level: 'low' | 'medium' | 'high';
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const perplexityApiKey = Deno.env.get('PERPLEXITY_API_KEY');
    const supabase = createClient(supabaseUrl, supabaseKey);

    console.log('Avvio scraping notizie automatico con Perplexity AI...');
    console.log('API Key presente:', !!perplexityApiKey);

    if (!perplexityApiKey) {
      throw new Error('PERPLEXITY_API_KEY non configurata');
    }

    // Calcola date per filtro (ultimi 3 mesi per avere più risultati)
    const today = new Date();
    const threeMonthsAgo = new Date(today);
    threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);
    
    const todayStr = today.toISOString().split('T')[0];
    const threeMonthsAgoStr = threeMonthsAgo.toISOString().split('T')[0];
    const currentYear = today.getFullYear();
    
    console.log(`Filtro date: da ${threeMonthsAgoStr} a ${todayStr}`);

    // Funzione per validare e normalizzare le date
    function validateAndNormalizeDate(dateStr: string, todayDate: Date): string | null {
      try {
        // Parse la data
        const parsedDate = new Date(dateStr);
        
        // Verifica che sia una data valida
        if (isNaN(parsedDate.getTime())) {
          console.log(`Data invalida: ${dateStr}`);
          return null;
        }
        
        // NON permettere date future (massimo oggi)
        if (parsedDate > todayDate) {
          console.log(`Data futura non permessa: ${dateStr}, usando oggi`);
          return todayDate.toISOString().split('T')[0];
        }
        
        // NON permettere date troppo vecchie (massimo 1 anno fa)
        const oneYearAgo = new Date(todayDate);
        oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);
        if (parsedDate < oneYearAgo) {
          console.log(`Data troppo vecchia: ${dateStr}`);
          return null;
        }
        
        return parsedDate.toISOString().split('T')[0];
      } catch (e) {
        console.log(`Errore parsing data: ${dateStr}`);
        return null;
      }
    }

    // Funzione per estrarre data da testo (formati comuni)
    function extractDateFromText(text: string, todayDate: Date): string | null {
      if (!text) return null;
      
      // Pattern comuni per date in italiano e inglese
      const patterns = [
        // ISO format: 2025-01-15
        /(\d{4})-(\d{2})-(\d{2})/,
        // European: 15/01/2025, 15-01-2025
        /(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})/,
        // Italian: 15 gennaio 2025
        /(\d{1,2})\s+(gennaio|febbraio|marzo|aprile|maggio|giugno|luglio|agosto|settembre|ottobre|novembre|dicembre)\s+(\d{4})/i,
        // English: January 15, 2025 or 15 January 2025
        /(\d{1,2})\s+(January|February|March|April|May|June|July|August|September|October|November|December)\s+(\d{4})/i,
        /(January|February|March|April|May|June|July|August|September|October|November|December)\s+(\d{1,2}),?\s+(\d{4})/i,
      ];
      
      const italianMonths: Record<string, number> = {
        'gennaio': 0, 'febbraio': 1, 'marzo': 2, 'aprile': 3, 'maggio': 4, 'giugno': 5,
        'luglio': 6, 'agosto': 7, 'settembre': 8, 'ottobre': 9, 'novembre': 10, 'dicembre': 11
      };
      
      const englishMonths: Record<string, number> = {
        'january': 0, 'february': 1, 'march': 2, 'april': 3, 'may': 4, 'june': 5,
        'july': 6, 'august': 7, 'september': 8, 'october': 9, 'november': 10, 'december': 11
      };
      
      for (const pattern of patterns) {
        const match = text.match(pattern);
        if (match) {
          let date: Date | null = null;
          
          if (pattern.source.includes('\\d{4})-')) {
            // ISO format
            date = new Date(parseInt(match[1]), parseInt(match[2]) - 1, parseInt(match[3]));
          } else if (pattern.source.includes('[\\/-]')) {
            // European format DD/MM/YYYY
            date = new Date(parseInt(match[3]), parseInt(match[2]) - 1, parseInt(match[1]));
          } else if (pattern.source.includes('gennaio')) {
            // Italian month names
            const month = italianMonths[match[2].toLowerCase()];
            if (month !== undefined) {
              date = new Date(parseInt(match[3]), month, parseInt(match[1]));
            }
          } else if (pattern.source.includes('January') && match[1].match(/\d/)) {
            // English: 15 January 2025
            const month = englishMonths[match[2].toLowerCase()];
            if (month !== undefined) {
              date = new Date(parseInt(match[3]), month, parseInt(match[1]));
            }
          } else if (pattern.source.includes('January')) {
            // English: January 15, 2025
            const month = englishMonths[match[1].toLowerCase()];
            if (month !== undefined) {
              date = new Date(parseInt(match[3]), month, parseInt(match[2]));
            }
          }
          
          if (date && !isNaN(date.getTime())) {
            // Valida che non sia nel futuro e non troppo vecchia
            if (date <= todayDate) {
              const oneYearAgo = new Date(todayDate);
              oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);
              if (date >= oneYearAgo) {
                return date.toISOString().split('T')[0];
              }
            }
          }
        }
      }
      return null;
    }

    // Funzione per query Perplexity AI - restituisce notizie in ITALIANO con date VERIFICATE dalle citazioni
    async function queryPerplexity(query: string, sourceName: string): Promise<NewsItem[]> {
      console.log(`Query Perplexity per ${sourceName}...`);
      
      const response = await fetch('https://api.perplexity.ai/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${perplexityApiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          model: 'sonar-pro',
          messages: [
            {
              role: 'system',
              content: `Sei un esperto giornalista specializzato in normative europee di cybersecurity e privacy. La data di OGGI è ${todayStr}.

REGOLE CRITICHE - LEGGI ATTENTAMENTE:

1. ESTRAI SOLO NOTIZIE CON DATA VISIBILE NELLE CITAZIONI
   - La data published_at DEVE provenire DIRETTAMENTE dalla citazione/snippet fornito da Perplexity
   - Se la citazione mostra "Published: Dec 17, 2024" → usa "2024-12-17"
   - Se la citazione mostra "17 dicembre 2024" → usa "2024-12-17"
   - NON INVENTARE DATE! Se non vedi una data chiara nella citazione, SALTA quella notizia

2. USA LE DATE DALLE CITAZIONI PERPLEXITY
   - Perplexity ti fornisce citazioni con date reali
   - Usa QUELLE date, non stimare o inventare
   - Preferisci notizie dove la data è chiaramente visibile

3. SE NON TROVI LA DATA ESATTA
   - NON includere la notizia
   - È meglio avere meno notizie con date corrette che molte con date sbagliate

4. FORMATO RISPOSTA (solo JSON, niente altro):
[
  {
    "title": "Titolo in italiano",
    "summary": "Riassunto di 2-3 frasi in italiano",
    "source": "Nome Fonte",
    "source_url": "https://url.dalla.citazione",
    "regulation_type": "NIS2|GDPR|AI_Act|DORA|CRA",
    "jurisdiction": "EU|IT",
    "published_at": "YYYY-MM-DD (SOLO SE VISIBILE NELLA CITAZIONE)",
    "impact_level": "high",
    "date_source": "citazione" 
  }
]

IMPORTANTE: Restituisci MASSIMO 3 notizie, solo quelle con date VERIFICABILI dalle citazioni.`
            },
            {
              role: 'user',
              content: query
            }
          ],
          temperature: 0.1,
          search_recency_filter: 'month',
          return_citations: true
        })
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error(`Errore Perplexity API per ${sourceName}:`, response.status, errorText);
        return [];
      }

      const result = await response.json();
      const content = result.choices?.[0]?.message?.content || '';
      const citations = result.citations || [];
      
      console.log(`${sourceName} - Citations: ${citations.length}, Content length: ${content.length}`);
      console.log(`${sourceName} - Citations raw:`, JSON.stringify(citations).substring(0, 500));
      
      // Estrai JSON dalla risposta
      try {
        let jsonStr = content;
        
        // Rimuovi markdown code blocks se presenti
        const jsonMatch = content.match(/```(?:json)?\s*([\s\S]*?)```/);
        if (jsonMatch) {
          jsonStr = jsonMatch[1].trim();
        } else {
          // Cerca array JSON diretto
          const arrayMatch = content.match(/\[[\s\S]*?\]/);
          if (arrayMatch) {
            jsonStr = arrayMatch[0];
          }
        }
        
        const parsed = JSON.parse(jsonStr);
        if (Array.isArray(parsed) && parsed.length > 0) {
          const validNews: NewsItem[] = [];
          
          for (let index = 0; index < parsed.length; index++) {
            const item = parsed[index];
            
            // Prova a estrarre la data dalla citazione corrispondente se disponibile
            let extractedDate: string | null = null;
            if (citations[index]) {
              // Cerca la data nel testo della citazione
              const citationText = typeof citations[index] === 'string' 
                ? citations[index] 
                : JSON.stringify(citations[index]);
              extractedDate = extractDateFromText(citationText, today);
              if (extractedDate) {
                console.log(`${sourceName} - Data estratta dalla citazione: ${extractedDate}`);
              }
            }
            
            // Usa la data estratta dalla citazione, altrimenti quella fornita da Perplexity
            const rawDate = extractedDate || item.published_at || item.data_pubblicazione;
            const validatedDate = validateAndNormalizeDate(rawDate, today);
            
            // Salta notizie con date non valide
            if (!validatedDate) {
              console.log(`${sourceName} - Notizia scartata per data non valida: ${item.title} (data raw: ${rawDate})`);
              continue;
            }
            
            // Verifica che l'URL non sia un placeholder
            const sourceUrl = item.source_url || item.url || citations[index];
            if (!sourceUrl || sourceUrl === '#' || !sourceUrl.startsWith('http')) {
              console.log(`${sourceName} - Notizia scartata per URL non valido: ${item.title}`);
              continue;
            }
            
            validNews.push({
              title: item.title || item.titolo || `Aggiornamento ${sourceName}`,
              summary: item.summary || item.sommario || item.descrizione || 'Aggiornamento normativo recente',
              source: item.source || item.fonte || sourceName,
              source_url: sourceUrl,
              regulation_type: item.regulation_type || item.tipo_normativa || 'NIS2',
              jurisdiction: item.jurisdiction || item.giurisdizione || 'EU',
              published_at: validatedDate,
              impact_level: item.impact_level || item.livello_impatto || 'high'
            });
          }
          
          console.log(`${sourceName}: ${validNews.length} notizie valide estratte (${parsed.length - validNews.length} scartate)`);
          return validNews;
        }
      } catch (parseError) {
        console.error(`Errore parsing JSON per ${sourceName}:`, parseError);
        console.log(`Content raw: ${content.substring(0, 500)}`);
      }
      
      return [];
    }

    // Query più ampie e flessibili per ogni fonte - richiedono date verificabili
    const queries = [
      {
        query: `Trova le 3 notizie più recenti su ENISA, NIS2 Directive e cybersecurity europea.
        CRITICO: Includi SOLO notizie dove la DATA DI PUBBLICAZIONE è chiaramente visibile nella citazione.
        Cerca su: enisa.europa.eu, siti di news tech europei, comunicati stampa EU.
        Temi: implementazione NIS2, threat reports ENISA, cybersecurity framework europei.
        Per ogni notizia, indica la DATA ESATTA che vedi nella citazione.
        Restituisci SOLO l'array JSON come specificato.`,
        source: 'ENISA'
      },
      {
        query: `Trova le 3 decisioni o linee guida GDPR più recenti dall'EDPB o autorità privacy europee.
        CRITICO: Includi SOLO notizie dove la DATA DI PUBBLICAZIONE è chiaramente visibile nella citazione.
        Cerca su: edpb.europa.eu, siti autorità garanti privacy EU.
        Temi: trasferimenti dati internazionali, sanzioni GDPR, linee guida privacy.
        Per ogni notizia, indica la DATA ESATTA che vedi nella citazione.
        Restituisci SOLO l'array JSON come specificato.`,
        source: 'EDPB'
      },
      {
        query: `Trova le 3 notizie più recenti su ACN (Agenzia per la Cybersicurezza Nazionale) Italia e cybersecurity italiana.
        CRITICO: Includi SOLO notizie dove la DATA DI PUBBLICAZIONE è chiaramente visibile nella citazione.
        Cerca su: acn.gov.it, siti news italiani, comunicati governo italiano.
        Temi: implementazione NIS2 in Italia, PSNC, incidenti cyber italiani.
        Per ogni notizia, indica la DATA ESATTA che vedi nella citazione.
        Restituisci SOLO l'array JSON come specificato.`,
        source: 'ACN'
      },
      {
        query: `Trova i 3 provvedimenti o sanzioni GDPR più recenti dal Garante Privacy italiano.
        CRITICO: Includi SOLO notizie dove la DATA DI PUBBLICAZIONE è chiaramente visibile nella citazione.
        Cerca su: garanteprivacy.it, siti legali italiani, news privacy Italia.
        Temi: sanzioni, provvedimenti, newsletter Garante, data breach.
        Per ogni notizia, indica la DATA ESATTA che vedi nella citazione.
        Restituisci SOLO l'array JSON come specificato.`,
        source: 'Garante Privacy'
      },
      {
        query: `Trova le 3 notizie più recenti su AI Act, DORA o Cyber Resilience Act europei.
        CRITICO: Includi SOLO notizie dove la DATA DI PUBBLICAZIONE è chiaramente visibile nella citazione.
        Cerca su: eur-lex.europa.eu, siti EU, news regolamentazione digitale.
        Temi: entrata in vigore regolamenti, obblighi aziende, scadenze compliance.
        Per ogni notizia, indica la DATA ESATTA che vedi nella citazione.
        Restituisci SOLO l'array JSON come specificato.`,
        source: 'EUR-Lex'
      },
      {
        query: `Trova le 3 notizie più importanti su compliance normativa digitale in Europa.
        CRITICO: Includi SOLO notizie dove la DATA DI PUBBLICAZIONE è chiaramente visibile nella citazione.
        Cerca su: siti specializzati compliance, news cybersecurity Europa.
        Temi: NIS2 implementation, GDPR enforcement, AI Act updates, DORA deadlines.
        Per ogni notizia, indica la DATA ESATTA che vedi nella citazione.
        Restituisci SOLO l'array JSON come specificato.`,
        source: 'EU Digital Regulation'
      }
    ];

    const allNews: NewsItem[] = [];

    // Esegui le query in parallelo
    console.log('Avvio query parallele a Perplexity...');
    const results = await Promise.allSettled(
      queries.map(q => queryPerplexity(q.query, q.source))
    );

    // Raccogli tutti i risultati
    for (let i = 0; i < results.length; i++) {
      const result = results[i];
      if (result.status === 'fulfilled' && Array.isArray(result.value)) {
        console.log(`${queries[i].source}: ${result.value.length} notizie`);
        allNews.push(...result.value);
      } else if (result.status === 'rejected') {
        console.error(`Errore per ${queries[i].source}:`, result.reason);
      }
    }

    console.log(`Totale notizie raccolte: ${allNews.length}`);

    // Se non abbiamo abbastanza notizie, non eliminare le vecchie
    if (allNews.length < 5) {
      console.log('Poche notizie trovate, mantengo le esistenti e aggiungo le nuove');
      
      if (allNews.length > 0) {
        // Inserisci solo le nuove senza eliminare le vecchie
        const { data: insertedData, error: insertError } = await supabase
          .from('news_updates')
          .upsert(allNews, { onConflict: 'title' })
          .select();

        if (insertError) {
          console.error('Errore inserimento notizie:', insertError);
        } else {
          console.log(`Aggiunte ${insertedData?.length || 0} nuove notizie`);
        }
      }

      // Conta le notizie esistenti
      const { count } = await supabase
        .from('news_updates')
        .select('*', { count: 'exact', head: true });

      return new Response(
        JSON.stringify({ 
          success: true,
          message: `Aggiornamento parziale: ${allNews.length} nuove notizie trovate, ${count || 0} totali nel database`,
          total_found: allNews.length,
          inserted: allNews.length,
          total_in_db: count || 0
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Se abbiamo abbastanza notizie, elimina le vecchie e inserisci le nuove
    console.log('Abbastanza notizie trovate, aggiorno il database...');
    
    const { error: deleteError } = await supabase
      .from('news_updates')
      .delete()
      .neq('id', '00000000-0000-0000-0000-000000000000');
    
    if (deleteError) {
      console.error('Errore eliminazione vecchie notizie:', deleteError);
    } else {
      console.log('Eliminate le vecchie notizie');
    }

    // Inserisci le nuove notizie
    const { data: insertedData, error: insertError } = await supabase
      .from('news_updates')
      .insert(allNews)
      .select();

    if (insertError) {
      console.error('Errore inserimento notizie:', insertError);
      throw insertError;
    }

    const insertedCount = insertedData?.length || 0;
    console.log(`Inserite ${insertedCount} notizie con successo`);

    return new Response(
      JSON.stringify({ 
        success: true,
        message: `Aggiornamento completato: ${insertedCount} notizie in italiano`,
        total_found: allNews.length,
        inserted: insertedCount
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('Errore in auto-update-news:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
