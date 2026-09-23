---
date: 2026-09-23
author: Matteo Piccirilli, agente Claude (Fable 5.1)
roadmap_ids: ["CODE-01"]
state_review: unchanged
state_reason: Cambia solo il testo di presentazione della pagina; funzionamento, regole e dati conservati restano quelli descritti nello stato.
roadmap_review: unchanged
roadmap_reason: Attività e prossimo passo di CODE-01 non cambiano.
files: ["src/pages/CodeCheck.tsx"]
---

## Richiesta e contesto

Matteo ha giudicato poco professionale il testo di apertura della pagina di verifica del codice
(in particolare "con i segreti mascherati") e ha chiesto di riformularlo e di spiegare su quali
normative si basa l'analisi e perché.

## Modifiche e motivazione

Riscritto il paragrafo introduttivo e il riquadro di presentazione in `src/pages/CodeCheck.tsx`
con un registro adatto a un DPO o a un responsabile IT. Il riquadro ora ha quattro parti:
ambiti verificati; base normativa e criteri di analisi, con l'elenco delle norme collegate alle
regole (GDPR con gli articoli usati, ePrivacy e cookie, Cyber Resilience Act, AI Act e L. 132/2025,
D.Lgs. 138/2024, European Accessibility Act e WCAG 2.2, OWASP ASVS e linee guida AgID, licenze
open source) e per ciascuna che cosa viene verificato nel codice; metodo (regole deterministiche
più revisione del modello sulla base documentale); conservazione dei dati. Le norme elencate sono
quelle effettivamente referenziate in `rules.ts`: nessuna aggiunta di facciata.

## Verifiche ed esiti

- `tsc --noEmit` e `vite build` puliti.
- Nessuna modifica a regole, funzione edge o dati salvati.

## Rischi e limiti

- Se in futuro si aggiungono regole con nuove fonti, l'elenco nella pagina va aggiornato a mano:
  non è generato dal file delle regole.

## Prossimo passo

Come CODE-01: prova con Giovanni su un repository vero.
