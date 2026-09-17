import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync, symlinkSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { execFileSync } from 'node:child_process';
import { validateChanges, validateRepository } from './check-shared-memory.mjs';

const recordPath = 'docs/memory/changes/2026-09-17-prova.md';
const state = 'docs/memory/STATE.md';
const baseFiles = {
  [state]: '# Stato corrente\nLa modifica non cambia il comportamento del prodotto pubblicato.',
  'roadmap.md': '# Roadmap\n\n| ID | Attività |\n| MEM-01 | Memoria condivisa per il progetto |',
  'AGENTS.md': '# Regole\nLeggere la memoria e aggiornarla nella stessa pull request.',
  'docs/memory/README.md': '# Memoria\nProcedura di aggiornamento condivisa fra persone e agenti.',
  'docs/memory/DECISIONS.md': '# Decisioni\nLa memoria viene mantenuta insieme al codice del progetto.',
  'src/example.ts': 'export const value = 1;\n',
};
const record = (fields = {}) => {
  const values = {
    date: '2026-09-17', author: 'Test automatico', roadmap_ids: '["MEM-01"]',
    state_review: 'unchanged', state_reason: 'La correzione non cambia lo stato delle funzionalità o dei rilasci.',
    roadmap_review: 'unchanged', roadmap_reason: 'Il lavoro resta compreso nella voce MEM-01 già registrata nella roadmap.',
    files: '["src/example.ts"]', ...fields,
  };
  return `---\n${Object.entries(values).map(([key, value]) => `${key}: ${value}`).join('\n')}\n---\n\n` +
    ['Richiesta e contesto', 'Modifiche e motivazione', 'Verifiche ed esiti', 'Rischi e limiti', 'Prossimo passo']
      .map(heading => `## ${heading}\n\nIl caso prova la correzione di un valore nel codice senza modificare il rilascio pubblico.\n`).join('\n');
};
const fixture = (overrides = {}, changes) => {
  const files = { ...baseFiles, [recordPath]: record(), ...overrides };
  return validateChanges({
    changes: changes ?? [{ status: 'M', path: 'src/example.ts' }, { status: 'A', path: recordPath }],
    readHead: path => { if (files[path] == null) throw new Error('missing'); return files[path]; },
  });
};

test('accetta un registro completo con stato e roadmap riesaminati', () => assert.deepEqual(fixture(), []));
test('rifiuta modifiche senza nuovo registro', () => assert.match(fixture({}, [{ status: 'M', path: 'src/example.ts' }]).join('\n'), /nuovo registro/));
test('rifiuta file del diff omessi dal registro', () => assert.match(fixture({ [recordPath]: record({ files: '[]' }) }).join('\n'), /non documentato/));
test('rifiuta ID roadmap inesistenti', () => assert.match(fixture({ [recordPath]: record({ roadmap_ids: '["WRONG-99"]' }) }).join('\n'), /ID presenti/));
test('rifiuta dichiarazione updated senza modifica', () => assert.match(fixture({ [recordPath]: record({ state_review: 'updated' }) }).join('\n'), /non cambia/));
test('rifiuta dichiarazione unchanged se lo stato cambia', () => assert.match(fixture({}, [{ status: 'M', path: state }, { status: 'A', path: recordPath }]).join('\n'), /unchanged/));
test('rifiuta una motivazione vuota o generica', () => assert.match(fixture({ [recordPath]: record({ state_reason: 'nessuno' }) }).join('\n'), /motivazione concreta/));
test('rifiuta i segnaposto del template', () => assert.match(fixture({ [recordPath]: record().replace('## Verifiche ed esiti\n\nIl caso', '## Verifiche ed esiti\n\nTODO Il caso') }).join('\n'), /Verifiche ed esiti/));
test('rifiuta modifica o cancellazione dei registri storici', () => {
  for (const status of ['M', 'D', 'T']) assert.match(fixture({}, [{ status, path: recordPath }]).join('\n'), /storico immutabile/);
});
test('richiede documentazione anche per PR di sola documentazione', () => assert.match(fixture({}, [{ status: 'M', path: 'AGENTS.md' }]).join('\n'), /nuovo registro/));
test('rifiuta eliminazione dei documenti canonici', () => assert.match(fixture({ [state]: null }).join('\n'), /documento obbligatorio/));
test('accetta terminatori Windows nei registri', () => assert.deepEqual(fixture({ [recordPath]: record().replaceAll('\n', '\r\n') }), []));
test('rifiuta date impossibili', () => assert.match(fixture({ [recordPath]: record({ date: '2026-02-30' }) }).join('\n'), /data non valida/));
test('rifiuta JSON malformato senza saltare il controllo', () => assert.ok(fixture({ [recordPath]: record({ files: '[broken' }) }).length > 0));

function repository(t) {
  const repo = mkdtempSync(join(tmpdir(), 'regbrain-memory-'));
  t.after(() => rmSync(repo, { recursive: true, force: true }));
  const git = (...args) => execFileSync('git', ['-C', repo, ...args], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
  const write = (path, text) => { const fullPath = join(repo, path); mkdirSync(dirname(fullPath), { recursive: true }); writeFileSync(fullPath, text); };
  git('init'); git('config', 'user.name', 'Memory tests'); git('config', 'user.email', 'memory-tests@example.invalid'); git('config', 'commit.gpgsign', 'false');
  for (const [path, text] of Object.entries(baseFiles)) write(path, text);
  git('add', '.'); git('commit', '-m', 'base');
  const base = git('rev-parse', 'HEAD');
  const commit = () => { git('add', '.'); git('commit', '-m', 'candidate'); return git('rev-parse', 'HEAD'); };
  return { repo, git, write, base, commit };
}

test('legge un diff Git reale e valida il contenuto al commit, non file locali', t => {
  const f = repository(t);
  f.write('src/example.ts', 'export const value = 2;\n'); f.write(recordPath, record());
  const head = f.commit();
  f.write(recordPath, 'file locale invalido non integrato');
  assert.deepEqual(validateRepository({ repo: f.repo, base: f.base, head }), []);
});
test('rifiuta una nuova modifica senza memoria su un repository Git reale', t => {
  const f = repository(t); f.write('src/example.ts', 'export const value = 3;\n');
  assert.match(validateRepository({ repo: f.repo, base: f.base, head: f.commit() }).join('\n'), /nuovo registro/);
});
test('rifiuta un registro simbolico invece di leggere file fuori repository', t => {
  const f = repository(t); f.write('src/example.ts', 'export const value = 3;\n');
  mkdirSync(dirname(join(f.repo, recordPath)), { recursive: true });
  symlinkSync('/etc/passwd', join(f.repo, recordPath));
  assert.match(validateRepository({ repo: f.repo, base: f.base, head: f.commit() }).join('\n'), /file normale/);
});
test('un cambio di nome richiede copertura di vecchio e nuovo percorso', t => {
  const f = repository(t); f.git('mv', 'src/example.ts', 'src/renamed.ts');
  f.write(recordPath, record({ files: '["src/renamed.ts"]' }));
  assert.match(validateRepository({ repo: f.repo, base: f.base, head: f.commit() }).join('\n'), /src\/example.ts: file non documentato/);
});
