# Memoria condivisa di RegBrain

Questa è la memoria versionata del progetto. Deve essere aggiornata nella stessa pull request delle modifiche, da chiunque le produca.

## Cosa leggere e dove scrivere

- [STATE.md](STATE.md): situazione corrente, limiti e attività in corso.
- [roadmap.md](../../roadmap.md): unica roadmap, con ID stabili, stato e prossimo passo.
- [DECISIONS.md](DECISIONS.md): decisioni durature e motivazioni.
- [changes/](changes/): un registro nuovo per ogni PR. I registri integrati sono storici e non si riscrivono; le correzioni si aggiungono.
- [TEMPLATE.md](TEMPLATE.md): modello da copiare per un nuovo registro.

La memoria su main descrive il progetto condiviso. Un registro su un branch descrive lavoro proposto fino al merge. Nessun merge costituisce da solo prova di rilascio in produzione. Le date documentano il momento dell'osservazione: per lo stato corrente controllare anche codice e PR collegate.

## Procedura obbligatoria

1. Leggere AGENTS.md, stato, roadmap, decisioni e registri pertinenti. Aggiornare il branch da main prima di iniziare o consegnare.
2. Collegare il lavoro a uno o più ID della roadmap; aggiungere un ID se necessario.
3. Modificare il progetto e creare un registro con nome `AAAA-MM-GG-descrizione.md`.
4. Riesaminare stato e roadmap: `updated` significa che il relativo file deve comparire nel diff; `unchanged` richiede una motivazione concreta di almeno 30 caratteri. Non è un'esenzione dalla lettura. Per decisioni durature aggiornare anche DECISIONS.md.
5. Nel campo JSON `files` elencare TUTTI i file cambiati dalla PR, inclusi documentazione e workflow, esclusi i registri sotto changes/. Per rinominare, elencare il vecchio e il nuovo percorso. Con più registri, vale la copertura complessiva.
6. Compilare tutte le sezioni; il controllo rifiuta sezioni vuote o segnaposto. Non inserire segreti o dati dei clienti. Aggiornare il registro anche dopo correzioni successive nella stessa PR.
7. Eseguire i test e aprire la PR usando il template. Risolvere eventuali conflitti di stato e roadmap mantenendo i lavori di entrambi i soci.

Controlli locali con Node 22 o successivo, senza dipendenze aggiuntive:

```sh
node --test deployment/shared-memory.test.mjs
node deployment/check-shared-memory.mjs --repo . --base origin/main --head HEAD
```

## Come funziona il controllo

`Shared memory required` si avvia per tutte le PR, senza filtri sui percorsi. Il workflow `pull_request_target` esegue il validatore preso dal branch di destinazione e legge il contenuto della PR come dati: non esegue codice, installazioni o test della PR, non usa segreti e ha solo permessi di lettura. Cambiare il validatore nella propria PR non cambia il controllo che la valuta. Un secondo workflow esegue test e controllo di formato della versione proposta, anche sui push a main.

Il controllo richiede almeno un nuovo registro, i campi e le sezioni obbligatori, ID presenti nella roadmap, coerenza della dichiarazione di aggiornamento di stato/roadmap, copertura dei file cambiati e conservazione dei registri storici. Non può dimostrare che una persona o un agente abbia letto o scritto informazioni vere: questo resta oggetto di revisione.

## Stato del blocco dei merge — verificato il 17 settembre 2026

**Blocco GitHub non attivato.** La lettura dei ruleset di questo repository privato restituisce HTTP 403: «Upgrade to GitHub Pro or make this repository public to enable this feature». La lettura della protezione di main tramite integrazione restituisce inoltre «Resource not accessible by integration».

I workflow possono fallire e la regola di progetto è obbligatoria, ma finché non è configurata una protezione compatibile, GitHub può consentire merge con controlli rossi e push diretti. Non è stato cambiato il piano, il costo o la visibilità del repository.

Un amministratore, su un piano che supporti protezioni per repository privati, deve proteggere main: richiedere pull request e i check `Shared memory required`, `Memory format and tests` e `verify`, richiedere il branch aggiornato, vietare force push e cancellazione e non concedere bypass ordinari. Selezionare i check prodotti da GitHub Actions dopo la loro prima esecuzione. Verificare concretamente con una PR senza registro che il merge sia bloccato, quindi aggiornare MEM-02 e STATE.md con l'esito. Documentazione: https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/managing-rulesets/available-rules-for-rulesets

La prima PR che installa questo sistema viene controllata dal workflow di autocontrollo; il validatore fidato diventa disponibile per le PR successive dopo l'integrazione su main. Le PR già aperte, inclusa #3, devono aggiornarsi da main e aggiungere il proprio registro prima del merge.
