---
date: 2026-09-21
author: Matteo Piccirilli, agente Claude (Opus 5)
roadmap_ids: ["SITE-08"]
state_review: updated
state_reason: La homepage dichiarava funzioni che il prodotto non ha; va registrato che la sezione "Cosa fa RegBrain" e il riquadro "Con RegBrain" ora descrivono solo quello che esiste, e cosa resta da correggere.
roadmap_review: updated
roadmap_reason: Aggiunto SITE-08 per le parti della homepage che descrivono ancora il prodotto previsto invece di quello attuale (titolo, profili d'uso, motto a piè di pagina).
files: ["src/pages/Landing.tsx", "docs/memory/STATE.md", "roadmap.md"]
---

## Richiesta e contesto

E' stato segnalato che la sezione "Cosa fa RegBrain" della homepage e' fuorviante rispetto allo stato
attuale del prodotto. Verificato sul codice: "Quattro agenti specializzati" non esistono, le schede
erano tre; "sorveglia in continuo cosa cambia" non corrisponde a nulla, perche' la funzione di
monitoraggio esamina lo schema del database dell'applicazione e non gli aggiornamenti normativi, e
parte solo su richiesta; "audit trail immutabile" non esiste, la cronologia della chat si cancella e
quella delle analisi e' registrata ma non protetta da modifiche; "pronte all'audit" descriveva come
definitivi documenti che sono bozze non ancora riviste dalla CLO. Le stesse affermazioni tornavano nel
riquadro "Con RegBrain" poco piu' sotto.

## Modifiche e motivazione

Riscritta la sezione "Cosa fa RegBrain" con sole funzioni verificate. Sottotitolo: legge la
documentazione, la confronta obbligo per obbligo con le norme che riguardano l'organizzazione, dice
dove e' in regola, dove no e perche', con la prova di ogni conclusione. Tre schede: "Capisce cosa ti
si applica" (questionario di ambito, 254 obblighi, cio' che non riguarda l'organizzazione non diventa
carenza), "Trova le lacune" (esiti per obbligo, carenze e azioni, bozze di DPIA, registro dei
trattamenti, LIA e analisi dei rischi), "Ti da' la prova" (passaggio esatto ritrovato parola per
parola nel file, referto datato che non cambia alla riapertura, esportazione in PDF).

Nel riquadro "Cosa cambia in concreto" le tre affermazioni false (documenti pronti all'audit,
monitoraggio continuo, audit trail immutabile) sono sostituite da tre vere, e il problema degli
aggiornamenti normativi, che il prodotto oggi non risolve, e' sostituito da quello della lettura del
fascicolo, che risolve.

## Verifiche ed esiti

tsc e build puliti. Ogni affermazione nuova e' stata confrontata con il codice: tipi di documento
generabili (dpia, ropa, lia, risk_analysis), regola di ambito (`_shared/regulation-scope.ts`),
verifica delle citazioni, congelamento dell'analisi, esportazione PDF. La pagina non e' stata vista
in un browser perche' il sito e' protetto da password.

## Rischi e limiti

Restano sulla homepage parti che descrivono il prodotto previsto: il titolo e il sottotitolo
("gli agenti fanno il lavoro e tu firmi"), la sezione dei quattro profili d'uso (multi-cliente con
audit trail separati, team con ruoli e firme tracciate, consulente sullo stesso fascicolo) e il motto
a piè di pagina. Nessuna di queste funzioni esiste oggi. Non sono state toccate perche' riguardano il
posizionamento e vanno decise dai soci; sono annotate come SITE-08.

## Prossimo passo

Decidere il posizionamento del titolo e dei profili d'uso: o si riscrivono sul prodotto attuale, o si
presentano esplicitamente come prossime funzioni.
