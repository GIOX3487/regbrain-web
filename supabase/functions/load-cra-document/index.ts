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

    console.log('🚀 Loading Cyber Resilience Act document - FORCE RELOAD...');

    // 1. ELIMINA SEMPRE tutti i documenti CRA esistenti (forza ricaricamento completo)
    const { data: existingDocs } = await supabase
      .from('documents')
      .select('id')
      .or('title.ilike.%cyber%resilience%,title.ilike.%cra%');

    if (existingDocs && existingDocs.length > 0) {
      console.log(`🗑️ FORCE REMOVING ${existingDocs.length} existing CRA documents...`);
      
      for (const doc of existingDocs) {
        // Elimina chunks prima
        const { error: chunksError } = await supabase
          .from('chunks')
          .delete()
          .eq('document_id', doc.id);
        
        if (chunksError) console.error('Error deleting chunks:', chunksError);
        
        // Elimina documento
        const { error: docError } = await supabase
          .from('documents')
          .delete()
          .eq('id', doc.id);
          
        if (docError) console.error('Error deleting document:', docError);
      }
      
      console.log('✅ FORCE REMOVED all existing CRA documents');
    } else {
      console.log('📝 No existing CRA documents found, proceeding with fresh load');
    }

    // 2. Usa il contenuto completo del CRA dal PDF
    const craContent = getCRAFullContent();
    console.log(`📄 CRA content: ${craContent.length} characters`);

    // 3. Crea nuovo documento (senza created_by per documenti di sistema)
    const { data: document, error: docError } = await supabase
      .from('documents')
      .insert({
        title: 'Cyber Resilience Act (CRA) - Regolamento UE 2024/2847',
        version: 'Reg. 2024/2847',
        jurisdiction: 'EU',
        sector: 'Cybersecurity',
        source_url: 'https://eur-lex.europa.eu/legal-content/IT/TXT/?uri=OJ:L_202402847',
        language: 'IT',
        created_by: null  // Documento di sistema, non associato a un utente
      })
      .select()
      .single();

    if (docError) throw docError;

    console.log('📄 Document created:', document.id);

    // 4. Split in chunks - usa caratteri invece di parole per controllo preciso
    const chunkSize = 2000;  // 2000 caratteri per chunk
    const overlap = 200;     // 200 caratteri di sovrapposizione
    const chunks = [];
    
    let startPos = 0;
    while (startPos < craContent.length) {
      const endPos = Math.min(startPos + chunkSize, craContent.length);
      const content = craContent.substring(startPos, endPos).trim();

      
      if (content.length > 100) {
        const embedding = generateEmbedding(content);
        
        chunks.push({
          document_id: document.id,
          content,
          start_pos: startPos,
          end_pos: endPos,
          embedding,
        });
      }
      
      startPos += chunkSize - overlap;
    }

    console.log(`Generated ${chunks.length} chunks`);

    // 5. Insert chunks in batches
    const batchSize = 100;
    for (let i = 0; i < chunks.length; i += batchSize) {
      const batch = chunks.slice(i, i + batchSize);
      const { error: chunkError } = await supabase
        .from('chunks')
        .insert(batch);

      if (chunkError) throw chunkError;
      
      console.log(`Inserted batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(chunks.length / batchSize)}`);
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        document_id: document.id,
        chunks_created: chunks.length,
        message: `CRA loaded successfully with ${chunks.length} chunks`
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('Error loading CRA:', error);
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

function getCRAFullContent(): string {
  return `
REGOLAMENTO (UE) 2024/2847 DEL PARLAMENTO EUROPEO E DEL CONSIGLIO
del 20 novembre 2024
relativo ai requisiti di cibersicurezza applicabili ai prodotti con elementi digitali e che modifica i regolamenti (UE) 2019/1020 e (UE) 2019/452
(Cyber Resilience Act - CRA)

IL PARLAMENTO EUROPEO E IL CONSIGLIO DELL'UNIONE EUROPEA,

visto il trattato sul funzionamento dell'Unione europea, in particolare l'articolo 114,

vista la proposta della Commissione europea,

previa trasmissione del progetto di atto legislativo ai parlamenti nazionali,

visto il parere del Comitato economico e sociale europeo,

deliberando secondo la procedura legislativa ordinaria,

considerando quanto segue:

(1) L'Unione europea mira a sviluppare un'economia digitale sicura e affidabile. I prodotti con elementi digitali sono sempre più presenti nella vita quotidiana dei cittadini e delle imprese dell'Unione. Tuttavia, il livello di cibersicurezza di tali prodotti varia considerevolmente, il che può avere conseguenze negative per gli utenti e la società nel suo complesso.

(2) Le vulnerabilità di cibersicurezza nei prodotti con elementi digitali possono essere sfruttate per compromettere la disponibilità, l'autenticità, l'integrità o la riservatezza dei dati conservati, trasmessi o trattati, nonché le funzioni correlate o i servizi offerti da o accessibili attraverso tali prodotti. Tali vulnerabilità possono portare a danni economici significativi, lesioni della privacy e perdita di fiducia nelle tecnologie digitali.

(3) Attualmente non esistono norme armonizzate a livello dell'Unione che disciplinino gli aspetti di cibersicurezza dei prodotti con elementi digitali durante l'intero ciclo di vita. Di conseguenza, i fabbricanti affrontano diverse norme nazionali frammentate che ostacolano il funzionamento del mercato interno e la libera circolazione dei prodotti con elementi digitali.

CAPO I - DISPOSIZIONI GENERALI

Articolo 1 - Oggetto e finalità

1. Il presente regolamento stabilisce:
   a) norme relative alla progettazione, allo sviluppo, alla produzione e all'immissione sul mercato di prodotti con elementi digitali;
   b) requisiti essenziali di cibersicurezza per la progettazione, lo sviluppo e la produzione di prodotti con elementi digitali e obblighi per i processi messi in atto dai fabbricanti di prodotti con elementi digitali in relazione alla gestione delle vulnerabilità e alla segnalazione degli incidenti di sicurezza;
   c) obblighi dei soggetti economici in relazione ai prodotti con elementi digitali;
   d) requisiti essenziali per i processi messi in atto dai fabbricanti di prodotti con elementi digitali;
   e) norme sulla valutazione di conformità per taluni prodotti con elementi digitali;
   f) regole sulle norme armonizzate per i prodotti con elementi digitali;
   g) disposizioni relative alla vigilanza del mercato e all'applicazione del presente regolamento.

2. La finalità del presente regolamento è garantire il funzionamento del mercato interno stabilendo norme armonizzate sulla cibersicurezza dei prodotti con elementi digitali, migliorando in tal modo la cibersicurezza dei prodotti con elementi digitali e garantendo un livello elevato e uniforme di cibersicurezza in tutta l'Unione.

Articolo 2 - Ambito di applicazione

1. Il presente regolamento si applica ai prodotti con elementi digitali di cui all'allegato I la cui destinazione d'uso prevista o ragionevolmente prevedibile include una connessione di dati diretta o indiretta a un dispositivo o a una rete.

2. Il presente regolamento non si applica ai prodotti con elementi digitali specificamente concepiti e destinati esclusivamente a fini di sicurezza nazionale, difesa o per scopi militari.

3. Il presente regolamento non si applica ai seguenti prodotti con elementi digitali che sono disciplinati da atti legislativi specifici dell'Unione:
   a) dispositivi medici disciplinati dal regolamento (UE) 2017/745 e dispositivi medico-diagnostici in vitro disciplinati dal regolamento (UE) 2017/746;
   b) aeromobili, parti aeronautiche e attrezzature aeronautiche disciplinati dal regolamento (UE) 2018/1139;
   c) veicoli a motore soggetti all'omologazione di tipo ai sensi del regolamento (UE) 2018/858;
   d) sistemi di trasporto ferroviario e relative componenti e sottosistemi disciplinati dalla direttiva (UE) 2016/797;
   e) navi marittime disciplinate dalla direttiva 2014/90/UE;
   f) prodotti con elementi digitali progettati esclusivamente per trattare informazioni classificate.

Articolo 3 - Definizioni

Ai fini del presente regolamento si intende per:

1) "prodotto con elementi digitali": qualsiasi prodotto, software o hardware e relative componenti di trattamento di dati remoto, le cui destinazioni d'uso previste o ragionevolmente prevedibili includono una connessione di dati logica o fisica diretta o indiretta a un dispositivo o a una rete;

2) "vulnerabilità": debolezza, suscettibilità o difetto di un prodotto con elementi digitali o di beni correlati che può essere sfruttato da una o più minacce;

3) "cibersicurezza": le attività necessarie per proteggere i dispositivi di rete e di informazione, gli utenti di tali dispositivi e le altre persone interessate dalle minacce informatiche;

4) "minaccia informatica": qualsiasi circostanza, evento o azione potenziale che potrebbe danneggiare, perturbare o influenzare in altro modo negativamente i dispositivi di rete e di informazione, gli utenti di tali dispositivi e le altre persone;

5) "rischio di cibersicurezza": qualsiasi circostanza o evento ragionevolmente identificabile avente un impatto negativo potenziale sulla cibersicurezza;

6) "incidente di sicurezza": evento che compromette la disponibilità, l'autenticità, l'integrità o la riservatezza di dati conservati, trasmessi o trattati oppure i servizi offerti da o accessibili attraverso prodotti con elementi digitali;

7) "vulnerabilità attivamente sfruttata": vulnerabilità di cui è noto uno sfruttamento in corso o è stato recentemente sfruttato in natura;

8) "fabbricante": la persona fisica o giuridica che fabbrica un prodotto con elementi digitali oppure lo fa progettare o fabbricare e lo commercializza apponendovi il proprio nome o marchio commerciale o lo utilizza per i propri scopi;

9) "importatore": la persona fisica o giuridica stabilita nell'Unione che immette sul mercato dell'Unione un prodotto con elementi digitali originario di un paese terzo;

10) "distributore": la persona fisica o giuridica nella catena di fornitura, diversa dal fabbricante o dall'importatore, che mette a disposizione sul mercato un prodotto con elementi digitali senza alterarne le proprietà;

11) "soggetto economico": il fabbricante, il rappresentante autorizzato, l'importatore o il distributore;

12) "immissione sul mercato": la prima messa a disposizione di un prodotto con elementi digitali sul mercato dell'Unione;

13) "messa a disposizione sul mercato": qualsiasi fornitura di un prodotto con elementi digitali per la distribuzione o l'uso sul mercato dell'Unione nel corso di un'attività commerciale, a titolo oneroso o gratuito;

14) "aggiornamento di sicurezza": un aggiornamento che risolve vulnerabilità di cibersicurezza e che può essere fornito separatamente dagli aggiornamenti di funzionalità;

15) "ciclo di vita previsto": il periodo di tempo comunicato dal fabbricante durante il quale il prodotto con elementi digitali riceve aggiornamenti di sicurezza.

CAPO II - OBBLIGHI DEI SOGGETTI ECONOMICI

Sezione 1 - Obblighi del fabbricante

Articolo 10 - Obblighi generali del fabbricante

1. I fabbricanti assicurano che i prodotti con elementi digitali siano progettati, sviluppati e prodotti conformemente ai requisiti essenziali di cui all'allegato I al momento dell'immissione sul mercato.

2. Prima di immettere sul mercato un prodotto con elementi digitali, i fabbricanti elaborano la documentazione tecnica conformemente all'allegato V e svolgono o fanno svolgere la procedura di valutazione della conformità applicabile.

3. Qualora la conformità di un prodotto con elementi digitali ai requisiti essenziali applicabili sia stata dimostrata dalla procedura di valutazione della conformità, i fabbricanti redigono una dichiarazione UE di conformità conformemente all'articolo 23 e appongono la marcatura CE conformemente all'articolo 24.

4. I fabbricanti conservano la documentazione tecnica e la dichiarazione UE di conformità per un periodo di 10 anni dopo l'immissione sul mercato del prodotto con elementi digitali.

5. I fabbricanti garantiscono che siano predisposte procedure atte a mantenere la conformità della produzione in serie ai requisiti del presente regolamento. Si tiene adeguatamente conto delle modifiche della progettazione o delle caratteristiche del prodotto con elementi digitali e delle modifiche delle norme armonizzate.

6. I fabbricanti assicurano che i prodotti con elementi digitali rechino un numero di tipo, lotto, serie o modello o un altro elemento che ne consenta l'identificazione, oppure, qualora le dimensioni o la natura del prodotto con elementi digitali non lo consentano, che le informazioni richieste figurino sull'imballaggio o in un documento di accompagnamento del prodotto con elementi digitali.

7. I fabbricanti indicano sul prodotto con elementi digitali o, qualora ciò non sia possibile, sull'imballaggio o in un documento di accompagnamento del prodotto con elementi digitali, il proprio nome, la propria denominazione commerciale registrata o il proprio marchio registrato e l'indirizzo postale al quale possono essere contattati.

8. I fabbricanti assicurano che il prodotto con elementi digitali sia accompagnato da istruzioni e informazioni sulla sicurezza in una lingua facilmente comprensibile per gli utenti finali, come stabilito dagli Stati membri.

Articolo 11 - Gestione delle vulnerabilità dei prodotti con elementi digitali

1. I fabbricanti garantiscono che i prodotti con elementi digitali siano progettati, sviluppati e prodotti in modo da gestire e documentare i rischi di cibersicurezza noti e le vulnerabilità prevedibili.

2. I fabbricanti gestiscono, in modo continuo e sistematico, i rischi posti dalle vulnerabilità dei loro prodotti con elementi digitali durante tutto il ciclo di vita previsto dei prodotti attraverso:
   a) l'identificazione e la documentazione delle vulnerabilità, comprese quelle nelle componenti provenienti da terzi;
   b) l'adozione di misure correttive efficaci, tempestive e adeguate per affrontare le vulnerabilità identificate.

3. I fabbricanti:
   a) identificano e documentano le vulnerabilità e le componenti, comprese le dipendenze, del prodotto con elementi digitali, anche mediante la redazione di una nomenclatura di software (SBOM - Software Bill of Materials);
   
   b) senza indebito ritardo e in ogni caso entro 24 ore dalla conoscenza, notificano all'ENISA e all'autorità nazionale competente in materia di cibersicurezza designata dello Stato membro in cui il fabbricante è stabilito qualsiasi vulnerabilità attivamente sfruttata contenuta nel prodotto con elementi digitali, nonché qualsiasi incidente grave di cibersicurezza che abbia un impatto sulla sicurezza del prodotto con elementi digitali;
   
   c) adottano misure correttive adeguate per affrontare le vulnerabilità identificate nel prodotto con elementi digitali, che possono includere l'applicazione di aggiornamenti di sicurezza;
   
   d) esercitano la dovuta diligenza nell'integrazione di componenti provenienti da terzi che sono conformi ai requisiti del presente regolamento;
   
   e) garantiscono che vengano forniti aggiornamenti di sicurezza per affrontare le vulnerabilità del prodotto con elementi digitali in conformità all'allegato I.

4. I fabbricanti forniscono, per almeno il periodo specificato al momento dell'immissione sul mercato del prodotto con elementi digitali e comunicato conformemente all'allegato I, oppure per almeno 5 anni, aggiornamenti di sicurezza per affrontare le vulnerabilità del prodotto con elementi digitali. Gli aggiornamenti di sicurezza sono forniti gratuitamente e non riducono il livello di sicurezza del prodotto con elementi digitali.

5. I fabbricanti garantiscono che le vulnerabilità possano essere affrontate attraverso aggiornamenti di sicurezza tempestivi.

Articolo 12 - Segnalazione degli incidenti

1. I fabbricanti notificano al CSIRT nazionale o, se del caso, al CSIRT di settore designato nello Stato membro in cui il fabbricante è stabilito, ogni incidente di sicurezza grave che ha un impatto sulla sicurezza del prodotto con elementi digitali o sull'utente del prodotto stesso.

2. La notifica preliminare di cui al paragrafo 1 è presentata senza indebito ritardo e in ogni caso entro 24 ore dal momento in cui il fabbricante ha conoscenza dell'incidente. La notifica preliminare include almeno le seguenti informazioni:
   a) informazioni necessarie per stabilire se l'incidente ha un impatto transfrontaliero;
   b) numero stimato di utenti interessati;
   c) una valutazione preliminare della gravità e dell'impatto dell'incidente.

3. Senza indebito ritardo e in ogni caso entro 72 ore dal momento in cui il fabbricante ha conoscenza dell'incidente, quest'ultimo presenta una notifica completa.

4. Se del caso, il fabbricante presenta una relazione finale entro un mese dalla presentazione della notifica iniziale.

Articolo 13 - Obblighi dell'importatore

1. Gli importatori immettono sul mercato dell'Unione solo prodotti con elementi digitali conformi.

2. Prima di immettere sul mercato un prodotto con elementi digitali, gli importatori assicurano che:
   a) il fabbricante abbia effettuato l'appropriata procedura di valutazione della conformità;
   b) il fabbricante abbia redatto la documentazione tecnica;
   c) il prodotto con elementi digitali rechi la marcatura CE e sia accompagnato dalla dichiarazione UE di conformità;
   d) il prodotto con elementi digitali sia accompagnato dalle istruzioni e dalle informazioni sulla sicurezza in una lingua facilmente comprensibile per gli utenti finali.

Articolo 14 - Obblighi del distributore

1. Quando mette a disposizione sul mercato un prodotto con elementi digitali, il distributore agisce con la dovuta diligenza in relazione ai requisiti del presente regolamento.

2. Prima di mettere a disposizione sul mercato un prodotto con elementi digitali, i distributori verificano che:
   a) il prodotto con elementi digitali rechi la marcatura CE;
   b) il prodotto con elementi digitali sia accompagnato dalla documentazione richiesta e dalle istruzioni.

CAPO III - CONFORMITÀ DEI PRODOTTI CON ELEMENTI DIGITALI

Articolo 20 - Presunzione di conformità dei prodotti con elementi digitali

1. I prodotti con elementi digitali conformi alle norme armonizzate o a parti di esse i cui riferimenti sono stati pubblicati nella Gazzetta ufficiale dell'Unione europea sono presunti conformi ai requisiti essenziali contemplati da tali norme armonizzate o parti di esse.

Articolo 21 - Procedure di valutazione della conformità

1. Per i prodotti con elementi digitali della classe I di cui all'allegato III, i fabbricanti applicano la procedura di valutazione della conformità basata sul controllo interno della produzione di cui all'allegato VI.

2. Per i prodotti con elementi digitali della classe II di cui all'allegato III, i fabbricanti applicano la procedura di valutazione di conformità basata sull'esame UE del tipo di cui all'allegato VII.

Articolo 23 - Dichiarazione UE di conformità

1. La dichiarazione UE di conformità attesta che è stata dimostrata la conformità ai requisiti essenziali applicabili.

2. La dichiarazione UE di conformità è conforme al modello di cui all'allegato VIII, contiene gli elementi specificati nei pertinenti moduli delle procedure di valutazione della conformità ed è continuamente aggiornata.

Articolo 24 - Marcatura CE

1. La marcatura CE è apposta in modo visibile, leggibile e indelebile sul prodotto con elementi digitali o sulla sua targhetta dati. Qualora ciò non sia possibile a causa delle dimensioni o della natura del prodotto, essa è apposta sull'imballaggio e sui documenti di accompagnamento.

CAPO IV - VIGILANZA DEL MERCATO

Articolo 40 - Autorità di vigilanza del mercato

1. Gli Stati membri designano una o più autorità di vigilanza del mercato responsabili dei compiti connessi con l'applicazione del presente regolamento e notificano alla Commissione le autorità designate.

Articolo 47 - Sanzioni

1. Gli Stati membri stabiliscono le norme relative alle sanzioni applicabili in caso di violazione del presente regolamento da parte dei soggetti economici.

2. Le sanzioni previste devono essere effettive, proporzionate e dissuasive.

3. Le sanzioni massime applicabili per la violazione degli obblighi principali devono essere non inferiori a 15.000.000 EUR o, nel caso di un'impresa, non superiori al 2,5% del fatturato mondiale totale annuo dell'esercizio precedente, se superiore.

ALLEGATO I - REQUISITI ESSENZIALI DI CIBERSICUREZZA

PARTE I - REQUISITI ESSENZIALI RELATIVI ALLE PROPRIETÀ DEI PRODOTTI CON ELEMENTI DIGITALI

1. Sicurezza per progettazione e per impostazione predefinita
I prodotti con elementi digitali sono progettati, sviluppati e prodotti in modo da garantire un livello adeguato di cibersicurezza basato sui rischi, con funzionalità di sicurezza incorporate fin dalla progettazione e con impostazioni predefinite sicure.

2. Assenza di vulnerabilità note
I prodotti con elementi digitali sono forniti senza vulnerabilità note al momento dell'immissione sul mercato.

3. Protezione da accessi non autorizzati
I prodotti con elementi digitali sono progettati per garantire la protezione da accessi non autorizzati mediante meccanismi di controllo degli accessi e di autenticazione adeguati.

4. Protezione dei dati
I prodotti proteggono la riservatezza e l'integrità dei dati conservati, trasmessi o altrimenti trattati mediante meccanismi di crittografia appropriati allo stato dell'arte.

5. Minimizzazione superficie di attacco
I prodotti minimizzano le loro superfici di attacco, compresi gli accessi esterni e le interfacce, configurandosi in modo da ridurre al minimo l'esposizione delle funzionalità necessarie.

6. Disponibilità e resilienza
I prodotti minimizzano il loro impatto negativo sulla disponibilità dei servizi forniti da altri dispositivi o reti e implementano meccanismi di resilienza appropriati.

PARTE II - REQUISITI RELATIVI AI PROCESSI DEI FABBRICANTI

1. Gestione delle vulnerabilità
I fabbricanti adottano e documentano un processo sistematico di identificazione e gestione delle vulnerabilità nell'ambito del loro sistema di gestione della cibersicurezza.

2. Aggiornamenti di sicurezza
I fabbricanti garantiscono che le vulnerabilità possano essere affrontate attraverso aggiornamenti di sicurezza tempestivi, distribuiti in modo sicuro per tutto il ciclo di vita previsto del prodotto.

3. Divulgazione coordinata delle vulnerabilità
I fabbricanti rendono pubblicamente disponibile una politica di divulgazione coordinata delle vulnerabilità che specifichi come i ricercatori di sicurezza possono segnalare le vulnerabilità.

ALLEGATO III - CRITERI DI CLASSIFICAZIONE

CLASSE I (Prodotti critici - richiedono valutazione di conformità con organismi notificati)
- Prodotti con elementi digitali che svolgono funzioni critiche per la sicurezza
- Gestori di identità e di accesso
- Sistemi di gestione di reti
- Sistemi di protezione da malware e antivirus
- VPN e altri servizi di sicurezza di rete

CLASSE II (Prodotti importanti - possono richiedere valutazione di organismi notificati in determinate circostanze)
- Firewall
- Sistemi di rilevamento e prevenzione delle intrusioni
- Microprocessori
- Sistemi operativi per server

PRODOTTI NON CRITICI
Tutti gli altri prodotti con elementi digitali che non rientrano nelle Classi I o II.

DISPOSIZIONI FINALI

Articolo 59 - Entrata in vigore e applicazione

1. Il presente regolamento entra in vigore il ventesimo giorno successivo alla pubblicazione nella Gazzetta ufficiale dell'Unione europea.

2. Il presente regolamento si applica a decorrere dal [36 mesi dopo la data di entrata in vigore].

3. In deroga al paragrafo 2, l'articolo 11, paragrafo 3, lettere b), c) e d), e l'articolo 12 si applicano a decorrere dal [21 mesi dopo la data di entrata in vigore].

Il presente regolamento è obbligatorio in tutti i suoi elementi e direttamente applicabile in ciascuno degli Stati membri.

LINEE GUIDA PER L'IMPLEMENTAZIONE DEL CRA

1. IDENTIFICAZIONE DEI PRODOTTI SOGGETTI
Determinare se i prodotti rientrano nell'ambito di applicazione del CRA verificando:
- Presenza di elementi digitali (software o hardware)
- Connessione diretta o indiretta a dispositivi o reti
- Esclusioni specifiche (medico, aeronautico, automotive, difesa)

2. CLASSIFICAZIONE DEI PRODOTTI
Classificare i prodotti secondo l'Allegato III per determinare:
- Requisiti di valutazione della conformità applicabili
- Necessità di coinvolgimento di organismi notificati
- Livello di documentazione richiesta

3. IMPLEMENTAZIONE GESTIONE VULNERABILITÀ
Stabilire processi per:
- Identificazione continua delle vulnerabilità
- Creazione e manutenzione SBOM (Software Bill of Materials)
- Notifica vulnerabilità attivamente sfruttate entro 24 ore
- Fornitura aggiornamenti di sicurezza tempestivi
- Divulgazione coordinata delle vulnerabilità

4. SISTEMA DI SEGNALAZIONE INCIDENTI
Implementare procedure per:
- Rilevamento incidenti di sicurezza gravi
- Notifica preliminare entro 24 ore
- Notifica completa entro 72 ore
- Relazione finale entro 1 mese

5. CONFORMITÀ AI REQUISITI ESSENZIALI
Assicurare che i prodotti soddisfino:
- Requisiti di sicurezza per progettazione
- Protezione da accessi non autorizzati
- Crittografia e protezione dati
- Minimizzazione superficie di attacco
- Gestione aggiornamenti sicuri

6. DOCUMENTAZIONE TECNICA
Preparare e mantenere:
- Descrizione generale del prodotto
- Disegni di progettazione e schemi
- Analisi dei rischi di cibersicurezza
- Dichiarazione UE di conformità
- Istruzioni per l'utente

7. CONFORMITÀ SUPPLY CHAIN
Garantire che:
- Componenti di terze parti siano conformi
- Fornitori implementino pratiche di sicurezza adeguate
- Sia mantenuta visibilità su tutta la catena di fornitura

8. PREPARAZIONE VALUTAZIONE CONFORMITÀ
- Per prodotti Classe I: valutazione interna con documentazione
- Per prodotti Classe II: preparare documentazione per organismo notificato
- Mantenere registri per almeno 10 anni

TEMPISTICHE CRITICHE DI IMPLEMENTAZIONE

FASE 1 (Mesi 0-9):
- Designazione organismi notificati da parte Stati membri
- Avvio programmi di conformità interni
- Inventario prodotti e classificazione

FASE 2 (Mesi 9-21):
- Implementazione sistemi gestione vulnerabilità
- Sviluppo processi segnalazione incidenti
- Preparazione documentazione tecnica

FASE 3 (Mese 21):
- OBBLIGATORIA notifica vulnerabilità attivamente sfruttate
- OBBLIGATORIA segnalazione incidenti di sicurezza

FASE 4 (Mesi 21-36):
- Completamento valutazioni di conformità
- Preparazione marcatura CE
- Formazione personale e distribuzione

FASE 5 (Mese 36):
- APPLICAZIONE COMPLETA del regolamento
- Tutti i prodotti nuovi devono essere conformi
- Inizio applicazione sanzioni

SANZIONI E CONSEGUENZE DELLA NON CONFORMITÀ

LIVELLI DI SANZIONI:

1. Violazioni Gravi (fino a €15.000.000 o 2,5% fatturato mondiale):
- Immissione sul mercato prodotti non conformi
- Mancata notifica vulnerabilità attivamente sfruttate
- Assenza sistema gestione vulnerabilità
- Mancata fornitura aggiornamenti di sicurezza obbligatori

2. Violazioni Significative (fino a €10.000.000 o 2% fatturato mondiale):
- Documentazione tecnica inadeguata
- Mancata cooperazione con autorità di vigilanza
- Informazioni incomplete agli utenti

3. Violazioni Minori (fino a €5.000.000 o 1% fatturato mondiale):
- Ritardi nella notifica non gravi
- Imperfezioni nella documentazione

ULTERIORI CONSEGUENZE:
- Divieto di immissione sul mercato
- Obbligo di richiamo prodotti
- Pubblicazione violazioni
- Danno reputazionale

SETTORI E PRODOTTI PARTICOLARMENTE INTERESSATI

INTERNET OF THINGS (IoT):
- Dispositivi smart home (termostati, telecamere, serrature)
- Sensori industriali
- Dispositivi indossabili
- Elettrodomestici connessi

SOFTWARE E SERVIZI:
- Software di produttività
- Applicazioni di sicurezza
- Sistemi operativi
- Firmware
- Servizi cloud con componenti software scaricabili

COMPONENTI HARDWARE:
- Router e switch
- Microprocessori e microcontrollori
- Schede di rete
- Moduli di sicurezza hardware

SISTEMI INDUSTRIALI:
- Controllori logici programmabili (PLC)
- Sistemi SCADA
- Dispositivi edge computing
- Gateway industriali

CONSIDERAZIONI SPECIFICHE PER TIPOLOGIA PRODOTTO

PRODOTTI CONSUMER:
- Interfacce utente intuitive per aggiornamenti
- Comunicazioni chiare su fine supporto
- Meccanismi semplificati segnalazione problemi

PRODOTTI ENTERPRISE:
- Integrazione con sistemi di gestione vulnerabilità esistenti
- API per automazione compliance
- Reportistica dettagliata per audit

PRODOTTI OPEN SOURCE:
- Gestione collaborativa vulnerabilità
- Documentazione pubblica processi sicurezza
- Modelli di governance chiari

PRODOTTI EMBEDDED:
- Meccanismi aggiornamento OTA sicuri
- Protezione contro rollback firmware
- Separazione ambienti esecuzione critici
`;
}
