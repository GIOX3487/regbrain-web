---
date: 2026-11-24
author: Giovanni Sollami con Codex
roadmap_ids: ["RAG-12"]
state_review: updated
state_reason: Registrata la pubblicazione effettiva delle due fonti ANAC e i controlli sul RAG di produzione.
roadmap_review: updated
roadmap_reason: Aggiunto RAG-12 per separare il caricamento concluso dal collaudo qualitativo delle risposte complete.
files: ["docs/memory/STATE.md","roadmap.md","docs/rag-releases/2026-11-24/manifest.json","docs/rag-releases/2026-11-24/verification.json"]
---

## Richiesta e contesto

Giovanni richiede di caricare nel RAG i due PDF allegati: Linee guida ANAC n. 1/2025 sui canali
interni di segnalazione e relazione illustrativa, delibera 478 del 26 novembre 2025.
Seguita la distinzione fra fonti e obblighi di RAG-D01 e il precedente rilascio del 24 settembre.
Il D.Lgs. 24/2023 è già presente nel corpus sotto WHISTLEBLOWING; non viene sostituito.

## Modifiche e motivazione

Rilascio dati già effettuato nel progetto di produzione ndwozjlasabsdfqcyeoy.
Due documenti con identità separate, metadati di versione e link ai PDF ufficiali ANAC.
Estratti i testi nativi senza OCR, mantenendo pagine e note; divisi in 236 passaggi con
sovrapposizione. Inseriti in structured_chunks e chunks, con vettori Gemini a 768 dimensioni.
La relazione contiene osservazioni anche respinte: il context_header esplicita la differenza
fra proposte dei partecipanti e risposte ANAC. is_obligation=false: nessuna creazione automatica
di obblighi nella gap analysis. La PR registra manifest e verifiche, senza modificare l'app.

## Verifiche ed esiti

- Originali identici byte per byte alle copie ANAC; SHA-256 nel manifest.
- 47 + 88 pagine senza pagine vuote; ricostruzione completa dei testi normalizzati senza salti;
  236 hash verificati. Ispezione visiva delle copertine e pagina 15 di entrambi i PDF.
- Produzione: 78 e 158 passaggi in ciascuna tabella, tutti con vettore a 768 dimensioni;
  zero hash errati e zero divergenze tra testo e vettore delle due tabelle.
- Quattro casi di recupero: 4/4 nei primi cinque risultati con filtro WHISTLEBLOWING,
  4/4 nei primi dieci risultati globali, tramite match_structured_chunks_v2.
- Ripetizione del primo batch: riutilizzati tutti i vettori, nessun duplicato.
- Procedura temporanea limitata al corpus e a una chiave a scadenza: rifiutati anonimi,
  chiave errata e indice non valido. Dopo le verifiche sostituita con risposta HTTP 410,
  senza accesso a database o segreti; chiusura verificata via HTTP.

## Rischi e limiti

I test misurano il recupero delle fonti, non l'accuratezza di risposte AI complete.
La revisione visuale è a campione; i controlli di copertura e integrità interessano tutti i
passaggi. La relazione non deve essere letta come un insieme di prescrizioni definitive.
Nessun documento precedente cancellato, nessuna migrazione e nessun deploy applicativo
necessario per rendere le fonti ricercabili. Credenziali temporanee escluse dal repository.

## Prossimo passo

Caricamento RAG-12 completato e verificato. Integrare questa memoria e, nella revisione
qualitativa successiva, provare risposte complete su casi concreti distinguendo le
osservazioni della consultazione dagli orientamenti definitivi ANAC.
