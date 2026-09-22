---
date: 2026-09-22
author: Matteo Piccirilli, agente Claude (Opus 5)
roadmap_ids: ["RAG-10"]
state_review: unchanged
state_reason: Correzione interna dell'importatore appena rilasciato; lo stato delle fonti è già descritto nel registro precedente.
roadmap_review: unchanged
roadmap_reason: RAG-10 resta aperto con lo stesso prossimo passo.
files: ["supabase/functions/ingest-web-source/index.ts"]
---

## Richiesta e contesto

Controllando le prime sezioni caricate (Linee guida EDPB 4/2019, provvedimenti del Garante) è emerso
che l'importatore scambiava per titoli i paragrafi numerati ("29. Il RGPD adotta...") e le note a piè
di pagina, e toglieva quella riga dal testo della sezione.

## Modifiche e motivazione

- La riga riconosciuta come titolo resta anche nel testo: nessun contenuto va perso e le citazioni
  restano verificabili parola per parola.
- Regole dei titoli più strette: numerazione a più livelli, numero con titolo in maiuscolo, righe
  brevi numerate senza punto finale, rubriche e righe tutte maiuscole; esclusi paragrafi numerati
  lunghi e note con virgolette o virgole.

## Verifiche ed esiti

Prova su righe reali: paragrafi numerati e note esclusi, titoli "2 ANALISI DELL'ARTICOLO 25",
"2.1 Articolo 25, paragrafo 1: ...", "4.1 Valutazione ...", "1. Premessa", "Articolo 5" riconosciuti.
Le fonti già caricate vengono ricaricate da zero.

## Rischi e limiti

Il riconoscimento resta euristico; la pagina è sempre indicata nella citazione.

## Prossimo passo

Ricaricare Garante ed EDPB 4/2019 e completare le altre fonti.
