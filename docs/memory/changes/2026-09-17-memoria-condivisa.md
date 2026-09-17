---
date: 2026-09-17
author: Codex su richiesta di Giovanni
roadmap_ids: ["MEM-01", "MEM-02", "GAP-01"]
state_review: updated
state_reason: Introdotta la situazione verificata, distinguendo main, PR aperta e produzione non verificata.
roadmap_review: updated
roadmap_reason: Consolidati i lavori aperti e preservati i task precedenti con ID e prossimi passi.
files: [".cursor/rules/project-memory.mdc", ".github/copilot-instructions.md", ".github/pull_request_template.md", ".github/workflows/shared-memory-self-check.yml", ".github/workflows/shared-memory.yml", "AGENTS.md", "CLAUDE.md", "CONTRIBUTING.md", "README.md", "deployment/check-shared-memory.mjs", "deployment/shared-memory.test.mjs", "docs/memory/DECISIONS.md", "docs/memory/README.md", "docs/memory/STATE.md", "docs/memory/TEMPLATE.md", "roadmap.md"]
---

## Richiesta e contesto

Giovanni richiede una memoria condivisa obbligatoria per entrambi i soci e tutti gli agenti, aggiornata insieme alle modifiche e alla roadmap. Base applicativa ispezionata: 5bf7a8c3e970765423dda429cb124f185a393a39. La successiva richiesta di completare collaudo e migrazione della PR #3 rimane lavoro separato tracciato in GAP-01.

## Modifiche e motivazione

Aggiunti stato, decisioni, registri per PR, template e istruzioni comuni con punti di ingresso per Codex, Claude, Copilot e Cursor. La roadmap mantiene i task dell'8 settembre non verificati. Un controllo fidato legge i file proposti senza eseguirli e richiede registro nuovo, copertura dei file, riesame di stato/roadmap e conservazione dello storico. Un workflow separato prova il validatore e controlla anche i push su main.

## Verifiche ed esiti

Superati 18 test locali con Node 24: casi validi e rifiuto di registro assente, file non coperti, ID sconosciuti, dichiarazioni incoerenti, segnaposto, riscrittura dello storico, eliminazione dello stato, date errate e link simbolici. Test con repository Git temporanei verificano i contenuti al commit e i rinomini. CI su Node 22 prevista sulla PR: il suo esito è consultabile nei check della PR, senza assumerlo già superato in questo registro iniziale.

## Rischi e limiti

GitHub restituisce 403 per ruleset sul piano attuale del repository privato e per lettura della protezione tramite integrazione. Non è quindi attivo un blocco server dei merge o dei push: un check rosso è un segnale finché un amministratore non abilita le protezioni. Non modificati piano o visibilità. I controlli verificano struttura e copertura, non veridicità o lettura effettiva. Il controllo fidato sarà operativo dopo l'integrazione iniziale. Nessuna modifica al comportamento applicativo o migrazione del database è inclusa; il workflow frontend già esistente può ridistribuire la stessa applicazione al merge.

## Prossimo passo

Integrare e verificare i workflow di MEM-01; completare MEM-02 con piano/protezioni compatibili e prova negativa del blocco merge. Per GAP-01 identificare l'ambiente di staging e completare collaudo e migrazione con esiti reali in un registro distinto; la PR #3 resta separata e non è dichiarata rilasciata.
