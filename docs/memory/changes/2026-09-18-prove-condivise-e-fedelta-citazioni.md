---
date: 2026-09-18
author: Matteo Piccirilli, agente Claude (Opus 5)
roadmap_ids: ["GAP-07", "GAP-08"]
state_review: updated
state_reason: Va registrata la verifica sulla fedelta' delle citazioni, che non era mai stata misurata sugli esiti reali, e la correzione sulle prove condivise fra piu' obblighi.
roadmap_review: updated
roadmap_reason: Aggiunto GAP-08 per le due voci di catalogo sovrapposte, che richiede una decisione legale e non e' correggibile in autonomia.
files: ["supabase/functions/gap-analysis/index.ts", "src/pages/AssessmentDetail.tsx", "docs/memory/STATE.md", "roadmap.md"]
---

## Richiesta e contesto

Quarta verifica sulla qualita' della gap analysis, dopo l'integrazione della v23. Questa volta sul
punto che il prodotto vende: la fedelta' delle citazioni. La misura e' stata fatta sugli esiti reali
della versione in produzione, confrontando ogni citazione con il testo del documento indicato.

## Modifiche e motivazione

La verifica ha dato esito positivo sulla fedelta' e ha trovato un difetto di presentazione.

Cinque frasi sostenevano piu' di un obbligo. Una riga della procedura diritti degli interessati
("Diritti: accesso, rettifica, cancellazione, limitazione, portabilita'...") reggeva quattro
constatazioni diverse, e la riga sul protocollo delle istanze altre quattro. Il referto presentava
ciascuna come una constatazione indipendente: il lettore vede otto esiti dove la debolezza
documentale e' una sola, e il conteggio dei gap risulta gonfiato.

Ogni voce di `evidence` porta ora `shared_with`, il numero di altri obblighi che poggiano sulla
stessa frase, calcolato a fine analisi confrontando le citazioni normalizzate. Nel dettaglio del
requisito compare la riga "questa stessa frase sostiene anche N altri obblighi: la carenza
documentale e' una sola". Nessuna modifica al giudizio, agli stati o alle gravita': e' un
intervento di sola presentazione, quindi non puo' peggiorare l'accuratezza.

`CHECKS_VERSION` passa a v24.

## Verifiche ed esiti

Fedelta' delle citazioni, misurata sugli esiti della versione in produzione prima della modifica:
60 citazioni, 61 segmenti (una citazione conteneva un'elisione marcata con [...], che il motore
ammette verificando separatamente le due parti), **61 segmenti su 61 presenti alla lettera nel file
citato**, zero attribuzioni sbagliate. Il confronto e' stato fatto normalizzando spazi e apostrofi
tipografici, senza altre tolleranze.

Qualita' delle prove: lunghezza media della citazione 154 caratteri; nessun requisito documentato
poggia su una citazione sotto gli 80 caratteri; 2 requisiti documentati su 14 hanno una sola prova,
gli altri due o piu'.

Dopo la modifica, rieseguendo il fascicolo sulla v24 pubblicata dal branch: 17 documentati, 10
parziali, 1 mancante, 10 da verificare, 13 non applicabili, conformita' 79 per cento, rischio 27,
quota valutata 0,74 e percentuale dichiarata rappresentativa. Su 59 citazioni, **65 segmenti su 65
verbatim** e 15 citazioni marcate come condivise. La base di calcolo introdotta con la v23 continua
a funzionare.

`deno check` verde sulla funzione, `tsc` e `npm run build` verdi.

## Rischi e limiti

La marcatura confronta le citazioni normalizzate: due frasi che dicono la stessa cosa con parole
diverse non vengono riconosciute come la stessa prova. Copre il caso osservato, la citazione
identica, non la sovrapposizione semantica.

La verifica sulla fedelta' e' su un fascicolo solo, otto documenti di testo leggibile. Non dice
nulla sul comportamento con PDF scansionati, testo su piu' colonne o documenti molto lunghi, dove
l'estrazione puo' introdurre differenze che fanno fallire il confronto alla lettera.

Restano aperti due punti che non sono correggibili in autonomia:

- GAP-07, la riproducibilita': 47 esiti identici su 51 fra due esecuzioni. Il rimedio richiede di
  scrivere per ciascun obbligo il nucleo di elementi che la norma impone davvero, distinto
  dall'elenco delle prove desiderabili. L'elenco attuale in `evidence_expected_it` non serve allo
  scopo: descrive la documentazione ideale, non il minimo di legge, e usarlo come lista di controllo
  reintrodurrebbe il difetto corretto con la v22;
- GAP-08, le voci di catalogo degli articoli 29 e 32 paragrafo 4: stesso titolo, stessa fonte,
  stessa conclusione scritta due volte. Unificarle e' una decisione legale, perche' entrambi gli
  articoli prevedono l'obbligo; se si uniscono il catalogo passa da 254 a 253 e vanno aggiornati il
  pitch e il sito, che citano 254.

## Prossimo passo

Far decidere al Chief Legal Officer su GAP-08 e sul nucleo di elementi obbligatori per il GDPR, che
sblocca GAP-07.
