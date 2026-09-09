import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Loader2, CheckCircle, XCircle, FileText, ArrowLeft } from "lucide-react";
import { Progress } from "@/components/ui/progress";
import { useNavigate } from "react-router-dom";

interface AgidDocument {
  title: string;
  path: string;
  version: string;
  sector: string;
  description: string;
}

const agidDocuments: AgidDocument[] = [
  {
    title: "AgID - Regolamento Servizi Cloud PA",
    path: "/documents/agid-regolamento-servizi-cloud.txt",
    version: "2024",
    sector: "cloud",
    description: "Livelli minimi sicurezza, capacità elaborativa, risparmio energetico infrastrutture digitali PA"
  },
  {
    title: "AgID - Linee Guida Sviluppo Software Sicuro",
    path: "/documents/agid-linee-guida-sviluppo-software-sicuro.txt",
    version: "2024",
    sector: "software_development",
    description: "Best practices OWASP, SSDLC, security testing per la PA"
  },
  {
    title: "AgID/ACN - Linee Guida Adozione IA nella PA",
    path: "/documents/agid-linee-guida-ia-pa.txt",
    version: "2025",
    sector: "artificial_intelligence",
    description: "Linee guida per l'adozione di Intelligenza Artificiale nella PA - Piano Triennale 2024-2026"
  }
];

const LoadAgidDocuments = () => {
  const [isLoading, setIsLoading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [results, setResults] = useState<{title: string; success: boolean; chunks?: number; error?: string}[]>([]);
  const { toast } = useToast();
  const navigate = useNavigate();

  const loadDocument = async (doc: AgidDocument): Promise<{success: boolean; chunks?: number; error?: string}> => {
    try {
      // Fetch document content
      const response = await fetch(doc.path);
      if (!response.ok) {
        throw new Error(`Failed to fetch: ${response.status}`);
      }
      const content = await response.text();
      
      console.log(`📄 Loading ${doc.title}: ${content.length} chars`);
      
      // Send to edge function
      const { data, error } = await supabase.functions.invoke('load-regulatory-documents', {
        body: {
          content,
          title: doc.title,
          version: doc.version,
          jurisdiction: 'IT',
          sector: doc.sector,
          sourceUrl: doc.path
        }
      });

      if (error) throw error;

      return { success: true, chunks: data.chunks_created };
    } catch (error) {
      console.error(`Error loading ${doc.title}:`, error);
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  };

  const handleLoadAll = async () => {
    setIsLoading(true);
    setProgress(0);
    setResults([]);

    const newResults: typeof results = [];

    for (let i = 0; i < agidDocuments.length; i++) {
      const doc = agidDocuments[i];
      const result = await loadDocument(doc);
      newResults.push({ title: doc.title, ...result });
      setResults([...newResults]);
      setProgress(((i + 1) / agidDocuments.length) * 100);
      
      // Small delay between documents
      if (i < agidDocuments.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }

    const successCount = newResults.filter(r => r.success).length;
    const totalChunks = newResults.reduce((sum, r) => sum + (r.chunks || 0), 0);

    toast({
      title: successCount === agidDocuments.length ? "✅ Tutti i documenti caricati" : "⚠️ Caricamento parziale",
      description: `${successCount}/${agidDocuments.length} documenti indicizzati con ${totalChunks} chunks totali`
    });

    setIsLoading(false);
  };

  return (
    <div className="min-h-screen bg-background p-8">
      <div className="max-w-4xl mx-auto space-y-6">
        <div className="flex items-center gap-4">
          <Button variant="ghost" onClick={() => navigate(-1)}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Indietro
          </Button>
          <div>
            <h1 className="text-2xl font-bold">Carica Documenti AgID/ENISA</h1>
            <p className="text-muted-foreground">Indicizza le linee guida italiane nel RAG</p>
          </div>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              Documenti da Caricare
            </CardTitle>
            <CardDescription>
              Questi documenti AgID verranno indicizzati nel sistema RAG per le risposte del Copilot
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {agidDocuments.map((doc, idx) => (
              <div key={idx} className="border rounded-lg p-4">
                <div className="flex items-start justify-between">
                  <div>
                    <h3 className="font-medium">{doc.title}</h3>
                    <p className="text-sm text-muted-foreground">{doc.description}</p>
                    <div className="flex gap-2 mt-2">
                      <span className="text-xs bg-primary/10 text-primary px-2 py-1 rounded">
                        v{doc.version}
                      </span>
                      <span className="text-xs bg-muted px-2 py-1 rounded">
                        {doc.sector}
                      </span>
                    </div>
                  </div>
                  {results.find(r => r.title === doc.title) && (
                    <div className="flex items-center gap-2">
                      {results.find(r => r.title === doc.title)?.success ? (
                        <>
                          <CheckCircle className="h-5 w-5 text-green-500" />
                          <span className="text-sm text-green-600">
                            {results.find(r => r.title === doc.title)?.chunks} chunks
                          </span>
                        </>
                      ) : (
                        <XCircle className="h-5 w-5 text-destructive" />
                      )}
                    </div>
                  )}
                </div>
              </div>
            ))}

            {isLoading && (
              <div className="space-y-2">
                <Progress value={progress} />
                <p className="text-sm text-center text-muted-foreground">
                  Caricamento in corso... {Math.round(progress)}%
                </p>
              </div>
            )}

            <Button 
              onClick={handleLoadAll} 
              disabled={isLoading}
              className="w-full"
            >
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Caricamento in corso...
                </>
              ) : (
                <>
                  <FileText className="mr-2 h-4 w-4" />
                  Carica tutti i documenti nel RAG
                </>
              )}
            </Button>

            {results.length > 0 && !isLoading && (
              <div className="mt-4 p-4 bg-muted rounded-lg">
                <h4 className="font-medium mb-2">Riepilogo</h4>
                <ul className="text-sm space-y-1">
                  {results.map((r, idx) => (
                    <li key={idx} className="flex items-center gap-2">
                      {r.success ? (
                        <CheckCircle className="h-4 w-4 text-green-500" />
                      ) : (
                        <XCircle className="h-4 w-4 text-destructive" />
                      )}
                      <span>{r.title}</span>
                      {r.success && <span className="text-muted-foreground">({r.chunks} chunks)</span>}
                      {r.error && <span className="text-destructive text-xs">- {r.error}</span>}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default LoadAgidDocuments;
