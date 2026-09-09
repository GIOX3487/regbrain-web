import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import { validateRequest, unauthorizedResponse, forbiddenResponse, corsHeaders } from "../_shared/partner-auth.ts";

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const auth = await validateRequest(req);
  if (!auth) return unauthorizedResponse();
  if (!auth.scopes.includes('updates')) return forbiddenResponse('updates');

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const url = new URL(req.url);

    // GET: Fetch latest regulatory updates
    if (req.method === 'GET') {
      const limit = parseInt(url.searchParams.get('limit') || '20');
      const regulation = url.searchParams.get('regulation');
      const since = url.searchParams.get('since');
      const jurisdiction = url.searchParams.get('jurisdiction') || 'EU';

      let query = supabase
        .from('news_updates')
        .select('id, title, summary, source, source_url, regulation_type, jurisdiction, impact_level, published_at')
        .eq('jurisdiction', jurisdiction)
        .order('published_at', { ascending: false })
        .limit(Math.min(limit, 50));

      if (regulation) query = query.eq('regulation_type', regulation);
      if (since) query = query.gte('published_at', since);

      const { data, error } = await query;
      if (error) throw error;

      return new Response(JSON.stringify({
        status: 'success',
        data: {
          updates: data || [],
          count: data?.length || 0,
          filters: { jurisdiction, regulation, since, limit },
        },
        meta: { tenant_id: auth.tenant_id },
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // POST: Register a webhook URL for push notifications
    if (req.method === 'POST') {
      const body = await req.json();
      const { webhook_url, regulations, jurisdiction } = body;

      if (!webhook_url || typeof webhook_url !== 'string') {
        return new Response(JSON.stringify({ status: 'error', error: 'Bad Request – "webhook_url" is required' }), {
          status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      try { new URL(webhook_url); } catch {
        return new Response(JSON.stringify({ status: 'error', error: 'Bad Request – invalid webhook_url format' }), {
          status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const { data, error } = await supabase
        .from('partner_webhooks')
        .upsert({
          partner_id: auth.partner_id,
          webhook_url,
          regulations: regulations || ['GDPR', 'NIS2', 'AI_ACT', 'DORA', 'CRA', 'D.LGS_81_08'],
          jurisdiction: jurisdiction || 'EU',
          active: true,
          updated_at: new Date().toISOString(),
        }, { onConflict: 'partner_id' })
        .select()
        .single();

      if (error) throw error;

      return new Response(JSON.stringify({
        status: 'success',
        data: {
          webhook_id: data.id,
          message: 'Webhook registrato. Riceverai notifiche push per nuovi aggiornamenti normativi.',
          monitored_regulations: data.regulations,
          jurisdiction: data.jurisdiction,
        },
        meta: { tenant_id: auth.tenant_id },
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({ status: 'error', error: 'Method not allowed' }), {
      status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('api-v1-regulatory-updates error:', error);
    return new Response(JSON.stringify({ status: 'error', error: 'Internal Server Error' }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
