// Estratti di codice per la revisione del modello. Con una base di codice intera non si manda
// tutto: si mandano le righe intorno a ogni esito delle regole, i manifest (dipendenze, permessi)
// e, se ci sta, il resto per ordine di importanza, dentro un tetto di caratteri. I segreti sono
// mascherati prima di uscire dal browser. Condiviso tra browser e funzione edge.

import { redactSecrets } from "./secrets.ts";
import type { Finding, InputFile } from "./scan.ts";

export interface Excerpt { file: string; from: number; to: number; text: string }

/** Caratteri per ogni chiamata al modello: oltre, la lettura peggiora. */
export const EXCERPT_BUDGET = 60_000;
/** Chiamate al modello in parallelo: la vista del modello si allarga senza allungare i tempi. */
export const MAX_BATCHES = 3;
export const TOTAL_EXCERPT_BUDGET = EXCERPT_BUDGET * MAX_BATCHES;
const CONTEXT_LINES = 6;
const MANIFEST = /(^|\/)(package\.json|requirements[\w.-]*\.txt|pyproject\.toml|Pipfile|pom\.xml|build\.gradle(\.kts)?|go\.mod|composer\.json|pubspec\.yaml|Gemfile|Cargo\.toml|[^/]*\.csproj|Dockerfile|docker-compose\.ya?ml|AndroidManifest\.xml|Info\.plist|\.env\.example|vercel\.json|netlify\.toml|nginx\.conf|Caddyfile)$/;
const INTERESTING = /(auth|login|session|cookie|consent|privacy|gdpr|tracking|analytics|payment|checkout|user|account|profile|upload|export|log|middleware|security|config|settings)/i;

function maskAll(text: string, masks: RegExp[], file: string): string {
  let out = redactSecrets(text, file);
  for (const re of masks) out = out.replace(new RegExp(re.source, "g"), "[SEGRETO RIMOSSO]");
  return out;
}

function numbered(lines: string[], from: number, to: number): string {
  const out: string[] = [];
  for (let i = from; i <= to; i++) {
    const l = lines[i - 1] ?? "";
    out.push(`${i}: ${l.length > 400 ? l.slice(0, 400) + "…" : l}`);
  }
  return out.join("\n");
}

/** Unisce intervalli sovrapposti o adiacenti dello stesso file. */
function mergeRanges(ranges: Array<[number, number]>): Array<[number, number]> {
  const sorted = [...ranges].sort((a, b) => a[0] - b[0]);
  const out: Array<[number, number]> = [];
  for (const r of sorted) {
    const last = out[out.length - 1];
    if (last && r[0] <= last[1] + 1) last[1] = Math.max(last[1], r[1]);
    else out.push([r[0], r[1]]);
  }
  return out;
}

export function buildExcerpts(files: InputFile[], findings: Finding[], masks: RegExp[], budget = TOTAL_EXCERPT_BUDGET): Excerpt[] {
  const byName = new Map(files.map((f) => [f.name, f]));
  const lineCache = new Map<string, string[]>();
  const linesOf = (name: string) => {
    let l = lineCache.get(name);
    if (!l) { l = (byName.get(name)?.content ?? "").split(/\r?\n/); lineCache.set(name, l); }
    return l;
  };
  const excerpts: Excerpt[] = [];
  let used = 0;
  const push = (file: string, from: number, to: number) => {
    const lines = linesOf(file);
    const a = Math.max(1, from), b = Math.min(lines.length, to);
    if (b < a) return false;
    const text = maskAll(numbered(lines, a, b), masks, file);
    if (used + text.length > budget) return false;
    used += text.length;
    excerpts.push({ file, from: a, to: b, text });
    return true;
  };

  // 1. Le righe intorno a ogni esito, per file, con gli intervalli uniti.
  const wanted = new Map<string, Array<[number, number]>>();
  for (const f of findings) for (const o of f.occurrences) {
    if (!byName.has(o.file)) continue;
    const list = wanted.get(o.file) || [];
    list.push([o.line - CONTEXT_LINES, o.line + CONTEXT_LINES]);
    wanted.set(o.file, list);
  }
  for (const [file, ranges] of wanted) for (const [a, b] of mergeRanges(ranges)) push(file, a, b);

  // 2. I manifest: dipendenze, permessi, configurazione di deploy.
  const covered = new Set(excerpts.map((e) => e.file));
  for (const f of files) {
    if (!MANIFEST.test(f.name) || covered.has(f.name)) continue;
    if (push(f.name, 1, Math.min(120, linesOf(f.name).length))) covered.add(f.name);
  }

  // 3. Con il resto del budget, i file più pertinenti per nome, poi gli altri: prima quelli piccoli.
  const rest = files.filter((f) => !covered.has(f.name)).sort((a, b) => {
    const ia = INTERESTING.test(a.name) ? 0 : 1, ib = INTERESTING.test(b.name) ? 0 : 1;
    return ia - ib || a.content.length - b.content.length;
  });
  for (const f of rest) {
    const n = linesOf(f.name).length;
    if (!push(f.name, 1, Math.min(n, 200))) { if (used > budget * 0.95) break; }
  }
  return excerpts;
}

/**
 * Divide gli estratti in lotti da una chiamata ciascuno. Il primo lotto tiene le righe intorno
 * agli esiti (servono a giudicarli); gli altri portano al modello il resto della base di codice.
 */
export function splitExcerpts(excerpts: Excerpt[], budget = EXCERPT_BUDGET, maxBatches = MAX_BATCHES): Excerpt[][] {
  const batches: Excerpt[][] = [];
  let current: Excerpt[] = [];
  let used = 0;
  for (const e of excerpts) {
    if (used + e.text.length > budget && current.length) {
      batches.push(current);
      if (batches.length >= maxBatches) return batches;
      current = []; used = 0;
    }
    current.push(e); used += e.text.length;
  }
  if (current.length) batches.push(current);
  return batches;
}

/** Testo per il prompt: un blocco per file, con le righe numerate. */
export function excerptsToText(excerpts: Excerpt[]): string {
  const byFile = new Map<string, Excerpt[]>();
  for (const e of excerpts) { const l = byFile.get(e.file) || []; l.push(e); byFile.set(e.file, l); }
  const parts: string[] = [];
  for (const [file, list] of byFile) {
    parts.push(`\n### ${file}`);
    for (const e of list.sort((a, b) => a.from - b.from)) parts.push(`[righe ${e.from}-${e.to}]\n${e.text}`);
  }
  return parts.join("\n");
}

/** La riga N di un file, se è dentro un estratto: serve a verificare gli esiti aggiunti dal modello. */
export function lineFromExcerpts(excerpts: Excerpt[], file: string, line: number): string | null {
  for (const e of excerpts) {
    if (e.file !== file || line < e.from || line > e.to) continue;
    const row = e.text.split("\n")[line - e.from] || "";
    const m = /^\d+: ?(.*)$/.exec(row);
    return m ? m[1] : null;
  }
  return null;
}
