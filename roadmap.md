# Roadmap condivisa RegBrain

Aggiornata il 17 settembre 2026. Prima di lavorare leggere [AGENTS.md](AGENTS.md) e [stato](docs/memory/STATE.md). Una PR verde non significa rilascio completato. Nuove priorità e assegnazioni vanno concordate tra i soci e registrate; non attribuire automaticamente un responsabile.

| ID | Priorità | Attività | Stato osservato | Prossimo passo / criterio di chiusura |
| --- | --- | --- | --- | --- |
| MEM-01 | Alta | Memoria condivisa e istruzioni per persone/agenti | Integrata con PR #4, 18 test e CI su main verdi; check fidato verificato con caso negativo PR #5 | Mantenere il registro per ogni PR e riesaminare stato/roadmap; blocco merge separato in MEM-02. |
| MEM-02 | Alta | Blocco effettivo di merge e push senza memoria | Bloccato: piano privato senza ruleset; permessi integrazione insufficienti per leggere protezione main | Amministratore: abilitare piano/protezioni compatibili, richiedere check e PR, poi verificare che una PR senza registro non possa essere integrata. Non rendere pubblico il repository. |
| GAP-01 | Alta | Affidabilità evidenze, cache e salvataggio atomico | Implementato in [PR #3](https://github.com/GIOX3487/regbrain-web/pull/3), bozza; CI verde; non su main/non rilasciato | Preflight DB compatibile, ma nessuno staging esistente: confermare ambiente/organizzazione e costo prima della creazione; poi collaudo, migrazione prima delle funzioni e rilascio verificato. Dettagli in docs/memory/STAGING.md. |
| GAP-02 | Alta | Qualità e copertura catalogo normativo | Da verificare; lacune italiane segnalate nel PDF del socio | Inventario del corpus attuale, fonti/versioni/date, campione di riferimenti; confermare copertura D.Lgs. 138/2024 e fonti ACN. |
| GAP-03 | Media | Applicabilità esplicita e spiegabile | Raccolta delle dichiarazioni ed esclusioni su main; verifica del 17 settembre su corpus a verità nota ha trovato tre falsi "non applicabile" (artt. 30, 35, 37), corretti in PR aperta | Integrare la correzione, rieseguire il corpus a verità nota, poi verificare caso per caso le note delle altre cinque normative. |
| GAP-04 | Media | Tracciabilità delle evidenze e documenti lunghi | Proposta | Collegare documento/pagina/offset e verificare limiti di estrazione, OCR e troncamento (budget 40k caratteri/limiti pagine da verificare per percorso). |
| GAP-05 | Media | Risoluzione dei gap e rivalutazione | Proposta | Definire responsabile, azione, nuova evidenza e storico di rivalutazione; criteri di completamento prima di implementare. |
| SITE-01 | Media | Sito pubblico allineato al posizionamento | Homepage riscritta con i testi del pitch in [PR aperta](https://github.com/GIOX3487/regbrain-web/pull/new/claude/homepage-testi-pitch); rimossi il posizionamento enterprise, la sezione RAG contro AI generaliste e il dato 98% non sostenuto | Guardare l'anteprima del branch, decidere su indirizzo di contatto pubblico e sezione team, poi integrare. |
| SITE-02 | Alta | Pagine legali allineate al prodotto | Cookie policy, informativa privacy e termini riscritti sul censimento di codice e database nella stessa PR di SITE-01 | Far rivedere i tre testi dal Chief Legal Officer, completare i dati del titolare quando la societa' e' costituita, accertare il piano dell'API Gemini e valutare i backup del database. |
| DOC-01 | Da definire | Generazione DPIA/RoPA dal contesto chat e allegati | Esigenza riportata nel PDF, avanzamento non verificato | Verificare flusso attuale e distinguere funzionalità esistenti da sviluppi richiesti. |
| LEGACY-01 | Da riconfermare | Fix errore download documento DPIA/LIA | Task dell'8 settembre 2026, esito non verificato | Riprodurre il download e registrare esito; non chiudere sulla base della sola presenza di codice. |
| LEGACY-02 | Da riconfermare | Sezione team: sostituire Martina Manno con Giovanni Sollami (bio dal pitch), rimuovere Roberto Ponticiello (CFO) | Task dell'8 settembre 2026, esito non verificato | Verificare contenuti attuali e riferimento al pitch prima di modificare o segnare concluso. |

## Regole di manutenzione

- Conservare gli ID; per nuove attività assegnare un nuovo ID e un prossimo passo verificabile.
- Aggiornare stato e prove quando cambia un'attività. Conservare le attività chiuse con link al registro/PR e, se pertinente, alla verifica del rilascio.
- Chi prende in carico un'attività lo indica nella propria PR e nel registro; nessuna assegnazione implicita ai soci.
- Non usare altri file come roadmap concorrenti. Le specifiche tecniche e i registri possono approfondire e collegare questi ID.
