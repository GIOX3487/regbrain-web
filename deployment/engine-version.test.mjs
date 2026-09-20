import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

// L'interfaccia deve sapere qual e' la versione del motore distribuita per poter segnalare
// un'analisi prodotta da una versione precedente. La costante sta in due file diversi perche'
// uno gira su Deno e l'altro nel browser: qui si verifica che non divergano.
test('la versione del motore nel frontend coincide con CHECKS_VERSION della edge function', () => {
  const edge = readFileSync('supabase/functions/gap-analysis/index.ts', 'utf8');
  const front = readFileSync('src/lib/engine-version.ts', 'utf8');
  const edgeMatch = /const CHECKS_VERSION = '([^']+)'/.exec(edge);
  const frontMatch = /GAP_ANALYSIS_ENGINE_VERSION = '([^']+)'/.exec(front);
  assert.ok(edgeMatch, 'CHECKS_VERSION non trovata nella edge function');
  assert.ok(frontMatch, 'GAP_ANALYSIS_ENGINE_VERSION non trovata nel frontend');
  assert.equal(
    frontMatch[1],
    edgeMatch[1],
    'Dopo aver cambiato CHECKS_VERSION aggiornare anche src/lib/engine-version.ts',
  );
});
