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
