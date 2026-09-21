import { test } from 'node:test';
import assert from 'node:assert/strict';
import { regulationScope, REGULATION_GATES } from '../supabase/functions/_shared/regulation-scope.ts';
import { APPLICABILITY_QUESTIONS, buildAnswers, unansweredScopeQuestions, questionsForRegulations } from '../src/lib/applicability-questions.ts';

// Caso che ha motivato la regola: un'azienda manifatturiera seleziona DORA e non risponde alla
// domanda sull'ambito. Prima la normativa veniva trattata come applicabile e produceva 29 gap
// su 52 obblighi pensati per banche e assicurazioni.
test('senza risposta una normativa settoriale non si applica e non si esclude: resta non determinata', () => {
  for (const gate of REGULATION_GATES) {
    assert.equal(regulationScope(gate.regulation, undefined).status, 'undetermined', gate.regulation);
    assert.equal(regulationScope(gate.regulation, {}).status, 'undetermined', gate.regulation);
  }
});

test('"non lo so" lascia la normativa non determinata e lo dice nel motivo', () => {
  const answers = { dora_financial_entity: 'non_so', dora_not_micro: 'non_so', dora_ctpp: 'non_so' };
  const scope = regulationScope('DORA', answers);
  assert.equal(scope.status, 'undetermined');
  assert.match(scope.reason_it, /non lo so/);
});

test('una sola qualifica dichiarata "si" rende la normativa applicabile', () => {
  assert.equal(regulationScope('DORA', { dora_financial_entity: 'no', dora_ctpp: 'si' }).status, 'in_scope');
  assert.equal(regulationScope('AI Act', { ai_provider: 'no', ai_deployer: 'si', ai_importer_distributor: 'no' }).status, 'in_scope');
});

test('la normativa si esclude solo se tutte le qualifiche sono dichiarate "no"', () => {
  assert.equal(regulationScope('NIS2', { nis2_entity: 'no', nis2_digital_provider: 'no' }).status, 'out_of_scope');
  // Una risposta incompleta non basta a escludere: meglio non valutare che escludere per errore.
  assert.equal(regulationScope('NIS2', { nis2_entity: 'no' }).status, 'undetermined');
  assert.equal(regulationScope('DORA', { dora_financial_entity: 'no', dora_ctpp: 'non_so' }).status, 'undetermined');
});

test('il GDPR riguarda tutti e non ha una domanda di ambito', () => {
  assert.equal(regulationScope('GDPR', undefined).status, 'universal');
  assert.equal(regulationScope('gdpr', {}).status, 'universal');
});

// Il frontend e il server hanno ciascuno il proprio elenco. Se divergono, una normativa potrebbe
// non avere una domanda obbligatoria che la copre, e tornerebbe il caso da cui si e' partiti.
test('ogni normativa settoriale del server ha nel frontend una domanda obbligatoria che ne copre tutte le chiavi', () => {
  for (const gate of REGULATION_GATES) {
    const covering = APPLICABILITY_QUESTIONS.filter(q => q.scope && q.regulation === gate.regulation);
    assert.equal(covering.length, 1, `${gate.regulation}: attesa una domanda di ambito`);
    for (const key of gate.keys) {
      assert.ok(covering[0].keys.includes(key), `${gate.regulation}: la domanda non copre la chiave ${key}`);
    }
    assert.ok(covering[0].choices.some(c => c.unknown), `${gate.regulation}: manca l'opzione "Non lo so"`);
  }
  const scopeQuestions = APPLICABILITY_QUESTIONS.filter(q => q.scope).map(q => q.regulation).sort();
  assert.deepEqual(scopeQuestions, REGULATION_GATES.map(g => g.regulation).sort());
});

test('ogni risposta possibile a una domanda di ambito porta a uno stato coerente sul server', () => {
  for (const question of APPLICABILITY_QUESTIONS.filter(q => q.scope)) {
    question.choices.forEach((choice, index) => {
      const answers = buildAnswers([question], { [question.id]: [index] });
      const status = regulationScope(question.regulation, answers).status;
      if (choice.unknown) assert.equal(status, 'undetermined', `${question.id}: ${choice.label}`);
      else if (choice.none) assert.equal(status, 'out_of_scope', `${question.id}: ${choice.label}`);
      else assert.ok(['in_scope', 'out_of_scope'].includes(status), `${question.id}: ${choice.label} -> ${status}`);
    });
  }
});

test('l\'analisi non parte finche\' manca una domanda di ambito, e "non lo so" conta come risposta', () => {
  const questions = questionsForRegulations(['GDPR', 'DORA']);
  assert.deepEqual(unansweredScopeQuestions(questions, {}).map(q => q.regulation), ['DORA']);
  const dora = questions.find(q => q.id === 'dora_subject');
  const unknownIndex = dora.choices.findIndex(c => c.unknown);
  assert.deepEqual(unansweredScopeQuestions(questions, { dora_subject: [unknownIndex] }), []);
  assert.deepEqual(unansweredScopeQuestions(questionsForRegulations(['GDPR']), {}), []);
});
