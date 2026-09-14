import test from 'node:test';
import assert from 'node:assert/strict';
import {validateRequestAccess} from '../supabase/functions/_shared/access-policy.ts';

const request = (body, contentType = 'application/json') => new Request('https://example.test', {
  method: 'POST', headers: {'Content-Type': contentType}, body: JSON.stringify(body),
});
test('a text/plain JSON request still checks assessment ownership', async () => {
  const seen = [];
  const result = await validateRequestAccess(request({assessmentId:'other'}, 'text/plain'), 'me', async (...args) => {seen.push(args);return false;});
  assert.equal(result.status, 403);
  assert.deepEqual(seen, [['compliance_assessments', 'other', 'me']]);
});
test('background generation rejects a document belonging to another account', async () => {
  const seen = [];
  const result = await validateRequestAccess(request({_backgroundDocId:'other-doc'}), 'me', async (...args) => {seen.push(args);return false;});
  assert.equal(result.status, 403);
  assert.deepEqual(seen, [['generated_documents', 'other-doc', 'me']]);
});
test('owned resources and JSON with a charset remain allowed', async () => {
  assert.equal(await validateRequestAccess(request({assessmentId:'mine', _backgroundDocId:'my-doc', userId:'me'}, 'application/json; charset=utf-8'), 'me', async () => true), null);
});
test('malformed payloads and forged identities fail before database access', async () => {
  let calls = 0;
  const lookup = async () => {calls++;return true;};
  for (const body of [null, [], 'text']) {
    assert.equal((await validateRequestAccess(request(body), 'me', lookup)).status, 400);
  }
  assert.equal((await validateRequestAccess(request({user_id:'other'}), 'me', lookup)).status, 403);
  assert.equal((await validateRequestAccess(request({assessmentId:{unexpected:true}}), 'me', lookup)).status, 400);
  const bad = new Request('https://example.test', {method:'POST', body:'{broken'});
  assert.equal((await validateRequestAccess(bad, 'me', lookup)).status, 400);
  assert.equal(calls, 0);
});
test('validation leaves the original body readable for the handler', async () => {
  const req = request({message:'hello'});
  assert.equal(await validateRequestAccess(req, 'me', async () => false), null);
  assert.deepEqual(await req.json(), {message:'hello'});
});
test('alternate HTTP methods cannot bypass resource ownership', async () => {
  const req = new Request('https://example.test', {method:'PUT', body:JSON.stringify({assessmentId:'other'})});
  assert.equal((await validateRequestAccess(req, 'me', async () => false)).status, 403);
});
test('maintenance handlers without a body retain their existing behavior', async () => {
  const req = new Request('https://example.test', {method:'POST'});
  assert.equal(await validateRequestAccess(req, 'me', async () => false), null);
});
