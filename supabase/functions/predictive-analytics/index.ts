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
    const lovableApiKey = Deno.env.get('LOVABLE_API_KEY')!;
    
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

    console.log('Fetching compliance data for predictive analytics...');

    // Recupera tutti gli assessment dell'utente
    const { data: assessments, error: assessError } = await supabase
      .from('compliance_assessments')
      .select(`
        id,
        title,
        created_at,
        overall_risk_score,
        overall_compliance_percentage,
        scope_regulations,
        scope_sector,
        scope_jurisdiction
      `)
      .eq('user_id', user.id)
      .order('created_at', { ascending: true });

    if (assessError) throw assessError;

    // Se non ci sono assessment, restituisci errore con indicazione chiara
    if (!assessments || assessments.length === 0) {
      console.log('No assessments found, returning insufficient data error');
      return new Response(JSON.stringify({ 
        error: 'insufficient_data',
        message: 'Nessun assessment trovato. Crea almeno 3 assessment di compliance per generare l\'analisi predittiva.',
        required: 3,
        current: 0
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Recupera tutti i gap
    const { data: gaps, error: gapsError } = await supabase
      .from('identified_gaps')
      .select(`
        id,
        assessment_id,
        risk_level,
        risk_score,
        potential_fine_eur,
        requirement_reference,
        created_at,
        status
      `)
      .in('assessment_id', assessments.map(a => a.id));

    if (gapsError) throw gapsError;

    // Recupera benchmark di settore
    const { data: benchmarks } = await supabase
      .from('sector_benchmarks')
      .select('*')
      .limit(50);

    console.log(`Analyzing ${assessments.length} assessments and ${gaps?.length || 0} gaps`);

    // Se ci sono meno di 3 assessment, restituisci errore
    if (assessments.length < 3) {
      console.log(`Only ${assessments.length} assessments found, need at least 3`);
      return new Response(JSON.stringify({ 
        error: 'insufficient_data',
        message: `Hai solo ${assessments.length} assessment. Crea almeno 3 assessment di compliance per generare l'analisi predittiva con dati accurati.`,
        required: 3,
        current: assessments.length
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Analisi AI completa con dati reali
    const systemPrompt = `You are an elite AI predictive compliance analytics system. 
Generate realistic, actionable ML-powered insights based on the provided compliance data.
Return ONLY valid JSON (no markdown, no code blocks).`;

    const analysisPrompt = `Analyze this compliance data and generate predictive insights:

ASSESSMENTS (${assessments.length}):
${JSON.stringify(assessments, null, 2)}

GAPS (${gaps?.length || 0}):
${JSON.stringify(gaps, null, 2)}

BENCHMARKS:
${JSON.stringify(benchmarks?.slice(0, 10), null, 2)}

Return JSON with this exact structure:
{
  "riskTrend": {
    "currentScore": <number 0-100>,
    "prediction3Months": <number>,
    "prediction6Months": <number>,
    "prediction12Months": <number>,
    "trend": "increasing|stable|decreasing",
    "confidence": <number 0-100>,
    "influencingFactors": [{"factor": "string", "impact": "high|medium|low", "description": "string"}]
  },
  "sanctionProbability": {
    "overall": <number 0-100>,
    "byRegulation": [{"regulation": "string", "probability": <number>, "severity": "critical|high|medium|low"}],
    "keyRiskFactors": ["string"]
  },
  "financialImpact": {
    "potentialFines": {"minimum": <number>, "expected": <number>, "maximum": <number>},
    "byCriticalGap": [{"gap": "string", "estimatedFine": <number>, "probability": <number>}],
    "remediationROI": {"investmentNeeded": <number>, "finesAvoided": <number>, "roi": <number>},
    "timeline": "string"
  },
  "complianceTrajectory": {
    "currentCompliance": <number>,
    "projectedCompliance": [{"timeframe": "string", "score": <number>, "scenario": "optimistic|realistic|pessimistic"}],
    "quickWins": [{"action": "string", "impact": <number>, "effort": "low|medium|high"}],
    "longTermInvestments": ["string"],
    "emergingGaps": ["string"]
  },
  "comparativeAnalysis": {
    "sectorPercentile": <number>,
    "improvementVelocity": "faster|average|slower",
    "areasOfExcellence": ["string"],
    "criticalAreas": ["string"]
  }
}`;

    const aiResponse = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${lovableApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        temperature: 0.1, // Bassa temperatura per risultati consistenti
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: analysisPrompt }
        ]
      }),
    });

    if (!aiResponse.ok) {
      throw new Error(`AI API error: ${aiResponse.status}`);
    }

    const aiData = await aiResponse.json();
    let predictiveAnalysis = aiData.choices[0].message.content;

    // Parse JSON
    if (predictiveAnalysis.includes('```json')) {
      predictiveAnalysis = predictiveAnalysis.split('```json')[1].split('```')[0].trim();
    } else if (predictiveAnalysis.includes('```')) {
      predictiveAnalysis = predictiveAnalysis.split('```')[1].split('```')[0].trim();
    }

    const analysis = JSON.parse(predictiveAnalysis);

    const result = {
      ...analysis,
      metadata: {
        generatedAt: new Date().toISOString(),
        assessmentsAnalyzed: assessments.length,
        gapsAnalyzed: gaps?.length || 0,
        dataQuality: 'high'
      }
    };

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error: any) {
    console.error('Error in predictive-analytics:', error);
    return new Response(
      JSON.stringify({ 
        error: error.message,
        details: 'Errore durante l\'analisi predittiva'
      }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});

function generateDemoAnalysis(user: any) {
  const demoData = {
    riskTrend: {
      currentScore: 65,
      prediction3Months: 58,
      prediction6Months: 52,
      prediction12Months: 45,
      trend: "decreasing",
      confidence: 75,
      influencingFactors: [
        {
          factor: "Implementazione progressiva controlli GDPR",
          impact: "high",
          description: "Riduzione rischio del 15% prevista con completamento misure tecniche"
        },
        {
          factor: "Aggiornamento policy di sicurezza",
          impact: "medium",
          description: "Miglioramento compliance NIS2 del 10%"
        },
        {
          factor: "Formazione staff su privacy",
          impact: "medium",
          description: "Riduzione incidenti umani stimata 8%"
        }
      ]
    },
    sanctionProbability: {
      overall: 35,
      byRegulation: [
        { regulation: "GDPR", probability: 28, severity: "high" },
        { regulation: "NIS2", probability: 42, severity: "critical" },
        { regulation: "CRA", probability: 15, severity: "medium" }
      ],
      keyRiskFactors: [
        "Assenza DPIA per trattamenti ad alto rischio",
        "Gap nei log di sicurezza per incidenti cyber",
        "Documentazione vulnerabilità prodotti incompleta"
      ]
    },
    financialImpact: {
      potentialFines: {
        minimum: 50000,
        expected: 285000,
        maximum: 850000
      },
      byCriticalGap: [
        { gap: "Mancanza DPIA", estimatedFine: 120000, probability: 65 },
        { gap: "Incident reporting NIS2", estimatedFine: 95000, probability: 48 },
        { gap: "Gestione vulnerabilità CRA", estimatedFine: 70000, probability: 32 }
      ],
      remediationROI: {
        investmentNeeded: 85000,
        finesAvoided: 285000,
        roi: 235
      },
      timeline: "12-18 mesi per compliance completa"
    },
    complianceTrajectory: {
      currentCompliance: 58,
      projectedCompliance: [
        { timeframe: "3 mesi", score: 68, scenario: "optimistic" },
        { timeframe: "3 mesi", score: 64, scenario: "realistic" },
        { timeframe: "3 mesi", score: 60, scenario: "pessimistic" },
        { timeframe: "6 mesi", score: 78, scenario: "optimistic" },
        { timeframe: "6 mesi", score: 72, scenario: "realistic" },
        { timeframe: "6 mesi", score: 65, scenario: "pessimistic" },
        { timeframe: "12 mesi", score: 92, scenario: "optimistic" },
        { timeframe: "12 mesi", score: 85, scenario: "realistic" },
        { timeframe: "12 mesi", score: 75, scenario: "pessimistic" }
      ],
      quickWins: [
        { action: "Nomina DPO e pubblicazione contatti", impact: 8, effort: "low" },
        { action: "Template DPIA per trattamenti comuni", impact: 12, effort: "low" },
        { action: "Configurazione log centralizzato incidenti", impact: 10, effort: "medium" }
      ],
      longTermInvestments: [
        "Sistema SIEM completo per NIS2",
        "Piattaforma gestione vulnerabilità automatizzata",
        "Certificazione ISO 27001"
      ],
      emergingGaps: [
        "AI Act: trasparenza algoritmi (entrata vigore 2025)",
        "NIS2: reporting 24h incidenti significativi",
        "CRA: Bill of Materials (SBOM) prodotti software"
      ]
    },
    comparativeAnalysis: {
      sectorPercentile: 42,
      improvementVelocity: "average",
      areasOfExcellence: [
        "Crittografia dati in transito e a riposo",
        "Backup e disaster recovery"
      ],
      criticalAreas: [
        "Gestione incidenti e response plan",
        "Audit regolari e penetration testing",
        "Supply chain security assessment"
      ]
    },
    metadata: {
      generatedAt: new Date().toISOString(),
      assessmentsAnalyzed: 0,
      gapsAnalyzed: 0,
      dataQuality: 'demo',
      recommendedActions: 'Crea almeno 3 assessment di compliance per ottenere analisi personalizzate basate sui tuoi dati reali. Questa è un\'analisi dimostrativa con dati esempio.'
    }
  };

  return new Response(JSON.stringify(demoData), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

function generateEnhancedDemoAnalysis(user: any, assessments: any[], gaps: any[] | null) {
  // Calcola metriche reali basate sui dati effettivi
  const avgRisk = assessments.reduce((sum, a) => sum + (a.overall_risk_score || 50), 0) / assessments.length;
  const avgCompliance = assessments.reduce((sum, a) => sum + (a.overall_compliance_percentage || 60), 0) / assessments.length;
  const gapCount = gaps?.length || 0;
  
  // Conteggio gap per livello di rischio
  const highRiskGaps = gaps?.filter(g => g.risk_level === 'high' || g.risk_level === 'critical').length || 0;
  const mediumRiskGaps = gaps?.filter(g => g.risk_level === 'medium').length || 0;
  const lowRiskGaps = gaps?.filter(g => g.risk_level === 'low').length || 0;
  
  // Calcolo multe potenziali reali dai gap
  const totalPotentialFines = gaps?.reduce((sum, g) => sum + (g.potential_fine_eur || 0), 0) || 0;
  const avgGapRiskScore = gaps && gaps.length > 0 
    ? gaps.reduce((sum, g) => sum + (g.risk_score || 50), 0) / gaps.length 
    : 50;

  // Calcoli deterministici basati su dati reali
  const sanctionProbability = Math.min(85, Math.max(10, 
    Math.round((avgGapRiskScore * 0.4) + (highRiskGaps * 5) + (mediumRiskGaps * 2))
  ));
  
  const sectorPercentile = Math.min(95, Math.max(5, 
    Math.round(avgCompliance * 0.85 + (assessments.length * 2))
  ));

  // Calcolo probabilità per regolamento basato sui gap effettivi
  const regulationProbabilities = assessments[0]?.scope_regulations?.map((reg: string) => {
    const regGaps = gaps?.filter(g => 
      g.requirement_reference?.toLowerCase().includes(reg.toLowerCase())
    ).length || 0;
    
    const baseProbability = Math.min(80, Math.round(20 + (regGaps * 8) + (avgRisk * 0.3)));
    const severity = baseProbability > 60 ? "critical" : baseProbability > 40 ? "high" : "medium";
    
    return { regulation: reg, probability: baseProbability, severity };
  }) || [
    { regulation: "GDPR", probability: Math.round(30 + avgRisk * 0.3), severity: avgRisk > 60 ? "high" : "medium" },
    { regulation: "NIS2", probability: Math.round(35 + avgRisk * 0.35), severity: avgRisk > 55 ? "critical" : "high" }
  ];

  const byCriticalGap = gaps?.filter(g => g.risk_level === 'high' || g.risk_level === 'critical')
    .slice(0, 5)
    .map(g => ({
      gap: g.requirement_reference || 'Gap non specificato',
      estimatedFine: g.potential_fine_eur || Math.round(g.risk_score * 1500),
      probability: Math.min(85, Math.round(g.risk_score * 0.8 + 10))
    })) || [];

  const demoData = {
    riskTrend: {
      currentScore: Math.round(avgRisk),
      prediction3Months: Math.max(0, Math.round(avgRisk * 0.92)),
      prediction6Months: Math.max(0, Math.round(avgRisk * 0.85)),
      prediction12Months: Math.max(0, Math.round(avgRisk * 0.72)),
      trend: avgRisk > 50 ? "decreasing" : "stable",
      confidence: Math.min(80, 30 + (assessments.length * 15) + (gapCount * 2)),
      influencingFactors: [
        {
          factor: "Assessment completati",
          impact: assessments.length >= 2 ? "high" : "medium",
          description: `${assessments.length} assessment analizzati con ${gapCount} gap identificati`
        },
        {
          factor: "Gap ad alto rischio",
          impact: highRiskGaps > 3 ? "high" : highRiskGaps > 0 ? "medium" : "low",
          description: `${highRiskGaps} gap critici/alti, ${mediumRiskGaps} medi, ${lowRiskGaps} bassi`
        },
        {
          factor: "Esposizione finanziaria",
          impact: totalPotentialFines > 200000 ? "high" : totalPotentialFines > 50000 ? "medium" : "low",
          description: `Sanzioni potenziali totali: €${totalPotentialFines.toLocaleString()}`
        }
      ]
    },
    sanctionProbability: {
      overall: sanctionProbability,
      byRegulation: regulationProbabilities,
      keyRiskFactors: [
        `${highRiskGaps} gap ad alto rischio da risolvere prioritariamente`,
        `Score rischio medio: ${Math.round(avgGapRiskScore)}/100`,
        `Compliance attuale: ${Math.round(avgCompliance)}%`
      ]
    },
    financialImpact: {
      potentialFines: {
        minimum: totalPotentialFines > 0 ? Math.round(totalPotentialFines * 0.3) : Math.round(gapCount * 5000),
        expected: totalPotentialFines > 0 ? Math.round(totalPotentialFines * 0.6) : Math.round(gapCount * 15000),
        maximum: totalPotentialFines > 0 ? totalPotentialFines : Math.round(gapCount * 40000)
      },
      byCriticalGap,
      remediationROI: {
        investmentNeeded: Math.round(gapCount * 6000 + highRiskGaps * 8000),
        finesAvoided: totalPotentialFines > 0 ? Math.round(totalPotentialFines * 0.6) : Math.round(gapCount * 15000),
        roi: totalPotentialFines > 0 
          ? Math.round(((totalPotentialFines * 0.6) / (gapCount * 6000 + highRiskGaps * 8000 || 1)) * 100)
          : 180
      },
      timeline: highRiskGaps > 5 ? "18-24 mesi" : gapCount > 10 ? "12-18 mesi" : "6-12 mesi"
    },
    complianceTrajectory: {
      currentCompliance: Math.round(avgCompliance),
      projectedCompliance: [
        { timeframe: "3 mesi", score: Math.min(100, Math.round(avgCompliance + 6)), scenario: "optimistic" },
        { timeframe: "3 mesi", score: Math.min(100, Math.round(avgCompliance + 3)), scenario: "realistic" },
        { timeframe: "3 mesi", score: Math.min(100, Math.round(avgCompliance + 1)), scenario: "pessimistic" },
        { timeframe: "6 mesi", score: Math.min(100, Math.round(avgCompliance + 12)), scenario: "optimistic" },
        { timeframe: "6 mesi", score: Math.min(100, Math.round(avgCompliance + 7)), scenario: "realistic" },
        { timeframe: "6 mesi", score: Math.min(100, Math.round(avgCompliance + 3)), scenario: "pessimistic" },
        { timeframe: "12 mesi", score: Math.min(100, Math.round(avgCompliance + 25)), scenario: "optimistic" },
        { timeframe: "12 mesi", score: Math.min(100, Math.round(avgCompliance + 15)), scenario: "realistic" },
        { timeframe: "12 mesi", score: Math.min(100, Math.round(avgCompliance + 8)), scenario: "pessimistic" }
      ],
      quickWins: [
        { action: "Risolvere gap a basso effort", impact: Math.min(20, lowRiskGaps * 3), effort: "low" },
        { action: "Documentazione policy mancanti", impact: 8, effort: "low" },
        { action: "Review gap medio rischio", impact: Math.min(15, mediumRiskGaps * 2), effort: "medium" }
      ],
      longTermInvestments: [
        "Remediation gap ad alto rischio",
        "Automazione compliance monitoring",
        "Formazione e certificazioni team"
      ],
      emergingGaps: [
        "Aggiornamenti normativi 2025 (AI Act, CRA)",
        "Evoluzione requisiti NIS2",
        "Nuovi standard cybersecurity"
      ]
    },
    comparativeAnalysis: {
      sectorPercentile,
      improvementVelocity: assessments.length >= 2 ? "faster" : "average",
      areasOfExcellence: avgCompliance > 70 
        ? ["Compliance superiore alla media", "Gestione gap proattiva"]
        : ["Identificazione sistematica gap", "Approccio strutturato assessment"],
      criticalAreas: [
        highRiskGaps > 0 ? `${highRiskGaps} gap critici da risolvere` : "Mantenere monitoraggio continuo",
        assessments.length < 3 ? "Completare più assessment per analisi accurate" : "Approfondire aree a rischio",
        "Benchmark competitivo settoriale"
      ]
    },
    metadata: {
      generatedAt: new Date().toISOString(),
      assessmentsAnalyzed: assessments.length,
      gapsAnalyzed: gapCount,
      dataQuality: assessments.length >= 2 ? 'medium' : 'low',
      dataSource: 'calculated_from_real_data',
      calculationMethod: 'deterministic_analysis',
      recommendedActions: assessments.length < 3 
        ? `Hai ${assessments.length} assessment. Creane almeno ${3 - assessments.length} in più per analisi ML più accurate.` 
        : null,
      disclaimer: 'Analisi basata sui dati reali degli assessment. Per risultati ottimali, inserire almeno 3 assessment completi.'
    }
  };

  return new Response(JSON.stringify(demoData), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}
