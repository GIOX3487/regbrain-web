# Preparazione del collaudo della gap analysis

Ricognizione del 17 settembre 2026, progetto `regbrain-web` (`ndwozjlasabsdfqcyeoy`). Solo letture di metadati e conteggi aggregati; nessuna modifica al database.

## Ambiente disponibile

- Un solo progetto Supabase accessibile, stato ACTIVE_HEALTHY, PostgreSQL 17, regione eu-west-1.
- Nessun branch Supabase di sviluppo o staging esistente.
- Organizzazione `GIOX3487's Org`, piano free. Prima di creare risorse resta da confermare organizzazione e costo; nessun acquisto o cambio piano autorizzato implicitamente.
- Docker e Supabase CLI non risultano disponibili nel percorso eseguibile locale; non è stato creato un ambiente completo locale.

## Verifiche preliminari della migrazione

La migrazione della PR #3 `20260916215104_gap_analysis_atomic_results.sql` non compare nella cronologia del database. Non esistono ancora `gap_analysis_leases` e le tre funzioni acquire/save/finalize proposte.

Le tabelle e le colonne principali richieste dalla migrazione sono presenti. `assessment_requirement_checks` ha chiave primaria composta `(assessment_id, requirement_id)` e riferimento all'assessment con cancellazione a cascata. Il ruolo service_role ha SELECT/INSERT/UPDATE/DELETE sulle quattro tabelle coinvolte. Queste verifiche riducono il rischio di incompatibilità ma non sostituiscono l'applicazione su staging.

Al momento della lettura erano presenti tre assessment completati e nessuno in corso. Ricontrollare immediatamente prima di un rilascio: il dato non è una garanzia per il futuro.

## Collaudo da eseguire su ambiente isolato

| Caso | Esito atteso | Stato |
| --- | --- | --- |
| Migrazione | Creazione oggetti, privilegi limitati a service_role, nessun errore advisor introdotto | Da eseguire |
| Analisi completa | Autenticazione, caricamento documento, tutti i requisiti valutati, risultato e punteggio persistiti | Da eseguire |
| Ripresa e concorrenza | Batch ripreso senza perdita/duplicazione; secondo worker escluso; worker scaduto non scrive | Da eseguire |
| Errore IA | Esito to_verify esplicito, risultato degradato non in cache | Da eseguire |
| Generazione documento | Testo originale recuperato anche su cache hit; output consultabile/scaricabile | Da eseguire |
| Autorizzazione | Utente diverso e anonimo non leggono dati altrui e non chiamano RPC di servizio | Da eseguire |
| Regressione interfaccia | Requisiti esclusi visibili; N/D distinto da zero; report coerente | Da eseguire |

Lo staging deve usare dati sintetici e proprie credenziali. Le chiavi IA vanno configurate nel gestore dei segreti, mai nella memoria o nei log. Prima del collaudo reale verificare che siano configurate; una simulazione delle risposte IA non dimostra il funzionamento del provider live.

## Ordine di rilascio

Staging pronto → migrazione su staging → funzioni e frontend di prova → collaudo con prove registrate → migrazione sul database di destinazione → integrazione/distribuzione del codice → verifica dopo rilascio. Nessuna modifica in produzione viene considerata effettuata sulla base dei soli test locali.
