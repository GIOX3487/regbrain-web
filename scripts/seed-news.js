import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://mnbagzwdlvyjrmoyroqg.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1uYmFnendkbHZ5anJtb3lyb3FnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjAyMDQ2NTQsImV4cCI6MjA3NTc4MDY1NH0.l-p39_lUEK3jKV7pixX4wW8E5p34lJ4kBBz3E9OsYTQ';

const supabase = createClient(supabaseUrl, supabaseKey);

async function seedNews() {
  const sampleNews = [
    {
      title: 'GDPR: Nuove Linee Guida EDPB sui Cookie Wall',
      summary: 'Il Comitato Europeo per la Protezione dei Dati (EDPB) ha pubblicato nuove linee guida che chiariscano quando i cookie wall sono considerati un consenso valido secondo il GDPR. Le linee guida stabiliscono criteri più restrittivi per l\'uso di questi meccanismi.',
      source: 'EDPB',
      source_url: 'https://edpb.europa.eu',
      published_at: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
      regulation_type: 'GDPR',
      jurisdiction: 'EU',
      impact_level: 'high'
    },
    {
      title: 'NIS2: Scadenza Trasposizione Ottobre 2024',
      summary: 'Gli Stati membri dell\'UE devono recepire la Direttiva NIS2 entro il 17 ottobre 2024. La nuova direttiva espande significativamente il campo di applicazione della cybersecurity regulation includendo settori come energia, trasporti, sanità e digital infrastructure.',
      source: 'Consiglio UE',
      source_url: 'https://eur-lex.europa.eu',
      published_at: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(),
      regulation_type: 'NIS2',
      jurisdiction: 'EU',
      impact_level: 'high'
    },
    {
      title: 'AI Act: Regolamento Pubblicato in Gazzetta Ufficiale',
      summary: 'Il Regolamento sull\'Intelligenza Artificiale (AI Act) è stato ufficialmente pubblicato nella Gazzetta Ufficiale dell\'UE. Entrerà in vigore 20 giorni dopo la pubblicazione, con diverse scadenze di applicazione per le varie tipologie di sistemi AI.',
      source: 'Commissione Europea',
      source_url: 'https://eur-lex.europa.eu',
      published_at: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
      regulation_type: 'AI Act',
      jurisdiction: 'EU',
      impact_level: 'high'
    },
    {
      title: 'DORA: Guida EBA sulla Gestione del Rischio ICT',
      summary: 'L\'Autorità Bancaria Europea (EBA) ha pubblicato una guida interpretativa sul Digital Operational Resilience Act (DORA), fornendo chiarimenti su come le istituzioni finanziarie dovrebbero implementare i requisiti di gestione del rischio ICT.',
      source: 'EBA',
      source_url: 'https://www.eba.europa.eu',
      published_at: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString(),
      regulation_type: 'DORA',
      jurisdiction: 'EU',
      impact_level: 'medium'
    },
    {
      title: 'Cyber Resilience Act: Consultazione Pubblica Standard Tecnici',
      summary: 'La Commissione Europea ha aperto una consultazione pubblica sugli standard tecnici di implementazione del Cyber Resilience Act. I produttori di prodotti digitali sono invitati a fornire feedback entro il 30 marzo 2025.',
      source: 'Commissione Europea',
      source_url: 'https://ec.europa.eu',
      published_at: new Date(Date.now() - 12 * 24 * 60 * 60 * 1000).toISOString(),
      regulation_type: 'CRA',
      jurisdiction: 'EU',
      impact_level: 'medium'
    },
    {
      title: 'CCPA: Aggiornamento California Privacy Rights Act',
      summary: 'Il California Privacy Rights Act (CPRA) introduce nuovi diritti per i consumatori californiani, incluso il diritto alla correzione dei dati personali e limiti più stringenti sull\'uso dei dati sensibili. Le nuove regole si applicano a partire dal 1 gennaio 2023.',
      source: 'California AG',
      source_url: 'https://oag.ca.gov',
      published_at: new Date(Date.now() - 15 * 24 * 60 * 60 * 1000).toISOString(),
      regulation_type: 'CCPA',
      jurisdiction: 'US',
      impact_level: 'medium'
    },
    {
      title: 'HIPAA: Nuove Linee Guida sulla Telemedicina',
      summary: 'Il Dipartimento della Salute e dei Servizi Umani degli Stati Uniti ha pubblicato nuove linee guida sulla conformità HIPAA per i servizi di telemedicina, chiarendo i requisiti di sicurezza per le piattaforme di videoconferenza e la condivisione di dati sanitari.',
      source: 'HHS',
      source_url: 'https://www.hhs.gov',
      published_at: new Date(Date.now() - 18 * 24 * 60 * 60 * 1000).toISOString(),
      regulation_type: 'HIPAA',
      jurisdiction: 'US',
      impact_level: 'medium'
    },
    {
      title: 'CER: Entrata in Vigore della Direttiva Resilienza',
      summary: 'La Direttiva sulla Resilienza delle Entità Critiche (CER) è entrata in vigore, richiedendo agli Stati membri di identificare le entità critiche e implementare misure di resilienza per proteggere servizi essenziali da minacce fisiche e cyber.',
      source: 'Parlamento Europeo',
      source_url: 'https://eur-lex.europa.eu',
      published_at: new Date(Date.now() - 20 * 24 * 60 * 60 * 1000).toISOString(),
      regulation_type: 'CER',
      jurisdiction: 'EU',
      impact_level: 'high'
    }
  ];

  const { data, error } = await supabase
    .from('news_updates')
    .insert(sampleNews)
    .select();

  if (error) {
    console.error('Error inserting news:', error);
    return { success: false, error };
  }

  console.log('Successfully inserted', data.length, 'news items');
  return { success: true, count: data.length };
}

seedNews().then(result => {
  console.log('Result:', result);
  process.exit(result.success ? 0 : 1);
});
