import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Shield, ArrowLeft, Activity, FileCheck, Download, Play, AlertCircle, CheckCircle, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import ReactMarkdown from "react-markdown";

const AISentinelModel = () => {
  const { modelId } = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [model, setModel] = useState<any>(null);
  const [scans, setScans] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isScanning, setIsScanning] = useState(false);
  const [selectedScanType, setSelectedScanType] = useState("integrity");

  useEffect(() => {
    fetchModelData();
  }, [modelId]);

  const fetchModelData = async () => {
    try {
      // Fetch model
      const { data: modelData, error: modelError } = await supabase
        .from('ai_models')
        .select('*')
        .eq('id', modelId)
        .single();

      if (modelError) throw modelError;
      setModel(modelData);

      // Fetch scans
      const { data: scansData, error: scansError } = await supabase
        .from('model_scans')
        .select('*')
        .eq('model_id', modelId)
        .order('scan_date', { ascending: false });

      if (scansError) throw scansError;
      setScans(scansData || []);

      // Fetch provenance
      const { data: provenanceData } = await supabase
        .from('model_provenance')
        .select('*')
        .eq('model_id', modelId)
        .single();

      if (provenanceData) {
        setModel((prev: any) => ({ ...prev, provenance: provenanceData }));
      }

    } catch (error: any) {
      console.error('Error fetching model:', error);
      toast({
        title: "Errore",
        description: "Impossibile caricare i dati del modello",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const startScan = async () => {
    setIsScanning(true);
    try {
      const { data, error } = await supabase.functions.invoke('analyze-ai-model', {
        body: { modelId, scanType: selectedScanType }
      });

      if (error) throw error;

      toast({
        title: "Scansione completata",
        description: `Trust Score: ${data.trustScore}% | Risk Level: ${data.riskLevel.toUpperCase()}`,
      });

      // Refresh data
      await fetchModelData();

    } catch (error: any) {
      console.error('Scan error:', error);
      toast({
        title: "Errore durante la scansione",
        description: error.message || "Si è verificato un errore",
        variant: "destructive",
      });
    } finally {
      setIsScanning(false);
    }
  };

  const getRiskIcon = (riskLevel: string) => {
    if (riskLevel === 'low') return <CheckCircle className="h-5 w-5 text-green-600" />;
    if (riskLevel === 'medium') return <AlertCircle className="h-5 w-5 text-yellow-600" />;
    return <AlertCircle className="h-5 w-5 text-red-600" />;
  };

  const getTrustScoreColor = (score: number) => {
    if (score >= 85) return "bg-green-500";
    if (score >= 70) return "bg-yellow-500";
    if (score >= 50) return "bg-orange-500";
    return "bg-red-500";
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <Shield className="h-12 w-12 mx-auto mb-4 text-primary animate-pulse" />
          <p>Caricamento...</p>
        </div>
      </div>
    );
  }

  if (!model) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <AlertCircle className="h-12 w-12 mx-auto mb-4 text-destructive" />
          <p>Modello non trovato</p>
          <Button className="mt-4" onClick={() => navigate('/ai-sentinel')}>
            Torna a Sentinel
          </Button>
        </div>
      </div>
    );
  }

  const latestScan = scans[0];

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-8 max-w-7xl">
        <Button
          variant="ghost"
          onClick={() => navigate('/ai-sentinel')}
          className="mb-6"
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          Torna a Sentinel
        </Button>

        {/* Model Header */}
        <div className="mb-8">
          <div className="flex items-start justify-between mb-4">
            <div>
              <h1 className="text-3xl font-bold mb-2">{model.name}</h1>
              <p className="text-muted-foreground">
                {model.model_type} • {(model.file_size / 1024 / 1024).toFixed(2)} MB
              </p>
            </div>
            {latestScan && (
              <div className="text-right">
                <div className="text-sm text-muted-foreground mb-1">Trust Score</div>
                <div className={`text-4xl font-bold ${latestScan.trust_score >= 85 ? 'text-green-600' : latestScan.trust_score >= 70 ? 'text-yellow-600' : 'text-red-600'}`}>
                  {latestScan.trust_score}%
                </div>
              </div>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <Card>
              <CardContent className="pt-6">
                <div className="text-sm text-muted-foreground mb-1">Status</div>
                <Badge variant={model.status === 'completed' ? 'default' : 'secondary'}>
                  {model.status}
                </Badge>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="pt-6">
                <div className="text-sm text-muted-foreground mb-1">Hash SHA-256</div>
                <code className="text-xs font-mono">{model.file_hash.substring(0, 16)}...</code>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="pt-6">
                <div className="text-sm text-muted-foreground mb-1">Scansioni Totali</div>
                <div className="text-2xl font-bold">{scans.length}</div>
              </CardContent>
            </Card>

            {latestScan && (
              <Card>
                <CardContent className="pt-6">
                  <div className="text-sm text-muted-foreground mb-1">Risk Level</div>
                  <div className="flex items-center gap-2">
                    {getRiskIcon(latestScan.risk_level)}
                    <span className="font-semibold uppercase">{latestScan.risk_level}</span>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        </div>

        {/* Main Content */}
        <Tabs defaultValue="scan" className="space-y-6">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="scan">
              <Activity className="h-4 w-4 mr-2" />
              Scan
            </TabsTrigger>
            <TabsTrigger value="results">
              <FileCheck className="h-4 w-4 mr-2" />
              Risultati
            </TabsTrigger>
            <TabsTrigger value="provenance">
              <Shield className="h-4 w-4 mr-2" />
              Provenance
            </TabsTrigger>
            <TabsTrigger value="compliance">
              <CheckCircle className="h-4 w-4 mr-2" />
              Compliance
            </TabsTrigger>
          </TabsList>

          {/* Scan Tab */}
          <TabsContent value="scan">
            <Card>
              <CardHeader>
                <CardTitle>Avvia Nuova Scansione</CardTitle>
                <CardDescription>
                  Seleziona il tipo di analisi da eseguire sul modello
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Tipo di Scansione</label>
                  <Select value={selectedScanType} onValueChange={setSelectedScanType}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="integrity">
                        <div>
                          <div className="font-semibold">Integrity Scan</div>
                          <div className="text-xs text-muted-foreground">
                            Verifica hash, tampering, anomalie strutturali
                          </div>
                        </div>
                      </SelectItem>
                      <SelectItem value="anomaly">
                        <div>
                          <div className="font-semibold">Anomaly Detection</div>
                          <div className="text-xs text-muted-foreground">
                            Backdoor, data poisoning, weight anomalies
                          </div>
                        </div>
                      </SelectItem>
                      <SelectItem value="compliance">
                        <div>
                          <div className="font-semibold">Compliance Check</div>
                          <div className="text-xs text-muted-foreground">
                            AI Act, CRA, GDPR, NIS2 requirements
                          </div>
                        </div>
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <Button
                  onClick={startScan}
                  disabled={isScanning}
                  className="w-full"
                  size="lg"
                >
                  {isScanning ? (
                    <>
                      <Clock className="h-4 w-4 mr-2 animate-spin" />
                      Scansione in corso...
                    </>
                  ) : (
                    <>
                      <Play className="h-4 w-4 mr-2" />
                      Avvia Scansione
                    </>
                  )}
                </Button>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Results Tab */}
          <TabsContent value="results">
            {scans.length === 0 ? (
              <Card>
                <CardContent className="py-12 text-center">
                  <FileCheck className="h-16 w-16 mx-auto text-muted-foreground mb-4" />
                  <h3 className="text-lg font-semibold mb-2">Nessuna scansione disponibile</h3>
                  <p className="text-muted-foreground mb-4">
                    Avvia la prima scansione per visualizzare i risultati
                  </p>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-4">
                {scans.map((scan) => (
                  <Card key={scan.id}>
                    <CardHeader>
                      <div className="flex items-center justify-between">
                        <div>
                          <CardTitle className="text-lg">
                            {scan.scan_type.toUpperCase()} Scan
                          </CardTitle>
                          <CardDescription>
                            {new Date(scan.scan_date).toLocaleString('it-IT')}
                            {scan.scan_duration_ms && ` • ${(scan.scan_duration_ms / 1000).toFixed(2)}s`}
                          </CardDescription>
                        </div>
                        <div className="text-right">
                          <div className="text-2xl font-bold mb-1">
                            {scan.trust_score}%
                          </div>
                          <Badge variant={scan.risk_level === 'low' ? 'default' : 'destructive'}>
                            {scan.risk_level}
                          </Badge>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div>
                        <div className="flex justify-between text-sm mb-2">
                          <span>Trust Score</span>
                          <span>{scan.trust_score}%</span>
                        </div>
                        <Progress value={scan.trust_score} className={`h-2 ${getTrustScoreColor(scan.trust_score)}`} />
                      </div>

                      {scan.findings && scan.findings.length > 0 && (
                        <div>
                          <h4 className="font-semibold mb-3">Findings ({scan.findings.length})</h4>
                          <div className="space-y-3">
                            {scan.findings.map((finding: any, idx: number) => (
                              <Card key={idx} className="border-l-4 border-l-yellow-500">
                                <CardContent className="pt-4">
                                  <div className="flex items-start justify-between mb-2">
                                    <h5 className="font-semibold">{finding.title}</h5>
                                    <Badge variant={finding.severity === 'critical' ? 'destructive' : 'secondary'}>
                                      {finding.severity}
                                    </Badge>
                                  </div>
                                  <p className="text-sm text-muted-foreground mb-2">{finding.description}</p>
                                  {finding.evidence && (
                                    <p className="text-xs text-muted-foreground">
                                      <strong>Evidence:</strong> {finding.evidence}
                                    </p>
                                  )}
                                  {finding.regulation && (
                                    <p className="text-xs text-muted-foreground mt-1">
                                      <strong>Regulation:</strong> {finding.regulation}
                                    </p>
                                  )}
                                </CardContent>
                              </Card>
                            ))}
                          </div>
                        </div>
                      )}

                      {scan.recommendations && scan.recommendations.length > 0 && (
                        <div>
                          <h4 className="font-semibold mb-3">Raccomandazioni</h4>
                          <div className="space-y-2">
                            {scan.recommendations.map((rec: any, idx: number) => (
                              <div key={idx} className="flex gap-2 text-sm">
                                <CheckCircle className="h-4 w-4 text-primary flex-shrink-0 mt-0.5" />
                                <div>
                                  <strong>{rec.action}</strong>
                                  {rec.description && (
                                    <p className="text-muted-foreground">{rec.description}</p>
                                  )}
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>

          {/* Provenance Tab */}
          <TabsContent value="provenance">
            <Card>
              <CardHeader>
                <CardTitle>Supply Chain & Provenance</CardTitle>
                <CardDescription>
                  Tracciamento della catena di provenienza del modello
                </CardDescription>
              </CardHeader>
              <CardContent>
                {model.provenance ? (
                  <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      {model.provenance.source_organization && (
                        <div>
                          <div className="text-sm text-muted-foreground">Organizzazione</div>
                          <div className="font-medium">{model.provenance.source_organization}</div>
                        </div>
                      )}
                      {model.provenance.version && (
                        <div>
                          <div className="text-sm text-muted-foreground">Versione</div>
                          <div className="font-medium">{model.provenance.version}</div>
                        </div>
                      )}
                      {model.provenance.source_url && (
                        <div className="col-span-2">
                          <div className="text-sm text-muted-foreground">URL Sorgente</div>
                          <a href={model.provenance.source_url} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">
                            {model.provenance.source_url}
                          </a>
                        </div>
                      )}
                      <div>
                        <div className="text-sm text-muted-foreground">Stato Verifica</div>
                        <Badge variant={model.provenance.verification_status === 'verified' ? 'default' : 'secondary'}>
                          {model.provenance.verification_status}
                        </Badge>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-8 text-muted-foreground">
                    Nessuna informazione di provenance disponibile
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Compliance Tab */}
          <TabsContent value="compliance">
            <Card>
              <CardHeader>
                <CardTitle>Compliance Status</CardTitle>
                <CardDescription>
                  Conformità alle normative EU AI Act e Cyber Resilience Act
                </CardDescription>
              </CardHeader>
              <CardContent>
                {latestScan?.compliance_status ? (
                  <div className="space-y-6">
                    <div>
                      <div className="flex items-center justify-between mb-4">
                        <h3 className="font-semibold">Overall Status</h3>
                        <Badge variant={latestScan.compliance_status.overall_status === 'compliant' ? 'default' : 'destructive'}>
                          {latestScan.compliance_status.overall_status}
                        </Badge>
                      </div>
                    </div>

                    <div>
                      <h3 className="font-semibold mb-3">EU AI Act</h3>
                      <div className="space-y-2">
                        {Object.entries(latestScan.compliance_status.ai_act || {}).map(([article, data]: [string, any]) => (
                          <div key={article} className="flex items-center justify-between p-3 border rounded-lg">
                            <span className="font-medium capitalize">{article.replace('_', ' ')}</span>
                            <div className="flex items-center gap-2">
                              {data.compliant ? (
                                <CheckCircle className="h-5 w-5 text-green-600" />
                              ) : (
                                <AlertCircle className="h-5 w-5 text-red-600" />
                              )}
                              <span className="text-sm">{data.compliant ? 'Compliant' : 'Non-compliant'}</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div>
                      <h3 className="font-semibold mb-3">Cyber Resilience Act</h3>
                      <div className="space-y-2">
                        {Object.entries(latestScan.compliance_status.cra || {}).map(([req, data]: [string, any]) => (
                          <div key={req} className="flex items-center justify-between p-3 border rounded-lg">
                            <span className="font-medium capitalize">{req.replace('_', ' ')}</span>
                            <div className="flex items-center gap-2">
                              {data.compliant ? (
                                <CheckCircle className="h-5 w-5 text-green-600" />
                              ) : (
                                <AlertCircle className="h-5 w-5 text-red-600" />
                              )}
                              <span className="text-sm">{data.compliant ? 'Compliant' : 'Non-compliant'}</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-8 text-muted-foreground">
                    Esegui una scansione di compliance per visualizzare lo status
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
};

export default AISentinelModel;
