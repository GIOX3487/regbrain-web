---
date: 2026-09-18
author: Giovanni con Codex
roadmap_ids: ["GAP-01"]
state_review: updated
state_reason: Diagnosi reale del provider e verifica del comportamento in staging.
roadmap_review: updated
roadmap_reason: Ambiente staging disponibile; collaudo di accuratezza bloccato dall'indisponibilità IA.
files: ["supabase/functions/gap-analysis/index.ts", "supabase/functions/_shared/gap-ai-batch.ts", "src/pages/NewAssessment.tsx", "src/pages/AssessmentDetail.tsx", "deployment/gap-ai-batch.test.mjs", "package.json", "docs/memory/STATE.md", "roadmap.md"]
---

## Richiesta e contesto

Proseguire il collaudo della gap analysis e individuare la causa dei numerosi fallback.
Base della proposta: main `6420743b644b8b32a0d4779d65d049d491a462c2`, comprendente PR #9 del socio sulle priorità e sui parziali. Le regole di giudizio di quella PR sono conservate.

Il 18 settembre il provider Gemini configurato nello staging ha restituito HTTP 503 UNAVAILABLE con messaggio di domanda elevata su tre richieste brevi: testo semplice, JSON senza reasoning_effort, JSON con reasoning_effort=low. Una richiesta precedente è scaduta dopo 60 secondi. È la causa verificata dell'interruzione attuale; non prova retroattivamente la causa di tutti i fallback del 17 settembre. Non è dimostrata un'incompatibilità JSON.

## Modifiche e motivazione

- Due richieste concorrenti, gruppi di sei requisiti, nessun ciclo di tre tentativi durante l'indisponibilità. Il primo errore ferma l'accodamento e attende le chiamate già avviate.
- Errori HTTP, timeout e risposte incomplete/non attribuibili agli ID richiesti interrompono il gruppo prima di creare esiti o avanzare la coda. I gruppi salvati restano disponibili alla ripresa.
- Risposta 503 riconoscibile come AI_ANALYSIS_UNAVAILABLE, motivo sintetico, Retry-After, nessun contenuto del provider o segreto nei log. Nessun punteggio finale viene calcolato in questo percorso.
- Le schermate fermano i tentativi automatici su questo errore; resta la ripresa manuale. Il passaggio dalla creazione al dettaglio conserva lo stato di pausa.
- Versione risultati v23 per non riusare cache prodotte dal vecchio fallback. Le analisi v22 incomplete richiedono riavvio controllato al rilascio.
- Test inclusi nel comando backend già usato dalla CI. Nessun nuovo blocco per la memoria o il deploy.

## Verifiche ed esiti

Aggiornamento 19 settembre: la CI applicativa GitHub del commit c791f04 è verde (controlli Edge, test backend, TypeScript e build). Il controllo memoria aveva rilevato il registro stesso nel campo files: rimossa l'autocitazione. Tre richieste diagnostiche brevi oggi rispondono 200, ma la ripresa dell'analisi reale riceve ancora 503 overloaded; la disponibilità resta intermittente.

- 7 test del nuovo modulo passati: concorrenza, ordine, arresto coda, attesa chiamate attive, timeout/503/429, ID/stati incompleti, risposta sicura e ripresa simulata.
- 18 test esistenti del candidato staging passati su evidenze, cache, fonti e applicabilità.
- Controlli sintattici TypeScript sulle due varianti della funzione, helper e due schermate passati.
- Staging `brdmsjoowawnvhvgendl`: gap-analysis v7 attiva, sopra la base riconciliata v6 (PR #3 e correzione applicabilità PR #6). Questo candidato staging non include ancora la nuova classificazione della PR #9; la proposta GitHub invece parte dalla PR #9.
- Prova reale con gli stessi otto documenti sintetici mixed del 17 settembre: HTTP 503, reason overloaded dopo circa 65 secondi; stato DB in_progress, 12 esclusioni dichiarate conservate, 39 requisiti pendenti, zero fallback keyword, conformità null. Il test ha verificato questi valori tramite API e lettura SQL.
- Nessuna migrazione e nessun deploy in produzione effettuati in questa sessione.

## Rischi e limiti

La continuità tecnica è migliorata, ma l'accuratezza non è stata rivalutata: il provider resta sovraccarico. Il benchmark del 17 settembre (36–39 fallback per scenario) non misura adeguatamente la correttezza dei giudizi. I controlli di sicurezza passati grazie al fallback non dimostrano capacità di riconoscere contraddizioni. I test locali non sostituiscono un test browser completo. La variante su main usa ancora la persistenza precedente alla PR #3: riconciliare prima del rilascio combinato.

## Prossimo passo

GAP-01: quando il modello torna disponibile, riprendere il test salvato e rieseguire il corpus; allineare anche PR #9 nel candidato staging per valutare l'ultima classificazione. Poi completare il flusso browser e il rilascio della PR #3 con la relativa migrazione. Questa proposta resta separata e non integra automaticamente altre PR.
