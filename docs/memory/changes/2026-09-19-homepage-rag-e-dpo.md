---
date: 2026-09-19
author: Matteo Piccirilli, agente Claude (Opus 5)
roadmap_ids: ["SITE-07"]
state_review: updated
state_reason: Va registrato cosa la homepage dichiara adesso e su quali prove poggia ciascuna affermazione, perche' sono affermazioni pubbliche.
roadmap_review: updated
roadmap_reason: Aggiunto SITE-07 per il posizionamento della homepage.
files: ["src/pages/Landing.tsx", "docs/memory/STATE.md", "roadmap.md"]
---

## Richiesta e contesto

Tre cose sulla homepage: spiegare la differenza fra il nostro approccio RAG e un'AI generalista;
rendere leggibili a colpo d'occhio i tre numeri, perche' "55 su 55" da solo non dice a cosa si
riferisce; dire che il prodotto nasce validato dai DPO per i DPO.

## Modifiche e motivazione

**I numeri.** Ogni scheda ha ora un'etichetta sopra la cifra: Fedelta' delle citazioni, Copertura
normativa, Tempo di analisi. Un dato senza etichetta costringe a leggere la didascalia per capire
di cosa si parla, e chi scorre la didascalia non la legge.

Corretta anche un'incoerenza che un lettore attento avrebbe notato: la seconda scheda diceva 254
obblighi a catalogo e la terza "per verificare 250 obblighi". I due numeri erano entrambi veri (nel
giro misurato 4 obblighi erano gia' esclusi dalle dichiarazioni di applicabilita') ma messi vicini
sembravano una contraddizione. La terza scheda ora dice "per un'analisi completa sulle sei
normative, dal caricamento al referto", senza cifra che confligge.

**La tabella.** Cinque righe sotto i numeri, non sopra: prima la prova, poi la spiegazione. Ogni
riga descrive un comportamento osservabile e non un aggettivo: da dove viene la risposta, come si
verifica, cosa succede quando il sistema non sa, come si aggiorna, cosa si ottiene. La riga
"quando non sa" e' quella che conta di piu' ed e' vera nel prodotto: gli obblighi condizionali
finiscono in "da verificare" con la condizione dichiarata, invece di ricevere una risposta
plausibile.

**La fascia sui DPO.** Sta subito sotto il primo pulsante, non in fondo: chi arriva da
un'associazione o da un passaparola cerca prima di tutto la conferma di parlare con chi fa il suo
mestiere. Tre prove concrete: 32 professionisti fra DPO e CISO nella validazione iniziale, un
accordo di validazione firmato con un'azienda cliente, e il fatto che la firma resta a chi
risponde.

## Su cosa poggiano le affermazioni

Sono affermazioni pubbliche, quindi vanno tracciate.

- "55 su 55" e' una misura precedente sulla fedelta' delle citazioni. Le misure successive del 18 e
  19 settembre hanno dato 61 su 61, 65 su 65 e 36 su 36 segmenti verbatim: il dato pubblicato resta
  dalla parte prudente.
- "254 obblighi a catalogo" corrisponde alle righe attive di `regulatory_requirements`, verificate.
- "70 sec" e' sopra le misure reali del 19 settembre: 45 secondi da sola, 61 e 65 con due analisi
  contemporanee.
- "32 professionisti fra DPO e CISO" viene dal pitch di prodotto. Non e' un dato che ho potuto
  verificare io.
- "accordo di validazione firmato con un'azienda cliente" corrisponde all'accordo di validazione e
  data training con Go Infoteam del 5 febbraio 2026. Il nome non compare sul sito.

Deliberatamente non e' stato scritto nulla sull'accordo con UniDPO, che non e' firmato.

## Verifiche ed esiti

Controllo dei tipi e build di produzione senza errori. La tabella e' dentro un contenitore con
scorrimento orizzontale, cosi' su schermo stretto scorre invece di rompere il grafico.

## Rischi e limiti

Il numero dei 32 professionisti e' l'unica affermazione della pagina che non poggia su una misura
riproducibile. Se non e' difendibile con un elenco, va tolto o riformulato.

La resa della tabella su telefono e' stata verificata solo per la larghezza della pagina, non
guardandola: va guardata.

"55 su 55" e' un dato fermo a una misura vecchia. Ora che le misure sono ripetibili varrebbe la pena
pubblicare la piu' recente e datarla.

## Prossimo passo

Guardare la tabella su un telefono vero. Decidere se il dato sulla fedelta' delle citazioni va
aggiornato all'ultima misura e datato, invece di restare un numero senza data.
