import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { Database, Upload, Loader2, CheckCircle2, FileText } from "lucide-react";

const LoadDataAct = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [completed, setCompleted] = useState(false);

  const handleLoadDataAct = async () => {
    setLoading(true);
    
    try {
      toast({
        title: "Lettura file...",
        description: "Caricamento del documento completo...",
      });

      // Read the FULL file from public directory
      const response = await fetch('/documents/data-act-2023-2854-full.txt');
      if (!response.ok) throw new Error(`Failed to fetch file: ${response.statusText}`);
      
      const fileContent = await response.text();
      console.log(`📄 File read: ${fileContent.length} characters (${(fileContent.length / 1024).toFixed(0)} KB)`);

      toast({
        title: "Processing...",
        description: "Generazione chunks dal documento...",
      });
      
      // Send the FULL content to edge function
      const { data, error } = await supabase.functions.invoke('load-regulatory-documents', {
        body: { 
          content: fileContent,
          title: "Data Act",
          version: "Regolamento (UE) 2023/2854",
          jurisdiction: "EU",
          sector: "Data Governance",
          sourceUrl: "https://eur-lex.europa.eu/legal-content/IT/TXT/?uri=CELEX:32023R2854"
        }
      });

      if (error) throw error;
      
      toast({
        title: "Completato",
        description: `Data Act: ${data.chunks_created} chunks creati da ${data.content_size_kb?.toLocaleString()} KB`,
      });
      
      setCompleted(true);
      setLoading(false);

    } catch (error: any) {
      console.error('Error:', error);
      toast({
        title: "Errore",
        description: error.message || "Errore durante il caricamento",
        variant: "destructive"
      });
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-muted/20 p-4 md:p-8">
      <div className="max-w-4xl mx-auto">
        <div className="flex gap-4 mb-6">
          <Button
            variant="ghost"
            onClick={() => navigate('/chat')}
          >
            ← Torna alla Chat
          </Button>
          <Button
            variant="outline"
            onClick={() => navigate('/admin/load-new-documents')}
          >
            Carica Tutte le Normative →
          </Button>
        </div>

        <Card className="border-primary/20 shadow-lg">
          <CardHeader className="space-y-4">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-primary/10 rounded-lg">
                <Database className="h-8 w-8 text-primary" />
              </div>
              <div>
                <CardTitle className="text-3xl">Carica Data Act nel RAG</CardTitle>
                <CardDescription className="text-base mt-2">
                  Carica il Regolamento (UE) 2023/2854 - Data Act completo nel sistema RAG.
                </CardDescription>
              </div>
            </div>
          </CardHeader>

          <CardContent className="space-y-6">
            <div className="bg-muted/50 p-6 rounded-lg space-y-3">
              <h3 className="flex items-center gap-2">
                <FileText className="h-5 w-5" />
                Cosa fa questo strumento:
              </h3>
              <ul className="space-y-2 ml-7 text-muted-foreground">
                <li>• Carica il testo completo del Data Act (EU) 2023/2854 (4.843 righe)</li>
                <li>• Regolamento su norme armonizzate per accesso equo ai dati e loro utilizzo</li>
                <li>• Include tutti gli articoli, allegati e considerando</li>
                <li>• Copre: IoT, cloud switching, data sharing B2B, accesso dati pubblici</li>
              </ul>
            </div>

            <div className="bg-blue-500/10 p-4 rounded-lg border border-blue-500/20">
              <h4 className="font-medium text-blue-600 dark:text-blue-400 mb-2">Ambiti coperti dal Data Act:</h4>
              <div className="grid grid-cols-2 gap-2 text-sm text-muted-foreground">
                <div>• Accesso ai dati IoT</div>
                <div>• Condivisione dati B2B</div>
                <div>• Cloud switching</div>
                <div>• Interoperabilità dati</div>
                <div>• Accesso dati enti pubblici</div>
                <div>• Protezione segreti commerciali</div>
                <div>• Contratti equi per PMI</div>
                <div>• Trasferimenti internazionali</div>
              </div>
            </div>

            {completed ? (
              <div className="space-y-4">
                <div className="flex items-center gap-3 p-4 bg-green-500/10 border border-green-500/20 rounded-lg">
                  <CheckCircle2 className="h-6 w-6 text-green-500 flex-shrink-0" />
                  <div>
                    <p className="font-medium text-green-500">Data Act caricato con successo</p>
                    <p className="text-sm text-muted-foreground mt-1">
                      Il documento è ora disponibile per le query RAG
                    </p>
                  </div>
                </div>

                <Button
                  onClick={() => navigate('/chat')}
                  className="w-full"
                  size="lg"
                >
                  <Database className="mr-2 h-5 w-5" />
                  Vai alla Chat
                </Button>
              </div>
            ) : (
              <Button
                onClick={handleLoadDataAct}
                disabled={loading}
                className="w-full"
                size="lg"
              >
                {loading ? (
                  <>
                    <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                    Caricamento in corso...
                  </>
                ) : (
                  <>
                    <Upload className="mr-2 h-5 w-5" />
                    Carica Data Act nel RAG
                  </>
                )}
              </Button>
            )}

            <div className="pt-4 border-t">
              <Button
                variant="outline"
                onClick={() => navigate('/chat')}
                className="w-full"
              >
                Torna alla Chat
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default LoadDataAct;
