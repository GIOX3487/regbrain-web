import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { useToast } from "@/hooks/use-toast";

import {
  TrendingUp,
  TrendingDown,
  AlertTriangle,
  DollarSign,
  Target,
  ArrowLeft,
  RefreshCw,
  Activity,
  BarChart3,
  Shield
} from "lucide-react";
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Radar
} from "recharts";

interface PredictiveData {
  riskTrend?: {
    currentScore: number;
    prediction3Months: number;
    prediction6Months: number;
    prediction12Months: number;
    trend: string;
    confidence: number;
    influencingFactors: Array<{
      factor: string;
      impact: string;
      description: string;
    }>;
  };
  sanctionProbability?: {
    overall: number;
    byRegulation: Array<{ 
      regulation: string; 
      probability: number;
      severity: string;
    }>;
    keyRiskFactors: string[];
  };
  financialImpact?: {
    potentialFines: { minimum: number; expected: number; maximum: number };
    byCriticalGap: Array<{ gap: string; estimatedFine: number; probability: number }>;
    remediationROI: { investmentNeeded: number; finesAvoided: number; roi: number };
    timeline: string;
  };
  complianceTrajectory?: {
    currentCompliance: number;
    projectedCompliance: Array<{
      timeframe: string;
      score: number;
      scenario: string;
    }>;
    quickWins: Array<{ action: string; impact: number; effort: string }>;
    longTermInvestments: string[];
    emergingGaps: string[];
  };
  comparativeAnalysis?: {
    sectorPercentile: number;
    improvementVelocity: string;
    areasOfExcellence: string[];
    criticalAreas: string[];
  };
  metadata?: {
    generatedAt: string;
    assessmentsAnalyzed: number;
    gapsAnalyzed: number;
    dataQuality: string;
    recommendedActions?: string;
  };
}

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884D8'];

export default function PredictiveAnalytics() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<PredictiveData | null>(null);
  const [insufficientData, setInsufficientData] = useState<{ message: string; current: number; required: number } | null>(null);

  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    checkAuth();
  }, []);

  const checkAuth = async () => {
    setChecking(true);
    const { data: { session } } = await supabase.auth.getSession();
    
    if (!session) {
      // Salva dove l'utente voleva andare
      sessionStorage.setItem('auth_redirect', '/compliance/predictive');
      toast({
        title: "Accesso richiesto",
        description: "Effettua l'accesso per utilizzare l'analisi predittiva",
      });
      navigate('/auth');
      return;
    }
    
    setIsAuthenticated(true);
    setChecking(false);
  };

  const runAnalysis = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      sessionStorage.setItem('auth_redirect', '/compliance/predictive');
      navigate('/auth');
      return;
    }

    setLoading(true);
    setInsufficientData(null);
    
    try {
      const { data: result, error } = await supabase.functions.invoke('predictive-analytics', {
        headers: {
          Authorization: `Bearer ${session.access_token}`
        }
      });

      // Gestisci errore di dati insufficienti (può essere in result o in error.context)
      if (result?.error === 'insufficient_data') {
        setInsufficientData({
          message: result.message,
          current: result.current,
          required: result.required
        });
        return;
      }

      // In caso di errore HTTP, Supabase mette il body in error.context
      if (error) {
        // Prova a parsare il messaggio di errore per dati insufficienti
        try {
          const errorBody = typeof error.context === 'string' 
            ? JSON.parse(error.context) 
            : error.context;
          
          if (errorBody?.error === 'insufficient_data') {
            setInsufficientData({
              message: errorBody.message,
              current: errorBody.current,
              required: errorBody.required
            });
            return;
          }
        } catch {
          // Se non riesce a parsare, prosegui con l'errore normale
        }
        throw error;
      }

      setData(result);
      toast({
        title: "Analisi completata",
        description: "Previsioni di rischio generate con successo",
      });
    } catch (error: any) {
      console.error('Error running analysis:', error);
      
      // Ultimo tentativo: controlla se l'errore contiene info sui dati insufficienti
      const errorMessage = error?.message || '';
      if (errorMessage.includes('insufficient_data') || errorMessage.includes('assessment')) {
        setInsufficientData({
          message: 'Crea almeno 3 assessment per generare l\'analisi predittiva.',
          current: 0,
          required: 3
        });
        return;
      }
      
      toast({
        title: "Errore",
        description: error.message || "Impossibile generare l'analisi predittiva",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const getRiskColor = (score: number) => {
    if (score >= 75) return "text-red-500";
    if (score >= 50) return "text-orange-500";
    if (score >= 25) return "text-yellow-500";
    return "text-green-500";
  };

  const getTrendIcon = (trend: string) => {
    if (trend?.toLowerCase().includes('aumento') || trend?.toLowerCase().includes('increasing')) {
      return <TrendingUp className="h-5 w-5 text-red-500" />;
    }
    return <TrendingDown className="h-5 w-5 text-green-500" />;
  };

  if (checking) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return null; // Already redirecting to /auth
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto py-8 px-4">
        {/* Header */}
        <div className="mb-8">
          <Button 
            variant="ghost" 
            onClick={() => navigate('/compliance')}
            className="mb-4"
          >
            <ArrowLeft className="mr-2 h-4 w-4" />
            Torna al Compliance Hub
          </Button>
          <h1 className="text-4xl font-bold mb-2 flex items-center gap-3">
            <Activity className="h-10 w-10 text-primary" />
            Predictive Risk Analytics
          </h1>
          <p className="text-muted-foreground">
            Previsioni ML • Analisi Trend • Stima Sanzioni • ROI Compliance
          </p>
        </div>

        {!data && !loading && (
          <div className="space-y-6">
            {/* Explanation Banner */}
            <Card className="bg-primary/5 border-primary/20">
              <CardContent className="py-4">
                <div className="flex items-start gap-3">
                  <Target className="h-5 w-5 text-primary mt-0.5 shrink-0" />
                  <div className="space-y-2">
                    <h4 className="font-semibold text-sm">Cos'è la Predictive Analytics?</h4>
                    <p className="text-sm text-muted-foreground">
                      A differenza della <strong>Gap Analysis</strong> (che analizza lo stato attuale), la <strong>Predictive Analytics</strong>{' '}
                      utilizza algoritmi ML per <strong>prevedere l'evoluzione del rischio</strong> nei prossimi 3-12 mesi, 
                      stimare la probabilità di sanzioni future e calcolare il ROI degli investimenti in compliance.
                    </p>
                    <div className="text-sm text-muted-foreground">
                      <strong>Quando usarla:</strong> Per pianificare budget, priorità strategiche e capire come potrebbe evolvere la tua situazione di conformità.
                    </div>
                    <p className="text-xs text-muted-foreground">
                      ⚠️ <em>Richiede almeno 3 assessment storici per avere dati sufficienti per le previsioni.</em>
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* How it Works Guide */}
            <Card className="border-primary">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Target className="h-6 w-6" />
                  Come funziona l'Analisi Predittiva
                </CardTitle>
                <CardDescription>
                  Segui questi passaggi per ottenere previsioni ML accurate sul tuo rischio di compliance
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Steps */}
                <div className="space-y-4">
                  <div className="flex gap-4">
                    <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center font-bold">
                      1
                    </div>
                    <div>
                      <h4 className="font-semibold mb-1">Crea Assessment di Compliance</h4>
                      <p className="text-sm text-muted-foreground mb-2">
                        Prima di tutto, devi creare almeno 3 assessment di compliance per avere dati sufficienti per l'analisi predittiva. 
                        Ogni assessment analizza la conformità della tua organizzazione rispetto a normative specifiche (GDPR, NIS2, ecc.).
                      </p>
                      <Button 
                        variant="outline" 
                        size="sm"
                        onClick={() => navigate('/compliance/new-assessment')}
                      >
                        Crea il tuo primo Assessment
                      </Button>
                    </div>
                  </div>

                  <div className="flex gap-4">
                    <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center font-bold">
                      2
                    </div>
                    <div>
                      <h4 className="font-semibold mb-1">Carica Documenti e Policy</h4>
                      <p className="text-sm text-muted-foreground">
                        Durante la creazione di ogni assessment, carica i tuoi documenti di compliance (policy aziendali, procedure, 
                        documentazione tecnica). Il sistema analizza questi documenti per identificare gap di conformità.
                      </p>
                    </div>
                  </div>

                  <div className="flex gap-4">
                    <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center font-bold">
                      3
                    </div>
                    <div className="flex-1">
                      <h4 className="font-semibold mb-1">Genera Analisi Predittiva</h4>
                      <p className="text-sm text-muted-foreground">
                        Una volta creati almeno 3 assessment, clicca "Genera Analisi". Il sistema ML analizzerà:
                      </p>
                      <ul className="text-sm text-muted-foreground mt-2 space-y-1 ml-4">
                        <li>• Trend di rischio nel tempo</li>
                        <li>• Probabilità di sanzioni nei prossimi 12 mesi</li>
                        <li>• Impatto finanziario stimato</li>
                        <li>• Traiettoria di compliance futura</li>
                      </ul>
                      
                      {/* Messaggio dati insufficienti */}
                      {insufficientData && (
                        <div className="mt-4 p-4 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-lg">
                          <div className="flex items-start gap-3">
                            <AlertTriangle className="h-5 w-5 text-amber-600 dark:text-amber-400 mt-0.5 shrink-0" />
                            <div className="flex-1">
                              <p className="text-sm font-medium text-amber-800 dark:text-amber-200">
                                Dati insufficienti per l'analisi predittiva
                              </p>
                              <p className="text-sm text-amber-700 dark:text-amber-300 mt-1">
                                Hai <strong>{insufficientData.current}</strong> assessment su <strong>{insufficientData.required}</strong> richiesti. 
                                Crea altri <strong>{insufficientData.required - insufficientData.current}</strong> assessment per sbloccare le previsioni ML.
                              </p>
                              <Button 
                                onClick={() => navigate('/compliance/new-assessment')}
                                variant="outline"
                                size="sm"
                                className="mt-3 border-amber-300 dark:border-amber-700 hover:bg-amber-100 dark:hover:bg-amber-900/50"
                              >
                                <Target className="mr-2 h-4 w-4" />
                                Crea Assessment Mancanti
                              </Button>
                            </div>
                          </div>
                        </div>
                      )}
                      
                      <div className="mt-4 flex gap-3">
                        <Button 
                          onClick={runAnalysis} 
                          disabled={loading}
                          size="lg"
                        >
                          <RefreshCw className={`mr-2 h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
                          {loading ? 'Analizzando...' : 'Genera Analisi'}
                        </Button>
                        {!insufficientData && (
                          <Button 
                            onClick={() => navigate('/compliance/new-assessment')}
                            variant="outline"
                            size="lg"
                          >
                            <Target className="mr-2 h-4 w-4" />
                            Crea Nuovo Assessment
                          </Button>
                        )}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Example Results Preview */}
                <div className="border-t pt-6">
                  <h4 className="font-semibold mb-3">Esempio di Risultati che Otterrai:</h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="p-4 border rounded-lg bg-muted/50">
                      <div className="flex items-center gap-2 mb-2">
                        <TrendingUp className="h-5 w-5 text-orange-500" />
                        <span className="font-medium">Risk Score Previsto</span>
                      </div>
                      <p className="text-sm text-muted-foreground">
                        Grafico con previsioni ML del tuo risk score nei prossimi 6-12 mesi con intervalli di confidenza
                      </p>
                    </div>
                    <div className="p-4 border rounded-lg bg-muted/50">
                      <div className="flex items-center gap-2 mb-2">
                        <AlertTriangle className="h-5 w-5 text-red-500" />
                        <span className="font-medium">Probabilità Sanzioni</span>
                      </div>
                      <p className="text-sm text-muted-foreground">
                        Stima percentuale di ricevere sanzioni per ogni normativa analizzata
                      </p>
                    </div>
                    <div className="p-4 border rounded-lg bg-muted/50">
                      <div className="flex items-center gap-2 mb-2">
                        <DollarSign className="h-5 w-5 text-green-500" />
                        <span className="font-medium">Impatto Finanziario</span>
                      </div>
                      <p className="text-sm text-muted-foreground">
                        Range di sanzioni potenziali (scenario migliore/atteso/peggiore) e ROI degli investimenti in compliance
                      </p>
                    </div>
                  </div>
                </div>

              </CardContent>
            </Card>
          </div>
        )}

        {loading && (
          <div className="flex items-center justify-center py-20">
            <div className="text-center">
              <RefreshCw className="h-12 w-12 animate-spin text-primary mx-auto mb-4" />
              <p className="text-lg text-muted-foreground">
                Analizzando dati storici e generando previsioni...
              </p>
            </div>
          </div>
        )}

        {data && (
          <div className="space-y-6">
            {/* Metadata Alert */}
            {data.metadata && (
              <Card className={
                data.metadata.dataQuality === 'low' ? 'border-yellow-500' : 
                data.metadata.dataQuality === 'medium' ? 'border-blue-500' : 
                'border-green-500'
              }>
                <CardContent className="py-4">
                  <div className="flex justify-between items-center">
                    <div>
                      <Badge variant={
                        data.metadata.dataQuality === 'low' ? 'destructive' : 
                        data.metadata.dataQuality === 'medium' ? 'default' : 
                        'secondary'
                      }>
                        Qualità dati: {data.metadata.dataQuality === 'high' ? 'Alta' : 
                                      data.metadata.dataQuality === 'medium' ? 'Media' : 'Bassa'}
                      </Badge>
                      <p className="text-sm text-muted-foreground mt-2">
                        {data.metadata.assessmentsAnalyzed} assessment analizzati • {data.metadata.gapsAnalyzed} gap analizzati
                      </p>
                      {data.metadata.recommendedActions && (
                        <p className="text-sm text-yellow-600 mt-1">
                          ⚠️ {data.metadata.recommendedActions}
                        </p>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Generato: {new Date(data.metadata.generatedAt).toLocaleString('it-IT')}
                    </p>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Risk Trend Analysis */}
            {data.riskTrend && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    {getTrendIcon(data.riskTrend.trend)}
                    Analisi Trend di Rischio
                  </CardTitle>
                  <CardDescription>
                    Previsioni ML basate su trend storici • Confidence: {data.riskTrend.confidence}%
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                    <div className="text-center p-4 bg-muted rounded-lg">
                      <p className="text-sm text-muted-foreground">Attuale</p>
                      <p className={`text-3xl font-bold ${getRiskColor(data.riskTrend.currentScore)}`}>
                        {data.riskTrend.currentScore}
                      </p>
                    </div>
                    <div className="text-center p-4 bg-muted rounded-lg">
                      <p className="text-sm text-muted-foreground">3 mesi</p>
                      <p className={`text-3xl font-bold ${getRiskColor(data.riskTrend.prediction3Months)}`}>
                        {data.riskTrend.prediction3Months}
                      </p>
                    </div>
                    <div className="text-center p-4 bg-muted rounded-lg">
                      <p className="text-sm text-muted-foreground">6 mesi</p>
                      <p className={`text-3xl font-bold ${getRiskColor(data.riskTrend.prediction6Months)}`}>
                        {data.riskTrend.prediction6Months}
                      </p>
                    </div>
                    <div className="text-center p-4 bg-muted rounded-lg">
                      <p className="text-sm text-muted-foreground">12 mesi</p>
                      <p className={`text-3xl font-bold ${getRiskColor(data.riskTrend.prediction12Months)}`}>
                        {data.riskTrend.prediction12Months}
                      </p>
                    </div>
                  </div>

                  {data.riskTrend.influencingFactors && data.riskTrend.influencingFactors.length > 0 && (
                    <div>
                      <h4 className="font-semibold mb-3">Fattori Influenzanti</h4>
                      <div className="space-y-3">
                        {data.riskTrend.influencingFactors.map((item, i) => (
                          <div key={i} className="p-3 border rounded-lg">
                            <div className="flex items-center justify-between mb-1">
                              <span className="font-medium">{item.factor}</span>
                              <Badge variant={
                                item.impact === 'high' ? 'destructive' : 
                                item.impact === 'medium' ? 'default' : 'secondary'
                              }>
                                {item.impact}
                              </Badge>
                            </div>
                            <p className="text-sm text-muted-foreground">{item.description}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            )}

            {/* Sanction Probability */}
            {data.sanctionProbability && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <AlertTriangle className="h-5 w-5 text-orange-500" />
                    Probabilità di Sanzioni
                  </CardTitle>
                  <CardDescription>
                    Stima ML per i prossimi 12 mesi
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="text-center">
                    <p className={`text-6xl font-bold ${getRiskColor(data.sanctionProbability.overall)}`}>
                      {data.sanctionProbability.overall}%
                    </p>
                    <p className="text-muted-foreground mt-2">
                      Probabilità complessiva
                    </p>
                  </div>

                  {data.sanctionProbability.byRegulation && data.sanctionProbability.byRegulation.length > 0 && (
                    <div>
                      <h4 className="font-semibold mb-4">Breakdown per Normativa</h4>
                      <ResponsiveContainer width="100%" height={300}>
                        <BarChart data={data.sanctionProbability.byRegulation}>
                          <CartesianGrid strokeDasharray="3 3" />
                          <XAxis dataKey="regulation" />
                          <YAxis domain={[0, 100]} />
                          <Tooltip />
                          <Bar dataKey="probability" fill="#ff8042" name="Probabilità %" />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  )}

                  {data.sanctionProbability.keyRiskFactors && data.sanctionProbability.keyRiskFactors.length > 0 && (
                    <div>
                      <h4 className="font-semibold mb-2">Fattori di Rischio Principali</h4>
                      <ul className="space-y-2">
                        {data.sanctionProbability.keyRiskFactors.map((factor, i) => (
                          <li key={i} className="flex items-start gap-2">
                            <AlertTriangle className="h-4 w-4 text-red-500 mt-0.5 flex-shrink-0" />
                            <span className="text-sm">{factor}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </CardContent>
              </Card>
            )}

            {/* Financial Impact */}
            {data.financialImpact && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <DollarSign className="h-5 w-5 text-green-500" />
                    Impatto Finanziario Previsto
                  </CardTitle>
                  <CardDescription>
                    Stima sanzioni potenziali e ROI compliance
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="text-center p-4 bg-green-50 dark:bg-green-950 rounded-lg">
                      <p className="text-sm text-muted-foreground">Scenario Migliore</p>
                      <p className="text-2xl font-bold text-green-600">
                        €{data.financialImpact.potentialFines.minimum.toLocaleString()}
                      </p>
                    </div>
                    <div className="text-center p-4 bg-orange-50 dark:bg-orange-950 rounded-lg">
                      <p className="text-sm text-muted-foreground">Scenario Atteso</p>
                      <p className="text-2xl font-bold text-orange-600">
                        €{data.financialImpact.potentialFines.expected.toLocaleString()}
                      </p>
                    </div>
                    <div className="text-center p-4 bg-red-50 dark:bg-red-950 rounded-lg">
                      <p className="text-sm text-muted-foreground">Scenario Peggiore</p>
                      <p className="text-2xl font-bold text-red-600">
                        €{data.financialImpact.potentialFines.maximum.toLocaleString()}
                      </p>
                    </div>
                  </div>

                  {data.financialImpact.byCriticalGap && data.financialImpact.byCriticalGap.length > 0 && (
                    <div>
                      <h4 className="font-semibold mb-4">Top Gap per Impatto Finanziario</h4>
                      <div className="space-y-2">
                        {data.financialImpact.byCriticalGap.map((item, i) => (
                          <div key={i} className="flex justify-between items-center p-3 border rounded-lg">
                            <span className="text-sm">{item.gap}</span>
                            <div className="text-right">
                              <p className="font-semibold">€{item.estimatedFine.toLocaleString()}</p>
                              <p className="text-xs text-muted-foreground">{item.probability}% prob</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="p-4 border rounded-lg bg-blue-50 dark:bg-blue-950">
                      <p className="text-sm text-muted-foreground mb-1">Investimento Necessario</p>
                      <p className="text-2xl font-bold text-blue-600">
                        €{data.financialImpact.remediationROI.investmentNeeded.toLocaleString()}
                      </p>
                    </div>
                    <div className="p-4 border rounded-lg bg-green-50 dark:bg-green-950">
                      <p className="text-sm text-muted-foreground mb-1">Multe Evitate</p>
                      <p className="text-2xl font-bold text-green-600">
                        €{data.financialImpact.remediationROI.finesAvoided.toLocaleString()}
                      </p>
                    </div>
                  </div>

                  <div className="p-4 bg-primary/10 rounded-lg text-center">
                    <p className="text-sm text-muted-foreground mb-1">ROI Investimento Compliance</p>
                    <p className="text-4xl font-bold text-primary">{data.financialImpact.remediationROI.roi}%</p>
                    <p className="text-sm text-muted-foreground mt-2">Timeline: {data.financialImpact.timeline}</p>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Compliance Trajectory */}
            {data.complianceTrajectory && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Target className="h-5 w-5 text-blue-500" />
                    Traiettoria di Compliance
                  </CardTitle>
                  <CardDescription>
                    Proiezioni future e raccomandazioni
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  {data.complianceTrajectory.projectedCompliance && (
                    <div>
                      <h4 className="font-semibold mb-4">Proiezione Compliance %</h4>
                      <ResponsiveContainer width="100%" height={300}>
                        <LineChart data={data.complianceTrajectory.projectedCompliance}>
                          <CartesianGrid strokeDasharray="3 3" />
                          <XAxis dataKey="timeframe" />
                          <YAxis domain={[0, 100]} />
                          <Tooltip />
                          <Legend />
                          <Line 
                            type="monotone" 
                            dataKey="score" 
                            stroke="#00C49F" 
                            strokeWidth={3}
                            name="Compliance %"
                          />
                        </LineChart>
                      </ResponsiveContainer>
                    </div>
                  )}

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {data.complianceTrajectory.quickWins && data.complianceTrajectory.quickWins.length > 0 && (
                      <div>
                        <h4 className="font-semibold mb-2 text-green-600">⚡ Quick Wins</h4>
                        <ul className="space-y-2 text-sm">
                          {data.complianceTrajectory.quickWins.map((win, i) => (
                            <li key={i} className="flex items-start gap-2 p-2 border rounded">
                              <span className="text-green-500 flex-shrink-0">✓</span>
                              <div className="flex-1">
                                <p className="font-medium">{win.action}</p>
                                <p className="text-xs text-muted-foreground">
                                  Impact: +{win.impact}% • Effort: {win.effort}
                                </p>
                              </div>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {data.complianceTrajectory.longTermInvestments && data.complianceTrajectory.longTermInvestments.length > 0 && (
                      <div>
                        <h4 className="font-semibold mb-2 text-blue-600">📈 Investimenti Long-term</h4>
                        <ul className="space-y-1 text-sm">
                          {data.complianceTrajectory.longTermInvestments.map((inv, i) => (
                            <li key={i} className="flex items-start gap-2">
                              <span className="text-blue-500">→</span>
                              {inv}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>

                  {data.complianceTrajectory.emergingGaps && data.complianceTrajectory.emergingGaps.length > 0 && (
                    <div>
                      <h4 className="font-semibold mb-2 text-orange-600">⚠️ Gap Emergenti Previsti</h4>
                      <div className="flex flex-wrap gap-2">
                        {data.complianceTrajectory.emergingGaps.map((gap, i) => (
                          <Badge key={i} variant="destructive">{gap}</Badge>
                        ))}
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            )}

            {/* Comparative Analysis */}
            {data.comparativeAnalysis && (
              <Card>
                <CardHeader>
                  <CardTitle>Analisi Comparativa vs Mercato</CardTitle>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="text-center">
                    <p className="text-muted-foreground mb-2">Posizione nel Settore</p>
                    <p className="text-5xl font-bold text-primary">
                      {data.comparativeAnalysis.sectorPercentile}° percentile
                    </p>
                    <Progress value={data.comparativeAnalysis.sectorPercentile} className="mt-4" />
                  </div>

                  <div className="p-4 bg-muted rounded-lg">
                    <p className="text-sm text-muted-foreground mb-1">Velocità di Miglioramento</p>
                    <p className="text-lg font-semibold">{data.comparativeAnalysis.improvementVelocity}</p>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {data.comparativeAnalysis.areasOfExcellence && data.comparativeAnalysis.areasOfExcellence.length > 0 && (
                      <div>
                        <h4 className="font-semibold mb-2 text-green-600">✨ Aree di Eccellenza</h4>
                        <ul className="space-y-1 text-sm">
                          {data.comparativeAnalysis.areasOfExcellence.map((area, i) => (
                            <li key={i} className="flex items-start gap-2">
                              <span className="text-green-500">★</span>
                              {area}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {data.comparativeAnalysis.criticalAreas && data.comparativeAnalysis.criticalAreas.length > 0 && (
                      <div>
                        <h4 className="font-semibold mb-2 text-red-600">🔴 Aree Critiche</h4>
                        <ul className="space-y-1 text-sm">
                          {data.comparativeAnalysis.criticalAreas.map((area, i) => (
                            <li key={i} className="flex items-start gap-2">
                              <AlertTriangle className="h-4 w-4 text-red-500 mt-0.5" />
                              {area}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            )}

          </div>
        )}
      </div>
    </div>
  );
}