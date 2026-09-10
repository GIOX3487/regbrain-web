import { protect } from '../_shared/access.ts';
import { aiFetch as fetch, getAIKey, getAIModel } from '../_shared/ai.ts';
import { serve as denoServe } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2.75.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const ALLOWED_ARTICLES: Record<string, number[]> = {
  'D.Lgs 81/08': [17,18,26,28,30,31,32,33,34,35,36,37,41,43,44,45,46,63,64,69,70,71,72,73,80,81,82,83,84,85,86,174,175,176,177,178,190],
  'AI Act': [5,6,9,10,11,13,14,15,16,17,26,27,50,53,55],
  'GDPR': [5,6,7,9,12,13,14,15,17,20,22,24,25,26,28,30,32,33,34,35,37,44,45,46,47,48,49],
  'DORA': [5,6,7,8,9,10,11,12,13,17,19,24,25,26,27,28,30],
};

const SPECIFIC_REMOVALS = ['ai_act_art36_notify_changes', 'gdpr_art62_joint_operations'];

denoServe(protect(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    // Get before counts
    const { data: allBefore } = await supabase
      .from('regulatory_requirements')
      .select('id, regulation')
      .eq('source', 'auto_extracted');

    const beforeCounts: Record<string, number> = {};
    for (const r of allBefore || []) {
      beforeCounts[r.regulation] = (beforeCounts[r.regulation] || 0) + 1;
    }
    const totalBefore = allBefore?.length || 0;

    console.log(`⚖️ Starting balance. Total before: ${totalBefore}`);

    // Operations 1-4: Filter by allowed articles
    for (const [regulation, allowedArticles] of Object.entries(ALLOWED_ARTICLES)) {
      const { data: toRemove } = await supabase
        .from('regulatory_requirements')
        .select('id')
        .eq('regulation', regulation)
        .eq('source', 'auto_extracted')
        .not('article_number', 'in', `(${allowedArticles.join(',')})`);

      if (toRemove && toRemove.length > 0) {
        const ids = toRemove.map(r => r.id);
        for (let i = 0; i < ids.length; i += 50) {
          await supabase.from('regulatory_requirements').delete().in('id', ids.slice(i, i + 50));
        }
        console.log(`✅ ${regulation}: removed ${toRemove.length} non-key articles`);
      }
    }

    // Operation 5: Remove specific requirement IDs
    const { data: specificRemoved } = await supabase
      .from('regulatory_requirements')
      .delete()
      .in('requirement_id', SPECIFIC_REMOVALS)
      .select('id');
    console.log(`✅ Removed ${specificRemoved?.length || 0} specific state obligations`);

    // Operation 6: Count results
    const { data: allAfter } = await supabase
      .from('regulatory_requirements')
      .select('id, regulation')
      .eq('source', 'auto_extracted');

    const afterCounts: Record<string, number> = {};
    for (const r of allAfter || []) {
      afterCounts[r.regulation] = (afterCounts[r.regulation] || 0) + 1;
    }
    const totalAfter = allAfter?.length || 0;

    const allRegs = new Set([...Object.keys(beforeCounts), ...Object.keys(afterCounts)]);
    const report: Record<string, any> = { total_before: totalBefore, total_after: totalAfter };
    for (const reg of allRegs) {
      report[reg] = { before: beforeCounts[reg] || 0, after: afterCounts[reg] || 0 };
    }

    console.log(`✅ Balance complete: ${totalBefore} → ${totalAfter}`);

    return new Response(JSON.stringify({ success: true, report }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Balance error:', error);
    return new Response(JSON.stringify({ success: false, error: error instanceof Error ? error.message : String(error) }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
}, true, false));
