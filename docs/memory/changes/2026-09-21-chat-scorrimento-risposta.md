---
date: 2026-09-21
author: Matteo Piccirilli, agente Claude (Opus 5)
roadmap_ids: ["SITE-03"]
state_review: updated
state_reason: Lo stato della chat non diceva come si comporta lo scorrimento; va registrato che ora la vista va alla domanda e poi all'inizio della risposta.
roadmap_review: unchanged
roadmap_reason: Correzione puntuale dell'interfaccia della chat segnalata da un DPO, chiusa in questa modifica; nessuna attività aperta da aggiungere o spostare.
files: ["src/pages/Chat.tsx", "docs/memory/STATE.md"]
---

## Richiesta e contesto

Segnalazione di un DPO del 21 settembre: dopo una domanda nella chat la vista resta ferma invece di
portarsi all'inizio della risposta. Verificato sulla storia del file: la chat non ha mai avuto uno
scorrimento automatico dall'importazione del codice, quindi non è una regressione ma una mancanza.

## Modifiche e motivazione

In `src/pages/Chat.tsx`, a ogni messaggio aggiunto:

- se è la domanda dell'utente, il riquadro della conversazione scorre in fondo, così si vedono la
  domanda e l'indicatore di attesa;
- se è la risposta, si porta in alto l'inizio della risposta, non la fine: le risposte sono lunghe
  e vanno lette dalla prima riga, con le citazioni sotto.

Scorrimento animato durante la conversazione, immediato quando si apre una chat recente.

## Verifiche ed esiti

`tsc` senza errori e build riuscita. Il comportamento va confermato a mano nel browser dopo il
rilascio, su desktop e su telefono.

## Rischi e limiti

Se l'utente sta rileggendo più in alto mentre arriva la risposta, la vista si sposta comunque
sull'inizio della risposta. È il comportamento richiesto; se disturbasse si può limitare ai casi in
cui l'utente è già in fondo alla conversazione.

## Prossimo passo

Conferma del DPO che ha segnalato il problema.
