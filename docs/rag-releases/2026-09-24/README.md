# Rilascio fonti GDPR — 23–24 settembre 2026

Pacchetto dati per 22 documenti e 929 passaggi, ricavati da sei PDF forniti dall’utente.
La raccolta «Applicare il GDPR. Le linee guida europee (2019)» è stata rielaborata con
l’archivio OCR fornito dall’utente: 548 pagine presenti, 83 tabelle reinserite nel testo.
I documenti singoli su profilazione, DPO, legittimo interesse, sanzioni e DPIA usano
l’estrazione testuale del PDF. Le copie degli stessi documenti nella raccolta sono escluse.
La firma JPG non è una fonte normativa e non viene indicizzata.

## Contenuto e riproducibilità

- manifest.json: identificativi, provenienza, hash SHA-256, versioni, intervalli di pagine.
- chunks.jsonl: testo effettivo e intestazione usati per ciascun vettore.
- verification.json: controlli effettivi e risultati di ricerca in produzione.
- Embedding: gemini-embedding-001, RETRIEVAL_DOCUMENT, 768 dimensioni, normalizzazione L2.
- Query di ricerca: stesso modello, RETRIEVAL_QUERY, 768 dimensioni.

I vettori sono stati generati nello staging e copiati nel database di produzione solo
dopo il confronto esatto di testo e intestazione. Il rilascio scrive documents,
structured_chunks e chunks; non richiede migrazioni, nuove funzioni di produzione,
bucket pubblici, modifiche alle politiche di accesso o rilasci del frontend.

Questa cartella è un archivio di rilascio, non un ingresso dell’importatore automatico
di corpus/. Non copiare qui credenziali o chiavi e non ricalcolare i vettori di un testo
diverso riusando quelli precedenti. Per correggere un passaggio: aggiornare il testo,
rigenerare il vettore, verificare la ricerca e sostituire entrambe le copie del passaggio.

## Limiti e decisioni

Su richiesta esplicita dell’utente, nessun avviso tecnico OCR è aggiunto alle intestazioni
visibili al RAG; la revisione integrale viene rinviata allo staging. La verifica OCR
effettuata è strutturale e a campione: non equivale a revisione legale di tutte le pagine.
I documenti storici o superati conservano invece avvertenze sostanziali sulla versione.

Le URL rimandano alle pagine ufficiali delle fonti, non a nuovi PDF ospitati dal progetto.
Le citazioni di pagina si riferiscono agli originali forniti, identificati tramite hash.
Non tutti i documenti della raccolta sono l’ultima versione disponibile. Le fonti
interpretative non sono nuovi obblighi aggiunti al catalogo della gap analysis.

I test di ricerca non misurano l’accuratezza legale o la qualità complessiva delle risposte
AI. Restano da verificare in staging risposte complete, tabelle e note, aggiornamento
delle versioni e uso corretto delle fonti storiche (RAG-11).
