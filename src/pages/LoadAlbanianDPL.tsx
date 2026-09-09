import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ArrowLeft, Upload, CheckCircle, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

export default function LoadAlbanianDPL() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);

  const handleLoad = async () => {
    setLoading(true);
    try {
      const response = await fetch('/documents/legge-124-2024-protezione-dati-albania.txt');
      const content = await response.text();

      const { data, error } = await supabase.functions.invoke('load-regulatory-documents', {
        body: {
          content,
          title: 'Legge 124/2024 - Protezione dei Dati Personali Albania',
          version: '124/2024',
          jurisdiction: 'Albania',
          sector: 'General',
          sourceUrl: null,
        }
      });

      if (error) throw error;
      setResult(data);
      toast({ title: "Documento caricato", description: `${data.chunks_created} chunks creati con successo` });
    } catch (error: any) {
      console.error('Load error:', error);
      toast({ title: "Errore", description: error.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-2xl mx-auto">
        <Button variant="ghost" onClick={() => navigate(-1)} className="mb-4">
          <ArrowLeft className="w-4 h-4 mr-2" /> Indietro
        </Button>

        <Card className="p-6">
          <h1 className="text-2xl font-bold mb-2">Carica Legge 124/2024 Albania</h1>
          <p className="text-muted-foreground mb-6">
            Legge sulla protezione dei dati personali della Repubblica d'Albania (approvata il 19.12.2024). 
            101 articoli allineati al GDPR europeo.
          </p>

          {result ? (
            <div className="space-y-3">
              <div className="flex items-center gap-2 text-primary">
                <CheckCircle className="w-5 h-5" />
                <span className="font-semibold">Caricamento completato</span>
              </div>
              <div className="text-sm text-muted-foreground space-y-1">
                <p>Chunks creati: {result.chunks_created}</p>
                <p>Dimensione: {result.content_size_kb} KB</p>
                <p>Embedding: {result.embedding_type}</p>
              </div>
            </div>
          ) : (
            <Button onClick={handleLoad} disabled={loading} size="lg">
              {loading ? (
                <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Caricamento in corso...</>
              ) : (
                <><Upload className="w-4 h-4 mr-2" /> Carica nel RAG</>
              )}
            </Button>
          )}
        </Card>
      </div>
    </div>
  );
}
