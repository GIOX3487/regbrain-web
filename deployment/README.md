# RegBrain: configurazione pubblicata

Stato verificato il 10 settembre 2026. Sito: https://regbrain-web.vercel.app/.
Repository: GIOX3487/regbrain-web. Supabase: ndwozjlasabsdfqcyeoy.

## Cosa funziona e cosa manca

- Homepage con Analisi conformità e RAG normativo; sezione notizie rimossa.
- Accesso con password, pulsante demo, creazione sessione sul server e salvataggio del profilo verificati nel browser sul sito pubblicato.
- La chat raggiunge correttamente il backend. Le risposte AI restano bloccate finché non vengono impostati una chiave valida e un modello accessibile.
- Database con 46 tabelle pubbliche protette da RLS; scadenza demo verificata sul server e pulizia periodica delle demo scadute.
- Sei testi del pacchetto originale importati: GDPR, NIS2, AI Act, CRA, DORA, Data Act. Totale 1538 segmenti testuali. Non è una verifica dell'aggiornamento giuridico delle fonti.
- Nessun embedding artificiale: i segmenti importati non hanno ancora un indice semantico. La ricerca testuale resta disponibile al RAG; per attivare quella semantica occorrono la chiave Gemini e una reindicizzazione controllata.
- La generazione di un'analisi completa da un documento caricato non è stata verificata end-to-end. Il collaudo reale delle risposte e dei report resta da fare dopo la configurazione AI.
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

Backend: GitHub/Vercel non pubblicano automaticamente le Edge Functions. Pubblicare singolarmente solo quelle elencate in functions.json, includendo _shared/access.ts e _shared/ai.ts. verify-site-password è un servizio separato già attivo. I 21 entrypoint elencati implementano la verifica delle sessioni nel codice: verify_jwt=false nella configurazione non significa accesso libero. Non rimuovere il wrapper protect(). Le funzioni amministrative richiedono anche il ruolo admin.

Le altre funzioni storiche presenti nel repository non sono state abilitate né collaudate in questa installazione. Non pubblicare indiscriminatamente tutta la cartella: contiene moduli legacy di notizie, integrazioni e caricamenti che richiedono una revisione separata.

Database: supabase/migrations contiene le sei migrazioni effettivamente applicate, con gli stessi identificatori registrati sul server. Non rieseguirle sul database attuale. Le 51 migrazioni originarie sono state tolte dalla cartella attiva; restano nella cronologia Git e nell'archivio locale deployment/legacy-migrations. Per modifiche future aggiungere nuove migrazioni, fare backup e controllare il progetto collegato prima di applicarle.

## Verifiche e limiti

- Build Vite e controllo TypeScript del frontend superati.
- Sei test dell'adattatore AI superati (Node 24: node --test deployment/ai.test.mjs). Usano risposte simulate: non attestano il credito o la validità di una chiave reale.
- Controllo sintattico dei 21 entrypoint superato; non equivale a un collaudo completo del runtime Deno.
- deployment/verify_rls.sql verificato su Supabase: isolamento profili/documenti/segmenti tra utenti, scadenza demo non modificabile dal client, accesso scaduto negato, pulizia limitata all'utente scaduto. Lo script usa una transazione con ROLLBACK.
- Avvisi preesistenti residui: estensione vector nello schema public, funzione has_role privilegiata necessaria alle policy, controllo password compromesse disattivato. Le dipendenze originali presentano segnalazioni npm audit; aggiornamenti maggiori richiedono un intervento separato.

L'ultimo passo obbligatorio per l'AI è impostare una chiave con credito, provare il modello scelto, completare l'indice semantico e collaudare domanda e analisi reali. Non considerare questa versione una validazione professionale dei risultati di conformità.
