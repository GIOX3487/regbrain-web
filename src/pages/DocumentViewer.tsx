import { useState, useEffect, useCallback } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ChevronLeft, ExternalLink, Search, FileText, Copy, AlertCircle, CheckCircle2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const DocumentViewer = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [document, setDocument] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [highlightText, setHighlightText] = useState<string>("");
  const [searchKeywords, setSearchKeywords] = useState<string[]>([]);
  const [copiedKeyword, setCopiedKeyword] = useState<string | null>(null);

  const documentId = searchParams.get('id');
  const chunkContent = searchParams.get('highlight');

  // Extract key search terms from chunk content
  const extractSearchKeywords = useCallback((text: string): string[] => {
    const keywords: string[] = [];
    
    // Extract article references (most useful for searching)
    const articleMatches = text.matchAll(/(?:articolo|art\.?|article)\s+(\d+(?:\s*,\s*(?:paragrafo|comma|paragraph)\s+\d+)?)/gi);
    for (const match of articleMatches) {
      keywords.push(match[0]);
    }
    
    // Extract key phrases (first 50 chars of meaningful content)
    const cleanText = text.replace(/\s+/g, ' ').trim();
    const sentences = cleanText.split(/[.!?]+/).filter(s => s.trim().length > 20);
    if (sentences.length > 0) {
      // Take first meaningful sentence fragment
      const firstPhrase = sentences[0].trim().substring(0, 80);
      if (firstPhrase.length > 20) {
        keywords.push(firstPhrase + '...');
      }
    }
    
    return keywords.slice(0, 3); // Max 3 keywords
  }, []);

  useEffect(() => {
    const loadDocument = async () => {
      if (!documentId) {
        toast({
          title: "Errore",
          description: "ID documento mancante",
          variant: "destructive"
        });
        navigate('/chat');
        return;
      }

      try {
        const { data, error } = await supabase
          .from('documents')
          .select('*')
          .eq('id', documentId)
          .single();

        if (error) throw error;

        setDocument(data);
        if (chunkContent) {
          const cleanText = decodeURIComponent(chunkContent);
          setHighlightText(cleanText);
          
          // Extract searchable keywords
          const keywords = extractSearchKeywords(cleanText);
          setSearchKeywords(keywords);
          
          // Auto-copy first keyword if it's an article reference
          if (keywords.length > 0 && /articolo|art\./i.test(keywords[0])) {
            navigator.clipboard.writeText(keywords[0]).catch(() => {});
          }
        }
      } catch (error: any) {
        console.error('Error loading document:', error);
        toast({
          title: "Errore",
          description: "Impossibile caricare il documento",
          variant: "destructive"
        });
      } finally {
        setLoading(false);
      }
    };

    loadDocument();
  }, [documentId, chunkContent, navigate, toast, extractSearchKeywords]);

  const copyToClipboard = (text: string, isKeyword = false) => {
    navigator.clipboard.writeText(text);
    if (isKeyword) {
      setCopiedKeyword(text);
      setTimeout(() => setCopiedKeyword(null), 2000);
      toast({
        title: "Testo copiato!",
        description: "Ora usa Ctrl+F nel documento per cercarlo",
      });
    } else {
      toast({
        title: "Copiato!",
        description: "URL copiato negli appunti",
      });
    }
  };

  const openDocumentAndSearch = () => {
    // Copy first search keyword to clipboard for easy paste
    if (searchKeywords.length > 0) {
      navigator.clipboard.writeText(searchKeywords[0]).catch(() => {});
    }
    // Open document in new tab
    if (document?.source_url) {
      window.open(document.source_url, '_blank', 'noopener,noreferrer');
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Caricamento documento...</p>
        </div>
      </div>
    );
  }

  if (!document) return null;

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="sticky top-0 z-50 border-b bg-card/95 backdrop-blur">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between gap-4">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                // Restore conversation state if exists
                const chatState = sessionStorage.getItem('chatState');
                if (chatState) {
                  const state = JSON.parse(chatState);
                  // Save messages to be restored in Chat
                  sessionStorage.setItem('restoreMessages', JSON.stringify(state.messages));
                  sessionStorage.removeItem('chatState');
                  navigate('/chat');
                } else {
                  navigate('/chat');
                }
              }}
              className="shrink-0"
            >
              <ChevronLeft className="w-4 h-4 mr-2" />
              Torna alla Chat
            </Button>

            <div className="flex-1 min-w-0">
              <h1 className="text-lg font-semibold truncate">{document.title}</h1>
              <div className="flex items-center gap-2 mt-1">
                <Badge variant="outline">{document.version}</Badge>
                <Badge variant="secondary">{document.jurisdiction}</Badge>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="container mx-auto px-4 py-8 max-w-4xl">
        <Card className="p-6 lg:p-8">
          {/* Search Keywords - Quick copy for finding in document */}
          {searchKeywords.length > 0 && (
            <Card className="mb-6 p-4 bg-green-50 dark:bg-green-950/20 border-green-200 dark:border-green-800">
              <div className="flex items-start gap-3">
                <Search className="w-5 h-5 text-green-600 dark:text-green-400 shrink-0 mt-0.5" />
                <div className="flex-1">
                  <p className="text-sm font-semibold text-green-900 dark:text-green-100 mb-3">
                    🔍 Cerca nel documento con questi termini:
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {searchKeywords.map((keyword, idx) => (
                      <Button
                        key={idx}
                        variant={copiedKeyword === keyword ? "default" : "outline"}
                        size="sm"
                        className={`text-xs ${copiedKeyword === keyword ? 'bg-green-600' : 'border-green-300 hover:bg-green-100 dark:hover:bg-green-900'}`}
                        onClick={() => copyToClipboard(keyword, true)}
                      >
                        {copiedKeyword === keyword ? (
                          <CheckCircle2 className="w-3 h-3 mr-1" />
                        ) : (
                          <Copy className="w-3 h-3 mr-1" />
                        )}
                        {keyword.length > 40 ? keyword.substring(0, 40) + '...' : keyword}
                      </Button>
                    ))}
                  </div>
                  <p className="text-xs text-green-700 dark:text-green-300 mt-3">
                    👆 Clicca per copiare, poi usa <kbd className="px-1.5 py-0.5 bg-green-200 dark:bg-green-800 rounded text-xs font-mono">Ctrl+F</kbd> nel PDF e incolla
                  </p>
                </div>
              </div>
            </Card>
          )}

          {/* Full Highlight Text */}
          {highlightText && (
            <Card className="mb-6 p-4 bg-yellow-50 dark:bg-yellow-950/20 border-yellow-200 dark:border-yellow-800">
              <div className="flex items-start gap-3">
                <FileText className="w-5 h-5 text-yellow-600 dark:text-yellow-400 shrink-0 mt-0.5" />
                <div className="flex-1">
                  <p className="text-sm font-semibold text-yellow-900 dark:text-yellow-100 mb-2">
                    📄 Testo completo della sezione citata:
                  </p>
                  <div className="bg-white dark:bg-yellow-900/20 p-3 rounded border border-yellow-300 dark:border-yellow-700 max-h-[200px] overflow-y-auto">
                    <p className="text-sm text-yellow-800 dark:text-yellow-200 leading-relaxed text-justify">
                      {/* Normalize text: remove excessive whitespace and line breaks for clean display */}
                      {highlightText
                        .replace(/\r\n/g, ' ')
                        .replace(/\n/g, ' ')
                        .replace(/\s+/g, ' ')
                        .trim()}
                    </p>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    className="mt-2 text-xs border-yellow-300 hover:bg-yellow-100"
                    onClick={() => copyToClipboard(highlightText, true)}
                  >
                    <Copy className="w-3 h-3 mr-1" />
                    Copia testo completo
                  </Button>
                </div>
              </div>
            </Card>
          )}

          {/* Document Info */}
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <FileText className="w-6 h-6 text-primary" />
              <div>
                <h2 className="text-xl font-semibold">{document.title}</h2>
                <p className="text-sm text-muted-foreground mt-1">
                  Versione: {document.version} | Giurisdizione: {document.jurisdiction}
                </p>
              </div>
            </div>

            {document.source_url && (
              <>
                {/* Alert per blocco browser */}
                <Card className="p-4 bg-blue-50 dark:bg-blue-950/20 border-blue-200 dark:border-blue-800">
                  <div className="flex items-start gap-3">
                    <AlertCircle className="w-5 h-5 text-blue-600 dark:text-blue-400 shrink-0 mt-0.5" />
                    <div className="flex-1 text-sm">
                      <p className="font-semibold text-blue-900 dark:text-blue-100 mb-1">
                        Problemi ad aprire il documento?
                      </p>
                      <p className="text-blue-800 dark:text-blue-200">
                        Se il tuo browser blocca EUR-Lex (ad blocker o estensioni di sicurezza), prova a:
                      </p>
                      <ul className="list-disc list-inside mt-2 text-blue-700 dark:text-blue-300 space-y-1">
                        <li>Disabilitare temporaneamente l'ad blocker</li>
                        <li>Aprire in modalità incognito</li>
                        <li>Copiare l'URL qui sotto e aprirlo manualmente</li>
                      </ul>
                    </div>
                  </div>
                </Card>

                <div className="pt-4 space-y-3">
                  <Button
                    className="w-full"
                    size="lg"
                    onClick={openDocumentAndSearch}
                  >
                    <ExternalLink className="w-4 h-4 mr-2" />
                    {searchKeywords.length > 0 ? 'Apri documento (termine copiato)' : 'Apri Documento Ufficiale'}
                  </Button>

                  {/* URL copiabile */}
                  <div className="flex gap-2">
                    <div className="flex-1 bg-muted rounded-md p-3 overflow-x-auto">
                      <code className="text-xs break-all">{document.source_url}</code>
                    </div>
                    <Button
                      variant="outline"
                      size="icon"
                      onClick={() => copyToClipboard(document.source_url)}
                      title="Copia URL"
                    >
                      <Copy className="w-4 h-4" />
                    </Button>
                  </div>
                  
                  <p className="text-xs text-center text-muted-foreground">
                    Copia l'URL e incollalo nel browser se il pulsante non funziona
                  </p>
                </div>
              </>
            )}

            {!document.source_url && (
              <div className="text-center p-8 bg-muted rounded-lg">
                <p className="text-muted-foreground">
                  URL del documento non disponibile
                </p>
              </div>
            )}

            {/* Instructions */}
            <Card className="mt-6 p-4 bg-muted/50">
              <h3 className="text-sm font-semibold mb-2">Come utilizzare:</h3>
              <ul className="text-sm text-muted-foreground space-y-2">
                <li className="flex items-start gap-2">
                  <span className="text-primary">1.</span>
                  <span>Clicca sul pulsante sopra per aprire il documento PDF ufficiale</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-primary">2.</span>
                  <span>Usa la funzione di ricerca del browser (Ctrl+F o Cmd+F) per trovare il testo evidenziato</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-primary">3.</span>
                  <span>Naviga il documento per il contesto completo della normativa</span>
                </li>
              </ul>
            </Card>
          </div>
        </Card>
      </div>
    </div>
  );
};

export default DocumentViewer;

