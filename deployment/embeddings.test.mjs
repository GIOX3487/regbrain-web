import test from 'node:test';
import assert from 'node:assert/strict';
import {normalizeEmbedding,embedTexts,configuredServiceKeys,isServiceRequest} from '../supabase/functions/_shared/embeddings.ts';

test('vectors must have 768 finite coordinates and nonzero norm',()=>{
  for(const v of [[],[1],Array(768).fill(0),Array(768).fill(NaN),Array(768).fill(Infinity)]) assert.throws(()=>normalizeEmbedding(v));
  assert.ok(Math.abs(Math.hypot(...normalizeEmbedding(Array(768).fill(2)))-1)<1e-10);
});
test('document embedding request uses retrieval task and header authentication',async()=>{
  let request;
  const result=await embedTexts('test-key',['test document'],'RETRIEVAL_DOCUMENT',async(url,init)=>{
    request={url,init};return new Response(JSON.stringify({embeddings:[{values:Array(768).fill(1)}]}));
  });
  assert.ok(!request.url.includes('test-key'));
  assert.equal(request.init.headers['x-goog-api-key'],'test-key');
  assert.equal(JSON.parse(request.init.body).requests[0].taskType,'RETRIEVAL_DOCUMENT');
  assert.equal(result.length,1);
});
test('partial batches and provider failures are never treated as success',async()=>{
  await assert.rejects(embedTexts('test-key',['a','b'],'RETRIEVAL_QUERY',async()=>new Response(JSON.stringify({embeddings:[{values:Array(768).fill(1)}]}))),/Incomplete/);
  await assert.rejects(embedTexts('test-key',['a'],'RETRIEVAL_QUERY',async()=>new Response('secret provider body',{status:429})),/^Error: Embedding provider HTTP 429$/);
});
test('maintenance rejects missing, publishable and forged keys',async()=>{
  const real='sb_secret_test_administrator_only';
  const keys=configuredServiceKeys(n=>n==='SUPABASE_SECRET_KEYS'?JSON.stringify({default:real}):undefined);
  for(const key of ['', 'sb_publishable_not_an_admin', real+'x']) assert.equal(await isServiceRequest(new Request('https://example.com',{headers:{apikey:key}}),keys),false);
  assert.equal(await isServiceRequest(new Request('https://example.com',{headers:{apikey:real}}),keys),true);
  assert.deepEqual(configuredServiceKeys(()=>undefined),[]);
});
