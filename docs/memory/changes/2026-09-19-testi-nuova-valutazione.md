---
date: 2026-09-19
author: Matteo Piccirilli, agente Claude (Opus 5)
roadmap_ids: ["SITE-06"]
state_review: updated
state_reason: Va registrata la causa dei testi attaccati, che e' una regola di JSX e non una svista isolata, perche' puo' ripetersi in altre schermate.
roadmap_review: updated
roadmap_reason: Aggiunto SITE-06 per i testi della schermata di nuova valutazione.
files: ["src/pages/NewAssessment.tsx", "docs/memory/STATE.md", "roadmap.md"]
---

## Richiesta e contesto

Nella schermata di nuova valutazione correggere gli errori di scrittura e le parole attaccate, e
togliere la nota sulla Predictive Analytics.

## Perche' le parole si attaccavano

Non era una svista di battitura. JSX elimina lo spazio finale di una riga quando la riga successiva
continua la frase: scrivendo `...oggi</strong>` a fine riga e `e quali azioni...` sulla riga dopo,
il browser rende `oggie quali`. Lo stesso accadeva a `Predictive Analytics</strong>` seguito da
`per vedere`.

E' una regola del linguaggio, quindi puo' ripresentarsi ovunque un tag chiuda a fine riga. Ho
cercato lo stesso schema in tutta la schermata e i due casi trovati sono quelli segnalati; gli altri
a capo cadono dopo una parola normale, dove JSX lascia correttamente uno spazio.

## Modifiche e motivazione

Lo spazio dopo il tag e' reso esplicito con `{' '}` invece di affidarlo a un a capo. Le frasi sono
state riavvolte in modo che i tag non cadano piu' a fine riga.

Corretto l'ordine delle parole in "dove sei non conforme oggi", che in italiano non si dice: ora e'
"dove non sei conforme oggi".

Rimossa la nota sulla Predictive Analytics, come richiesto.

Corrette due etichette con la maiuscola a meta' frase, le uniche due scritte cosi' in una schermata
che altrove usa la maiuscola solo sull'iniziale: "Titolo Valutazione" diventa "Titolo della
valutazione" e "Carica Documenti aziendali per Gap Analysis" diventa "Carica i documenti aziendali
da analizzare".

## Verifiche ed esiti

Controllo dei tipi e build di produzione senza errori. Nel pacchetto compilato la stringa attaccata
`oggie` non compare piu' (zero occorrenze), la nota sulla Predictive Analytics e' sparita (zero) e la
frase corretta c'e' (una). Ricerca sistematica su tutta la schermata di altri tag chiusi a fine riga
seguiti da parola: nessun altro caso.

## Rischi e limiti

La ricerca dei testi attaccati e' stata fatta su questa schermata soltanto. Lo stesso difetto puo'
esistere in altre pagine e non e' stato cercato altrove.

Le due etichette riscritte sono una correzione di forma, non di contenuto: se erano volute cosi',
vanno rimesse.

## Prossimo passo

Passare la stessa ricerca sulle altre schermate, cioe' tag chiusi a fine riga seguiti da una parola
sulla riga dopo, che e' l'unico schema che produce questo difetto.
