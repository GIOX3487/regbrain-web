# Corpus normativo versionato

Testi che i server di Supabase non possono scaricare da soli (Normattiva e Gazzetta Ufficiale
bloccano le connessioni) e che vengono quindi caricati nel RAG dal repository.

- `leggi/<CODICE>.akn.xml`: legge in XML Akoma Ntoso. `<CODICE>` è la chiave della fonte nel
  catalogo di `supabase/functions/ingest-web-source` (per esempio `LEGGE_IA`).
- `leggi/<CODICE>.md`: stessa cosa in Markdown con articoli `## Art. N.` o `### Art. N.`.

Ogni push su `main` che modifica questi file avvia il workflow `corpus-ingest.yml`, che
sostituisce la fonte nel RAG (cancella le righe precedenti e ricarica con gli embedding).
Per ricaricare a mano: Actions, "Carica corpus normativo nel RAG", Run workflow.

| File | Atto | Testo | Origine |
|---|---|---|---|
| `leggi/LEGGE_IA.akn.xml` | L. 23 settembre 2025, n. 132 (intelligenza artificiale) | pubblicato in GU n. 223 del 25/9/2025 | PDF della GU fornito da Matteo, convertito il 22/9/2026 |
| `leggi/LEGGE_90_2024.akn.xml` | L. 28 giugno 2024, n. 90 (cybersicurezza nazionale e reati informatici) | pubblicato in GU n. 153 del 2/7/2024; non include le modifiche successive (per esempio art. 28 della L. 132/2025) | PDF della GU fornito da Matteo, convertito il 22/9/2026 |

Il testo in GU è quello originario: quando esiste una versione vigente diversa conviene
sostituirlo con l'esportazione Akoma Ntoso "vigente" di Normattiva, con lo stesso nome di file.
