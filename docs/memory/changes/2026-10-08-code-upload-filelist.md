---
date: 2026-10-08
author: Giovanni Sollami con Codex
roadmap_ids: ["CODE-01"]
state_review: updated
state_reason: Documentata la riproduzione del caricamento incompleto e il collaudo del servizio reale.
roadmap_review: updated
roadmap_reason: Aggiornato CODE-01 con la correzione della lettura e il collaudo del pulsante.
files: ["src/lib/code-check/local-scan.ts","src/pages/CodeCheck.tsx","deployment/code-upload.test.mjs","package.json","docs/memory/STATE.md","roadmap.md"]
---

## Richiesta e contesto

L'utente segnala una cartella conteggiata come un solo file e il messaggio «Verifica non riuscita».
Base ispezionata: main 845857b431fa62a63df73f06600b86a2e592116e. Seguito di CODE-01 e del registro
2026-10-05-verifica-codice-copertura-requisiti.md. Il metodo di caricamento originario non è noto.

## Modifiche e motivazione

La pagina azzerava input.value subito dopo avere passato il FileList al lettore asincrono.
Al primo await file.text() la lista viva poteva svuotarsi. Ora collectFiles cattura subito tutti
i riferimenti; anche i due selettori passano un array stabile. Resettato l'esito precedente prima
di una nuova lettura; finalmente viene sempre ripristinato lo stato di attesa, anche per cartelle
vuote ed errori nella traversata delle cartelle trascinate. Quattro test di regressione aggiunti
al comando test:backend, già eseguito dalla CI. Nessun cambiamento a regole, auth, RAG o database.

## Verifiche ed esiti

- Regressione prima del fix: 1 file su 120. Dopo: 120 su 120, caratteri e inventario completi.
- Test di filtri, ZIP, trascinamento con 101 file in più lotti e sottocartelle: superati.
- Tutte le suite deployment/*.test.mjs: 84 test superati.
- TypeScript applicativo: superato. Vite build: superata con avvisi preesistenti su dimensioni
  dei bundle, import misti e dipendenza Bluebird. Sintassi Edge: 39 file, zero errori.
- Browser produzione prima del rilascio: cartella sintetica di 121 file conteggiata come 1,
  confermando il difetto sul sito.
- Sullo stesso browser, sessione demo legittima: «Verifica il codice» produce un referto completo,
  commento AI, requisiti e storico (8 ottobre, 15:36 ora italiana). L'errore rosso non si riproduce.
- Nei log delle 13:07 UTC code-compliance v9 falliva con permission denied su _code_bundle.
  All'ispezione successiva service_role aveva già SELECT e il bundle aveva quattro parti:
  questo agente non ha modificato quei permessi né il loader. La verifica reale successiva
  dimostra il funzionamento attuale, senza attribuire la correzione a questo intervento.

## Rischi e limiti

Questa registrazione precede merge e rilascio del frontend: i test automatici sono locali e
la prova browser descrive il servizio già in produzione. La funzione live v9 usa un loader
temporaneo da _code_bundle, diverso dall'entrypoint su main: la dipendenza operativa va rimossa
con un normale deploy dei sorgenti in un intervento dedicato. I filtri e i limiti dei file restano
quelli esistenti. Il repository originale del socio non è disponibile: prove con dati sintetici.

## Prossimo passo

Integrare la PR dopo i controlli e verificare sulla versione pubblicata che la medesima cartella
produca 121 file nel conteggio e nel referto. Proseguire CODE-01 senza introdurre blocchi al deploy.

