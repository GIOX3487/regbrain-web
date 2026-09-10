// Server-only provider configuration. Never return API keys to the browser.
type Env = (name: string) => string | undefined;
const env: Env = name => Deno.env.get(name);
export function aiConfig(read: Env = env) {
  const provider = (read('AI_PROVIDER') || (read('GEMINI_API_KEY') ? 'gemini' : read('OPENAI_API_KEY') ? 'openai' : read('ANTHROPIC_API_KEY') ? 'anthropic' : 'lovable')).toLowerCase();
  const keys: Record<string,string> = {gemini:'GEMINI_API_KEY',openai:'OPENAI_API_KEY',anthropic:'ANTHROPIC_API_KEY',lovable:'LOVABLE_API_KEY',custom:'AI_API_KEY'};
  const bases: Record<string,string> = {gemini:'https://generativelanguage.googleapis.com/v1beta/openai',openai:'https://api.openai.com/v1',anthropic:'https://api.anthropic.com/v1',lovable:'https://ai.gateway.lovable.dev/v1'};
  const key = keys[provider] ? read(keys[provider]) : undefined;
  const model = read('AI_MODEL') || (provider==='lovable' ? 'google/gemini-3-pro-preview' : '');
  const baseUrl = (provider==='custom' ? read('AI_BASE_URL') || '' : bases[provider] || '').replace(/\/$/,'');
  return {provider,key,model,baseUrl,ready:!!(key && model && baseUrl.startsWith('https://'))};
}
export const getAIKey = () => aiConfig().key;
export const getAIModel = () => aiConfig().model;

export function toClaude(body: any, model: string) {
  const system = body.messages.filter((m:any)=>['system','developer'].includes(m.role)).map((m:any)=>m.content).join('\n');
  const messages = body.messages.filter((m:any)=>!['system','developer'].includes(m.role)).map((m:any)=>({
    role:m.role==='assistant'?'assistant':'user',
    content: Array.isArray(m.content) ? m.content.map((part:any)=> {
      if(part.type==='text') return part;
      if(part.type==='image_url') {
        const value=part.image_url.url;
        const data=/^data:([^;]+);base64,(.*)$/s.exec(value);
        return {type:'image',source:data ? {type:'base64',media_type:data[1],data:data[2]} : {type:'url',url:value}};
      }
      throw new Error('Unsupported content for Claude');
    }) : m.content,
  }));
  const result:any = {model,system,messages,max_tokens:body.max_tokens || 8000};
  if(body.temperature!==undefined) result.temperature=Math.min(1,Math.max(0,body.temperature));
  if(body.tools) result.tools=body.tools.map((t:any)=>({name:t.function.name,description:t.function.description,input_schema:t.function.parameters}));
  if(body.tool_choice?.function?.name) result.tool_choice={type:'tool',name:body.tool_choice.function.name};
  else if(body.tool_choice==='required') result.tool_choice={type:'any'};
  if(body.response_format?.type==='json_object') result.system+='\nReturn only a valid JSON object, without markdown fences.';
  return result;
}
export function fromClaude(data:any) {
  return {model:data.model,choices:[{message:{role:'assistant',content:(data.content || []).filter((p:any)=>p.type==='text').map((p:any)=>p.text).join('\n'),
    tool_calls:(data.content || []).filter((p:any)=>p.type==='tool_use').map((p:any)=>({id:p.id,type:'function',function:{name:p.name,arguments:JSON.stringify(p.input)}}))},finish_reason:data.stop_reason}],usage:data.usage};
}
export async function aiFetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  const url=String(input);
  if(!url.startsWith('https://ai.gateway.lovable.dev/v1/')) return globalThis.fetch(input,init);
  const json=(body:unknown,status=200)=>new Response(JSON.stringify(body),{status,headers:{'Content-Type':'application/json'}});
  // Embeddings stay on one model/dimension independently of the chat provider.
  if(url.endsWith('/embeddings')) {
    const key=env('GEMINI_API_KEY');
    if(!key) return json({error:'GEMINI_API_KEY is required for semantic indexing'},503);
    const body=JSON.parse(String(init?.body || '{}'));
    const response=await globalThis.fetch('https://generativelanguage.googleapis.com/v1beta/models/gemini-embedding-001:embedContent',{
      method:'POST',headers:{'Content-Type':'application/json','x-goog-api-key':key},
      body:JSON.stringify({model:'models/gemini-embedding-001',content:{parts:[{text:body.input}]},outputDimensionality:768}),signal:AbortSignal.timeout(60000)});
    if(!response.ok) return response;
    const data=await response.json();return json({data:[{embedding:data.embedding.values}]});
  }
  if(!url.endsWith('/chat/completions')) return json({error:'Unsupported AI endpoint'},400);
  const config=aiConfig();
  if(!config.ready) return json({error:'Servizio AI da configurare: imposta provider, modello e chiave su Supabase.'},503);
  const body=JSON.parse(String(init?.body || '{}'));
  body.model=config.model;
  if(body.stream) return json({error:'Streaming is not supported by this adapter'},400);
  if(config.provider==='anthropic') {
    const response=await globalThis.fetch(config.baseUrl+'/messages',{method:'POST',headers:{'Content-Type':'application/json','x-api-key':config.key!,'anthropic-version':'2023-06-01'},body:JSON.stringify(toClaude(body,config.model)),signal:AbortSignal.timeout(60000)});
    if(!response.ok) return response;
    return json(fromClaude(await response.json()));
  }
  if(config.provider==='openai' && /^(gpt-5|o[1-9])/.test(config.model)) {delete body.temperature;body.max_completion_tokens=body.max_tokens;delete body.max_tokens;}
  return globalThis.fetch(config.baseUrl+'/chat/completions',{method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer '+config.key},body:JSON.stringify(body),signal:AbortSignal.timeout(60000)});
}
