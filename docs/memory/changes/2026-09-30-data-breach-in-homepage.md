---
date: 2026-09-30
author: Matteo Piccirilli, agente Claude (Fable 5.1)
roadmap_ids: ["CHAT-02", "SITE-08"]
state_review: unchanged
state_reason: Cambia solo la pagina pubblica; il funzionamento della valutazione delle violazioni resta quello descritto nello stato del 30 settembre.
roadmap_review: unchanged
roadmap_reason: La presentazione pubblica della funzione è parte di CHAT-02; attività e prossimo passo non cambiano.
files: ["src/pages/Landing.tsx"]
---

## Richiesta e contesto

Matteo ha chiesto di presentare in homepage, in modo chiaro, semplice e sintetico, la nuova
valutazione delle violazioni dei dati nella chat (PR #54, collaudata con la PR #55). La homepage
non presentava affatto la chat come funzione: il confronto con le AI generaliste era l'unico
riferimento.

## Modifiche e motivazione

`src/pages/Landing.tsx`: nuova sezione "Chat · Violazione dei dati" dopo la verifica del codice e
prima de "Il problema", con lo stesso impianto grafico delle sezioni precedenti: titolo "Quando i
dati escono, le 72 ore corrono.", un paragrafo con i tre casi concreti (portatile smarrito,
ransomware, email al destinatario sbagliato) e tre schede: chiede solo i fatti decisivi (con più
risposte per domanda), valuta il danno tipo per tipo con i criteri EDPB 9/2022, dice cosa fare ed
entro quando (notifica al Garante con scadenza delle 72 ore, comunicazione agli interessati,
registro, misure immediate, obbligo del responsabile verso il titolare). Nel confronto "Prima,
oggi / Con RegBrain" una riga per parte sulla violazione dei dati. Il testo descrive solo ciò che
la chat fa davvero e chiude con "Nel dubbio, la regola è notificare", che è la regola imposta al
modello.

## Verifiche ed esiti

`tsc` e `vite build` puliti. Le icone `AlertTriangle`, `ListChecks` e `Clock` sono di lucide-react
già in uso. L'anteprima locale non si carica senza le variabili d'ambiente del progetto, quindi il
controllo visivo va fatto sull'anteprima Vercel della PR o in produzione.

## Rischi e limiti

- La sezione promette la scadenza "calcolata dal momento della scoperta": vale solo se l'utente
  indica data e ora; se non le indica, la chat spiega da quando decorre. Il testo non lo dice per
  restare sintetico.
- Le due schede segnalate in SITE-08 (DPO esterno, studio di consulenza) restano da riscrivere.

## Prossimo passo

Controllo visivo su Vercel; poi le due schede di SITE-08.
