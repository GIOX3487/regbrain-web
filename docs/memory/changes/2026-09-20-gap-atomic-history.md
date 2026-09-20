---
date: 2026-09-20
author: Giovanni con Codex
roadmap_ids: ["GAP-01"]
state_review: updated
state_reason: Salvataggio atomico integrato con la cronologia e distribuito nello staging.
roadmap_review: updated
roadmap_reason: Completata integrazione tecnica della persistenza, collaudo IA ancora incompleto.
files: ["supabase/functions/gap-analysis/index.ts", "src/lib/engine-version.ts", "supabase/migrations/20260916215104_gap_analysis_atomic_results.sql", "supabase/migrations/20260920173131_gap_atomic_history.sql", "deployment/gap-persistence.test.mjs", "package.json", "package-lock.json", "docs/memory/STATE.md", "roadmap.md"]
---

## Richiesta e contesto

Proseguire verso il rilascio integrando il salvataggio atomico con la cronologia del socio e verificare il candidato nello staging.

## Modifiche e motivazione

Integrata la persistenza della PR #3 nella base aggiornata della PR #10, senza sovrascrivere cronologia e congelamento della PR #24. Versione motore v28. Questa integrazione importa la persistenza, non tutte le modifiche a citazioni, fonti e applicabilità della PR #3, che resta separata.

Un lease per assessment impedisce lavorazioni concorrenti. Ogni gruppo salva insieme esiti e avanzamento. La finalizzazione salva gap, azioni, punteggi e nuova riga di cronologia in un'unica transazione: un errore nella cronologia fa fallire la finalizzazione e conserva i risultati provvisori per riprovare. Il rifacimento preserva l'esito precedente e azzera solo i punteggi finali mentre è incompleto. Le analisi precedenti alla cronologia vengono archiviate prima di iniziare il nuovo giro. Le chiamate di prosecuzione arrivate dopo il completamento restituiscono l'esito congelato. La versione originaria di un risultato riusato sopravvive a una ripresa.

Le funzioni di persistenza sono security invoker, accessibili solo a service_role. La cronologia resta leggibile dal proprietario; l'inserimento dal browser è revocato. Nessun nuovo vincolo sul push o sul deploy.

## Verifiche ed esiti

37 test backend passati, compresi rollback su fallimento della cronologia, ripresa, numerazione dei giri e protezione dai worker obsoleti. Sintassi di 28 file Edge, TypeScript e build passati. Sul database staging una transazione sintetica ha confermato rollback, completamento e due giri distinti; fixture annullata con rollback.

Staging: gap-analysis versione 8, motore v28. Applicate la migrazione assessment_runs della PR #24 e la nuova gap_atomic_history; gap_analysis_atomic_results era già applicata. Prova AI sul nuovo assessment 1b3acd88-51b3-4f86-903e-ef928e0d4a16 interrotta da 503 overloaded: non misura l'accuratezza. Nessuna modifica alla produzione.

## Rischi e limiti

Applicare nell'ordine le migrazioni 20260916215104, 20260920150000 (se non già presente) e 20260920173131 prima della funzione v28. Non riapplicare a mano migrazioni già registrate. Per tornare alla funzione precedente la nuova migrazione è additiva; la revoca INSERT sulla cronologia non impedisce il backend precedente che usa service_role.

Prima della produzione restano il collaudo completo con IA reale e la verifica del rifacimento nell'interfaccia hosted. La restante revisione di citazioni, fonti e applicabilità della PR #3 richiede integrazione dedicata con le nuove regole del socio. Non è disponibile una percentuale attendibile di accuratezza.

## Prova HTTP controllata nello staging

Assessment sintetico 0d494222-6ed2-43e2-ab63-2fc7f8e602b6 con un solo esito preparato per isolare la finalizzazione. Prima chiamata autenticata: 200 completed, un gap; riapertura e prosecuzione tardiva: entrambe 200 frozen, senza ricalcolo. Questo verifica il percorso reale funzione/database, non la comprensione del documento da parte dell'IA.

## Prossimo passo

Completare il benchmark con IA disponibile e verificare il rifacimento nell'interfaccia prima di distribuire in produzione. Gli ulteriori controlli qualitativi della PR #3 restano da riconciliare.

Advisors staging: nessun rilievo sulle nuove funzioni invoker. La tabella lease senza policy è intenzionalmente solo service_role. Restano avvisi preesistenti su vector in public, funzioni definer e protezione password; questa modifica non li altera. Riferimenti: https://supabase.com/docs/guides/database/database-linter?lint=0008_rls_enabled_no_policy e https://supabase.com/docs/guides/database/database-linter?lint=0029_authenticated_security_definer_function_executable.
