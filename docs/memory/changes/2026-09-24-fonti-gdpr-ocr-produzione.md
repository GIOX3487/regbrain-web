---
date: 2026-09-24
author: Giovanni con Codex
roadmap_ids: ["RAG-11"]
state_review: updated
state_reason: Documenta i dati realmente pubblicati, i test di recupero e la rimozione autorizzata delle vecchie copie.
roadmap_review: updated
roadmap_reason: Aggiunge la revisione delle fonti OCR e il difetto misurato nella ricerca approssimata.
files: ["docs/memory/STATE.md","roadmap.md","docs/memory/DECISIONS.md","docs/rag-releases/2026-09-24/README.md","docs/rag-releases/2026-09-24/manifest.json","docs/rag-releases/2026-09-24/chunks.jsonl","docs/rag-releases/2026-09-24/verification.json"]
---

## Richiesta e contesto

Giovanni ha richiesto la pubblicazione in produzione dei PDF GDPR, inclusa ValutazioneImpattoRev.pdf,
per una presentazione al cliente. Il 23 settembre ha fornito il nuovo archivio OCR della raccolta
2019 e ha chiesto di rinviare la revisione integrale, senza avvisi tecnici OCR nell’app.

## Modifiche e motivazione

Rilascio dati già effettuato: 22 documenti, 929 nuovi passaggi vettorializzati e verificati nelle due
tabelle RAG. La PR conserva manifest, testo effettivo, esiti e memoria condivisa; non distribuisce
codice applicativo. Sono recuperate 548 pagine e 83 tabelle. I PDF singoli sostituiscono i capitoli
duplicati della raccolta, compresa la DPIA. La firma JPG è esclusa. Le 163 vecchie copie WP259/WP260
sono state rimosse, dopo backup e autorizzazione esplicita di Giovanni: il controllo finale
conferma esattamente 929 passaggi in ciascuna tabella, senza anomalie.

## Verifiche ed esiti

Sei hash di originali e 929 hash di passaggi verificati. Tutti i nuovi vettori hanno 768 dimensioni,
norma unitaria e modello gemini-embedding-001; nessuna divergenza fra testo, intestazione e copia
nelle due tabelle. Staging: dieci casi su dieci trovano la fonte attesa. Produzione: dieci su dieci
con filtro normativo, nove su dieci con match_chunks a soglia 0,55 e 20 risultati. Il caso DPIA
fallito nel recupero approssimato passa nella ricerca esatta. I 18 test del validatore memoria
passano. Nessun test AI end-to-end o nuova percentuale di accuratezza legale dichiarata.

## Rischi e limiti

Le 163 copie obsolete WP259/WP260 sono state eliminate solo dopo autorizzazione esplicita
di Giovanni, conferma dei sostituti e backup locale completo. Nessun altro documento è stato
eliminato. Conteggio e prove di ricerca ripetuti dopo la pulizia con gli stessi risultati. Anche la chiusura anticipata del worker staging è stata rifiutata:
resta il limite temporale già configurato alle 09:50 UTC del 24 settembre e l’autenticazione
ristretta all’operatore di prova. Le versioni storiche restano marcate; non tutte le fonti sono
l’ultima versione disponibile. L’OCR è controllato strutturalmente e a campione, non integralmente.

## Prossimo passo

RAG-11: indagare il recupero approssimato della consultazione preventiva DPIA e
revisionare testi, tabelle, note e versioni nello staging. Conservare distinta la misura di
recupero dei documenti dall’accuratezza delle risposte e della gap analysis.
