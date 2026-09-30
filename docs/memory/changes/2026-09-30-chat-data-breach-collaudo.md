---
date: 2026-09-30
author: Matteo Piccirilli, agente Claude (Fable 5.1)
roadmap_ids: ["CHAT-02"]
state_review: updated
state_reason: La valutazione delle violazioni dei dati è stata collaudata in produzione dopo la PR #54; lo stato deve riportare l'esito e non più "da fare".
roadmap_review: updated
roadmap_reason: CHAT-02 passa da "collaudo da fare" a "collaudato"; il criterio di chiusura resta la prova ripetuta dal DPO.
files: ["roadmap.md", "docs/memory/STATE.md"]
---

## Richiesta e contesto

Collaudo in produzione della PR #54 (risposte multiple nell'intake e valutazione delle violazioni
dei dati), sulla funzione `rag-query` distribuita dal run del commit `a28e54a`.

## Modifiche e motivazione

Solo memoria condivisa: esito del collaudo in stato e roadmap.

## Verifiche ed esiti

Prova con utenza temporanea (profilo DPO, studio legale, titolare e responsabile), poi rimossa
con zero residui. Conversazione: "un nostro avvocato ha smarrito il portatile con l'archivio dei
fascicoli dei clienti, dobbiamo notificare al Garante?".

- Primo turno: l'intake ha fatto 5 domande nell'ordine previsto (ruolo rispetto ai fascicoli,
  protezione dei dati, categorie di dati, numero di interessati, data e ora di conoscenza);
  `multiple: true` su ruolo e categorie, `false` sulle altre; opzioni conformi alla lista.
- Secondo turno, con risposte "Titolare; Responsabile per conto dei clienti", "In chiaro",
  "Identificativi; Categorie particolari; Dati giudiziari", "circa 300", "29 settembre 2026 alle
  19:30": la risposta ha tutti i sette titoli della struttura. Tipo di violazione: riservatezza e
  disponibilità. Cinque tipi di danno pertinenti con probabilità e gravità (segreto
  professionale al massimo). Rischio elevato motivato. Notifica al Garante "sì" per i
  trattamenti da titolare, avviso ai clienti titolari per quelli da responsabile (art. 33 par.
  2); scadenza delle 72 ore calcolata correttamente al 2 ottobre 2026 ore 19:30; contenuto
  minimo del par. 3 e notifica per fasi del par. 4. Comunicazione agli interessati "sì" con le
  tre eccezioni del par. 3 verificate una per una. Registro del par. 5 e misure immediate in
  ordine di urgenza. 9 citazioni verificate (art. 33 par. 1-5, art. 34 par. 1-3, considerando
  85, EDPB 9/2022); affidabilità "high".

## Rischi e limiti

- Un solo scenario provato; ransomware e email al destinatario sbagliato restano da provare in
  conversazione reale.
- L'intake ha chiesto il ruolo anche con profilo "sia titolare sia responsabile": corretto nel
  merito (il ruolo cambia per fascicolo) ma è una domanda in più per chi lo ha già dichiarato.

## Prossimo passo

Prova ripetuta dal DPO sui due casi (DPIA e data breach) e raccolta dei pollici.
