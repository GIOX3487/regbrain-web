---
date: 2026-09-22
author: Matteo Piccirilli, agente Claude (Opus 5)
roadmap_ids: ["RAG-10"]
state_review: unchanged
state_reason: Correzione interna dell'importatore; lo stato delle fonti non cambia.
roadmap_review: unchanged
roadmap_reason: RAG-10 resta aperto con lo stesso prossimo passo.
files: ["supabase/functions/ingest-web-source/index.ts"]
---

## Richiesta e contesto

Il caricamento dell'allegato 3 delle linee guida AgID sullo sviluppo sicuro falliva con un errore
del database non leggibile ("[object Object]").

## Modifiche e motivazione

- Tolti dal testo estratto il carattere nullo, i caratteri di controllo e i surrogati spaiati, che
  alcuni PDF contengono e che Postgres rifiuta.
- Messaggio d'errore leggibile anche quando il client Supabase restituisce un oggetto e non un Error.

## Verifiche ed esiti

`deno check` senza errori. Il caricamento riprende dal punto in cui si era fermato.

## Rischi e limiti

Nessuno: si sostituiscono solo caratteri non stampabili con uno spazio.

## Prossimo passo

Completare il caricamento delle fonti rimaste.
