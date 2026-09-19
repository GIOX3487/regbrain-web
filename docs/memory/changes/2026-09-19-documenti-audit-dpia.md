---
date: 2026-09-19
author: Matteo Piccirilli, agente Claude (Opus 5)
roadmap_ids: ["DOC-01"]
state_review: updated
state_reason: Va registrato che la DPIA non veniva mai generata, che gli altri tre documenti sono risultati corretti alla prova, e come e' stata misurata la cosa.
roadmap_review: updated
roadmap_reason: Aggiunto DOC-01 per la generazione dei documenti audit-ready, mai provata end to end prima d'ora.
files: ["supabase/functions/_shared/ai.ts", "supabase/functions/generate-audit-document/index.ts", "src/pages/AssessmentDetail.tsx", "docs/memory/STATE.md", "roadmap.md"]
---

## Richiesta e contesto

Verificare se la sezione "Genera Documentazione Audit-Ready" produce davvero DPIA, LIA, Analisi
Rischi ex art. 24 e Gap Report in modo preciso, veritiero e corretto rispetto a come andrebbero
redatti per legge, e correggere quello che sbaglia.

Prima constatazione: la tabella `generated_documents` era vuota. Nessuno aveva mai generato un solo
documento, quindi la funzione non era mai stata provata end to end.

## Come e' stata fatta la prova

Copia del fascicolo reale di Infoteam (17 documenti, 19 gap, conformita' 64 per cento) su un utente
di prova, generazione dei quattro documenti chiamando la funzione in produzione, lettura degli esiti
dal database, confronto con quanto la norma impone. Tutto rimosso a fine prova.

## Modifiche e motivazione

Tre interventi: `aiFetch` accetta ora un segnale di timeout passato dal chiamante invece di imporre
sempre un minuto; la generazione dei documenti ne chiede 140; il messaggio di errore mostrato a chi
legge smette di essere "Signal timed out." e diventa una frase che spiega cosa e' successo. In piu'
l'etichetta del pulsante LIA viene corretta e la data odierna viene passata al modello. Il dettaglio
di ciascuno e il motivo per cui servivano sono nelle sezioni che seguono.

## Il difetto grosso: la DPIA non si genera mai

Su quattro documenti tre sono arrivati in fondo e la DPIA e' fallita con `Signal timed out.` dopo 62
secondi.

Causa: `aiFetch` in `_shared/ai.ts` imponeva `AbortSignal.timeout(60000)` a ogni chiamata, senza
possibilita' per il chiamante di chiedere piu' tempo. La DPIA in modalita' standard vale 25-30
pagine equivalenti e ci mette piu' di un minuto. Non era un caso sfortunato: con quel limite la DPIA
non poteva riuscire mai, e infatti dopo la correzione ha impiegato 65 secondi, cinque oltre il
tetto.

`aiFetch` accetta ora un segnale passato dal chiamante e usa il minuto solo come valore di default.
La generazione dei documenti passa 140 secondi, che resta sotto la durata massima dell'invocazione:
se scade, a dichiararlo e' il codice e non l'infrastruttura.

Corretto anche il messaggio mostrato a chi legge. "Signal timed out." non dice niente: ora l'errore
spiega che il servizio non ha completato il documento nel tempo massimo e suggerisce di riprovare o
di usare la modalita' breve. Il messaggio tecnico resta nei metadati per la diagnosi.

## Gli altri tre documenti: corretti

Contrariamente a quanto temevo, la qualita' e' buona e va detto.

**Gap Report.** I numeri coincidono esattamente con l'analisi: 51 requisiti, 13 documentati, 10 non
applicabili, 9 da verificare, 19 gap ripartiti in 5 alti, 7 medi e 7 bassi, conformita' 64 per cento,
profilo alto. Nessun numero inventato.

**LIA.** Base giuridica corretta, art. 6 par. 1 lett. f, con richiamo ai considerando 47 e 49 e alle
linee guida WP217. I tre test richiesti dalla dottrina consolidata ci sono tutti: purpose, necessity,
balancing. Cita a proposito l'art. 32, gli artt. 41 Cost. e 2086 c.c. e lo Statuto dei lavoratori.

Controllo decisivo sui dati aziendali: ragione sociale, indirizzo e partita IVA presenti nel
documento risultano tutti nei file caricati dal cliente (la partita IVA compare in 6 documenti su
17, l'indirizzo in 5, il nome in 15). Non sono inventati, sono estratti. Anche il nome del prodotto
citato compare nei documenti.

**Analisi Rischi art. 24.** Metodologia dichiarata e seria: ISO 31000:2018 ed ENISA, approccio
risk-based orientato ai diritti degli interessati ex art. 24 par. 1, scala di impatto da 1 a 4 con
livelli definiti, catena rischio inerente, misure, rischio residuo, piano di trattamento,
accettazione e monitoraggio. I tre dati che non poteva conoscere (sede, redattore, firma) sono
marcati `[DA COMPLETARE]` invece che inventati.

**DPIA, dopo la correzione.** Tutte e undici le sezioni presenti, piu' checklist GDPR e suggerimenti
di privacy by design. Otto citazioni degli artt. 35 e 36. La decisione finale lega correttamente il
rischio residuo alto alla consultazione preventiva ex art. 36: e' l'adempimento che un generatore
debole dimentica, e qui c'e'. Quattro placeholder per i dati non ricavabili, data di redazione
corretta.

In nessuno dei quattro documenti compaiono importi di sanzione in euro.

## Altre due correzioni

L'etichetta del pulsante LIA diceva "Legitimacy Impact Assessment (AI Act)": sbagliato due volte,
perche' LIA sta per Legitimate Interest Assessment e discende dall'art. 6 par. 1 lett. f del GDPR,
non dall'AI Act. Il documento generato era gia' giusto, era il pulsante a mentire. Ora dice
"Valutazione del legittimo interesse (art. 6.1.f GDPR)".

La data odierna viene ora passata al modello nel prompt. La LIA generata prima della correzione
riportava il giorno successivo a quello reale: su un documento legale una data sbagliata si nota.

## Verifiche ed esiti

Controllo dei tipi del frontend, `deno check` su `generate-audit-document` e su `gap-analysis` (che
condivide `ai.ts`) senza errori. Funzione distribuita dal branch e DPIA rigenerata sul fascicolo
reale: completata in 65 secondi, 66 mila caratteri, stato `completed`.

Database riportato allo stato iniziale: documenti generati, fascicolo copiato, gap, vettori, utente
di prova e funzione temporanea rimossi.

## Rischi e limiti

Il tetto di 140 secondi e' una stima prudente della durata massima dell'invocazione edge, non un
valore letto dalla piattaforma. Se Supabase riducesse quel limite, la DPIA tornerebbe a fallire, ma
con un errore chiaro invece che con "Signal timed out.".

La prova e' su un fascicolo solo, in italiano, sul GDPR. Non dice niente sul comportamento con le
altre cinque normative, con documenti in altra lingua o in modalita' audit, che chiede 40 pagine e
quasi certamente sfora anche i 140 secondi.

Il cambiamento a `ai.ts` tocca tutte le funzioni che lo usano. Il comportamento resta identico per
chi non passa un segnale, ma la superficie toccata e' larga.

La correttezza giuridica e' stata valutata da me sulla struttura e sui riferimenti normativi. Prima
di consegnare uno di questi documenti a un cliente, va letto dalla CLO.

## Prossimo passo

Far leggere alla CLO la DPIA e la LIA generate su un fascicolo reale, che e' l'unica verifica che
conta prima di venderle. Poi provare la modalita' audit, che a 40 pagine sforera' anche il nuovo
tetto, e decidere se spezzare la generazione in piu' chiamate invece di alzare ancora il tempo.
