---
date: 2026-09-22
author: Matteo Piccirilli, agente Claude (Opus 5)
roadmap_ids: ["RAG-10"]
state_review: updated
state_reason: Lo stato diceva che i testi in corpus/ si caricano da soli a ogni push; il primo caricamento è fallito per la chiave usata, e va registrato come il workflow sceglie ora la chiave.
roadmap_review: unchanged
roadmap_reason: Attività e prossimo passo di RAG-10 non cambiano: cambia solo il modo in cui il workflow si autentica.
files: ["scripts/ingest-corpus.mjs", ".github/workflows/corpus-ingest.yml", "docs/memory/STATE.md"]
---

## Richiesta e contesto

Il primo caricamento automatico del corpus (run del 22 settembre dopo la PR #39) è fallito:
`401 Accesso riservato agli amministratori` su entrambe le leggi. Il workflow prendeva dall'API di
gestione Supabase la chiave chiamata `service_role`, oppure la prima di tipo `secret`, e la
funzione `ingest-web-source` non l'ha riconosciuta: accetta solo le chiavi presenti nelle sue
variabili d'ambiente (`SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_SECRET_KEY`, `SUPABASE_SECRET_KEYS`).

## Modifiche e motivazione

- Il workflow passa allo script tutte le chiavi segrete rivelate dall'API, una per riga, ognuna
  mascherata nei log, e stampa solo nome e tipo di ciascuna per capire cosa offre il progetto.
- Lo script prova le chiavi con una chiamata a vuoto (`dryRun` su un XML vuoto) e tiene la prima
  che la funzione accetta; se nessuna passa, si ferma con un messaggio chiaro invece di ripetere
  l'errore su ogni file.

Nessun valore di chiave finisce nei log: il file temporaneo con le chiavi viene cancellato subito
dopo la lettura.

## Verifiche ed esiti

- Sintassi dello script verificata; esito reale dal prossimo caricamento del corpus.

## Rischi e limiti

- Se il progetto disattiva le chiavi storiche e la funzione non conosce le nuove, il caricamento
  continuerà a fallire: in quel caso va aggiunta la nuova chiave fra le variabili d'ambiente delle
  funzioni (`SUPABASE_SECRET_KEYS`).

## Prossimo passo

Rilanciare il workflow "Carica corpus normativo nel RAG" e controllare che le due leggi arrivino
nel corpus; se il probe rifiuta tutte le chiavi, aggiornare le variabili d'ambiente delle funzioni.
