import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Loader2, CheckCircle2, Building2, Upload, FileText } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Input } from "@/components/ui/input";

const LoadSMEBestPractices = () => {
  const [loading, setLoading] = useState(false);
  const [completed, setCompleted] = useState(false);
  const [uploadLoading, setUploadLoading] = useState(false);
  const { toast } = useToast();

  const documents = [
    {
      id: 'nist-smb',
      title: 'NIST CSF 2.0 - Small Business Quick-Start Guide',
      url: 'https://nvlpubs.nist.gov/nistpubs/SpecialPublications/NIST.SP.1300.pdf',
      description: 'Guida rapida NIST per PMI sul Cybersecurity Framework 2.0'
    },
    {
      id: 'cis-sme',
      title: 'CIS Controls - Implementation Guide for SMEs',
      url: 'https://www.cisecurity.org/-/media/project/cisecurity/cisecurity/data/media/files/uploads/2017/09/CIS-Controls-Guide-for-SMEs.pdf',
      description: 'Guida implementazione CIS Controls per piccole e medie imprese'
    },
    {
      id: 'enisa-sme-challenges',
      title: 'ENISA - Cybersecurity for SMEs: Challenges and Recommendations',
      url: 'https://www.enisa.europa.eu/sites/default/files/publications/ENISA%20Report%20-%20Cybersecurity%20for%20SMES%20Challenges%20and%20Recommendations.pdf',
      description: 'Sfide e raccomandazioni ENISA per la cybersecurity delle PMI europee'
    },
    {
      id: 'enisa-sme-12steps',
      title: 'ENISA - Cybersecurity Guide for SMEs: 12 Steps to Securing Your Business',
      url: 'https://www.enisa.europa.eu/sites/default/files/publications/ENISA%20Cybersecurity%20guide%20for%20SMEs.pdf',
      description: 'Guida operativa ENISA in 12 passi per proteggere le PMI'
    }
  ];

  const handleLoadBestPractices = async () => {
    setLoading(true);
    let successCount = 0;
    let errorCount = 0;

    try {
      toast({
        title: "Caricamento in corso",
        description: "Inizio caricamento best practices per PMI. Questo richiederà alcuni minuti...",
      });
      
      for (const doc of documents) {
        try {
          console.log(`📥 Downloading ${doc.title}...`);
          
          // Download PDF
          const response = await fetch(doc.url);
          if (!response.ok) {
            throw new Error(`Failed to download ${doc.title}`);
          }
          
          const blob = await response.blob();
          const arrayBuffer = await blob.arrayBuffer();
          const base64 = btoa(
            new Uint8Array(arrayBuffer).reduce(
              (data, byte) => data + String.fromCharCode(byte),
              ''
            )
          );
          
          console.log(`✅ Downloaded ${doc.title}: ${blob.size} bytes`);
          
          // Process document
          const { data, error } = await supabase.functions.invoke('process-document', {
            body: {
              file_data: `data:application/pdf;base64,${base64}`,
              file_name: `${doc.id}.pdf`,
              title: doc.title,
              version: '2024',
              jurisdiction: 'International',
              sector: 'Cybersecurity - SME Best Practices',
              source_url: doc.url,
              language: 'EN'
            }
          });

          if (error) {
            console.error(`❌ Error processing ${doc.title}:`, error);
            errorCount++;
            toast({
              title: "Errore",
              description: `Errore caricamento ${doc.title}`,
              variant: "destructive",
            });
          } else {
            console.log(`✅ ${doc.title} loaded: ${data?.chunks_created} chunks`);
            successCount++;
            toast({
              title: "Successo",
              description: `${doc.title} caricato con successo!`,
            });
          }
          
          // Wait between downloads to avoid rate limiting
          await new Promise(resolve => setTimeout(resolve, 2000));
          
        } catch (error) {
          console.error(`❌ Error with ${doc.title}:`, error);
          errorCount++;
          toast({
            title: "Errore",
            description: `Errore: ${doc.title}`,
            variant: "destructive",
          });
        }
      }
      
      if (successCount > 0) {
        setCompleted(true);
        toast({
          title: "Completato",
          description: `Caricamento completato! ${successCount} documenti caricati con successo.`,
        });
      } else {
        toast({
          title: "Errore",
          description: "Nessun documento caricato correttamente.",
          variant: "destructive",
        });
      }
      
    } catch (error) {
      console.error('Error loading best practices:', error);
      toast({
        title: "Errore",
        description: "Errore durante il caricamento delle best practices",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleManualUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files || files.length === 0) return;

    setUploadLoading(true);
    let successCount = 0;

    try {
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        
        try {
          console.log(`📤 Processing ${file.name}...`);
          
          const arrayBuffer = await file.arrayBuffer();
          const base64 = btoa(
            new Uint8Array(arrayBuffer).reduce(
              (data, byte) => data + String.fromCharCode(byte),
              ''
            )
          );

          const { data, error } = await supabase.functions.invoke('process-document', {
            body: {
              file_data: `data:application/pdf;base64,${base64}`,
              file_name: file.name,
              title: file.name.replace('.pdf', ''),
              version: '2024',
              jurisdiction: 'IT',
              sector: 'Cybersecurity - SME Best Practices',
              source_url: null,
              language: 'IT'
            }
          });

          if (error) {
            console.error(`❌ Error processing ${file.name}:`, error);
            toast({
              title: "Errore",
              description: `Errore caricamento ${file.name}`,
              variant: "destructive",
            });
          } else {
            console.log(`✅ ${file.name} loaded: ${data?.chunks_created} chunks`);
            successCount++;
            toast({
              title: "Successo",
              description: `${file.name} caricato con successo!`,
            });
          }
        } catch (error) {
          console.error(`❌ Error with ${file.name}:`, error);
          toast({
            title: "Errore",
            description: `Errore: ${file.name}`,
            variant: "destructive",
          });
        }
      }

      if (successCount > 0) {
        toast({
          title: "Upload completato",
          description: `${successCount} documento/i caricato/i con successo.`,
        });
      }
    } catch (error) {
      console.error('Error uploading documents:', error);
      toast({
        title: "Errore",
        description: "Errore durante l'upload dei documenti",
        variant: "destructive",
      });
    } finally {
      setUploadLoading(false);
      // Reset input
      event.target.value = '';
    }
  };

  return (
    <div className="container mx-auto p-6 max-w-4xl">
      <div className="mb-6">
        <Button
          variant="ghost"
          onClick={() => window.history.back()}
          className="mb-4"
        >
          ← Indietro
        </Button>
        
        <div className="flex items-center gap-3 mb-2">
          <Building2 className="h-8 w-8 text-primary" />
          <h1 className="text-3xl font-bold">Best Practices per PMI</h1>
        </div>
        <p className="text-muted-foreground">
          Integrazione di linee guida operative per piccole e medie imprese
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Carica Best Practices PMI nel RAG</CardTitle>
          <CardDescription>
            Integra automaticamente guide NIST, CIS Controls ed ENISA per PMI europee
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-6">
          <Alert>
            <AlertDescription>
              <strong>Documenti che verranno caricati:</strong>
              <ul className="mt-2 space-y-1 list-disc list-inside">
                {documents.map(doc => (
                  <li key={doc.id} className="text-sm">
                    {doc.title}
                  </li>
                ))}
              </ul>
            </AlertDescription>
          </Alert>

          <div className="space-y-4">
            <p className="text-muted-foreground">
              Queste risorse forniscono guidance operativa per implementare la cybersecurity nelle PMI, colmando il gap tra obblighi normativi e implementazione pratica con risorse limitate.
            </p>

            <div className="bg-muted/50 p-4 rounded-lg space-y-2">
              <h3 className="font-medium">Contenuti inclusi:</h3>
              <ul className="space-y-1 text-sm text-muted-foreground">
                <li>• NIST CSF 2.0 per piccole imprese</li>
                <li>• CIS Controls IG1 prioritizzati per PMI</li>
                <li>• ENISA: Sfide e raccomandazioni per PMI europee</li>
                <li>• ENISA: 12 passi per proteggere il business</li>
                <li>• Quick wins e misure essenziali</li>
                <li>• Approcci pragmatici con budget limitato</li>
                <li>• Checklist operative e action plan</li>
              </ul>
              <p className="text-sm text-primary font-medium mt-2">
                ⏱️ Il caricamento richiederà 5-8 minuti per processare 4 documenti PDF.
              </p>
            </div>
          </div>

          <div className="flex gap-4">
            <Button 
              onClick={handleLoadBestPractices}
              disabled={loading || completed}
              className="flex-1"
            >
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Caricamento in corso...
                </>
              ) : completed ? (
                <>
                  <CheckCircle2 className="mr-2 h-4 w-4" />
                  Completato
                </>
              ) : (
                'Carica Best Practices nel RAG'
              )}
            </Button>
          </div>

          {completed && (
            <Alert className="bg-primary/10 border-primary">
              <CheckCircle2 className="h-4 w-4 text-primary" />
              <AlertDescription className="text-primary">
                Best practices PMI caricate con successo! Il RAG può ora fornire guidance operativa contestualizzata per piccole e medie imprese.
              </AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>

      <Card className="mt-6">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Upload className="h-5 w-5" />
            Upload Manuale (Opzionale)
          </CardTitle>
          <CardDescription>
            Carica documenti aggiuntivi: CLUSIT Rapporto PMI, ACN Linee Guida, ISO 27001 Implementation per PMI
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Alert>
            <FileText className="h-4 w-4" />
            <AlertDescription>
              <strong>Documenti consigliati da caricare manualmente:</strong>
              <ul className="mt-2 space-y-1 text-sm list-disc list-inside">
                <li>CLUSIT - Rapporto Annuale (sezione PMI): <a href="https://clusit.it/rapporto-clusit/" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">Download da clusit.it</a></li>
                <li>ACN - Cyber Index PMI: <a href="https://www.acn.gov.it/portale/cybersicurezza-pmi" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">Guida ACN</a></li>
                <li>ISO 27001 Implementation Guide per PMI (se disponibile)</li>
              </ul>
            </AlertDescription>
          </Alert>

          <div className="space-y-2">
            <label htmlFor="manual-upload" className="text-sm font-medium">
              Seleziona file PDF da caricare:
            </label>
            <Input
              id="manual-upload"
              type="file"
              accept=".pdf"
              multiple
              onChange={handleManualUpload}
              disabled={uploadLoading}
              className="cursor-pointer"
            />
            <p className="text-xs text-muted-foreground">
              Puoi selezionare più file PDF contemporaneamente. Ogni documento verrà processato e integrato nel RAG.
            </p>
          </div>

          {uploadLoading && (
            <Alert>
              <Loader2 className="h-4 w-4 animate-spin" />
              <AlertDescription>
                Upload in corso... Attendere il completamento.
              </AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>

      <Card className="mt-6">
        <CardHeader>
          <CardTitle>Verifica Caricamento</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground mb-4">
            Dopo il caricamento, prova queste domande nel chatbot per verificare l'integrazione:
          </p>
          <ul className="space-y-2 text-sm">
            <li className="flex items-start gap-2">
              <span className="text-primary">•</span>
              <span>"Come implementare il NIST CSF in una PMI con budget limitato?"</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-primary">•</span>
              <span>"Quali sono i CIS Controls prioritari per una piccola azienda?"</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-primary">•</span>
              <span>"Quick wins per la cybersecurity senza personale specializzato?"</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-primary">•</span>
              <span>"Come adempiere NIS2 Art.21 in una PMI: best practices operative"</span>
            </li>
          </ul>
        </CardContent>
      </Card>
    </div>
  );
};

export default LoadSMEBestPractices;
