---
date: 2026-09-22
author: Matteo Piccirilli, agente Claude (Opus 5)
roadmap_ids: ["RAG-10"]
state_review: updated
state_reason: Sette leggi italiane e il nuovo D.Lgs. 160/2026 entrano nel corpus da una copia pubblica di Normattiva; lo stato deve dire da dove vengono e quali restano da fornire a mano.
roadmap_review: updated
roadmap_reason: RAG-10 si restringe alle leggi non presenti nella copia pubblica.
files: ["supabase/functions/ingest-web-source/index.ts", "supabase/functions/rag-query/index.ts", "docs/memory/STATE.md", "roadmap.md"]
---

## Richiesta e contesto

Normattiva non è raggiungibile dai server di Supabase. Il progetto italia-corpus (dataciviclab, MIT)
pubblica su GitHub i testi vigenti di Normattiva convertiti in Markdown dall'API OpenData, con
aggiornamento giornaliero: GitHub è raggiungibile.

## Modifiche e motivazione

- `ingest-web-source`: nuovo formato "nmd" (Markdown di italia-corpus), un'unità per comma con
  citazione "art. N, comma M", rubrica nell'intestazione, articoli bis/ter gestiti. Collegate le
  versioni vigenti di Codice privacy (vigenza 3/3/2026), CAD (9/5/2026), Codice del consumo
  (19/6/2026), D.Lgs. 82/2022 (12/2/2026), D.Lgs. 218/2017 (12/6/2025), D.Lgs. 24/2023 (12/2/2026) e
  il testo originale del D.Lgs. 138/2024. Aggiunto il D.Lgs. 160/2026 (adeguamento all'AI Act su
  polizia e responsabilità civile e penale, pubblicato il 15 settembre 2026).
- `rag-query`: la configurazione sulla legge italiana sull'IA riconosce anche il D.Lgs. 160/2026.

## Verifiche ed esiti

Prova del parser sul Codice privacy: 487 unità, 221 articoli, nessuna chiave duplicata; art. 122
commi 1, 2 e 2-bis e art. 130 corretti.

## Rischi e limiti

La copia non è la fonte ufficiale: va sostituita con l'XML di Normattiva se emergono differenze.
Il D.Lgs. 138/2024 è nel testo originale, senza eventuali modifiche successive. Restano da fornire:
L. 300/1970, L. 132/2025, L. 4/2004, DL 105/2019, L. 90/2024, L. 633/1941.

## Prossimo passo

Caricare le otto fonti e verificare con domande di prova (RAG-10).
