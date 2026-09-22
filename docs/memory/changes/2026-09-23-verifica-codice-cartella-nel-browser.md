---
date: 2026-09-23
author: Matteo Piccirilli, agente Claude (Fable 5.1)
roadmap_ids: ["CODE-01"]
state_review: updated
state_reason: Lo stato diceva che la verifica del codice accetta fino a 40 file inviati al servizio; ora legge una cartella intera nel browser e al servizio arrivano solo esiti ed estratti, e il contesto si deduce dal codice.
roadmap_review: updated
roadmap_reason: Il limite dei 40 file era il primo ostacolo alla prova su un progetto reale; cambia lo stato di CODE-01 e il prossimo passo diventa la prova con Giovanni su un repository vero e il client da riga di comando.
files: ["supabase/functions/code-compliance/index.ts", "supabase/functions/code-compliance/scan.ts", "supabase/functions/code-compliance/infer.ts", "supabase/functions/code-compliance/excerpts.ts", "src/lib/code-check/local-scan.ts", "src/pages/CodeCheck.tsx", "src/lib/code-check-report.ts", "deployment/code-infer.test.mjs", "package.json", "docs/memory/STATE.md", "roadmap.md"]
---

## Richiesta e contesto

Matteo ha provato la verifica del codice su un repository vero: 800 file, e la pagina ne accettava
40, uno per volta. In più chiedeva a mano cose che il codice dice da solo (tipo di software, dati
personali, uso di IA) e permetteva una sola scelta dove ne servono più di una (web e mobile
insieme, consumatori e clienti business insieme). Ha proposto due strade: un programma da
installare, oppure caricare la cartella su una macchina in cloud e analizzare lì.

Valutazione: nessuna delle due serve adesso. Le 23 regole sono TypeScript puro senza dipendenze
dal server, quindi girano nel browser sull'intera base di codice in meno di un secondo (331 file
di RegBrain: 0,5 s di regole, 0,4 s di contesto). Il modello non ha bisogno di tutto il codice,
ma delle righe intorno agli esiti, dei manifest e dei file più pertinenti. Quindi il codice resta
sul computer dell'utente, non c'è limite di file, non serve installare nulla e non serve
conservare codice altrui in cloud, che sarebbe stato il costo e il rischio più alto. Il programma
da riga di comando ha senso dopo, per integrare la verifica nella CI: le regole sono già
condivise, va aggiunto solo il contenitore.

## Modifiche e motivazione

- `src/lib/code-check/local-scan.ts`: lettura di una cartella (selettore o trascinamento), di un
  archivio zip come quello esportato da GitHub, o di file singoli; esclusione automatica di
  node_modules, .git, dist, vendor e simili; fino a 5.000 file di testo; regole, contesto,
  estratti e impronte SHA-256 calcolati nel browser. Le regole sono importate dallo stesso file
  della funzione edge: un solo modulo, nessuna copia.
- `infer.ts`: deduce dal codice tipo di software (da manifest e framework), campi con dati
  personali, servizi di IA, indizi di settore e di destinatari, linguaggi e framework. Ogni
  voce ha file e riga come prova e un grado di fiducia: si preseleziona solo ciò che è sicuro
  (per esempio Stripe nel manifest per la finanza); il resto compare come suggerimento da
  confermare. Settore e destinatari si leggono dagli identificatori, non dai testi: una pagina
  che parla di sanità non rende sanitaria l'applicazione.
- `excerpts.ts`: sei righe intorno a ogni esito, i manifest, poi i file più pertinenti per nome,
  dentro un tetto di 60.000 caratteri, con i segreti mascherati prima di uscire dal browser.
- Funzione edge: accetta il nuovo modo `scan` (esiti, inventario, contesto dedotto, estratti) e
  conserva il vecchio con `files` per il codice incollato. Titolo, spiegazione, azione e fonti di
  ogni esito vengono dalla regola sul server, non dal client; un esito aggiunto dal modello vale
  solo se file e riga stanno negli estratti. Se la pagina ha una versione delle regole diversa
  dal servizio, la verifica si ferma e chiede di ricaricare.
- Contesto a scelta multipla: tipo di software, destinatari e settore sono elenchi; i campi
  singolari restano per le verifiche salvate prima. Nel referto PDF compaiono anche linguaggi,
  framework, dati personali e servizi di IA trovati nel codice.

## Verifiche ed esiti

- Sul repository di RegBrain (331 file, 3,4 milioni di caratteri): regole in 535 ms, contesto in
  361 ms, estratti in 5 ms; 45 estratti per 58.000 caratteri; richiesta al servizio di 133 kB
  invece di 3,4 MB di codice. Dedotti web e backend, React e Supabase, i campi personali e i
  fornitori di IA.
- Test in CI: contesto dedotto con le prove, estratti che coprono ogni esito e rispettano il
  tetto, segreti mascherati, stesso esito a due scansioni.
- `tsc`, build, `check:edge` e `test:backend` senza errori; prova end to end in produzione
  dopo il deploy.

## Rischi e limiti

- Il client potrebbe inviare esiti alterati: è lo stesso utente che verifica il proprio codice,
  e il referto lo dice ("regole eseguite nel browser"). Per un uso a fini di terzi servirà la
  scansione in CI con chiave di servizio.
- Il modello vede gli estratti, non tutto: un problema che sta in un file non citato da nessuna
  regola e non pertinente per nome può sfuggirgli. Le regole invece girano su tutto.
- La lettura di una cartella dipende dalle API del browser: Chrome, Edge e Safari recenti
  leggono le cartelle; su alcuni browser resta lo zip.
- Il contesto dedotto è a indizi: sul codice di RegBrain, che parla di ogni settore, segnala
  come "probabili" settori che non lo riguardano. Per questo non li preseleziona.

## Prossimo passo

Provare con Giovanni su un repository vero di 800 file e contare esiti utili, falsi positivi e
tempi. Poi il client da riga di comando che riusa le stesse regole per la CI (GitHub Actions),
con chiave di servizio e caricamento dell'esito in `code_checks`.
