import test from 'node:test';
import assert from 'node:assert/strict';
import {GapAIUnavailable, providerFailure, validateBatchResults, evaluateBatches, unavailableResponse} from '../supabase/functions/_shared/gap-ai-batch.ts';
const result=id=>new Map([[id,{status:'missing'}]]);

test('successful batches keep their order and use at most two concurrent calls',async()=>{
  let active=0,max=0;
  const values=await evaluateBatches(['a','b','c','d'],async id=>{
    active++;max=Math.max(max,active);await new Promise(resolve=>setImmediate(resolve));active--;return result(id);
  });
  assert.equal(max,2);assert.deepEqual(values.map(m=>[...m.keys()][0]),['a','b','c','d']);
});
test('503 stops queued calls, drains running work, and never returns a partial success',async()=>{
  const started=[];let drained=false;
  await assert.rejects(evaluateBatches(['a','b','c','d'],async id=>{
    started.push(id);if(id==='a')throw providerFailure(503);
    await new Promise(resolve=>setImmediate(resolve));drained=true;return result(id);
  }),e=>e instanceof GapAIUnavailable&&e.reason==='overloaded');
  assert.deepEqual(started,['a','b']);assert.equal(drained,true);
});
test('timeout and network errors are sanitized and are never findings',async()=>{
  for(const [error,expected] of [[new DOMException('secret token','TimeoutError'),'timeout'],[new Error('private provider payload'),'provider_error']]){
    await assert.rejects(evaluateBatches(['a'],async()=>{throw error}),e=>e.reason===expected&&!e.message.includes(error.message));
  }
});
test('HTTP categories distinguish overload, quota and configuration errors',()=>{
  assert.equal(providerFailure(429).reason,'rate_limited');assert.equal(providerFailure(503).reason,'overloaded');
  assert.equal(providerFailure(401).reason,'provider_error');
});
test('every requested ID and status must be present; no positional attribution',()=>{
  assert.equal(validateBatchResults(['a'],result('a')).size,1);
  for(const map of [new Map(),result('b'),new Map([['a',{status:'invented'}]]),new Map([['a',{status:'covered'}],['b',{status:'missing'}]])]){
    assert.throws(()=>validateBatchResults(['a'],map),e=>e.reason==='invalid_response');
  }
});
test('client response is resumable, safe, and asks for backoff',async()=>{
  const response=unavailableResponse(providerFailure(503),{'Access-Control-Allow-Origin':'*'});
  assert.equal(response.status,503);assert.equal(response.headers.get('Retry-After'),'60');
  const body=await response.json();assert.equal(body.code,'AI_ANALYSIS_UNAVAILABLE');assert.equal(body.resumable,true);
  assert.equal(body.reason,'overloaded');assert.equal(body.status,undefined);
});
test('failed group does not advance state, subsequent resume completes that same group',async()=>{
  const state={done:6,pending:['a','b'],checks:[]};
  async function process(evaluate){
    const results=await evaluateBatches([...state.pending],evaluate);
    state.checks.push(...results.flatMap(m=>[...m.keys()]));state.done+=state.pending.length;state.pending=[];
  }
  await assert.rejects(process(async()=>{throw providerFailure(503)}));
  assert.deepEqual(state,{done:6,pending:['a','b'],checks:[]});
  await process(async id=>result(id));assert.deepEqual(state,{done:8,pending:[],checks:['a','b']});
});
