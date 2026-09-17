# Decisioni durature

## MEM-D01 — Memoria nel repository, aggiornata con la modifica (17 settembre 2026)

Richiesta esplicita di Giovanni: soci e rispettivi agenti devono condividere una memoria persistente e aggiornarla obbligatoriamente. Stato sintetico, un'unica roadmap e registri separati per PR riducono perdita di contesto e conflitti di scrittura. AGENTS.md definisce il contratto comune; gli altri file di istruzioni rimandano a quello stesso contratto.

## MEM-D02 — Stato verificato separato da proposte e produzione

Implementato, integrato e rilasciato sono passaggi distinti. Ogni affermazione di completamento deve riportare la prova adeguata. Dati riferiti dal PDF o da conversazioni vanno identificati come tali finché non sono verificati. Non memorizzare segreti o dati dei clienti.

## MEM-D03 — Controllo affidabile e limiti espliciti

La verifica delle PR usa il validatore del branch di destinazione e tratta i file proposti solo come dati. Il controllo automatico richiede memoria strutturata e copertura del diff; la revisione umana valuta il contenuto. Il blocco GitHub non si dichiara attivo finché non è configurato e provato; il limite del piano attuale resta tracciato in MEM-02.

## GAP-D01 — Principio proposto nella PR #3: l'incertezza resta visibile

La PR #3 propone di mantenere `to_verify` quando mancano prove verificabili, applicabilità o risposte affidabili, senza trasformare automaticamente in assenza di conformità. Distingue inoltre un punteggio non disponibile da zero. Questa decisione descrive la proposta in revisione, non un rilascio già effettuato.
