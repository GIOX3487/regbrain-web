---
date: 2026-09-19
author: Matteo Piccirilli, agente Claude (Opus 5)
roadmap_ids: ["SITE-04"]
state_review: updated
state_reason: Va registrato che l'area di caricamento della gap analysis prometteva il trascinamento senza gestirlo e costringeva a caricare un documento alla volta.
roadmap_review: updated
roadmap_reason: Aggiunto SITE-04 per il caricamento dei documenti nella nuova valutazione.
files: ["src/pages/NewAssessment.tsx", "docs/memory/STATE.md", "roadmap.md"]
---

## Richiesta e contesto

Caricando i documenti per una nuova gap analysis risultava possibile prendere un file alla volta,
mentre in passato si riusciva a sceglierli tutti insieme.

La prima ipotesi, l'attributo `multiple` mancante, e' stata verificata e scartata: leggendo il
pacchetto JavaScript che il sito serve in produzione l'attributo c'e' (`multiple:!0`) e c'e' da
sempre. Il campo accetta tecnicamente la selezione multipla.

Il problema e' che nessuno lo capisce, e per due motivi che si sommano.

L'area tratteggiata diceva "Trascina qui i tuoi documenti o clicca per selezionarli" ma **non
gestiva ne' il trascinamento ne' il clic**: nessun `onDrop`, nessun `onDragOver`, nessun
`onClick`. Trascinare un gruppo di file sopra quell'area non faceva nulla, e cliccarla nemmeno.

L'unica via d'ingresso restava il campo di sistema, che il browser rende come "Scegli file /
Nessun file selezionato". Da li' la finestra di macOS si apre in selezione singola apparente: per
prenderne piu' di uno bisogna sapere di dover tenere premuto Cmd, e niente nell'interfaccia lo
diceva. Di qui il caricamento uno alla volta.

## Modifiche e motivazione

L'area tratteggiata diventa quello che dichiarava di essere: accetta il rilascio dei file, si
evidenzia mentre ci si trascina sopra qualcosa, e apre la finestra di scelta se cliccata.

La lavorazione dei file e' stata estratta in `processFiles`, che riceve un elenco di `File` invece
dell'evento dell'input. Selezione manuale e trascinamento passano ora dalla stessa funzione: stessi
limiti di numero e di caratteri, stessi scarti, stessi messaggi. Due percorsi separati avrebbero
prodotto due comportamenti diversi sullo stesso gesto.

Il campo di sistema resta nel documento ma diventa invisibile (`sr-only`, quindi ancora
raggiungibile da tastiera e dai lettori di schermo) e al suo posto compare un pulsante "Seleziona
documenti". Il testo sopra dice esplicitamente che si possono prendere piu' file in una volta e
come farlo, con Cmd su Mac o Ctrl su Windows, oppure Shift per un blocco intero.

I comandi dentro l'area, "rimuovi" sui file caricati e "Nascondi elenco" sugli scarti, fermano la
propagazione del clic: senza questo, rimuovere un file avrebbe riaperto la finestra di scelta.

## Verifiche ed esiti

Controllo dei tipi e build di produzione senza errori. Nel pacchetto compilato risultano presenti
`onDrop`, `onDragOver`, `onDragEnter`, `onDragLeave`, il riferimento al campo nascosto e
`multiple:!0`.

Verificato prima dell'intervento, sul pacchetto servito da regbrain.it, che `multiple` fosse gia'
presente: la correzione non aggiunge una capacita' mancante, rende raggiungibile una capacita' che
c'era e che nessuno poteva usare.

## Rischi e limiti

Il trascinamento non e' stato provato con un gesto reale del mouse: la verifica e' su controllo dei
tipi, build e presenza dei gestori nel pacchetto. Va provato a mano trascinando una cartella di
documenti dal Finder.

Il rilascio di una cartella intera non e' gestito: `dataTransfer.files` su una cartella restituisce
una voce che non e' un file leggibile, che finira' fra gli scarti con un messaggio di errore di
lettura invece che con una spiegazione chiara. Se capita spesso va gestito a parte.

L'area cliccabile include tutto il riquadro tratteggiato. I due comandi interni sono protetti, ma
ogni comando aggiunto li' dentro in futuro dovra' fermare la propagazione del clic.

## Prossimo passo

Provare a mano il trascinamento di piu' documenti insieme e la selezione multipla dalla finestra di
sistema. Se il rilascio di cartelle risulta un caso frequente, riconoscerlo e spiegarlo invece di
trattarlo come file illeggibile.
