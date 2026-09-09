import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

const LoadDORA = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [completed, setCompleted] = useState(false);

  const handleLoadDORA = async () => {
    setLoading(true);
    try {
      toast.info("Inizio caricamento DORA (5231 righe). Attendere 2-4 minuti...");
      
      const response = await fetch('/documents/dora-2022-2554-full.txt');
      if (!response.ok) throw new Error('Failed to fetch DORA document');
      
      const content = await response.text();
      console.log('DORA content loaded:', content.length, 'characters', content.split('\n').length, 'lines');

      const startTime = Date.now();
      const { data, error } = await supabase.functions.invoke('load-regulatory-documents', {
        body: {
          content,
          title: 'DORA Regulation',
          version: '2022/2554',
          jurisdiction: 'EU',
          sector: 'Financial',
          sourceUrl: 'https://eur-lex.europa.eu/eli/reg/2022/2554/oj'
        }
      });

      if (error) throw error;

      const elapsedTime = ((Date.now() - startTime) / 1000).toFixed(1);
      console.log('DORA load result:', data, `Elapsed time: ${elapsedTime}s`);
      
      // Verify chunks were created
      const chunksCreated = data?.chunks_created;
      if (chunksCreated) {
        toast.success(`DORA caricata con successo! ${chunksCreated} chunks creati in ${elapsedTime}s`);
        console.log(`✅ DORA: ${chunksCreated} chunks creati`);
      } else {
        // Fallback verification
        const { data: verifyData, error: verifyError } = await supabase
          .from('documents')
          .select('id')
          .eq('title', 'DORA Regulation')
          .single();

        if (!verifyError && verifyData) {
          const { count } = await supabase
            .from('chunks')
            .select('*', { count: 'exact', head: true })
            .eq('document_id', verifyData.id);

          toast.success(`DORA caricata! ${count} chunks verificati in ${elapsedTime}s`);
          console.log(`✅ DORA: ${count} chunks verificati`);
        } else {
          toast.success(`DORA caricata in ${elapsedTime}s`);
        }
      }
      
      setCompleted(true);
    } catch (error) {
      console.error('Error loading DORA:', error);
      toast.error("Errore nel caricamento della DORA Regulation");
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
            <CardTitle className="text-3xl font-bold">Carica DORA Regulation nel RAG</CardTitle>
            <CardDescription className="text-lg">
              Regulation (EU) 2022/2554 - Digital Operational Resilience Act
            </CardDescription>
          </CardHeader>

          <CardContent className="space-y-6">
            <div className="space-y-4">
              <p className="text-muted-foreground">
                Questa funzionalità carica il testo completo del Regolamento DORA (5231 righe) nel sistema RAG per permettere al chatbot di rispondere a domande specifiche sulla resilienza operativa digitale nel settore finanziario.
              </p>

              <div className="bg-muted/50 p-4 rounded-lg space-y-2">
                <h3 className="font-semibold">Contenuto di DORA:</h3>
                <ul className="list-disc list-inside space-y-1 text-sm text-muted-foreground">
                  <li>Gestione del rischio ICT</li>
                  <li>Incident reporting e gestione</li>
                  <li>Test di resilienza operativa digitale</li>
                  <li>Gestione del rischio ICT di terze parti</li>
                  <li>Condivisione delle informazioni</li>
                  <li>Supervisione e sanzioni</li>
                </ul>
                <p className="text-sm text-primary font-medium mt-2">
                  ⏱️ Il caricamento richiederà 2-4 minuti. Il processo è ottimizzato per garantire l'integrità completa del documento.
                </p>
              </div>
            </div>

            <Button
              onClick={handleLoadDORA}
              disabled={loading || completed}
              className="w-full"
              size="lg"
            >
              {loading ? "Caricamento in corso..." : completed ? "✓ DORA Caricata" : "Carica DORA nel RAG"}
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default LoadDORA;
