import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
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

    console.log('Running continuous monitoring scan for user:', user.id);

    // SECURITY: Input validation for database schema data
    const validateTableData = (data: any): boolean => {
      if (!data || !Array.isArray(data)) return false;
      
      for (const table of data) {
        if (!table.table_name || typeof table.table_name !== 'string') return false;
        if (table.table_name.length > 255) return false;
        
        if (table.columns && Array.isArray(table.columns)) {
          for (const column of table.columns) {
            if (!column.column_name || typeof column.column_name !== 'string') return false;
            if (column.column_name.length > 255) return false;
          }
        }
      }
      return true;
    };

    // 1. Verifica modifiche schema database (tabelle, colonne)
    const { data: tables, error: tablesError } = await supabase.rpc('get_table_info');
    
    if (tablesError) {
      console.error('Error fetching table info:', tablesError);
    }

    // Validate table data structure
    if (tables && !validateTableData(tables)) {
      console.error('Invalid table data structure');
      return new Response(
        JSON.stringify({ error: 'Invalid database schema data' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 2. Carica i monitor configurati dall'utente
    const { data: monitors, error: monitorsError } = await supabase
      .from('compliance_monitors')
      .select('*')
      .eq('user_id', user.id)
      .eq('status', 'active');

    if (monitorsError) {
      console.error('Error fetching monitors:', monitorsError);
    }

    const findings: any[] = [];

    // 3. Simula rilevamento modifiche (in produzione, questo verrebbe da confronto con stato precedente)
    // Per ora creiamo findings di esempio per dimostrare la funzionalità
    
    // Controlla se ci sono nuove colonne che potrebbero contenere dati personali
    const personalDataKeywords = ['email', 'phone', 'address', 'name', 'ssn', 'tax', 'birth', 'password', 'user'];
    
    if (tables && Array.isArray(tables)) {
      for (const table of tables) {
        if (table.columns && Array.isArray(table.columns)) {
          for (const column of table.columns) {
            const columnName = column.column_name?.toLowerCase() || '';
            const hasPersonalData = personalDataKeywords.some(keyword => 
              columnName.includes(keyword)
            );
            
            if (hasPersonalData) {
              // Verifica se questa colonna è già tracciata
              const { data: existingFinding } = await supabase
                .from('monitoring_findings')
                .select('id')
                .eq('user_id', user.id)
                .eq('resource_type', 'database')
                .eq('resource_name', `${table.table_name}.${column.column_name}`)
                .eq('status', 'open')
                .maybeSingle();

              if (!existingFinding) {
                // Nuovo finding!
                findings.push({
                  user_id: user.id,
                  monitor_type: 'database',
                  resource_type: 'database',
                  resource_name: `${table.table_name}.${column.column_name}`,
                  finding_type: 'personal_data_field',
                  severity: 'medium',
                  title: 'Campo con dati personali rilevato',
                  description: `Il campo '${column.column_name}' nella tabella '${table.table_name}' potrebbe contenere dati personali. Verifica se richiede aggiornamento del RoPA (Art. 30 GDPR).`,
                  recommended_actions: [
                    'Aggiorna il registro delle attività di trattamento (RoPA)',
                    'Verifica se è necessaria una DPIA',
                    'Controlla le policy RLS sulla tabella',
                    'Documenta la finalità del trattamento'
                  ],
                  compliance_impact: ['GDPR Art. 30', 'GDPR Art. 35'],
                  status: 'open'
                });
              }
            }
          }
        }
      }
    }

    // 4. Salva i findings nel database
    if (findings.length > 0) {
      const { error: insertError } = await supabase
        .from('monitoring_findings')
        .insert(findings);

      if (insertError) {
        console.error('Error inserting findings:', insertError);
      } else {
        console.log(`Inserted ${findings.length} new findings`);

        // 5. Crea notifiche per l'utente
        for (const finding of findings) {
          await supabase
            .from('notifications')
            .insert({
              user_id: user.id,
              type: 'compliance_alert',
              payload: {
                title: finding.title,
                description: finding.description,
                severity: finding.severity,
                finding_id: finding.id
              }
            });
        }
      }
    }

    // 6. Aggiorna timestamp ultimo scan sui monitor
    if (monitors && monitors.length > 0) {
      for (const monitor of monitors) {
        await supabase
          .from('compliance_monitors')
          .update({ 
            last_check: new Date().toISOString(),
            total_scans: (monitor.total_scans || 0) + 1
          })
          .eq('id', monitor.id);
      }
    }

    console.log('Monitoring scan completed');

    return new Response(JSON.stringify({ 
      success: true,
      findingsCount: findings.length,
      findings: findings.map(f => ({
        title: f.title,
        severity: f.severity,
        resource: f.resource_name
      }))
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error: any) {
    console.error('Error in continuous-monitoring-scan:', error);
    return new Response(
      JSON.stringify({ 
        error: error.message,
        details: 'Errore durante la scansione di monitoraggio'
      }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
