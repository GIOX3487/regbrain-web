import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import ts from 'typescript';

// Vite builds src/, so it cannot catch damaged Supabase source files.
// This parses the deployed entrypoints and their local imports without executing
// handlers, contacting providers, or requiring production credentials.
const root = fileURLToPath(new URL('../', import.meta.url));
const names = JSON.parse(fs.readFileSync(path.join(root, 'deployment/functions.json'), 'utf8'));
const queue = [...new Set([...names, 'verify-site-password', 'index-normative-documents'])]
  .map(name => path.join(root, 'supabase/functions', name, 'index.ts'));
const seen = new Set();
let errors = 0;
for (let i = 0; i < queue.length; i++) {
  const file = queue[i];
  if (seen.has(file)) continue;
  seen.add(file);
  const label = path.relative(root, file);
  if (!fs.existsSync(file)) {
    console.error(`${label}: missing local source`);
    errors++;
    continue;
  }
  const source = ts.createSourceFile(file, fs.readFileSync(file, 'utf8'), ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
  for (const diagnostic of source.parseDiagnostics.slice(0, 5)) {
    const pos = source.getLineAndCharacterOfPosition(diagnostic.start ?? 0);
    console.error(`${label}:${pos.line + 1}:${pos.character + 1}: ${ts.flattenDiagnosticMessageText(diagnostic.messageText, ' ')}`);
  }
  errors += source.parseDiagnostics.length;
  for (const item of ts.preProcessFile(source.text).importedFiles) {
    if (item.fileName.startsWith('.')) queue.push(path.resolve(path.dirname(file), item.fileName));
  }
}
console.log(`Edge Functions syntax: ${seen.size} files checked, ${errors} errors. This is not a Deno runtime or authorization test.`);
if (errors) process.exitCode = 1;
