import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

const LoadGDPR = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [completed, setCompleted] = useState(false);

  const handleLoadGDPR = async () => {
    setLoading(true);
    try {
      const response = await fetch('/documents/gdpr-2016-679-it.pdf');
      const blob = await response.blob();
      const arrayBuffer = await blob.arrayBuffer();
      
      // Use pdfjs-dist to extract text
      const { pdfjsLib } = await import('@/lib/pdf-worker');
      
      const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
      let fullText = '';
      
      for (let i = 1; i <= pdf.numPages; i++) {
        const page = await pdf.getPage(i);
        const textContent = await page.getTextContent();
        const pageText = textContent.items.map((item: any) => item.str).join(' ');
        fullText += pageText + '\n\n';
      }

      console.log('GDPR content extracted:', fullText.length, 'characters');

      const { data, error } = await supabase.functions.invoke('load-regulatory-documents', {
        body: {
          content: fullText,
          title: 'GDPR',
          version: '2016/679',
          jurisdiction: 'EU',
          sector: 'General',
          sourceUrl: 'https://eur-lex.europa.eu/eli/reg/2016/679/oj'
        }
      });

      if (error) throw error;

      console.log('GDPR load result:', data);
      toast.success("GDPR caricato con successo!");
      setCompleted(true);
    } catch (error) {
      console.error('Error loading GDPR:', error);
      toast.error("Errore nel caricamento del GDPR");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-muted/20 p-4 md:p-8">
      <div className="max-w-4xl mx-auto">
        <Button
          variant="ghost"
          onClick={() => navigate('/chat')}
          className="mb-6"
        >
          ← Torna alla Chat
        </Button>

        <Card className="border-primary/20 shadow-lg">
          <CardHeader className="space-y-4">
            <CardTitle className="text-3xl font-bold">Carica GDPR nel RAG</CardTitle>
            <CardDescription className="text-lg">
              Regulation (EU) 2016/679 - General Data Protection Regulation
            </CardDescription>
          </CardHeader>

          <CardContent className="space-y-6">
            <div className="space-y-4">
              <p className="text-muted-foreground">
                Questa funzionalità carica il testo completo del GDPR nel sistema RAG per permettere al chatbot di rispondere a domande specifiche sulla protezione dei dati personali.
              </p>

              <div className="bg-muted/50 p-4 rounded-lg space-y-2">
                <h3 className="font-semibold">Contenuto del GDPR:</h3>
                <ul className="list-disc list-inside space-y-1 text-sm text-muted-foreground">
                  <li>Principi e definizioni</li>
                  <li>Diritti degli interessati</li>
                  <li>Obblighi dei titolari e responsabili</li>
                  <li>Trasferimenti internazionali</li>
                  <li>Autorità di controllo</li>
                  <li>Sanzioni e rimedi</li>
                </ul>
              </div>
            </div>

            <Button
              onClick={handleLoadGDPR}
              disabled={loading || completed}
              className="w-full"
              size="lg"
            >
              {loading ? "Caricamento in corso..." : completed ? "✓ GDPR Caricato" : "Carica GDPR nel RAG"}
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default LoadGDPR;
