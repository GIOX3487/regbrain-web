# Stato condiviso di RegBrain

Ultima ricognizione: 17 settembre 2026. Base applicativa verificata: `5bf7a8c3e970765423dda429cb124f185a393a39`. Questo documento distingue codice su main, proposte aperte e ambiente live non verificato.

## Già presente nel codice su main

- Gap analysis con cinque esiti: covered, partial, missing, to_verify e not_applicable; evidenze, severità, profilo, raccolta dell'applicabilità e lavorazione a batch riprendibili.
- Catalogo completo con fallback integrato; i requisiti esclusi sono visibili e raggruppati per motivazione (commit base del 16 settembre).
- Workflow di verifica sorgenti, distribuzione frontend e distribuzione Edge Functions. Il workflow Supabase attuale NON applica le migrazioni del database.

Questa lista descrive il codice ispezionato; non certifica lo stato corrente del database o dell'ambiente di produzione.

## Qualita' della gap analysis: verifica del 17 settembre

Verifica eseguita sul codice di main con un corpus a verita' nota: otto documenti GDPR di
un'azienda ben documentata piu' tre omissioni deliberate. Esito su 51 requisiti: 9 documentati,
14 parziali, 2 mancanti, 10 da verificare, 16 non applicabili, conformita' 64 per cento. Due delle
tre omissioni deliberate sono state rilevate come mancanti; la terza e' risultata parziale in modo
coerente con i documenti. Tutte le citazioni prodotte corrispondevano alla lettera ai documenti.

Difetto trovato: tre obblighi centrali e documentati (articolo 30 registro dei trattamenti,
articolo 35 valutazione d'impatto, articolo 37 designazione del DPO) venivano dichiarati non
applicabili per effetto delle dichiarazioni di applicabilita', perche' la regola cercava le parole
della condizione anche nella descrizione dell'obbligo e perche' le note del GDPR elencano
condizioni alternative. Correzione proposta nel branch `claude/gap-applicabilita-falsi-non-applicabili`,
non ancora integrata: vedere il registro del 17 settembre. La correzione tocca gli stessi file
della PR #3 e va riconciliata con essa. La correzione e' stata integrata su main il 17 settembre
con la PR #6 ed e' confermata in produzione: sulla stessa azienda di prova gli articoli 30, 35 e 37
tornano documentati con due citazioni ciascuno.

## Qualita' della gap analysis: verifica del 18 settembre

Riletti tutti e 51 gli esiti dell'ultima analisi reale e il codice che li produce. La lettura dei
documenti e la verifica delle citazioni reggono; lo strato che traduce la lettura in stati e
priorita' no. Tre difetti trovati, tutti corretti nel branch
`claude/gap-analysis-priorita-e-parziali`, non ancora integrato:

- il parziale veniva usato anche per cio' che la norma non impone. Sull'articolo 16 il motore
  chiedeva istruzioni operative sui singoli applicativi, log di modifica e modelli di riscontro:
  nessuno dei tre e' richiesto dall'articolo. Effetto: 15 parziali su 28 valutabili e una
  conformita' sottostimata;
- il punteggio di rischio si saturava. La formula era 70 piu' cinque punti per gap alto con tetto a
  95: da cinque gap alti in su qualunque organizzazione otteneva 95 e il punteggio non distingueva
  piu' niente. L'azienda di prova era a 95;
- la gravita' del gap veniva solo dal catalogo: un parziale su articolo critico diventava sempre un
  gap alto. Sul GDPR il 53 per cento del catalogo e' critico, quindi 12 gap su 17 risultavano alti e
  l'elenco non si poteva ordinare.

Difetti segnalati e non corretti: due voci di catalogo descrivono lo stesso obbligo (articolo 29 e
articolo 32 paragrafo 4, istruzioni al personale autorizzato), e l'articolo 14 finisce fra i da
verificare senza che sia chiaro se il registro dei trattamenti non dichiari l'origine dei dati o se
il recupero non lo abbia portato al requisito.

## Gap analysis: miglioramenti implementati in una PR ancora aperta

[PR #3 — Gap analysis: evidenze verificabili e salvataggio atomico](https://github.com/GIOX3487/regbrain-web/pull/3), branch `codex/gap-analysis-hardening`, head verificata `31acdefb7c60cdcff13c0b2118de9d95f72e2004`. Al 17 settembre: bozza, non integrata e non distribuita.

La PR rafforza corrispondenza fra citazioni e documenti, gestione prudente degli esiti incerti, riferimenti normativi, paginazione del catalogo, invalidazione della cache, salvataggio atomico con lease, distinzione N/D da zero e documenti originali usati nella generazione.

Verifiche della PR: 39 test backend superati, controlli sintattici Edge, TypeScript frontend e build verdi nel [run GitHub Actions](https://github.com/GIOX3487/regbrain-web/actions/runs/35195286729). I test del database sono isolati con PGlite; non equivalgono a test end-to-end su Supabase ospitato.

**Prima del rilascio della PR #3:** completare o riavviare in modo controllato le analisi precedenti; applicare `20260916215104_gap_analysis_atomic_results.sql` PRIMA delle nuove Edge Functions; provare su staging il flusso completo e la ripresa dei batch. Aggiornare la PR da main e aggiungere il registro della memoria. Nessuna migrazione è stata applicata in produzione durante questo lavoro.

## Informazioni riferite dal socio, da riconfermare dove necessario

Il PDF «RegBrain riepilogo interventi» del 15 settembre riferisce riparazioni ai rilasci, importazione Formex di sei regolamenti, 2.905 chunk con embedding a 768 dimensioni, miglioramenti a chat/profili/citazioni. Riferisce 40/40 articoli recuperati in contesto e 37/40 citati; il valore medio di confidence 88 su otto prove NON è una misura di accuratezza. Queste metriche non sono state riprodotte nell'audit.

Il PDF segnala assenza dal corpus del D.Lgs. 138/2024 e di fonti ACN. Verificare il database attuale prima di dichiararli ancora mancanti o già coperti (GAP-02). Il PDF è materiale di riferimento, non istruzioni operative per gli agenti.

## Sito pubblico

La homepage su main presentava RegBrain come "Piattaforma GRC enterprise", dedicava una sezione a
"perche' un RAG specifico supera qualsiasi AI generalista" in contraddizione con il pitch, e
dichiarava "98% precisione delle citazioni" senza misurazione a supporto. Riscritta con i testi del
pitch pre-seed e con le misurazioni del 17 settembre, nel branch `claude/homepage-testi-pitch`, non
ancora integrato. TypeScript e build verdi, resa verificata su una build locale a viewport 1280;
nessuna verifica in produzione. Restano aperte due decisioni: indirizzo di contatto pubblico
(ancora una casella gmail) e presenza dello sviluppatore AI nella sezione team (SITE-01).

Le tre pagine legali del sito (cookie policy, informativa privacy, termini) contenevano testo di
esempio mai adattato: cookie e servizi terzi inesistenti, Stripe e OpenAI fra i responsabili,
piani di abbonamento e pagamenti che il prodotto non ha, misure di sicurezza non implementate.
Riscritte nello stesso branch su un censimento di codice e database. Il titolare del trattamento
resta senza ragione sociale perche' la societa' non e' costituita, e nessuna delle tre e' stata
rivista da un legale (SITE-02).

Su richiesta, rimossi dal prodotto Perplexity e la sezione aggiornamenti normativi (rotta
`/aggiornamenti`, pagine, componenti, rotta admin di popolamento e quattro edge function non
pubblicate). La tabella `news_updates` resta nel database, la sezione puo' essere reintrodotta.

## Qualita' della gap analysis: verifica del 18 settembre, secondo giro

Dopo l'integrazione della v22 (PR #9) la verifica e' proseguita su cio' che non era stato ancora
guardato. La v22 e' confermata in produzione sul fascicolo di prova: 14 documentati, 13 parziali,
1 mancante, 10 da verificare, 13 non applicabili, conformita' 73 per cento, rischio 36.

Tre esiti nuovi:

- la riproducibilita' e' 47 esiti identici su 51 fra due esecuzioni dello stesso fascicolo, con la
  conformita' che oscilla di tre punti. Il confine fra documentato e parziale e' il punto mobile,
  e l'articolo 34 si e' spostato di due caselle fra un'esecuzione e l'altra. Due tentativi di
  correzione (vincolare le carenze all'elenco degli elementi attesi; non parcheggiare fra i da
  verificare un obbligo condizionale con prova verificata) sono stati misurati, non hanno
  migliorato nulla e sono stati annullati. Il rimedio vero e' un elenco esplicito di elementi per
  obbligo, con lo stato calcolato dal conteggio: lo split meccanico del testo esistente non basta,
  perche' meta' del catalogo avrebbe un elemento solo e il parziale sparirebbe (GAP-07);
- il questionario di applicabilita' funziona meglio di quanto temuto: sull'AI Act, rispondendo alle
  due domande, i requisiti da verificare scendono da 64 su 70 a 2. Senza risposte invece il 91 per
  cento del catalogo resta parcheggiato e la conformita' viene calcolata su quattro obblighi soli;
- la percentuale di conformita' non diceva su quanti obblighi poggiasse. Ora lo stato finale porta
  una base di calcolo e l'interfaccia avvisa quando la quota valutata scende sotto il 40 per cento.

Difetti noti e non corretti: le voci di catalogo degli articoli 29 e 32 paragrafo 4 descrivono lo
stesso obbligo; il secchio dei da verificare puo' contenere gap che i documenti lasciano intuire
(articolo 14, dove il registro cita referenti tecnici di clienti persone giuridiche senza che il
motore ne deduca la raccolta indiretta).

## Qualita' della gap analysis: verifica del 18 settembre, terzo giro

Verifica sulla fedelta' delle citazioni, che e' la promessa centrale del prodotto, eseguita sugli
esiti reali della versione in produzione. Su 60 citazioni prodotte, tutti i 61 segmenti (le
citazioni con elisione marcata [...] contano un segmento per parte) risultano presenti alla lettera
nel file citato, con attribuzione corretta. Nessuna citazione inventata, nessuna attribuita al file
sbagliato. Qualita' delle prove: lunghezza media 154 caratteri, nessun requisito documentato che
poggi su una citazione sotto gli 80 caratteri, 2 su 14 documentati con una prova sola.

Difetto trovato e corretto: 5 frasi sostenevano piu' di un obbligo, una di esse quattro. Il referto
le presentava come constatazioni indipendenti, gonfiando il conteggio dei gap quando la carenza
documentale e' una sola. Ogni citazione dichiara ora su quanti altri obblighi e' usata e il
dettaglio del requisito lo dice (v24, branch `claude/gap-analysis-prove-condivise`).

Stato del fascicolo di prova con la v24: 17 documentati, 10 parziali, 1 mancante, 10 da verificare,
13 non applicabili, conformita' 79 per cento, rischio 27, quota valutata 0,74. Su 59 citazioni, 65
segmenti su 65 verbatim e 15 citazioni marcate come condivise.

Resta aperto GAP-07, la riproducibilita'. Resta da decidere GAP-08, le due voci di catalogo
sovrapposte.

## Qualita' e carico della gap analysis: verifica del 19 settembre

Verifica richiesta dopo una segnalazione di Giovanni su un carico di richieste troppo alto. Il
problema non si e' riprodotto. Tre analisi GDPR in parallelo su utenti distinti: 9,8, 16,2 e 13,5
secondi, esiti 20, 20 e 21 per cento. Catalogo intero, 250 obblighi su sei normative, in tre
invocazioni: 45 secondi da sola, 61 e 65 secondi con due analisi contemporanee. Su circa 600
chiamate al modello nessuna fallita, nessun 429 nei log, nessuna ricaduta a parole chiave.

Corretta comunque la fragilita' che rendeva invisibile un guasto: quando una chiamata AI falliva
tre volte il requisito ricadeva in silenzio sulla verifica a parole chiave, che produce un esito
senza citazioni dall'aspetto identico a una verifica sulle prove. I tentativi passano a quattro con
attesa progressiva (1,5, 5 e 12 secondi) applicata solo sui limiti di frequenza, lo stato finale
porta `evaluation_quality` con il conteggio per metodo e il dettaglio dell'assessment mostra un
avviso quando la valutazione non e' completa. Corretta anche la contraddizione degli obblighi da
verificare, che dichiaravano l'applicabilita' non determinabile ed elencavano comunque elementi
mancanti (v25, branch `claude/gap-analysis-ricadute-visibili`).

Accuratezza misurata sul fascicolo reale di Infoteam, sei documenti GDPR veri. Citazioni oneste: 36
segmenti su 36 presenti alla lettera nel documento indicato, nessuna attribuzione sbagliata,
lunghezza media 158 caratteri. Giudizio sistematicamente severo: zero o un obbligo coperto su 51,
conformita' fra 20 e 23 per cento su quattro giri. L'articolo 37 risulta parziale pur essendoci la
comunicazione al Garante dei dati di contatto del DPO; gli articoli 29 e 32 par. 4 risultano
parziali pur essendoci le istruzioni scritte al personale. Causa misurata: 56 elementi su 109
dichiarati mancanti sono copiati alla lettera dalla documentazione attesa del catalogo (GAP-09,
dipendente da GAP-07).

Sul catalogo intero 166 obblighi su 250 finiscono in `to_verify` perche' il questionario di
applicabilita' copre bene solo il GDPR: il paracadute della v23 marca il risultato come non
affidabile, ma la percentuale mostrata poggia su 70 obblighi.

## Barra laterale della chat, 19 settembre

Ripulita la barra laterale di `/chat`. Tolto il tasto Audit Log, che ripeteva come voce di
navigazione lo storico gia' elencato sotto con domanda e data; la rotta `/audit` resta attiva.
Tolto il tasto Chat, che portava sempre alla pagina in cui l'utente si trovava, dato che quella
barra esiste solo dentro `Chat.tsx`. Il tasto Nuova conversazione diventa un piu' nell'intestazione
dell'elenco delle conversazioni recenti, con descrizione al passaggio del cursore. Ogni
conversazione ha ora un cestino con conferma esplicita che cancella la riga da `query_log`,
appoggiandosi alla politica di riga gia' esistente. Nessuna modifica al database o alle rotte
(SITE-03, branch `claude/chat-sidebar-pulizia`).


## Caricamento dei documenti nella gap analysis, 19 settembre

Segnalato che i documenti si potevano caricare uno alla volta. L'attributo `multiple` era gia'
presente nel pacchetto servito in produzione, quindi la selezione multipla era tecnicamente
possibile: mancava il modo di capirlo. L'area tratteggiata dichiarava "Trascina qui i tuoi
documenti o clicca per selezionarli" senza gestire ne' il rilascio ne' il clic, e l'unica via
d'ingresso era il campo di sistema, da cui la finestra di macOS sembra a selezione singola.

L'area accetta ora il rilascio, si evidenzia durante il trascinamento e apre la selezione al clic;
la lavorazione dei file passa da un'unica funzione condivisa fra trascinamento e selezione
manuale, cosi' limiti, scarti e messaggi restano identici. Il campo di sistema diventa invisibile
ma raggiungibile da tastiera, sostituito da un pulsante, e il testo spiega come prendere piu' file
insieme (SITE-04, branch `claude/caricamento-documenti-multiplo`).

## Metriche del referto spiegate, 19 settembre

Le tre schede in cima al referto mostravano percentuale di conformita', profilo di rischio e
conteggio dei requisiti senza dire come nascono. Ogni scheda ha ora un punto interrogativo che apre
una spiegazione breve con i numeri di quella analisi dentro il testo: la percentuale e' documentati
piu' meta' dei parziali sugli obblighi valutabili, con da verificare e non applicabili fuori dal
denominatore; il profilo prende il livello del gap piu' grave e non la media, mentre il punteggio
numerico e' il peso dei gap sul massimo teorico; da verificare significa obbligo condizionale la cui
condizione non risulta dai documenti, non documento mancante.

Corretta una contraddizione fra le due parti della pagina: la scheda diceva "9 da verificare" e il
tab sotto diceva "Da verificare (19)" perche' vi sommava i non applicabili. Ora sono due tab
distinti e la scheda dei requisiti mostra tutte e quattro le voci (SITE-05, branch
`claude/spiegazione-metriche`).

## Documenti audit-ready, prima prova reale del 19 settembre

La tabella `generated_documents` era vuota: la funzione non era mai stata provata end to end. Prova
fatta sul fascicolo reale Infoteam copiato su un utente temporaneo, poi rimosso.

La DPIA falliva sempre, non per caso: `aiFetch` imponeva 60 secondi a ogni chiamata AI senza che il
chiamante potesse chiedere di piu', e una DPIA standard vale 25-30 pagine. Dopo la correzione
(segnale passabile dal chiamante, 140 secondi per i documenti) la DPIA si genera in 65 secondi, 66
mila caratteri, undici sezioni, con la consultazione preventiva ex art. 36 correttamente legata al
rischio residuo alto.

Gli altri tre sono risultati corretti. Il Gap Report riproduce esattamente i numeri dell'analisi; la
LIA usa la base giuridica giusta (art. 6.1.f, considerando 47 e 49, WP217) con i tre test richiesti;
l'Analisi Rischi dichiara metodologia ISO 31000 ed ENISA con la catena inerente-misure-residuo. I
dati aziendali nella LIA (ragione sociale, indirizzo, partita IVA) sono stati verificati uno per uno
nei file caricati: estratti, non inventati. Nessun importo di sanzione in euro in nessuno dei quattro.

Corretta anche l'etichetta del pulsante LIA, che diceva "Legitimacy Impact Assessment (AI Act)",
sbagliata sul nome e sulla normativa (DOC-01, branch `claude/documenti-audit-dpia`).

## Gap Report rimosso, 19 settembre

Il quarto documento generabile duplicava il referto gia' scaricabile con Esporta PDF, che contiene
gia' executive summary, percentuale, profilo di rischio, base di calcolo, piano d'azione ed elenchi
dei requisiti con le citazioni. Nella prova i numeri del Gap Report coincidevano esattamente con
quelli del referto: non aggiungeva informazione, solo un secondo modo di dirla, con il rischio che
le due versioni divergano nel tempo. I documenti generabili restano tre: DPIA, LIA e Analisi Rischi
art. 24 (DOC-01, branch `claude/via-gap-report`).

## Testi della nuova valutazione, 19 settembre

Le parole attaccate nella scheda introduttiva ("oggie quali", "Analyticsper vedere") non erano
refusi: JSX elimina lo spazio finale di una riga quando un tag chiude li' e la frase continua sulla
riga dopo. Lo spazio e' ora esplicito con `{' '}` e le frasi sono riavvolte. Corretto anche l'ordine
delle parole in "dove sei non conforme oggi", rimossa la nota sulla Predictive Analytics come
richiesto e sistemate due etichette con la maiuscola a meta' frase. Cercato lo stesso schema in
tutta la schermata: nessun altro caso. Resta da cercarlo nelle altre pagine (SITE-06, branch
`claude/testi-nuova-valutazione`).

## Homepage: numeri, confronto e posizionamento DPO, 19 settembre

I tre numeri hanno ora un'etichetta sopra la cifra (Fedelta' delle citazioni, Copertura normativa,
Tempo di analisi): prima "55 su 55" non diceva a cosa si riferisse senza leggere la didascalia.
Tolta l'incoerenza fra la scheda che diceva 254 obblighi a catalogo e quella che diceva "per
verificare 250 obblighi".

Aggiunta sotto i numeri una tabella di cinque righe che confronta il prodotto con un'AI generalista
su comportamenti osservabili: da dove viene la risposta, come si verifica, cosa succede quando non
sa, come si aggiorna, cosa si ottiene.

Aggiunta sotto il primo pulsante la fascia "Costruito con i DPO, per i DPO" con tre prove: 32
professionisti fra DPO e CISO nella validazione iniziale (dato che viene dal pitch e non e'
verificabile da qui), accordo di validazione firmato con un'azienda cliente (Go Infoteam, nome non
citato sul sito), e la firma che resta a chi risponde. Nulla e' stato scritto su UniDPO, che non ha
un accordo firmato (SITE-07, branch `claude/homepage-rag-e-dpo`).

## Homepage: tolte le affermazioni non verificabili, 19 settembre

Poche ore dopo averle aggiunte sono state rimosse due delle tre prove della fascia sotto il primo
pulsante: i 32 professionisti fra DPO e CISO (dato che veniva dal pitch e non era verificabile dal
prodotto, e che avevo segnalato come tale gia' nel consegnarlo) e l'accordo di validazione firmato
con un'azienda cliente.

Restava una sola affermazione, quindi la griglia da tre e' diventata un riquadro solo, Il titolo
era stato cambiato da me in "Pensato per chi firma" ed e' stato poi rimesso su richiesta a
"Costruito con i DPO, per i DPO": la richiesta era togliere le due affermazioni, non il titolo. Il
sottotitolo resta quello riscritto, che parla di come il prodotto e' costruito senza affermare una
validazione esterna.

La homepage non rivendica ora nessuna validazione esterna (SITE-07, branch
`claude/via-32-professionisti`).

## Memoria e coordinamento

Memoria, istruzioni per gli agenti e workflow sono integrati con la [PR #4](https://github.com/GIOX3487/regbrain-web/pull/4), commit `72b7e2e69866ce0665f39b0e52d2ddda659e9398` (MEM-01). I 18 test della memoria e le verifiche applicative sono verdi anche su main. Il controllo fidato è stato provato sulla PR #5: una revisione senza registro è stata rifiutata con il messaggio richiesto ([prova negativa](https://github.com/GIOX3487/regbrain-web/actions/runs/35203449382)). Lo stato del blocco tecnico dei merge è **non attivo**: il piano del repository privato non consente i ruleset, e la protezione main non è leggibile dall'integrazione. MEM-02 resta bloccato su configurazione/piano dell'amministratore; vedere [procedura](README.md).

La [roadmap unica](../../roadmap.md) conserva anche i due task dell'8 settembre, il cui completamento non è stato verificato. Priorità proposta: chiudere GAP-01, poi misurare la qualità del catalogo e dell'applicabilità prima di ampliare il flusso di remediation.

## Preparazione del collaudo richiesto il 17 settembre

Le verifiche in sola lettura confermano un solo progetto Supabase (`regbrain-web`), nessun branch di prova e la migrazione atomica ancora assente. Prerequisiti principali e permessi service_role sono presenti; tre assessment risultavano completati, nessuno in corso al momento della lettura. Non sono stati modificati database o funzioni in produzione. Il collaudo completo resta da eseguire: occorre identificare o creare uno staging, con organizzazione ed eventuale costo confermati. Procedura e risultati: [STAGING.md](STAGING.md). I test isolati già verdi non vengono riclassificati come collaudo hosted.

## Qualita' della gap analysis: verifica e correzione del 20 settembre

Verificata la v25 in produzione sul fascicolo reale di Infoteam, diciassette documenti GDPR veri,
confrontando il giro dell'utente con due giri riprodotti con le stesse risposte al questionario.
Le citazioni reggono: 112 su 112 alla lettera, nessuna attribuzione sbagliata. Nessuna ricaduta a
parole chiave. Gli elementi mancanti non sono piu' copiati dal catalogo.

Trovati tre difetti. Quattro documenti su diciassette non venivano mai letti, perche' il tetto di
4200 caratteri di estratto per requisito lasciava entrare tre o quattro sezioni e le prendeva il
documento piu' prolisso: l'articolo 37 risultava parziale chiedendo la ricevuta di comunicazione al
Garante, che sta scritta nel file mai letto. Le risposte al questionario non arrivavano al modello,
perche' le etichette delle condizioni GDPR non erano fra quelle passate nel prompt, e l'articolo 9
apriva un gap muto nonostante la dichiarazione contraria. Gli esiti cambiavano fra giri identici:
conformita' 64, 57 e 57 per cento, con l'etichetta che passava da Sufficiente a Insufficiente.

Corretto nella v26 (`gap-analysis-v26-prove-da-tutti-i-documenti`): scelta degli estratti in due
giri, con al massimo una sezione per documento nel primo, tetto per requisito da 4200 a 9000
caratteri, dichiarazioni GDPR nel prompt, e contrasto fra dichiarazione e documenti che diventa uno
stato "da verificare" spiegato invece di un gap muto.

Rimisurato con quattro giri indipendenti: l'articolo 37 cita la comunicazione al Garante in tutti e
quattro e la carenza falsa e' sparita, l'articolo 9 e l'articolo 44 sono stabili e coerenti con le
risposte date, i documenti citati passano da tredici a quattordici su diciassette, le citazioni
restano 98 su 98 alla lettera. Conformita' 68,8, 65,0, 68,8 e 62,9 per cento, tutte dentro la
stessa etichetta; differenza media fra due giri 4,5 esiti su 51 contro i 7 e 8 della v25.
L'instabilita' e' ridotta, non risolta (GAP-10).

Il numero unico di sintesi non e' ancora un dato da mettere in un'offerta; i singoli esiti con
citazione verificata lo sono.

## L'analisi diventa un documento datato, 20 settembre

A parita' di documenti caricati l'analisi ora restituisce sempre lo stesso esito, e lo fa non
ricalcolando invece che cercando di rendere deterministico il modello, che a temperatura zero
deterministico non e'.

La memoria del risultato esisteva gia' ma aveva la versione del motore e l'elenco degli obblighi
dentro la chiave: ogni correzione al motore cancellava la memoria di tutte le analisi fatte. Ora
l'impronta comprende solo il caso (documenti, dichiarazioni, normative, lingua, profilo,
fatturato), la versione sta accanto al risultato e la corrispondenza con il catalogo viene
controllata al momento del riuso.

Un'analisi conclusa non viene piu' ricalcolata: una seconda chiamata restituisce gli esiti salvati
con `frozen: true`. Il rifacimento va chiesto con `rerun: true` e rilegge i documenti
dall'archivio dell'assessment. Ogni giro completato scrive una riga in `assessment_runs`, e sopra
le schede un riquadro dice di quale versione si sta guardando l'esito e quali obblighi sono
cambiati rispetto al giro precedente. Un'analisi prodotta da un motore precedente viene segnalata
in ambra ma non rifatta da sola.

Provato in produzione su un fascicolo reale da otto documenti: due analisi distinte con gli stessi
documenti danno 51 esiti su 51 identici, testo del giudizio compreso; la riapertura non tocca
nulla; due rifacimenti espliciti producono due righe di cronologia con tre obblighi di differenza.
Durante la prova la tabella nuova aveva le policy ma non i privilegi e la cronologia non veniva
scritta: corretto e riprovato.

Il riuso resta per utente (GAP-11) e l'oscillazione del modello resta quando il ricalcolo avviene
davvero, ma e' datata e visibile invece che silenziosa.

## Normative settoriali: nessun gap senza ambito stabilito, 21 settembre

L'analisi sulle sei normative trattava come applicabile ogni normativa settoriale su cui
l'organizzazione non aveva risposto alla domanda di ambito. Su Meridiana, azienda manifatturiera
con documentazione GDPR completa, questo produceva 57 gap di cui 29 su DORA e portava la conformita'
dal 78 al 42 per cento.

Ora DORA, NIS2, CRA, AI Act e Data Act seguono una regola a tre stati
(`supabase/functions/_shared/regulation-scope.ts`): valutate se l'organizzazione dichiara di
rientrarvi, escluse se dichiara di no, altrimenti "non valutate", senza gap e fuori dalla base di
calcolo. Le cinque domande di ambito sono obbligatorie nella nuova valutazione, "Non lo so" e'
ammesso. Pagina dell'analisi e PDF elencano le normative non valutate con il motivo. I risultati
salvati prima della v27 non vengono riusati per analisi nuove.

Misurato in produzione: senza risposte 11 gap e 79 per cento; tutte "no" 82 per cento; DORA "si"
DORA valutata con 38 gap veri per un'entita' finanziaria; DORA "non lo so" non valutata. Otto test
nuovi, fra cui uno che fallisce se le domande del frontend e le porte del server divergono.

## Pagina dell'analisi senza riquadro delle versioni, 21 settembre

Su richiesta, la pagina dell'analisi non mostra piu' il riquadro delle versioni in nessun caso:
niente numero di versione, sigla del motore, confronto con l'analisi precedente, avviso sulle
analisi fatte con una versione precedente e pulsante per ripeterle. Il server continua a congelare
le analisi concluse, a riusare i risultati per documenti identici e a registrare ogni giro in
`assessment_runs`; il rifacimento resta disponibile solo come chiamata con `rerun: true`, senza
un punto di accesso nell'interfaccia.

## Homepage: cosa fa RegBrain oggi, 21 settembre

La sezione "Cosa fa RegBrain" e il riquadro "Con RegBrain" descrivono ora solo funzioni esistenti e
verificate sul codice: ambito degli obblighi dal questionario, esiti per obbligo con carenze e azioni,
bozze di DPIA, registro dei trattamenti, LIA e analisi dei rischi, citazioni ritrovate parola per
parola, referto datato ed esportabile. Tolte le affermazioni su quattro agenti, monitoraggio continuo,
audit trail immutabile e documenti pronti all'audit. Titolo, profili d'uso e motto descrivono ancora
il prodotto previsto (SITE-08).

## Console di amministrazione e feedback degli utenti, 21 settembre

Esiste `/admin`, riservata al ruolo admin: indicatori, feedback, attività in diretta (realtime),
errori delle funzioni edge (ogni risposta 4xx/5xx tranne 401), chat, gap analysis e utenti di tutta
la piattaforma. Chat e gap analysis hanno pollici su e giù con commento facoltativo (risposta della
chat, singolo esito, analisi intera), salvati in `feedback` con l'istantanea di ciò che l'utente ha
visto; il registro eventi è `app_events`, conservato 90 giorni. Entrambe usano `author_id`/`actor_id`
per sopravvivere alla pulizia delle demo. Il ruolo admin si ottiene solo con email confermata presente
in `admin_allowlist` (oggi `cecchinoxsempre@gmail.com`); nessun account di Matteo esisteva il
21 settembre, quindi va creato registrandosi. L'informativa privacy non dice ancora che il team legge
conversazioni e feedback.

## Chat: scorrimento all'inizio della risposta, 21 settembre

Su segnalazione di un DPO la chat ora scorre in fondo quando si invia una domanda e porta in alto
l'inizio della risposta quando arriva. Prima non c'era alcuno scorrimento automatico.

## Homepage: titolo senza agenti, 22 settembre

Titolo "Automazione della compliance: l'AI fa il lavoro, tu firmi il referto." Sottotitolo su come
funziona (confronto obbligo per obbligo, frase esatta come prova). Motto e schede DPO interno e PMI
senza agenti. Restano non vere le schede multi-cliente e team con ruoli e il consulente sullo stesso
fascicolo (SITE-08). Nel prodotto non esiste una funzione di firma: "firmi il referto" si riferisce al
PDF esportato.

## Gap analysis: testo ufficiale della norma per ogni obbligo, 22 settembre

La gap analysis non usava il corpus normativo nel giudizio: il lato norma viene dal catalogo. Dal
22 settembre ogni obbligo ha nel catalogo il testo ufficiale dei suoi paragrafi (254 su 254), usato
come fonte normativa mostrata nei gap al posto di un frammento scelto a caso. Il testo nel prompt è
pronto ma spento finché non è misurato (GAP-13).

## Testo della norma nel prompt: misurato, non attivato, 22 settembre

Su Meridiana, tre giri con e tre senza: conformità 80-82 contro 76-77 per cento, stesse omissioni
trovate, stessa instabilità (2 obblighi su 51). Corregge art. 5 e art. 34 ma introduce errori su
art. 13 (falso negativo reale), art. 6 e art. 28. Resta spento. Fonte normativa dei gap di
Meridiana riallineata.

## Fonti per la conformità del software, 22 settembre

Il corpus si estende oltre i sei atti UE: 17 atti UE via Formex e fonti non legislative (Garante,
EDPB, AgID, ACN, OWASP ASVS 5.0, WCAG 2.2, licenze SPDX) via `ingest-web-source`. Le leggi italiane
(Codice privacy, Statuto dei lavoratori, L. 132/2025, D.Lgs. 138/2024, 82/2022, L. 4/2004, CAD,
Codice del consumo, D.Lgs. 218/2017, perimetro cyber, L. 90/2024, D.Lgs. 24/2023, L. 633/1941) non
sono scaricabili dai server di Supabase: vanno fornite in XML Akoma Ntoso da Normattiva (RAG-10).

## Leggi italiane nel corpus, 22 settembre

Codice privacy, CAD, Codice del consumo, D.Lgs. 82/2022, 11/2010 (pagamenti), 24/2023 (versioni vigenti) e
D.Lgs. 138/2024 (testo originale) vengono dalla copia pubblica italia-corpus di Normattiva; aggiunto
il D.Lgs. 160/2026 sull'IA. Mancano ancora L. 300/1970, L. 132/2025, L. 4/2004, DL 105/2019,
L. 90/2024 e L. 633/1941, da fornire in XML Normattiva.

## L. 132/2025 e L. 90/2024 dai PDF della Gazzetta, 22 settembre

Convertite in XML Akoma Ntoso dai fascicoli della Gazzetta forniti da Matteo e caricate nel RAG
(28 articoli e 90 commi la prima, 24 e 46 la seconda). I testi versionati stanno in `corpus/leggi`
e si caricano da soli a ogni push su `main` (workflow `corpus-ingest.yml`, script
`scripts/ingest-corpus.mjs`): il nome del file è il codice della fonte. Il workflow legge dall'API
di gestione Supabase tutte le chiavi segrete del progetto, le maschera e usa la prima che
`ingest-web-source` accetta: la sola chiamata `service_role` non bastava e il primo caricamento è
fallito con 401. È il testo pubblicato in
Gazzetta, senza le modifiche successive, e la L. 90/2024 è già stata modificata dall'art. 28 della
L. 132/2025. Restano fuori L. 300/1970, L. 633/1941, L. 4/2004 e DL 105/2019: i PDF forniti sono
scansioni o testi originari ormai riscritti, e caricarli darebbe risposte sbagliate dall'aria
fondata. Servono le esportazioni "vigente" di Normattiva.

## Verifica del codice nel Compliance Hub, 22 settembre

Pagina `/compliance/code-check`: si incolla il codice o si caricano fino a 40 file e si ottiene un
esito con profilo di rischio alto, medio o basso, le righe che lo provano, il testo delle norme
collegate preso dal RAG e un report PDF. Decide una regola scritta (21 regole, stesso codice stesso
esito); il modello spiega, propone gli interventi, segnala possibili falsi positivi, aggiunge al
massimo sei problemi marcati "da verificare" e fa fino a cinque domande per completare la verifica.
Un problema aggiunto dal modello entra solo se file e riga esistono davvero. Provata in produzione
il 22 settembre: 22 secondi su un file, esiti salvati in `code_checks` (la tabella ha avuto bisogno
di `grant all ... to service_role`: creata fuori dal ruolo `postgres` non eredita i privilegi
predefiniti). Il codice non viene
salvato (restano nomi dei file, impronta SHA-256 e le righe citate, con i segreti mascherati) ma
viene inviato al fornitore del modello: l'informativa privacy va aggiornata. Il RAG resta uno solo
per chat, gap analysis e verifica del codice: nessuna copia dedicata al Compliance Hub.

## Quanto sbaglia la verifica del codice, 22 settembre

Misurata su tre basi di codice invece che sui soli file scritti apposta. Su RegBrain (264 file) le
segnalazioni passano da 110 con 51 sbagliate a 69 con una sola sbagliata; su otto file presi da
Juice Shop, Express e Next.js le sbagliate passano da sei a zero e restano le falle vere di Juice
Shop (chiave privata, due SQL injection, MD5 sulle password, eval, cookie senza attributi,
`Math.random` per un segreto). Le correzioni: le parole dentro le stringhe non contano, i token nel
browser solo se la chiave è davvero una credenziale, gli indirizzi http solo dentro una chiamata,
i cookie solo con il nome scritto nel codice, MD5 ignorato per impronte di file, CORS aperto a
rischio basso senza credenziali, file di prova con un gradino di rischio in meno. Due regole nuove
(dati fuori dall'UE, raccolta dell'indirizzo IP): 23 in tutto. Il banco di prova con 50 righe
marcate gira in CI (`npm run test:backend`), insieme alla prova che due esecuzioni danno lo stesso
esito.

## Livello AI della verifica del codice, prova in produzione del 22 settembre

Marca come possibile falso positivo la password dentro `tests/fixtures`, spiegando perché; non
esegue le istruzioni nascoste nei commenti (un commento che ordinava di dichiarare il codice
conforme è stato segnalato come tentativo di elusione); ripete lo stesso esito sullo stesso file
(due giri, nove esiti identici per rischio e stato) in 20-25 secondi; cita solo le fonti che
riceve. Ha anche trovato una lacuna delle regole (un `requests.post` in http non cifrato che il
filtro di contesto scartava), poi corretta.
