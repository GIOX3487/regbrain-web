import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.75.0';
import { verify } from 'https://deno.land/x/djwt@v3.0.1/mod.ts';

const headers = {
  'Content-Type': 'application/json', 'Cache-Control': 'no-store',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, apikey, content-type, x-client-info',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), {status, headers});
Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, {headers});
  if (req.method !== 'POST') return json({error: 'Metodo non consentito'}, 405);
  const secret = Deno.env.get('SITE_ACCESS_PASSWORD');
  if (!secret) return json({error: 'Accesso demo non configurato'}, 503);
  const token = req.headers.get('Authorization')?.replace(/^Bearer /, '') || '';
  try {
    const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(secret.padEnd(32,'0').substring(0,32)),
      {name:'HMAC',hash:'SHA-256'}, false, ['verify']);
    const claims = await verify(token,key);
    if(claims.iss !== 'regbrain-site-auth' || typeof claims.exp !== 'number' || claims.exp <= Date.now()/1000)
      return json({error:'Rientra nel sito con la password per avviare la demo.'},401);
  } catch { return json({error:'Rientra nel sito con la password per avviare la demo.'},401); }
  const url = Deno.env.get('SUPABASE_URL')!;
  const admin = createClient(url,Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,{auth:{persistSession:false,autoRefreshToken:false}});
  const digest = await crypto.subtle.digest('SHA-256',new TextEncoder().encode(token));
  const tokenHash = Array.from(new Uint8Array(digest),b=>b.toString(16).padStart(2,'0')).join('');
  const {data:reserved,error:reserveError}=await admin.rpc('reserve_demo',{p_token_hash:tokenHash});
  if(reserveError) return json({error:'Servizio demo non disponibile. Riprova tra poco.'},503);
  if(!reserved) return json({error:'Attendi un minuto prima di creare una nuova demo (massimo 6 al giorno).'},429);
  let createdId: string | undefined;
  try {
    const email = 'demo-'+crypto.randomUUID()+'@demo.regbrain.com';
    const password = crypto.randomUUID()+crypto.randomUUID();
    const expiresAt = new Date(Date.now()+24*60*60*1000).toISOString();
    const {data:created,error}=await admin.auth.admin.createUser({email,password,email_confirm:true,
      app_metadata:{is_demo:true,demo_expires_at:expiresAt},user_metadata:{is_demo:true}});
    if(error || !created.user) throw new Error('create_user');
    createdId=created.user.id;
    const {error:sessionError}=await admin.from('demo_sessions').insert({user_id:createdId,email,expires_at:expiresAt});
    if(sessionError) throw new Error('demo_session');
    const auth = createClient(url,Deno.env.get('SUPABASE_ANON_KEY')!,{auth:{persistSession:false,autoRefreshToken:false}});
    const {data:signed,error:signError}=await auth.auth.signInWithPassword({email,password});
    if(signError || !signed.session) throw new Error('sign_in');
    return json({access_token:signed.session.access_token,refresh_token:signed.session.refresh_token,expires_at:expiresAt});
  } catch {
    if(createdId) {
      await admin.from('demo_sessions').delete().eq('user_id',createdId);
      await admin.auth.admin.deleteUser(createdId);
    }
    console.error('Demo provisioning failed');
    return json({error:'Non è stato possibile attivare la demo. Riprova tra un minuto.'},503);
  }
});
