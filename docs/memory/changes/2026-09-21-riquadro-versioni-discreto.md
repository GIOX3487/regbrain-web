---
date: 2026-09-21
author: Matteo Piccirilli, agente Claude (Opus 5)
roadmap_ids: ["GAP-10"]
state_review: unchanged
state_reason: Cambia solo quando e come il riquadro delle versioni compare nella pagina dell'analisi; congelamento, riuso e cronologia descritti nello stato del 20 settembre restano identici.
roadmap_review: unchanged
roadmap_reason: GAP-10 descrive il congelamento e la cronologia, che non cambiano; il riquadro resta il modo in cui il confronto fra versioni viene mostrato, solo in forma piu' sobria.
files: ["src/components/compliance/AnalysisVersions.tsx", "src/pages/AssessmentDetail.tsx", "src/lib/engine-version.ts"]
---

## Richiesta e contesto

Sulla pagina di un'analisi appena conclusa compariva sempre, sopra le schede, il riquadro
"Versione 1 del 21/09/2026, motore v27, Rifai l'analisi" con la frase "Gli esiti di questa analisi
non cambiano piu'". E' stato segnalato che rende la pagina poco professionale e non serve a chi la
legge. La segnalazione e' fondata: numero di versione e sigla del motore sono dati interni, la
frase spiega un meccanismo che il cliente non ha chiesto di conoscere, il pulsante invita a
ripetere un'analisi che sugli stessi documenti non ha motivo di essere ripetuta, e la frase
conteneva "piu'" con l'apostrofo al posto dell'accento.

## Modifiche e motivazione

Il riquadro ora compare solo quando ha un'informazione utile. Nel caso comune, una sola analisi
fatta con il sistema attuale, non compare affatto. Compare in due casi: quando l'analisi e' stata
prodotta da una versione precedente del sistema, con un avviso in ambra e il pulsante "Ripeti
l'analisi", che resta l'unica ragione legittima per ripeterla sugli stessi documenti; e quando
esiste un'analisi precedente, con la data di entrambe e l'elenco degli obblighi che hanno cambiato
esito. Sono spariti il numero di versione, la sigla del motore e la frase sul congelamento, che
resta un comportamento del sistema e non un messaggio. Corretti gli accenti nelle stringhe italiane
del riquadro e nel messaggio di conferma dopo la ripetizione. Tolta la funzione che produceva la
sigla "v27", rimasta senza usi.

## Verifiche ed esiti

tsc e build puliti. Nel bundle prodotto non compaiono piu' le stringhe "motore v" e "non cambiano
pi". Il comportamento del server non cambia: congelamento, riuso e cronologia sono gli stessi
verificati il 20 e il 21 settembre. Non e' stato possibile guardare la pagina in un browser, perche'
il sito e' protetto da password.

## Rischi e limiti

Senza il riquadro nel caso comune non esiste piu' un pulsante per ripetere un'analisi fatta con il
sistema attuale. E' voluto: ripeterla sugli stessi documenti produrrebbe solo l'oscillazione del
modello. Quando servira' ripetere una normativa dopo aver risposto a una domanda di ambito, il
pulsante arrivera' con GAP-12.

## Prossimo passo

Controllare la pagina sul telefono e, nella stessa ottica, tradurre l'etichetta "completed" in alto
a destra, che mostra il valore grezzo del database in inglese su una pagina in italiano.
