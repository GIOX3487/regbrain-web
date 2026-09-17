---
date: 2026-09-17
author: Matteo Piccirilli, agente Claude (Opus 5)
roadmap_ids: ["SITE-01"]
state_review: updated
state_reason: Lo stato non copriva il sito pubblico; va registrato che la homepage e' stata riallineata al posizionamento del pitch e che restano due decisioni aperte su contatti e team.
roadmap_review: updated
roadmap_reason: Nessun ID esistente copriva il sito pubblico: aggiunto SITE-01 con il prossimo passo verificabile.
files: ["src/pages/Landing.tsx", "src/App.tsx", "src/pages/CookiePolicy.tsx", "docs/memory/STATE.md", "roadmap.md"]
---

## Richiesta e contesto

Richiesta del 17 settembre: la homepage contiene informazioni non necessarie o poco chiare;
sostituire i testi con quelli delle slide 2, 3, 6, 11, 12 e 14 del pitch pre-seed aggiornato
(29 slide). Confermato dal richiedente che la numerazione si riferisce alla versione nuova.

Oltre ai testi poco chiari, l'ispezione della pagina ha trovato tre problemi piu' seri:

- una sezione intitolata "Perche' un RAG specifico supera qualsiasi AI generalista", in
  contraddizione diretta con il pitch, dove il copilot RAG e' il paradigma che RegBrain supera;
- il posizionamento come "Piattaforma GRC enterprise", cioe' il segmento che il pitch dichiara
  esplicitamente di non servire, ripetuto anche nel footer;
- un dato "98% Precisione delle citazioni" motivato solo con "retrieval semantico avanzato e
  re-ranking", senza alcuna misurazione a supporto, su un sito che vende conformita'.

## Modifiche e motivazione

Riscritte in `src/pages/Landing.tsx` le sezioni dalla hero fino alla sezione visione. Struttura
nuova: hero, cosa fa RegBrain (slide 5), il problema (slide 2), perche' il problema resta
(slide 3), a chi serve (slide 6), come si lavora (slide 12), il valore (slide 14), qualita'
misurata (slide 11). Poi restano invariate CTA, contatti, team, disclaimer e footer.

Rimosse: la sezione RAG contro AI generaliste con la relativa tabella di confronto, la sezione
"Risposte personalizzate in base al tuo profilo", la sezione "Progettato per professionisti" con
il dato 98%, e la sezione visione con una citazione generica. La sezione "cosa fa" non e' fra le
slide indicate ma e' stata aggiunta perche' senza di essa la pagina non dice cosa fa il prodotto.

Il 98% non e' stato sostituito da un altro numero di marketing ma dalle misurazioni del
17 settembre (55 citazioni su 55 corrispondenti alla lettera, 50 esiti su 51 identici fra due
esecuzioni, 254 obblighi a catalogo, 250 verifiche in 70 secondi), con il metodo dichiarato nella
stessa sezione. Aggiornata anche la riga del footer, che ripeteva il posizionamento enterprise.

## Secondo giro di revisione (stessa PR)

Dopo la prima lettura della pagina, quattro correzioni richieste dal committente:

- il titolo della hero passa da "Gli agenti fanno il lavoro. Tu firmi." a "Automazione della
  compliance: dove gli agenti fanno il lavoro e tu firmi.", che dice cosa vende il prodotto prima
  di dire come lavora;
- tolta la virgola in "Cosa cambia, in concreto";
- tolto il riquadro "Metodo." sotto i quattro numeri misurati. I numeri restano, la spiegazione del
  corpus di prova non e' piu' in pagina: chi contesta un numero lo chiede, e la dichiarazione
  completa resta nel registro e nel pitch;
- tolto il banner cookie che compariva a ogni primo accesso. Rimosso l'uso di `CookieBanner` da
  `src/App.tsx`; il componente resta nel repository, non renderizzato, per poterlo reinserire se
  in futuro si installano strumenti di misurazione.

Sulla rimozione del banner: una ricerca nel codice non trova nessuno script di analytics o
marketing caricato dal sito (nessun gtag, nessun Plausible, nessun Posthog, nessun pixel). Le
preferenze raccolte dal banner erano salvate in `localStorage` e non venivano lette da nessuna
altra parte del codice, quindi il consenso non governava niente. Con il solo `site_auth_token` di
sessione, che e' tecnicamente necessario, il banner non e' dovuto.

## Cookie policy riscritta (stessa PR)

Tolto il banner, `src/pages/CookiePolicy.tsx` e' stata riletta riga per riga e non descriveva il
prodotto: dichiarava il cookie `cookie_consent`, i cookie `theme`, `language` e
`onboarding_complete`, Plausible Analytics e Posthog fra i servizi analitici, Stripe e Intercom
fra le terze parti, i web beacon per il tracciamento delle email e un banner di consenso nel
footer. Nessuna di queste cose esiste nel codice. Era un testo di esempio mai adattato, su una
pagina legale di un'azienda che vende conformita'.

Censimento di quello che il prodotto memorizza davvero, fatto sul codice e verificato in browser:

- cookie: nessuno. L'unica scrittura di `document.cookie` nel repository e' `sidebar:state` in
  `src/components/ui/sidebar.tsx`, ma `SidebarProvider` non e' usato da nessuna parte, quindi quel
  cookie non viene mai impostato;
- local storage: `sb-<progetto>-auth-token` (sessione Supabase, scritto solo dopo il login),
  `pendingAnalysis`, `returnToAnalysis`, `continueConversation`;
- session storage: `site_auth_token`, `auth_redirect`, `chatState`, `chatReturn`,
  `restoreMessages`, `force_demo_onboarding`;
- terze parti caricate nel browser: nessuna. Nessun font esterno, nessuno script di fornitori
  terzi, nessun pixel.

La pagina nuova dice questo e basta. Struttura: cookie e tecnologie equivalenti (con il richiamo
all'articolo 122 del Codice privacy, che copre anche local e session storage), cosa memorizziamo
davvero con le due tabelle reali, niente cookie analitici, niente cookie di marketing, niente
terze parti nel browser, perche' non c'e' un banner di consenso, come cancellare quello che
memorizziamo, diritti, aggiornamenti, contatti. Aggiunta la data di ultimo aggiornamento, che la
pagina teneva in una variabile e non mostrava, ferma al 29 dicembre 2024.

Base giuridica dichiarata: articolo 122 comma 1 del Codice privacy per l'archiviazione tecnica,
articolo 6.1.b del GDPR per il trattamento collegato, al posto del legittimo interesse che la
pagina citava per i cookie di autenticazione.

Restano da rileggere con lo stesso metro `src/pages/PrivacyPolicy.tsx`, che elenca Stripe Inc. fra
i responsabili, e `src/pages/TermsConditions.tsx`, che dice che i pagamenti sono gestiti tramite
Stripe. Nel prodotto non c'e' nessuna integrazione di pagamento.

## Verifiche ed esiti

`npx tsc -p tsconfig.app.json --noEmit` verde e `npm run build` verde. La pagina e' stata
costruita e aperta in un browser headless su una copia locale della build, con le variabili
d'ambiente del progetto. Dopo il secondo giro: il titolo reso e' "Automazione della compliance:
dove gli agenti fanno il lavoro e tu firmi.", il titolo di sezione legge "Cosa cambia in
concreto", il riquadro "Metodo." non compare piu' e il banner cookie non compare su una sessione
senza consenso salvato, con attesa di quattro secondi contro il ritardo di un secondo e mezzo con
cui si mostrava prima. La pagina `/cookie-policy` e' stata aperta nello stesso browser: non
contiene piu' nessuna delle voci inventate e le tabelle corrispondono al censimento sopra. Un
controllo automatico sulla pagina pubblica caricata senza login ha registrato zero cookie, zero
voci di local storage, una sola voce di session storage (`site_auth_token`) e zero richieste a
host esterni, che e' esattamente quello che la pagina dichiara. Tutte le
sezioni si impaginano correttamente su viewport 1280, comprese le griglie a due e quattro
colonne. Non e' stata verificata la resa su viewport mobile reale ne' l'accessibilita'.

Nessuna verifica eseguita in produzione: la modifica e' proposta in PR e va guardata
sull'anteprima del branch prima dell'integrazione.

## Rischi e limiti

I testi contengono quattro numeri misurati che vanno mantenuti allineati al motore: se la qualita'
cambia, la sezione va aggiornata o rimossa, altrimenti diventa un'affermazione non sostenuta come
il 98% che ha sostituito. Le misurazioni sono su un corpus di prova, non su clienti reali, e la
pagina lo dichiara.

Due decisioni restano aperte e non sono state prese in questa PR:

- l'indirizzo di contatto pubblico e' ancora `regbrain.contact@gmail.com`, in due punti. Nel pitch
  e' stato portato a un dominio aziendale: cambiarlo anche sul sito richiede che la casella esista;
- la sezione team del sito non riporta lo sviluppatore e consulente AI presente nel pitch;
- `src/pages/PrivacyPolicy.tsx` e `src/pages/TermsConditions.tsx` citano Stripe, che il prodotto
  non integra;
- il testo della cookie policy nuova indica le basi giuridiche ma non e' stato rivisto da un
  legale: va fatto passare dal Chief Legal Officer prima del rilascio pubblico.

## Prossimo passo

Guardare l'anteprima del branch, decidere su contatti e team, poi integrare (SITE-01).
