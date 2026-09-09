import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

const LoadAIAct = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [completed, setCompleted] = useState(false);
  const [progress, setProgress] = useState(0);
  const [statusMessage, setStatusMessage] = useState('');

  const handleLoadAIAct = async () => {
    setLoading(true);
    setProgress(0);
    setStatusMessage('Inizializzazione...');
    
    try {
      // Step 1: Fetch del file TXT completo
      setStatusMessage('Caricamento file AI Act (9.216 righe, ~600KB)...');
      setProgress(10);
      
      const response = await fetch('/documents/ai-act-2024-1689-full.txt');
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      
      setProgress(20);
      setStatusMessage('Lettura contenuto completo...');
      
      const content = await response.text();
      const sizeKB = (content.length / 1024).toFixed(0);
      const lines = content.split('\n').length;
      console.log(`✅ Content loaded: ${content.length} chars (${sizeKB} KB), ${lines} lines`);

      if (!content || content.length < 10000) {
        throw new Error(`Content troppo piccolo: ${content.length} caratteri`);
      }

      setProgress(50);
      setStatusMessage(`Invio al server: ${sizeKB} KB di testo completo...`);
      
      // Step 2: Rimuovi eventuali documenti AI Act precedenti incompleti
      const { data: existingDocs } = await supabase
        .from('documents')
        .select('id')
        .eq('title', 'AI Act')
        .eq('version', '2024/1689');

      if (existingDocs && existingDocs.length > 0) {
        console.log('🗑️ Rimozione documenti AI Act precedenti incompleti...');
        for (const doc of existingDocs) {
          await supabase.from('chunks').delete().eq('document_id', doc.id);
          await supabase.from('documents').delete().eq('id', doc.id);
        }
      }

      setProgress(60);
      setStatusMessage(`Processamento e caricamento ${sizeKB} KB (attendere 2-4 minuti)...`);
      
      // Step 3: Invoca edge function - SENZA TIMEOUT perché ora processa tutto
      console.log('🚀 Invoking edge function...');
      
      const { data, error } = await supabase.functions.invoke('load-regulatory-documents', {
        body: {
          content,
          title: 'AI Act',
          version: '2024/1689',
          jurisdiction: 'EU',
          sector: 'General',
          sourceUrl: 'https://eur-lex.europa.eu/eli/reg/2024/1689/oj'
        }
      });
      
      setProgress(85);
      
      if (error) {
        console.error('❌ Edge function error:', error);
        throw new Error(`Errore edge function: ${error.message}`);
      }
      
      console.log('✅ Edge function risposta:', data);

      // Step 4: Usa direttamente la risposta dell'edge function
      if (data && data.chunks_created) {
        setProgress(100);
        setStatusMessage(`Completato! ${data.chunks_created} chunks creati`);
        toast.success(`AI Act caricato con successo! ${data.chunks_created} chunks da ${sizeKB}KB`);
        setCompleted(true);
      } else {
        // Fallback: verifica manuale se la risposta non include chunks_created
        setStatusMessage('Verifica finale in corso...');
        await new Promise(resolve => setTimeout(resolve, 3000));
        
        const { data: verifyDoc } = await supabase
          .from('documents')
          .select('id, title')
          .ilike('title', '%AI Act%')
          .ilike('title', '%2024/1689%')
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle();

        if (verifyDoc) {
          const { count } = await supabase
            .from('chunks')
            .select('*', { count: 'exact', head: true })
            .eq('document_id', verifyDoc.id);

          console.log(`✅ Verifica: ${count} chunks per documento ${verifyDoc.title}`);
          
          if (count && count > 100) {
            setProgress(100);
            setStatusMessage(`Completato! ${count} chunks creati`);
            toast.success(`AI Act caricato! ${count} chunks da ${sizeKB}KB`);
            setCompleted(true);
          } else {
            toast.warning(`Caricato parzialmente: ${count || 0} chunks`);
            setProgress(100);
            setCompleted(true);
          }
        } else {
          toast.error('Documento non trovato. Controlla i log dell edge function.');
        }
      }
      
    } catch (error: any) {
      console.error('❌ Errore completo:', error);
      setStatusMessage('');
      
      let errorMsg = 'Errore sconosciuto';
      
      if (error.name === 'AbortError') {
        errorMsg = "Timeout: Il documento è molto grande e richiede più tempo. Riprova tra qualche minuto.";
      } else if (error.message) {
        errorMsg = error.message;
      }
      
      toast.error(`Errore: ${errorMsg}`);
      
      // Log dettagliato per debugging
      console.error('Error details:', {
        name: error.name,
        message: error.message,
        stack: error.stack
      });
    } finally {
      setLoading(false);
      if (!completed) {
        setProgress(0);
        setStatusMessage('');
      }
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
            <CardTitle className="text-3xl font-bold">Carica AI Act nel RAG</CardTitle>
            <CardDescription className="text-lg">
              Regulation (EU) 2024/1689 - Artificial Intelligence Act
            </CardDescription>
          </CardHeader>

          <CardContent className="space-y-6">
            <div className="space-y-4">
              <p className="text-muted-foreground">
                Questa funzionalità carica il testo completo dell'AI Act nel sistema RAG per permettere al chatbot di rispondere a domande specifiche sulla regolamentazione dell'intelligenza artificiale.
              </p>

              <div className="bg-muted/50 p-4 rounded-lg space-y-2">
                <h3 className="font-semibold">Contenuto dell'AI Act:</h3>
                <ul className="list-disc list-inside space-y-1 text-sm text-muted-foreground">
                  <li>Ambito di applicazione e definizioni</li>
                  <li>Sistemi AI ad alto rischio</li>
                  <li>Obblighi per fornitori e deployer</li>
                  <li>Trasparenza e documentazione</li>
                  <li>Governance e supervisione</li>
                  <li>Sanzioni e compliance</li>
                </ul>
              </div>
            </div>

            {loading && (
              <div className="space-y-4 p-4 bg-primary/5 rounded-lg">
                <div className="w-full bg-muted rounded-full h-3">
                  <div 
                    className="bg-primary h-3 rounded-full transition-all duration-500"
                    style={{ width: `${progress}%` }}
                  />
                </div>
                {statusMessage && (
                  <p className="text-sm text-muted-foreground text-center animate-pulse font-medium">
                    {statusMessage}
                  </p>
                )}
                <p className="text-xs text-muted-foreground text-center">
                  Il documento AI Act contiene 9.216 righe (~600KB). Il processo può richiedere 2-4 minuti. Attendere senza chiudere la pagina.
                </p>
              </div>
            )}

            <Button
              onClick={handleLoadAIAct}
              disabled={loading || completed}
              className="w-full"
              size="lg"
            >
              {loading ? "Caricamento in corso..." : completed ? "✓ AI Act Caricato" : "Carica AI Act nel RAG"}
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default LoadAIAct;
