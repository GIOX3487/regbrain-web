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
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Get initial count + per-regulation counts
    const { data: allReqs } = await supabase
      .from('regulatory_requirements')
      .select('id, regulation')
      .eq('source', 'auto_extracted');

    const initialCount = allReqs?.length || 0;
    const beforeCounts: Record<string, number> = {};
    for (const r of allReqs || []) {
      beforeCounts[r.regulation] = (beforeCounts[r.regulation] || 0) + 1;
    }

    console.log(`🧹 Starting cleanup. Initial count: ${initialCount}`);

    // PULIZIA 1 — Remove state/member-state obligations
    const { data: d1 } = await supabase.rpc('exec_sql_count', {} as any).select();
    // Use direct delete with filters
    const statePatterns = [
      'gli stati membri', 'stati membri devono', 'gli stati devono',
      'recepimento', 'ciascuno stato membro', 'commissione europea',
      'entro il 17 ottobre 2024', 'entro il 17 gennaio 2025',
    ];
    const statePatterns_en = [
      'member states must', 'member states shall', 'transposition',
      'each member state', 'european commission shall',
    ];

    // Fetch IDs matching state obligation patterns
    let { data: stateOblReqs } = await supabase
      .from('regulatory_requirements')
      .select('id, description_it, description_en')
      .eq('source', 'auto_extracted');

    const stateIds: string[] = [];
    for (const r of stateOblReqs || []) {
      const descIt = (r.description_it || '').toLowerCase();
      const descEn = (r.description_en || '').toLowerCase();
      if (statePatterns.some(p => descIt.includes(p)) || statePatterns_en.some(p => descEn.includes(p))) {
        stateIds.push(r.id);
      }
    }

    if (stateIds.length > 0) {
      await supabase.from('regulatory_requirements').delete().in('id', stateIds);
    }
    const removedStateObligations = stateIds.length;
    console.log(`✅ Pulizia 1: Rimossi ${removedStateObligations} obblighi per stati membri`);

    // PULIZIA 2 — Remove invalid article numbers
    const maxArticles: Record<string, number> = {
      'GDPR': 99, 'NIS2': 46, 'DORA': 64, 'AI Act': 113,
      'CRA': 71, 'Data Act': 50, 'ISO 27001': 10, 'D.Lgs 81/08': 306,
    };

    let { data: allRemaining } = await supabase
      .from('regulatory_requirements')
      .select('id, regulation, article_number')
      .eq('source', 'auto_extracted');

    const invalidIds: string[] = [];
    for (const r of allRemaining || []) {
      const max = maxArticles[r.regulation];
      if (r.article_number <= 0 || (max && r.article_number > max)) {
        invalidIds.push(r.id);
      }
    }

    if (invalidIds.length > 0) {
      await supabase.from('regulatory_requirements').delete().in('id', invalidIds);
    }
    const removedInvalidArticles = invalidIds.length;
    console.log(`✅ Pulizia 2: Rimossi ${removedInvalidArticles} articoli con numero invalido`);

    // PULIZIA 3 — Deduplicate: max 2 per article per regulation
    const riskOrder: Record<string, number> = { 'critical': 1, 'high': 2, 'medium': 3, 'low': 4 };

    let { data: remaining3 } = await supabase
      .from('regulatory_requirements')
      .select('id, regulation, article_number, risk_level, action_hours')
      .eq('source', 'auto_extracted');

    // Group by regulation + article_number
    const groups: Record<string, typeof remaining3> = {};
    for (const r of remaining3 || []) {
      const key = `${r.regulation}:${r.article_number}`;
      if (!groups[key]) groups[key] = [];
      groups[key]!.push(r);
    }

    const dupIds: string[] = [];
    for (const [, items] of Object.entries(groups)) {
      if (items!.length > 2) {
        items!.sort((a, b) => {
          const ra = riskOrder[a.risk_level] || 4;
          const rb = riskOrder[b.risk_level] || 4;
          if (ra !== rb) return ra - rb;
          return (b.action_hours || 0) - (a.action_hours || 0);
        });
        for (let i = 2; i < items!.length; i++) {
          dupIds.push(items![i].id);
        }
      }
    }

    // Delete in batches of 50
    for (let i = 0; i < dupIds.length; i += 50) {
      await supabase.from('regulatory_requirements').delete().in('id', dupIds.slice(i, i + 50));
    }
    const removedDuplicates = dupIds.length;
    console.log(`✅ Pulizia 3: Rimossi ${removedDuplicates} duplicati`);

    // PULIZIA 4 — Fix unrealistic costs/hours
    let { data: remaining4 } = await supabase
      .from('regulatory_requirements')
      .select('id, action_hours')
      .eq('source', 'auto_extracted')
      .or('action_hours.lt.8,action_hours.gt.120');

    let fixedCosts = 0;
    for (const r of remaining4 || []) {
      const newHours = Math.max(8, Math.min(120, r.action_hours));
      await supabase.from('regulatory_requirements')
        .update({ action_hours: newHours, action_cost_eur: newHours * 85 } as any)
        .eq('id', r.id);
      fixedCosts++;
    }
    console.log(`✅ Pulizia 4: Corretti ${fixedCosts} requisiti con costi/ore fuori range`);

    // PULIZIA 5 — Remove empty/insufficient keywords
    let { data: remaining5 } = await supabase
      .from('regulatory_requirements')
      .select('id, coverage_keywords')
      .eq('source', 'auto_extracted');

    const emptyKwIds: string[] = [];
    for (const r of remaining5 || []) {
      if (!r.coverage_keywords || !Array.isArray(r.coverage_keywords) || r.coverage_keywords.length < 4) {
        emptyKwIds.push(r.id);
      }
    }

    if (emptyKwIds.length > 0) {
      for (let i = 0; i < emptyKwIds.length; i += 50) {
        await supabase.from('regulatory_requirements').delete().in('id', emptyKwIds.slice(i, i + 50));
      }
    }
    const removedEmptyKeywords = emptyKwIds.length;
    console.log(`✅ Pulizia 5: Rimossi ${removedEmptyKeywords} requisiti con keyword insufficienti`);

    // PULIZIA 6 — Set uniform thresholds + rag_validation_keywords
    let { data: remaining6 } = await supabase
      .from('regulatory_requirements')
      .select('id, article_number')
      .eq('source', 'auto_extracted');

    for (const r of remaining6 || []) {
      await supabase.from('regulatory_requirements')
        .update({
          coverage_threshold: 0.10,
          min_keyword_matches: 1,
          rag_validation_keywords: [
            `articolo ${r.article_number}`,
            `art. ${r.article_number}`,
            `art ${r.article_number}`,
          ],
        } as any)
        .eq('id', r.id);
    }
    console.log(`✅ Pulizia 6: Soglie uniformate per ${remaining6?.length || 0} requisiti`);

    // AUTO-ACTIVATE all survivors
    const { data: survivors } = await supabase
      .from('regulatory_requirements')
      .select('id, regulation')
      .eq('source', 'auto_extracted');

    if (survivors && survivors.length > 0) {
      // Batch update in groups of 50
      for (let i = 0; i < survivors.length; i += 50) {
        const batch = survivors.slice(i, i + 50).map(s => s.id);
        await supabase.from('regulatory_requirements')
          .update({ verified: true, active: true, updated_at: new Date().toISOString() } as any)
          .in('id', batch);
      }
    }

    const finalCount = survivors?.length || 0;
    const afterCounts: Record<string, number> = {};
    for (const s of survivors || []) {
      afterCounts[s.regulation] = (afterCounts[s.regulation] || 0) + 1;
    }

    const perRegulation: Record<string, { before: number; after: number }> = {};
    const allRegs = new Set([...Object.keys(beforeCounts), ...Object.keys(afterCounts)]);
    for (const reg of allRegs) {
      perRegulation[reg] = {
        before: beforeCounts[reg] || 0,
        after: afterCounts[reg] || 0,
      };
    }

    const report = {
      success: true,
      report: {
        initial_count: initialCount,
        removed_state_obligations: removedStateObligations,
        removed_invalid_articles: removedInvalidArticles,
        removed_duplicates: removedDuplicates,
        fixed_costs: fixedCosts,
        removed_empty_keywords: removedEmptyKeywords,
        final_count: finalCount,
        activated: finalCount,
        per_regulation: perRegulation,
      },
    };

    console.log(`✅ Cleanup complete: ${initialCount} → ${finalCount} (activated: ${finalCount})`);

    return new Response(JSON.stringify(report), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Cleanup error:', error);
    return new Response(JSON.stringify({ success: false, error: error instanceof Error ? error.message : String(error) }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
}, true, false));
