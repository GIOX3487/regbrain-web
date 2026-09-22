---
date: 2026-09-22
author: Matteo Piccirilli, agente Claude (Opus 5)
roadmap_ids: ["RAG-10"]
state_review: updated
state_reason: Il corpus normativo passa da sei atti UE a fonti per la conformità del software; lo stato deve dire quali fonti esistono, come si caricano e quali mancano.
roadmap_review: updated
roadmap_reason: Aggiunto RAG-10 per il caricamento delle fonti del modulo code compliance, con le leggi italiane ancora da fornire a mano.
files: ["supabase/functions/ingest-eurlex-formex/index.ts", "supabase/functions/ingest-web-source/index.ts", "supabase/functions/rag-query/index.ts", "supabase/config.toml", ".github/workflows/supabase-deploy.yml", "docs/memory/STATE.md", "roadmap.md"]
---

## Richiesta e contesto

Richiesta del 22 settembre: scaricare e caricare nel RAG tutte le normative per la conformità del
codice software applicabili in Italia (elenco concordato in chat), segnalando quelle da fornire a mano.
Accessi di rete verificati: il container e il computer di Matteo raggiungono solo GitHub; il database
e le funzioni Supabase raggiungono Cellar (EUR-Lex), Garante, EDPB, AgID, ACN, W3C, GitHub. Normattiva
e Gazzetta Ufficiale rifiutano le connessioni dai server di Supabase.

## Modifiche e motivazione

- `ingest-eurlex-formex`: catalogo esteso con 17 atti UE (ePrivacy consolidata 2009, DSA, Reg. di
  esecuzione NIS2 2024/2690, tre atti DORA 2024/1774, 2024/1772, 2024/2956, EAA, direttiva
  accessibilità web PA, PSD2 consolidata 2025, RTS SCA 2018/389, eIDAS consolidato 2024, direttiva
  prodotti difettosi 2024/2853, contenuti digitali 2019/770, EHDS, MDR consolidato 2026, direttiva
  software 2009/24, direttiva copyright 2019/790). Versioni consolidate individuate con SPARQL su Cellar.
- Nuova funzione `ingest-web-source`: scarica lato server provvedimenti del Garante (contenuto della
  pagina docweb), PDF di EDPB, AgID e ACN (estrazione per pagine con unpdf, a lotti), Markdown di
  OWASP ASVS 5.0, HTML di WCAG 2.2 e testi SPDX delle licenze; li divide in sezioni con titolo e pagina
  e li salva in structured_chunks e chunks come l'ingestione Formex. Accetta anche testo fornito
  dall'amministratore (XML Akoma Ntoso di Normattiva, un'unità per comma) per le leggi italiane.
- `rag-query`: le configurazioni hanno ora un campo `codes`; aggiunte 25 configurazioni per le nuove
  fonti. I temi generici (consenso, accesso, violazioni, privacy by design, sicurezza del codice)
  includono anche GDPR o CRA tra i documenti, per non restringere la ricerca alla sola linea guida.

## Verifiche ed esiti

`deno check` senza errori sulle due funzioni di ingestione; su `rag-query` restano solo gli errori di
tipo già presenti prima. Esiti del caricamento nel registro successivo.

## Rischi e limiti

Le linee guida EDPB 01/2022 e 9/2022 sono in inglese (nessuna versione italiana trovata). Le leggi
italiane richiedono il file XML di Normattiva fornito a mano. Il riconoscimento dei titoli nei PDF è
euristico: le citazioni riportano sempre la pagina.

## Prossimo passo

Eseguire il caricamento di tutte le fonti raggiungibili e verificarlo con domande di prova (RAG-10).
