# Ingestione normativa da EUR-Lex (article-aware)

La base di conoscenza normativa del RAG viene costruita dalla edge function
`ingest-eurlex-formex`, che scarica il testo vigente in italiano dal Cellar
dell'Ufficio delle pubblicazioni (formato Formex XML) e lo spezza in unità
citabili: articolo, paragrafo, considerando, parte di allegato.

Ogni unità viene salvata in `structured_chunks` con i metadati
(`regulation`, `article_number`, `paragraph`, `section_hierarchy`,
`citation_label`, `chunk_key`, `context_header`) e, in copia, in `chunks`
(contenuto = intestazione + testo) così che tutte le strategie di
`rag-query` lavorino sullo stesso testo pulito. L'embedding è
`gemini-embedding-001` a 768 dimensioni, normalizzato, calcolato su
intestazione + testo.

## Catalogo

| Codice | CELEX vigente | Considerando da |
| --- | --- | --- |
| GDPR | 02016R0679-20160504 | 32016R0679 |
| NIS2 | 02022L2555-20221227 | 32022L2555 |
| DORA | 32022R2554 | 32022R2554 |
| AI_ACT | 02024R1689-20260727 | 32024R1689 |
| CRA | 02024R2847-20241120 | 32024R2847 |
| DATA_ACT | 32023R2854 | 32023R2854 |

Le versioni consolidate non contengono i considerando: vengono letti
dall'atto base. Se un CELEX consolidato non è disponibile la funzione usa
il successivo della lista.

## Esecuzione

Autenticazione con la chiave di servizio (header `apikey` o `Authorization`)
oppure con un utente `admin`.

```bash
# anteprima senza scrittura
curl -X POST "$SUPABASE_URL/functions/v1/ingest-eurlex-formex" \
  -H "apikey: $SERVICE_ROLE_KEY" -H "Content-Type: application/json" \
  -d '{"regulation":"AI_ACT","dryRun":true}'

# ingestione completa, a lotti di 120 unità (ripetere con offset = nextOffset)
curl -X POST "$SUPABASE_URL/functions/v1/ingest-eurlex-formex" \
  -H "apikey: $SERVICE_ROLE_KEY" -H "Content-Type: application/json" \
  -d '{"regulation":"AI_ACT","reset":true,"offset":0,"limit":120}'
```

`reset: true` con `offset: 0` cancella le unità precedenti dello stesso
documento prima di reinserirle. Le chiamate successive (`offset` crescente)
sono idempotenti per `chunk_key`. All'ultimo lotto (`done: true`) la funzione
chiama `rebuild_embedding_indexes()`: gli indici HNSW perdono richiamo dopo
cancellazioni e reinserimenti massivi e vanno ricostruiti, altrimenti la
ricerca vettoriale restituisce vicini sbagliati.

## Stato al 15 settembre 2026

Sei norme, 2.905 unità, tutte con embedding. Il vecchio corpus da ZIP è in
`archive_chunks_zip_20260908` e `archive_structured_chunks_zip_20260908`
(migration `20260915130000_archive_zip_corpus.sql`).

Deploy: backend via GitHub Actions (supabase-deploy.yml), frontend via Vercel a ogni push su main.
