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
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      {
        global: {
          headers: { Authorization: req.headers.get('Authorization')! },
        },
      }
    );

    const { data: { user }, error: authError } = await supabaseClient.auth.getUser();
    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { modelId, datasetInfo } = await req.json();

    if (!modelId) {
      return new Response(JSON.stringify({ error: 'Missing modelId' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Perform AI-powered dataset analysis
    const analysisPrompt = buildDatasetAnalysisPrompt(datasetInfo);
    
    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) {
      throw new Error('LOVABLE_API_KEY not configured');
    }

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
            content: 'You are a data science security expert specializing in detecting data poisoning, bias, and quality issues in ML training datasets.'
          },
          {
            role: 'user',
            content: analysisPrompt
          }
        ],
      }),
    });

    if (!aiResponse.ok) {
      if (aiResponse.status === 429) {
        return new Response(JSON.stringify({ error: 'Rate limit exceeded' }), {
          status: 429,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      throw new Error('AI analysis failed');
    }

    const aiData = await aiResponse.json();
    const analysisResult = aiData.choices[0].message.content;

    // Parse and calculate metrics
    const poisoningIndicators = extractPoisoningIndicators(analysisResult);
    const anomalyScore = calculateAnomalyScore(poisoningIndicators);
    const qualityMetrics = calculateQualityMetrics(datasetInfo, analysisResult);

    // Store analysis results
    const { data: analysis, error: analysisError } = await supabaseClient
      .from('dataset_analyses')
      .insert({
        model_id: modelId,
        dataset_name: datasetInfo.name || 'Training Dataset',
        record_count: datasetInfo.recordCount || 0,
        anomaly_score: anomalyScore,
        poisoning_indicators: poisoningIndicators,
        statistical_checks: {
          distribution_normality: extractMetric(analysisResult, 'normality'),
          class_balance: extractMetric(analysisResult, 'balance'),
          outlier_percentage: extractMetric(analysisResult, 'outliers'),
          correlation_matrix_rank: extractMetric(analysisResult, 'correlation'),
        },
        quality_metrics: qualityMetrics,
      })
      .select()
      .single();

    if (analysisError) throw analysisError;

    return new Response(
      JSON.stringify({
        success: true,
        analysis,
        anomalyScore,
        riskLevel: anomalyScore > 70 ? 'high' : anomalyScore > 40 ? 'medium' : 'low'
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );

  } catch (error) {
    console.error('Dataset analysis error:', error);
    return new Response(
      JSON.stringify({ error: 'Analysis failed', code: 'DATASET_ANALYSIS_ERROR' }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});

function buildDatasetAnalysisPrompt(datasetInfo: any): string {
  return `
Analyze this ML training dataset for security and quality issues:

Dataset Information:
- Name: ${datasetInfo.name || 'Unknown'}
- Records: ${datasetInfo.recordCount || 'Unknown'}
- Features: ${datasetInfo.featureCount || 'Unknown'}
- Classes: ${datasetInfo.classCount || 'Unknown'}
${datasetInfo.description ? `- Description: ${datasetInfo.description}` : ''}

**Security Analysis Required:**

1. **Data Poisoning Detection:**
   - Outlier detection using IQR and Z-score methods
   - Mislabeling patterns (label flipping attacks)
   - Backdoor trigger patterns in features
   - Clean-label poisoning indicators

2. **Bias Analysis:**
   - Protected attribute correlations
   - Class distribution imbalance
   - Demographic parity violations
   - Equal opportunity differences

3. **Quality Metrics:**
   - Missing value percentages
   - Duplicate record detection
   - Feature correlation analysis
   - Data type consistency

4. **Statistical Tests:**
   - Distribution normality (Shapiro-Wilk test)
   - Homogeneity of variance (Levene's test)
   - Feature importance skewness
   - Inter-class separability (Fisher's discriminant)

Provide detailed findings with numerical metrics where possible.

Format your response as:
INDICATOR: [Specific issue]
SEVERITY: [HIGH/MEDIUM/LOW]
METRIC: [Numerical value]
DESCRIPTION: [Technical details]
---`;
}

function extractPoisoningIndicators(analysisText: string): any[] {
  const indicators: any[] = [];
  const sections = analysisText.split('---').filter(s => s.trim());

  for (const section of sections) {
    const lines = section.trim().split('\n');
    const indicator: any = {};

    for (const line of lines) {
      const [key, ...valueParts] = line.split(':');
      const value = valueParts.join(':').trim();

      if (key.includes('INDICATOR')) indicator.type = value;
      else if (key.includes('SEVERITY')) indicator.severity = value.toLowerCase();
      else if (key.includes('METRIC')) indicator.metric = value;
      else if (key.includes('DESCRIPTION')) indicator.description = value;
    }

    if (indicator.type) {
      indicators.push(indicator);
    }
  }

  return indicators;
}

function calculateAnomalyScore(indicators: any[]): number {
  if (indicators.length === 0) return 0;

  const severityWeights = {
    high: 30,
    medium: 15,
    low: 5,
  };

  let score = 0;
  for (const indicator of indicators) {
    const severity = indicator.severity || 'low';
    score += severityWeights[severity as keyof typeof severityWeights] || 5;
  }

  return Math.min(100, score);
}

function calculateQualityMetrics(datasetInfo: any, analysisText: string): any {
  return {
    completeness: 100 - (parseFloat(extractMetric(analysisText, 'missing')) || 0),
    consistency: 100 - (parseFloat(extractMetric(analysisText, 'duplicate')) || 0),
    accuracy: parseFloat(extractMetric(analysisText, 'accuracy')) || 95,
    timeliness: datasetInfo.lastUpdated ? 100 : 80,
    overall_quality_score: 0, // Will be calculated as average
  };
}

function extractMetric(text: string, metricName: string): string {
  const regex = new RegExp(`${metricName}[:\\s]+([0-9.]+)`, 'i');
  const match = text.match(regex);
  return match ? match[1] : '0';
}
