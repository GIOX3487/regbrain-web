// Copertura dei requisiti: ogni regola risponde a un requisito, ogni requisito ha fonti vere, gli esiti seguono il contesto.
import { test } from "node:test";
import assert from "node:assert/strict";
import { REQUIREMENTS, assessRequirements, summarizeRequirements } from "../supabase/functions/code-compliance/requirements.ts";
import { REFS, RULES, FILE_RULES } from "../supabase/functions/code-compliance/rules.ts";
import { scan, EMPTY_EVIDENCE } from "../supabase/functions/code-compliance/scan.ts";

const ruleIds = new Set([...RULES.map((r) => r.id), ...FILE_RULES.map((r) => r.id), "SEC-16"]);

test("ogni regola è collegata ad almeno un requisito e ogni requisito cita regole e fonti esistenti", () => {
  const covered = new Set(REQUIREMENTS.flatMap((r) => r.rules || []));
  const orphan = [...ruleIds].filter((id) => !covered.has(id) && id !== "SEC-16");
  assert.deepEqual(orphan, [], `regole senza requisito: ${orphan.join(", ")}`);
  for (const r of REQUIREMENTS) {
    for (const id of r.rules || []) assert.ok(ruleIds.has(id), `${r.id} cita la regola inesistente ${id}`);
    for (const ref of r.refs) assert.ok(REFS[ref], `${r.id} cita la fonte inesistente ${ref}`);
    assert.ok(r.method !== "manuale" || r.manual, `${r.id} manuale senza istruzioni`);
  }
  assert.equal(new Set(REQUIREMENTS.map((r) => r.id)).size, REQUIREMENTS.length);
});

test("il contesto decide l'applicabilità: niente accessibilità per un backend, niente NIS2 se non dichiarato", () => {
  const backend = assessRequirements({ appTypes: ["backend"], personalData: "si" }, [], EMPTY_EVIDENCE, ["server/app.js"]);
  const acc = backend.filter((r) => r.id.startsWith("R-ACC"));
  assert.ok(acc.every((r) => r.outcome === "non_applicabile"));
  assert.equal(backend.find((r) => r.id === "R-NIS2-01").outcome, "non_applicabile");
  const nis2 = assessRequirements({ appTypes: ["web"], sectors: ["nis2"], personalData: "si" }, [], EMPTY_EVIDENCE, ["index.html", "server.js"]);
  assert.equal(nis2.find((r) => r.id === "R-NIS2-01").outcome, "nessun_esito");
  assert.equal(nis2.find((r) => r.id === "R-ACC-01").outcome, "nessun_esito");
});

test("gli esiti delle regole e le prove strutturali danno i cinque esiti", () => {
  const files = [
    { name: "index.html", content: "<html><head><script src='https://www.googletagmanager.com/gtag/js?id=G-1'></script></head><body><img src='a.png'></body></html>" },
    { name: "server.js", content: "app.post('/api/orders', (req, res) => { db.insert(req.body); });\napp.get('/api/me', requireAuth, (req, res) => {});\n" },
  ];
  const { findings, evidence } = scan(files);
  const res = assessRequirements({ appTypes: ["web", "backend"], personalData: "si", usesAI: "no" }, findings, evidence, files.map((f) => f.name));
  const by = Object.fromEntries(res.map((r) => [r.id, r]));
  assert.equal(by["R-COOKIE-01"].outcome, "esiti");
  assert.equal(by["R-COOKIE-02"].outcome, "esiti");
  assert.equal(by["R-SEC-05"].outcome, "esiti");
  assert.equal(by["R-ACC-01"].outcome, "esiti");
  assert.equal(by["R-GDPR-01"].outcome, "nessun_esito");
  assert.equal(by["R-GDPR-11"].outcome, "non_valutabile");
  assert.equal(by["R-AI-01"].outcome, "non_applicabile");
  const c = summarizeRequirements(res);
  assert.equal(c.esiti + c.superato + c.nessun_esito + c.non_valutabile + c.non_applicabile, REQUIREMENTS.length);
});

test("tracker protetti e rotte tutte controllate: requisiti superati con le prove", () => {
  const files = [
    { name: "index.html", content: "<html lang='it'><head><title>x</title><script type='text/plain' data-cookiecategory='analytics' src='https://www.googletagmanager.com/gtag/js?id=G-1'></script><script src='cookieconsent.umd.js'></script></head></html>" },
    { name: "server.js", content: "app.use(requireAuth);\napp.post('/api/orders', (req, res) => {});\n" },
  ];
  const { findings, evidence } = scan(files);
  const by = Object.fromEntries(assessRequirements({ appTypes: ["web", "backend"], personalData: "si" }, findings, evidence, files.map((f) => f.name)).map((r) => [r.id, r]));
  assert.equal(by["R-COOKIE-01"].outcome, "superato");
  assert.ok(by["R-COOKIE-01"].evidence.length === 1);
  assert.equal(by["R-COOKIE-02"].outcome, "superato");
  assert.equal(by["R-SEC-05"].outcome, "superato");
  assert.equal(by["R-GDPR-03"].outcome, "superato");
});

test("un falso positivo riconosciuto dal modello toglie il requisito dagli esiti", () => {
  const findings = [{ id: "SEC-01", ruleId: "SEC-01", status: "possibile_falso_positivo" }];
  const by = Object.fromEntries(assessRequirements({ appTypes: ["backend"], personalData: "si" }, findings, EMPTY_EVIDENCE, ["a.js"]).map((r) => [r.id, r]));
  assert.equal(by["R-GDPR-01"].outcome, "nessun_esito");
});
