---
date: 2026-09-23
author: Matteo Piccirilli, agente Claude (Fable 5.1)
roadmap_ids: ["CHAT-01", "RAG-10"]
state_review: updated
state_reason: La chat cambia comportamento su due punti visibili all'utente (nota sulle fonti assenti, affidabilità) e lo stato deve registrare la causa del feedback negativo.
roadmap_review: updated
roadmap_reason: Nuova voce CHAT-01 con il caso del feedback e i passi che restano; RAG-10 resta il prerequisito per la L. 300/1970.
files: ["supabase/functions/rag-query/index.ts", "supabase/functions/rag-query/facts.ts", "deployment/rag-facts.test.mjs", "package.json", "roadmap.md", "docs/memory/STATE.md"]
---

## Richiesta e contesto

Nel pannello di amministrazione un DPO ha lasciato un pollice giù su una risposta della chat:
"hai inventato l'attivazione degli accordi sindacali". Ricostruzione dal record del feedback:
l'intake aveva chiesto "In quale Stato membro operano i dipendenti e sono già stati coinvolti i
rappresentanti sindacali o l'Ispettorato del Lavoro (es. art. 4 Statuto Lavoratori in Italia)?";
l'utente ha risposto "Italia (accordo sindacale/ispettorato)", cioè ha ricopiato le alternative.
Il prompt di risposta dichiarava le informazioni dell'utente "fatti accertati" e il modello ha
scritto "L'aver già attivato la procedura con accordo sindacale o autorizzazione dell'Ispettorato
soddisfa la condizione di liceità". In più la risposta citava solo il GDPR (7 citazioni) con
affidabilità "high", mentre la L. 300/1970, nominata nella domanda, non è nel corpus.

## Modifiche e motivazione

Tre cause, tre correzioni, tutte in `rag-query`:

1. Fatti non affermati. `facts.ts` con `isAmbiguousAnswer`: una risposta dell'intake che elenca
   alternative (con "/" o "o") e le cui parole stanno già nella domanda viene marcata "RISPOSTA
   AMBIGUA" nel blocco delle informazioni fornite; il prompt non le chiama più "fatti accertati"
   e vieta "avendo già attivato/stipulato", imponendo di esporre i due casi e chiudere con una
   sola domanda di conferma.
2. Fonti nominate ma assenti. Mappa `NAMED_SOURCES` (L. 300/1970, D.Lgs. 81/2008, L. 633/1941,
   D.L. 105/2019): se la conversazione le nomina, la ricerca strutturata non ha trovato nulla e
   il corpus non ha chunk con quel codice, il prompt riceve "FONTE NON DISPONIBILE", la risposta
   termina con una nota che lo dice e l'affidabilità non può essere "high".
3. Intake. Una domanda per fatto, niente esempi tra parentesi copiabili come risposta, le
   alternative in `options`, le domande "già fatto o no" formulate per un sì o un no.

## Verifiche ed esiti

- `deployment/rag-facts.test.mjs`: 4 test (risposta che ricopia le opzioni, risposte esplicite,
  risposte secche a domanda chiusa, risposta vuota); `npm run test:backend` 40 verdi.
- `deno check` di `rag-query/index.ts` pulito (con stub locale di `std/http/server.ts`, che il
  proxy non raggiunge).
- Non ancora riprovata in produzione la conversazione del feedback: da fare dopo il rilascio.

## Rischi e limiti

- La L. 300/1970 resta assente: Normattiva non è raggiungibile né dal cloud né dal computer di
  Matteo con questi permessi di rete; serve l'esportazione manuale (RAG-10). Fino ad allora la
  chat dichiara la mancanza invece di inventare.
- La regola di ambiguità è stretta per non marcare risposte legittime ("Sì", "45"): una risposta
  che risponde a una sola delle due domande accorpate non viene rilevata; per questo l'intake
  ora chiede un fatto per domanda.
- La mappa delle fonti nominate è manuale: va estesa quando si aggiungono leggi al corpus.

## Prossimo passo

Come CHAT-01: caricare la L. 300/1970, riprovare la conversazione del feedback in produzione,
trasformare i pollici giù in casi di regressione.
