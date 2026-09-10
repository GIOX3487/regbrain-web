import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.75.0';
import { aiConfig } from './ai.ts';
const cors = {'Content-Type':'application/json','Cache-Control':'no-store','Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'authorization, x-client-info, apikey, content-type','Access-Control-Allow-Methods':'POST, GET, OPTIONS'};
export function protect(handler: (req: Request) => Promise<Response>, adminOnly = false, requiresAI = false) {
  return async (req: Request): Promise<Response> => {
    if(req.method === 'OPTIONS') return new Response(null,{headers:cors});
    const deny=(error:string,status:number)=>new Response(JSON.stringify({error}),{status,headers:cors});
    const bearer=req.headers.get('Authorization')?.replace(/^Bearer /,'') || '';
    const db=createClient(Deno.env.get('SUPABASE_URL')!,Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,{auth:{persistSession:false,autoRefreshToken:false}});
    const {data:{user},error}=await db.auth.getUser(bearer);
    if(error || !user) return deny('Accedi al tuo account per continuare.',401);
    if(user.app_metadata?.demo_expires_at && Date.parse(user.app_metadata.demo_expires_at)<=Date.now()) return deny('La demo è scaduta. Avvia una nuova sessione.',401);
    if(adminOnly) {
      const {data:role}=await db.from('user_roles').select('role').eq('user_id',user.id).eq('role','admin').maybeSingle();
      if(!role) return deny('Operazione riservata agli amministratori.',403);
    }
    if(req.method==='POST' && req.headers.get('content-type')?.includes('json')) {
      let body: Record<string,unknown>;
      try { body=await req.clone().json(); } catch { return deny('Richiesta non valida.',400); }
      if(!body || typeof body!=='object') return deny('Richiesta non valida.',400);
      for(const k of ['userId','user_id']) if(body[k] && body[k]!==user.id) return deny('Accesso non consentito.',403);
      for(const [field,table,owner] of [['assessmentId','compliance_assessments','user_id'],['assessment_id','compliance_assessments','user_id'],['modelId','ai_models','user_id'],['monitorId','compliance_monitors','user_id']] ) {
        if(body[field]) {
          const {data:owned}=await db.from(table).select('id').eq('id',body[field]).eq(owner,user.id).maybeSingle();
          if(!owned) return deny('Elemento non trovato nel tuo account.',403);
        }
      }
    }
    if(requiresAI && !aiConfig().ready) return deny('Il servizio AI non è ancora configurato. Occorre inserire provider, modello e chiave API nelle impostazioni Supabase.',503);
    try { return await handler(req); } catch { return deny('Il servizio non è disponibile. Riprova tra poco.',503); }
  };
}
