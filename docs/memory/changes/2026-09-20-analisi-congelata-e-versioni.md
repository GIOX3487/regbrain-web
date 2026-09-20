---
date: 2026-09-20
author: Matteo Piccirilli, agente Claude (Opus 5)
roadmap_ids: ["GAP-10", "GAP-11"]
state_review: updated
state_reason: Cambia la natura dell'analisi: non e' piu' un calcolo rifatto a ogni apertura ma un documento datato con la sua cronologia, e questo va scritto nello stato.
roadmap_review: updated
roadmap_reason: GAP-10 si sposta dal "ridurre l'oscillazione" al "non ricalcolare"; aggiunto GAP-11 sul riuso fra utenti diversi, che resta scoperto per ragioni di riservatezza.
files: ["supabase/functions/gap-analysis/index.ts", "supabase/migrations/20260920150000_assessment_runs.sql", "src/pages/AssessmentDetail.tsx", "src/components/compliance/AnalysisVersions.tsx", "src/lib/engine-version.ts", "src/integrations/supabase/types.ts", "deployment/engine-version.test.mjs", "package.json", "docs/memory/STATE.md", "roadmap.md"]
---

## Richiesta e contesto

La domanda era come ottenere che, caricando gli stessi documenti, l'analisi dia sempre gli stessi
esiti sugli stessi obblighi. Dalla misura del 20 settembre risultava che due giri identici
cambiavano 4,5 esiti su 51 e facevano oscillare la conformita' di quasi sei punti. La temperatura
del modello e' gia' a zero e zero non significa deterministico: con i modelli ospitati la somma in
virgola mobile dipende dal lotto di richieste in corso sul server, quindi lo stesso prompt puo'
dare token diversi. Il determinismo non si ottiene dal modello, si ottiene non richiamandolo.

Fra le tre strade proposte e' stata scelta la prima: l'analisi diventa un documento datato invece
di una domanda rifatta a ogni apertura.

## Modifiche e motivazione

Una memoria del risultato esisteva gia' ma era inutilizzabile come tale, perche' la sua chiave
comprendeva la versione del motore e l'elenco degli obblighi del catalogo: ogni correzione al
motore e ogni riga aggiunta al catalogo cancellavano la memoria di tutte le analisi fatte, e lo
stesso fascicolo ricaricato il giorno dopo veniva ricalcolato da capo. Ora l'impronta comprende
solo cio' che descrive il caso, cioe' documenti, dichiarazioni, normative, lingua, profilo e
fatturato. La versione del motore viene conservata accanto al risultato invece che dentro la
chiave, e la corrispondenza con il catalogo viene controllata al momento del riuso: se l'insieme
degli obblighi applicabili non e' piu' lo stesso il risultato salvato viene scartato, perche' non
risponderebbe piu' alle stesse domande.

Un'analisi gia' conclusa non viene piu' ricalcolata. Una seconda chiamata sullo stesso assessment
restituisce gli esiti salvati con `frozen: true`, senza toccare nulla. Il rifacimento esiste ma va
chiesto con `rerun: true`, e in quel caso i documenti vengono riletti dall'archivio
dell'assessment invece di essere richiesti di nuovo al client: un byte di differenza basterebbe a
produrre un fascicolo diverso da quello di cui si vuole il confronto.

Ogni giro completato scrive una riga in `assessment_runs`, con numero del giro, versione del
motore, se il risultato e' stato riusato, conformita', rischio e i 51 esiti. L'esito di ieri resta
accanto a quello di oggi invece di essere sovrascritto.

Nell'interfaccia, sopra le schede, un riquadro dice di quale versione si sta guardando l'esito e,
quando esiste un giro precedente, quanti obblighi sono cambiati e come, uno per uno. Se l'analisi
e' stata prodotta da un motore precedente il riquadro lo segnala in ambra e offre il rifacimento,
ma non rifa' niente da solo: gli esiti gia' consegnati a un cliente restano quelli finche' non e'
lui a chiedere il contrario. La versione corrente sta in `src/lib/engine-version.ts` e un test la
confronta con CHECKS_VERSION della edge function, cosi' le due non possono divergere in silenzio.

## Verifiche ed esiti

Controllo dei tipi con deno, tsc e build puliti, 20 test di backend verdi. Prove fatte in
produzione sul fascicolo reale da otto documenti dell'assessment Meridiana, poi rimosse.

- Prima analisi: 78 per cento di conformita', 51 esiti, motore v26.
- Riapertura della stessa analisi: `frozen: true`, nessun ricalcolo. L'assessment non e' stato
  toccato da quattro chiamate successive, ultimo aggiornamento fermo all'orario della prima.
- Seconda analisi, nuova, con gli stessi identici documenti e le stesse dichiarazioni: 51 obblighi
  su 51 con lo stesso stato, e zero differenze anche nel testo libero del giudizio. Identica.
- Risultato salvato marcato come prodotto da una versione precedente: viene comunque riusato e la
  versione riportata resta quella vecchia, che e' quello che serve all'avviso in ambra.
- Due rifacimenti espliciti: ricalcolo vero, 81 e 76 per cento, due righe in `assessment_runs`, tre
  obblighi cambiati fra il primo e il secondo, tutti con il riferimento normativo necessario
  all'elenco del confronto.

Difetto trovato e corretto durante la verifica: la tabella nuova aveva le policy ma non i
privilegi, e la funzione riceveva "permission denied" scrivendo la cronologia. L'analisi si
chiudeva lo stesso, perche' la registrazione del giro e' volutamente non bloccante, ma nessun giro
veniva registrato. Aggiunti i grant per `authenticated` e `service_role` e rifatta la prova.

## Rischi e limiti

Il riuso e' per utente: la ricerca filtra su `user_id`, quindi due persone che caricano lo stesso
fascicolo ottengono due analisi indipendenti e possono vedere numeri diversi. Condividere la
memoria fra utenti diversi significherebbe far leggere a uno le citazioni testuali dei documenti
di un altro, quindi non e' una cosa da fare senza un perimetro di organizzazione. Resta aperta
come GAP-11.

Il congelamento ha un effetto da accettare: chi ha un'analisi prodotta da un motore che sbagliava
se la tiene com'e' finche' non la rifa'. E' la scelta voluta, perche' un esito gia' consegnato non
deve cambiare da solo sotto il naso di chi lo ha firmato, e l'avviso in ambra esiste proprio per
rendere visibile il caso.

L'oscillazione del modello non e' sparita: si presenta ogni volta che il ricalcolo avviene davvero,
cioe' al primo giro e a ogni rifacimento. Fra i due rifacimenti di prova la conformita' e' passata
da 81 a 76 per cento. Quello che cambia e' che adesso l'oscillazione e' visibile e datata invece
di essere silenziosa.

La costante della versione vive in due file. Il test la protegge, ma resta una duplicazione.

## Prossimo passo

GAP-07, il nucleo minimo obbligatorio fermo presso la CLO: e' l'unica cosa che riduce
l'oscillazione quando il ricalcolo avviene davvero, perche' toglie al modello la liberta' di
scegliere ogni volta quali elementi pretendere. Nel frattempo vale la pena guardare il riquadro
delle versioni su un telefono, dove l'elenco degli obblighi cambiati va a capo, e decidere se il
confronto debba entrare anche nel PDF esportato: oggi il PDF racconta solo l'ultima versione.
