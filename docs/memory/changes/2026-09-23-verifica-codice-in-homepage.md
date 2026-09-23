---
date: 2026-09-23
author: Matteo Piccirilli, agente Claude (Fable 5.1)
roadmap_ids: ["CODE-01", "SITE-08"]
state_review: unchanged
state_reason: Cambia solo la pagina pubblica; funzionamento e dati della verifica del codice restano quelli descritti nello stato.
roadmap_review: unchanged
roadmap_reason: La presentazione pubblica della funzione era implicita in CODE-01; attività e prossimo passo non cambiano.
files: ["src/pages/Landing.tsx"]
---

## Richiesta e contesto

Matteo ha chiesto di presentare la verifica del codice anche nella homepage, nel punto più
corretto, e di descrivere solo ciò che il prodotto fa davvero (niente "sistema multi agente").

## Modifiche e motivazione

Nuova sezione "Gli obblighi non stanno solo nei documenti. Stanno anche nel codice." subito
dopo "Cosa fa RegBrain", perché è la seconda cosa che il prodotto fa e viene prima del problema
e dei destinatari. Tre schede (cosa verifica, su quale base normativa, il codice non esce
dall'azienda) e due note (come funziona, per chi). Il sottotitolo della hero cita anche il
codice; la lista "Con RegBrain" ha una riga sul codice. La bio del CTO non parla più di
"orchestrazione degli agenti" ma di pipeline di analisi e registro delle attività, che è ciò
che esiste.

## Verifiche ed esiti

- `tsc --noEmit` e `vite build` puliti.
- Nessuna modifica funzionale.

## Rischi e limiti

- La sezione descrive la scansione nel browser e il referto PDF, entrambi in produzione; se
  la funzione cambia perimetro (per esempio CLI per la CI) la sezione va aggiornata.

## Prossimo passo

Come CODE-01: prova con Giovanni su un repository vero.
