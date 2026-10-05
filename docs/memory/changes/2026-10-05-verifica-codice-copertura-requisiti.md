---
date: 2026-10-05
author: Matteo Piccirilli, agente Claude (Fable 5.1)
roadmap_ids: ["CODE-01"]
state_review: updated
state_reason: La verifica del codice cambia natura: da elenco di esiti a copertura dei requisiti con analisi strutturali fra i file; lo stato deve descrivere i tre livelli, la mascheratura e i limiti misurati.
roadmap_review: updated
roadmap_reason: CODE-01 registra la revisione esterna del 5 ottobre, cosa è stato fatto delle sue quattro raccomandazioni e il nuovo prossimo passo (copertura e analisi fra file, non più regole in più).
files: ["supabase/functions/code-compliance/secrets.ts", "supabase/functions/code-compliance/consent.ts", "supabase/functions/code-compliance/routes.ts", "supabase/functions/code-compliance/requirements.ts", "supabase/functions/code-compliance/rules.ts", "supabase/functions/code-compliance/scan.ts", "supabase/functions/code-compliance/excerpts.ts", "supabase/functions/code-compliance/index.ts", "src/lib/code-check/local-scan.ts", "src/lib/code-check-report.ts", "src/pages/CodeCheck.tsx", "src/pages/Landing.tsx", "deployment/code-secrets.test.mjs", "deployment/code-structure.test.mjs", "deployment/code-requirements.test.mjs", "deployment/code-rules-cases/api.js", "deployment/code-rules-cases/consenso-commento.js", "deployment/code-rules-cases/consenso-protetto.html", "deployment/code-rules-cases/rotte.js", "deployment/code-rules-cases/rotte_globale.py", "deployment/code-rules-cases/rotte_flask.py", "deployment/code-rules-cases/segreti.yml", "package.json", "roadmap.md", "docs/memory/STATE.md"]
---

## Richiesta e contesto

Revisione esterna del codice della verifica (5 ottobre): "buona prima versione, utile per
individuare problemi e orientare le correzioni, ma poco profonda per valutare il rispetto
completo di una linea guida". Quattro punti: (1) i controlli riconoscono pattern, non il
comportamento dell'applicazione fra più file; un commento che annuncia un gestore del consenso
ancora da scrivere bastava a farlo risultare presente; (2) il modello vede estratti entro
60.000 caratteri; (3) il flusso è "trovo un problema, cito le fonti", mentre dovrebbe essere
"prendo la linea guida, individuo i controlli applicabili, verifico ciascuno, mostro esiti,
evidenze e parti non valutabili"; (4) la mascheratura dei segreti va sistemata prima di
proporla commercialmente, e va proposta come prima revisione automatica con riferimenti e
suggerimenti, non come verifica completa della conformità. Matteo ha chiesto di implementare
il commento.

## Modifiche e motivazione

- `secrets.ts` (nuovo): un'unica mascheratura per righe citate, estratti e prove, nel browser
  e nella funzione. Indipendente dal rilevamento: valori assegnati a nomi da segreto anche
  senza cifre, valori senza virgolette nei file di configurazione, credenziali negli URL,
  token negli header di autenticazione, corpo delle chiavi private; i riferimenti
  (`process.env.X`, `${X}`) restano leggibili. Del valore non resta nulla: prima restavano i
  primi 3-4 caratteri. SEC-01 ora scatta anche su `password: hunter2x1` in un file yaml.
- `consent.ts` (nuovo): un gestore del consenso conta solo in una riga di codice, non in
  commenti, promemoria o testi; per ogni tracker si verifica che il punto di avvio sia protetto
  (tag script disattivato dal CMP, controllo del consenso nelle 30 righe precedenti, Consent
  Mode di Google a "denied"). I tracker protetti escono dagli esiti ed entrano fra le prove.
  `gtag('consent', ...)` non è più contato come tracciamento.
- `routes.ts` (nuovo): censimento delle rotte HTTP (Express, Fastify, NestJS, Flask, FastAPI,
  Django, Spring, ASP.NET, Go, Laravel) e ricerca del controllo di autorizzazione sulla rotta,
  nei decoratori, nel corpo, in un middleware globale con prefisso dichiarato prima nello
  stesso file, nel gestore definito in un altro file (controller, views.py), nel guard di
  classe o di applicazione. Rotte pubbliche per natura (login, salute, risorse statiche, file
  di autenticazione) escluse; dichiarazioni ripetute della stessa rotta unite. Nuovo esito
  SEC-16 "Endpoint senza controllo di autorizzazione riconoscibile", sempre "da verificare".
- `requirements.ts` (nuovo): 45 requisiti in otto linee guida (GDPR, ePrivacy e cookie,
  sicurezza del software, NIS2, AI Act, accessibilità, licenze, settore), ciascuno con fonti
  del RAG, metodo (regole, strutturale, manuale), applicabilità dal contesto e dai file, e uno
  di cinque esiti: problemi trovati, superato con prova, nessun esito dalle regole (assenza
  dei difetti noti, dichiarata come tale), non valutabile dal codice con cosa verificare, non
  applicabile con il motivo. Ogni regola è collegata ad almeno un requisito (test).
- `excerpts.ts`, `index.ts`: estratti fino a 180.000 caratteri in tre lotti paralleli al
  modello; ogni lotto giudica solo gli esiti che vede, aggiunge al massimo 4 problemi con riga
  verificabile e osservazioni sui requisiti non valutabili solo con file e riga presenti negli
  estratti; i risultati si uniscono senza duplicati. Il referto dichiara quanti file ha letto
  il modello e quali no (`coverage`). Il server ricostruisce SEC-16 dalle prove inviate dal
  browser, non dal testo del client.
- Pagina, referto PDF e homepage: "revisione automatica del codice con riferimenti normativi,
  non una certificazione di conformità"; sezione "Copertura dei requisiti" per linea guida con
  esito, metodo, note, prove e osservazioni del modello; elenco dei file letti solo dalle
  regole. `RULES_VERSION = 2026-10-05.1`.

## Verifiche ed esiti

- 62 test backend verdi: banco delle regole con 6 casi nuovi (commento sul consenso, tracker
  protetti, rotte Express con e senza controllo, FastAPI con dipendenza globale, Flask con
  decoratore, segreti yaml); `code-secrets` (nessun valore né prefisso resta in esiti ed
  estratti); `code-structure` (consenso, rotte, cross-file); `code-requirements` (coerenza
  del catalogo, applicabilità, cinque esiti, falso positivo che toglie l'esito).
- `deno check`, `tsc`, `vite build` puliti.
- Repository reali, dopo le correzioni emerse strada facendo (frammenti di Juice Shop in
  `data/static/codefixes` esclusi; `app.get('view engine')` non è una rotta; backreference
  sbagliata nel prefisso dei middleware globali; `security.denyAll()` e decoratori con "auth"
  nel nome riconosciuti): Juice Shop 109 rotte, 33 con controllo, 7 pubbliche, 69 da
  verificare (app volutamente vulnerabile; fra le scoperte `/file-upload`, `/profile/image`,
  `/rest/memories`, che lo sono davvero); NodeGoat 19 rotte, 1 da verificare; PyGoat 136
  rotte, 94 con controllo (il decoratore `authentication_decorator` risolto in views.py), 31
  da verificare; RealWorld Express 8 rotte, 0 scoperte, requisito superato. Scansione completa
  di Juice Shop (948 file) in 1,4 secondi.
- Collaudo in produzione da fare dopo il rilascio (prova end-to-end con il campione sanitario).

## Rischi e limiti

- L'analisi delle rotte è euristica: un controllo fatto in modo non riconosciuto finisce fra i
  "da verificare" (mai fra i superati). Framework non censiti (Rails, Phoenix, Ktor) non
  producono rotte e il requisito risulta non valutabile.
- "Nessun esito dalle regole" è assenza dei difetti noti, non prova di conformità: il referto
  lo scrive accanto a ogni requisito.
- Il modello legge fino a 180.000 caratteri: su basi di codice grandi resta una parte non
  letta, dichiarata nel referto con l'elenco dei file.
- Il costo per revisione sale fino a tre chiamate al modello (circa 0,15-0,35 € a prezzi 2027).

## Prossimo passo

Collaudo in produzione; poi copertura dei requisiti con prove positive anche per i requisiti
oggi "nessun esito" (per esempio cifratura in transito provata dalla configurazione TLS) e
analisi fra file del flusso dei dati personali (dove entrano, dove vengono scritti, a chi
vengono inviati), prima di aggiungere altre regole per riga.
