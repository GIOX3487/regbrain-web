---
date: 2026-10-20
author: Matteo Piccirilli, agente Claude (Fable 5.1)
roadmap_ids: ["OPS-01", "CODE-01"]
state_review: updated
state_reason: Deploy Supabase dai sorgenti ripristinato con il nuovo token; registrati collaudo in produzione della verifica del codice e stato della pulizia del canale provvisorio.
roadmap_review: updated
roadmap_reason: OPS-01 chiuso sul merito (token rigenerato, run verde, funzioni dai sorgenti); CODE-01 aggiornato con il collaudo del 19 ottobre.
files: ["public/bundles/cc-2026-10-19.txt","public/bundles/gad-2026-10-19.txt","docs/memory/STATE.md","roadmap.md"]
---

## Richiesta e contesto

Seguito dei registri del 19 ottobre: il segreto SUPABASE_ACCESS_TOKEN su GitHub era scaduto o
revocato e le due funzioni erano pubblicate con il caricatore provvisorio. Il 20 ottobre il socio ha
generato un nuovo token di accesso Supabase e aggiornato il segreto (12:56 UTC).

## Modifiche e motivazione

Rilanciato a mano il workflow «Deploy Supabase Edge Functions» (run 39426355043, 12:57 UTC):
esito verde, tutte le funzioni «deploy ok». code-compliance è passata alla versione 11 e
generate-audit-document alla 25, entrambe con entrypoint nei sorgenti del runner; rag-query alla
37, riallineata ai sorgenti di main dopo un deploy manuale del 15 ottobre. Le altre funzioni
risultano invariate perché il contenuto non era cambiato. Rimossi i due bundle cifrati da
`public/bundles/`, non più necessari.

## Verifiche ed esiti

- Dopo il run, code-compliance e generate-audit-document rispondono 200 a OPTIONS e 401 senza
  sessione; la versione delle regole del servizio è 2026-10-19.1, uguale al frontend pubblicato.
- Collaudo in produzione del 19 ottobre (sera, con utente di collaudo creato apposta, non con la
  demo): tre file di prova con tracker senza consenso, chiave AWS di esempio, rotta POST senza
  controllo e URL http. Esito: 7 problemi, 2 rettificati dalle risposte (SEC-01 a rischio basso e da
  verificare per «valori di prova», SEC-16 a medio per «dietro un gateway», con motivazione scritta),
  3 requisiti dichiarati, 8 domande aperte di cui 2 del modello che citano file e riga. Rapporto
  delle lacune generato in circa 90 secondi, coerente con i numeri della verifica (39 requisiti,
  7 lacune, conformità 56 per cento, segnaposto per il titolare). Il controllo di versione
  risponde 409 con il messaggio previsto quando la pagina è vecchia.
- Da completare: eliminazione della tabella `public._code_bundle` e dell'utente di collaudo
  `collaudo-2026-10-19@regbrain.test` con la sua verifica e il suo documento. Le istruzioni
  distruttive dallo strumento dell'agente attendono una conferma del socio nel pannello Supabase
  che non è arrivata entro il tempo limite; la tabella è leggibile solo dal ruolo di servizio e non
  è più letta da nessuna funzione.

## Rischi e limiti

Il collaudo è stato fatto per via diretta sul servizio, non dalla pagina nel browser, che si ferma
al cancello con la password del sito; manca quindi la prova visiva di domande, chip di risposta e
pulsanti dei documenti nella pagina. La scadenza del nuovo token non è registrata qui: se il
deploy torna a fallire con «Invalid access token», la causa è questa.

## Prossimo passo

Eliminare tabella e utente di collaudo dal pannello Supabase (SQL: `drop table public._code_bundle;`
e cancellazione dell'utente da Authentication). Collaudo dalla pagina con un socio che apre il
cancello. Seguiti CODE-01 invariati: prove positive per i requisiti «nessun esito», flusso dei dati
fra file, client da riga di comando, pollici sugli esiti; rotazione della chiave Gemini.
