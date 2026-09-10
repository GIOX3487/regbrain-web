import { protect } from '../_shared/access.ts';
import { aiFetch as fetch, getAIKey, getAIModel } from '../_shared/ai.ts';
import { serve as denoServe } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2.75.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

denoServe(protect(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    
    const supabase = createClient(supabaseUrl, supabaseKey);
    
    const authHeader = req.headers.get('Authorization')!;
    const token = authHeader.replace('Bearer ', '');
    const { data: { user } } = await supabase.auth.getUser(token);
    
    if (!user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log('Initializing monitoring for user:', user.id);

    // Crea i monitor di default per l'utente
    const defaultMonitors = [
      {
        user_id: user.id,
        name: 'Database schema compliance',
        description: 'Monitora modifiche allo schema database che potrebbero richiedere aggiornamenti compliance',
        monitor_type: 'database',
        status: 'active',
        check_frequency_minutes: 60,
        config: {
          checkNewTables: true,
          checkNewColumns: true,
          checkPersonalDataFields: true
        }
      },
      {
        user_id: user.id,
        name: 'Data processing activities',
        description: 'Traccia nuove attività di trattamento dati che richiedono documentazione RoPA',
        monitor_type: 'processing',
        status: 'active',
        check_frequency_minutes: 120,
        config: {
          trackNewProcessing: true,
          alertOnHighRisk: true
        }
      },
      {
        user_id: user.id,
        name: 'API endpoints security',
        description: 'Verifica nuovi endpoint API e modifiche ai parametri che espongono dati personali',
        monitor_type: 'api',
        status: 'active',
        check_frequency_minutes: 30,
        config: {
          checkNewEndpoints: true,
          checkParameterChanges: true,
          alertOnPublicDataExposure: true
        }
      }
    ];

    // Verifica se i monitor esistono già
    const { data: existingMonitors } = await supabase
      .from('compliance_monitors')
      .select('id')
      .eq('user_id', user.id);

    if (!existingMonitors || existingMonitors.length === 0) {
      // Inserisci i monitor di default
      const { data: insertedMonitors, error: insertError } = await supabase
        .from('compliance_monitors')
        .insert(defaultMonitors)
        .select();

      if (insertError) {
        throw insertError;
      }

      console.log(`Created ${insertedMonitors?.length || 0} default monitors`);

      return new Response(JSON.stringify({ 
        success: true,
        monitorsCreated: insertedMonitors?.length || 0,
        monitors: insertedMonitors
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    } else {
      return new Response(JSON.stringify({ 
        success: true,
        message: 'Monitors already initialized',
        monitorsCount: existingMonitors.length
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

  } catch (error: any) {
    console.error('Error in initialize-monitoring:', error);
    return new Response(
      JSON.stringify({ 
        error: error.message,
        details: 'Errore durante l\'inizializzazione del monitoraggio'
      }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
}, false, false));
