---
date: 2026-09-18
author: Matteo Piccirilli, agente Claude (Opus 5)
roadmap_ids: ["GAP-06"]
state_review: updated
state_reason: Lo stato registrava solo la verifica del 17 settembre sull'applicabilita'; va aggiunto l'esito della rilettura del 18 settembre e i tre difetti trovati sullo strato che assegna stati e priorita'.
roadmap_review: updated
roadmap_reason: Nessun ID copriva la priorita' dei gap: aggiunto GAP-06. Aggiornato GAP-03, la cui correzione risulta integrata su main dal 17 settembre.
files: ["supabase/functions/gap-analysis/index.ts", "src/pages/AssessmentDetail.tsx", "src/pages/ComplianceHub.tsx", "docs/memory/STATE.md", "roadmap.md"]
---

## Richiesta e contesto

Richiesta del 18 settembre: verificare se la gap analysis sia accurata e precisa nelle risposte.
La verifica e' stata condotta rileggendo tutti e 51 gli esiti dell'ultima analisi reale conservata
nel progetto (azienda di prova, fascicolo di otto documenti, GDPR) e il codice che li produce,
senza rieseguire l'analisi.

Esito della verifica: la lettura dei documenti e' buona e le citazioni reggono. Gli esiti sono
specifici, citano i file per nome e il ramo dell'applicabilita' si comporta correttamente: gli
articoli 30, 35 e 37, che il 17 settembre risultavano falsi non applicabili, tornano documentati
con due citazioni ciascuno, e i 13 non applicabili sono tutti obblighi realmente condizionati.
L'articolo 36 e' l'esempio migliore: non applicabile dedotto da una prova testuale, non da una
dichiarazione.

Il problema non e' la lettura ma lo strato che la traduce in stati e priorita'.

## Modifiche e motivazione

### Il parziale scatta solo su cio' che la norma impone

Il criterio del prompt diceva "parziale quando mancano elementi obbligatori" senza mai definire
cosa rendesse obbligatorio un elemento, e il modello riempiva il vuoto con la propria idea di
documentazione ideale. Caso accertato, articolo 16, diritto di rettifica: la procedura
dell'organizzazione formalizza il diritto e tiene il registro delle istanze, e il motore lo marcava
parziale chiedendo "istruzioni operative dettagliate sulle modalita' tecniche di modifica sui vari
applicativi", "tracciamento dei log di modifica" e "modelli di riscontro formale". Nessuno dei tre
e' imposto dall'articolo 16. Effetto sul fascicolo di prova: 15 parziali su 28 valutabili e una
conformita' del 66 per cento che sottostima quella reale.

Il prompt ora impone la distinzione prima della scelta dello status: `missing_elements` accoglie
solo cio' che la norma impone espressamente, un campo nuovo `improvement_suggestions` accoglie i
miglioramenti possibili, e i miglioramenti non influiscono sullo stato. Un requisito resta
documentato anche se migliorabile. Nel codice una rete di sicurezza chiude il caso limite: se il
modello dichiara parziale ma non indica nessun elemento obbligatorio mancante e ha prodotto almeno
una citazione verificata, lo stato diventa documentato.

### Il punteggio di rischio non e' piu' saturo

La formula era `min(95, 70 + gap_alti x 5)`: da cinque gap alti in su il risultato e' sempre 95.
Cinque gap alti sono la normalita' in qualunque organizzazione reale, quindi il punteggio era di
fatto una costante e non teneva conto di quanti obblighi risultassero coperti: 12 gap su 200
requisiti davano lo stesso valore di 12 su 15.

Il punteggio e' ora la quota di peso dei gap sul massimo teorico, cioe' tutti gli obblighi
valutabili aperti al livello piu' alto: peso 3 per un gap alto, 2 per un medio, 1 per un basso,
diviso per il numero di obblighi valutabili moltiplicato per tre. Cresce con la gravita', scende con
la copertura e resta sulla scala 0-100 gia' usata dalle soglie del frontend (66 alto, 36 medio).

### La gravita' del gap non arriva piu' solo dal catalogo

`risk_level` nasceva da `severity`, che e' una proprieta' dell'articolo a catalogo, con una sola
attenuazione per lo stato parziale. Sul GDPR il 53 per cento del catalogo e' marcato critico (27
voci su 51), sul CRA il 50 per cento: ne segue che quasi ogni parziale diventava un gap alto. Sul
fascicolo di prova 12 gap su 17 erano alti, cioe' nessuna priorita'. Che il difetto stia nel
catalogo e non nella valutazione lo prova il fatto che obblighi risultati non applicabili
continuano a portare gravita' critica.

Ora l'attenuazione dipende anche da quanto manca davvero: un obbligo del tutto scoperto vale la
gravita' piena, un parziale con tre o piu' elementi obbligatori mancanti scende di un livello, un
parziale con uno o due scende di due.

## Verifiche ed esiti

`deno check` verde sulla funzione, `npx tsc -p tsconfig.app.json --noEmit` verde e `npm run build`
verde.

La funzione e' stata pubblicata sul progetto Supabase dal branch, con una esecuzione manuale del
workflow di distribuzione, e il fascicolo di prova e' stato rieseguito per intero: 51 requisiti su
51, una sola invocazione, nessun errore. Confronto fra la versione precedente e la v22 sullo stesso
fascicolo e con le stesse dichiarazioni di applicabilita':

| | v21 | v22 |
|---|---|---|
| Documentati | 11 | 16 |
| Parziali | 15 | 10 |
| Mancanti | 2 | 2 |
| Da verificare | 10 | 10 |
| Non applicabili | 13 | 13 |
| Conformita' | 66 per cento | 75 per cento |
| Punteggio di rischio | 95 | 26 |
| Gap alti / medi / bassi | 12 / 4 / 1 | 1 / 8 / 3 |

Il caso che aveva motivato la correzione si comporta come previsto. L'articolo 16 passa a
documentato con l'esito "il requisito risulta soddisfatto", e le tre richieste che prima lo
rendevano parziale (istruzioni operative sui singoli applicativi, log di modifica, modelli di
riscontro) compaiono ora fra i miglioramenti, non fra le carenze. L'articolo 18 resta parziale,
correttamente, perche' la procedura dell'organizzazione lo tratta davvero con una riga sola: due
elementi obbligatori mancano ancora, mentre le istruzioni tecniche di segregazione sono passate fra
i miglioramenti, e la gravita' scende da alta a media.

Nessuna perdita di sensibilita': i mancanti restano due. Cambia quali sono, e in meglio. L'articolo
19, omissione deliberata del fascicolo, resta mancante. L'articolo 20 passa da parziale a mancante
perche' il motore riconosce dal registro che l'organizzazione svolge trattamenti automatizzati su
consenso e contratto, quindi l'obbligo di portabilita' si applica, e nei documenti non c'e' nulla
che lo disciplini: e' l'unico gap alto rimasto, ed e' quello giusto. Applicabilita' e da verificare
restano identici, 13 e 10, a conferma che la correzione non ha toccato quello strato.

Il campo nuovo raccoglie 29 miglioramenti su 28 requisiti, e 15 dei 16 requisiti documentati ne
portano almeno uno: l'informazione non e' andata persa, e' stata riclassificata.

Con la scala nuova le soglie del frontend non erano piu' tarate. Erano 66 per il profilo alto e 36
per il medio, pensate per una formula che si saturava a 95 e che quindi stava quasi sempre sopra
66. Sulla scala nuova un punteggio di 66 significherebbe che due terzi degli obblighi valutabili
sono aperti alla gravita' piena, cioe' un caso estremo, e il fascicolo di prova a 26 sarebbe
finito in fascia bassa pur avendo un obbligo applicabile del tutto scoperto. Le soglie sono state
portate a 45 e 20 in `src/pages/ComplianceHub.tsx`: il fascicolo di prova risulta a profilo medio.
Anche questa e' una taratura provvisoria, da rivedere su fascicoli reali.

`deno check` verde sulla funzione, `tsc` e `npm run build` verdi, i 18 test della memoria condivisa
verdi.

## Rischi e limiti

Il campo `improvement_suggestions` viene prodotto e conservato ma il frontend non lo mostra ancora:
l'utente vede il beneficio come minori falsi parziali, non come elenco di miglioramenti. La
dichiarazione di tipo e' stata aggiunta in `AssessmentDetail.tsx` perche' il dato non risulti
sconosciuto, ma la resa e' da fare.

La soglia di tre elementi mancanti che separa l'attenuazione di un livello da quella di due e' una
scelta, non una misura, cosi' come le soglie 45 e 20 del profilo di rischio: vanno ritarate quando
ci saranno fascicoli reali. La verifica e' su un fascicolo solo: dice che la correzione fa quello
per cui e' stata scritta, non che la taratura sia giusta in generale.

La funzione pubblicata sul progetto Supabase viene ora dal branch, non da main. Se questa PR non
viene integrata, la produzione resta su codice non integrato: in quel caso va rilanciata la
distribuzione da main.

I numeri della slide del prodotto nel pitch (66 per cento, profilo alto, 11 documentati, 17 gap)
descrivono l'esito della versione precedente sullo stesso fascicolo e non corrispondono piu' a
quello che la piattaforma produce oggi. Vanno aggiornati a 75 per cento, profilo medio, 16
documentati e 12 gap, oppure rifatti da una schermata nuova.

Restano aperti due difetti segnalati e non corretti qui, entrambi da trattare dopo la riesecuzione:
le voci di catalogo degli articoli 29 e 32 paragrafo 4 descrivono lo stesso obbligo, con lo stesso
titolo, la stessa fonte e la stessa conclusione scritta due volte; e l'articolo 14 finisce fra i da
verificare dichiarando che negli estratti non compare la raccolta indiretta, quando il registro dei
trattamenti e' fra i documenti caricati: non e' accertato se il registro davvero non dichiari
l'origine dei dati o se il recupero non abbia portato le righe giuste a quel requisito.

## Prossimo passo

Integrare, poi ripulire le due voci di catalogo sovrapposte (articoli 29 e 32 paragrafo 4) e
accertare se l'articolo 14 finisca fra i da verificare per una dichiarazione assente nel registro o
per un buco di recupero (GAP-06).
