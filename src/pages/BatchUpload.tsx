import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { ArrowLeft, Upload, CheckCircle2, XCircle, AlertCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface UploadResult {
  title: string;
  status: 'success' | 'error' | 'skipped';
  chunks?: number;
  error?: string;
  reason?: string;
}

const BatchUpload = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [results, setResults] = useState<UploadResult[]>([]);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [checkingAuth, setCheckingAuth] = useState(true);
  const [monitoring, setMonitoring] = useState(false);
  const [monitorResults, setMonitorResults] = useState<any>(null);

  // Check authentication on mount
  useEffect(() => {
    const checkAuth = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        toast({
          title: "Autenticazione richiesta",
          description: "Effettua il login per accedere a questa pagina",
          variant: "destructive",
        });
        navigate("/auth");
        return;
      }
      setIsAuthenticated(true);
      setCheckingAuth(false);
    };
    
    checkAuth();
  }, [navigate, toast]);

  // Documenti ufficiali già parsati
  const officialDocuments = [
    {
      title: "Direttiva NIS 2 - Versione Ufficiale",
      version: "Directive (EU) 2022/2555",
      jurisdiction: "EU",
      sector: "cybersecurity",
      language: "IT",
      source_url: "https://eur-lex.europa.eu/legal-content/IT/TXT/?uri=CELEX:32022L2555",
      contentFile: "CELEX_32022L2555_IT_TXT.pdf"
    },
    {
      title: "GDPR Completo con Considerando",
      version: "Regulation (EU) 2016/679",
      jurisdiction: "EU",
      sector: "data_protection",
      language: "IT",
      source_url: "https://eur-lex.europa.eu/legal-content/IT/TXT/?uri=CELEX:32016R0679",
      contentFile: "Regolamento_UE_2016_679.pdf"
    },
    {
      title: "DORA - Digital Operational Resilience Act",
      version: "Regulation (EU) 2022/2554",
      jurisdiction: "EU",
      sector: "financial",
      language: "IT",
      source_url: "https://eur-lex.europa.eu/legal-content/IT/TXT/?uri=CELEX:32022R2554",
      contentFile: "CELEX_32022R2554_IT_TXT.pdf"
    },
    {
      title: "Cyber Resilience Act (CRA)",
      version: "Regulation (EU) 2024/2847",
      jurisdiction: "EU",
      sector: "cybersecurity",
      language: "IT",
      source_url: "https://eur-lex.europa.eu/legal-content/IT/TXT/?uri=OJ:L_202402847",
      contentFile: "OJ_L_202402847_IT_TXT.pdf"
    },
    {
      title: "AI Act - Regolamento sull'Intelligenza Artificiale",
      version: "Regulation (EU) 2024/1689",
      jurisdiction: "EU",
      sector: "technology",
      language: "IT",
      source_url: "https://eur-lex.europa.eu/legal-content/IT/TXT/?uri=OJ:L_202401689",
      contentFile: "OJ_L_202401689_IT_TXT_1.pdf"
    },
    {
      title: "Direttiva CER - Critical Entities Resilience",
      version: "Directive (EU) 2022/2557",
      jurisdiction: "EU",
      sector: "critical_infrastructure",
      language: "IT",
      source_url: "https://eur-lex.europa.eu/legal-content/IT/TXT/?uri=CELEX:32022L2557",
      contentFile: "AIIC-2024-Direttiva-CER.pdf"
    }
  ];

  const handleMonitorEurLex = async () => {
    setMonitoring(true);
    setMonitorResults(null);

    try {
      toast({
        title: "Monitoraggio in corso",
        description: "Controllo aggiornamenti su EUR-Lex...",
      });

      const { data, error } = await supabase.functions.invoke('monitor-eur-lex');

      if (error) throw error;

      setMonitorResults(data);

      toast({
        title: "Monitoraggio completato",
        description: data.message,
      });

    } catch (error) {
      console.error('Monitor error:', error);
      toast({
        title: "Errore",
        description: error instanceof Error ? error.message : "Errore durante il monitoraggio",
        variant: "destructive",
      });
    } finally {
      setMonitoring(false);
    }
  };

  const handleBatchUpload = async () => {
    setLoading(true);
    setProgress(0);
    setResults([]);

    try {
      toast({
        title: "Caricamento in corso",
        description: "Sto processando i documenti ufficiali...",
      });

      // Prepara i documenti con contenuto mock (in produzione useresti il contenuto reale)
      const documents = officialDocuments.map(doc => ({
        title: doc.title,
        version: doc.version,
        jurisdiction: doc.jurisdiction,
        sector: doc.sector,
        language: doc.language,
        source_url: doc.source_url,
        content: generateMockContent(doc.title, doc.version)
      }));

      setProgress(30);

      // Get session for authorization
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session) {
        throw new Error('Devi essere autenticato per caricare i documenti');
      }
      
      const { data, error } = await supabase.functions.invoke('batch-upload-documents', {
        body: { documents }
      });

      if (error) throw error;

      setProgress(100);
      setResults(data.results);

      const successCount = data.results.filter((r: UploadResult) => r.status === 'success').length;
      const errorCount = data.results.filter((r: UploadResult) => r.status === 'error').length;
      const skippedCount = data.results.filter((r: UploadResult) => r.status === 'skipped').length;

      toast({
        title: "Caricamento completato",
        description: `${successCount} documenti caricati, ${skippedCount} già esistenti, ${errorCount} errori`,
      });

    } catch (error) {
      console.error('Batch upload error:', error);
      toast({
        title: "Errore",
        description: error instanceof Error ? error.message : "Errore durante il caricamento",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  // Generate mock content per i documenti
  const generateMockContent = (title: string, version: string): string => {
    const sections = [];
    
    if (title.includes("NIS 2")) {
      sections.push(
        "DIRETTIVA (UE) 2022/2555 - NIS 2\n\n",
        "CAPITOLO I - DISPOSIZIONI GENERALI\n\n",
        "Articolo 1 - Oggetto e ambito di applicazione\n",
        "La presente direttiva stabilisce misure volte a garantire un livello comune elevato di cibersicurezza nell'Unione.\n\n",
        "Articolo 6 - Strategia nazionale di cibersicurezza\n",
        "Gli Stati membri adottano una strategia nazionale di cibersicurezza che definisce gli obiettivi strategici e le misure appropriate.\n\n",
        "CAPITOLO IV - OBBLIGHI DI SICUREZZA E NOTIFICA\n\n",
        "Articolo 21 - Misure di gestione dei rischi di cibersicurezza\n",
        "Le entità essenziali e importanti adottano misure tecniche, operative e organizzative per gestire i rischi di cibersicurezza."
      );
    } else if (title.includes("GDPR")) {
      sections.push(
        "REGOLAMENTO (UE) 2016/679 - GDPR\n\n",
        "CAPO I - DISPOSIZIONI GENERALI\n\n",
        "Articolo 4 - Definizioni\n",
        "Ai fini del presente regolamento si intende per:\n",
        "1) «dato personale»: qualsiasi informazione riguardante una persona fisica identificata o identificabile;\n",
        "2) «trattamento»: qualsiasi operazione o insieme di operazioni sui dati personali;\n\n",
        "CAPO II - PRINCIPI\n\n",
        "Articolo 5 - Principi applicabili al trattamento dei dati personali\n",
        "I dati personali devono essere:\n",
        "a) trattati in modo lecito, corretto e trasparente;\n",
        "b) raccolti per finalità determinate, esplicite e legittime;\n\n",
        "Articolo 30 - Registri delle attività di trattamento\n",
        "Il titolare del trattamento tiene un registro delle attività di trattamento svolte sotto la propria responsabilità."
      );
    } else if (title.includes("DORA")) {
      sections.push(
        "REGOLAMENTO (UE) 2022/2554 - DORA\n\n",
        "CAPO I - DISPOSIZIONI GENERALI\n\n",
        "Articolo 1 - Oggetto\n",
        "Il presente regolamento stabilisce requisiti uniformi concernenti la resilienza operativa digitale per le entità finanziarie.\n\n",
        "CAPO II - GESTIONE DEI RISCHI TIC\n\n",
        "Articolo 6 - Quadro di gestione dei rischi TIC\n",
        "Le entità finanziarie dispongono di un quadro di gestione dei rischi TIC interno solido, completo e ben documentato."
      );
    } else if (title.includes("CRA") || title.includes("Cyber Resilience")) {
      sections.push(
        "REGOLAMENTO (UE) 2024/2847 - CYBER RESILIENCE ACT\n\n",
        "CAPO I - DISPOSIZIONI GENERALI\n\n",
        "Articolo 1 - Oggetto e ambito di applicazione\n",
        "Il presente regolamento stabilisce requisiti di cibersicurezza per prodotti con elementi digitali.\n\n",
        "CAPO II - OBBLIGHI DEGLI OPERATORI ECONOMICI\n\n",
        "Articolo 13 - Obblighi dei fabbricanti\n",
        "I fabbricanti garantiscono che i prodotti con elementi digitali siano progettati, sviluppati e prodotti conformemente ai requisiti essenziali."
      );
    } else if (title.includes("AI Act")) {
      sections.push(
        "REGOLAMENTO (UE) 2024/1689 - AI ACT\n\n",
        "CAPO I - DISPOSIZIONI GENERALI\n\n",
        "Articolo 1 - Oggetto\n",
        "Il presente regolamento stabilisce regole armonizzate sull'intelligenza artificiale.\n\n",
        "CAPO II - PRATICHE DI IA VIETATE\n\n",
        "Articolo 5 - Pratiche vietate\n",
        "Sono vietate le seguenti pratiche di intelligenza artificiale:\n",
        "a) immissione sul mercato di sistemi di IA che utilizzano tecniche subliminali;\n\n",
        "CAPO III - SISTEMI DI IA AD ALTO RISCHIO\n\n",
        "Articolo 6 - Classificazione dei sistemi di IA ad alto rischio\n",
        "Un sistema di IA è considerato ad alto rischio quando soddisfa determinati criteri."
      );
    } else if (title.includes("CER") || title.includes("Critical Entities")) {
      sections.push(
        "DIRETTIVA (UE) 2022/2557 - CRITICAL ENTITIES RESILIENCE (CER)\n\n",
        "CAPO I - DISPOSIZIONI GENERALI\n\n",
        "Articolo 1 - Oggetto\n",
        "La presente direttiva stabilisce norme per rafforzare la resilienza dei soggetti critici.\n\n",
        "Articolo 2 - Ambito di applicazione\n",
        "La presente direttiva si applica ai soggetti critici che forniscono servizi essenziali nei settori elencati nell'allegato.\n\n",
        "CAPO II - IDENTIFICAZIONE DEI SOGGETTI CRITICI\n\n",
        "Articolo 5 - Identificazione dei soggetti critici\n",
        "Gli Stati membri identificano i soggetti critici sulla base dei criteri stabiliti.\n\n",
        "CAPO III - MISURE DI RESILIENZA\n\n",
        "Articolo 11 - Valutazione dei rischi\n",
        "I soggetti critici effettuano valutazioni dei rischi che tengono conto dei rischi naturali e umani, compresi eventi meteorologici estremi e attacchi terroristici.\n\n",
        "Articolo 12 - Misure per rafforzare la resilienza\n",
        "I soggetti critici adottano misure tecniche e organizzative per garantire la continuità della fornitura dei servizi essenziali."
      );
    }

    return sections.join("");
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'success':
        return <CheckCircle2 className="h-5 w-5 text-green-500" />;
      case 'error':
        return <XCircle className="h-5 w-5 text-red-500" />;
      case 'skipped':
        return <AlertCircle className="h-5 w-5 text-yellow-500" />;
      default:
        return null;
    }
  };

  if (checkingAuth) {
    return (
      <div className="container mx-auto py-8 px-4">
        <div className="text-center">
          <p>Verifica autenticazione...</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return null;
  }

  return (
    <div className="container mx-auto py-8 px-4">
      <div className="mb-6 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate("/chat")}
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-3xl font-bold">Caricamento Batch Documenti</h1>
            <p className="text-muted-foreground">
              Carica i documenti normativi ufficiali nel sistema RAG
            </p>
          </div>
        </div>
      </div>

      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Monitoraggio Automatico EUR-Lex</CardTitle>
          <CardDescription>
            Controlla se ci sono aggiornamenti per le normative monitorate
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Button
            onClick={handleMonitorEurLex}
            disabled={monitoring}
            className="w-full"
            variant="outline"
          >
            {monitoring ? 'Monitoraggio in corso...' : 'Controlla Aggiornamenti su EUR-Lex'}
          </Button>

          {monitorResults && (
            <div className="space-y-4 mt-4">
              <div className="grid grid-cols-4 gap-4 text-center">
                <div className="p-3 border rounded-lg">
                  <p className="text-2xl font-bold">{monitorResults.summary.total}</p>
                  <p className="text-sm text-muted-foreground">Totali</p>
                </div>
                <div className="p-3 border rounded-lg bg-green-50 dark:bg-green-950">
                  <p className="text-2xl font-bold text-green-600">{monitorResults.summary.existing}</p>
                  <p className="text-sm text-muted-foreground">Presenti</p>
                </div>
                <div className="p-3 border rounded-lg bg-yellow-50 dark:bg-yellow-950">
                  <p className="text-2xl font-bold text-yellow-600">{monitorResults.summary.missing}</p>
                  <p className="text-sm text-muted-foreground">Mancanti</p>
                </div>
                <div className="p-3 border rounded-lg bg-red-50 dark:bg-red-950">
                  <p className="text-2xl font-bold text-red-600">{monitorResults.summary.errors}</p>
                  <p className="text-sm text-muted-foreground">Errori</p>
                </div>
              </div>

              <div className="space-y-2">
                <h4 className="font-semibold">Dettagli:</h4>
                {monitorResults.results.map((result: any, idx: number) => (
                  <div key={idx} className="p-3 border rounded-lg text-sm">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-medium">{result.regulation}</p>
                        <p className="text-muted-foreground">CELEX: {result.celex}</p>
                        {result.lastModified && (
                          <p className="text-xs text-muted-foreground">Ultima modifica: {result.lastModified}</p>
                        )}
                      </div>
                      <div className={`px-3 py-1 rounded-full text-xs font-medium ${
                        result.status === 'existing' 
                          ? 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300'
                          : result.status === 'missing'
                          ? 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900 dark:text-yellow-300'
                          : 'bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300'
                      }`}>
                        {result.status === 'existing' ? 'Presente' : result.status === 'missing' ? 'Mancante' : 'Errore'}
                      </div>
                    </div>
                    {result.reason && (
                      <p className="text-xs text-muted-foreground mt-2">{result.reason}</p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Caricamento Manuale Documenti</CardTitle>
          <CardDescription>
            Carica manualmente i documenti normativi nel database
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-2">
            {officialDocuments.map((doc, idx) => (
              <div key={idx} className="flex items-center justify-between p-3 border rounded-lg">
                <div>
                  <p className="font-medium">{doc.title}</p>
                  <p className="text-sm text-muted-foreground">{doc.version}</p>
                </div>
                <div className="text-sm text-muted-foreground">
                  {doc.jurisdiction} | {doc.sector}
                </div>
              </div>
            ))}
          </div>

          <Button
            onClick={handleBatchUpload}
            disabled={loading}
            className="w-full"
            size="lg"
          >
            <Upload className="mr-2 h-5 w-5" />
            {loading ? 'Caricamento in corso...' : 'Carica Tutti i Documenti'}
          </Button>

          {loading && (
            <div className="space-y-2">
              <Progress value={progress} />
              <p className="text-sm text-center text-muted-foreground">
                Processamento in corso... {progress}%
              </p>
            </div>
          )}

          {results.length > 0 && (
            <div className="space-y-2">
              <h3 className="font-semibold">Risultati</h3>
              {results.map((result, idx) => (
                <div key={idx} className="flex items-center justify-between p-3 border rounded-lg">
                  <div className="flex items-center gap-3">
                    {getStatusIcon(result.status)}
                    <div>
                      <p className="font-medium">{result.title}</p>
                      {result.chunks && (
                        <p className="text-sm text-muted-foreground">
                          {result.chunks} chunks creati
                        </p>
                      )}
                      {result.error && (
                        <p className="text-sm text-red-500">{result.error}</p>
                      )}
                      {result.reason && (
                        <p className="text-sm text-yellow-600">{result.reason}</p>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default BatchUpload;
