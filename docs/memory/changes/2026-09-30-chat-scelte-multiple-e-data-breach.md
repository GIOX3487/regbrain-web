---
date: 2026-09-30
author: Matteo Piccirilli, agente Claude (Fable 5.1)
roadmap_ids: ["CHAT-01", "CHAT-02"]
state_review: updated
state_reason: Lo stato della chat deve dire che l'intake ammette più risposte per domanda e che le violazioni dei dati seguono una struttura di valutazione per tipo di danno.
roadmap_review: updated
roadmap_reason: CHAT-01 registra il secondo giro di prova del DPO; nuova voce CHAT-02 per la valutazione delle violazioni dei dati, con il collaudo in produzione come criterio di chiusura.
files: ["supabase/functions/rag-query/index.ts", "supabase/functions/rag-query/facts.ts", "src/pages/Chat.tsx", "deployment/rag-facts.test.mjs", "roadmap.md", "docs/memory/STATE.md"]
---

## Richiesta e contesto

Secondo giro di prova del DPO di uno studio legale sulla chat (appunti scritti a mano, ricevuti
il 29 settembre). Tre osservazioni:

1. chiedendo di generare una DPIA, la domanda n. 2 dell'intake, sulle categorie di dati, non
   permette di selezionare più voci sommandole;
2. la domanda n. 3 non permette di scegliere insieme le due ipotesi di titolare, per un verso, e
   responsabile del trattamento dei propri clienti, per l'altro (uno studio è entrambi);
3. in caso di data breach, cosa può fare il software come analisi, con riferimento al tipo di
   danno subito?

Le prime due sono lo stesso difetto: i pulsanti delle opzioni erano a scelta singola (il clic
sostituiva la scelta precedente) e il modello dell'intake non aveva modo di dichiarare che più
risposte possono essere vere insieme. La terza è una funzione mancante: la chat trovava le fonti
giuste (art. 33 e 34 GDPR, linee guida EDPB 9/2022, già in configurazione di recupero) ma
rispondeva con la struttura generica, senza una valutazione per tipo di danno.

## Modifiche e motivazione

- `rag-query/index.ts`, intake: campo `multiple` per domanda, dichiarato dal modello (regola nel
  prompt: categorie di dati, tipi di interessati, tipi di danno, ruoli che coesistono) e in
  mancanza dedotto da `inferMultiple` (testo e opzioni); il ruolo nel trattamento è sempre a
  scelta multipla con le opzioni "Titolare del trattamento" e "Responsabile del trattamento per
  conto dei clienti". Opzioni fino a 8 (erano 4). Nella versione testuale della richiesta la
  domanda porta "(più risposte possibili)".
- `rag-query/index.ts`, violazioni: `isBreachContext` su domanda, obiettivo, fatti e storico.
  Quando scatta, l'intake può fare fino a 5 domande (erano 3) con una lista fissa dei fatti
  decisivi: natura della violazione, categorie di dati, protezione dei dati (cifratura,
  pseudonimizzazione, in chiaro), numero di interessati, data e ora di conoscenza, conseguenze
  osservate o probabili, ognuna con le sue opzioni e con `multiple` dove serve. La risposta
  riceve una struttura obbligatoria per la sezione "Applicazione al tuo contesto": tipo di
  violazione; danni possibili per gli interessati, un punto per tipo di danno pertinente (perdita
  di controllo, limitazione dei diritti, discriminazione, furto d'identità, perdita finanziaria,
  decifratura della pseudonimizzazione, danno reputazionale, segreto professionale, danno fisico)
  con probabilità e gravità motivate; livello di rischio con i criteri EDPB; notifica al Garante
  con scadenza delle 72 ore calcolata se la data è nota e obbligo del responsabile verso il
  titolare (art. 33 par. 2); comunicazione agli interessati con le tre eccezioni del par. 3;
  registro delle violazioni (art. 33 par. 5); misure immediate. Nel dubbio la regola è
  notificare. Il recupero usa lo stesso `BREACH_PATTERN` (ransomware, esfiltrazione, dispositivo
  smarrito, email al destinatario sbagliato, credenziali compromesse, non solo "data breach").
- `rag-query/facts.ts`: `inferMultiple`, `BREACH_PATTERN`, `isBreachContext`; una risposta con
  più scelte separate da ";" non è mai considerata ambigua.
- `src/pages/Chat.tsx`: i pulsanti delle opzioni si accendono e spengono; con `multiple` le
  scelte si sommano (separatore "; ") e la domanda mostra "Puoi scegliere più di una risposta";
  `aria-pressed` sui pulsanti.

## Verifiche ed esiti

- `deployment/rag-facts.test.mjs`: 4 test nuovi (scelte multiple non ambigue, deduzione di
  `multiple`, domande chiuse a scelta singola, riconoscimento della violazione senza la parola
  "data breach"); `npm run test:backend` 45 test verdi.
- `deno check` su rag-query, `tsc` e `vite build` puliti.
- Collaudo in produzione da fare dopo il rilascio: conversazione "abbiamo smarrito un portatile
  con l'archivio clienti in chiaro" con risposta alle domande e verifica di struttura, scadenza
  delle 72 ore e fonti citate (art. 33, 34, EDPB 9/2022).

## Rischi e limiti

- La struttura della valutazione è imposta dal prompt: il modello può ometterne un titolo; il
  collaudo in produzione lo verificherà. La valutazione non sostituisce il giudizio del DPO, e la
  risposta lo dichiara con le ipotesi prudenziali usate.
- `inferMultiple` è una regola lessicale: una domanda formulata con "quali" ma con risposte
  esclusive diventa a scelta multipla; l'utente può comunque scegliere una sola voce.
- Non esiste ancora un registro delle violazioni nel prodotto: la chat dice cosa annotare, non
  lo annota.

## Prossimo passo

Far ripetere al DPO la stessa prova (DPIA e data breach) e raccogliere i pollici; se la struttura
regge, valutare un registro delle violazioni generabile dal Document Generator.
