// Mascheratura dei segreti: niente del valore deve restare in ciò che esce dal browser o entra nel referto.
import { test } from "node:test";
import assert from "node:assert/strict";
import { redactLine, redactSecrets, configSecret } from "../supabase/functions/code-compliance/secrets.ts";
import { scan } from "../supabase/functions/code-compliance/scan.ts";
import { buildExcerpts } from "../supabase/functions/code-compliance/excerpts.ts";

const VALUES = ["correcthorsebattery", "S3cret!Pa55", "Pr0duzione2026x", "wJalrXUtnFEMI/K7MDENG/bPxRfiCYNOTAKEY", "ghp_abcdefghijklmnopqrstuvwxyz0123456789ABCD"];

test("valori assegnati a nomi da segreto spariscono del tutto, anche senza cifre", () => {
  const out = redactLine('const password = "correcthorsebattery";', "a.js");
  assert.ok(!out.includes("correcthorse") && !out.includes("corr"), out);
  assert.ok(out.includes("[SEGRETO RIMOSSO]"));
});

test("file di configurazione senza virgolette, URL con credenziali, header di autenticazione", () => {
  assert.ok(!redactLine("password: Pr0duzione2026x", "docker-compose.yml").includes("Pr0d"));
  assert.ok(!redactLine("DB_PASSWORD=S3cret!Pa55", ".env").includes("S3cret"));
  assert.ok(!redactLine('const u = "postgres://admin:S3cret!Pa55@db:5432/app";', "a.js").includes("S3cret"));
  assert.ok(redactLine('const u = "postgres://admin:S3cret!Pa55@db:5432/app";', "a.js").includes("postgres://admin:"));
  assert.ok(!redactLine('headers: { Authorization: "Bearer abcdef123456789xyz" }', "a.js").includes("abcdef"));
});

test("il corpo di una chiave privata sparisce, l'intestazione resta", () => {
  const pem = "-----BEGIN RSA PRIVATE KEY-----\nMIIEvQIBADANBgkqhkiG9w0BAQEFAASCBKcwggSjAgEAAoIBAQC7\nabcd\n-----END RSA PRIVATE KEY-----";
  const out = redactSecrets(pem, "k.pem");
  assert.ok(out.includes("BEGIN RSA PRIVATE KEY") && !out.includes("MIIEvQ"), out);
  assert.ok(!redactLine("MIIEvQIBADANBgkqhkiG9w0BAQEFAASCBKcwggSjAgEAAoIBAQC7", "k.pem").includes("MIIEvQ"));
});

test("i riferimenti non vengono mascherati: il codice resta leggibile", () => {
  assert.equal(redactLine("const apiKey = process.env.API_KEY;", "a.js"), "const apiKey = process.env.API_KEY;");
  assert.equal(redactLine("api_key: ${API_KEY}", "config.yml"), "api_key: ${API_KEY}");
  assert.equal(redactLine('"passport": "^0.6.0",', "package.json"), '"passport": "^0.6.0",');
  assert.equal(redactLine('const tokenizer = new Tokenizer("bert-base");', "a.js"), 'const tokenizer = new Tokenizer("bert-base");');
});

test("SEC-01 scatta anche nei file di configurazione senza virgolette", () => {
  assert.ok(configSecret("password: Pr0duzione2026x", "docker-compose.yml"));
  assert.equal(configSecret("password: ${SMTP_PASSWORD}", "docker-compose.yml"), null);
  assert.equal(configSecret("api_key: changeme", "config.yml"), null);
});

test("né le righe citate né gli estratti per il modello contengono un segreto, nemmeno in parte", () => {
  const files = [
    { name: "server/config.js", content: `const password = "${VALUES[0]}";\nconst stripe = "sk_live_${"a".repeat(24)}";\nconst gh = "${VALUES[4]}";\nexport default {};` },
    { name: "deploy/docker-compose.yml", content: `db:\n  password: ${VALUES[2]}\n  url: postgres://app:${VALUES[1]}@db/app\n` },
    { name: "keys/server.pem", content: `-----BEGIN PRIVATE KEY-----\n${VALUES[3]}\n-----END PRIVATE KEY-----\n` },
  ];
  const { findings, masks } = scan(files);
  const excerpts = buildExcerpts(files, findings, masks);
  const text = JSON.stringify(findings) + excerpts.map((e) => e.text).join("\n");
  for (const v of VALUES) {
    assert.ok(!text.includes(v), `valore in chiaro: ${v}`);
    assert.ok(!text.includes(v.slice(0, 4) + "…"), `prefisso in chiaro: ${v.slice(0, 4)}`);
  }
  assert.ok(!text.includes("sk_live_aaaa"));
});
