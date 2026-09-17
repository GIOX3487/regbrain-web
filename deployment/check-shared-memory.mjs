import { execFileSync } from 'node:child_process';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const prefix = 'docs/memory/changes/';
const statePath = 'docs/memory/STATE.md';
const roadmapPath = 'roadmap.md';
const headings = ['Richiesta e contesto', 'Modifiche e motivazione', 'Verifiche ed esiti', 'Rischi e limiti', 'Prossimo passo'];
const placeholder = /\b(TODO|TBD|FIXME|INSERIRE|COMPILARE)\b|AAAA-MM-GG|percorso\/del\/file|ID-01/i;

function metadata(text) {
  const block = /^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/.exec(text);
  if (!block) throw new Error('frontmatter obbligatorio assente');
  const fields = {};
  for (const line of block[1].split(/\r?\n/)) {
    const pair = /^([a-z_]+): (.+)$/.exec(line);
    if (!pair || Object.hasOwn(fields, pair[1])) throw new Error('frontmatter non valido o campo duplicato');
    fields[pair[1]] = pair[2].trim();
  }
  return fields;
}

export function validateChanges({ changes, readHead }) {
  const errors = [];
  const changed = new Set(changes.map(change => change.path));
  const records = changes.filter(change => change.status === 'A' && change.path.startsWith(prefix));
  const changedFiles = changes.filter(change => !change.path.startsWith(prefix));
  const covered = new Set();
  for (const change of changes) {
    if (change.path.startsWith(prefix) && change.status !== 'A') errors.push(`${change.path}: registro storico immutabile; aggiungere una correzione in un nuovo registro`);
  }
  if (!records.length) errors.push('Aggiungere un nuovo registro in docs/memory/changes/ per questa PR.');
  let roadmap = '';
  for (const path of [statePath, roadmapPath, 'AGENTS.md', 'docs/memory/README.md', 'docs/memory/DECISIONS.md']) {
    try {
      const content = readHead(path);
      if (content.trim().length < 40) throw new Error('file vuoto o incompleto');
      if (path === roadmapPath) roadmap = content;
    } catch { errors.push(`${path}: documento obbligatorio assente o incompleto`); }
  }
  const validIds = new Set([...roadmap.matchAll(/^\|\s*([A-Z][A-Z0-9]*-\d+)\s*\|/gm)].map(match => match[1]));
  for (const record of records) {
    try {
      if (!/^docs\/memory\/changes\/\d{4}-\d{2}-\d{2}-[a-z0-9][a-z0-9-]*\.md$/.test(record.path)) throw new Error('nome richiesto AAAA-MM-GG-descrizione.md');
      const text = readHead(record.path).replace(/\r\n/g, '\n');
      if (text.length > 100_000) throw new Error('registro troppo grande');
      const fields = metadata(text);
      for (const key of ['date', 'author', 'roadmap_ids', 'state_review', 'state_reason', 'roadmap_review', 'roadmap_reason', 'files']) {
        if (!fields[key] || placeholder.test(fields[key])) throw new Error(`campo ${key} assente o segnaposto`);
      }
      const date = fields.date;
      if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !Number.isFinite(Date.parse(date)) || new Date(date).toISOString().slice(0, 10) !== date || !record.path.startsWith(`${prefix}${date}-`)) throw new Error('data non valida o diversa dal nome del registro');
      if (fields.author.length < 3) throw new Error('autore non specificato');
      const ids = JSON.parse(fields.roadmap_ids);
      if (!Array.isArray(ids) || !ids.length || ids.some(id => !validIds.has(id))) throw new Error('roadmap_ids deve contenere ID presenti nella roadmap');
      for (const [kind, path] of [['state', statePath], ['roadmap', roadmapPath]]) {
        const review = fields[`${kind}_review`];
        if (!['updated', 'unchanged'].includes(review)) throw new Error(`${kind}_review: usare updated o unchanged`);
        if (fields[`${kind}_reason`].length < 30) throw new Error(`${kind}_reason: motivazione concreta di almeno 30 caratteri`);
        if (review === 'updated' && !changed.has(path)) throw new Error(`${kind}_review dichiara updated ma ${path} non cambia`);
        if (review === 'unchanged' && changed.has(path)) throw new Error(`${kind}_review dichiara unchanged ma ${path} cambia`);
      }
      const files = JSON.parse(fields.files);
      if (!Array.isArray(files) || files.some(path => typeof path !== 'string' || !changed.has(path) || path.startsWith(prefix))) throw new Error('files deve elencare solo percorsi presenti nel diff, esclusi i registri');
      for (const path of files) covered.add(path);
      for (const heading of headings) {
        const section = text.split(`## ${heading}\n`)[1]?.split(/^## /m)[0]?.trim();
        if (!section || section.length < 40 || placeholder.test(section) || /^(Descrivere|Indicare|Spiegare)\b/.test(section)) throw new Error(`sezione ${heading}: contenuto concreto di almeno 40 caratteri richiesto`);
      }
    } catch (error) { errors.push(`${record.path}: ${error.message}`); }
  }
  for (const { path } of changedFiles) if (!covered.has(path)) errors.push(`${path}: file non documentato nel campo files dei nuovi registri`);
  // Do not allow replacing a regular historical record by a symlink or another type.
  for (const { path, status } of changes) if (status === 'T') errors.push(`${path}: cambi di tipo non ammessi nel controllo memoria; usare file normali`);
  return errors;
}

function git(repo, args) {
  return execFileSync('git', ['-C', repo, ...args], { encoding: 'utf8', maxBuffer: 10 * 1024 * 1024, stdio: ['ignore', 'pipe', 'pipe'] });
}

export function validateRepository({ repo, base, head }) {
  // Resolve user-supplied refs to hashes before using them in git arguments.
  const hash = ref => git(repo, ['rev-parse', '--verify', '--end-of-options', `${ref}^{commit}`]).trim();
  const baseHash = hash(base);
  const headHash = hash(head);
  const ancestor = git(repo, ['merge-base', baseHash, headHash]).trim();
  const entries = git(repo, ['diff', '--no-renames', '--name-status', '-z', ancestor, headHash, '--']).split('\0');
  const changes = [];
  for (let index = 0; index < entries.length - 1; index += 2) changes.push({ status: entries[index], path: entries[index + 1] });
  const read = (sha, path) => {
    const type = git(repo, ['ls-tree', sha, '--', path]);
    if (!/^100644 blob |^100755 blob /.test(type)) throw new Error('file normale richiesto');
    return git(repo, ['show', `${sha}:${path}`]);
  };
  return validateChanges({ changes, readHead: path => read(headHash, path) });
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  try {
    const args = process.argv.slice(2);
    const option = name => args[args.indexOf(name) + 1];
    for (const name of ['--repo', '--base', '--head']) if (!args.includes(name) || !option(name)) throw new Error(`argomento richiesto: ${name}`);
    const errors = validateRepository({ repo: option('--repo'), base: option('--base'), head: option('--head') });
    if (errors.length) { console.error(`Memoria condivisa non valida:\n${errors.map(error => `- ${error}`).join('\n')}`); process.exitCode = 1; }
    else console.log('Memoria condivisa valida: nuovo registro, stato/roadmap riesaminati e tutti i file documentati.');
  } catch (error) { console.error(`Impossibile verificare la memoria: ${error.message}`); process.exitCode = 1; }
}
