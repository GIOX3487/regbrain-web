---
date: 2026-09-22
author: Matteo Piccirilli, agente Claude (Opus 5)
roadmap_ids: ["RAG-10"]
state_review: updated
state_reason: La legge italiana sui pagamenti nel corpus diventa il D.Lgs. 11/2010 vigente al posto del D.Lgs. 218/2017.
roadmap_review: unchanged
roadmap_reason: RAG-10 resta aperto con lo stesso prossimo passo.
files: ["supabase/functions/ingest-web-source/index.ts", "supabase/functions/rag-query/index.ts", "docs/memory/STATE.md"]
---

## Richiesta e contesto

Il D.Lgs. 82/2022 e il D.Lgs. 218/2017 risultavano caricati senza alcuna unità: in quei file gli
articoli sono titoli di secondo livello ("## Art. 1."), non di terzo.

## Modifiche e motivazione

- Il parser accetta gli articoli sia al secondo sia al terzo livello.
- Il D.Lgs. 218/2017 recepisce la PSD2 modificando altri atti: al suo posto si carica il D.Lgs.
  11/2010 vigente, che contiene le regole sui servizi di pagamento come modificate.

## Verifiche ed esiti

Prova del parser: D.Lgs. 82/2022 134 unità su 27 articoli, D.Lgs. 11/2010 272 unità su 64 articoli,
Codice privacy invariato (487 unità).

## Rischi e limiti

Nessuno oltre a quelli della copia pubblica di Normattiva già registrati.

## Prossimo passo

Ricaricare D.Lgs. 82/2022 e caricare il D.Lgs. 11/2010.
