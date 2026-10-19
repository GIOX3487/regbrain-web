// Domande mirate: nascono dalle prove, le risposte ricalibrano gli esiti con motivazione e danno
// ai requisiti un esito dichiarato; mai cancellare un esito.
import { test } from "node:test";
import assert from "node:assert/strict";
import { applyAnswersToFindings, buildQuestions, declaredOutcomes, MAX_PRE_QUESTIONS, openQuestions, parseAnswers } from "../supabase/functions/code-compliance/questions.ts";
import { assessRequirements } from "../supabase/functions/code-compliance/requirements.ts";
import { scan } from "../supabase/functions/code-compliance/scan.ts";

const files = [
  { name: "index.html", content: "<html><head><script src='https://www.googletagmanager.com/gtag/js?id=G-1'></script></head><body><img src='a.png'></body></html>" },
  { name: "server.js", content: "const key = 'AKIAIOSFODNN7EXAMPLE';\napp.post('/api/orders', (req, res) => { db.insert(req.body); });\napp.get('/api/me', requireAuth, (req, res) => {});\nfetch('http://api.interno/v1');\n" },
  { name: "package.json", content: '{"dependencies":{"express":"4","openai":"4"}}' },
];
const ctx = { appTypes: ["web", "backend"], personalData: "si", usesAI: "si" };

test("le domande nascono dalle prove trovate e dal contesto, in ordine di peso", () => {
  const { findings, evidence } = scan(files);
  const qs = buildQuestions({ ctx, findings, evidence, inferred: null, fileNames: files.map((f) => f.name) });
  const ids = qs.map((q) => q.id);
  for (const id of ["cmp", "gateway", "secrets", "http", "ai_data", "ai_notice", "hosting", "retention", "rights", "notice", "deps", "sec_events"]) assert.ok(ids.includes(id), `manca ${id}`);
  assert.ok(!ids.includes("mdr") && !ids.includes("minors"), "domande di settore senza contesto");
  assert.ok(qs.every((q, i) => i === 0 || qs[i - 1].priority <= q.priority), "ordine per priorità");
  assert.ok(qs.find((q) => q.id === "cmp").trigger.includes("index.html:1"), "la domanda cita la prova");
  assert.ok(qs.every((q) => q.kind === "text" || q.options.includes("Non so")));
  assert.ok(MAX_PRE_QUESTIONS >= 8);
});

test("le risposte ricalibrano gli esiti con la motivazione scritta, senza cancellarli", () => {
  const { findings } = scan(files);
  const answers = parseAnswers([
    { id: "secrets", q: "x", a: "No, sono valori di prova o di esempio" },
    { id: "gateway", q: "x", a: "No, stanno dietro un gateway o un proxy che autentica ogni chiamata" },
    { id: "http", q: "x", a: "Sì, almeno uno è un servizio esposto" },
    { id: "cmp", q: "x", a: "Non so" },
    { id: "ignota", q: "x", a: "qualcosa" },
    { q: "domanda del modello", a: "risposta libera" },
  ]);
  assert.equal(answers.length, 6);
  assert.equal(answers[4].id, undefined, "un id sconosciuto non produce effetti");
  const touched = applyAnswersToFindings(findings, answers);
  assert.equal(touched, 3);
  const sec01 = findings.find((f) => f.id === "SEC-01");
  assert.equal(sec01.risk, "low");
  assert.equal(sec01.status, "da_verificare");
  assert.match(sec01.adjustment, /valori di prova/);
  const sec16 = findings.find((f) => f.id === "SEC-16");
  assert.equal(sec16.risk, "medium");
  assert.match(sec16.adjustment, /gateway/);
  const sec03 = findings.find((f) => f.id === "SEC-03");
  assert.equal(sec03.risk, "high");
  const priv01 = findings.find((f) => f.id === "PRIV-01");
  assert.equal(priv01.risk, "high", "Non so non cambia nulla");
  assert.equal(priv01.adjustment, undefined);
  assert.equal(findings.length, scan(files).findings.length, "nessun esito cancellato");
});

test("i requisiti non valutabili diventano dichiarati; un problema dichiarato dà esiti; il codice vince dove decide", () => {
  const { findings, evidence } = scan(files);
  const names = files.map((f) => f.name);
  const base = Object.fromEntries(assessRequirements(ctx, findings, evidence, names).map((r) => [r.id, r]));
  assert.equal(base["R-GDPR-13"].outcome, "non_valutabile");
  assert.equal(base["R-GDPR-03"].outcome, "esiti");
  const answers = parseAnswers([
    { id: "retention", q: "x", a: "Sì, automatica (scadenze o processi programmati)" },
    { id: "rights", q: "x", a: "No" },
    { id: "gateway", q: "x", a: "No, stanno dietro un gateway o un proxy che autentica ogni chiamata" },
    { id: "cmp", q: "x", a: "No, non c'è un banner" },
  ]);
  const declared = declaredOutcomes(answers);
  assert.equal(declared.get("R-GDPR-13").outcome, "dichiarato");
  assert.equal(declared.get("R-GDPR-12").outcome, "esiti");
  const after = Object.fromEntries(assessRequirements(ctx, findings, evidence, names, answers).map((r) => [r.id, r]));
  assert.equal(after["R-GDPR-13"].outcome, "dichiarato");
  assert.equal(after["R-GDPR-13"].basis, "dichiarazione");
  assert.equal(after["R-GDPR-12"].outcome, "esiti");
  assert.equal(after["R-GDPR-12"].basis, "dichiarazione");
  assert.equal(after["R-GDPR-03"].outcome, "dichiarato", "il gateway sposta la prova fuori dal codice");
  assert.match(after["R-GDPR-03"].note, /Nel codice: .*rott/);
  assert.equal(after["R-COOKIE-01"].outcome, "esiti", "senza banner gli esiti del codice restano");
  assert.equal(after["R-COOKIE-01"].basis, "codice");
  assert.equal(after["R-COOKIE-02"].outcome, "esiti");
  assert.equal(after["R-ACC-01"].outcome, base["R-ACC-01"].outcome, "le risposte non toccano i requisiti estranei");
});

test("le domande senza risposta restano aperte, quelle risposte no", () => {
  const { findings, evidence } = scan(files);
  const all = buildQuestions({ ctx, findings, evidence, inferred: null, fileNames: files.map((f) => f.name) });
  const open = openQuestions(all, [{ id: "cmp", q: "x", a: "Non so" }, { q: all.find((q) => q.id === "gateway").text, a: "Sì, sono esposte direttamente" }, { id: "http", q: "x", a: "   " }]);
  const ids = open.map((q) => q.id);
  assert.ok(!ids.includes("cmp") && !ids.includes("gateway"), "risposte per id e per testo");
  assert.ok(ids.includes("http"), "una risposta vuota non conta");
});
