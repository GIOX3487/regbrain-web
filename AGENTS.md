# RegBrain: istruzioni obbligatorie per chi modifica il repository

Queste regole valgono per persone, Codex, Claude, Copilot, Cursor, Lovable e qualsiasi altro agente. Il responsabile della modifica deve fornire questo file agli strumenti che non lo leggono automaticamente.

## Prima di lavorare

1. Aggiorna la copia del repository e leggi `docs/memory/STATE.md`, `roadmap.md` e `docs/memory/DECISIONS.md`.
2. Leggi i registri in `docs/memory/changes/` pertinenti alla modifica. Verifica il codice: la memoria documenta fatti e decisioni, non sostituisce il codice.
3. Identifica il task della roadmap; se manca, aggiungilo. Controlla i lavori in corso prima di duplicarli. Non considerare una PR aperta come integrata o un merge come un rilascio verificato.

## Per ogni modifica, senza eccezioni per documentazione o agenti

- Lavora su un branch e apri una pull request. Evita push diretti su `main`, anche da editor web o strumenti che sincronizzano automaticamente.
- Aggiungi almeno un NUOVO registro `docs/memory/changes/AAAA-MM-GG-descrizione.md` nella stessa PR, usando `docs/memory/TEMPLATE.md`.
- Elenca tutti i file modificati, il motivo, le verifiche realmente eseguite, i limiti e il prossimo passo. Aggiorna il registro quando cambia il contenuto della PR, anche se i file restano gli stessi.
- Riesamina SEMPRE stato e roadmap. Aggiornali quando cambiano; se non cambiano, dichiara nel registro perché. Usa ID della roadmap esistenti. Ogni lavoro incompleto deve avere un prossimo passo.
- Registra le decisioni durature in `docs/memory/DECISIONS.md`. Non cancellare i registri già integrati: eventuali correzioni vanno in un nuovo registro che cita quello precedente.
- Non inserire segreti, credenziali, dati di clienti o intere conversazioni. Distingui fatti verificati, informazioni riferite e ipotesi.
- Esegui i controlli pertinenti e quelli della memoria. Non segnare test non eseguiti come superati. Non dichiarare concluso il lavoro se la memoria non è aggiornata.

## Prima del merge

Devono essere verdi `Shared memory / Shared memory required`, `Memory self-check / Memory format and tests` e i controlli applicativi pertinenti. Il revisore verifica anche che il contenuto del registro corrisponda al codice: l'automazione verifica struttura e copertura dei file, non la veridicità del testo o l'effettiva lettura da parte dell'agente.

La procedura di aggiornamento è in `docs/memory/README.md`. Lo stato del blocco tecnico dei merge è dichiarato lì: non confondere una regola di progetto con una protezione già attiva su GitHub.
