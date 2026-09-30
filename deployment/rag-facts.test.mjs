// Risposte dell'intake che non sono fatti: test della regola usata da rag-query.
import test from "node:test";
import assert from "node:assert/strict";
import { isAmbiguousAnswer } from "../supabase/functions/rag-query/facts.ts";

const q = "In quale Stato membro operano i dipendenti e sono già stati coinvolti i rappresentanti sindacali o l'Ispettorato del Lavoro (es. art. 4 Statuto Lavoratori in Italia)?";

test("la risposta che ricopia le opzioni della domanda è ambigua", () => {
  assert.equal(isAmbiguousAnswer(q, "Italia (accordo sindacale/ispettorato)"), true);
  assert.equal(isAmbiguousAnswer(q, "accordo sindacale/ispettorato"), true);
});

test("una risposta esplicita non è ambigua", () => {
  assert.equal(isAmbiguousAnswer(q, "Italia, accordo sindacale firmato con le RSU a marzo 2026"), false);
  assert.equal(isAmbiguousAnswer(q, "Italia, nessun accordo ancora stipulato: dobbiamo ancora avviare la procedura"), false);
});

test("una risposta secca a una domanda chiusa resta un fatto", () => {
  assert.equal(isAmbiguousAnswer("L'accordo sindacale è già stato stipulato?", "Sì"), false);
  assert.equal(isAmbiguousAnswer("Quanti dipendenti avete?", "45"), false);
});

test("risposta vuota è ambigua", () => {
  assert.equal(isAmbiguousAnswer(q, ""), true);
});

// Scelte multiple e violazioni dei dati.
import { inferMultiple, isBreachContext } from "../supabase/functions/rag-query/facts.ts";

test("più scelte selezionate nell'interfaccia non sono una risposta ambigua", () => {
  assert.equal(isAmbiguousAnswer("Quali categorie di dati trattate?", "Dati sanitari; Dati finanziari o di pagamento"), false);
  assert.equal(isAmbiguousAnswer("Qual è il vostro ruolo nel trattamento?", "Titolare del trattamento; Responsabile del trattamento per conto dei clienti"), false);
});

test("categorie di dati e ruoli che coesistono ammettono più risposte", () => {
  assert.equal(inferMultiple("Quali categorie di dati personali sono coinvolte?", ["Anagrafici", "Sanitari", "Finanziari"]), true);
  assert.equal(inferMultiple("Agite come titolare o come responsabile del trattamento?", ["Titolare del trattamento", "Responsabile del trattamento"]), true);
  assert.equal(inferMultiple("Quali conseguenze avete già osservato per gli interessati?", ["Frode", "Perdita economica", "Nessuna"]), true);
});

test("una domanda chiusa resta a scelta singola", () => {
  assert.equal(inferMultiple("La DPIA è già stata redatta?", ["Sì", "No"]), false);
  assert.equal(inferMultiple("Quanti dipendenti avete?", undefined), false);
  assert.equal(inferMultiple("In quale Stato membro operate?", ["Italia", "Germania"]), false);
});

test("riconosce una violazione dei dati anche senza la parola data breach", () => {
  assert.equal(isBreachContext(["Ci hanno colpito con un ransomware e i dati dei clienti sono cifrati"]), true);
  assert.equal(isBreachContext(["Un dipendente ha smarrito il portatile con l'archivio clienti"]), true);
  assert.equal(isBreachContext(["Abbiamo inviato una email al destinatario sbagliato con un referto"]), true);
  assert.equal(isBreachContext(["Dobbiamo notificare la violazione al Garante?"]), true);
  assert.equal(isBreachContext([null, undefined, "Come si redige un registro dei trattamenti?"]), false);
  assert.equal(isBreachContext(["Quali cookie richiedono il consenso?"]), false);
});
