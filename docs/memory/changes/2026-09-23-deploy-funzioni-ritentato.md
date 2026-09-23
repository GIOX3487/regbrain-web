---
date: 2026-09-23
author: Matteo Piccirilli, agente Claude (Fable 5.1)
roadmap_ids: ["OPS-01"]
state_review: updated
state_reason: Lo stato descrive il workflow di distribuzione delle Edge Functions; deve dire che i deploy vengono ritentati quando il registro delle immagini risponde troppo tardi.
roadmap_review: updated
roadmap_reason: Nuova voce OPS-01 per l'affidabilità della distribuzione, perché nelle ultime tre integrazioni su main il workflow risultava fallito senza che il codice fosse difettoso.
files: [".github/workflows/supabase-deploy.yml", "roadmap.md", "docs/memory/STATE.md"]
---

## Richiesta e contesto

Dopo l'integrazione della PR #51 il workflow `Deploy Supabase Edge Functions` è risultato fallito
per la terza volta di seguito (PR #48, #50, #51). Ogni volta le funzioni fallite erano le prime
della lista (`rag-query`, `ingest-eurlex-formex`, `ingest-web-source`) e l'errore era sempre lo
stesso: `toomanyrequests` da `ghcr.io` mentre la CLI scarica l'immagine `edge-runtime` con cui
impacchetta la funzione. Le funzioni successive riuscivano perché nel frattempo l'immagine era
arrivata in cache. Il codice distribuito era quindi corretto per tutte le funzioni modificate
(`code-compliance` v8 corrisponde alla PR #51), ma il segnale rosso nascondeva errori veri.

## Modifiche e motivazione

`supabase-deploy.yml`: il deploy di ogni funzione passa da una funzione di shell `deploy` che
ritenta fino a quattro volte, con 30 secondi di attesa, soltanto quando il registro delle
immagini risponde `toomanyrequests`. Ogni altro errore resta immediato, come prima. La lista delle
funzioni, l'opzione `--no-verify-jwt` e le annotazioni per funzione non cambiano.

Scartata l'alternativa `--use-api` (impacchettamento lato Supabase senza Docker): eviterebbe del
tutto il registro, ma cambierebbe il modo in cui le funzioni vengono impacchettate rispetto a
quello in produzione oggi, e non è stato collaudato su tutte le 26 funzioni.

## Verifiche ed esiti

- YAML valido e passo di shell verificato con `bash -n`.
- Il workflow si attiva anche alla modifica del proprio file: l'esecuzione sul commit di
  integrazione è la prova, da leggere nelle annotazioni del run (tutte le funzioni `deploy ok`).
- Rilancio manuale del run fallito della PR #51 (`rerun-failed-jobs`): stesse tre funzioni
  fallite, conferma che il problema è il registro e non il codice.

## Rischi e limiti

- Se il registro resta saturo per più di due minuti la funzione fallisce lo stesso; il messaggio
  d'errore nelle annotazioni resta quello della CLI.
- Il workflow continua a non applicare le migrazioni del database.

## Prossimo passo

Verificare il run del commit di integrazione; se anche con i tentativi restano fallimenti,
valutare `--use-api` provandolo prima su una funzione sola.
