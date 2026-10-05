// Analisi strutturale fra righe e fra file: consenso prima del tracciamento, autorizzazione sulle rotte.
import { test } from "node:test";
import assert from "node:assert/strict";
import { scan } from "../supabase/functions/code-compliance/scan.ts";
import { consentManagerEvidence } from "../supabase/functions/code-compliance/consent.ts";
import { analyzeRoutes, unprotectedRoutes } from "../supabase/functions/code-compliance/routes.ts";

test("un commento TODO non è un gestore del consenso", () => {
  const files = [{ name: "app.js", content: "// TODO: implement cookieConsent\nReactGA.initialize('G-1');\n" }];
  assert.deepEqual(consentManagerEvidence(files), []);
  const { findings, evidence } = scan(files);
  const priv = findings.find((f) => f.id === "PRIV-01");
  assert.ok(priv && priv.risk === "high" && priv.status === "confermato");
  assert.ok(priv.why.includes("commenti e TODO non contano"));
  assert.equal(evidence.consentManager.length, 0);
});

test("una riga di codice con la libreria del consenso conta, e il tracker non protetto resta da verificare", () => {
  const files = [
    { name: "consent.js", content: "import 'vanilla-cookieconsent';\nCookieConsent.run({});\n" },
    { name: "app.js", content: "ReactGA.initialize('G-1');\n" },
  ];
  const { findings, evidence } = scan(files);
  assert.ok(evidence.consentManager.length >= 1);
  const priv = findings.find((f) => f.id === "PRIV-01");
  assert.ok(priv && priv.status === "da_verificare" && priv.risk === "medium");
});

test("un tracker dentro un controllo del consenso è una verifica superata, non un esito", () => {
  const files = [{ name: "app.js", content: "CookieConsent.run({ onConsent: () => {\n  if (CookieConsent.acceptedCategory('analytics')) {\n    ReactGA.initialize('G-1');\n  }\n}});\n" }];
  const { findings, evidence } = scan(files);
  assert.equal(findings.find((f) => f.id === "PRIV-01"), undefined);
  assert.equal(evidence.trackers.total, 1);
  assert.equal(evidence.trackers.gated.length, 1);
  assert.equal(evidence.trackers.ungated, 0);
});

test("rotte Express: middleware sulla rotta, controllo nel corpo, globale prima delle rotte, pubbliche per natura", () => {
  const files = [{ name: "server.js", content: [
    "const app = express();",
    "app.post('/api/login', login);",
    "app.get('/api/me', requireAuth, (req, res) => res.json(req.user));",
    "app.post('/api/orders', (req, res) => { db.insert(req.body); });",
    "app.get('/api/orders/:id', (req, res) => { if (!req.user) return res.sendStatus(401); });",
    "app.use(authenticate);",
    "app.delete('/api/orders/:id', (req, res) => { db.remove(req.params.id); });",
  ].join("\n") }];
  const a = analyzeRoutes(files);
  assert.equal(a.routes.length, 5);
  const byPath = Object.fromEntries(a.routes.map((r) => [`${r.method} ${r.path}`, r]));
  assert.ok(byPath["POST /api/login"].publicByNature);
  assert.ok(byPath["GET /api/me"].auth);
  assert.equal(byPath["POST /api/orders"].auth, null);
  assert.ok(byPath["GET /api/orders/:id"].auth);
  assert.ok(byPath["DELETE /api/orders/:id"].auth, "il controllo globale copre le rotte che seguono");
  const bad = unprotectedRoutes(a);
  assert.deepEqual(bad.map((r) => r.path), ["/api/orders"]);
  const { findings, evidence } = scan(files);
  const sec16 = findings.find((f) => f.id === "SEC-16");
  assert.ok(sec16 && sec16.risk === "high" && sec16.status === "da_verificare");
  assert.equal(sec16.occurrences[0].snippet, "POST /api/orders");
  assert.equal(evidence.routes.total, 5);
});

test("FastAPI con dipendenza globale e Flask con decoratore: nessuna rotta scoperta; NestJS con guard di classe", () => {
  const files = [
    { name: "api.py", content: "app = FastAPI(dependencies=[Depends(get_current_user)])\n\n@app.post('/items')\ndef create(item: dict):\n    return item\n" },
    { name: "views.py", content: "@login_required\n@app.route('/admin', methods=['POST'])\ndef admin():\n    return 'ok'\n" },
    { name: "users.controller.ts", content: "@UseGuards(AuthGuard)\n@Controller('users')\nexport class UsersController {\n  @Post()\n  create() {}\n}\n" },
  ];
  const a = analyzeRoutes(files);
  assert.equal(a.routes.length, 3);
  assert.deepEqual(unprotectedRoutes(a), []);
});

test("app.get('view engine') non è una rotta e il framework ignoto non produce esiti", () => {
  const a = analyzeRoutes([{ name: "x.js", content: "app.get('view engine', 'ejs');\nconst v = cache.get('k');\n" }]);
  assert.equal(a.routes.length, 0);
  assert.equal(scan([{ name: "x.rb", content: "get '/x' do\nend\n" }]).findings.find((f) => f.id === "SEC-16"), undefined);
});
