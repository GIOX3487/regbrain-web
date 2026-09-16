import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Loader2, CheckCircle2, AlertCircle, FileText } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { pdfjsLib } from '@/lib/pdf-worker';

// Configure PDF.js worker

interface RegulationDoc {
  id: string;
  title: string;
  fileName: string;
  fileType: 'pdf' | 'txt';
  version: string;
  jurisdiction: string;
  sector: string;
  sourceUrl: string;
  description: string;
}

const REGULATIONS: RegulationDoc[] = [
  {
    id: 'cra',
    title: 'Cyber Resilience Act (CRA)',
    fileName: 'cyber-resilience-act-2024-official.pdf',
    fileType: 'pdf',
    version: 'Reg. 2024/2847',
    jurisdiction: 'EU',
    sector: 'Cybersecurity',
    sourceUrl: 'https://eur-lex.europa.eu/legal-content/IT/TXT/?uri=CELEX:32024R2847',
    description: 'Regolamento UE 2024/2847 sulla ciberresilienza'
  },
  {
    id: 'nis2',
    title: 'NIS2 Directive',
    fileName: 'nis2-2022-2555-full.txt',
    fileType: 'txt',
    version: 'Dir. 2022/2555',
    jurisdiction: 'EU',
    sector: 'Cybersecurity',
    sourceUrl: 'https://eur-lex.europa.eu/legal-content/IT/TXT/?uri=CELEX:32022L2555',
    description: 'Direttiva UE 2022/2555 sulla cibersicurezza (4634 righe)'
  },
  {
    id: 'dora',
    title: 'DORA Regulation',
    fileName: 'dora-2022-2554-full.txt',
    fileType: 'txt',
    version: 'Reg. 2022/2554',
    jurisdiction: 'EU',
    sector: 'Financial',
    sourceUrl: 'https://eur-lex.europa.eu/legal-content/IT/TXT/?uri=CELEX:32022R2554',
    description: 'Regolamento UE 2022/2554 sulla resilienza operativa digitale finanziaria (5231 righe)'
  },
  {
    id: 'ai-act',
    title: 'AI Act',
    fileName: 'ai-act-2024-1689-full.txt',
    fileType: 'txt',
    version: 'Reg. 2024/1689',
    jurisdiction: 'EU',
    sector: 'AI',
    sourceUrl: 'https://eur-lex.europa.eu/legal-content/IT/TXT/?uri=CELEX:32024R1689',
    description: 'Regolamento UE 2024/1689 sull\'intelligenza artificiale (9216 righe)'
  },
  {
    id: 'gdpr',
    title: 'GDPR',
    fileName: 'gdpr-2016-679-it.pdf',
    fileType: 'pdf',
    version: 'Reg. 2016/679',
    jurisdiction: 'EU',
    sector: 'Data Protection',
    sourceUrl: 'https://eur-lex.europa.eu/legal-content/IT/TXT/?uri=CELEX:32016R0679',
    description: 'Regolamento UE 2016/679 sulla protezione dei dati'
  },
  {
    id: 'dlgs-81-08',
    title: 'D.Lgs 81/08 - Testo Unico Sicurezza Lavoro',
    fileName: 'dlgs-81-08-testo-unico-sicurezza-lavoro.txt',
    fileType: 'txt',
    version: 'D.Lgs. 81/2008 - Ed. Gennaio 2025',
    jurisdiction: 'IT',
    sector: 'Workplace Safety',
    sourceUrl: 'https://www.normattiva.it/uri-res/N2Ls?urn:nir:stato:decreto.legislativo:2008-04-09;81',
    description: 'Testo Unico sulla Salute e Sicurezza sul Lavoro - 83.138 righe, edizione Gennaio 2025'
  }
];

const AdminLoadDocuments = () => {
  const [loadingStates, setLoadingStates] = useState<Record<string, boolean>>({});
  const [statusStates, setStatusStates] = useState<Record<string, 'idle' | 'loading' | 'success' | 'error'>>({});
  const [messageStates, setMessageStates] = useState<Record<string, string>>({});
  const navigate = useNavigate();

  const extractTextFromPDF = async (pdfData: ArrayBuffer, docId: string): Promise<string> => {
    const pdf = await pdfjsLib.getDocument({ data: pdfData }).promise;
    let fullText = '';
    
    toast.info(`[${docId.toUpperCase()}] Estrazione testo da ${pdf.numPages} pagine...`);
    
    for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
      const page = await pdf.getPage(pageNum);
      const textContent = await page.getTextContent();
      const pageText = textContent.items
        .map((item: any) => item.str)
        .join(' ');
      fullText += pageText + '\n\n';
      
      if (pageNum % 10 === 0) {
        toast.info(`[${docId.toUpperCase()}] Processate ${pageNum}/${pdf.numPages} pagine...`);
      }
    }
    
    return fullText;
  };

  const handleLoadDocument = async (doc: RegulationDoc) => {
    setLoadingStates(prev => ({ ...prev, [doc.id]: true }));
    setStatusStates(prev => ({ ...prev, [doc.id]: 'loading' }));
    
    try {
      toast.info(`[${doc.id.toUpperCase()}] Caricamento ${doc.title}...`);
      
      const response = await fetch(`/documents/${doc.fileName}`);
      if (!response.ok) {
        throw new Error(`Failed to fetch document: ${response.statusText}`);
      }
      
      let content: string;
      
      if (doc.fileType === 'pdf') {
        const pdfData = await response.arrayBuffer();
        content = await extractTextFromPDF(pdfData, doc.id);
      } else {
        content = await response.text();
      }
      
      console.log(`[${doc.id}] Content loaded:`, content.length, 'characters');
      
      toast.info(`[${doc.id.toUpperCase()}] Invio all'edge function...`);
      
      const { data, error } = await supabase.functions.invoke('load-regulatory-documents', {
        body: {
          content,
          title: doc.title,
          version: doc.version,
          jurisdiction: doc.jurisdiction,
          sector: doc.sector,
          sourceUrl: doc.sourceUrl
        }
      });
      
      if (error) throw error;
      
      setStatusStates(prev => ({ ...prev, [doc.id]: 'success' }));
      setMessageStates(prev => ({ ...prev, [doc.id]: data.message }));
      toast.success(`[${doc.id.toUpperCase()}] Caricato con successo!`);
      
    } catch (error: any) {
      console.error(`[${doc.id}] Error:`, error);
      setStatusStates(prev => ({ ...prev, [doc.id]: 'error' }));
      setMessageStates(prev => ({ ...prev, [doc.id]: error.message }));
      toast.error(`[${doc.id.toUpperCase()}] Errore nel caricamento`);
    } finally {
      setLoadingStates(prev => ({ ...prev, [doc.id]: false }));
    }
  };

  const handleLoadAll = async () => {
    for (const doc of REGULATIONS) {
      await handleLoadDocument(doc);
      await new Promise(resolve => setTimeout(resolve, 2000));
    }
  };

  return (
    <div className="container max-w-6xl mx-auto py-8 px-4">
      <Button variant="ghost" onClick={() => navigate('/chat')} className="mb-6">
        ← Torna alla Chat
      </Button>

      <div className="space-y-6">
        <div className="flex justify-between items-start">
          <div>
            <h1 className="text-3xl font-bold mb-2">Carica Normative nel RAG</h1>
            <p className="text-muted-foreground">
              Carica tutte le normative complete nel sistema RAG per risposte accurate.
            </p>
          </div>
          <Button onClick={handleLoadAll} size="lg" variant="default">
            Carica Tutte le Normative
          </Button>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          {REGULATIONS.map((doc) => (
            <Card key={doc.id} className="p-6 space-y-4">
              <div className="flex items-start gap-3">
                <FileText className="w-8 h-8 text-primary mt-1" />
                <div className="flex-1">
                  <h3 className="font-semibold text-lg mb-1">{doc.title}</h3>
                  <p className="text-sm text-muted-foreground mb-2">{doc.description}</p>
                  <p className="text-xs text-muted-foreground">
                    {doc.version} • {doc.sector}
                  </p>
                </div>
              </div>

              {statusStates[doc.id] === 'success' && (
                <div className="flex items-start gap-2 p-3 bg-green-50 border border-green-200 rounded-lg">
                  <CheckCircle2 className="w-4 h-4 text-green-600 mt-0.5 flex-shrink-0" />
                  <p className="text-xs text-green-800">{messageStates[doc.id]}</p>
                </div>
              )}

              {statusStates[doc.id] === 'error' && (
                <div className="flex items-start gap-2 p-3 bg-red-50 border border-red-200 rounded-lg">
                  <AlertCircle className="w-4 h-4 text-red-600 mt-0.5 flex-shrink-0" />
                  <p className="text-xs text-red-800">{messageStates[doc.id]}</p>
                </div>
              )}

              <Button 
                onClick={() => handleLoadDocument(doc)} 
                disabled={loadingStates[doc.id]}
                className="w-full"
                variant={statusStates[doc.id] === 'success' ? 'outline' : 'default'}
              >
                {loadingStates[doc.id] ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Caricamento...
                  </>
                ) : statusStates[doc.id] === 'success' ? (
                  'Ricarica'
                ) : (
                  'Carica nel RAG'
                )}
              </Button>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
};

export default AdminLoadDocuments;
