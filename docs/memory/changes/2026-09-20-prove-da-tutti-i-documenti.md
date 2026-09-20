---
date: 2026-09-20
author: Matteo Piccirilli, agente Claude (Opus 5)
roadmap_ids: ["GAP-07", "GAP-09", "GAP-10"]
state_review: updated
state_reason: Va registrata la verifica del 20 settembre sulla v25, che ha trovato tre difetti misurabili, e l'effetto della correzione v26 sugli stessi numeri.
roadmap_review: updated
roadmap_reason: Aggiunto GAP-10 per l'instabilita' degli esiti fra giri identici, che resta aperta dopo la correzione, e aggiornati GAP-07 e GAP-09 con le misure nuove.
files: ["supabase/functions/gap-analysis/index.ts", "docs/memory/STATE.md", "roadmap.md"]
---

## Richiesta e contesto

E' stato chiesto se la gap analysis, allo stato della v25 gia' in produzione, sia precisa,
veritiera e vendibile. La verifica e' stata fatta sul fascicolo reale di Infoteam, diciassette
documenti GDPR veri caricati il 19 settembre, confrontando il giro fatto dall'utente in produzione
con due giri riprodotti su un utente di prova con le stesse identiche risposte al questionario.
Trovati tre difetti misurabili, e' stato poi chiesto di correggerli se la precisione poteva
migliorare in modo sensibile. La correzione e' stata scritta, distribuita su un ramo e rimisurata
sullo stesso fascicolo con quattro giri indipendenti prima di proporla per l'integrazione.

## Cosa e' stato misurato sulla v25

Le citazioni reggono: 112 su 112 sono presenti alla lettera nel documento indicato, nessuna
attribuzione sbagliata, lunghezza media 183 caratteri. Nessuna ricaduta a parole chiave in nessun
giro. Gli elementi dichiarati mancanti non sono piu' copiati dal catalogo: 3 su 44 e 3 su 54,
contro i 56 su 109 del 19 settembre.

Tre difetti, tutti riprodotti piu' volte:

- Quattro documenti su diciassette non venivano mai letti. Su 219 citazioni prodotte in tre giri
  non comparivano mai la comunicazione del DPO al Garante, la politica di gestione degli incidenti,
  una delle due procedure di valutazione fornitori e il verbale del corso. La causa era il tetto di
  4200 caratteri di estratto per requisito: con sezioni lunghe in media 1100 caratteri entravano
  tre o quattro sezioni, e le prendeva il documento piu' prolisso sul tema. La sola Procedura
  diritti interessati raccoglieva 69 citazioni su 219. Effetto verificabile: l'articolo 37
  risultava parziale in tutti e tre i giri chiedendo la ricevuta di comunicazione al Garante e la
  pubblicazione dei contatti del DPO, che stanno scritte per esteso nel file mai letto.
- Le risposte al questionario non arrivavano al modello. profileFactsForPrompt costruiva le
  etichette da APPLICABILITY_RULES, che non contiene nessuna voce GDPR: in un'analisi di solo GDPR
  al modello arrivava la sola dimensione dell'organizzazione. Insieme alla rete di sicurezza che
  riapre un obbligo escluso quando i documenti ne coprono meta' delle parole chiave, questo
  produceva un gap muto sull'articolo 9 in tutti e tre i giri, nonostante la dichiarazione di non
  trattare categorie particolari, e lasciava l'articolo 44 fra i da verificare mentre gli articoli
  45, 46, 47, 48 e 49 erano non applicabili per la stessa risposta.
- Gli esiti cambiavano fra giri identici. Conformita' 64, 57 e 57 per cento; profilo di rischio 38,
  46 e 50; gap 19, 22 e 22. Su 51 obblighi, 40 ricevevano lo stesso esito nei tre giri e 11 no. La
  soglia dell'etichetta cade in mezzo a quell'intervallo: 64 per cento si legge "Sufficiente",
  57 per cento si legge "Insufficiente".

## Modifiche e motivazione

Tutte in `supabase/functions/gap-analysis/index.ts`, versione portata a
`gap-analysis-v26-prove-da-tutti-i-documenti`, che invalida cache e avanzamenti della v25.

La scelta degli estratti passa da un giro solo a due. Nel primo entra al massimo una sezione per
documento, in ordine di punteggio e saltando le sezioni oltre 1500 caratteri, cosi' un documento
breve e pertinente non viene escluso da un documento lungo che occupa da solo mezzo spazio. Nel
secondo giro lo spazio rimasto va alle sezioni migliori, fino a tre per documento. Il tetto per
requisito passa da 4200 a 9000 caratteri e il numero massimo di sezioni da dieci a dodici: nella
simulazione fatta sugli embedding reali del fascicolo, con 7000 caratteri la comunicazione al
Garante restava fuori per otto caratteri di budget.

Le etichette delle condizioni GDPR vengono ora aggiunte a quelle delle regole per espressione
regolare, cosi' le risposte date al questionario arrivano davvero al modello. Sono scritte come
condizioni che ricorrono o non ricorrono, non come qualifiche in cui rientrare, e accompagnate
dall'istruzione di usare "not_applicable" quando una condizione e' stata dichiarata assente, salvo
che un estratto mostri il contrario.

Quando invece i documenti smentiscono la dichiarazione, l'obbligo non produce piu' un gap muto: se
il modello lo giudica mancante o parziale, lo stato diventa "da verificare" e il giudizio dice per
esteso che all'avvio era stato dichiarato il contrario e che va confermato quale delle due cose
vale. Chi ha compilato il questionario e' l'unico che puo' sciogliere il contrasto, e uno stato
"da verificare" non porta con se' carenze ne' azioni.

## Verifiche ed esiti

Controllo dei tipi con deno pulito. Quattro giri indipendenti sullo stesso fascicolo con la v26
distribuita sul ramo, ogni volta svuotando la cache per avere un campione vero.

- L'articolo 37 cita ora la comunicazione al Garante in tutti e quattro i giri e la carenza falsa
  sulla ricevuta e sulla pubblicazione dei contatti e' sparita; restano richiesti l'atto formale di
  nomina e la valutazione delle competenze, che nel fascicolo davvero non ci sono.
- L'articolo 9 esce "da verificare" con il contrasto spiegato in tutti e quattro i giri, l'articolo
  44 esce non applicabile in tutti e quattro, coerente con gli articoli 45, 46, 47, 48 e 49.
- I documenti citati passano da tredici a quattordici su diciassette. I tre che restano fuori sono
  il verbale del corso, illeggibile perche' scansionato, e le due schede fornitori gemelle di altre
  due che invece vengono citate.
- Le citazioni non peggiorano: 98 su 98 presenti alla lettera, nessuna attribuzione sbagliata,
  lunghezza media 170 caratteri.
- Conformita' 68,8, 65,0, 68,8 e 62,9 per cento: oscillazione di 5,9 punti contro i 7 della v25, e
  tutti e quattro i giri restano dentro la stessa etichetta. Obblighi con lo stesso esito in tutti
  e quattro i giri: 43 su 51. Differenza media fra due giri qualsiasi: 4,5 obblighi su 51, contro i
  7 e gli 8 misurati sulla v25.
- Le cinque valutazioni prese di mira sono stabili su quattro giri: articolo 32 parziale, articolo
  37 parziale, articolo 44 non applicabile, articolo 8 parziale, articolo 9 da verificare.

Tutti i dati di prova sono stati rimossi: utente temporaneo, assessment, documenti, embedding,
gap, cache e funzioni di appoggio. Contati a zero dopo la pulizia.

## Rischi e limiti

L'instabilita' resta, ridotta ma non risolta: 4,5 esiti su 51 cambiano fra due giri identici, e la
conformita' oscilla ancora di quasi sei punti. Finche' e' cosi', il numero unico di sintesi non e'
un dato da mettere in un'offerta, mentre i singoli esiti con citazione lo sono. L'articolo 36 e'
l'unico dei cinque sorvegliati ancora ballerino, non applicabile in tre giri su quattro e coperto
nel quarto.

Il tetto di 9000 caratteri per requisito aumenta di circa il doppio il testo mandato al modello
rispetto alla v25. Nei quattro giri di prova l'analisi ha continuato a chiudersi in una sola
invocazione, ma su fascicoli piu' grandi puo' servire una seconda chiamata: il frontend la gestisce
gia' con `continue: true`, quindi l'effetto per l'utente e' solo un'attesa piu' lunga.

Il verbale del corso di formazione resta illeggibile perche' e' una scansione senza testo: nessuna
modifica al recupero puo' farlo entrare, serve il riconoscimento ottico dei caratteri.

Il salto della v25, da 20 per cento il 19 settembre a 64 per cento lo stesso giorno sullo stesso
fascicolo, dipendeva dal questionario compilato e dalle correzioni sui parziali, non dal recupero.
Va tenuto presente prima di confrontare numeri prodotti da versioni diverse.

## Prossimo passo

Rimisurare l'instabilita' su un secondo fascicolo reale diverso da Infoteam, per capire se i 4,5
esiti su 51 sono una caratteristica del motore o di questo fascicolo. Se il numero regge, valutare
un secondo passaggio di consenso sui soli obblighi che oscillano, non su tutti e 51, perche' la
temperatura e' gia' a zero e la variabilita' nasce dalla composizione dell'estratto. Resta prima di
tutto GAP-07: il nucleo minimo obbligatorio in revisione presso la CLO e' cio' che toglierebbe al
modello la liberta' di scegliere ogni volta quali elementi pretendere.
