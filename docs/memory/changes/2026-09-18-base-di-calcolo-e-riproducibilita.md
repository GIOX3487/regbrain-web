---
date: 2026-09-18
author: Matteo Piccirilli, agente Claude (Opus 5)
roadmap_ids: ["GAP-06", "GAP-07"]
state_review: updated
state_reason: Lo stato si fermava alla v22; vanno registrati la misura di riproducibilita', l'esito del questionario sull'AI Act e la base di calcolo della percentuale.
roadmap_review: updated
roadmap_reason: Aggiunto GAP-07 per la riproducibilita' e aggiornato GAP-06, integrato con la PR #9.
files: ["supabase/functions/gap-analysis/index.ts", "src/pages/AssessmentDetail.tsx", "src/pages/NewAssessment.tsx", "docs/memory/STATE.md", "roadmap.md"]
---

## Richiesta e contesto

Terza verifica sulla qualita' della gap analysis, dopo l'integrazione della v22. Questa volta su
aspetti non ancora guardati: riproducibilita' fra due esecuzioni identiche, comportamento su una
normativa diversa dal GDPR, e affidabilita' della percentuale di conformita'.

## Modifiche e motivazione

### Base di calcolo della percentuale

La percentuale veniva mostrata senza dire su quanti obblighi poggiasse. Misurato: eseguendo l'AI
Act senza rispondere al questionario, 64 requisiti su 70 restano da verificare e la conformita'
risulta 13 per cento, calcolata su quattro obblighi valutabili su settantaquattro. E' un numero che
si legge come un punteggio di conformita' e non lo e'.

Lo stato finale porta ora un oggetto `coverage_basis` con obblighi valutati, da verificare, non
applicabili, quota valutata e se le dichiarazioni di applicabilita' erano presenti. Il riquadro
della conformita' mostra su quanti obblighi e' calcolata e, quando la quota valutata scende sotto
il 40 per cento, avvisa che la percentuale non e' rappresentativa e ne indica il motivo. La stessa
avvertenza entra nella relazione PDF, che e' il documento consegnato.

### Avviso sul questionario saltato

Il questionario e' facoltativo e l'effetto di saltarlo non era quantificato. In creazione analisi
compare ora un avviso con il numero di domande senza risposta e, quando fra le normative scelte ce
n'e' una diversa dal GDPR, il dato misurato: senza le due domande sull'AI Act, 64 obblighi su 70
restano da verificare.

### Due tentativi sulla stabilita', misurati e annullati

Il primo legava ogni carenza alle parole dell'elenco "Cosa deve risultare dalla documentazione",
per togliere latitudine al modello. Esito: documentati da 16 a 7, parziali da 9 a 18,
riproducibilita' da 47 esiti identici su 51 a 42. Peggiorava accuratezza e stabilita' insieme:
invece di vincolare il giudizio, spingeva il modello a enumerare carenze dall'elenco.

Il secondo toglieva il parcheggio fra i da verificare per gli obblighi condizionali con una
citazione verificata, sul presupposto che la prova dimostri da sola l'applicabilita'. Esito: 45
esiti identici su 51 e conformita' che oscilla di sette punti fra due esecuzioni, contro i tre
della v22. Nessun beneficio misurato.

Entrambi sono stati annullati. Della v23 resta solo cio' che e' verificato: base di calcolo e
avvisi.

## Verifiche ed esiti

Riproducibilita' della v22, due esecuzioni dello stesso fascicolo con cache svuotata: **47 esiti
identici su 51**, 45 gravita' identiche su 51, conformita' da 75 a 78 per cento. I quattro esiti
mobili sono articolo 12 e articolo 13 da parziale a documentato, articolo 5 da documentato a
parziale, e articolo 34 da da verificare a documentato, che e' uno spostamento di due caselle su un
obbligo critico.

Comportamento su una normativa diversa dal GDPR, stessi documenti, AI Act: senza risposte al
questionario 64 requisiti su 70 restano da verificare, 3 mancanti, 1 parziale, conformita' 13 per
cento e rischio 83. Rispondendo alle due domande sull'AI Act: 52 mancanti, 1 parziale, 15 non
applicabili e **2 soli da verificare**, conformita' 1 per cento e rischio 94. Il disegno
dell'applicabilita' regge, perche' i settanta requisiti condizionali dipendono da poche chiavi di
ruolo e caratteristica. Il timore che due domande non bastassero per settanta obblighi era
infondato.

Il punteggio di rischio nuovo discrimina: 36 sul fascicolo GDPR ben documentato, 94 sull'AI Act
dove quasi tutto e' scoperto. Con la formula precedente sarebbero stati entrambi 95.

Chiuso un dubbio aperto: l'articolo 14 fra i da verificare non e' un difetto di recupero. Il
registro dei trattamenti non dichiara l'origine dei dati, quindi il motore non poteva decidere.

Stato finale del fascicolo di prova con la versione che si propone di integrare: 14 documentati, 13
parziali, 1 mancante, 10 da verificare, 13 non applicabili, conformita' 73 per cento, rischio 36,
base di calcolo con quota valutata 0,74 e percentuale dichiarata rappresentativa.

`deno check` verde sulla funzione, `tsc` e `npm run build` verdi.

## Rischi e limiti

La riproducibilita' resta il difetto aperto e non e' stato risolto. Quarantasette su cinquantuno
significa che un cliente che rilancia la stessa analisi puo' vedere una percentuale diversa di
qualche punto. Il rimedio e' scrivere per ciascun obbligo un elenco esplicito di elementi attesi e
calcolare lo stato dal conteggio delle risposte elemento per elemento, invece che da un giudizio
complessivo. Lo split meccanico del testo gia' presente non basta: meta' del catalogo avrebbe un
elemento solo e lo stato parziale sparirebbe per quella meta'.

Le misure sono su un fascicolo solo e due esecuzioni per configurazione: dicono la direzione, non
danno un intervallo di confidenza.

La funzione pubblicata sul progetto Supabase viene dal branch. Se questa PR non viene integrata, va
rilanciata la distribuzione da main.

Restano i difetti noti: le voci di catalogo degli articoli 29 e 32 paragrafo 4 sono lo stesso
obbligo; il secchio dei da verificare puo' contenere gap che i documenti lasciano intuire, come
l'articolo 14 rispetto ai referenti tecnici di clienti persone giuridiche citati nel registro.

## Prossimo passo

Integrare, poi affrontare GAP-07 scrivendo gli elenchi di elementi attesi per obbligo, partendo dal
GDPR, e rimisurare la riproducibilita' sullo stesso fascicolo.
