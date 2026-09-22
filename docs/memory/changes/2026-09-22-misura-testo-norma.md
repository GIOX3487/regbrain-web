---
date: 2026-09-22
author: Matteo Piccirilli, agente Claude (Opus 5)
roadmap_ids: ["GAP-13"]
state_review: updated
state_reason: Va registrato l'esito della misura: il testo della norma nel prompt non migliora gli esiti in modo netto e resta spento; la fonte corretta dei gap è attiva e riallineata anche su Meridiana.
roadmap_review: updated
roadmap_reason: GAP-13 passa da "da misurare" a "misurato, non attivato", con l'indicazione di cosa provare eventualmente dopo GAP-07.
files: ["docs/memory/STATE.md", "roadmap.md"]
---

## Richiesta e contesto

Matteo ha chiesto di procedere con il testo ufficiale della norma nel giudizio solo se porta un
miglioramento importante. Misura fatta il 22 settembre sul fascicolo Meridiana (8 documenti, GDPR,
51 obblighi, stesse dichiarazioni di ambito), tre giri senza testo (A) e tre con testo (B), con un
utente amministratore temporaneo e opzione `engineOptions.normText`, senza memoria dei risultati.

## Modifiche e motivazione

Nessuna modifica al codice. Riallineata la fonte normativa dei gap già salvati dell'analisi Meridiana
al testo del catalogo: prima l'art. 21 mostrava il testo dell'art. 17, l'art. 5 le definizioni
dell'art. 4, gli artt. 31 e 87 nessuna fonte.

## Verifiche ed esiti

- Conformità: A 77, 77, 76 per cento; B 80, 81, 82. B è più indulgente di 4-5 punti.
- Omissioni volute (artt. 19, 20, 31): trovate in tutti e sei i giri, identiche.
- Obblighi che cambiano esito fra i giri: 2 in A (art. 34, art. 87), 2 in B (art. 28 sub-responsabili,
  art. 6). Stabilità invariata.
- Dove B fa meglio: art. 5 (A pretendeva una "data protection policy generale" e procedure di
  cancellazione che l'articolo non impone), art. 34 (A oscillava fra non applicabile, da verificare
  e coperto; B coperto nei tre giri, corretto perché la procedura lo disciplina).
- Dove B fa peggio: art. 13 coperto in B, parziale in A. Ha ragione A: dipendenti e candidati sono nel
  registro ma non hanno un'informativa. Art. 6 coperto in un giro di B affermando basi giuridiche nel
  registro che il registro non riporta. Art. 28 sub-responsabili parziale in B per una procedura che
  la norma non impone.
- Bilancio: due correzioni e tre errori nuovi, di cui uno (art. 13) è un falso negativo su una
  lacuna reale. Nessun miglioramento importante: il testo nel prompt resta spento.

## Rischi e limiti

Un solo fascicolo e tre giri per versione. La regola del prompt che limita le carenze a quanto
imposto dal testo riportato è probabilmente ciò che rende B più indulgente sull'art. 13.

## Prossimo passo

La cura per esiti e oscillazione resta la checklist per obbligo (GAP-07). Il testo della norma si
può riprovare dopo, come contesto senza regola restrittiva, sugli stessi fascicoli.
