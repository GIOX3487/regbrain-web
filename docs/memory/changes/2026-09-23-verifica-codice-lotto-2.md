---
date: 2026-09-23
author: Matteo Piccirilli, agente Claude (Fable 5.1)
roadmap_ids: ["CODE-01"]
state_review: updated
state_reason: La verifica del codice acquisisce regole sul file intero e un lettore di tag; cambia il numero di regole e il perimetro dell'accessibilità.
roadmap_review: updated
roadmap_reason: CODE-01 aggiornato a 38 regole con le misure; il lotto 2 è chiuso, restano la prova con Giovanni, il client per la CI e i pollici.
files: ["supabase/functions/code-compliance/markup.ts", "supabase/functions/code-compliance/rules.ts", "supabase/functions/code-compliance/scan.ts", "deployment/code-rules.test.mjs", "deployment/code-rules-cases/accessibilita.jsx", "deployment/code-rules-cases/stile.css", "deployment/code-rules-cases/percorso.js", "deployment/code-rules-cases/consenso.jsx", "deployment/code-rules-cases/pagina.html", "src/pages/CodeCheck.tsx", "src/pages/Landing.tsx", "roadmap.md", "docs/memory/STATE.md"]
---

## Richiesta e contesto

Seconda parte della richiesta di Matteo sulle normative mancanti nella verifica del codice: le
regole di accessibilità che non si possono scrivere per riga (un tag JSX occupa più righe,
l'etichetta di un campo sta altrove nel file) e le regole su più righe (un valore della
richiesta assegnato a una variabile e usato in un percorso di file più in basso).

## Modifiche e motivazione

- `markup.ts`: lettore di tag di apertura con attributi (virgolette e graffe JSX comprese),
  testo interno fino alla chiusura, riga di ogni tag; cache per contenuto perché sette regole
  leggono lo stesso file. Non è un parser completo: dove non è sicuro tace (componenti con
  iniziale maiuscola, id dinamici, `{...props}`, template con il titolo nel layout).
- Sette regole sul file intero in `FILE_RULES`, eseguite da `scan.ts` dopo quelle per riga
  (stesso raggruppamento per regola, stessa riduzione di rischio nei file di prova, nessun
  doppione con la regola per riga): ACC-03 campo senza etichetta (label for, label che avvolge,
  aria-label, aria-labelledby, title, Angular Material con mat-label), ACC-04 pulsante o link
  senza nome e `<a>` senza href usato come pulsante, ACC-05 outline: none su :focus senza
  alternativa (scansione lineare dei blocchi CSS e classi Tailwind focus:outline-none), ACC-06
  documento senza title, ACC-07 autoplay senza controlli, ACC-08 div/span cliccabili senza ruolo
  né tastiera e tabindex positivo, SEC-13 path traversal su più righe (assegnazione dalla
  richiesta e uso entro dieci righe senza normalizzazione).
- SEC-15 regola sulle password: lunghezza minima sotto 8 o massima sotto 64 (ASVS V6.2), esclusi
  PIN, OTP, moduli di accesso e `min(1)` che significa "obbligatorio".
- PRIV-01: quando in tutta la base di codice non c'è un gestore del consenso, lo dice.
- 12 criteri WCAG 2.2 e ASVS V6.2 fra i riferimenti; banco di prova con annotazioni anche nei
  file CSS; `RULES_VERSION` 2026-09-23.2.

## Verifiche ed esiti

- Banco di prova: 4 file nuovi (accessibilita.jsx, stile.css, percorso.js, e i casi di
  consenso.jsx e pagina.html rimarcati con gli esiti di accessibilità che ora scattano a
  ragione); `npm run test:backend` 40 verdi; `tsc`, `vite build`, `deno check` puliti.
- Misura sui repository reali: Juice Shop 12 campi senza etichetta, 17 pulsanti solo icona,
  3 regole password deboli (una è la sfida del gioco), 2 path traversal di cui uno su più righe;
  NodeGoat 9 campi e 12 pulsanti "×" senza nome; PyGoat 84 campi, 7 navbar-toggler, 1 focus
  rimosso, 2 path traversal su più righe; le due app RealWorld nessun esito; RegBrain 8 campi
  nativi senza etichetta, 2 pulsanti icona, 3 div cliccabili, 1 regola password (`.min(1)` prima
  della correzione).
- Falsi positivi trovati e corretti prima del rilascio: componenti con iniziale maiuscola
  (`<Input>`, `<Select>`, `<Button>`) trattati come elementi nativi; Angular Material con
  mat-label; fogli di stile di terze parti (Bootstrap); `min(1)` usato come "obbligatorio";
  modulo di accesso con lunghezza minima 1; variabile già normalizzata (`path.basename`) prima
  dell'uso.
- Tempo: la prima versione della regola sul focus impiegava 4 secondi sui 241 file di RegBrain
  per una espressione regolare con backtracking; riscritta come scansione lineare dei blocchi
  la scansione intera sta in un secondo (2,5 secondi per i 934 file di Juice Shop).

## Rischi e limiti

- Il lettore di tag non risolve i componenti: un `<Input>` di shadcn senza etichetta non viene
  segnalato, e un `<input>` etichettato da un componente esterno può esserlo se l'id è statico e
  la label sta in un altro file.
- ACC-04 giudica il testo interno entro 1.500 caratteri: pulsanti con contenuto più lungo o
  costruito da funzioni non riconosciute (`t()`, i18n sono riconosciute) possono sfuggire o
  scattare.
- SEC-13 su più righe guarda dieci righe e non segue le funzioni.

## Prossimo passo

Come CODE-01: prova con Giovanni su un repository vero; client da riga di comando per la CI.
