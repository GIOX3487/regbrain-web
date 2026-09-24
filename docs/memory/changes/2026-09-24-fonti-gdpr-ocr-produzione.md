---
date: 2026-09-24
author: Giovanni con Codex
roadmap_ids: ["RAG-11"]
state_review: updated
state_reason: Documenta i dati realmente pubblicati, i test di recupero e la pulizia ancora bloccata.
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
duplicati della raccolta, compresa la DPIA. La firma JPG è esclusa. Le vecchie copie WP259/WP260
sono ancora presenti: la loro rimozione richiede la risposta alla richiesta di autorizzazione.

## Verifiche ed esiti

Sei hash di originali e 929 hash di passaggi verificati. Tutti i nuovi vettori hanno 768 dimensioni,
norma unitaria e modello gemini-embedding-001; nessuna divergenza fra testo, intestazione e copia
nelle due tabelle. Staging: dieci casi su dieci trovano la fonte attesa. Produzione: dieci su dieci
con filtro normativo, nove su dieci con match_chunks a soglia 0,55 e 20 risultati. Il caso DPIA
fallito nel recupero approssimato passa nella ricerca esatta. I 18 test del validatore memoria
passano. Nessun test AI end-to-end o nuova percentuale di accuratezza legale dichiarata.

## Rischi e limiti

163 vecchi passaggi di WP259/WP260 ancora presenti (1.092 complessivi nei 22 documenti), con backup
locale completo delle due tabelle. Due tentativi di pulizia rifiutati dal controllo automatico;
nessuna cancellazione eseguita. Anche la chiusura anticipata del worker staging è stata rifiutata:
resta il limite temporale già configurato alle 09:50 UTC del 24 settembre e l’autenticazione
ristretta all’operatore di prova. Le versioni storiche restano marcate; non tutte le fonti sono
l’ultima versione disponibile. L’OCR è controllato strutturalmente e a campione, non integralmente.

## Prossimo passo

RAG-11: dopo autorizzazione esplicita, rimuovere solo i 163 passaggi obsoleti verificati e ripetere
conteggi e ricerca. Indagare il recupero approssimato della consultazione preventiva DPIA e
revisionare testi, tabelle, note e versioni nello staging. Conservare distinta la misura di
recupero dei documenti dall’accuratezza delle risposte e della gap analysis.
