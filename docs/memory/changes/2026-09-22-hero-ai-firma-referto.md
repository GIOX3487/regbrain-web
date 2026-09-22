---
date: 2026-09-22
author: Matteo Piccirilli, agente Claude (Opus 5)
roadmap_ids: ["SITE-08"]
state_review: updated
state_reason: Lo stato diceva che titolo e motto descrivevano ancora il prodotto previsto; ora titolo, sottotitolo e motto non parlano più di agenti e la firma è riferita al referto esportato.
roadmap_review: updated
roadmap_reason: SITE-08 si restringe: restano da allineare solo le schede multi-cliente e team con ruoli e la frase sul consulente sullo stesso fascicolo.
files: ["src/pages/Landing.tsx", "docs/memory/STATE.md", "roadmap.md"]
---

## Richiesta e contesto

Richiesta del 22 settembre: il titolo della homepage parla di agenti che non esistono. Matteo ha
scelto il titolo "Automazione della compliance: l'AI fa il lavoro, tu firmi il referto." e ha chiesto
se ci fosse un sottotitolo più efficace di quello che ripeteva il titolo.

## Modifiche e motivazione

- Titolo: "Automazione della compliance: l'AI fa il lavoro, tu firmi il referto." La firma è
  riferita al referto esportato in PDF, l'unica cosa che il professionista firma oggi: nel prodotto
  non esiste una funzione di firma.
- Sottotitolo: al posto di una frase che ripeteva il titolo (AI, lavoro di routine, firma), una che
  dice come funziona e qual è la differenza: documenti confrontati obbligo per obbligo con le norme
  applicabili, esito con la frase esatta che lo prova.
- Riga sul pubblico invariata.
- Schede "DPO interno" e "PMI" e motto a piè di pagina: "agenti" sostituito con "l'AI", "supervisiona"
  con "verifica", firma riferita al referto.

## Verifiche ed esiti

Build riuscita. Nessun'altra occorrenza di "agenti" riferita al prodotto nella pagina, salvo la
biografia di un socio ("orchestrazione degli agenti"), che descrive la persona e non il prodotto.

## Rischi e limiti

Le schede "DPO esterno o frazionale" (audit trail separati per cliente) e "Studio o società di
consulenza" (ruoli e firme tracciate) e la frase "Il consulente esterno entra sullo stesso fascicolo"
descrivono ancora funzioni che non esistono.

## Prossimo passo

Decidere se costruire la firma del referto nel prodotto (approvazione con nome, data e ora, analisi
bloccata, firma nel PDF) e allineare le due schede rimaste (SITE-08).
