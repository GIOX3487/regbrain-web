import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

const LoadNIS2 = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [completed, setCompleted] = useState(false);

  const handleLoadNIS2 = async () => {
    setLoading(true);
    try {
      toast.info("Inizio caricamento NIS2 (4634 righe). Attendere 2-4 minuti...");
      
      const response = await fetch('/documents/nis2-2022-2555-full.txt');
      if (!response.ok) throw new Error('Failed to fetch NIS2 document');
      
      const content = await response.text();
      console.log('NIS2 content loaded:', content.length, 'characters', content.split('\n').length, 'lines');

      const startTime = Date.now();
      const { data, error } = await supabase.functions.invoke('load-regulatory-documents', {
        body: {
          content,
          title: 'NIS2 Directive',
          version: '2022/2555',
          jurisdiction: 'EU',
          sector: 'General',
          sourceUrl: 'https://eur-lex.europa.eu/eli/dir/2022/2555/oj'
        }
      });

      if (error) throw error;

      const elapsedTime = ((Date.now() - startTime) / 1000).toFixed(1);
      console.log('NIS2 load result:', data, `Elapsed time: ${elapsedTime}s`);
      
      // Verify chunks were created
      const chunksCreated = data?.chunks_created;
      if (chunksCreated) {
        toast.success(`NIS2 caricata con successo! ${chunksCreated} chunks creati in ${elapsedTime}s`);
        console.log(`✅ NIS2: ${chunksCreated} chunks creati`);
      } else {
        // Fallback verification
        const { data: verifyData, error: verifyError } = await supabase
          .from('documents')
          .select('id')
          .eq('title', 'NIS2 Directive')
          .single();

        if (!verifyError && verifyData) {
          const { count } = await supabase
            .from('chunks')
            .select('*', { count: 'exact', head: true })
            .eq('document_id', verifyData.id);

          toast.success(`NIS2 caricata! ${count} chunks verificati in ${elapsedTime}s`);
          console.log(`✅ NIS2: ${count} chunks verificati`);
        } else {
          toast.success(`NIS2 caricata in ${elapsedTime}s`);
        }
      }
      
      setCompleted(true);
    } catch (error) {
      console.error('Error loading NIS2:', error);
      toast.error("Errore nel caricamento della NIS2 Directive");
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
            <CardTitle className="text-3xl font-bold">Carica NIS2 Directive nel RAG</CardTitle>
            <CardDescription className="text-lg">
              Directive (EU) 2022/2555 - Network and Information Security
            </CardDescription>
          </CardHeader>

          <CardContent className="space-y-6">
            <div className="space-y-4">
              <p className="text-muted-foreground">
                Questa funzionalità carica il testo completo della Direttiva NIS2 (4634 righe) nel sistema RAG per permettere al chatbot di rispondere a domande specifiche sulla cybersecurity delle reti e dei sistemi informativi.
              </p>

              <div className="bg-muted/50 p-4 rounded-lg space-y-2">
                <h3 className="font-semibold">Contenuto della NIS2:</h3>
                <ul className="list-disc list-inside space-y-1 text-sm text-muted-foreground">
                  <li>Ambito di applicazione e definizioni</li>
                  <li>Entità essenziali e importanti</li>
                  <li>Misure di gestione dei rischi di cybersecurity</li>
                  <li>Obblighi di notifica degli incidenti</li>
                  <li>Autorità competenti e cooperazione</li>
                  <li>Sanzioni e enforcement</li>
                </ul>
                <p className="text-sm text-primary font-medium mt-2">
                  ⏱️ Il caricamento richiederà 2-4 minuti. Il processo è ottimizzato per garantire l'integrità completa del documento.
                </p>
              </div>
            </div>

            <Button
              onClick={handleLoadNIS2}
              disabled={loading || completed}
              className="w-full"
              size="lg"
            >
              {loading ? "Caricamento in corso..." : completed ? "✓ NIS2 Caricata" : "Carica NIS2 nel RAG"}
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default LoadNIS2;
