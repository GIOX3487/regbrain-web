---
date: 2026-11-25
author: Giovanni Sollami con Codex
roadmap_ids: ["OPS-02"]
state_review: updated
state_reason: Registrata la preparazione della copia Cloudflare senza dichiarare una migrazione della produzione.
roadmap_review: updated
roadmap_reason: Aggiunta OPS-02 per la prova Cloudflare richiesta dall'utente, separata dalla distribuzione Supabase.
files: ["package.json", "deployment/cloudflare/worker.js", "deployment/cloudflare/prepare.mjs", "deployment/cloudflare/worker.test.mjs", "deployment/cloudflare/README.md", "docs/memory/STATE.md", "roadmap.md"]
---

## Richiesta e contesto

Giovanni vuole provare Cloudflare per ridurre i costi Vercel. Base main ba8ec84b749b517832b92a037680da0fa48a8d8c. Letti stato, roadmap, decisioni e registro del ripristino deploy del 20 ottobre. Il progetto usa proxy Vercel anche per Auth e password del sito: un semplice upload statico non basta.

## Modifiche e motivazione

Build Pages separata; proxy con upstream fisso, risposta senza cache, conservazione streaming e autorizzazione. Test per POST, query, verifica token, asset, API sconosciute e URL che non devono cambiare origine. CSP corretta nel solo output Cloudflare. Noindex per la copia di prova. Nessuna modifica al database, alle Edge Functions o alla build normale Vercel. Le decisioni durature restano invariate: questo è un esperimento, non la scelta del nuovo hosting definitivo.

## Verifiche ed esiti

Cinque test proxy superati e build Cloudflare riuscita localmente con Node 24. Il deploy userà Node 22 come da package.json. Avvisi preesistenti di bundle grande e dipendenze: npm ci online segnala 31 vulnerabilità (9 moderate, 21 alte, 1 critica); non corrette con aggiornamenti automatici estranei al task. Il successivo audit offline senza dati non costituisce una prova di assenza di vulnerabilità. Pubblicazione e prova autenticata non ancora eseguite.

## Rischi e limiti

La copia usa lo stesso Supabase di produzione: non è staging dei dati. Dominio, piano Vercel, ruoli utenti e impostazioni Auth non modificati. Le API dinamiche consumano la quota Workers Free. I reset password e OAuth richiedono collaudo degli URL di ritorno. Il progetto Pages non deve distribuire altri branch automaticamente. Nessuna certificazione di sicurezza completa.

## Prossimo passo

OPS-02: pubblicare il branch dedicato su Pages, controllare API e browser, completare accesso/chat con l'utente e aggiornare questo registro con gli esiti osservati. Nessun merge o cambio DNS necessario alla prova.
