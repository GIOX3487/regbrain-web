# Stato condiviso di RegBrain

## Collaudo del 19 settembre: pausa visibile e limiti della misura

La PR #10 è riconciliata con main 0dfc984 (PR #11–#22), conserva i miglioramenti del socio e usa versione risultati v26. Corregge anche la schermata dell'analisi interrotta: avviso di pausa persistente nella scheda, nessun rischio conclusivo prima della fine, PDF disponibile solo dopo completamento. Il percorso pausa/riapertura/ripresa riuscita è stato provato nel browser con API e autenticazione simulate localmente; non equivale al collaudo hosted completo. Una nuova ripresa reale e prove rappresentative su entrambi gli endpoint Gemini continuano a restituire 503; accuratezza ancora non misurabile. L'allineamento PR #9 nello staging è preparato localmente e testato, non distribuito. Dettagli nel [registro](changes/2026-09-18-gap-provider-recovery.md).

## Diagnosi provider e ripresa del 18 settembre

Gemini ha restituito HTTP 503 per domanda elevata su tre richieste diagnostiche, anche senza JSON. La proposta `codex/gap-provider-recovery`, basata su main dopo PR #9, conserva i gruppi pendenti e interrompe i tentativi automatici durante l'indisponibilità. Prova reale su staging v7: 12 esclusioni conservate, 39 requisiti pendenti, zero fallback e conformità null. Il benchmark di accuratezza resta bloccato dal provider. Lo staging v7 conserva la base riconciliata PR #3/#6; l'allineamento della classificazione PR #9 è ancora da fare. Nessun rilascio in produzione in questa sessione. Dettagli e limiti nel [registro](changes/2026-09-18-gap-provider-recovery.md).

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
