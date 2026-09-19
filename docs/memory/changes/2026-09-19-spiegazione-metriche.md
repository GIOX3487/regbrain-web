---
date: 2026-09-19
author: Matteo Piccirilli, agente Claude (Opus 5)
roadmap_ids: ["SITE-05"]
state_review: updated
state_reason: Va registrato che le tre metriche in cima al referto non dicevano come sono calcolate e che scheda e schede a tab davano due numeri diversi per la stessa cosa.
roadmap_review: updated
roadmap_reason: Aggiunto SITE-05 per la leggibilita' delle metriche del referto.
files: ["src/pages/AssessmentDetail.tsx", "src/components/compliance/MetricExplainer.tsx", "docs/memory/STATE.md", "roadmap.md"]
---

## Richiesta e contesto

Leggendo un referto reale sono emerse tre domande che il referto stesso non sapeva rispondere: come
nasce la percentuale di conformita' e perche' a quel valore corrisponde "Sufficiente"; cosa
distingue un requisito verificato da uno da verificare e come si chiude un "da verificare"; perche'
il profilo di rischio dice "Alto" quando i gap sono 5 alti, 7 medi e 7 bassi, cioe' in maggioranza
non alti.

Sono domande legittime: le tre schede mostravano un numero e un'etichetta senza nessun aggancio al
conto che li produce. Chi porta il referto a un cliente deve poter difendere quei numeri.

## Cosa dicono davvero le formule

Conformita' = (documentati + meta' dei parziali) diviso gli obblighi valutabili, dove valutabile
significa documentato, parziale o mancante. Da verificare e non applicabili restano fuori dal
denominatore. Sul referto esaminato: (13 + 7,5) / 32 = 64 per cento. Le fasce sono 90 eccellente,
75 buono, 60 sufficiente, 40 insufficiente, sotto 40 critico.

Profilo di rischio: il colore complessivo e' quello del gap piu' grave, non una media. Con 5 gap
alti il profilo resta alto anche con 14 gap meno gravi accanto. Esiste anche un punteggio numerico,
calcolato come peso dei gap (alto 3, medio 2, basso 1) sul massimo teorico degli obblighi valutati
aperti al livello piu' alto: sullo stesso referto 36 su 96, cioe' 38 su 100. Le due cose rispondono
a domande diverse e nessuna delle due era spiegata.

Da verificare: obblighi che valgono solo in certe situazioni, per cui dai documenti non risulta se
quelle situazioni ricorrono. Non sono documenti mancanti.

## Modifiche e motivazione

Nuovo componente `MetricExplainer`: accanto al titolo delle schede Conformita', Profilo di rischio e
Requisiti compare un punto interrogativo che apre una spiegazione breve con i numeri di quella
analisi dentro il testo, non con formule astratte. Una spiegazione generica costringe il lettore a
rifare il conto per capire se lo riguarda, e nessuno lo fa.

I numeri della spiegazione arrivano dagli stessi valori che alimentano le schede. Se la spiegazione
li ricalcolasse per conto proprio, prima o poi direbbe un'altra cosa rispetto alla scheda sopra.

La spiegazione del rischio dice anche perche' non si usa la media: diluirebbe i gap alti dietro
quelli lievi, cioe' il contrario di quello che serve a chi deve decidere da dove partire. E dice
cosa fare per cambiare colore: chiudere i gap alti, perche' chiudere i bassi migliora il punteggio
ma non il colore.

Corretta inoltre una contraddizione: la scheda diceva "9 da verificare" e la scheda a tab sotto
diceva "Da verificare (19)", perche' quel tab sommava silenziosamente i 9 da verificare e i 10 non
applicabili. Sono due cose diverse: il primo e' un dubbio da sciogliere, il secondo una constatazione
chiusa. Ora sono due tab distinti con i loro numeri. La scheda dei requisiti mostra la ripartizione
completa (documentati, con lacune, da verificare, non applicabili) invece di due sole voci su
quattro.

## Verifiche ed esiti

Controllo dei tipi e build di produzione senza errori. Verificata l'aritmetica delle spiegazioni
contro il referto reale: 13 documentati piu' meta' di 15 parziali su 32 valutati da' 64 per cento,
che e' il valore mostrato; i pesi 5x3 + 7x2 + 7x1 = 36 su 32x3 = 96 danno 38, che e' il punteggio
memorizzato. Le stringhe nuove risultano presenti nel pacchetto compilato.

## Rischi e limiti

Le spiegazioni sono tradotte in cinque lingue ma scritte in italiano e inglese con cura maggiore: le
versioni spagnola, francese e tedesca sono piu' sintetiche e vanno riviste da un madrelingua prima
di usare il prodotto su quei mercati.

La spiegazione delle fasce di conformita' riporta soglie scritte a mano nel testo. Se un giorno le
soglie nel codice cambiano senza aggiornare la stringa, la spiegazione mente. Andrebbero lette dalla
stessa costante, cosa che oggi non esiste.

Il pannello si apre al clic sul punto interrogativo. Non e' stato provato con un gesto reale ne' su
schermo piccolo: la verifica e' su tipi, build e presenza delle stringhe.

## Prossimo passo

Guardare le tre spiegazioni su un referto vero, anche da telefono, e verificare che il pannello non
esca dallo schermo. Poi valutare se portare le soglie delle fasce in una costante condivisa fra il
calcolo e il testo che le descrive.
