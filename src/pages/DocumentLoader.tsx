import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { useToast } from "@/hooks/use-toast";
import { Shield, Upload, CheckCircle2, XCircle, Loader2 } from "lucide-react";

interface RegulationSource {
  title: string;
  pdf_url: string;
  version: string;
  jurisdiction: string;
  sector: string;
  language: string;
  source_url: string;
}

const DocumentLoader = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [processedDocs, setProcessedDocs] = useState<string[]>([]);
  const [failedDocs, setFailedDocs] = useState<string[]>([]);
  const [isAdmin, setIsAdmin] = useState(false);
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    const checkAdminRole = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        
        if (!user) {
          sessionStorage.setItem('auth_redirect', '/documents/load');
          toast({
            title: "Accesso richiesto",
            description: "Effettua l'accesso per gestire i documenti",
          });
          navigate('/auth');
          return;
        }

        const { data, error } = await supabase.rpc('has_role', {
          _user_id: user.id,
          _role: 'admin'
        });

        if (error || !data) {
          console.error('Admin check failed:', error);
          toast({
            title: "Accesso Negato",
            description: "Questa funzione è riservata agli amministratori del sistema.",
            variant: "destructive"
          });
          navigate('/chat');
          return;
        }

        setIsAdmin(true);
      } catch (error) {
        console.error('Error:', error);
        toast({
          title: "Accesso Negato",
          description: "Errore durante la verifica dei permessi.",
          variant: "destructive"
        });
        navigate('/chat');
      } finally {
        setChecking(false);
      }
    };

    checkAdminRole();
  }, [navigate, toast]);

  const loadFromManifest = async () => {
    setLoading(true);
    setProgress(0);
    setProcessedDocs([]);
    setFailedDocs([]);

    try {
      // Load manifest
      const manifestResponse = await fetch('/manifest_normative_rag.json');
      const manifest = await manifestResponse.json();
      
      const totalDocs = manifest.length;
      let processed = 0;

      for (const item of manifest) {
        try {
          // Check if already exists
          const { data: existing } = await supabase
            .from('documents')
            .select('id')
            .eq('title', item.titolo)
            .eq('version', item.numero)
            .maybeSingle();

          if (existing) {
            console.log(`Skipping ${item.titolo} - already exists`);
            setProcessedDocs(prev => [...prev, `${item.titolo} (già presente)`]);
          } else {
            console.log(`Processing: ${item.titolo}`);
            
            const { error } = await supabase.functions.invoke('process-document', {
              body: {
                pdf_url: item.url_pdf,
                title: item.titolo,
                version: item.numero,
                jurisdiction: item.lingua === 'IT' ? 'IT' : 'EU',
                sector: 'general',
                source_url: item.url_pdf,
                language: item.lingua,
              }
            });

            if (error) throw error;

            setProcessedDocs(prev => [...prev, item.titolo]);
            toast({
              title: "Documento caricato",
              description: item.titolo,
            });

            // Delay to avoid overwhelming the system
            await new Promise(resolve => setTimeout(resolve, 3000));
          }
        } catch (error: any) {
          console.error('Error processing', item.titolo, error);
          setFailedDocs(prev => [...prev, `${item.titolo}: ${error.message}`]);
          toast({
            title: "Errore caricamento",
            description: item.titolo,
            variant: "destructive"
          });
        }

        processed++;
        setProgress((processed / totalDocs) * 100);
      }

      toast({
        title: "Caricamento completato",
        description: `${processedDocs.length} documenti processati, ${failedDocs.length} errori`,
      });
    } catch (error: any) {
      console.error('Error loading manifest:', error);
      toast({
        title: "Errore",
        description: error.message,
        variant: "destructive"
      });
    }

    setLoading(false);
  };

  const regulations: RegulationSource[] = [
    // GDPR
    { title: "GDPR - IT", pdf_url: "https://eur-lex.europa.eu/legal-content/IT/TXT/PDF/?uri=CELEX:32016R0679", version: "Reg. 2016/679", jurisdiction: "EU", sector: "general", language: "IT", source_url: "https://eur-lex.europa.eu/IT/TXT/?uri=CELEX:32016R0679" },
    { title: "GDPR - EN", pdf_url: "https://eur-lex.europa.eu/legal-content/EN/TXT/PDF/?uri=CELEX:32016R0679", version: "Reg. 2016/679", jurisdiction: "EU", sector: "general", language: "EN", source_url: "https://eur-lex.europa.eu/EN/TXT/?uri=CELEX:32016R0679" },
    
    // NIS2
    { title: "NIS2 - IT", pdf_url: "https://eur-lex.europa.eu/legal-content/IT/TXT/PDF/?uri=CELEX:32022L2555", version: "Dir. 2022/2555", jurisdiction: "EU", sector: "general", language: "IT", source_url: "https://eur-lex.europa.eu/IT/TXT/?uri=CELEX:32022L2555" },
    { title: "NIS2 - EN", pdf_url: "https://eur-lex.europa.eu/legal-content/EN/TXT/PDF/?uri=CELEX:32022L2555", version: "Dir. 2022/2555", jurisdiction: "EU", sector: "general", language: "EN", source_url: "https://eur-lex.europa.eu/EN/TXT/?uri=CELEX:32022L2555" },
    
    // AI Act
    { title: "AI Act - IT", pdf_url: "https://eur-lex.europa.eu/legal-content/IT/TXT/PDF/?uri=CELEX:32024R1689", version: "Reg. 2024/1689", jurisdiction: "EU", sector: "general", language: "IT", source_url: "https://eur-lex.europa.eu/IT/TXT/?uri=CELEX:32024R1689" },
    { title: "AI Act - EN", pdf_url: "https://eur-lex.europa.eu/legal-content/EN/TXT/PDF/?uri=OJ:L_202401689", version: "Reg. 2024/1689", jurisdiction: "EU", sector: "general", language: "EN", source_url: "https://eur-lex.europa.eu/EN/TXT/?uri=CELEX:32024R1689" },
  ];

  const handleLoadDocuments = async () => {
    setLoading(true);
    setProgress(0);
    setProcessedDocs([]);
    setFailedDocs([]);

    const totalDocs = regulations.length;
    let processed = 0;

    for (const regulation of regulations) {
      try {
        // Check if already exists
        const { data: existing } = await supabase
          .from('documents')
          .select('id')
          .eq('title', regulation.title)
          .eq('version', regulation.version)
          .maybeSingle();

        if (existing) {
          console.log(`Skipping ${regulation.title} - already exists`);
          setProcessedDocs(prev => [...prev, `${regulation.title} (già presente)`]);
        } else {
          console.log(`Processing: ${regulation.title}`);
          
          const { error } = await supabase.functions.invoke('process-document', {
            body: {
              pdf_url: regulation.pdf_url,
              title: regulation.title,
              version: regulation.version,
              jurisdiction: regulation.jurisdiction,
              sector: regulation.sector,
              source_url: regulation.source_url,
              language: regulation.language,
            }
          });

          if (error) throw error;

          setProcessedDocs(prev => [...prev, regulation.title]);
          toast({
            title: "Documento caricato",
            description: regulation.title,
          });

          // Small delay to avoid overwhelming the system
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
      } catch (error: any) {
        console.error('Error processing', regulation.title, error);
        setFailedDocs(prev => [...prev, `${regulation.title}: ${error.message}`]);
        toast({
          title: "Errore caricamento",
          description: regulation.title,
          variant: "destructive"
        });
      }

      processed++;
      setProgress((processed / totalDocs) * 100);
    }

    toast({
      title: "Caricamento completato",
      description: `${processedDocs.length} documenti processati, ${failedDocs.length} errori`,
    });

    setLoading(false);
  };

  if (checking) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!isAdmin) {
    return null;
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-muted/20 p-6">
        <div className="max-w-4xl mx-auto space-y-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Shield className="w-8 h-8 text-primary" />
              <div>
                <h1 className="text-3xl font-bold">Caricamento Normative</h1>
                <p className="text-muted-foreground">Sistema di inizializzazione RAG</p>
              </div>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => navigate('/admin/manage-regulations')}>
                Gestisci Normative
              </Button>
              <Button variant="ghost" onClick={() => navigate('/chat')}>
                ← Torna alla Chat
              </Button>
            </div>
          </div>

        <Card className="p-6 space-y-6">
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-xl font-semibold">Carica Normative</h2>
                <p className="text-sm text-muted-foreground">
                  Carica automaticamente le normative EU dal manifest
                </p>
              </div>
              <Button 
                onClick={loadFromManifest} 
                disabled={loading}
                className="gap-2"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Caricamento...
                  </>
                ) : (
                  <>
                    <Upload className="w-4 h-4" />
                    Carica dal Manifest
                  </>
                )}
              </Button>
            </div>

            {loading && (
              <div className="space-y-2">
                <Progress value={progress} />
                <p className="text-sm text-center text-muted-foreground">
                  {Math.round(progress)}% completato
                </p>
              </div>
            )}
          </div>

          {(processedDocs.length > 0 || failedDocs.length > 0) && (
            <div className="grid md:grid-cols-2 gap-4">
              {processedDocs.length > 0 && (
                <div className="space-y-2">
                  <h3 className="font-semibold text-green-600 flex items-center gap-2">
                    <CheckCircle2 className="w-5 h-5" />
                    Caricati ({processedDocs.length})
                  </h3>
                  <div className="space-y-1 max-h-64 overflow-y-auto">
                    {processedDocs.map((doc, idx) => (
                      <div key={idx} className="text-sm p-2 bg-green-50 dark:bg-green-950 rounded">
                        {doc}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {failedDocs.length > 0 && (
                <div className="space-y-2">
                  <h3 className="font-semibold text-red-600 flex items-center gap-2">
                    <XCircle className="w-5 h-5" />
                    Falliti ({failedDocs.length})
                  </h3>
                  <div className="space-y-1 max-h-64 overflow-y-auto">
                    {failedDocs.map((doc, idx) => (
                      <div key={idx} className="text-sm p-2 bg-red-50 dark:bg-red-950 rounded">
                        {doc}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          <div className="pt-4 border-t space-y-2">
            <h3 className="font-semibold">📋 Manifest di Normative</h3>
            <p className="text-sm text-muted-foreground">
              Il sistema caricherà automaticamente tutte le normative europee dal file manifest_normative_rag.json. 
              Include GDPR, NIS2, AI Act, CRA, DORA, CER.
            </p>
            <p className="text-sm text-muted-foreground">
              ⚠️ Il processo può richiedere diversi minuti. I PDF verranno scaricati, processati e indicizzati.
            </p>
          </div>
        </Card>
      </div>
    </div>
  );
};

export default DocumentLoader;
