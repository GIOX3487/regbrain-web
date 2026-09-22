---
date: 2026-09-23
author: Matteo Piccirilli, agente Claude (Fable 5.1)
roadmap_ids: ["CODE-01"]
state_review: unchanged
state_reason: Lo stato descrive già il contesto dedotto dal codice con gradi di fiducia; cambia solo la soglia per il settore, un dettaglio della regola.
roadmap_review: unchanged
roadmap_reason: Attività e prossimo passo di CODE-01 non cambiano.
files: ["supabase/functions/code-compliance/infer.ts"]
---

## Richiesta e contesto

Prova in produzione della scansione nel browser su tre file di Juice Shop con Stripe fra le
dipendenze: il settore "finanza" non veniva dedotto, perché la soglia chiedeva almeno due indizi
anche quando uno era la dipendenza nel manifest.

## Modifiche e motivazione

Una dipendenza nel manifest basta da sola: chi installa Stripe fa pagamenti. Restano tre file
distinti come soglia per gli indizi presi dal codice.

## Verifiche ed esiti

- Test in CI invariati e verdi (36).
- Prova in produzione del modo "scan": esito SEC-05 confermato con file e riga, contesto web e
  backend riempito dal manifest, tre file nell'inventario, domande pertinenti (chiede se
  l'applicazione è didattica: Juice Shop lo è).

## Rischi e limiti

- Una dipendenza installata e non usata farebbe comparire il settore; è un suggerimento
  correggibile, non un vincolo.

## Prossimo passo

Come CODE-01: prova con Giovanni su un repository vero.
