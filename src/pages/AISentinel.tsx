import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Shield, Upload, Activity, FileCheck, AlertTriangle, CheckCircle, Clock, TrendingUp, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

const AISentinel = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [models, setModels] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [stats, setStats] = useState({
    totalModels: 0,
    criticalRisks: 0,
    averageTrustScore: 0,
    activeMonitors: 0,
  });

  useEffect(() => {
    checkAuth();
    fetchModels();
    fetchStats();
  }, []);

  const checkAuth = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      // Salva il path corrente per il redirect dopo l'autenticazione
      sessionStorage.setItem('auth_redirect', '/ai-sentinel');
      toast({
        title: "Autenticazione richiesta",
        description: "Devi effettuare l'accesso per utilizzare AI Sentinel",
        variant: "destructive",
      });
      setTimeout(() => navigate('/auth'), 1500);
      return;
    }
  };

  const fetchModels = async () => {
    try {
      const { data, error } = await supabase
        .from('ai_models')
        .select(`
          *,
          model_scans (
            trust_score,
            risk_level,
            scan_date
          )
        `)
        .order('created_at', { ascending: false })
        .limit(10);

      if (error) throw error;
      setModels(data || []);
    } catch (error: any) {
      console.error('Error fetching models:', error);
      toast({
        title: "Errore",
        description: "Impossibile caricare i modelli AI",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const fetchStats = async () => {
    try {
      const { data: modelsData } = await supabase
        .from('ai_models')
        .select('id');

      const { data: scansData } = await supabase
        .from('model_scans')
        .select('trust_score, risk_level');

      const { data: monitorsData } = await supabase
        .from('sentinel_monitoring')
        .select('id')
        .eq('active', true);

      const totalModels = modelsData?.length || 0;
      const criticalRisks = scansData?.filter(s => s.risk_level === 'critical' || s.risk_level === 'high').length || 0;
      const avgScore = scansData?.length 
        ? Math.round(scansData.reduce((sum, s) => sum + (s.trust_score || 0), 0) / scansData.length)
        : 0;
      const activeMonitors = monitorsData?.length || 0;

      setStats({
        totalModels,
        criticalRisks,
        averageTrustScore: avgScore,
        activeMonitors,
      });
    } catch (error) {
      console.error('Error fetching stats:', error);
    }
  };

  const getRiskBadge = (riskLevel: string) => {
    const variants: { [key: string]: any } = {
      low: "default",
      medium: "secondary",
      high: "destructive",
      critical: "destructive",
    };
    const colors: { [key: string]: string } = {
      low: "text-green-600",
      medium: "text-yellow-600",
      high: "text-orange-600",
      critical: "text-red-600",
    };
    return (
      <Badge variant={variants[riskLevel] || "secondary"} className={colors[riskLevel]}>
        {riskLevel?.toUpperCase() || 'UNKNOWN'}
      </Badge>
    );
  };

  const getTrustScoreColor = (score: number) => {
    if (score >= 85) return "text-green-600";
    if (score >= 70) return "text-yellow-600";
    if (score >= 50) return "text-orange-600";
    return "text-red-600";
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-8 max-w-7xl">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-3">
            <Shield className="h-8 w-8 text-primary" />
            <div>
            <h1 className="text-3xl font-bold">AI Sentinel</h1>
            <p className="text-muted-foreground">AI Model Security & Compliance Module</p>
            </div>
          </div>
          <Button variant="outline" onClick={() => navigate('/chat')}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Torna indietro
          </Button>
        </div>

        {/* Istruzioni d'uso */}
        <Card className="mb-8 border-primary/20 bg-gradient-to-br from-primary/5 to-secondary/5">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Shield className="h-5 w-5 text-primary" />
              Come utilizzare AI Sentinel
            </CardTitle>
            <CardDescription>
              Segui questi passaggi per analizzare la sicurezza dei tuoi modelli AI
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <div className="flex items-start gap-3">
                  <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground text-sm font-bold">
                    1
                  </div>
                  <div>
                    <h4 className="font-semibold mb-1">Carica il tuo modello AI</h4>
                    <p className="text-sm text-muted-foreground">
                      Vai alla tab "Modelli" e clicca su "Carica Modello". Supportiamo formati come .pkl, .h5, .pt, .onnx e altri.
                    </p>
                  </div>
                </div>
              </div>
              
              <div className="space-y-2">
                <div className="flex items-start gap-3">
                  <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground text-sm font-bold">
                    2
                  </div>
                  <div>
                    <h4 className="font-semibold mb-1">Esegui la scansione di sicurezza</h4>
                    <p className="text-sm text-muted-foreground">
                      Il sistema analizza automaticamente il modello per rilevare backdoor, data poisoning, anomalie e vulnerabilità.
                    </p>
                  </div>
                </div>
              </div>
              
              <div className="space-y-2">
                <div className="flex items-start gap-3">
                  <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground text-sm font-bold">
                    3
                  </div>
                  <div>
                    <h4 className="font-semibold mb-1">Analizza il Trust Score</h4>
                    <p className="text-sm text-muted-foreground">
                      Ricevi un punteggio di affidabilità (0-100%) e il livello di rischio (low, medium, high, critical) del tuo modello.
                    </p>
                  </div>
                </div>
              </div>
              
              <div className="space-y-2">
                <div className="flex items-start gap-3">
                  <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground text-sm font-bold">
                    4
                  </div>
                  <div>
                    <h4 className="font-semibold mb-1">Genera report di conformità</h4>
                    <p className="text-sm text-muted-foreground">
                      Esporta report dettagliati per AI Act e Cyber Resilience Act. Abilita il monitoring continuo per controlli automatici.
                    </p>
                  </div>
                </div>
              </div>
            </div>
            
            <div className="mt-4 p-4 bg-accent/10 border border-accent/20 rounded-lg">
              <p className="text-sm">
                <strong>💡 Nota:</strong> AI Sentinel utilizza algoritmi avanzati di anomaly detection e analisi forense per garantire 
                l'integrità dei tuoi modelli AI e la conformità alle normative europee.
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-muted-foreground">Modelli Totali</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.totalModels}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-muted-foreground">Rischi Critici</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-destructive">{stats.criticalRisks}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-muted-foreground">Trust Score Medio</CardTitle>
            </CardHeader>
            <CardContent>
              <div className={`text-2xl font-bold ${getTrustScoreColor(stats.averageTrustScore)}`}>
                {stats.averageTrustScore}%
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-muted-foreground">Monitor Attivi</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.activeMonitors}</div>
            </CardContent>
          </Card>
        </div>

        {/* Main Content */}
        <Tabs defaultValue="models" className="space-y-6">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="models">
              <FileCheck className="h-4 w-4 mr-2" />
              Modelli
            </TabsTrigger>
            <TabsTrigger value="scan">
              <Activity className="h-4 w-4 mr-2" />
              Scan
            </TabsTrigger>
            <TabsTrigger value="monitoring">
              <Clock className="h-4 w-4 mr-2" />
              Monitoring
            </TabsTrigger>
            <TabsTrigger value="reports">
              <TrendingUp className="h-4 w-4 mr-2" />
              Report
            </TabsTrigger>
          </TabsList>

          <TabsContent value="models" className="space-y-4">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>Modelli AI Registrati</CardTitle>
                    <CardDescription>
                      Gestisci e analizza i tuoi modelli di intelligenza artificiale
                    </CardDescription>
                  </div>
                  <Button onClick={() => navigate('/ai-sentinel/upload')}>
                    <Upload className="h-4 w-4 mr-2" />
                    Carica Modello
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                {isLoading ? (
                  <div className="text-center py-8 text-muted-foreground">Caricamento...</div>
                ) : models.length === 0 ? (
                  <div className="text-center py-12">
                    <Shield className="h-16 w-16 mx-auto text-muted-foreground mb-4" />
                    <h3 className="text-lg font-semibold mb-2">Nessun modello caricato</h3>
                    <p className="text-muted-foreground mb-4">
                      Inizia caricando il tuo primo modello AI per l'analisi di sicurezza
                    </p>
                    <Button onClick={() => navigate('/ai-sentinel/upload')}>
                      <Upload className="h-4 w-4 mr-2" />
                      Carica il tuo primo modello
                    </Button>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {models.map((model) => {
                      const latestScan = model.model_scans?.[0];
                      return (
                        <Card key={model.id} className="hover:border-primary cursor-pointer transition-colors">
                          <CardContent className="pt-6">
                            <div className="flex items-start justify-between">
                              <div className="flex-1">
                                <div className="flex items-center gap-3 mb-2">
                                  <h3 className="font-semibold text-lg">{model.name}</h3>
                                  {latestScan && getRiskBadge(latestScan.risk_level)}
                                </div>
                                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                                  <div>
                                    <span className="text-muted-foreground">Tipo:</span>
                                    <p className="font-medium">{model.model_type}</p>
                                  </div>
                                  <div>
                                    <span className="text-muted-foreground">Dimensione:</span>
                                    <p className="font-medium">
                                      {(model.file_size / 1024 / 1024).toFixed(2)} MB
                                    </p>
                                  </div>
                                  <div>
                                    <span className="text-muted-foreground">Status:</span>
                                    <p className="font-medium capitalize">{model.status}</p>
                                  </div>
                                  {latestScan && (
                                    <div>
                                      <span className="text-muted-foreground">Trust Score:</span>
                                      <p className={`font-bold ${getTrustScoreColor(latestScan.trust_score)}`}>
                                        {latestScan.trust_score}%
                                      </p>
                                    </div>
                                  )}
                                </div>
                                {latestScan && (
                                  <div className="mt-3">
                                    <Progress value={latestScan.trust_score} className="h-2" />
                                  </div>
                                )}
                              </div>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => navigate(`/ai-sentinel/model/${model.id}`)}
                              >
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

          <TabsContent value="scan">
            <Card>
              <CardHeader>
                <CardTitle>Model Integrity Scanner</CardTitle>
                <CardDescription>
                  Esegui scansioni di sicurezza sui tuoi modelli AI
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="text-center py-12">
                  <Activity className="h-16 w-16 mx-auto text-muted-foreground mb-4" />
                  <p className="text-muted-foreground mb-4">
                    Seleziona un modello dalla tab "Modelli" per avviare una scansione
                  </p>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="monitoring">
            <Card>
              <CardHeader>
                <CardTitle>Continuous Monitoring</CardTitle>
                <CardDescription>
                  Pianifica controlli periodici automatici sui modelli
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="text-center py-12">
                  <Clock className="h-16 w-16 mx-auto text-muted-foreground mb-4" />
                  <p className="text-muted-foreground">
                    Funzionalità di monitoring continuo disponibile nella versione completa
                  </p>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="reports">
            <Card>
              <CardHeader>
                <CardTitle>Compliance Reports</CardTitle>
                <CardDescription>
                  Report di conformità AI Act e Cyber Resilience Act
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="text-center py-12">
                  <TrendingUp className="h-16 w-16 mx-auto text-muted-foreground mb-4" />
                  <p className="text-muted-foreground">
                    Generazione report PDF/API disponibile dopo le prime scansioni
                  </p>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
};

export default AISentinel;
