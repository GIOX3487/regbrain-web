import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Loader2, CheckCircle2, AlertCircle } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { pdfjsLib } from '@/lib/pdf-worker';

// Configure PDF.js worker

const AdminLoadCRA = () => {
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [message, setMessage] = useState('');
  const navigate = useNavigate();

  const extractTextFromPDF = async (pdfData: ArrayBuffer): Promise<string> => {
    const pdf = await pdfjsLib.getDocument({ data: pdfData }).promise;
    let fullText = '';
    
    toast.info(`Estrazione testo da ${pdf.numPages} pagine...`);
    
    for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
      const page = await pdf.getPage(pageNum);
      const textContent = await page.getTextContent();
      const pageText = textContent.items
        .map((item: any) => item.str)
        .join(' ');
      fullText += pageText + '\n\n';
      
      // Update progress every 10 pages
      if (pageNum % 10 === 0) {
        toast.info(`Processate ${pageNum}/${pdf.numPages} pagine...`);
      }
    }
    
    return fullText;
  };

  const handleLoadCRA = async () => {
    setLoading(true);
    setStatus('loading');
    
    try {
      toast.info("Caricamento PDF del CRA...");
      
      // Fetch the PDF from public folder
      const response = await fetch('/documents/cyber-resilience-act-2024-official.pdf');
      if (!response.ok) {
        throw new Error(`Failed to fetch PDF: ${response.statusText}`);
      }
      
      const pdfData = await response.arrayBuffer();
      console.log('PDF loaded:', pdfData.byteLength, 'bytes');
      
      // Extract all text from PDF
      const fullText = await extractTextFromPDF(pdfData);
      console.log('Text extracted:', fullText.length, 'characters');
      
      toast.info("Invio del contenuto all'edge function...");
      
      // Send the full content to the edge function
      const { data, error } = await supabase.functions.invoke('load-cra', {
        body: { content: fullText }
      });
      
      if (error) throw error;
      
      setStatus('success');
      setMessage(`✅ ${data.message}`);
      toast.success("CRA caricato con successo nel RAG!");
      
    } catch (error: any) {
      console.error('Error:', error);
      setStatus('error');
      setMessage(`❌ Errore: ${error.message}`);
      toast.error("Errore nel caricamento del CRA");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="container max-w-4xl mx-auto py-8 px-4">
      <div className="flex gap-4 mb-6">
        <Button variant="ghost" onClick={() => navigate('/chat')}>
          ← Torna alla Chat
        </Button>
        <Button variant="outline" onClick={() => navigate('/admin/load-new-documents')}>
          Carica Tutte le Normative →
        </Button>
      </div>

      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold mb-2">Carica CRA nel RAG</h1>
          <p className="text-muted-foreground">
            Carica il Cyber Resilience Act completo nel sistema RAG per risposte accurate.
          </p>
        </div>

        <Card className="p-6 space-y-4">
          <div className="space-y-2">
            <h3 className="font-semibold">Cosa fa questo strumento:</h3>
            <ul className="list-disc list-inside space-y-1 text-sm text-muted-foreground">
              <li>Carica il testo completo del Regolamento CRA (EU) 2024/2847</li>
              <li>Estrae il testo da tutte le pagine del PDF ufficiale</li>
              <li>Genera chunks ottimizzati per la ricerca semantica</li>
              <li>Include tutti gli articoli, allegati e note implementative</li>
            </ul>
          </div>

          {status === 'success' && (
            <div className="flex items-start gap-3 p-4 bg-green-50 border border-green-200 rounded-lg">
              <CheckCircle2 className="w-5 h-5 text-green-600 mt-0.5" />
              <p className="text-sm text-green-800">{message}</p>
            </div>
          )}

          {status === 'error' && (
            <div className="flex items-start gap-3 p-4 bg-red-50 border border-red-200 rounded-lg">
              <AlertCircle className="w-5 h-5 text-red-600 mt-0.5" />
              <p className="text-sm text-red-800">{message}</p>
            </div>
          )}

          <Button 
            onClick={handleLoadCRA} 
            disabled={loading}
            className="w-full"
            size="lg"
          >
            {loading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Caricamento in corso...
              </>
            ) : (
              'Carica CRA nel RAG'
            )}
          </Button>
        </Card>
      </div>
    </div>
  );
};

export default AdminLoadCRA;
