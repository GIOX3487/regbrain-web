---
date: 2026-09-17
author: Matteo Piccirilli, agente Claude (Opus 5)
roadmap_ids: ["SITE-01", "SITE-02"]
state_review: updated
state_reason: Lo stato non registrava che le pagine legali del sito descrivevano un prodotto diverso da quello reale, ne' la rimozione di Perplexity e della sezione aggiornamenti normativi.
roadmap_review: updated
roadmap_reason: Nessun ID copriva le pagine legali: aggiunto SITE-02 con i passaggi ancora aperti (revisione legale, dati del titolare, piano dell'API Gemini, backup).
files: ["docs/memory/STATE.md", "roadmap.md", "src/App.tsx", "src/pages/Chat.tsx", "src/pages/CookiePolicy.tsx", "src/pages/Landing.tsx", "src/pages/PrivacyPolicy.tsx", "src/pages/TermsConditions.tsx", "src/pages/NewsUpdates.tsx", "src/pages/SeedNews.tsx", "src/components/landing/NewsSection.tsx", "src/components/news/NewsUpdater.tsx", "supabase/functions/generate-benchmark/index.ts", "supabase/functions/market-intelligence/index.ts", "supabase/functions/auto-update-news/index.ts", "supabase/functions/scrape-regulatory-updates/index.ts", "supabase/functions/seed-news/index.ts", "supabase/functions/api-v1-regulatory-updates/index.ts"]
---

## Richiesta e contesto

Seguito del registro `2026-09-17-homepage-testi-pitch.md`, integrato con la PR #7. Durante la
rimozione del banner cookie dalla homepage e' emerso che `src/pages/CookiePolicy.tsx` descriveva
cookie e servizi terzi inesistenti. Il committente ha chiesto di correggere quella pagina, poi le
altre due pagine legali con lo stesso metodo, poi di rimuovere Perplexity e la sezione aggiornamenti
normativi, e infine di togliere dalla homepage e dal pitch il dato di stabilita' del motore.

Metodo applicato a tutte e tre le pagine: censire quello che il codice e la banca dati fanno
davvero, poi scrivere solo quello, dichiarando anche cio' che manca.

## Modifiche e motivazione

### Cookie policy

La pagina dichiarava il cookie `cookie_consent`, i cookie `theme`, `language` e
`onboarding_complete`, Plausible Analytics e Posthog fra i servizi analitici, Stripe e Intercom fra
le terze parti, i web beacon per il tracciamento delle email e un banner di consenso nel footer.
Nessuna di queste cose esiste nel codice: era un testo di esempio mai adattato.

Censimento verificato su codice e browser:

- cookie: nessuno. L'unica scrittura di `document.cookie` nel repository e' `sidebar:state` in
  `src/components/ui/sidebar.tsx`, ma `SidebarProvider` non e' usato da nessuna parte;
- local storage: `sb-<progetto>-auth-token` (scritto solo dopo il login), `pendingAnalysis`,
  `returnToAnalysis`, `continueConversation`;
- session storage: `site_auth_token`, `auth_redirect`, `chatState`, `chatReturn`,
  `restoreMessages`, `force_demo_onboarding`;
- terze parti caricate nel browser: nessuna, nemmeno un font esterno.

La pagina nuova elenca solo questo, richiama l'articolo 122 comma 1 del Codice privacy, che copre
anche local e session storage, spiega perche' non c'e' un banner di consenso e mostra la data di
ultimo aggiornamento, che la pagina teneva in una variabile senza renderizzarla, ferma al
29 dicembre 2024.

### Informativa privacy

Dichiarava Stripe e OpenAI fra i responsabili, collocava AWS su eu-central-1 mentre il progetto e'
su eu-west-1 in Irlanda, ometteva Vercel che e' un responsabile reale, elencava nome, cognome e
ruolo professionale fra i dati di registrazione quando il modulo chiede solo email e password,
elencava indirizzo IP, browser e pagine visitate quando nessuna tabella applicativa li contiene,
dichiarava l'autenticazione a piu' fattori che non e' implementata e backup giornalieri con
conservazione a trenta giorni che il piano in uso non offre, e prevedeva una riga di consenso
marketing per comunicazioni che il prodotto non puo' inviare.

Censimento su cui e' stata riscritta: registrazione con sola email e password; profilo con
giurisdizione, settore, dimensione e ruoli; valutazioni con ambito, fatturato dichiarato e profilo
di applicabilita'; documenti caricati in un bucket non pubblico con limite di 10 MB per file;
domande e risposte dell'assistente in `query_log`; sessioni demo con email e scadenza. Nessuna
colonna con indirizzo IP o user agent in alcuna tabella pubblica. Regole di sicurezza a livello di
riga attive su tutte e 50 le tabelle pubbliche. Responsabili effettivi: Supabase (eu-west-1,
Irlanda), Amazon Web Services sotto Supabase, Vercel per la pubblicazione, Google per l'API Gemini.

La pagina nuova aggiunge una sezione che dichiara esplicitamente che porzioni del testo dei
documenti caricati vengono inviate all'API di Google, cosa che l'informativa precedente non diceva,
e un riquadro che elenca le misure che ancora non ci sono invece di ometterle.

### Termini e condizioni

Descrivevano quattro piani di abbonamento, pagamenti tramite Stripe, fatturazione elettronica via
SDI, rinnovo automatico disattivabile da impostazioni inesistenti e recesso di quattordici giorni su
un acquisto che la piattaforma non permette. Riscritte le sezioni su accesso e recesso sulla fase
attuale: accesso gratuito o regolato da accordo scritto separato, nessun pagamento trattato dalla
piattaforma, nessun rinnovo automatico. Corretto il limite di responsabilita', ancorato a importi
mai pagati, e l'elenco delle tecnologie terze, che citava OpenAI.

### Perplexity e sezione aggiornamenti normativi

Su richiesta del committente:

- eliminato il ramo Perplexity da `generate-benchmark`, che inviava settore, giurisdizione e
  normative dell'azienda analizzata a un servizio statunitense quando la chiave era configurata, e
  da `market-intelligence`, che lo usava come provider primario. Zero occorrenze rimaste;
- rimossi la rotta `/aggiornamenti` e la pagina `NewsUpdates`, la rotta `/admin/seed-news` e la
  pagina `SeedNews`, il componente `NewsUpdater`, il componente `NewsSection` (gia' non importato da
  nessuna parte) e la voce "Aggiornamenti" nella barra laterale della chat;
- rimosse le edge function `auto-update-news`, `scrape-regulatory-updates`, `seed-news` e
  `api-v1-regulatory-updates`, nessuna delle quali risultava pubblicata sul progetto Supabase;
- `monitor-eur-lex` resta: scrive su `documents`, cioe' il catalogo normativo, non sul flusso di
  notizie. La tabella `news_updates` resta nella banca dati con i suoi dati, perche' la sezione
  potrebbe essere reintrodotta.

### Dato di stabilita' tolto dalla homepage

Rimossa dalla sezione "numeri che si verificano" la scheda "50 su 51 esiti identici rilanciando la
stessa analisi sullo stesso fascicolo", su richiesta: letto da chi compra o da un investitore, "un
esito su 51 cambia rilanciando la stessa analisi" pesa piu' del 98 per cento di riproducibilita' che
il dato esprime. La griglia passa da quattro a tre colonne. Restano le 55 citazioni su 55, i 254
obblighi a catalogo e i 70 secondi per 250 verifiche. Lo stesso dato e' stato tolto dalle due slide
del pitch che lo riportavano, che non vive in questo repository.

## Verifiche ed esiti

`npx tsc -p tsconfig.app.json --noEmit` verde, `npm run build` verde, `deno check` verde su
`generate-benchmark` e `market-intelligence`. La build e' stata servita in locale e le pagine aperte
in un browser headless: nessun residuo di Stripe, OpenAI, Intercom, Plausible, SDI, Perplexity o dei
nomi dei piani, nessun errore JavaScript, `/aggiornamenti` risponde con la pagina 404 come atteso.
Un controllo automatico sulla pagina pubblica caricata senza login ha registrato zero cookie, zero
voci di local storage, una sola voce di session storage (`site_auth_token`) e zero richieste a host
esterni, che e' esattamente quello che la cookie policy dichiara. La sezione dei numeri e' stata
verificata a viewport 1280 con le tre schede che riempiono la larghezza.

Non eseguite: nessuna verifica in produzione, nessun controllo su viewport mobile reale, nessun
controllo di accessibilita'. La modifica e' proposta in PR e va guardata sull'anteprima del branch.

## Rischi e limiti

- nessuno dei tre testi legali e' stato rivisto da un legale: vanno fatti passare dal Chief Legal
  Officer prima del rilascio pubblico;
- il titolare del trattamento resta indicato come "RegBrain" senza ragione sociale, partita IVA ne'
  sede, perche' il committente ha dichiarato che la societa' non e' ancora costituita. L'articolo 13
  del GDPR richiede identita' e contatti del titolare: la sezione va completata prima della vendita
  a clienti che facciano due diligence;
- non e' verificato se la chiave dell'API Gemini in uso sia su piano a pagamento. Sul livello
  gratuito Google usa i contenuti inviati per migliorare i modelli, il che contraddirebbe quanto
  l'informativa dichiara;
- il progetto Supabase e' su piano gratuito, che non prevede backup automatici. Per questo
  l'informativa non li dichiara, ma resta un rischio di prodotto: i documenti dei clienti non hanno
  ripristino;
- il foro competente indicato nei termini resta Milano, scelta non rivista qui;
- la chiave `PERPLEXITY_API_KEY`, se presente nei segreti del progetto, va cancellata a mano: la
  funzione pubblicata resta quella precedente finche' la distribuzione automatica non riparte da
  main;
- i tre numeri della sezione "qualita' misurata" vanno mantenuti allineati al motore. Se la qualita'
  cambia, la sezione va aggiornata o rimossa.

## Prossimo passo

Far rivedere le tre pagine legali dal Chief Legal Officer, accertare il piano dell'API Gemini e
decidere sui backup della banca dati (SITE-02). Restano aperte le due decisioni di SITE-01:
indirizzo di contatto pubblico e sezione team.
