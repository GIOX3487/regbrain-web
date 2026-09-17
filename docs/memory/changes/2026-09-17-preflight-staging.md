---
date: 2026-09-17
author: Codex su richiesta di Giovanni
roadmap_ids: ["MEM-01", "GAP-01"]
state_review: updated
state_reason: Registrati attivazione della memoria, prova negativa e prerequisiti verificati del collaudo.
roadmap_review: updated
roadmap_reason: MEM-01 risulta integrata; GAP-01 richiede ancora un ambiente di staging separato.
files: ["docs/memory/STAGING.md", "docs/memory/STATE.md", "roadmap.md"]
---

## Richiesta e contesto

Giovanni richiede di completare anche collaudo in ambiente di prova e migrazione della gap analysis, oltre alla memoria condivisa. La PR #4 introduce il contratto della memoria; questa PR registra le verifiche preliminari senza modificare l'applicazione o il database.

## Modifiche e motivazione

Aggiornati stato e roadmap con l'integrazione della memoria e i prerequisiti reali del collaudo. Aggiunto STAGING.md con ambiente disponibile, verifica di tabelle/privilegi, matrice di accettazione e ordine di rilascio. La mancanza di staging è esplicita e non viene aggirata usando produzione come ambiente di prova.

## Verifiche ed esiti

PR #4 integrata: autocontrollo della memoria e verifica applicativa verdi anche su main. Nella prima revisione di questa PR è stato deliberatamente omesso il registro: il check fidato ha fallito con "Aggiungere un nuovo registro" e "file non documentato" (https://github.com/GIOX3487/regbrain-web/actions/runs/35203449382). Il registro viene aggiunto in questa revisione; l'esito positivo è consultabile nei check della PR #5. Verifiche Supabase in sola lettura: nessun branch di prova; oggetti della migrazione assenti; tabelle/colonne principali presenti; chiave composta del checkpoint presente; privilegi service_role necessari presenti. Tre assessment completati, nessuno in corso al momento della lettura.

## Rischi e limiti

Il controllo può fallire correttamente ma il blocco GitHub dei merge resta non attivo (MEM-02). Nessuna migrazione, deployment di nuove funzioni o creazione di risorse Supabase è stata eseguita. Il collaudo end-to-end non è completato. Le letture di metadati non provano il funzionamento della migrazione e i conteggi delle analisi possono cambiare. L'organizzazione usa il piano free; la conferma di organizzazione e costo per nuove risorse è ancora necessaria.

## Prossimo passo

Per GAP-01 ottenere un ambiente di prova separato, applicare lì la migrazione e collaudare i casi di STAGING.md con dati sintetici e credenziali proprie. Aggiornare la PR #3 da main e aggiungere il suo registro prima del merge. MEM-02 richiede protezioni compatibili prima di poter dichiarare impossibile il merge senza memoria.
