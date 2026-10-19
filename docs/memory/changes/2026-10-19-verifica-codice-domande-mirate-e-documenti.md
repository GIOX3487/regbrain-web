---
date: 2026-10-19
author: Matteo Piccirilli, agente Claude (Fable 5.1)
roadmap_ids: ["CODE-01", "OPS-01"]
state_review: updated
state_reason: Nuova sezione sulla verifica del codice con domande mirate, affidabilità degli esiti e documenti generati dalla verifica; aggiornata la nota sul workflow Supabase.
roadmap_review: updated
roadmap_reason: CODE-01 registra le tre migliorie e il collaudo da fare; OPS-01 registra il nuovo motivo di ritentativo del deploy.
files: ["supabase/functions/code-compliance/questions.ts","supabase/functions/code-compliance/requirements.ts","supabase/functions/code-compliance/rules.ts","supabase/functions/code-compliance/scan.ts","supabase/functions/code-compliance/index.ts","supabase/functions/generate-audit-document/index.ts","src/lib/code-check-report.ts","src/lib/code-check/local-scan.ts","src/pages/CodeCheck.tsx","deployment/code-questions.test.mjs","deployment/code-notebook.test.mjs","package.json",".github/workflows/supabase-deploy.yml","docs/memory/STATE.md","roadmap.md"]
---

## Richiesta e contesto

Segnalazione riferita dal socio: la verifica del codice «non riesce a creare documenti legali»,
«risulta troppo imprecisa nella valutazione» e «non fa abbastanza domande efficaci e utili per
migliorare l'accuratezza dell'analisi». Richiesta: migliorare i tre punti in modo professionale.
Base ispezionata: main b7136e5. Seguito di CODE-01 (registri del 5 e dell'8 ottobre). In
produzione code-compliance è alla versione 9 con il caricatore provvisorio da `_code_bundle`,
perché il run Supabase del 6 ottobre (37430868691) era fallito per dieci funzioni con
«unexpected list functions status 401: Unauthorized» a token valido, errore passeggero dell'API.

## Modifiche e motivazione

Domande mirate (`questions.ts`, modulo condiviso fra browser e servizio). Un catalogo di 22
domande nasce dalle prove trovate: ogni domanda ha una condizione che cita il file e la riga che
la motiva (es. tracker senza gestore del consenso in index.html:1), un «perché», risposte a scelta
singola o multipla con sempre «Non so», oppure testo libero. Le risposte hanno effetti scritti:
ricalibrano gli esiti delle regole (rischio, stato, con la motivazione in `adjustment`, mai la
cancellazione) e danno ai requisiti non valutabili dal codice un esito «dichiarato dall'utente»;
una risposta che ammette un problema produce «esiti» su base dichiarazione. Il codice vince dove
decide: solo quattro requisiti ammettono che la dichiarazione prevalga su una prova nel codice
(gateway esterno, rete interna, valori di prova, gestore del consenso fuori dal codice) e la nota
conserva sempre ciò che il codice aveva trovato. La pagina mostra fino a 10 domande prima della
verifica, scelte dalla scansione locale, e fino a 6 dopo, più quelle del modello, che riceve le
domande già poste e non le ripete. Le risposte viaggiano con il contesto e vengono salvate nel
referto.

Precisione. Ogni esito ha un'affidabilità (alta, media, bassa) che nasce dalla regola e dalla
singola occorrenza: SEC-01 è alta per i formati noti di token e media per assegnazioni generiche;
le regole euristiche (ASVS su hash e sessioni, dati sensibili, log, accessibilità dedotta) sono
medie o basse; nei file di test scende di un livello; SEC-16 è media; gli esiti del modello sono
bassi. Gli esiti sono ordinati per rischio e affidabilità e il modello riceve affidabilità,
rettifiche e dichiarazioni, con la regola di non confermare con sicurezza ciò che è basso o
dichiarato. Il referto PDF riporta affidabilità, rettifiche, dichiarazioni e sei esiti dei
requisiti. RULES_VERSION 2026-10-19.1: pagina e servizio devono essere rilasciati insieme.

Documenti dalla verifica. `generate-audit-document` accetta `source: "code_check"` con
`codeCheckId`: legge la verifica con il client dell'utente (RLS), costruisce la valutazione da esiti
e requisiti (lacune con riferimento, stato attuale file:riga, rischio, priorità, sforzo, prove;
copertura dei requisiti con le dichiarazioni annotate) e un riassunto delle fonti al posto dei
documenti dell'utente; il prompt distingue fatti nel codice, «nessun esito» che non è conformità,
dichiarazioni e segnaposto da completare. La pagina offre quattro documenti (rapporto delle lacune,
analisi dei rischi art. 24 e 32, DPIA, registro dei trattamenti) e apre la Document Library.

Altro: i notebook `.ipynb` vengono letti come codice (celle numerate) e i file non leggibili
sono elencati come saltati con il motivo; il workflow Supabase ritenta anche su 401, 403, 429 e
5xx passeggeri dell'API, non solo su `toomanyrequests`.

## Verifiche ed esiti

- `deployment/code-questions.test.mjs` (4 test): domande nate dalle prove in ordine di priorità con
  la prova citata; rettifiche con motivazione senza cancellare esiti; requisiti dichiarati, esiti
  per dichiarazione, codice che vince sul banner assente; domande aperte per id e per testo.
- `deployment/code-notebook.test.mjs` (2 test). Suite `test:backend`: 72 test superati.
- TypeScript applicativo superato; Vite build superata con gli avvisi preesistenti sui bundle;
  `deno check` di code-compliance e generate-audit-document superato con gli stub locali;
  sintassi Edge: 40 file, zero errori.
- Non ancora eseguito: collaudo in produzione (domande, rettifiche, generazione dei documenti),
  possibile solo dopo il rilascio congiunto di frontend e funzione.

## Rischi e limiti

Le dichiarazioni dell'utente non sono prove: il referto le marca come tali e i documenti generati
le riportano come dichiarazioni. L'affidabilità è una stima della regola, non una misura su un
corpus etichettato. I documenti generati dal codice hanno segnaposto dove il codice non può dire
nulla (titolare, basi giuridiche, destinatari) e vanno completati. La versione delle regole cambia:
finché il deploy Supabase non riesce dai sorgenti, la pagina pubblicata darà «Verifica non
riuscita» per versione diversa, come il 6 ottobre. Il caricatore provvisorio v9 e la tabella
`_code_bundle` restano finché il deploy dai sorgenti non è verificato.

## Prossimo passo

Integrare la PR; verificare che il run Supabase pubblichi code-compliance dai sorgenti (versione
oltre la 9, regole 2026-10-19.1) e il frontend su Vercel; poi eliminare la tabella `_code_bundle`
e collaudare in produzione: domande prima e dopo la verifica, rettifica di un esito, generazione
del rapporto delle lacune aperto nella Document Library. Seguiti CODE-01: prove positive per i
requisiti «nessun esito», flusso dei dati fra file, client da riga di comando, pollici sugli esiti.
