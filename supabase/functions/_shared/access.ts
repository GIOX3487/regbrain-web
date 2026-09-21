import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.75.0';
import { aiConfig } from './ai.ts';
import { validateRequestAccess } from './access-policy.ts';
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
    const fn=functionName(req);
    const started=Date.now();
    if(adminOnly) {
      const {data:role}=await db.from('user_roles').select('role').eq('user_id',user.id).eq('role','admin').maybeSingle();
      if(!role) { await logEdgeEvent(db,fn,user.id,403,'Operazione riservata agli amministratori.',Date.now()-started); return deny('Operazione riservata agli amministratori.',403); }
    }
    const denial = await validateRequestAccess(req, user.id, async (table, id, userId) => {
      const {data, error} = await db.from(table).select('id').eq('id', id).eq('user_id', userId).maybeSingle();
      return !error && !!data;
    });
    if (denial) return deny(denial.error, denial.status);
    if(requiresAI && !aiConfig().ready) return deny('Il servizio AI non è ancora configurato. Occorre inserire provider, modello e chiave API nelle impostazioni Supabase.',503);
    try {
      const res=await handler(req);
      if(res.status>=400 && res.status!==401) {
        const body=await res.clone().text().catch(()=>'');
        await logEdgeEvent(db,fn,user.id,res.status,errorText(body),Date.now()-started);
      }
      return res;
    } catch(e) {
      await logEdgeEvent(db,fn,user.id,503,e instanceof Error?e.message:String(e),Date.now()-started);
      return deny('Il servizio non è disponibile. Riprova tra poco.',503);
    }
  };
}

// Registro eventi per la console di amministrazione: ogni risposta con errore
// (tranne 401, che è solo una sessione scaduta) finisce in app_events.
// Non deve mai bloccare né rallentare in modo percepibile la risposta.
function functionName(req: Request): string {
  try { return new URL(req.url).pathname.split('/').filter(Boolean).pop() || 'funzione'; } catch { return 'funzione'; }
}
function errorText(body: string): string {
  try { const j=JSON.parse(body); return String(j?.error || j?.message || body).slice(0,500); } catch { return body.slice(0,500); }
}
// deno-lint-ignore no-explicit-any
async function logEdgeEvent(db: any, fn: string, userId: string, status: number, message: string, ms: number) {
  try {
    await db.rpc('log_app_event',{
      p_kind: status>=500 ? 'edge_error' : 'edge_warning',
      p_level: status>=500 ? 'error' : 'warning',
      p_actor: userId,
      p_message: `${fn} ha risposto ${status}: ${message || 'nessun dettaglio'}`,
      p_details: { function: fn, status, duration_ms: ms },
    });
  } catch { /* il registro non deve mai interrompere la risposta */ }
}
