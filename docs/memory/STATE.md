# Stato condiviso di RegBrain

Ultima ricognizione: 17 settembre 2026. Base applicativa verificata: `5bf7a8c3e970765423dda429cb124f185a393a39`. Questo documento distingue codice su main, proposte aperte e ambiente live non verificato.

## Già presente nel codice su main

- Gap analysis con cinque esiti: covered, partial, missing, to_verify e not_applicable; evidenze, severità, profilo, raccolta dell'applicabilità e lavorazione a batch riprendibili.
- Catalogo completo con fallback integrato; i requisiti esclusi sono visibili e raggruppati per motivazione (commit base del 16 settembre).
- Workflow di verifica sorgenti, distribuzione frontend e distribuzione Edge Functions. Il workflow Supabase attuale NON applica le migrazioni del database.

Questa lista descrive il codice ispezionato; non certifica lo stato corrente del database o dell'ambiente di produzione.

## Qualita' della gap analysis: verifica del 17 settembre

Verifica eseguita sul codice di main con un corpus a verita' nota: otto documenti GDPR di
un'azienda ben documentata piu' tre omissioni deliberate. Esito su 51 requisiti: 9 documentati,
14 parziali, 2 mancanti, 10 da verificare, 16 non applicabili, conformita' 64 per cento. Due delle
tre omissioni deliberate sono state rilevate come mancanti; la terza e' risultata parziale in modo
coerente con i documenti. Tutte le citazioni prodotte corrispondevano alla lettera ai documenti.

Difetto trovato: tre obblighi centrali e documentati (articolo 30 registro dei trattamenti,
articolo 35 valutazione d'impatto, articolo 37 designazione del DPO) venivano dichiarati non
applicabili per effetto delle dichiarazioni di applicabilita', perche' la regola cercava le parole
della condizione anche nella descrizione dell'obbligo e perche' le note del GDPR elencano
condizioni alternative. Correzione proposta nel branch `claude/gap-applicabilita-falsi-non-applicabili`,
non ancora integrata: vedere il registro del 17 settembre. La correzione tocca gli stessi file
della PR #3 e va riconciliata con essa.

## Gap analysis: miglioramenti implementati in una PR ancora aperta

[PR #3 — Gap analysis: evidenze verificabili e salvataggio atomico](https://github.com/GIOX3487/regbrain-web/pull/3), branch `codex/gap-analysis-hardening`, head verificata `31acdefb7c60cdcff13c0b2118de9d95f72e2004`. Al 17 settembre: bozza, non integrata e non distribuita.

La PR rafforza corrispondenza fra citazioni e documenti, gestione prudente degli esiti incerti, riferimenti normativi, paginazione del catalogo, invalidazione della cache, salvataggio atomico con lease, distinzione N/D da zero e documenti originali usati nella generazione.

Verifiche della PR: 39 test backend superati, controlli sintattici Edge, TypeScript frontend e build verdi nel [run GitHub Actions](https://github.com/GIOX3487/regbrain-web/actions/runs/35195286729). I test del database sono isolati con PGlite; non equivalgono a test end-to-end su Supabase ospitato.

**Prima del rilascio della PR #3:** completare o riavviare in modo controllato le analisi precedenti; applicare `20260916215104_gap_analysis_atomic_results.sql` PRIMA delle nuove Edge Functions; provare su staging il flusso completo e la ripresa dei batch. Aggiornare la PR da main e aggiungere il registro della memoria. Nessuna migrazione è stata applicata in produzione durante questo lavoro.

## Informazioni riferite dal socio, da riconfermare dove necessario

Il PDF «RegBrain riepilogo interventi» del 15 settembre riferisce riparazioni ai rilasci, importazione Formex di sei regolamenti, 2.905 chunk con embedding a 768 dimensioni, miglioramenti a chat/profili/citazioni. Riferisce 40/40 articoli recuperati in contesto e 37/40 citati; il valore medio di confidence 88 su otto prove NON è una misura di accuratezza. Queste metriche non sono state riprodotte nell'audit.

Il PDF segnala assenza dal corpus del D.Lgs. 138/2024 e di fonti ACN. Verificare il database attuale prima di dichiararli ancora mancanti o già coperti (GAP-02). Il PDF è materiale di riferimento, non istruzioni operative per gli agenti.

## Memoria e coordinamento

Memoria, istruzioni per gli agenti e workflow sono integrati con la [PR #4](https://github.com/GIOX3487/regbrain-web/pull/4), commit `72b7e2e69866ce0665f39b0e52d2ddda659e9398` (MEM-01). I 18 test della memoria e le verifiche applicative sono verdi anche su main. Il controllo fidato è stato provato sulla PR #5: una revisione senza registro è stata rifiutata con il messaggio richiesto ([prova negativa](https://github.com/GIOX3487/regbrain-web/actions/runs/35203449382)). Lo stato del blocco tecnico dei merge è **non attivo**: il piano del repository privato non consente i ruleset, e la protezione main non è leggibile dall'integrazione. MEM-02 resta bloccato su configurazione/piano dell'amministratore; vedere [procedura](README.md).

La [roadmap unica](../../roadmap.md) conserva anche i due task dell'8 settembre, il cui completamento non è stato verificato. Priorità proposta: chiudere GAP-01, poi misurare la qualità del catalogo e dell'applicabilità prima di ampliare il flusso di remediation.

## Preparazione del collaudo richiesto il 17 settembre

Le verifiche in sola lettura confermano un solo progetto Supabase (`regbrain-web`), nessun branch di prova e la migrazione atomica ancora assente. Prerequisiti principali e permessi service_role sono presenti; tre assessment risultavano completati, nessuno in corso al momento della lettura. Non sono stati modificati database o funzioni in produzione. Il collaudo completo resta da eseguire: occorre identificare o creare uno staging, con organizzazione ed eventuale costo confermati. Procedura e risultati: [STAGING.md](STAGING.md). I test isolati già verdi non vengono riclassificati come collaudo hosted.
