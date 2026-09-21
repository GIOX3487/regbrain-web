---
date: 2026-09-21
author: Matteo Piccirilli, agente Claude (Opus 5)
roadmap_ids: ["GAP-03", "GAP-12"]
state_review: updated
state_reason: L'analisi sulle sei normative produceva decine di gap falsi quando il questionario di ambito restava senza risposta; va registrata la regola a tre stati che lo impedisce e le misure fatte in produzione.
roadmap_review: updated
roadmap_reason: GAP-03 passa da "da verificare caso per caso" a regola esplicita e testata per l'ambito delle normative settoriali; aggiunto GAP-12 per la modifica delle dichiarazioni su un'analisi esistente, che oggi richiede una nuova analisi.
files: ["supabase/functions/_shared/regulation-scope.ts", "supabase/functions/gap-analysis/index.ts", "src/lib/applicability-questions.ts", "src/pages/NewAssessment.tsx", "src/pages/AssessmentDetail.tsx", "src/lib/engine-version.ts", "deployment/regulation-scope.test.mjs", "package.json", "docs/memory/STATE.md", "roadmap.md"]
---

## Richiesta e contesto

Nella verifica di vendibilita' del 21 settembre il fascicolo Meridiana, un'azienda manifatturiera
con documentazione GDPR completa, e' stato analizzato su tutte e sei le normative lasciando senza
risposta le domande di ambito. La conformita' e' scesa dal 78 al 42 per cento, il rischio e'
salito a 62 e i gap sono passati a 57. Di questi, 29 erano su DORA, che si applica solo a entita'
finanziarie e ai loro fornitori TIC, e gli altri su NIS2, CRA, AI Act e Data Act. E' stato chiesto
di correggere il problema in modo definitivo.

La causa: una normativa settoriale veniva esclusa solo se l'organizzazione dichiarava di non
rientrarvi. In ogni altro caso, risposta assente o "non lo so", veniva trattata come applicabile,
e i suoi 28 obblighi non condizionali venivano cercati nei documenti GDPR dell'azienda e dati per
mancanti. Il questionario era indicato come facoltativo, quindi il caso era alla portata di
chiunque selezionasse piu' normative per avere un quadro completo, come invita a fare la homepage.

## Modifiche e motivazione

Regola a tre stati per l'ambito di DORA, NIS2, CRA, AI Act e Data Act, in un modulo nuovo senza
dipendenze, `supabase/functions/_shared/regulation-scope.ts`, usato dalla funzione e coperto da
test. Almeno una qualifica dichiarata "si": la normativa si valuta. Tutte dichiarate "no": non si
applica. Qualunque altro caso, compresi risposta assente, "non lo so" e risposta incompleta:
ambito non determinato. Il GDPR non ha domanda di ambito perche' riguarda chiunque tratti dati
personali. L'esclusione per risposte tutte "no" e' diventata piu' severa: prima bastava che fossero
"no" le chiavi presenti, ora devono esserci tutte.

Gli obblighi di una normativa con ambito non determinato vengono risolti prima della valutazione,
senza chiamare il modello, come "da verificare" con `scope_undetermined` e una motivazione che
nomina la normativa e la domanda mancante. Non producono gap, non entrano nel rischio e non entrano
nella base su cui si giudica l'affidabilita' della percentuale, dove prima avrebbero fatto
dichiarare "poco rappresentativa" una conformita' che sulle normative valutate lo era. L'esito
riporta `regulations_not_assessed` con normativa, numero di obblighi e motivo.

Nella nuova valutazione le cinque domande di ambito sono obbligatorie: l'analisi non parte finche'
manca una risposta, e "Non lo so" e' ammesso. Le altre domande restano facoltative. Il testo che
invitava a saltare il questionario e' stato riscritto. Nella pagina dell'analisi e nel PDF le
normative non valutate compaiono in chiaro, con il motivo, e nella scheda "Da verificare" sono
raggruppate in una riga per normativa invece di centinaia di righe uguali.

Il riuso dei risultati salvati, introdotto il 20 settembre ignorando la versione del motore, ha ora
una soglia: un risultato prodotto prima di una correzione di correttezza non si riusa per analisi
nuove, altrimenti chi carica gli stessi documenti ritroverebbe l'errore gia' corretto. Le analisi
concluse restano intatte, perche' il congelamento non passa dal riuso. Versione del motore a
`gap-analysis-v27-ambito-normative-settoriali`, soglia di riuso 27.

## Verifiche ed esiti

Controllo dei tipi con deno e tsc, build e 28 test di backend verdi, di cui 8 nuovi. I test coprono
la regola a tre stati, il caso "non lo so", la risposta incompleta, il GDPR, e verificano che ogni
normativa settoriale del server abbia nel frontend una domanda obbligatoria che ne copre tutte le
chiavi e un'opzione "Non lo so": se i due elenchi divergono, il test fallisce.

In produzione, sul fascicolo Meridiana con le sei normative:

- senza risposte di ambito: AI Act, CRA, Data Act, DORA e NIS2 non valutate, 199 obblighi, zero gap;
  conformita' 79 per cento, rischio 23, 11 gap tutti GDPR, percentuale dichiarata affidabile;
  21 secondi invece di 59, perche' quei 199 obblighi non passano dal modello;
- tutte le qualifiche "no": le cinque normative non applicabili, conformita' 82 per cento;
- DORA "si": DORA valutata, 38 gap, che su un fascicolo solo GDPR sono carenze vere per un'entita'
  finanziaria; la regola non spegne la normativa, la valuta quando e' dichiarata;
- DORA "non lo so": DORA non valutata, 52 obblighi, zero gap, motivo che cita la risposta data.

Prova della soglia di riuso: un risultato salvato marcato come v26, con gli stessi identici input,
non e' stato riusato ed e' stato ricalcolato; subito dopo, con il risultato v27 salvato, un'analisi
identica lo ha riusato in 4,8 secondi con la stessa conformita'.

Tutti i dati di prova sono stati rimossi.

## Rischi e limiti

Un'organizzazione che rientra davvero in una normativa e risponde "non lo so" non vede alcun gap su
quella normativa: la scelta e' voluta, perche' un gap falso su 52 obblighi e' peggio di una
normativa dichiarata non valutata, ma chi legge il referto deve guardare il riquadro delle
normative non valutate, che per questo sta sopra le schede e nel PDF.

Su un'analisi gia' conclusa non si possono ancora correggere le dichiarazioni: per valutare una
normativa rimasta non valutata serve una nuova analisi. E' annotato come GAP-12.

Le domande che restano facoltative, per esempio le caratteristiche dei sistemi di IA o le
condizioni del GDPR, continuano a lasciare "da verificare" i singoli obblighi che ne dipendono,
come prima e senza gap.

## Prossimo passo

GAP-12: permettere di rispondere alla domanda di ambito dalla pagina dell'analisi e rifare solo la
normativa interessata, usando il rifacimento esplicito gia' esistente. Poi validare su documenti
reali di un'entita' finanziaria o di un fabbricante il comportamento del motore quando una
normativa settoriale e' dichiarata applicabile: oggi e' misurato solo sul GDPR.
