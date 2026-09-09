import { useState } from "react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Loader2, CheckCircle2, AlertCircle, ArrowLeft } from "lucide-react";
import { useNavigate } from "react-router-dom";

const LoadCodiceCybersicurezza = () => {
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [message, setMessage] = useState("");
  const { toast } = useToast();
  const navigate = useNavigate();

  const handleLoadDocument = async () => {
    setLoading(true);
    setStatus('idle');
    setMessage("");

    try {
      console.log('Reading full TXT file from public directory...');
      
      // Fetch the complete TXT file (1066 pages, 72k lines)
      const response = await fetch('/documents/codice-cybersicurezza-2025-full.txt');
      if (!response.ok) {
        throw new Error(`Failed to fetch TXT file: ${response.statusText}`);
      }
      
      const content = await response.text();
      console.log(`File loaded: ${content.length} characters (${(content.length / 1024 / 1024).toFixed(2)} MB)`);
      
      console.log('Invoking load-codice-cybersicurezza function with full content...');
      
      const { data, error } = await supabase.functions.invoke('load-codice-cybersicurezza', {
        body: { content }
      });

      if (error) {
        console.error('Error from function:', error);
        throw error;
      }

      console.log('Function response:', data);

      setStatus('success');
      setMessage(`✅ Codice della Cybersicurezza caricato con successo!\n📊 Chunks creati: ${data.chunks_created}\n📄 Caratteri processati: ${content.length.toLocaleString()}\n🆔 Document ID: ${data.document_id}`);
      
      toast({
        title: "Documento caricato",
        description: `Il Codice completo (1066 pagine) è ora disponibile nel RAG con ${data.chunks_created} chunks`,
      });

    } catch (error) {
      console.error('Error loading document:', error);
      setStatus('error');
      setMessage(`❌ Errore durante il caricamento: ${error instanceof Error ? error.message : 'Unknown error'}`);
      
      toast({
        title: "Errore",
        description: "Impossibile caricare il documento",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background p-8">
      <div className="max-w-4xl mx-auto space-y-8">
        <div>
          <h1 className="text-4xl font-bold mb-4">Caricamento Codice della Cybersicurezza</h1>
          <p className="text-muted-foreground mb-6">
            Carica il Codice della Cybersicurezza COMPLETO (raccolta normativa italiana di Luca D'Agostino, edizione 2025) 
            nel sistema RAG. Documento completo: 1066 pagine, 72.175 righe di testo normativo.
          </p>
          
          <div className="bg-muted/50 p-6 rounded-lg space-y-4">
            <h2 className="text-xl font-semibold">Contenuto del documento:</h2>
            <ul className="list-disc list-inside space-y-2 text-sm">
              <li>Agenzia per la Cybersicurezza Nazionale (ACN) - organizzazione e funzioni</li>
              <li>Decreto-legge n. 82/2021 - cybersicurezza</li>
              <li>Decreto legislativo NIS - sicurezza reti e sistemi informativi</li>
              <li>Decreto-legge Perimetro - sicurezza nazionale cibernetica</li>
              <li>Cyber Resilience Act - riferimenti normativi</li>
              <li>GDPR - obblighi di sicurezza dei dati</li>
              <li>Normativa settori critici (energia, trasporti, bancario, sanitario)</li>
              <li>Reati informatici - codice penale</li>
            </ul>
          </div>
        </div>

        {status !== 'idle' && (
          <div className={`p-6 rounded-lg ${
            status === 'success' ? 'bg-green-50 dark:bg-green-950/20' : 'bg-red-50 dark:bg-red-950/20'
          }`}>
            <div className="flex items-start gap-3">
              {status === 'success' ? (
                <CheckCircle2 className="h-6 w-6 text-green-600 dark:text-green-400 mt-1" />
              ) : (
                <AlertCircle className="h-6 w-6 text-red-600 dark:text-red-400 mt-1" />
              )}
              <pre className="text-sm whitespace-pre-wrap font-mono">{message}</pre>
            </div>
          </div>
        )}

        <div className="flex gap-4">
          <Button
            onClick={handleLoadDocument}
            disabled={loading}
            size="lg"
            className="flex-1"
          >
            {loading ? (
              <>
                <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                Caricamento in corso...
              </>
            ) : (
              <>Carica Codice della Cybersicurezza nel RAG</>
            )}
          </Button>
          
          <Button
            onClick={() => navigate('/chat')}
            variant="outline"
            size="lg"
          >
            <ArrowLeft className="mr-2 h-5 w-5" />
            Torna alla Chat
          </Button>
        </div>

        <div className="text-sm text-muted-foreground">
          <p>
            <strong>Nota:</strong> Il caricamento rimuoverà eventuali versioni precedenti del documento 
            e creerà nuovi chunk ottimizzati per la ricerca semantica nel RAG.
          </p>
        </div>
      </div>
    </div>
  );
};

export default LoadCodiceCybersicurezza;
