---
date: 2026-09-22
author: Matteo Piccirilli, agente Claude (Opus 5)
roadmap_ids: ["CODE-01", "RAG-10"]
state_review: updated
state_reason: Nello stato il modulo di conformità del codice era solo una specifica e un corpus di fonti; ora esiste uno strumento nel Compliance Hub, con regole deterministiche e un report, e va registrato cosa decide la regola e cosa il modello.
roadmap_review: updated
roadmap_reason: Serviva un ID per il modulo code compliance, che prima esisteva solo dentro RAG-10 come "scrivere il catalogo dei controlli".
files: ["supabase/migrations/20260922160000_code_checks.sql", "supabase/functions/code-compliance/index.ts", "supabase/functions/code-compliance/rules.ts", "supabase/functions/code-compliance/scan.ts", "supabase/config.toml", "deployment/functions.json", ".github/workflows/supabase-deploy.yml", "src/pages/CodeCheck.tsx", "src/lib/code-check-report.ts", "src/pages/ComplianceHub.tsx", "src/pages/Chat.tsx", "src/App.tsx", "src/integrations/supabase/types.ts", "docs/memory/STATE.md", "roadmap.md"]
---

## Richiesta e contesto

Richiesta del 22 settembre: valutare se spostare nel Compliance Hub il RAG con le normative sul
software e aggiungere la possibilità di incollare codice o caricare file di codice per verificarne
la conformità.

Valutazione: il RAG non va spostato né duplicato. È una sola base di conoscenza usata dalla chat,
dalla gap analysis e ora dalla verifica del codice; due copie divergerebbero e lo stesso obbligo
darebbe risposte diverse. Quello che manca al Compliance Hub è lo strumento, non il corpus.

Sulla verifica in sé vale quanto già detto per il modulo code compliance: se il giudizio lo dà
solo il modello, lo stesso file analizzato due volte dà esiti diversi e nessuno può firmare il
referto. Quindi decide una regola scritta, e il modello arriva dopo.

## Modifiche e motivazione

- `supabase/functions/code-compliance`: 21 regole deterministiche (`rules.ts`) applicate riga per
  riga (`scan.ts`). Ogni esito ha file, riga e la riga di codice che lo prova, con i segreti
  mascherati. Aree coperte: credenziali nel codice, hash deboli, http in chiaro, verifica TLS
  disattivata, SQL costruito per concatenazione, esecuzione dinamica di codice, strumenti di
  tracciamento, dati personali o credenziali nei log, geolocalizzazione, fingerprinting, categorie
  particolari di dati, token nel localStorage, cookie senza attributi, CORS aperto, debug attivo,
  casualità non sicura, uso di servizi di IA, contenuti sintetici, immagini senza alt, lingua della
  pagina, licenze copyleft.
- Ogni regola porta i riferimenti normativi come chiavi di `structured_chunks`: il testo citato nel
  report è quello caricato nel RAG (GDPR, ePrivacy, Codice privacy, linee guida cookie del Garante,
  CRA, AI Act, L. 132/2025, D.Lgs. 138/2024, WCAG 2.2, EAA, OWASP ASVS, AgID sviluppo sicuro,
  licenze). Si aggiunge una ricerca semantica limitata al corpus del software.
- Il modello legge codice, esiti e fonti e può: spiegare cosa significa nel codice specifico,
  proporre l'intervento, marcare un esito come possibile falso positivo, aggiungere al massimo sei
  problemi ulteriori e fino a cinque domande per completare la verifica. Non può cancellare un
  esito delle regole. Un problema aggiunto dal modello entra nel report solo se il file e la riga
  indicati esistono davvero e non sono vuoti, ed è marcato "da verificare".
- Il rischio complessivo è alto, medio o basso e viene dal livello più alto fra gli esiti non
  marcati come falsi positivi.
- Pagina `/compliance/code-check`: incolla o carica fino a 40 file (400.000 caratteri), sei
  domande di contesto, esito con prove e fonti apribili, domande a cui rispondere per rilanciare
  la verifica, report PDF, elenco delle verifiche precedenti, collegamento alla chat per
  approfondire un singolo esito.
- Tabella `code_checks`: si salva l'esito, non il codice. Restano nomi dei file, numero di righe,
  impronta SHA-256 e le righe citate come prova. Il codice viene inviato al fornitore del modello
  per la revisione, come i documenti della gap analysis, e questo è scritto nella pagina.

## Verifiche ed esiti

- Prova delle regole su tre file scritti apposta (JavaScript, HTML, Python) con venti problemi
  noti: tutte le regole attese hanno prodotto l'esito giusto, con file e riga corretti, i segreti
  mascherati e nessun falso positivo sulle righe sane.
- `deno check` sulla funzione, `npm run check:edge`, `npm run test:backend`, `tsc` e
  `npm run build` senza errori.
- Migrazione applicata in produzione; prova end to end sull'ambiente reale dopo il deploy.

## Rischi e limiti

- Le regole leggono una riga alla volta: non seguono il flusso dei dati, quindi non sanno se la
  variabile che finisce in una query arriva davvero dall'utente. Producono falsi positivi (un
  valore finto in un file di esempio) e non vedono i problemi che nascono dalla combinazione di
  più file.
- La verifica non guarda configurazioni dei server, contratti con i fornitori, informative e
  scelte organizzative: non è una certificazione di conformità e il report lo dice.
- La copertura è quella delle 21 regole: le aree non coperte restano scoperte anche se il
  risultato è "nessun problema".
- Il codice esce verso il fornitore del modello: l'informativa privacy va aggiornata anche per
  questo, come già serve per la console di amministrazione.

## Prossimo passo

Provare la verifica su un progetto reale di Giovanni e contare falsi positivi e problemi mancati,
poi tarare le regole. Aggiungere i pollici su e giù anche a questi esiti, per usarli come set di
regressione. Valutare una regola di secondo livello che colleghi più file (per esempio script di
tracciamento e presenza del banner nella stessa pagina).
