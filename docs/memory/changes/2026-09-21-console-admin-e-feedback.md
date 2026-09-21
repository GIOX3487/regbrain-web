---
date: 2026-09-21
author: Matteo Piccirilli, agente Claude (Opus 5)
roadmap_ids: ["ADMIN-01"]
state_review: updated
state_reason: Lo stato non descriveva alcuno strumento di osservazione della piattaforma; va registrato che esistono la console /admin, il registro eventi e il feedback con pollici su chat e gap analysis, e come si ottiene il ruolo admin.
roadmap_review: updated
roadmap_reason: Nessun ID copriva monitoraggio e feedback degli utenti: aggiunto ADMIN-01 con i passi successivi (avvisi via email, uso dei pollici giù come set di regressione).
files: ["supabase/migrations/20260921160000_admin_console_feedback.sql", "supabase/functions/_shared/access.ts", "supabase/functions/rag-query/index.ts", "src/pages/AdminDashboard.tsx", "src/components/feedback/FeedbackThumbs.tsx", "src/pages/Chat.tsx", "src/pages/AssessmentDetail.tsx", "src/pages/Auth.tsx", "src/App.tsx", "src/integrations/supabase/types.ts", "docs/memory/STATE.md", "roadmap.md"]
---

## Richiesta e contesto

Richiesta del 21 settembre: credenziali da amministratore e un link a una dashboard in cui vedere
tutto quello che succede sulla piattaforma (log, pollici su e giù sulla chat e sulla gap analysis,
altro da monitorare in tempo reale); in fondo a ogni risposta della chat e a ogni valutazione della
gap analysis, icone minimali pollice su e pollice giù che, per utenti demo e registrati, mandano un
feedback all'amministratore, con la possibilità di scrivere brevemente cosa è piaciuto e cosa no.

Stato trovato: esisteva già il ruolo `admin` (`user_roles`, `has_role`), ma nessun account lo aveva
e nessun account di Matteo esisteva in produzione. Nessun registro eventi, nessun feedback.

## Modifiche e motivazione

Database (migrazione `20260921160000_admin_console_feedback.sql`, già applicata in produzione):

- `feedback`: voto (+1/-1), commento facoltativo fino a 1000 caratteri, origine (`rag`,
  `gap_analysis`, `gap_item`), chiave dell'elemento valutato e un'istantanea di ciò che l'utente
  ha visto (domanda e risposta, oppure riferimento, esito, motivazione e prove). Un trigger impone
  autore, email e flag demo lato server, scarta collegamenti a chat o analisi di altri utenti,
  lascia all'autore solo voto e commento e all'admin solo "letto". Un voto per elemento per utente.
- `app_events`: registro eventi letto solo dagli admin. Lo alimentano trigger su registrazioni,
  conferme email, accessi, demo avviate, domande in chat, analisi create e completate, documenti
  caricati, feedback; e il wrapper `protect` delle funzioni edge per ogni risposta 4xx/5xx
  (escluso 401) con funzione, codice, messaggio e durata. Conservazione 90 giorni (pg_cron).
- Colonne `author_id` e `actor_id` al posto di `user_id` di proposito: la pulizia delle demo
  cancella le righe di ogni tabella con `user_id`, e il feedback delle demo deve sopravvivere.
- Funzioni `admin_overview`, `admin_users`, `admin_recent_queries`, `admin_recent_assessments`
  (security definer, rifiutano chi non è admin).
- Ruolo admin: `admin_allowlist` con `cecchinoxsempre@gmail.com`. Il ruolo si assegna solo quando
  l'email risulta confermata e l'account non è demo, così nessuno può ottenerlo registrandosi con
  quell'indirizzo senza controllarne la casella. Nessuna password è stata creata né trasmessa.
- `feedback` e `app_events` aggiunte alla pubblicazione realtime.

Applicazione:

- `FeedbackThumbs`: due icone, al clic il voto parte subito, poi si apre un campo facoltativo
  per il commento. Cinque lingue.
- Chat: pollici in fondo a ogni risposta (non sulle domande di chiarimento). `rag-query` ora
  restituisce `queryLogId`, così il voto è legato alla riga di `query_log`.
- Gap analysis: pollici su ogni lacuna, obbligo coperto e obbligo da verificare ("Esito
  corretto?") e sull'analisi intera ("Questa analisi ti è stata utile?"). I voti già dati
  ricompaiono al ricaricamento.
- `/admin`: indicatori, feedback con filtri e "cosa ha visto l'utente", attività in diretta,
  errori, chat, gap analysis, utenti, collegamenti agli strumenti admin esistenti. Toast in tempo
  reale e notifiche del browser facoltative. Voce "Console di amministrazione" nella chat per gli
  admin. `Auth` porta direttamente a `/admin` senza passare dall'onboarding.

## Verifiche ed esiti

- Prova SQL in transazione annullata: ruolo admin assegnato alla conferma dell'email; autore
  forzato anche se il client ne indica un altro; flag demo corretto; l'autore non può cambiare
  chiave né segnare come letto; l'admin non può cambiare il commento; un utente normale non legge
  `app_events` e riceve rifiuto da `admin_overview`; eventi generati dai trigger (5 attesi, 5).
- `tsc` senza errori, build riuscita.

## Rischi e limiti

- La console mostra domande, risposte ed email degli utenti: l'informativa privacy deve dire che
  il team legge conversazioni e feedback per migliorare il servizio.
- Le notifiche arrivano solo a console aperta (toast) o con scheda in background e permesso del
  browser. Nessun avviso via email o telefono.
- I log interni delle funzioni (console.log) restano nella dashboard Supabase: in `/admin` ci
  sono solo gli esiti con errore.

## Prossimo passo

Matteo si registra con `cecchinoxsempre@gmail.com`, conferma l'email e apre `/admin`. Poi:
avviso email per ogni pollice giù (ADMIN-01) e uso dei pollici giù sugli esiti come casi del set
di regressione della gap analysis.
