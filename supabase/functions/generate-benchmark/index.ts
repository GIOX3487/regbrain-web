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
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      throw new Error('Missing authorization header');
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: userError } = await supabase.auth.getUser(token);
    
    if (userError || !user) {
      throw new Error('Unauthorized');
    }

    const { assessmentId } = await req.json();

    console.log('Generating sector benchmark for assessment:', assessmentId);

    // Get assessment details
    const { data: assessment, error: assessmentError } = await supabase
      .from('compliance_assessments')
      .select('*, identified_gaps(*)')
      .eq('id', assessmentId)
      .single();

    if (assessmentError || !assessment) {
      console.error('Assessment error:', assessmentError);
      throw new Error('Assessment not found');
    }

    // Get sector benchmark data
    const { data: benchmarks, error: benchmarkError } = await supabase
      .from('sector_benchmarks')
      .select('*')
      .eq('sector', assessment.scope_sector)
      .eq('jurisdiction', assessment.scope_jurisdiction)
      .in('regulation', assessment.scope_regulations);

    if (benchmarkError) {
      console.error('Error fetching benchmarks:', benchmarkError);
    }

    // Get user profile for language context
    const { data: profile } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', assessment.user_id)
      .maybeSingle();

    // Calculate deterministic values based on actual data
    const complianceScore = assessment.overall_compliance_percentage || 50;
    const sectorAvg = calculateSectorAverage(benchmarks || []);
    const hasBenchmarkData: boolean = !!(benchmarks && benchmarks.length > 0);
    
    // Deterministic percentile calculation based on actual compliance vs sector average
    const percentileDelta = complianceScore - sectorAvg;
    const basePercentile = 50 + (percentileDelta * 1.5); // 1.5 factor for sensitivity
    const deterministicPercentile = Math.min(95, Math.max(5, Math.round(basePercentile)));

    // Nessuna ricerca di mercato esterna: il benchmark usa solo i dati interni.
    const marketIntelligence = '';
    const marketSources: Array<{ title: string; url: string }> = [];

    const LOVABLE_API_KEY = getAIKey();
    if (!LOVABLE_API_KEY) {
      throw new Error('LOVABLE_API_KEY not configured');
    }

    // Build benchmark analysis prompt with language support and market intelligence
    const benchmarkPrompt = buildBenchmarkPrompt(
      assessment, 
      benchmarks || [], 
      assessment.identified_gaps || [], 
      profile?.jurisdiction || 'IT',
      marketIntelligence,
      marketSources,
      deterministicPercentile,
      sectorAvg,
      hasBenchmarkData
    );

    console.log('Calling AI for benchmark analysis...');

    const aiResponse = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${LOVABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: [
          {
            role: 'system',
            content: `You are an elite compliance benchmarking expert. Analyze assessment data against industry benchmarks. 
Return ONLY valid JSON with no markdown, code blocks, or additional text.
CRITICAL: Be consistent - given the same input data, always produce the same analysis.
Use ONLY the data provided. Do NOT invent statistics or percentages not in the input.`
          },
          {
            role: 'user',
            content: benchmarkPrompt
          }
        ],
        tools: [{
          type: 'function',
          function: {
            name: 'generate_benchmark_analysis',
            description: 'Generate comprehensive sector benchmark comparison based strictly on provided data',
            parameters: {
              type: 'object',
              properties: {
                sector_position_percentile: {
                  type: 'number',
                  description: 'Percentile rank vs sector peers (0-100) - MUST match the provided calculated percentile'
                },
                areas_ahead_of_market: {
                  type: 'array',
                  items: {
                    type: 'object',
                    properties: {
                      area: { type: 'string' },
                      your_score: { type: 'number' },
                      market_average: { type: 'number' },
                      percentile: { type: 'number' },
                      competitive_advantage: { type: 'string' }
                    }
                  }
                },
                areas_behind_market: {
                  type: 'array',
                  items: {
                    type: 'object',
                    properties: {
                      area: { type: 'string' },
                      your_score: { type: 'number' },
                      market_average: { type: 'number' },
                      gap_percentage: { type: 'number' },
                      market_adoption_rate: { type: 'number' },
                      competitive_risk: { type: 'string' },
                      urgency: { type: 'string' }
                    }
                  }
                },
                competitive_insights: {
                  type: 'array',
                  items: {
                    type: 'object',
                    properties: {
                      insight: { type: 'string' },
                      evidence: { type: 'string' },
                      strategic_implication: { type: 'string' },
                      priority: { type: 'string' },
                      source_url: { type: 'string' },
                      source_title: { type: 'string' }
                    }
                  }
                },
                quick_wins: {
                  type: 'array',
                  items: {
                    type: 'object',
                    properties: {
                      action: { type: 'string' },
                      market_adoption: { type: 'number' },
                      percentile_impact: { type: 'number' },
                      estimated_impact: { type: 'string' },
                      effort: { type: 'string' },
                      timeline: { type: 'string' },
                      why_quick_win: { type: 'string' },
                      source_url: { type: 'string' },
                      source_title: { type: 'string' }
                    }
                  }
                },
                data_quality: {
                  type: 'object',
                  properties: {
                    has_real_benchmark_data: { type: 'boolean' },
                    has_market_intelligence: { type: 'boolean' },
                    confidence_level: { type: 'string', enum: ['high', 'medium', 'low'] },
                    data_sources_count: { type: 'number' }
                  }
                }
              },
              required: ['sector_position_percentile', 'areas_ahead_of_market', 'areas_behind_market', 'competitive_insights', 'quick_wins', 'data_quality']
            }
          }
        }],
        tool_choice: { type: 'function', function: { name: 'generate_benchmark_analysis' } }
      })
    });

    if (!aiResponse.ok) {
      const errorText = await aiResponse.text();
      console.error('AI API error:', aiResponse.status, errorText);
      throw new Error(`AI API error: ${aiResponse.status}`);
    }

    const aiData = await aiResponse.json();
    console.log('AI response received');
    
    let benchmarkAnalysis;
    
    // Try to get from tool call first
    const toolCall = aiData.choices[0]?.message?.tool_calls?.[0];
    
    if (toolCall?.function?.arguments) {
      try {
        benchmarkAnalysis = JSON.parse(toolCall.function.arguments);
        console.log('Parsed from tool call');
        
        // Enforce deterministic percentile
        benchmarkAnalysis.sector_position_percentile = deterministicPercentile;
      } catch (parseError) {
        console.error('Error parsing tool call arguments:', parseError);
      }
    }
    
    // Fallback: try to extract JSON from message content
    if (!benchmarkAnalysis) {
      const content = aiData.choices[0]?.message?.content;
      if (content) {
        console.log('Attempting to extract JSON from content...');
        benchmarkAnalysis = extractJsonFromContent(content);
        if (benchmarkAnalysis) {
          benchmarkAnalysis.sector_position_percentile = deterministicPercentile;
        }
      }
    }
    
    // Final fallback: generate deterministic benchmark
    if (!benchmarkAnalysis) {
      console.log('Using fallback benchmark generation');
      benchmarkAnalysis = generateDeterministicFallbackBenchmark(
        assessment, 
        benchmarks || [], 
        deterministicPercentile,
        sectorAvg,
        hasBenchmarkData
      );
    }

    // Store benchmark analysis (upsert to allow regeneration)
    const { data: storedBenchmark, error: storeError } = await supabase
      .from('assessment_benchmarks')
      .upsert({
        assessment_id: assessmentId,
        sector_position_percentile: deterministicPercentile, // Always use calculated percentile
        areas_ahead_of_market: benchmarkAnalysis.areas_ahead_of_market || [],
        areas_behind_market: benchmarkAnalysis.areas_behind_market || [],
        sector_average_compliance: Math.round(sectorAvg),
        your_compliance: assessment.overall_compliance_percentage,
        competitive_insights: benchmarkAnalysis.competitive_insights || [],
        quick_wins: benchmarkAnalysis.quick_wins || [],
        updated_at: new Date().toISOString()
      }, { onConflict: 'assessment_id' })
      .select()
      .single();

    if (storeError) {
      console.error('Error storing benchmark:', storeError);
      throw storeError;
    }

    console.log('Benchmark analysis completed successfully');
    console.log('Data quality:', benchmarkAnalysis.data_quality);

    return new Response(
      JSON.stringify({
        success: true,
        benchmark: storedBenchmark,
        data_quality: benchmarkAnalysis.data_quality || {
          has_real_benchmark_data: hasBenchmarkData,
          has_market_intelligence: !!marketIntelligence,
          confidence_level: hasBenchmarkData && marketIntelligence ? 'high' : hasBenchmarkData || marketIntelligence ? 'medium' : 'low',
          data_sources_count: (benchmarks?.length || 0) + marketSources.length
        }
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in generate-benchmark function:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
}, false, true));

function extractJsonFromContent(content: string): any | null {
  try {
    return JSON.parse(content);
  } catch {
    const jsonMatch = content.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (jsonMatch) {
      try {
        return JSON.parse(jsonMatch[1].trim());
      } catch {
        console.error('Failed to parse JSON from code block');
      }
    }
    
    const objectMatch = content.match(/\{[\s\S]*\}/);
    if (objectMatch) {
      try {
        return JSON.parse(objectMatch[0]);
      } catch {
        console.error('Failed to parse JSON object from content');
      }
    }
  }
  return null;
}

// Deterministic fallback - no random values
function generateDeterministicFallbackBenchmark(
  assessment: any, 
  benchmarks: any[],
  percentile: number,
  sectorAvg: number,
  hasBenchmarkData: boolean
): any {
  const complianceScore = assessment.overall_compliance_percentage || 50;
  const gaps = assessment.identified_gaps || [];
  
  // Deterministic areas based on gaps
  const areasAhead = [];
  const areasBehind = [];
  
  // Analyze gaps to determine strengths and weaknesses
  const gapCategories: Record<string, number[]> = {};
  gaps.forEach((gap: any) => {
    const category = gap.requirement_reference?.split('.')[0] || 'General';
    if (!gapCategories[category]) {
      gapCategories[category] = [];
    }
    gapCategories[category].push(gap.risk_score || 50);
  });

  // Areas with fewer/lower gaps are strengths
  const categoryScores = Object.entries(gapCategories).map(([cat, scores]) => ({
    category: cat,
    avgScore: scores.reduce((a, b) => a + b, 0) / scores.length,
    count: scores.length
  }));

  // If no gaps, use compliance score as indicator
  if (categoryScores.length === 0) {
    if (complianceScore >= sectorAvg) {
      areasAhead.push({
        area: "Conformità Generale",
        your_score: complianceScore,
        market_average: Math.round(sectorAvg),
        percentile: Math.min(95, percentile + 10),
        competitive_advantage: "Livello di conformità superiore alla media di settore"
      });
    }
    if (complianceScore < sectorAvg + 10) {
      areasBehind.push({
        area: "Monitoraggio Continuo",
        your_score: Math.max(0, complianceScore - 15),
        market_average: Math.round(sectorAvg + 10),
        gap_percentage: Math.round(sectorAvg + 10 - complianceScore + 15),
        market_adoption_rate: 65,
        competitive_risk: "Possibile ritardo nel rilevare non conformità",
        urgency: complianceScore < 50 ? "high" : "medium"
      });
    }
  } else {
    // Use actual gap data
    categoryScores.sort((a, b) => a.avgScore - b.avgScore);
    
    // Best areas (lowest gap scores) are strengths
    const strengths = categoryScores.slice(0, 2);
    strengths.forEach(s => {
      areasAhead.push({
        area: mapCategoryToArea(s.category),
        your_score: Math.round(100 - s.avgScore),
        market_average: Math.round(sectorAvg),
        percentile: Math.min(95, percentile + Math.round((100 - s.avgScore - sectorAvg) / 2)),
        competitive_advantage: `${s.count} gap identificati in quest'area - sotto la media`
      });
    });
    
    // Worst areas (highest gap scores) are weaknesses
    const weaknesses = categoryScores.slice(-2).reverse();
    weaknesses.forEach(w => {
      areasBehind.push({
        area: mapCategoryToArea(w.category),
        your_score: Math.round(100 - w.avgScore),
        market_average: Math.round(sectorAvg + 15),
        gap_percentage: Math.round(w.avgScore),
        market_adoption_rate: 70,
        competitive_risk: `${w.count} gap critici identificati in quest'area`,
        urgency: w.avgScore > 70 ? "high" : w.avgScore > 50 ? "medium" : "low"
      });
    });
  }
  
  return {
    sector_position_percentile: percentile,
    areas_ahead_of_market: areasAhead.length > 0 ? areasAhead : [{
      area: "Gestione Documentale",
      your_score: complianceScore,
      market_average: Math.round(sectorAvg - 5),
      percentile: percentile,
      competitive_advantage: "Documentazione strutturata e tracciabile"
    }],
    areas_behind_market: areasBehind.length > 0 ? areasBehind : [{
      area: "Automazione Compliance",
      your_score: Math.max(0, complianceScore - 20),
      market_average: Math.round(sectorAvg + 10),
      gap_percentage: 20,
      market_adoption_rate: 60,
      competitive_risk: "Processi manuali rallentano la risposta a nuovi requisiti",
      urgency: "medium"
    }],
    competitive_insights: [
      {
        insight: "Il settore sta accelerando sull'automazione della compliance",
        evidence: "Trend consolidato: le aziende leader investono in tool automatizzati per ridurre tempi e costi di conformità",
        strategic_implication: "Investire in automazione per mantenere competitività",
        priority: "high",
        source_url: "https://www.enisa.europa.eu/publications",
        source_title: "ENISA Cybersecurity Reports"
      },
      {
        insight: "Le sanzioni per non conformità sono in aumento",
        evidence: "Trend europeo: maggiore enforcement da parte delle autorità di controllo",
        strategic_implication: "Priorità immediata al miglioramento della conformità",
        priority: "high",
        source_url: "https://www.enforcementtracker.com/",
        source_title: "GDPR Enforcement Tracker"
      }
    ],
    quick_wins: [
      {
        action: "Implementare checklist automatizzate per audit periodici",
        market_adoption: 72,
        percentile_impact: 8,
        estimated_impact: "Riduzione 40% tempo audit",
        effort: "low",
        timeline: "2-4 settimane",
        why_quick_win: "Alta adozione di mercato, implementazione rapida con benefici immediati",
        source_url: "https://www.garanteprivacy.it/",
        source_title: "Garante Privacy - Best Practices"
      },
      {
        action: "Documentare formalmente le procedure di risposta agli incidenti",
        market_adoption: 68,
        percentile_impact: 6,
        estimated_impact: "Miglioramento conformità NIS2/GDPR",
        effort: "medium",
        timeline: "4-6 settimane",
        why_quick_win: "Requisito esplicito NIS2, documentazione già parzialmente disponibile",
        source_url: "https://www.acn.gov.it/",
        source_title: "ACN - Agenzia Cybersicurezza Nazionale"
      }
    ],
    data_quality: {
      has_real_benchmark_data: hasBenchmarkData,
      has_market_intelligence: false,
      confidence_level: hasBenchmarkData ? 'medium' : 'low',
      data_sources_count: benchmarks?.length || 0
    }
  };
}

function mapCategoryToArea(category: string): string {
  const mapping: Record<string, string> = {
    'Art': 'Requisiti Normativi',
    'GDPR': 'Protezione Dati',
    'NIS2': 'Sicurezza Reti e Sistemi',
    'CRA': 'Cyber Resilience',
    'DORA': 'Resilienza Operativa Digitale',
    'AI': 'Intelligenza Artificiale',
    'General': 'Conformità Generale'
  };
  return mapping[category] || category;
}

function buildBenchmarkPrompt(
  assessment: any, 
  benchmarks: any[], 
  gaps: any[], 
  language: string = 'IT', 
  marketIntelligence: string = '', 
  marketSources: Array<{ title: string; url: string }> = [],
  calculatedPercentile: number,
  sectorAverage: number,
  hasBenchmarkData: boolean
) {
  const isItalian = language === 'IT';
  
  const benchmarkSummary = benchmarks.slice(0, 5).map(b => `
${b.requirement_reference}: adoption ${b.adoption_percentage}%, avg score ${b.average_compliance_score}/100
`).join('');

  const gapsSummary = gaps.slice(0, 10).map((g: any) => `
${g.requirement_reference}: ${g.gap_description?.substring(0, 100)} [risk_score: ${g.risk_score}]
`).join('');

  const sourcesSection = marketSources.length > 0 ? `
VERIFIED SOURCES (use these URLs for source_url fields):
${marketSources.slice(0, 8).map((s, i) => `[${i + 1}] "${s.title}" - ${s.url}`).join('\n')}

CRITICAL: For each competitive_insight and quick_win, you MUST use one of these verified source URLs.
` : `
Use these authoritative sources for citations:
- GDPR Enforcement Tracker: https://www.enforcementtracker.com/
- ENISA Reports: https://www.enisa.europa.eu/publications
- Garante Privacy: https://www.garanteprivacy.it/
- ACN Italia: https://www.acn.gov.it/
- PwC Global Survey: https://www.pwc.com/gx/en/issues/cybersecurity.html
`;

  return `
${isItalian ? 'Rispondi in ITALIANO.' : 'Respond in ENGLISH.'}

CRITICAL CONSISTENCY RULES:
1. The sector_position_percentile MUST be exactly: ${calculatedPercentile}
2. Use ONLY the data provided below - do NOT invent additional statistics
3. Base all scores on the actual compliance percentage and gap data provided
4. Be consistent: same input = same output

ORGANIZATION DATA:
- Sector: ${assessment.scope_sector}
- Jurisdiction: ${assessment.scope_jurisdiction}
- Compliance Score: ${assessment.overall_compliance_percentage || 50}%
- Risk Score: ${assessment.overall_risk_score || 50}/100
- Calculated Percentile: ${calculatedPercentile} (USE THIS EXACT VALUE)
- Sector Average: ${Math.round(sectorAverage)}%
- Has Real Benchmark Data: ${hasBenchmarkData}

${hasBenchmarkData ? `SECTOR BENCHMARK DATA:
${benchmarkSummary}` : 'NO BENCHMARK DATA AVAILABLE - use conservative estimates based on compliance score only'}

${marketIntelligence ? `VERIFIED MARKET INTELLIGENCE:
${marketIntelligence.substring(0, 1500)}` : 'NO MARKET INTELLIGENCE AVAILABLE'}
${sourcesSection}

IDENTIFIED GAPS (${gaps.length} total):
${gapsSummary || 'No specific gaps identified'}

Generate benchmark analysis with:
1. sector_position_percentile: MUST BE ${calculatedPercentile}
2. areas_ahead_of_market (2-3 based on actual gaps with LOW risk scores)
3. areas_behind_market (2-3 based on actual gaps with HIGH risk scores, include urgency)
4. competitive_insights (2-3 insights) - MUST include verified source_url and source_title
5. quick_wins (2-3 actionable items) - MUST include verified source_url and source_title
6. data_quality object indicating confidence level

CRITICAL REQUIREMENTS:
- Every source_url must be a valid full URL starting with https://
- Do NOT invent percentages not present in the input data
- Base areas_ahead/behind on actual gap risk_scores provided
- confidence_level should be '${hasBenchmarkData && marketIntelligence ? 'high' : hasBenchmarkData || marketIntelligence ? 'medium' : 'low'}'
`;
}

function calculateSectorAverage(benchmarks: any[]): number {
  if (benchmarks.length === 0) return 50; // Default when no data
  const validScores = benchmarks.filter(b => b.average_compliance_score != null);
  if (validScores.length === 0) return 50;
  const sum = validScores.reduce((acc, b) => acc + b.average_compliance_score, 0);
  return sum / validScores.length;
}
