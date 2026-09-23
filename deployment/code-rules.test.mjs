import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { scan } from '../supabase/functions/code-compliance/scan.ts';

// Banco di prova delle regole della verifica del codice. Ogni riga dei file in
// deployment/code-rules-cases porta in coda un'annotazione: "//! SEC-01" (deve scattare quella
// regola) oppure "//! -" (non deve scattare niente). Servono a impedire che una modifica alle
// espressioni regolari faccia sparire un controllo o riempia il referto di falsi positivi.
const dir = fileURLToPath(new URL('./code-rules-cases/', import.meta.url));
const files = fs.readdirSync(dir).sort().map((name) => ({ name, content: fs.readFileSync(path.join(dir, name), 'utf8') }));

const attesi = new Map();
const negativi = new Set();
for (const f of files) {
  f.content.split('\n').forEach((line, i) => {
    const m = /(?:\/\/|#|<!--|--|\{\/\*|\/\*)!\s*([A-Z0-9 ,.-]+?)\s*(?:\*\/\}|\*\/|-->)?$/.exec(line.trim());
    if (!m) return;
    const key = `${f.name}:${i + 1}`;
    const tags = m[1].split(',').map((t) => t.trim()).filter(Boolean);
    if (tags.length === 1 && tags[0] === '-') negativi.add(key);
    else attesi.set(key, new Set(tags));
  });
}

const { findings } = scan(files);
const ottenuti = new Map();
for (const f of findings) {
  for (const o of f.occurrences) {
    const k = `${o.file}:${o.line}`;
    if (!ottenuti.has(k)) ottenuti.set(k, new Set());
    ottenuti.get(k).add(f.id);
  }
}

test('il banco di prova contiene casi positivi e negativi', () => {
  assert.ok(attesi.size >= 40, `casi positivi attesi: ${attesi.size}`);
  assert.ok(negativi.size >= 20, `casi negativi attesi: ${negativi.size}`);
});

test('ogni riga marcata fa scattare la regola indicata', () => {
  const mancati = [];
  for (const [k, want] of attesi) {
    const have = ottenuti.get(k) || new Set();
    for (const w of want) if (!have.has(w)) mancati.push(`${k} atteso ${w}`);
  }
  assert.deepEqual(mancati, [], `regole che non sono scattate:\n${mancati.join('\n')}`);
});

test('nessuna riga produce un esito che non le spetta', () => {
  const spuri = [];
  for (const [k, have] of ottenuti) {
    const want = attesi.get(k);
    for (const h of have) {
      if (want?.has(h)) continue;
      spuri.push(`${k} inatteso ${h}`);
    }
  }
  assert.deepEqual(spuri, [], `falsi positivi:\n${spuri.join('\n')}`);
});

test('un file di prova abbassa il rischio invece di gridare al segreto esposto', () => {
  const secreto = findings.find((f) => f.id === 'SEC-01');
  const inTest = secreto.occurrences.find((o) => /auth\.test\.js$/.test(o.file));
  assert.ok(inTest, 'il segreto nel file di prova deve comunque comparire');
  assert.match(inTest.note || '', /file di prova/);
});

test('gli stessi file danno sempre lo stesso esito', () => {
  const secondo = scan(files).findings;
  assert.equal(JSON.stringify(secondo), JSON.stringify(findings));
});

test('i file di traduzione non producono esiti', () => {
  const spuri = [...ottenuti.keys()].filter((k) => k.startsWith('es_ES.json'));
  assert.deepEqual(spuri, []);
});
