---
date: 2026-09-18
author: Giovanni con Codex
roadmap_ids: ["GAP-01"]
state_review: updated
state_reason: Diagnosi reale del provider e verifica del comportamento in staging.
roadmap_review: updated
roadmap_reason: Ambiente staging disponibile; collaudo di accuratezza bloccato dall'indisponibilità IA.
files: ["supabase/functions/gap-analysis/index.ts", "supabase/functions/_shared/gap-ai-batch.ts", "src/pages/NewAssessment.tsx", "src/pages/AssessmentDetail.tsx", "deployment/gap-ai-batch.test.mjs", "package.json", "src/lib/engine-version.ts", "docs/memory/STATE.md", "roadmap.md"]
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
- Versione risultati finale v26 dopo la riconciliazione con main v25, per non riusare cache prodotte dal vecchio fallback. Le analisi incomplete di versioni precedenti richiedono riavvio controllato al rilascio.
- Test inclusi nel comando backend già usato dalla CI. Nessun nuovo blocco per la memoria o il deploy.

## Verifiche ed esiti

Aggiornamento 19 settembre: la CI applicativa GitHub del commit c791f04 è verde (controlli Edge, test backend, TypeScript e build). Il controllo memoria aveva rilevato il registro stesso nel campo files: rimossa l'autocitazione. Il validatore locale della memoria passa dopo la correzione. Tre richieste diagnostiche brevi oggi rispondono 200, ma due tentativi separati di ripresa dell'analisi reale ricevono ancora 503 overloaded; la disponibilità resta intermittente. La lettura SQL conferma 12 esclusioni conservate, 39 requisiti pendenti e conformità null. Non risultano esecuzioni CI associate al successivo commit solo documentale 9d49f4b tramite il connettore.

- 7 test del nuovo modulo passati: concorrenza, ordine, arresto coda, attesa chiamate attive, timeout/503/429, ID/stati incompleti, risposta sicura e ripresa simulata.
- 18 test esistenti del candidato staging passati su evidenze, cache, fonti e applicabilità.
- Controlli sintattici TypeScript sulle due varianti della funzione, helper e due schermate passati.
- Staging `brdmsjoowawnvhvgendl`: gap-analysis v7 attiva, sopra la base riconciliata v6 (PR #3 e correzione applicabilità PR #6). Questo candidato staging non include ancora la nuova classificazione della PR #9; la proposta GitHub invece parte dalla PR #9.
- Prova reale con gli stessi otto documenti sintetici mixed del 17 settembre: HTTP 503, reason overloaded dopo circa 65 secondi; stato DB in_progress, 12 esclusioni dichiarate conservate, 39 requisiti pendenti, zero fallback keyword, conformità null. Il test ha verificato questi valori tramite API e lettura SQL.
- Nessuna migrazione e nessun deploy in produzione effettuati in questa sessione.

## Candidato successivo preparato il 19 settembre

Preparato localmente l'allineamento della base staging v7 con PR #9: miglioramenti facoltativi separati dalle carenze obbligatorie, gravità proporzionata alle carenze, rischio normalizzato. Le protezioni sulle citazioni restano attive. Passano 21 test su evidenze, applicabilità e classificazione, oltre ai controlli sintattici. Il candidato non è distribuito e non fa parte del codice di questa PR: cambierebbe la versione dei risultati, impedendo di usare l'analisi v7 pendente come prova di ripresa. Prima completare quella prova; poi distribuire il candidato riconciliato e avviare nuove analisi con le etichette attese già congelate.

## Collaudo interfaccia e diagnosi aggiuntiva del 19 settembre

Un'ulteriore ripresa reale riceve 503. Tre richieste brevi riescono; una richiesta rappresentativa su tre requisiti sintetici riceve 503 sia da generateContent sia dall'API compatibile OpenAI. Anche la variante con un solo requisito riceve 503. Questo non indica un guasto esclusivo dell'adattatore e non fornisce una misura di accuratezza.

Il collaudo browser ha riprodotto un difetto: dopo l'interruzione la pagina mostrava ancora “analisi in corso” e “nessun rischio rilevato”. Corretti:
- avviso persistente di pausa, avanzamento conservato e pulsante di ripresa;
- pausa ricordata per analisi nella sessione della scheda, anche dopo riapertura; lo stato di navigazione viene consumato una sola volta;
- nessun riepilogo di rischio conclusivo, zero gap definitivo o esportazione PDF durante l'analisi incompleta;
- messaggio esplicito se la sessione di accesso è scaduta;
- alla ripresa riuscita si rimuove la pausa; al completamento il PDF torna disponibile.

Verificato nel browser integrato con il componente applicativo reale e API/autenticazione simulate solo su localhost: errore 503, conservazione 12/51, riapertura senza nuove chiamate automatiche, ripresa manuale riuscita, scomparsa dell'avviso e riabilitazione PDF. TypeScript del frontend verificato localmente. Il valore 80% del caso UI è un dato simulato e non è una misurazione di accuratezza o un risultato dello staging. La prova non certifica il flusso hosted completo né l'autenticazione reale.

La funzione diagnostica staging-payload-check è limitata allo staging e agli account con app_metadata.staging_test; usa un payload sintetico fisso e non restituisce chiavi. Nessun cambio del modello e nessuna modifica della produzione.

## Allineamento con il lavoro parallelo del socio

Prima dell'aggiornamento finale è stato letto il vero ref main, ora 0f6e9c4f60e5384e87cc5f0ee900e3b912ea95cd. I metadati della PR riportavano ancora la base precedente; main nel frattempo aveva integrato PR #11–#15. Eseguita riconciliazione a tre vie: preservati base di calcolo, citazioni condivise, avvisi sulla qualità, azzeramento delle carenze per applicabilità incerta, caricamento multiplo e pulizia chat. Sostituito il ramo di quattro tentativi/fallback con l'interruzione riprendibile già verificata; le metriche sui metodi restano compatibili con gli esiti storici. Versione risultati v26. Il candidato staging v7 non è sostituito da questa riconciliazione.

Dopo la riconciliazione: 26 test backend superati, 28 file Edge controllati senza errori sintattici, TypeScript frontend e build superati localmente. Restano gli avvisi preesistenti sulle dimensioni dei bundle e sulle dipendenze.

Il registro del socio del 19 settembre riferisce prove di carico riuscite in produzione e una severità eccessiva del catalogo sul fascicolo Infoteam (GAP-07/GAP-09). Sono misure riferite dal socio, non riprodotte in questa sessione; il problema di disponibilità osservato qui riguarda lo staging. La priorità sulla qualità del giudizio resta distinguere obblighi minimi da documentazione ideale con una revisione del catalogo. Né conformità né riproducibilità equivalgono ad accuratezza.

## Aggiornamento del 20 settembre

Prima di pubblicare la riconciliazione il ref main è avanzato ancora a 0dfc984 (PR #16–#22). Integrati anche spiegazioni delle metriche, testi della nuova analisi, rimozione del Gap Report duplicato e supporto al timeout specifico per generazione documenti. Preservate le modifiche alla homepage e tutti i registri del socio. Le spiegazioni del rischio conclusivo restano nascoste durante un'analisi incompleta. Il motore di gap analysis su main non è cambiato in questo secondo allineamento.

## Rischi e limiti

La continuità tecnica è migliorata, ma l'accuratezza non è stata rivalutata: il provider resta sovraccarico. Il benchmark del 17 settembre (36–39 fallback per scenario) non misura adeguatamente la correttezza dei giudizi. I controlli di sicurezza passati grazie al fallback non dimostrano capacità di riconoscere contraddizioni. I test locali non sostituiscono un test browser completo. La variante su main usa ancora la persistenza precedente alla PR #3: riconciliare prima del rilascio combinato.

## Prossimo passo

GAP-01: quando il modello torna disponibile, riprendere il test salvato e rieseguire il corpus; allineare anche PR #9 nel candidato staging per valutare l'ultima classificazione. Poi completare il flusso browser e il rilascio della PR #3 con la relativa migrazione. Questa proposta resta separata e non integra automaticamente altre PR.

## Riconciliazione con PR #23 e #24 (20 settembre)

Base main 6172ce0. Conservati il recupero di evidenze da più documenti, le dichiarazioni di applicabilità, il congelamento degli esiti e la cronologia con rifacimento esplicito. Versione candidata v27, allineata anche nel frontend. Il riuso delle analisi precedenti resta quello scelto nella PR #24: la versione nuova non le ricalcola automaticamente e non certifica i loro vecchi risultati.

Anche il rifacimento esplicito gestisce AI_ANALYSIS_UNAVAILABLE, ricarica l'avanzamento salvato e impedisce riprese automatiche concorrenti; il messaggio di successo richiede status completed. Sessione scaduta segnalata esplicitamente.

Nuova prova reale staging: richieste brevi 200/503/200; benchmark completo interrotto da 503 overloaded. Database verificato: 12 elaborati, 39 pendenti, conformità null. Nessun rilascio in produzione; serve ancora candidato combinato con PR #3 e collaudo completo.
