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
    if(adminOnly) {
      const {data:role}=await db.from('user_roles').select('role').eq('user_id',user.id).eq('role','admin').maybeSingle();
      if(!role) return deny('Operazione riservata agli amministratori.',403);
    }
    const denial = await validateRequestAccess(req, user.id, async (table, id, userId) => {
      const {data, error} = await db.from(table).select('id').eq('id', id).eq('user_id', userId).maybeSingle();
      return !error && !!data;
    });
    if (denial) return deny(denial.error, denial.status);
    if(requiresAI && !aiConfig().ready) return deny('Il servizio AI non è ancora configurato. Occorre inserire provider, modello e chiave API nelle impostazioni Supabase.',503);
    try { return await handler(req); } catch { return deny('Il servizio non è disponibile. Riprova tra poco.',503); }
  };
}
