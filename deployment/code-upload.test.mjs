import { test } from 'node:test';
import assert from 'node:assert/strict';
import { collectFiles, collectDropped, collectZip, runLocalScan } from '../src/lib/code-check/local-scan.ts';
import JSZip from 'jszip';

function file(name, content, relative = '') {
  const f = new File([content], name);
  Object.defineProperty(f, 'webkitRelativePath', { value: relative, configurable: true });
  return f;
}

test('la selezione resta completa quando il browser svuota il FileList durante la prima lettura', async () => {
  const files = Array.from({ length: 120 }, (_, i) => file(`file-${i}.ts`, `export const value${i} = ${i};`, `repo/src/file-${i}.ts`));
  const expectedChars = files.reduce((n, f) => n + f.size, 0);
  const pending = collectFiles(files);
  files.length = 0; // input.value = "" invalida la lista mentre file.text() è in attesa
  const result = await pending;
  assert.equal(result.files.length, 120);
  assert.equal(result.chars, expectedChars);
  assert.equal(result.files[119].name, 'src/file-119.ts');
  const scanned = await runLocalScan(result.files);
  assert.equal(scanned.inventory.length, 120);
  assert.equal(scanned.stats.chars, expectedChars);
});

test('i filtri escludono dipendenze, binari e file non di codice senza perdere i sorgenti', async () => {
  const result = await collectFiles([
    file('index.ts', 'export const value = 1;', 'repo/src/index.ts'),
    file('lib.js', 'dependency', 'repo/node_modules/lib.js'),
    file('data.ts', '\u0000binary', 'repo/data.ts'),
    file('photo.jpg', 'image', 'repo/photo.jpg'),
    file('page.tsx', 'export const Page = () => <main/>;', 'repo/src/page.tsx'),
  ]);
  assert.deepEqual(result.files.map(f => f.name), ['src/index.ts', 'src/page.tsx']);
  assert.deepEqual(result.skipped, { ignoredDirs: 1, binary: 1, tooLarge: 0, notCode: 1 });
});

test('il trascinamento legge tutti i lotti e le sottocartelle anche dopo la fine dell’evento', async () => {
  const entry = (name) => ({ isFile: true, isDirectory: false, name, file: resolve => queueMicrotask(() => resolve(file(name, 'export const ok = true;'))) });
  const directory = (name, batches) => ({ isFile: false, isDirectory: true, name, createReader: () => { let i = 0; return { readEntries: resolve => queueMicrotask(() => resolve(batches[i++] || [])) }; } });
  const root = directory('repo', [Array.from({ length: 100 }, (_, i) => entry(`file-${i}.ts`)), [directory('nested', [[entry('last.ts')]])]]);
  const items = [{ webkitGetAsEntry: () => root }];
  const pending = collectDropped(items);
  items.length = 0;
  const result = await collectFiles(await pending);
  assert.equal(result.files.length, 101);
  assert.equal(result.files[100].name, 'nested/last.ts');
});

test('lo ZIP mantiene tutti i sorgenti e rimuove solo la radice comune', async () => {
  const zip = new JSZip();
  zip.file('repo/src/a.ts', 'export const a = 1;');
  zip.file('repo/src/b.ts', 'export const b = 2;');
  zip.file('repo/node_modules/lib.js', 'ignored');
  // JSZip nel browser usa FileReader; in Node accetta gli stessi byte come Buffer.
  const result = await collectZip(await zip.generateAsync({ type: 'nodebuffer' }));
  assert.deepEqual(result.files.map(f => f.name), ['src/a.ts', 'src/b.ts']);
  assert.equal(result.skipped.ignoredDirs, 1);
});
