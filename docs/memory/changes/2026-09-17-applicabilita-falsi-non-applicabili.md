---
date: 2026-09-17
author: Matteo Piccirilli, agente Claude (Opus 5)
roadmap_ids: ["GAP-03"]
state_review: updated
state_reason: Lo stato descriveva la raccolta dell'applicabilita come presente su main senza segnalare che le regole di esclusione potevano rendere non applicabili obblighi generali; va registrato l'esito della verifica e la correzione.
roadmap_review: updated
roadmap_reason: GAP-03 risultava "proposta, euristiche ancora da superare": le euristiche sono ora sostituite da un elenco esplicito per il GDPR e da una rete di sicurezza sulle prove, con casi di prova eseguiti.
files: ["supabase/functions/gap-analysis/index.ts", "docs/memory/STATE.md", "roadmap.md"]
---

## Richiesta e contesto

Verifica richiesta il 17 settembre: accertare se la gap analysis su main sia accurata e precisa
nelle risposte. La verifica e' stata condotta con un corpus di prova a verita' nota, otto documenti
GDPR di un'azienda ben documentata (informativa, registro dei trattamenti completo, procedura
diritti, procedura violazioni, elenco responsabili con le clausole dell'articolo 28, politica di
sicurezza, atto di designazione del DPO con relazione, valutazione d'impatto sulla
videosorveglianza), piu' tre omissioni deliberate per misurare anche i gap non rilevati.

## Modifiche e motivazione

La verifica ha trovato tre falsi "non applicabile" su obblighi centrali e documentati:

- articolo 30, registro delle attivita' di trattamento, escluso perche' l'organizzazione aveva
  dichiarato di non effettuare trasferimenti extra UE;
- articolo 35, valutazione d'impatto, escluso perche' aveva dichiarato di non fare profilazione;
- articolo 37, designazione del DPO, escluso perche' aveva dichiarato di non trattare categorie
  particolari di dati.

Causa: la regola di applicabilita' cercava le parole della condizione anche nella descrizione
dell'obbligo, non solo nella nota di applicabilita'. La descrizione dell'articolo 30 cita i
trasferimenti fra i campi del registro, quella dell'articolo 35 cita la profilazione fra le
ipotesi di rischio elevato. Inoltre le note del GDPR elencano spesso condizioni alternative
("obbligatorio sopra i 250 dipendenti, oppure se il trattamento non e' occasionale, oppure se
include categorie particolari"): trovarne una falsa non rende il requisito inapplicabile.

Correzioni in `supabase/functions/gap-analysis/index.ts`:

- la corrispondenza guarda solo `applicability_note_it`, mai la descrizione dell'obbligo, e ignora
  gli esempi fra parentesi o dopo "es.", che illustrano la condizione senza esaurirla;
- il GDPR non usa piu' espressioni regolari: un elenco esplicito indica i soli articoli che
  dipendono da una condizione unica (44-49 trasferimenti, 9 e 10 categorie particolari, 22
  decisioni automatizzate, 27 stabilimento fuori UE, 91 enti religiosi). Per tutti gli altri
  decide la valutazione sulle prove, che riceve comunque le dichiarazioni fra i fatti;
- rete di sicurezza: un requisito che i documenti coprono per almeno meta' delle parole chiave non
  viene escluso da una dichiarazione, ma passa alla valutazione sulle prove. Non si applica
  all'esclusione dell'intera normativa, perche' chi non e' entita' finanziaria non ricade in DORA
  nemmeno se la sua politica di sicurezza ne tocca gli stessi temi;
- `CHECKS_VERSION` portata a v21 per invalidare la cache dei risultati precedenti.

## Verifiche ed esiti

Prima della correzione, sul corpus a verita' nota: 9 requisiti documentati, 14 parziali, 2 mancanti,
10 da verificare, 16 non applicabili, conformita' 64 per cento. I 2 mancanti corrispondono a due
delle tre omissioni deliberate (articolo 19 e articolo 20); la terza (articolo 31) e' risultata
parziale, coerentemente con il fatto che la relazione del DPO cita la cooperazione con l'Autorita'.
Fra i 16 non applicabili, 3 sono i falsi descritti sopra.

Dopo la correzione: eseguire di nuovo lo stesso corpus e confrontare (vedere prossimo passo).
`deno check` sulla funzione e' verde. Non sono stati eseguiti test end to end su un ambiente di
staging, che non esiste; le prove sono state fatte sul progetto Supabase in uso, con una valutazione
di prova creata e poi rimossa.

## Rischi e limiti

L'elenco esplicito per il GDPR va mantenuto se il catalogo cambia: un nuovo requisito GDPR con
condizione unica non viene escluso finche' non e' aggiunto all'elenco, il che e' prudente ma non
automatico. La rete di sicurezza usa le parole chiave del catalogo, quindi dipende dalla loro
qualita'. Le altre cinque normative continuano a usare le espressioni regolari sulla nota: le loro
note sono affermazioni di ruolo con una sola condizione, ma non e' stato verificato caso per caso
come per il GDPR.

Questa modifica tocca gli stessi file della PR #3, ancora aperta: chi la integra deve riconciliare
le due versioni invece di sovrascrivere.

## Prossimo passo

Rieseguire il corpus a verita' nota e verificare che articoli 30, 35 e 37 tornino valutati sulle
prove; poi estendere la verifica caso per caso alle note delle altre cinque normative (GAP-03).
