---
date: 2026-09-19
author: Matteo Piccirilli, agente Claude (Opus 5)
roadmap_ids: ["GAP-07", "GAP-09"]
state_review: updated
state_reason: Va registrata la misura sul carico, che Giovanni segnalava come problema e che non si e' riprodotta, e la correzione sulla ricaduta silenziosa a parole chiave.
roadmap_review: updated
roadmap_reason: Aggiunto GAP-09 per la severita' sistematica misurata sul fascicolo Infoteam, che dipende da GAP-07 e ne quantifica l'effetto.
files: ["supabase/functions/gap-analysis/index.ts", "src/pages/AssessmentDetail.tsx", "docs/memory/STATE.md", "roadmap.md"]
---

## Richiesta e contesto

Giovanni ha segnalato che la gap analysis reggerebbe male un carico alto di richieste e non
funzionerebbe bene. E' stata chiesta una verifica del carico e, insieme, dell'accuratezza delle
risposte. Le misure sono state fatte in produzione sul fascicolo reale di Infoteam, sei documenti
GDPR veri caricati il 18 settembre, duplicato su utenti di prova e poi rimosso.

## Misura del carico

Il problema non si e' riprodotto. Tre analisi GDPR in parallelo su utenti distinti: 9,8, 16,2 e
13,5 secondi, esiti 20%, 20% e 21%. Catalogo intero, 250 obblighi su sei normative, in tre
invocazioni: 45 secondi da sola, 61 e 65 secondi con due analisi contemporanee. Su circa 600
chiamate al modello nessuna e' fallita, nessun 429 nei log, nessun requisito e' ricaduto sulla
verifica a parole chiave. La ripartizione a tranche gestita dal frontend regge senza intoppi.

Resta pero' la fragilita' che rende invisibile un guasto quando c'e'. Quando una chiamata AI
falliva tre volte, il requisito ricadeva in silenzio sul metodo a parole chiave: produce un
"parziale" o un "mancante" senza citazioni, con un testo che ha lo stesso aspetto di una verifica
sulle prove. Niente lo segnalava, ne' nel referto ne' all'utente. L'attesa fra un tentativo e
l'altro era di 0,9 e 1,8 secondi, inutile contro una quota calcolata al minuto.

## Modifiche e motivazione

I tentativi passano da tre a quattro e l'attesa diventa progressiva, 1,5, 5 e 12 secondi con
scarto casuale, applicata solo quando il messaggio di errore indica un limite di frequenza o di
quota. L'attesa non sfora mai il tempo dell'invocazione: l'avanzamento e' gia' salvato e la
chiamata successiva riprende da dove si era fermata.

Lo stato finale porta ora `evaluation_quality` con il numero di obblighi valutati dall'AI, quelli
valutati a parole chiave e un flag `complete`. Nel dettaglio dell'assessment compare un avviso
ambra quando la valutazione non e' completa, che dice quanti obblighi non sono stati verificati sul
testo e invita a rilanciare l'analisi. Il conteggio e' derivato dal campo `method` dei singoli
esiti, quindi resta corretto anche quando l'analisi si svolge su piu' invocazioni.

Seconda correzione, indipendente. Un obbligo con stato `to_verify` dichiara che l'applicabilita'
non e' determinabile e contemporaneamente elencava tre o quattro elementi mancanti, copiati dalla
documentazione attesa del catalogo. Le due affermazioni non stanno insieme: dire che manca un
documento presuppone di sapere che quel documento e' dovuto. Sui requisiti da verificare gli
elementi mancanti e le azioni consigliate vengono ora azzerati, come gia' faceva il ramo a parole
chiave. La constatazione testuale resta e spiega perche' l'applicabilita' non e' determinabile.

`CHECKS_VERSION` passa a v25.

## Misura dell'accuratezza

Sulle citazioni il motore e' onesto: 36 segmenti citati su 36 sono presenti alla lettera nel
documento indicato, nessuna attribuzione sbagliata, lunghezza media 158 caratteri.

Sul giudizio e' sistematicamente severo. Sul fascicolo Infoteam, sei documenti GDPR veri, il
risultato e' zero o un obbligo coperto su 51 e una conformita' fra il 20% e il 23% su quattro giri.
Esempi: l'articolo 37 risulta parziale pur essendoci la comunicazione telematica al Garante dei
dati di contatto del DPO, perche' mancherebbero la valutazione delle competenze e l'atto formale di
nomina, che l'articolo non impone per iscritto; gli articoli 29 e 32 par. 4 risultano parziali pur
essendoci le istruzioni scritte a tutto il personale, perche' mancherebbero le lettere individuali
e i registri formativi, che nessun articolo nomina.

La causa e' misurata: su 109 elementi elencati come mancanti, 56 sono copiati alla lettera dal
campo `evidence_expected_it` del catalogo, cioe' dalla lista della documentazione ideale. E' GAP-07.
Il meccanismo introdotto con la v22 per assorbire le voci non obbligatorie nei suggerimenti di
miglioramento risulta usato 9 volte su 51 obblighi: non sta funzionando.

La riproducibilita' invece e' a posto: 20%, 23%, 20% e 21% sullo stesso fascicolo, oscillazione di
tre punti.

## Verifiche ed esiti

Controllo dei tipi del frontend e build completati senza errori, `deno check` sulla funzione senza
errori. Il database e' stato riportato allo stato iniziale: utenti di prova, fascicoli duplicati,
documenti, cache, gap, piani d'azione, vettori e funzioni temporanee rimossi.

## Rischi e limiti

La prova di carico dice che oggi regge, non che reggera' sempre. Il limite di frequenza dipende dal
piano del fornitore AI e dalla quota giornaliera, che non e' leggibile da qui: se la chiave Gemini
e' su piano gratuito, una manciata di analisi complete puo' esaurirla e da quel momento ogni
requisito ricade sulla verifica a parole chiave. La correzione rende il degrado visibile, non lo
impedisce. Va confermato il piano della chiave e, se e' gratuito, va cambiato.

L'attesa progressiva riconosce il limite di frequenza dal testo del messaggio di errore. Un
fornitore che restituisse un 429 con un corpo diverso non verrebbe riconosciuto e ricadrebbe
sull'attesa breve.

L'azzeramento degli elementi mancanti sui requisiti da verificare toglie informazione che qualcuno
potrebbe considerare utile: il lettore vede che l'applicabilita' non e' determinabile e non vede
piu' cosa servirebbe. La scelta e' voluta, perche' quegli elementi erano copiati dalla
documentazione attesa e non da un obbligo accertato, ma va rivista quando il nucleo minimo sara'
disponibile.

La misura dell'accuratezza e' su un fascicolo solo, sei documenti di una PMI italiana. Il 20 per
cento non e' un dato sul prodotto, e' un dato su questo fascicolo con questo catalogo.

## Prossimo passo

GAP-07 resta il difetto dominante e non e' correggibile in autonomia: serve il nucleo minimo
obbligatorio scritto dalla CLO, obbligo per obbligo. La bozza per i 51 obblighi GDPR e' stata
preparata il 18 settembre e consegnata fuori dal repository.

Sul catalogo intero 166 obblighi su 250 finiscono in `to_verify` perche' il questionario di
applicabilita' copre bene solo il GDPR. Il paracadute della v23 marca correttamente il risultato
come non affidabile, ma la percentuale mostrata resta calcolata su 70 obblighi.

Rilanciare la stessa misura sul fascicolo Infoteam appena la CLO restituisce il nucleo minimo
revisionato: e' il confronto che dice se il 20 per cento dipendeva dal metro o dai documenti.
Nel frattempo confermare il piano della chiave Gemini, perche' su piano gratuito la quota
giornaliera e' il vero limite di carico, e portare il questionario di applicabilita' alla stessa
copertura del GDPR sulle altre cinque normative, per ridurre i 166 obblighi che oggi restano da
verificare sul catalogo intero.
