# RegBrain: configurazione pubblicata

Stato verificato l’11 settembre 2026. Sito: https://regbrain-web.vercel.app/.
Repository: GIOX3487/regbrain-web. Supabase: ndwozjlasabsdfqcyeoy.

## Cosa funziona e cosa manca

- Homepage con Analisi conformità e RAG normativo; sezione notizie rimossa.
- Accesso con password, pulsante demo, creazione sessione sul server e salvataggio del profilo verificati nel browser sul sito pubblicato.
- Gemini è stato configurato dal proprietario e la chat ha restituito una risposta reale sull'articolo 37 GDPR. Il collaudo ha rilevato e corretto due problemi: parole spezzate dal PDF (Ar ticolo) e virgole non valide nei filtri PostgREST per gli articoli. Per riprodurre la normalizzazione dei dati importati usare deployment/normalize-gdpr.sql.
- Database con 46 tabelle pubbliche protette da RLS; scadenza demo verificata sul server e pulizia periodica delle demo scadute.
- Sei testi del pacchetto originale importati: GDPR, NIS2, AI Act, CRA, DORA, Data Act. Totale 1538 segmenti testuali. Non è una verifica dell'aggiornamento giuridico delle fonti.
- Indicizzazione semantica parziale: 60 segmenti su 1538 hanno vettori Gemini reali, normalizzati a 768 dimensioni. Il primo caricamento si è fermato su HTTP 429 del provider. La funzione amministrativa index-normative-documents riprende dai segmenti mancanti e distanzia i blocchi. La ricerca testuale rimane disponibile. RAG e copilot usano RETRIEVAL_QUERY; i testi normativi usano RETRIEVAL_DOCUMENT. Il copilot non genera più vettori artificiali in caso di errore.
- Il caricamento di deployment/test-policy.txt e la creazione del report sono stati verificati nel browser (assessment 7142283a-6bb6-47a7-864a-84856118cafa, completed). Correzione della diagnosi precedente: il database contiene anche embedding dei documenti utente; la dicitura “Analisi testuale” identifica il metodo del singolo gap, non dimostra che manchino gli embedding. Restano difetti di qualità da correggere: evidenze presenti nel documento ignorate, obblighi condizionati trattati come automatici e stime basate su dati aziendali predefiniti. L’esportazione PDF non è ancora stata collaudata.
- Nel nuovo test della chat dell’11 settembre, la richiesta ha ricevuto HTTP 429 dal servizio AI. Non è stato possibile completare il collaudo delle citazioni. La sessione amministrativa del dashboard Supabase è scaduta e richiede un nuovo accesso del proprietario per proseguire l’indicizzazione dal pannello.
- Il vecchio dominio regbrain.it ha un instradamento separato: questo intervento non ne ha modificato i DNS.

## Attivare o cambiare il servizio AI

Aprire https://supabase.com/dashboard/project/ndwozjlasabsdfqcyeoy/functions/secrets e salvare i seguenti segreti. Non inserire chiavi nel codice, nelle variabili VITE_ o in chat.

| Servizio | AI_PROVIDER | Nome del segreto per la chiave |
| --- | --- | --- |
| Google Gemini | gemini | GEMINI_API_KEY |
| OpenAI | openai | OPENAI_API_KEY |
| Claude | anthropic | ANTHROPIC_API_KEY |
| Lovable Gateway | lovable | LOVABLE_API_KEY |
| Endpoint compatibile OpenAI | custom | AI_API_KEY |

1. Impostare AI_PROVIDER sul valore della tabella.
2. Impostare AI_MODEL sull'identificatore esatto di un modello disponibile nell'account del provider. Non usare il nome commerciale dell'abbonamento ChatGPT o Claude.
3. Salvare la chiave nel segreto indicato nella tabella.
4. Per custom impostare anche AI_BASE_URL: URL HTTPS della base API, normalmente terminante in /v1, senza /chat/completions. Deve essere un endpoint fidato che supporti il formato OpenAI Chat Completions.
5. Provare una domanda nella chat, poi un'analisi con un documento di esempio. Verificare anche gli output strutturati se il modello scelto deve generare report: non tutti i modelli supportano immagini e strumenti allo stesso modo.

La scelta è amministrativa e vale per il sito. Non è presente un selettore di provider per ciascun visitatore. La modifica dei segreti non richiede una nuova pubblicazione del frontend. Il codice non passa automaticamente a un altro servizio in caso di errore.

La chiave Gemini per gli embedding è indipendente dal provider della chat: il codice usa gemini-embedding-001 a 768 dimensioni. Un cambio del modello di embedding richiede migrazione e reindicizzazione; non mescolare vettori di modelli diversi.

Riferimenti: [Gemini compatibilità OpenAI](https://ai.google.dev/gemini-api/docs/openai), [Claude API](https://platform.claude.com/docs/en/api/overview), [OpenAI Chat Completions](https://developers.openai.com/api/reference/resources/chat).

## Configurazione Vercel e Supabase

Vercel usa React/Vite, npm run build, directory dist. Le variabili pubbliche richieste sono VITE_SUPABASE_URL e VITE_SUPABASE_PUBLISHABLE_KEY, riferite al nuovo progetto. Una loro modifica richiede un nuovo build. La chiave service_role deve rimanere esclusivamente sul server.

vercel.json inoltra /api/supabase/* a questo progetto Supabase, mantiene /api/verify-site-password e gestisce le rotte SPA. Le risposte API hanno Cache-Control privato/no-store.

SITE_ACCESS_PASSWORD è già configurata su Supabase. Non sostituirla durante la configurazione AI: cambiandola si invalidano anche i token d'ingresso precedenti. Il gate del sito non sostituisce Supabase Auth e le policy sui dati.

supabase/config.toml identifica il progetto corretto; gli URL localhost nella sezione auth sono per lo sviluppo locale. Le impostazioni Auth del progetto ospitato si gestiscono separatamente nel dashboard. Per eventuali registrazioni ordinarie verificare Site URL e redirect consentiti su https://regbrain-web.vercel.app senza wildcard generiche. La demo non dipende dalle email di registrazione.

## Pubblicazioni successive

Frontend: modificare il codice, eseguire i controlli, salvare sul ramo main di GitHub. Vercel crea il deployment; verificare stato Ready e sito stabile prima di considerare l'aggiornamento concluso.

Backend: GitHub/Vercel non pubblicano automaticamente le Edge Functions. Pubblicare singolarmente solo quelle elencate in functions.json, includendo tutte le dipendenze relative: _shared/access.ts, _shared/ai.ts e _shared/embeddings.ts quando importate. verify-site-password è un servizio separato già attivo. I 21 entrypoint elencati implementano la verifica delle sessioni nel codice: verify_jwt=false nella configurazione non significa accesso libero. Non rimuovere il wrapper protect(). Le funzioni amministrative richiedono anche il ruolo admin. Separatamente, index-normative-documents richiede la chiave di servizio del progetto, non un normale token utente. Non è invocabile dal frontend.

Le altre funzioni storiche presenti nel repository non sono state abilitate né collaudate in questa installazione. Non pubblicare indiscriminatamente tutta la cartella: contiene moduli legacy di notizie, integrazioni e caricamenti che richiedono una revisione separata.

Database: supabase/migrations contiene le otto migrazioni effettivamente applicate, con gli stessi identificatori registrati sul server. Non rieseguirle sul database attuale. Le 51 migrazioni originarie sono state tolte dalla cartella attiva; restano nella cronologia Git e nell'archivio locale deployment/legacy-migrations. Per modifiche future aggiungere nuove migrazioni, fare backup e controllare il progetto collegato prima di applicarle.

## Verifiche e limiti

- Build Vite e controllo TypeScript del frontend superati.
- Dodici test di adattatore AI ed embedding superati (Node 24: node --test deployment/ai.test.mjs deployment/embeddings.test.mjs). Usano risposte simulate: non attestano il credito o la validità di una chiave reale.
- Controllo sintattico dei 21 entrypoint superato; non equivale a un collaudo completo del runtime Deno.
- deployment/verify_rls.sql verificato su Supabase: isolamento profili/documenti/segmenti tra utenti, scadenza demo non modificabile dal client, accesso scaduto negato, pulizia limitata all'utente scaduto. Lo script usa una transazione con ROLLBACK.
- Avvisi preesistenti residui: estensione vector nello schema public, funzione has_role privilegiata necessaria alle policy, controllo password compromesse disattivato. Le dipendenze originali presentano segnalazioni npm audit; aggiornamenti maggiori richiedono un intervento separato.

La chiave Gemini e la risposta della chat sono state verificate. Restano da completare l'indice semantico e un collaudo della qualità su più normative e documenti, inclusi citazioni puntuali e obblighi condizionati al contesto. Non considerare questa versione una validazione professionale dei risultati di conformità.

## Riprendere l’indicizzazione pubblica

Nel dashboard Supabase aprire Edge Functions → index-normative-documents → Test. Impostare POST, body {"limit":20,"rounds":5}, e usare la voce del pannello per aggiungere la chiave di servizio nell’header apikey. Non copiare la chiave in file o messaggi. La verifica della chiave viene eseguita nel codice prima di ogni operazione. Una richiesta lavora al massimo cinque blocchi, con una pausa tra essi. Ripetere soltanto dopo la conclusione della precedente. Su 429 fermarsi e verificare quota e tempo di ripristino nel servizio Gemini; non cambiare automaticamente piano o chiave.

Un esito updated indica quanti segmenti sono stati salvati, complete indica se non ne restano da elaborare. Un errore interrompe il blocco; quelli salvati prima rimangono validi. Non dichiarare l’indice completo finché count(embedding) non coincide con i 1538 segmenti pubblici. La funzione controlla anche che il testo non sia cambiato prima del salvataggio. I due indici, chunks e structured_chunks, vengono aggiornati insieme.
