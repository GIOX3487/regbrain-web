// Carica nel RAG i testi normativi versionati in corpus/ (XML Akoma Ntoso o Markdown).
// Il nome del file è il codice della fonte nel catalogo di ingest-web-source:
//   corpus/leggi/LEGGE_IA.akn.xml  ->  source LEGGE_IA, contentType akn
//   corpus/leggi/NOME.md           ->  source NOME, contentType nmd
// Serve per le leggi che i server di Supabase non possono scaricare da Normattiva.
//
// Uso (in CI): SUPABASE_URL=... SERVICE_KEY=... node scripts/ingest-corpus.mjs corpus/leggi/LEGGE_IA.akn.xml
// Con --dry-run conta le unità senza scrivere nulla.
import fs from 'node:fs';
import path from 'node:path';

const url = process.env.SUPABASE_URL;
const key = process.env.SERVICE_KEY;
const dryRun = process.argv.includes('--dry-run');
const files = process.argv.slice(2).filter((a) => !a.startsWith('--'));
if (!url || !key) { console.error('SUPABASE_URL e SERVICE_KEY sono obbligatori'); process.exit(1); }
if (files.length === 0) { console.log('Nessun file da caricare.'); process.exit(0); }

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function call(body) {
  for (let attempt = 1; attempt <= 4; attempt++) {
    try {
      const res = await fetch(`${url}/functions/v1/ingest-web-source`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}`, apikey: key },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(170_000),
      });
      const text = await res.text();
      let data; try { data = JSON.parse(text); } catch { data = { error: text.slice(0, 300) }; }
      if (res.ok) return data;
      if (res.status < 500 || attempt === 4) throw new Error(`${res.status}: ${data.error || text.slice(0, 300)}`);
      console.warn(`  tentativo ${attempt} fallito (${res.status}), riprovo`);
    } catch (e) {
      if (attempt === 4) throw e;
      console.warn(`  tentativo ${attempt} fallito (${e.message}), riprovo`);
    }
    await sleep(5000 * attempt);
  }
}

let failed = 0;
for (const file of files) {
  if (!fs.existsSync(file)) { console.log(`${file}: rimosso, nulla da caricare`); continue; }
  const base = path.basename(file);
  const m = /^([A-Z0-9_]+)\.(akn\.xml|xml|md)$/.exec(base);
  if (!m) { console.log(`${file}: nome non riconosciuto, ignorato`); continue; }
  const source = m[1];
  const contentType = m[2] === 'md' ? 'nmd' : 'akn';
  const content = fs.readFileSync(file, 'utf8');
  console.log(`::group::${source} (${contentType}, ${content.length} caratteri)`);
  try {
    let offset = 0; let first = true; let total = 0;
    for (;;) {
      const data = await call({ source, content, contentType, offset, limit: 40, reset: first && !dryRun, dryRun });
      first = false;
      if (dryRun) { console.log(`  unità: ${data.units}`); break; }
      total += data.inserted || 0;
      console.log(`  offset ${offset}: inserite ${data.inserted}, embedding ${data.embedded}, ${data.ms} ms`);
      if (data.embedded < data.inserted) console.warn(`::warning title=${source}::${data.inserted - data.embedded} unità senza embedding a offset ${offset}`);
      if (data.done || data.nextOffset === null || data.nextOffset === undefined) break;
      offset = data.nextOffset;
    }
    if (!dryRun) console.log(`::notice title=${source}::${total} unità caricate`);
  } catch (e) {
    failed++;
    console.log(`::error title=${source}::${e.message}`);
  }
  console.log('::endgroup::');
}
if (failed) process.exit(1);
