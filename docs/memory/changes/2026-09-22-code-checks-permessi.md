---
date: 2026-09-22
author: Matteo Piccirilli, agente Claude (Opus 5)
roadmap_ids: ["CODE-01"]
state_review: updated
state_reason: Lo stato non diceva che la verifica del codice salva l'esito solo se la tabella ha i permessi giusti: alla prima prova in produzione l'esito tornava all'utente ma non veniva salvato.
roadmap_review: unchanged
roadmap_reason: L'attività e il prossimo passo di CODE-01 non cambiano: era un permesso mancante, non una scelta di prodotto.
files: ["supabase/migrations/20260922160000_code_checks.sql", "docs/memory/STATE.md"]
---

## Richiesta e contesto

Prima prova end to end della verifica del codice in produzione: la risposta arrivava completa, con
esiti, fonti e domande, ma `id` era nullo e in `code_checks` non compariva nessuna riga.

Causa: la tabella è stata creata fuori dal ruolo `postgres`, quindi non ha ereditato i privilegi
predefiniti del progetto e `service_role` non poteva scriverci. La funzione edge registra
l'errore e risponde comunque, quindi il problema non si vedeva dalla risposta.

## Modifiche e motivazione

`grant all on public.code_checks to service_role` nella migrazione, applicato anche in produzione.
Restano fuori `anon` e `authenticated` per insert e update: l'utente legge e cancella le proprie
verifiche, scrive solo la funzione.

## Verifiche ed esiti

- Ripetuta la prova: la verifica viene salvata (rischio alto, due esiti alti e uno basso su un
  file Python con MD5 sulle password, TLS non verificato e debug attivo), con sintesi, quattro
  domande e sei fonti citate, in 22 secondi. Evento `code_check` registrato in `app_events`.
- Prova anche con due file (JavaScript e HTML): credenziali Stripe, SQL concatenato, dati nei log,
  http in chiaro, tracciamento e uso di IA riconosciuti, con le note del modello su ciascuno.
- Dati di prova e utente temporaneo rimossi al termine.

## Rischi e limiti

- Le prossime tabelle create con lo stesso percorso avranno lo stesso problema: conviene
  controllare i privilegi di `service_role` subito dopo ogni nuova migrazione.

## Prossimo passo

Provare la verifica dall'interfaccia con l'account di Matteo e poi su un progetto reale, contando
falsi positivi e problemi mancati (CODE-01).
