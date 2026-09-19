---
date: 2026-09-19
author: Matteo Piccirilli, agente Claude (Opus 5)
roadmap_ids: ["SITE-07"]
state_review: updated
state_reason: Va registrato che due delle tre prove aggiunte poche ore prima sono state tolte, perche' altrimenti la memoria descrive una homepage che non esiste piu'.
roadmap_review: updated
roadmap_reason: Aggiornato SITE-07 con la rimozione delle due affermazioni e il cambio di titolo della fascia.
files: ["src/pages/Landing.tsx", "docs/memory/STATE.md", "roadmap.md"]
---

## Richiesta e contesto

Togliere dalla homepage due affermazioni della fascia aggiunta poco prima: i 32 professionisti fra
DPO e CISO che avrebbero validato l'impostazione, e l'accordo di validazione firmato con un'azienda
cliente.

La prima era gia' stata segnalata da me come l'unica affermazione della pagina che non poggiava su
una misura riproducibile: veniva dal pitch e non era verificabile dal prodotto. La seconda e' stata
tolta su richiesta.

## Modifiche e motivazione

Rimosse entrambe le schede. Restava una sola delle tre affermazioni, quindi la griglia da tre e'
diventata un riquadro solo: una griglia con due caselle vuote e' peggio di nessuna griglia.

Cambiato il titolo della fascia da "Costruito con i DPO, per i DPO" a "Pensato per chi firma", e
riscritto il sottotitolo di conseguenza. Il motivo e' che il titolo precedente affermava una
validazione esterna, e le due prove che la sostenevano non ci sono piu'. Lasciare quel titolo
avrebbe significato tenere in piedi la rivendicazione dopo aver tolto le prove: il contrario di
quello che il prodotto dichiara di fare.

Il titolo nuovo dice una cosa che la pagina dimostra da sola: il prodotto prepara l'istruttoria e la
prova, la valutazione e la responsabilita' restano a chi firma. Quella affermazione e' verificabile
usando il prodotto, non richiede di credere a un numero.

In un passaggio intermedio avevo sostituito la scheda dei 32 professionisti con una sulla direzione
legale interna. E' stata tolta anche quella: mentre si stanno rimuovendo affermazioni non
verificabili non ha senso aggiungerne una nuova che non era stata chiesta.

## Verifiche ed esiti

Controllo dei tipi e build di produzione senza errori. Nel pacchetto compilato non compaiono piu'
"32 professionisti", "Accordo di validazione firmato", "Direzione legale interna" ne' "Costruito con
i DPO"; compare "Pensato per chi firma".

## Rischi e limiti

La homepage non rivendica piu' nessuna validazione esterna. E' la scelta piu' difendibile con le
prove disponibili oggi, ma toglie un argomento di vendita: se esiste un elenco di professionisti che
hanno provato il prodotto, o un cliente disposto a farsi citare, quell'argomento puo' tornare in
forma verificabile.

## Prossimo passo

Se serve rimettere la validazione esterna, partire da una prova citabile per nome, non da un numero
aggregato.
