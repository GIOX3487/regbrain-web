# Cloudflare Pages: prova isolata (OPS-02)

Branch: `codex/cloudflare-trial`. Non integrare per migrare automaticamente produzione.

- Nome progetto: `regbrain-cloudflare-trial`.
- Branch di produzione del solo progetto Pages: `codex/cloudflare-trial`.
- Build: `npm run build:cloudflare`; output: `dist`; Node: `22`.
- Variabili: `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY`, `VITE_SUPABASE_ANON_KEY`, `VITE_SUPABASE_PROJECT_ID`, come `.env.example`; solo chiavi pubbliche, mai service_role.
- Disabilitare build di anteprima per altri branch, evitando pubblicazioni duplicate.

La build normale Vercel resta invariata. Il comando dedicato aggiunge `_worker.js` e
`_routes.json`: solo `/api/*` passa dal Worker, gli asset restano statici. Il proxy replica
le due riscritture di vercel.json, conserva query, metodi, corpo e Authorization,
non registra il contenuto, non inoltra cookie e impedisce caching delle risposte API.
L'origine Supabase è fissa e non controllabile dal chiamante; redirect manuali.
La CSP nel solo dist Cloudflare viene allineata all'host Supabase corrente anche per WebSocket.
`X-Robots-Tag: noindex, nofollow` esclude la copia dai motori che rispettano la direttiva.
Non sostituisce il controllo di accesso esistente.

Questa copia usa il database di produzione, non è un ambiente dati isolato. Usare dati
sintetici per i collaudi. Le chiamate AI mantengono i costi attuali. Verificare i redirect
Auth prima di usare OAuth/reset password: l'origine Pages è diversa da quella Vercel.
Nessuna modifica automatica alla configurazione Auth, RLS, DNS o piani di pagamento.

Cloudflare Free ha limiti per le richieste dinamiche (100.000/giorno per account al
25 novembre 2026); non promettere hosting illimitato per le API. Fonte:
https://developers.cloudflare.com/workers/platform/pricing/

Controlli: `node --test deployment/cloudflare/worker.test.mjs`, `npm run build:cloudflare`.
Dopo pubblicazione: homepage e /chat; API senza credenziali devono restare protette;
accesso con account autorizzato, domanda sintetica con citazioni e allegato di prova.
Il trasferimento del dominio e la disdetta Vercel restano una decisione separata.
