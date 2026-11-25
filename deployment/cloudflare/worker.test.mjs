import test from 'node:test';
import assert from 'node:assert/strict';
import worker from './worker.js';

test('API proxy preserves POST, query, auth and streaming response without caching', async () => {
  const saved = globalThis.fetch;
  globalThis.fetch = async req => {
    assert.equal(req.url, 'https://ndwozjlasabsdfqcyeoy.supabase.co/functions/v1/rag-query?x=1');
    assert.equal(req.headers.get('authorization'), 'Bearer test-only');
    assert.equal(req.headers.get('cookie'), null);
    assert.equal(await req.text(), '{"question":"test"}');
    return new Response('data: test\n\n', {headers: {'Content-Type':'text/event-stream'}});
  };
  try {
    const r = await worker.fetch(new Request('https://trial.pages.dev/api/supabase/functions/v1/rag-query?x=1', {method:'POST',headers:{authorization:'Bearer test-only',cookie:'unrelated=value'},body:'{"question":"test"}'}), {});
    assert.equal(await r.text(), 'data: test\n\n');
    assert.equal(r.headers.get('cache-control'),'private, no-store');
    assert.equal(r.headers.get('content-type'),'text/event-stream');
  } finally { globalThis.fetch=saved; }
});
test('password route preserves token verification query', async () => {
  const saved=globalThis.fetch;
  globalThis.fetch=async req=>{assert.equal(req.url,'https://ndwozjlasabsdfqcyeoy.supabase.co/functions/v1/verify-site-password?action=verify-token');return new Response('{}',{status:401});};
  try {assert.equal((await worker.fetch(new Request('https://trial.pages.dev/api/verify-site-password?action=verify-token'),{})).status,401);}finally{globalThis.fetch=saved;}
});
test('unknown API route does not become SPA HTML',async()=>assert.equal((await worker.fetch(new Request('https://trial.pages.dev/api/unknown'),{})).status,404));
test('assets use the static binding',async()=>assert.equal(await (await worker.fetch(new Request('https://trial.pages.dev/chat'),{ASSETS:{fetch:async()=>new Response('spa')}})).text(),'spa'));
test('double slash cannot change upstream host',async()=>{
 const saved=globalThis.fetch;globalThis.fetch=async req=>{assert.equal(new URL(req.url).origin,'https://ndwozjlasabsdfqcyeoy.supabase.co');return new Response('ok');};
 try{await worker.fetch(new Request('https://trial.pages.dev/api/supabase//example.org'),{});}finally{globalThis.fetch=saved;}
});
