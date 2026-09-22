---
date: 2026-09-22
author: Matteo Piccirilli, agente Claude (Opus 5)
roadmap_ids: ["GAP-13"]
state_review: updated
state_reason: Lo stato non diceva che la gap analysis non usa il corpus normativo nel giudizio né che la fonte mostrata poteva essere sbagliata; ora ogni obbligo ha il suo testo ufficiale e la fonte è corretta.
roadmap_review: updated
roadmap_reason: Aggiunto GAP-13 per la misura del testo della norma nel prompt, spento finché i fascicoli di prova non ne dimostrano il beneficio.
files: ["supabase/migrations/20260922100000_requirement_norm_text.sql", "supabase/functions/gap-analysis/index.ts", "src/pages/AssessmentDetail.tsx", "src/integrations/supabase/types.ts", "docs/memory/STATE.md", "roadmap.md"]
---

## Richiesta e contesto

Domanda di Matteo del 22 settembre: la gap analysis usa il RAG o solo Gemini? Verificato sul codice:
il retrieval c'è sui documenti del cliente, ma il corpus normativo non entra nel giudizio. Il lato norma
viene solo dal catalogo (riferimento, obbligo, "cosa deve risultare"). Il corpus entrava solo nel
riquadro "Vedi fonte normativa", scegliendo il primo di cento frammenti presi a caso che conteneva il
numero dell'articolo: poteva mostrare un articolo che richiama quello giusto invece di quello giusto.

## Modifiche e motivazione

- Catalogo: colonne `norm_text`, `norm_citation`, `norm_chunk_keys`, `norm_refreshed_at` e funzione
  `refresh_requirement_norms()`. Per ogni obbligo prende dal corpus strutturato (testo ufficiale Formex
  in italiano) i paragrafi indicati nel catalogo, o l'articolo intero se il catalogo non indica
  paragrafi. Esclude gli articoli "bis" con lo stesso numero. Tetto 4.000 caratteri. Risultato:
  254 obblighi su 254 con testo, 19 troncati; 14 su 14 corretti a un controllo a campione.
- Fonte normativa dei gap: ora è il testo ufficiale dei paragrafi del requisito con la citazione
  (per esempio "GDPR, art. 30, par. 1-4"). Rimossa la funzione che sceglieva il frammento a caso.
- Testo della norma nel prompt: implementato ma spento (`NORM_IN_PROMPT_DEFAULT = false`). Un
  amministratore può accenderlo per singola analisi con `engineOptions.normText`; un giro con
  `engineOptions` non legge né scrive la memoria dei risultati. Il prompt, quando acceso, dice che
  le carenze possono venire solo dal testo riportato o da "cosa deve risultare", che gli obblighi
  posti su Stati membri o autorità non sono carenze dell'organizzazione e che il testo della norma
  non è una prova.

## Verifiche ed esiti

`deno check` e `tsc` senza errori. Migrazione applicata in produzione. La misura del testo nel
prompt si fa dopo il rilascio, sul fascicolo Meridiana, con giri ripetuti con e senza.

## Rischi e limiti

Le analisi già concluse conservano la fonte scelta con il vecchio metodo, finché non vengono
riallineate. Il testo della norma nel prompt resta spento finché la misura non ne mostra il beneficio.

## Prossimo passo

Misurare su Meridiana: omissioni previste trovate, stabilità fra giri, carenze non imposte dalla
norma. Accendere solo se migliora (GAP-13).
