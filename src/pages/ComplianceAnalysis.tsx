import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { useToast } from "@/hooks/use-toast";
import {
  TrendingUp,
  TrendingDown,
  AlertTriangle,
  Target,
  ArrowLeft,
  RefreshCw,
  Activity,
  BarChart3,
  Shield,
  FileText,
  Plus,
  CheckCircle,
  XCircle,
  Upload
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

type Assessment = Tables<"compliance_assessments">;

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884D8'];

export default function ComplianceAnalysis() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState<"gaps" | "predictive">("gaps");
  const [loading, setLoading] = useState(true);
  const [predictiveData, setPredictiveData] = useState<PredictiveData | null>(null);
  const [assessments, setAssessments] = useState<Assessment[]>([]);
  const [predictiveLoading, setPredictiveLoading] = useState(false);

  useEffect(() => {
    checkAuthAndLoad();
  }, []);

  const checkAuthAndLoad = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    
    if (!session) {
      sessionStorage.setItem('auth_redirect', '/compliance/analysis');
      toast({
        title: "Autenticazione richiesta",
        description: "Effettua l'accesso per visualizzare l'analisi di conformità",
        variant: "destructive",
      });
      navigate('/auth');
      return;
    }
    
    await loadAssessments();
  };

  const loadAssessments = async () => {
    try {
      setLoading(true);
      
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        console.log("No authenticated user found");
        return;
      }

      // First load assessments without joins
      const { data: assessmentsData, error: assessmentsError } = await supabase
        .from('compliance_assessments')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (assessmentsError) {
        console.error('Error loading assessments:', assessmentsError);
        throw assessmentsError;
      }

      // Then load gaps separately for each assessment
      if (assessmentsData && assessmentsData.length > 0) {
        const assessmentsWithGaps = await Promise.all(
          assessmentsData.map(async (assessment) => {
            const { data: gaps } = await supabase
              .from('identified_gaps')
              .select('severity')
              .eq('assessment_id', assessment.id);
            
            return {
              ...assessment,
              identified_gaps: gaps || []
            };
          })
        );
        setAssessments(assessmentsWithGaps);
      } else {
        setAssessments(assessmentsData || []);
      }
    } catch (error: any) {
      console.error('Error loading assessments:', error);
      // Only show toast for actual errors, not for empty results
      if (error.code !== 'PGRST116') {
        toast({
          title: "Errore di caricamento",
          description: error.message || "Impossibile caricare le tue valutazioni di conformità.",
          variant: "destructive",
        });
      }
    } finally {
      setLoading(false);
    }
  };

  const loadPredictiveAnalytics = async () => {
    try {
      setPredictiveLoading(true);
      
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: result, error } = await supabase.functions.invoke('predictive-analytics', {
        body: { userId: user.id }
      });

      if (error) throw error;

      setPredictiveData(result);
      
      toast({
        title: "Analisi completata",
        description: "Le previsioni sono state generate con successo",
      });
    } catch (error: any) {
      console.error('Error in predictive analytics:', error);
      toast({
        title: "Errore",
        description: error.message || "Impossibile generare l'analisi predittiva",
        variant: "destructive",
      });
    } finally {
      setPredictiveLoading(false);
    }
  };

  const getComplianceColor = (score: number | null) => {
    if (!score) return "text-muted-foreground";
    if (score >= 80) return "text-green-600";
    if (score >= 60) return "text-yellow-600";
    if (score >= 40) return "text-orange-600";
    return "text-red-600";
  };

  const countGapsBySeverity = (assessment: Assessment) => {
    const gaps = (assessment as any).identified_gaps || [];
    return {
      critical: gaps.filter((g: any) => g.severity === 'critical').length,
      high: gaps.filter((g: any) => g.severity === 'high').length,
      medium: gaps.filter((g: any) => g.severity === 'medium').length,
      low: gaps.filter((g: any) => g.severity === 'low').length,
    };
  };

  const getStatusBadge = (status: string) => {
    const variants: { [key: string]: any } = {
      completed: "default",
      in_progress: "secondary",
      pending: "outline",
    };
    return <Badge variant={variants[status] || "outline"}>{status}</Badge>;
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-8 max-w-7xl">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-3">
            <Shield className="h-8 w-8 text-primary" />
            <div>
              <h1 className="text-3xl font-bold">Analisi Conformità</h1>
              <p className="text-muted-foreground">Gap Analysis & Predictive Risk Analytics</p>
            </div>
          </div>
          <Button variant="outline" onClick={() => navigate('/chat')}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Torna indietro
          </Button>
        </div>

        {/* Main Tabs */}
        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as "gaps" | "predictive")} className="space-y-6">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="gaps">
              <Target className="h-4 w-4 mr-2" />
              Gap Analysis
            </TabsTrigger>
            <TabsTrigger value="predictive">
              <TrendingUp className="h-4 w-4 mr-2" />
              Predictive Analytics
            </TabsTrigger>
          </TabsList>

          {/* Gap Analysis Tab */}
          <TabsContent value="gaps" className="space-y-6">
            {/* Istruzioni d'uso dettagliate */}
            <Card className="border-primary/20 bg-gradient-to-br from-primary/5 to-secondary/5">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Target className="h-5 w-5 text-primary" />
                  Come funziona la Gap Analysis
                </CardTitle>
                <CardDescription>
                  Segui questi passaggi per identificare le lacune di conformità
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-3">
                    <h4 className="font-semibold text-sm flex items-center gap-2">
                      <FileText className="h-4 w-4 text-primary" />
                      Documenti da preparare
                    </h4>
                    <ul className="text-sm text-muted-foreground space-y-2">
                      <li className="flex items-start gap-2">
                        <CheckCircle className="h-4 w-4 text-green-600 mt-0.5 shrink-0" />
                        <span><strong>Policy aziendali:</strong> Privacy Policy, Information Security Policy, Data Retention Policy</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <CheckCircle className="h-4 w-4 text-green-600 mt-0.5 shrink-0" />
                        <span><strong>Procedure operative:</strong> Gestione accessi, backup, incident response, DPIA</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <CheckCircle className="h-4 w-4 text-green-600 mt-0.5 shrink-0" />
                        <span><strong>Registri GDPR:</strong> Registro trattamenti (Art. 30), elenco fornitori, contratti DPA</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <CheckCircle className="h-4 w-4 text-green-600 mt-0.5 shrink-0" />
                        <span><strong>Documentazione tecnica:</strong> Architetture di rete, misure di sicurezza, audit log</span>
                      </li>
                    </ul>
                  </div>
                  
                  <div className="space-y-3">
                    <h4 className="font-semibold text-sm flex items-center gap-2">
                      <Upload className="h-4 w-4 text-primary" />
                      Formati supportati
                    </h4>
                    <ul className="text-sm text-muted-foreground space-y-2">
                      <li className="flex items-start gap-2">
                        <Badge variant="secondary" className="shrink-0">PDF</Badge>
                        <span>Documenti, policy, procedure (.pdf)</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <Badge variant="secondary" className="shrink-0">DOCX</Badge>
                        <span>Microsoft Word (.docx, .doc)</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <Badge variant="secondary" className="shrink-0">TXT</Badge>
                        <span>File di testo semplice (.txt)</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <Badge variant="secondary" className="shrink-0">IMG</Badge>
                        <span>Diagrammi e schemi (PNG, JPG)</span>
                      </li>
                    </ul>
                  </div>
                </div>

                <div className="p-4 bg-muted rounded-lg space-y-2">
                  <h4 className="font-semibold text-sm flex items-center gap-2">
                    <Activity className="h-4 w-4 text-primary" />
                    Processo step-by-step
                  </h4>
                  <ol className="text-sm text-muted-foreground space-y-2 ml-4 list-decimal">
                    <li><strong>Crea nuova valutazione:</strong> Clicca "Nuova Gap Analysis" e seleziona le normative da verificare (es. GDPR, NIS2, AI Act)</li>
                    <li><strong>Carica i documenti:</strong> Allega tutti i file aziendali rilevanti per la conformità</li>
                    <li><strong>Analisi automatica:</strong> Il sistema confronta i tuoi documenti con ogni requisito normativo</li>
                    <li><strong>Visualizza gap:</strong> Ricevi un report dettagliato con gap identificati, livello di rischio e priorità</li>
                    <li><strong>Action plan:</strong> Per ogni gap, ottieni azioni correttive automatiche con stime di tempo e costi</li>
                  </ol>
                </div>

                <div className="p-4 bg-blue-50 dark:bg-blue-950/30 rounded-lg border border-blue-200 dark:border-blue-800">
                  <p className="text-sm">
                    <strong className="text-primary">💡 Esempio pratico:</strong> Carica la tua Privacy Policy + Registro Trattamenti → 
                    Seleziona GDPR → Il sistema identifica automaticamente quali articoli mancano (es. Art. 30, Art. 32) → 
                    Ricevi azioni specifiche da intraprendere con priorità e stime
                  </p>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>Stato Attuale della Conformità</CardTitle>
                    <CardDescription>
                      Visualizza i gap identificati nelle tue valutazioni
                    </CardDescription>
                  </div>
                  <Button onClick={() => navigate('/compliance/new-assessment')}>
                    <Plus className="h-4 w-4 mr-2" />
                    Nuova Gap Analysis
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                {loading ? (
                  <div className="text-center py-8 text-muted-foreground">Caricamento...</div>
                ) : assessments.length === 0 ? (
                  <div className="text-center py-12">
                    <Target className="h-16 w-16 mx-auto text-muted-foreground mb-4" />
                    <h3 className="text-lg font-semibold mb-2">Nessuna valutazione disponibile</h3>
                    <p className="text-muted-foreground mb-4">
                      Inizia con la tua prima gap analysis per identificare le aree di non conformità
                    </p>
                    <Button onClick={() => navigate('/compliance/new-assessment')}>
                      <Plus className="h-4 w-4 mr-2" />
                      Avvia Gap Analysis
                    </Button>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {/* Summary Stats */}
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
                      <Card>
                        <CardHeader className="pb-3">
                          <CardTitle className="text-sm font-medium text-muted-foreground">
                            Valutazioni Totali
                          </CardTitle>
                        </CardHeader>
                        <CardContent>
                          <div className="text-2xl font-bold">{assessments.length}</div>
                        </CardContent>
                      </Card>
                      
                      <Card>
                        <CardHeader className="pb-3">
                          <CardTitle className="text-sm font-medium text-muted-foreground">
                            Gap Critici
                          </CardTitle>
                        </CardHeader>
                        <CardContent>
                          <div className="text-2xl font-bold text-destructive">
                            {assessments.reduce((sum, a) => sum + countGapsBySeverity(a).critical, 0)}
                          </div>
                        </CardContent>
                      </Card>

                      <Card>
                        <CardHeader className="pb-3">
                          <CardTitle className="text-sm font-medium text-muted-foreground">
                            Conformità Media
                          </CardTitle>
                        </CardHeader>
                        <CardContent>
                          <div className={`text-2xl font-bold ${getComplianceColor(
                            assessments.reduce((sum, a) => sum + (a.overall_compliance_percentage || 0), 0) / assessments.length
                          )}`}>
                            {Math.round(assessments.reduce((sum, a) => sum + (a.overall_compliance_percentage || 0), 0) / assessments.length)}%
                          </div>
                        </CardContent>
                      </Card>

                      <Card>
                        <CardHeader className="pb-3">
                          <CardTitle className="text-sm font-medium text-muted-foreground">
                            In Progresso
                          </CardTitle>
                        </CardHeader>
                        <CardContent>
                          <div className="text-2xl font-bold">
                            {assessments.filter(a => a.status === 'in_progress').length}
                          </div>
                        </CardContent>
                      </Card>
                    </div>

                    {/* Assessments List */}
                    {assessments.map((assessment) => {
                      const gapCounts = countGapsBySeverity(assessment);
                      return (
                      <Card 
                        key={assessment.id} 
                        className="hover:border-primary cursor-pointer transition-colors"
                        onClick={() => navigate(`/compliance/assessment/${assessment.id}`)}
                      >
                        <CardContent className="pt-6">
                          <div className="flex items-start justify-between">
                            <div className="flex-1">
                              <div className="flex items-center gap-3 mb-2">
                                <h3 className="font-semibold text-lg">{assessment.title}</h3>
                                {getStatusBadge(assessment.status)}
                              </div>
                              
                              {assessment.overall_compliance_percentage !== null && (
                                <div className="mb-3">
                                  <div className="flex items-center justify-between mb-1">
                                    <span className="text-sm text-muted-foreground">
                                      Compliance Score
                                    </span>
                                    <span className={`text-sm font-bold ${getComplianceColor(assessment.overall_compliance_percentage)}`}>
                                      {assessment.overall_compliance_percentage}%
                                    </span>
                                  </div>
                                  <Progress value={assessment.overall_compliance_percentage} className="h-2" />
                                </div>
                              )}

                              <div className="grid grid-cols-4 gap-4 text-sm">
                                <div>
                                  <span className="text-muted-foreground">Critici:</span>
                                  <p className="font-medium text-destructive">{gapCounts.critical}</p>
                                </div>
                                <div>
                                  <span className="text-muted-foreground">Alto:</span>
                                  <p className="font-medium text-orange-600">{gapCounts.high}</p>
                                </div>
                                <div>
                                  <span className="text-muted-foreground">Medio:</span>
                                  <p className="font-medium text-yellow-600">{gapCounts.medium}</p>
                                </div>
                                <div>
                                  <span className="text-muted-foreground">Basso:</span>
                                  <p className="font-medium text-green-600">{gapCounts.low}</p>
                                </div>
                              </div>
                            </div>
                            
                            <Button variant="outline" size="sm">
                              Dettagli
                            </Button>
                          </div>
                        </CardContent>
                      </Card>
                    );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Predictive Analytics Tab */}
          <TabsContent value="predictive" className="space-y-6">
            {/* Istruzioni d'uso dettagliate */}
            <Card className="border-primary/20 bg-gradient-to-br from-primary/5 to-secondary/5">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <TrendingUp className="h-5 w-5 text-primary" />
                  Come funziona Predictive Analytics
                </CardTitle>
                <CardDescription>
                  Machine Learning per prevedere rischi futuri e ottimizzare la strategia di conformità
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-3">
                    <h4 className="font-semibold text-sm flex items-center gap-2">
                      <Activity className="h-4 w-4 text-primary" />
                      Requisiti per l'analisi
                    </h4>
                    <ul className="text-sm text-muted-foreground space-y-2">
                      <li className="flex items-start gap-2">
                        <CheckCircle className="h-4 w-4 text-green-600 mt-0.5 shrink-0" />
                        <span><strong>Almeno 1 Gap Analysis completata:</strong> Serve una valutazione per addestrare i modelli ML</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <CheckCircle className="h-4 w-4 text-green-600 mt-0.5 shrink-0" />
                        <span><strong>Dati storici:</strong> Più valutazioni hai, più accurate saranno le previsioni</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <CheckCircle className="h-4 w-4 text-green-600 mt-0.5 shrink-0" />
                        <span><strong>Gap identificati:</strong> Il sistema analizza i gap per prevedere rischi futuri</span>
                      </li>
                    </ul>
                  </div>
                  
                  <div className="space-y-3">
                    <h4 className="font-semibold text-sm flex items-center gap-2">
                      <BarChart3 className="h-4 w-4 text-primary" />
                      Cosa ottieni
                    </h4>
                    <ul className="text-sm text-muted-foreground space-y-2">
                      <li className="flex items-start gap-2">
                        <Badge variant="secondary" className="shrink-0">3-6-12M</Badge>
                        <span>Previsioni rischio a 3, 6 e 12 mesi</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <Badge variant="secondary" className="shrink-0">€ Sanzioni</Badge>
                        <span>Calcolo sanzioni potenziali per normativa</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <Badge variant="secondary" className="shrink-0">ROI</Badge>
                        <span>Return on Investment della rimediazione</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <Badge variant="secondary" className="shrink-0">Trend</Badge>
                        <span>Grafici evolutivi del rischio nel tempo</span>
                      </li>
                    </ul>
                  </div>
                </div>

                <div className="p-4 bg-muted rounded-lg space-y-2">
                  <h4 className="font-semibold text-sm flex items-center gap-2">
                    <TrendingUp className="h-4 w-4 text-primary" />
                    Come interpretare i risultati
                  </h4>
                  <ul className="text-sm text-muted-foreground space-y-2 ml-4 list-disc">
                    <li><strong>Trend del rischio:</strong> Mostra se il rischio aumenta o diminuisce nei prossimi mesi</li>
                    <li><strong>Probabilità sanzioni:</strong> Percentuale di probabilità di ricevere sanzioni per ciascuna normativa</li>
                    <li><strong>Impatto finanziario:</strong> Sanzioni previste (minimo, medio, massimo) e ROI della rimediazione</li>
                    <li><strong>Quick wins:</strong> Azioni rapide per migliorare velocemente il compliance score</li>
                  </ul>
                </div>

                <div className="p-4 bg-purple-50 dark:bg-purple-950/30 rounded-lg border border-purple-200 dark:border-purple-800">
                  <p className="text-sm">
                    <strong className="text-primary">💡 Esempio pratico:</strong> Dopo una Gap Analysis GDPR con 5 gap identificati → 
                    Clicca "Genera Previsioni" → Il sistema prevede un aumento del rischio del 30% nei prossimi 6 mesi → 
                    Sanzione potenziale: €50.000 → Investimento rimediazione: €12.000 → ROI: 4.2x
                  </p>
                </div>
              </CardContent>
            </Card>
            
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>Analisi Predittiva dei Rischi</CardTitle>
                    <CardDescription>
                      Previsioni ML sui rischi di conformità futuri
                    </CardDescription>
                  </div>
                  <Button 
                    onClick={loadPredictiveAnalytics} 
                    disabled={predictiveLoading || assessments.length === 0}
                  >
                    {predictiveLoading ? (
                      <>
                        <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                        Generazione...
                      </>
                    ) : (
                      <>
                        <Activity className="h-4 w-4 mr-2" />
                        Genera Previsioni
                      </>
                    )}
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                {assessments.length === 0 ? (
                  <div className="text-center py-12">
                    <AlertTriangle className="h-16 w-16 mx-auto text-muted-foreground mb-4" />
                    <h3 className="text-lg font-semibold mb-2">Dati insufficienti</h3>
                    <p className="text-muted-foreground mb-4">
                      Completa almeno una Gap Analysis per generare previsioni predittive
                    </p>
                    <Button onClick={() => setActiveTab("gaps")}>
                      Vai a Gap Analysis
                    </Button>
                  </div>
                ) : !predictiveData ? (
                  <div className="text-center py-12">
                    <TrendingUp className="h-16 w-16 mx-auto text-muted-foreground mb-4" />
                    <h3 className="text-lg font-semibold mb-2">Genera Analisi Predittiva</h3>
                    <p className="text-muted-foreground mb-4">
                      Utilizza il machine learning per prevedere i rischi futuri basandoti sui gap attuali
                    </p>
                    <Button onClick={loadPredictiveAnalytics} disabled={predictiveLoading}>
                      {predictiveLoading ? (
                        <>
                          <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                          Elaborazione in corso...
                        </>
                      ) : (
                        <>
                          <Activity className="h-4 w-4 mr-2" />
                          Avvia Analisi
                        </>
                      )}
                    </Button>
                  </div>
                ) : (
                  <div className="space-y-6">
                    {/* Risk Trend */}
                    {predictiveData.riskTrend && (
                      <Card>
                        <CardHeader>
                          <CardTitle className="flex items-center gap-2">
                            <TrendingUp className="h-5 w-5" />
                            Trend del Rischio
                          </CardTitle>
                        </CardHeader>
                        <CardContent>
                          <ResponsiveContainer width="100%" height={300}>
                            <LineChart data={[
                              { month: 'Oggi', score: predictiveData.riskTrend.currentScore },
                              { month: '3 mesi', score: predictiveData.riskTrend.prediction3Months },
                              { month: '6 mesi', score: predictiveData.riskTrend.prediction6Months },
                              { month: '12 mesi', score: predictiveData.riskTrend.prediction12Months }
                            ]}>
                              <CartesianGrid strokeDasharray="3 3" />
                              <XAxis dataKey="month" />
                              <YAxis />
                              <Tooltip />
                              <Legend />
                              <Line type="monotone" dataKey="score" stroke="#8884d8" name="Risk Score" />
                            </LineChart>
                          </ResponsiveContainer>
                          
                          <div className="mt-4 p-4 bg-muted rounded-lg">
                            <p className="text-sm">
                              <strong>Trend:</strong> {predictiveData.riskTrend.trend}
                            </p>
                            <p className="text-sm mt-2">
                              <strong>Confidenza:</strong> {predictiveData.riskTrend.confidence}%
                            </p>
                          </div>
                        </CardContent>
                      </Card>
                    )}

                    {/* Sanction Probability */}
                    {predictiveData.sanctionProbability && (
                      <Card>
                        <CardHeader>
                          <CardTitle className="flex items-center gap-2">
                            <AlertTriangle className="h-5 w-5" />
                            Probabilità Sanzioni
                          </CardTitle>
                        </CardHeader>
                        <CardContent>
                          <div className="mb-4">
                            <div className="flex items-center justify-between mb-2">
                              <span className="text-sm font-medium">Probabilità Complessiva</span>
                              <span className="text-2xl font-bold text-destructive">
                                {predictiveData.sanctionProbability.overall}%
                              </span>
                            </div>
                            <Progress value={predictiveData.sanctionProbability.overall} className="h-2" />
                          </div>

                          {predictiveData.sanctionProbability.byRegulation.length > 0 && (
                            <ResponsiveContainer width="100%" height={200}>
                              <BarChart data={predictiveData.sanctionProbability.byRegulation}>
                                <CartesianGrid strokeDasharray="3 3" />
                                <XAxis dataKey="regulation" />
                                <YAxis />
                                <Tooltip />
                                <Bar dataKey="probability" fill="#ff8042" name="Probabilità %" />
                              </BarChart>
                            </ResponsiveContainer>
                          )}
                        </CardContent>
                      </Card>
                    )}

                    {/* Financial Impact */}
                    {predictiveData.financialImpact && (
                      <Card>
                        <CardHeader>
                          <CardTitle className="flex items-center gap-2">
                            <BarChart3 className="h-5 w-5" />
                            Impatto Finanziario
                          </CardTitle>
                        </CardHeader>
                        <CardContent>
                          <div className="grid grid-cols-3 gap-4 mb-4">
                            <div className="text-center p-4 bg-muted rounded-lg">
                              <p className="text-sm text-muted-foreground">Minimo</p>
                              <p className="text-xl font-bold">
                                €{predictiveData.financialImpact.potentialFines.minimum.toLocaleString()}
                              </p>
                            </div>
                            <div className="text-center p-4 bg-destructive/10 rounded-lg border-2 border-destructive">
                              <p className="text-sm text-muted-foreground">Previsto</p>
                              <p className="text-xl font-bold text-destructive">
                                €{predictiveData.financialImpact.potentialFines.expected.toLocaleString()}
                              </p>
                            </div>
                            <div className="text-center p-4 bg-muted rounded-lg">
                              <p className="text-sm text-muted-foreground">Massimo</p>
                              <p className="text-xl font-bold">
                                €{predictiveData.financialImpact.potentialFines.maximum.toLocaleString()}
                              </p>
                            </div>
                          </div>

                          {predictiveData.financialImpact.remediationROI && (
                            <div className="p-4 bg-green-50 dark:bg-green-950 rounded-lg">
                              <h4 className="font-semibold mb-2">ROI della Rimediazione</h4>
                              <div className="grid grid-cols-3 gap-4 text-sm">
                                <div>
                                  <p className="text-muted-foreground">Investimento</p>
                                  <p className="font-bold">
                                    €{predictiveData.financialImpact.remediationROI.investmentNeeded.toLocaleString()}
                                  </p>
                                </div>
                                <div>
                                  <p className="text-muted-foreground">Sanzioni Evitate</p>
                                  <p className="font-bold text-green-600">
                                    €{predictiveData.financialImpact.remediationROI.finesAvoided.toLocaleString()}
                                  </p>
                                </div>
                                <div>
                                  <p className="text-muted-foreground">ROI</p>
                                  <p className="font-bold text-green-600">
                                    {predictiveData.financialImpact.remediationROI.roi}x
                                  </p>
                                </div>
                              </div>
                            </div>
                          )}
                        </CardContent>
                      </Card>
                    )}

                    {/* Metadata */}
                    {predictiveData.metadata && (
                      <Card>
                        <CardHeader>
                          <CardTitle className="text-sm">Informazioni Analisi</CardTitle>
                        </CardHeader>
                        <CardContent className="text-sm space-y-2">
                          <p><strong>Generata:</strong> {new Date(predictiveData.metadata.generatedAt).toLocaleString()}</p>
                          <p><strong>Valutazioni analizzate:</strong> {predictiveData.metadata.assessmentsAnalyzed}</p>
                          <p><strong>Gap analizzati:</strong> {predictiveData.metadata.gapsAnalyzed}</p>
                          <p><strong>Qualità dati:</strong> {predictiveData.metadata.dataQuality}</p>
                        </CardContent>
                      </Card>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
