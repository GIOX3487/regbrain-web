import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { scan } from '../supabase/functions/code-compliance/scan.ts';
import { inferContext } from '../supabase/functions/code-compliance/infer.ts';
import { buildExcerpts, lineFromExcerpts } from '../supabase/functions/code-compliance/excerpts.ts';

// Un piccolo progetto finto: app web con backend Express, app Android, OpenAI, campi personali.
const project = [
  { name: 'package.json', content: '{"name":"demo","dependencies":{"react":"18","express":"4","stripe":"12","openai":"4"}}' },
  { name: 'android/app/src/main/AndroidManifest.xml', content: '<manifest><application></application></manifest>' },
  { name: 'src/models/user.ts', content: 'export interface Utente {\n  email: string;\n  telefono: string;\n  codice_fiscale: string;\n  diagnosi?: string;\n}\n' },
  { name: 'src/ai.ts', content: 'import OpenAI from "openai";\nconst client = new OpenAI();\n' },
  { name: 'src/pages/signup.tsx', content: 'export function Signup() { return <form action="/register">registrazione</form>; }\nconst checkout = "carrello";\n' },
  { name: 'src/pages/cart.tsx', content: 'export const Cart = () => <Checkout items={cart} />;\n' },
  { name: 'src/api/register.ts', content: 'export async function register(newsletter: boolean) { return createAccount(newsletter); }\n' },
  { name: 'src/pages/account.tsx', content: 'const customer = useCustomer();\n' },
  { name: 'src/api/consumer.ts', content: 'export const consumer = true;\n' },
  { name: 'src/payments.ts', content: 'import Stripe from "stripe";\nconst pi = await stripe.paymentIntents.create({ amount });\nconst sepa = true;\n' },
  { name: 'src/server.js', content: 'const express = require("express");\napp.get("/u", (req, res) => { db.query("SELECT * FROM users WHERE id = " + req.query.id); });\nconsole.log("utente", user.email);\n' },
  { name: 'tests/fixtures/utente.test.ts', content: 'const salute = "diagnosi finta"; const password = "Passw0rdFinta2026";' },
];

test('il contesto viene dedotto dal codice con le prove', () => {
  const inf = inferContext(project);
  const values = (l) => l.map((d) => d.value);
  assert.ok(values(inf.appTypes).includes('web'), 'web da react in package.json');
  assert.ok(values(inf.appTypes).includes('backend'), 'backend da express');
  assert.ok(values(inf.appTypes).includes('mobile'), 'mobile dal manifest Android');
  assert.ok(!values(inf.appTypes).includes('libreria'), 'non è una libreria se è anche un\'app');
  assert.ok(values(inf.personalData).includes('email'));
  assert.ok(values(inf.personalData).includes('codice fiscale'));
  assert.ok(values(inf.personalData).includes('categorie particolari'));
  assert.ok(values(inf.usesAI).includes('OpenAI'));
  const finanza = inf.sectors.find((d) => d.value === 'finanza');
  assert.ok(finanza && finanza.confidence === 'alta', 'finanza sicura: stripe è nel manifest');
  const consumatori = inf.audiences.find((d) => d.value === 'consumatori');
  assert.ok(consumatori && consumatori.confidence === 'alta', 'consumatori in cinque file');
  assert.ok(inf.frameworks.includes('React') && inf.frameworks.includes('Express') && inf.frameworks.includes('Stripe'));
  for (const d of [...inf.appTypes, ...inf.personalData, ...inf.usesAI]) {
    assert.ok(d.evidence.length > 0 && d.evidence[0].file && d.evidence[0].line > 0, `${d.value} senza prova`);
  }
  // Un indizio in una sola pagina di testo non fa un settore.
  assert.ok(!inf.sectors.some((d) => d.value === 'sanita'), 'la parola diagnosi in un file di prova non rende il progetto sanitario');
  // I file di prova non contano come dati personali trattati.
  assert.ok(!inf.personalData.some((d) => d.evidence.some((e) => e.file.startsWith('tests/'))));
});

test('gli estratti coprono ogni esito, i manifest e rispettano il tetto', () => {
  const { findings, masks } = scan(project);
  const excerpts = buildExcerpts(project, findings, masks, 4000);
  assert.ok(excerpts.length > 0);
  assert.ok(excerpts.reduce((n, e) => n + e.text.length, 0) <= 4000, 'tetto superato');
  for (const f of findings) for (const o of f.occurrences) {
    const line = lineFromExcerpts(excerpts, o.file, o.line);
    assert.ok(line !== null, `riga ${o.file}:${o.line} non negli estratti`);
  }
  assert.ok(excerpts.some((e) => e.file === 'package.json'), 'il manifest è negli estratti');
  assert.equal(lineFromExcerpts(excerpts, 'file-inesistente.ts', 3), null);
});

test('i segreti sono mascherati negli estratti', () => {
  const files = [{ name: 'cfg.js', content: 'const STRIPE = "sk_live_51HxxAbCdEfGhIjKlMnOpQrStUvWx";\nconst dbPassword = "Sup3rS3gret2026";\n' }];
  const { findings, masks } = scan(files);
  const text = buildExcerpts(files, findings, masks).map((e) => e.text).join('\n');
  assert.ok(!text.includes('sk_live_51Hxx'), 'chiave Stripe in chiaro');
  assert.ok(!text.includes('Sup3rS3gret2026'), 'password in chiaro');
});

test('la stessa scansione nel browser e nella funzione dà lo stesso esito', () => {
  // Le regole sono un solo modulo: qui si verifica che il banco di prova dia lo stesso risultato
  // a due chiamate, come farebbero browser e funzione con gli stessi file.
  const dir = fileURLToPath(new URL('./code-rules-cases/', import.meta.url));
  const files = fs.readdirSync(dir).sort().map((name) => ({ name, content: fs.readFileSync(path.join(dir, name), 'utf8') }));
  assert.equal(JSON.stringify(scan(files).findings), JSON.stringify(scan(files).findings));
});
