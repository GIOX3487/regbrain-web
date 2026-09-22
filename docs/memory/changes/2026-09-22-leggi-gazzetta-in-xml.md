---
date: 2026-09-22
author: Matteo Piccirilli, agente Claude (Opus 5)
roadmap_ids: ["RAG-10"]
state_review: updated
state_reason: Lo stato diceva che L. 132/2025 e L. 90/2024 mancavano perché Normattiva non è raggiungibile; ora sono nel corpus, convertite dai PDF della Gazzetta, e va registrato da dove arriva il testo e come si caricano le prossime.
roadmap_review: updated
roadmap_reason: RAG-10 elencava sei leggi da caricare: due sono caricate, per le altre quattro serve la versione vigente e il prossimo passo cambia.
files: ["corpus/README.md", "corpus/leggi/LEGGE_IA.akn.xml", "corpus/leggi/LEGGE_90_2024.akn.xml", "scripts/ingest-corpus.mjs", ".github/workflows/corpus-ingest.yml", "supabase/functions/ingest-web-source/index.ts", "docs/memory/STATE.md", "roadmap.md"]
---

## Richiesta e contesto

Matteo ha scaricato in una cartella i fascicoli della Gazzetta Ufficiale con le leggi che i
server di Supabase non riescono a scaricare (Normattiva e la Gazzetta rifiutano la connessione)
e ha chiesto di convertirle in XML e di addestrarci il RAG.

I file erano sette fascicoli interi della Gazzetta, non i singoli atti: L. 132/2025 (IA),
L. 4/2004 (Stanca), DL 105/2019 (perimetro cibernetico), L. 90/2024 (cybersicurezza),
L. 633/1941 (diritto d'autore), L. 300/1970 (Statuto dei lavoratori) e il D.Lgs. 138/2024,
che era già nel corpus.

## Modifiche e motivazione

- Nuova cartella `corpus/leggi` con i testi in XML Akoma Ntoso, generati dai PDF: colonne
  ricomposte nell'ordine di lettura, righe di testata e piè di pagina scartate, sillabazione di
  fine riga ricucita, capi e rubriche riconosciuti, un `<paragraph>` per comma.
- `scripts/ingest-corpus.mjs` e il workflow `corpus-ingest.yml`: a ogni push su `main` che tocca
  `corpus/`, il file cambiato viene caricato in `ingest-web-source` con la chiave di servizio,
  letta al momento dall'API di gestione Supabase e mascherata nei log. Il nome del file è il
  codice della fonte nel catalogo. Serviva un percorso ripetibile: passare i testi a mano via SQL
  costa molto e non lascia traccia di cosa è stato caricato.
- `ingest-web-source`: i commi lunghi in XML ora si spezzano a fine frase come negli altri
  formati (l'art. 16 della L. 90/2024 è un unico comma da 11.000 caratteri e l'embedding ne legge
  8.000), e ogni articolo porta con sé il capo in cui si trova.

Caricate solo le due leggi il cui testo in Gazzetta è ancora quello in vigore:

| Atto | Unità caricate |
| --- | --- |
| L. 132/2025, intelligenza artificiale | 28 articoli, 90 commi |
| L. 90/2024, cybersicurezza nazionale | 24 articoli, 46 commi |

Non caricate, per scelta: L. 4/2004 e DL 105/2019 (le pagine del testo sono immagini senza testo
o il testo originario è stato riscritto dalla legge di conversione e dalle modifiche successive),
L. 300/1970 e L. 633/1941 (fascicoli scansionati e testi del 1970 e del 1941 lontanissimi da
quelli vigenti: l'art. 4 dello Statuto è stato riscritto nel 2015 e le norme sul software sono
state inserite nella legge sul diritto d'autore nel 1992). Caricarli darebbe risposte sbagliate
con l'aria di essere fondate.

## Verifiche ed esiti

- Conversione controllata articolo per articolo su entrambe le leggi: numeri, rubriche e capi
  corrispondono al testo della Gazzetta; XML valido (`xmllint`).
- `npm run check:edge`, `npm run test:backend`, `tsc` e `npm run build` senza errori.
- Caricamento in produzione e domande di prova al RAG dopo il merge.

## Rischi e limiti

- Il testo è quello pubblicato in Gazzetta: le modifiche successive non ci sono. La L. 90/2024 è
  già stata modificata dall'art. 28 della L. 132/2025 (art. 1 comma 1 e nuovo art. 15-bis).
- Il workflow aspetta 150 secondi prima di caricare, per lasciare finire il deploy delle funzioni
  quando lo stesso push le tocca: se il deploy è più lento, il caricamento va rilanciato a mano.
- Il caricamento sostituisce la fonte: durante i pochi minuti del ricaricamento il RAG non ha
  quel testo.

## Prossimo passo

Chiedere a Matteo l'esportazione "vigente" da Normattiva (XML Akoma Ntoso, o PDF) di L. 300/1970,
L. 633/1941, L. 4/2004 e DL 105/2019, e del D.Lgs. 138/2024 aggiornato; convertirle con lo stesso
percorso e metterle in `corpus/leggi`. Poi rimisurare le domande di prova sul lavoro dipendente,
sull'accessibilità e sul software, dove oggi il corpus risponde solo con fonti indirette.
