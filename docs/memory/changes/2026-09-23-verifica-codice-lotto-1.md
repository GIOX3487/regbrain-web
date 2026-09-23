---
date: 2026-09-23
author: Matteo Piccirilli, agente Claude (Fable 5.1)
roadmap_ids: ["CODE-01"]
state_review: updated
state_reason: Cambiano numero di regole, fonti collegate e perimetro del livello AI della verifica del codice.
roadmap_review: updated
roadmap_reason: Stato di CODE-01 aggiornato alle 31 regole e alle misure; prossimo passo il lotto 2 (accessibilità con parser, regole multi-file).
files: ["supabase/functions/code-compliance/rules.ts", "supabase/functions/code-compliance/index.ts", "deployment/code-rules-cases/token.js", "deployment/code-rules-cases/sicurezza2.py", "deployment/code-rules-cases/nginx.conf", "deployment/code-rules-cases/consenso.jsx", "deployment/code-rules-cases/mobile.kt", "src/pages/CodeCheck.tsx", "src/pages/Landing.tsx", "roadmap.md", "docs/memory/STATE.md"]
---

## Richiesta e contesto

Matteo ha chiesto di verificare se alla verifica del codice manca qualche normativa per individuare
i gap in modo preciso e di procedere con le integrazioni (lotto 1). Verifica fatta su tre livelli:
le 41 chiavi normative delle 23 regole risolvono tutte nel corpus; il sottoinsieme del corpus
consultato dal livello AI escludeva fonti già caricate utili per quattro settori (MDR ed EHDS,
DORA RTS e PSD2, Data Act, responsabilità da prodotto, Codice del consumo e contenuti digitali);
mancavano regole su pattern frequenti (token, deserializzazione, file, TLS, consenso preselezionato,
risorse extra UE, fotocamera e contatti, SDK mobili, emozioni e biometria, decisioni su persone).

## Modifiche e motivazione

- `rules.ts`: 8 regole nuove (SEC-11 JWT non verificato, SEC-12 deserializzazione non fidata,
  SEC-13 path traversal, SEC-14 TLS obsoleto, PRIV-09 consenso preselezionato, PRIV-10 risorse
  da server extra UE, PRIV-11 fotocamera/microfono/contatti, AI-03 emozioni e categorizzazione
  biometrica, AI-04 decisioni automatizzate su persone); tracker mobili aggiunti a PRIV-01;
  25 riferimenti normativi nuovi (GDPR art. 7, 8, 22, 28, 35; Codice privacy art. 2-quinquies;
  EDPB 3/2022 sui modelli ingannevoli; AI Act art. 5, 6, 26 e allegato III; ASVS V9.1, V1.5,
  V5.3, V5.4, V12.1; MDR allegato I punto 17; DORA art. 9; PSD2 SCA art. 4; Data Act art. 3;
  CAD art. 64; direttiva 2024/2853 art. 7), tutti verificati nel corpus. `RULES_VERSION`
  2026-09-23.1: le scansioni nel browser fatte con la versione precedente vengono rifiutate.
- `index.ts`: sottoinsieme del corpus per il livello AI esteso a MDR, EHDS, dossier sanitario,
  PSD2, DORA RTS, eIDAS, Data Act, PLD, Codice del consumo e DCD; riferimenti di settore attivati
  dal contesto (sanità, finanza, PA, prodotti connessi, minori, consumatori, IA sui dipendenti).
- Pagine: ambiti e base normativa aggiornati nella pagina della verifica e nella homepage.

## Verifiche ed esiti

- Banco di prova: 5 file nuovi di casi (token.js, sicurezza2.py, nginx.conf, consenso.jsx,
  mobile.kt); `npm run test:backend` 40 verdi; `tsc`, `vite build` e `deno check` puliti.
- Misura su repository reali clonati (Juice Shop, NodeGoat, PyGoat, RealWorld React e Express)
  e su RegBrain: le regole nuove hanno trovato pickle e yaml.load in PyGoat, path traversal in
  Juice Shop (`path.resolve(req.body.layout)`), Google Fonts e YouTube incorporati in quattro
  progetti; nessun esito di AI-03, AI-04, PRIV-09, PRIV-11, SEC-14 dove non doveva esserci.
- Tre falsi positivi trovati e corretti prima del rilascio: `yaml.load` in JavaScript (js-yaml
  è sicuro dalla versione 4: conta solo in Python e Ruby), le direttive Content-Security-Policy
  che ammettono fonts.googleapis.com (non caricano nulla), "candidate" senza contesto di persone
  (`allCandidateChunks` in RegBrain).

## Rischi e limiti

- SEC-13 lavora su una riga: se il nome del file arriva dalla richiesta su una riga e viene usato
  su un'altra (Juice Shop `fileServer.ts`) non viene visto; è il caso delle regole multi-file.
- AI-04 dipende dai nomi delle variabili: codice con nomi generici sfugge, ed è per questo che
  il livello AI riceve anche l'allegato III.
- PRIV-10 segnala anche `rel="preconnect"` verso Google: apre comunque una connessione, ma il
  referto lo mostra come voce separata dal caricamento vero.
- Le fonti di settore sono attivate dal contesto dedotto o dichiarato: se il settore non emerge
  dal codice e l'utente non lo indica, restano fuori.

## Prossimo passo

Lotto 2: regole di accessibilità con un parser HTML/JSX (campi senza etichetta, pulsanti senza
nome, focus rimosso, pagina senza titolo, autoplay) e regole multi-file (tracker senza banner,
nome di file dalla richiesta usato su un'altra riga).
