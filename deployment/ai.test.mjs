import {test} from 'node:test';
import assert from 'node:assert/strict';
globalThis.Deno={env:{get:name=>process.env[name]}};
const {aiConfig,toClaude,fromClaude,aiFetch}=await import('../supabase/functions/_shared/ai.ts');
test('semantic search uses Gemini retrieval-query vectors, even with another chat provider',async()=>{
  process.env.GEMINI_API_KEY='test-embedding-key';
  process.env.AI_PROVIDER='custom';
  const old=globalThis.fetch;let request;
  globalThis.fetch=async(url,init)=>{request={url,init};return new Response(JSON.stringify({embeddings:[{values:Array(768).fill(2)}]}));};
  try {
    const response=await aiFetch('https://ai.gateway.lovable.dev/v1/embeddings',{body:JSON.stringify({input:'test question'})});
    const result=await response.json();
    assert.equal(response.status,200);
    assert.equal(JSON.parse(request.init.body).requests[0].taskType,'RETRIEVAL_QUERY');
    assert.ok(request.url.includes('gemini-embedding-001'));
    assert.ok(Math.abs(Math.hypot(...result.data[0].embedding)-1)<1e-10);
  }finally{globalThis.fetch=old;delete process.env.GEMINI_API_KEY;}
});
test('embedding quota failures do not return substitute vectors',async()=>{
  process.env.GEMINI_API_KEY='test-embedding-key';
  const old=globalThis.fetch;
  globalThis.fetch=async()=>new Response('provider details must not leak',{status:429});
  try {
    const response=await aiFetch('https://ai.gateway.lovable.dev/v1/embeddings',{body:JSON.stringify({input:'test question'})});
    assert.equal(response.status,503);
    const result=await response.json();assert.equal(result.data,undefined);
    assert.ok(!JSON.stringify(result).includes('provider details'));
  }finally{globalThis.fetch=old;delete process.env.GEMINI_API_KEY;}
});
test('selecting a provider never substitutes a key from another provider',()=>{
  const env={AI_PROVIDER:'openai',GEMINI_API_KEY:'test-google',AI_MODEL:'test-model'};
  assert.equal(aiConfig(k=>env[k]).ready,false);
});
test('custom providers require a key, model and HTTPS endpoint',()=>{
  const env={AI_PROVIDER:'custom',AI_API_KEY:'test',AI_MODEL:'test-model',AI_BASE_URL:'http://example.com/v1'};
  assert.equal(aiConfig(k=>env[k]).ready,false);
  env.AI_BASE_URL='https://example.com/v1/';assert.equal(aiConfig(k=>env[k]).ready,true);
});
test('Claude keeps system context, attached images and forced tool calls',()=>{
  const result=toClaude({messages:[{role:'system',content:'instructions'},{role:'user',content:[{type:'text',text:'question'},{type:'image_url',image_url:{url:'data:image/png;base64,YQ=='}}]}],tools:[{type:'function',function:{name:'report',parameters:{type:'object'}}}],tool_choice:{type:'function',function:{name:'report'}}},'claude-test');
  assert.equal(result.system,'instructions');assert.equal(result.messages[0].content[1].source.data,'YQ==');
  assert.deepEqual(result.tool_choice,{type:'tool',name:'report'});
});
test('Claude output preserves structured tool arguments expected by analysis',()=>{
  const output=fromClaude({content:[{type:'text',text:'answer'},{type:'tool_use',id:'tool1',name:'report',input:{gaps:[]}}],model:'test'});
  assert.equal(output.choices[0].message.content,'answer');
  assert.deepEqual(JSON.parse(output.choices[0].message.tool_calls[0].function.arguments),{gaps:[]});
});
test('missing credentials fail closed without any network request',async()=>{
  process.env.AI_PROVIDER='custom';delete process.env.AI_API_KEY;
  const old=globalThis.fetch;let calls=0;globalThis.fetch=()=>{calls++;throw Error('unexpected network');};
  try {const r=await aiFetch('https://ai.gateway.lovable.dev/v1/chat/completions',{body:'{}'});assert.equal(r.status,503);assert.equal(calls,0);}finally{globalThis.fetch=old;}
});
test('chat requests route to configured provider and replace the old model and key',async()=>{
  Object.assign(process.env,{AI_PROVIDER:'custom',AI_API_KEY:'test-configured-key',AI_MODEL:'selected-model',AI_BASE_URL:'https://example.com/v1'});
  const old=globalThis.fetch;let request;globalThis.fetch=async(url,init)=>{request={url,init};return new Response('{}');};
  try {await aiFetch('https://ai.gateway.lovable.dev/v1/chat/completions',{body:JSON.stringify({model:'old-model',messages:[]})});
    assert.equal(request.url,'https://example.com/v1/chat/completions');assert.equal(JSON.parse(request.init.body).model,'selected-model');
    assert.equal(request.init.headers.Authorization,'Bearer test-configured-key');
  } finally {globalThis.fetch=old;}
});
