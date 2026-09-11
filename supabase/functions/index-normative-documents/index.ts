import {createClient} from 'npm:@supabase/supabase-js@2.75.0';
import {configuredServiceKeys,isServiceRequest,embedTexts,EMBEDDING_MODEL} from '../_shared/embeddings.ts';

const headers = {'Content-Type':'application/json','Cache-Control':'no-store'};
const json = (body:unknown,status=200) => new Response(JSON.stringify(body),{status,headers});

Deno.serve(async req => {
  if (!await isServiceRequest(req,configuredServiceKeys(name=>Deno.env.get(name)))) return json({error:'Administrator service key required'},401);
  if (req.method !== 'POST') return json({error:'POST required'},405);
  let body: any;
  try {body=await req.json();} catch {return json({error:'Invalid JSON'},400);}
  if (!body || Array.isArray(body) || typeof body !== 'object') return json({error:'Invalid request'},400);
  const limit = body.limit ?? 20;
  const rounds = body.rounds ?? 1;
  if (!Number.isInteger(limit) || limit<1 || limit>20 || !Number.isInteger(rounds) || rounds<1 || rounds>5) return json({error:'limit: 1–20; rounds: 1–5'},400);
  const key = Deno.env.get('GEMINI_API_KEY');
  if (!key) return json({error:'GEMINI_API_KEY missing'},503);
  const db=createClient(Deno.env.get('SUPABASE_URL')!,Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,{auth:{persistSession:false,autoRefreshToken:false}});
  let updated=0;
  try {
    if (body.probe === true) {
      const [vector]=await embedTexts(key,['Documento di prova per verificare la ricerca semantica.'],'RETRIEVAL_DOCUMENT');
      return json({ok:true,model:EMBEDDING_MODEL,dimensions:vector.length,norm:Math.hypot(...vector)});
    }
    const started=Date.now();
    for(let round=0;round<rounds;round++) {
      const {data,error}=await db.from('chunks').select('id,content,documents!inner(is_public)').eq('documents.is_public',true).is('embedding',null).order('id').limit(limit);
      if(error) throw new Error('Unable to read normative chunks');
      if(!data?.length) return json({ok:true,updated,complete:true,model:EMBEDDING_MODEL});
      const vectors=await embedTexts(key,data.map(c=>c.content),'RETRIEVAL_DOCUMENT');
      const {data:saved,error:saveError}=await db.rpc('save_normative_embeddings',{items:data.map((c,i)=>({id:c.id,content:c.content,embedding:vectors[i]}))});
      if(saveError || saved!==data.length) throw new Error('Embedding batch was not fully saved');
      updated+=saved;
      if(Date.now()-started>70000) break;
      // Batch items count against provider quotas. Pace public-corpus ingestion.
      if(round+1<rounds) await new Promise(resolve=>setTimeout(resolve,15000));
    }
    return json({ok:true,updated,complete:false,model:EMBEDDING_MODEL});
  } catch(error) {
    const message=error instanceof Error ? error.message : 'Indexing failed';
    console.warn('Normative indexing stopped:',message);
    return json({ok:false,updated,error:message,resumable:true},503);
  }
});
