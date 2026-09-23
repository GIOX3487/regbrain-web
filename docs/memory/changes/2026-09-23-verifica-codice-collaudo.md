---
date: 2026-09-23
author: Matteo Piccirilli, agente Claude (Fable 5.1)
roadmap_ids: ["CODE-01"]
state_review: updated
state_reason: Il collaudo completo (regole su Juice Shop, livello AI in produzione, referto PDF) ha trovato e corretto sette difetti; lo stato deve riportare le misure e i limiti che restano.
roadmap_review: updated
roadmap_reason: CODE-01 aggiornato con il collaudo e le regole su più righe; il prossimo passo non cambia.
files: ["supabase/functions/code-compliance/rules.ts", "supabase/functions/code-compliance/scan.ts", "supabase/functions/code-compliance/markup.ts", "supabase/functions/code-compliance/index.ts", "src/lib/code-check-report.ts", "src/pages/CodeCheck.tsx", "deployment/code-rules.test.mjs", "deployment/code-rules-cases/api.js", "deployment/code-rules-cases/token.js", "deployment/code-rules-cases/modelli.py", "deployment/code-rules-cases/schema.sql", "deployment/code-rules-cases/es_ES.json", "roadmap.md", "docs/memory/STATE.md"]
---

## Richiesta e contesto

Matteo ha chiesto di verificare se la verifica del codice è accurata, precisa e professionale o se
servono correzioni. Collaudo su tre livelli: tutte le 38 regole su Juice Shop (le cui
vulnerabilità sono documentate), il livello AI in produzione su un progetto sanitario di 8 file
costruito con 17 problemi noti, il referto PDF generato dal risultato reale.

## Modifiche e motivazione

Difetti trovati e corretti:

1. File di traduzione (i18n, `es_ES.json` e simili) trattati come codice: chiavi come
   `LABEL_TWO_FACTOR_AUTH_TOKEN` scattavano come segreti, la parola spagnola "Imagen" come
   modello di IA, i link nei testi come connessioni in chiaro. Ora `TEXT_FILE` li esclude dalla
   scansione; `imagen` scatta solo come nome di modello.
2. SEC-03 contava immagini e font `http://` e i collegamenti cliccabili `<a href>`: nessuno
   dei due trasporta dati dell'utente; esclusi. `.example` e `.invalid` fra gli host di prova.
3. PRIV-08 segnalava `IP_ADDRESS` come testo di un'etichetta dell'interfaccia: escluso il testo
   fra due tag.
4. SEC-06 non vedeva i punti di inserimento HTML dei framework: aggiunti `[innerHTML]`,
   `v-html`, `{@html}`, `bypassSecurityTrust*`, `insertAdjacentHTML`, `innerHTML +=`. Su
   Juice Shop trova ora i due XSS documentati (commenti del feedback, email utente).
5. SEC-13 non vedeva `params.file` senza `req.`: aggiunto per i nomi che indicano un file. Su
   Juice Shop passa da 2 a 5 esiti, tutti veri (i tre server di file).
6. SEC-11 lavorava su una riga: `jwt.decode` assegnato e `claims.ruolo` letto sulla riga dopo
   sfuggiva (lo aveva trovato solo il livello AI). Regola sul file intero `decodedTokenTrusted`.
7. PRIV-05 non vedeva le colonne SQL (`diagnosi_precedente text`) né la destrutturazione
   (`{ diagnosi_precedente } = req.body`): aggiunte le due forme.
8. Referto: fonti duplicate quando due estratti hanno la stessa etichetta, suffisso "(parte 1)"
   nelle citazioni degli allegati; corretti in funzione, pagina e PDF.

`RULES_VERSION` 2026-09-23.3.

## Verifiche ed esiti

- Livello AI in produzione (gemini-3.8-flash, 29,6 s per 8 file): 15 esiti delle regole tutti
  confermati con nota specifica al codice e azione concreta (per esempio "rimuovere
  defaultChecked"); 3 esiti aggiuntivi del modello tutti veri, uno dei quali (password mai
  confrontata al login) è un difetto che nessuna regola può vedere; 5 domande pertinenti (DPA
  con OpenAI, DPIA, controllo dei permessi sui referti, finalità della posizione, informativa);
  sintesi corretta; 36 fonti citate tutte esistenti nel corpus.
- Referto PDF di 14 pagine generato dal risultato reale con jsPDF in Node: intestazione,
  contesto dichiarato e dedotto, elenco file con impronte, riepilogo e schede complete.
- Juice Shop dopo le correzioni: SEC-03 da 136 a 34 occorrenze (restano configurazioni e file di
  prova), SEC-01 138 di cui 127 in file di prova o dati di seed (rischio abbassato), AI-02 da
  4 falsi a 0, SEC-13 da 2 a 5 veri, SEC-06 con i due XSS documentati.
- Banco di prova 41 test verdi; `tsc`, `vite build`, `deno check` puliti. Utente e funzione
  temporanei rimossi (0 residui).

## Rischi e limiti

- Le regole restano sintattiche: non seguono il flusso fra funzioni o file. Il livello AI
  copre parte del vuoto (ha trovato la password non verificata) ma non è ripetibile al 100%.
- I file di prova pesano sui conteggi: 138 esiti SEC-01 in Juice Shop sono credenziali di test.
  Il referto li marca e abbassa il rischio, ma un lettore frettoloso vede il numero.
- Il tempo del livello AI cresce con gli estratti (tetto 60.000 caratteri): su 800 file
  aspettarsi 30-60 secondi.

## Prossimo passo

Come CODE-01: prova con Giovanni su un repository vero.
