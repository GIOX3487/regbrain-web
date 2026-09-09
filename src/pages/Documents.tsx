import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Upload, FileText, Menu, LogOut, Send, History, Loader2, Trash2, RefreshCw, Download } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";

interface Document {
  id: string;
  title: string;
  jurisdiction: string;
  sector: string;
  language: string;
  created_at: string;
  version: string;
}

const Documents = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [documents, setDocuments] = useState<Document[]>([]);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [loading, setLoading] = useState(true);
  const [scraping, setScraping] = useState(false);
  
  // Form state for manual upload
  const [jurisdiction, setJurisdiction] = useState("EU");
  const [sector, setSector] = useState("general");
  const [language, setLanguage] = useState("IT");

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (!session) {
        navigate('/auth');
      }
    });

    loadDocuments();
    return () => subscription.unsubscribe();
  }, [navigate]);

  const loadDocuments = async () => {
    try {
      const { data, error } = await supabase
        .from('documents')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setDocuments(data || []);
    } catch (error: any) {
      console.error('Error loading documents:', error);
      toast({
        title: "Errore",
        description: error.message || "Impossibile caricare i documenti",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleFileUpload = async (files: FileList | null) => {
    if (!files || files.length === 0) return;

    setUploading(true);
    setUploadProgress(0);

    try {
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        
        console.log(`Processing file ${i + 1}/${files.length}: ${file.name}`);
        
        // For PDF files, use URL-based processing instead of base64
        // This avoids issues with large files and allows proper PDF parsing
        if (file.type === 'application/pdf') {
          // Create a temporary object URL for the file
          const fileUrl = URL.createObjectURL(file);
          
          try {
            // Read file as array buffer for proper PDF processing
            const arrayBuffer = await file.arrayBuffer();
            const base64 = btoa(
              new Uint8Array(arrayBuffer)
                .reduce((data, byte) => data + String.fromCharCode(byte), '')
            );
            
            const { data, error } = await supabase.functions.invoke('process-document', {
              body: {
                file_data: `data:application/pdf;base64,${base64}`,
                file_name: file.name,
                title: file.name.replace(/\.pdf$/i, ''),
                jurisdiction,
                sector,
                language,
                version: '1.0',
              }
            });

            if (error) throw error;

            toast({
              title: "Documento caricato",
              description: `${file.name} processato con successo`,
            });
          } finally {
            URL.revokeObjectURL(fileUrl);
          }
        } else {
          // For other file types, use base64 as before
          const base64 = await new Promise<string>((resolve) => {
            const reader = new FileReader();
            reader.onloadend = () => resolve(reader.result as string);
            reader.readAsDataURL(file);
          });

          const { data, error } = await supabase.functions.invoke('process-document', {
            body: {
              file_data: base64,
              file_name: file.name,
              title: file.name.replace(/\.(pdf|docx|txt)$/i, ''),
              jurisdiction,
              sector,
              language,
              version: '1.0',
            }
          });

          if (error) throw error;

          toast({
            title: "Documento caricato",
            description: `${file.name} processato con successo`,
          });
        }

        setUploadProgress(((i + 1) / files.length) * 100);
      }

      await loadDocuments();
      
      // Reset form
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    } catch (error: any) {
      console.error('Upload error:', error);
      toast({
        title: "Errore caricamento",
        description: error.message || "Impossibile caricare il documento",
        variant: "destructive",
      });
    } finally {
      setUploading(false);
      setUploadProgress(0);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      const { error } = await supabase
        .from('documents')
        .delete()
        .eq('id', id);

      if (error) throw error;

      toast({
        title: "Documento eliminato",
        description: "Il documento è stato rimosso dal database",
      });

      await loadDocuments();
    } catch (error: any) {
      toast({
        title: "Errore",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const handleScrapeEDPB = async () => {
    setScraping(true);
    try {
      const { data, error } = await supabase.functions.invoke('scrape-edpb');

      if (error) throw error;

      toast({
        title: "Scraping completato",
        description: `Elaborate ${data.processed} nuove normative da EDPB`,
      });

      await loadDocuments();
    } catch (error: any) {
      console.error('Scraping error:', error);
      toast({
        title: "Errore scraping",
        description: error.message || "Impossibile scaricare le normative",
        variant: "destructive",
      });
    } finally {
      setScraping(false);
    }
  };

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    navigate('/');
  };

  return (
    <div className="flex h-screen bg-background">
      {/* Sidebar */}
      <aside className="w-80 border-r bg-card p-6 space-y-6">
        <div className="flex items-center gap-2">
          <Menu className="w-6 h-6 text-primary" />
          <h1 className="text-2xl font-bold">RegBrain</h1>
        </div>

        <nav className="space-y-2">
          <Button variant="ghost" className="w-full justify-start" onClick={() => navigate('/chat')}>
            <Send className="w-4 h-4 mr-2" />
            Chat
          </Button>
          <Button variant="default" className="w-full justify-start" onClick={() => navigate('/documents')}>
            <FileText className="w-4 h-4 mr-2" />
            Documenti
          </Button>
          <Button variant="ghost" className="w-full justify-start" onClick={() => navigate('/audit')}>
            <History className="w-4 h-4 mr-2" />
            Audit Log
          </Button>
        </nav>

        <div className="absolute bottom-6">
          <Button variant="ghost" className="w-full justify-start text-destructive" onClick={handleSignOut}>
            <LogOut className="w-4 h-4 mr-2" />
            Esci
          </Button>
        </div>
      </aside>

      {/* Main Area */}
      <main className="flex-1 overflow-y-auto p-8">
        <div className="max-w-6xl mx-auto space-y-6">
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-4xl font-bold mb-2">Documenti Normativi</h1>
              <p className="text-muted-foreground">
                Carica e gestisci documenti per il sistema RAG
              </p>
            </div>
            <div className="flex gap-2">
              <Button onClick={handleScrapeEDPB} variant="outline" disabled={scraping}>
                {scraping ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Scaricamento...
                  </>
                ) : (
                  <>
                    <Download className="w-4 h-4 mr-2" />
                    Importa da EDPB
                  </>
                )}
              </Button>
              <Button onClick={() => loadDocuments()} variant="outline">
                <RefreshCw className="w-4 h-4 mr-2" />
                Aggiorna
              </Button>
            </div>
          </div>

          {/* Upload Card */}
          <Card className="bg-gradient-to-br from-primary/5 to-accent/5">
            <CardHeader>
              <CardTitle>Carica Normative</CardTitle>
              <CardDescription>
                Supportati: PDF, DOCX, TXT - Il sistema estrarrà automaticamente il testo e genererà gli embeddings
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-3 gap-4">
                <NativeSelect
                  label="Giurisdizione"
                  value={jurisdiction}
                  onChange={(e) => setJurisdiction(e.target.value)}
                >
                  <option value="EU">Unione Europea</option>
                  <option value="IT">Italia</option>
                  <option value="US">Stati Uniti</option>
                  <option value="UK">Regno Unito</option>
                </NativeSelect>

                <NativeSelect
                  label="Settore"
                  value={sector}
                  onChange={(e) => setSector(e.target.value)}
                >
                  <option value="general">Generale</option>
                  <option value="finance">Finanza</option>
                  <option value="healthcare">Sanità</option>
                  <option value="tech">Tecnologia</option>
                  <option value="energy">Energia</option>
                </NativeSelect>

                <NativeSelect
                  label="Lingua"
                  value={language}
                  onChange={(e) => setLanguage(e.target.value)}
                >
                  <option value="IT">Italiano</option>
                  <option value="EN">Inglese</option>
                  <option value="DE">Tedesco</option>
                  <option value="FR">Francese</option>
                  <option value="ES">Spagnolo</option>
                </NativeSelect>
              </div>

              <input
                ref={fileInputRef}
                type="file"
                multiple
                accept=".pdf,.docx,.txt"
                onChange={(e) => handleFileUpload(e.target.files)}
                className="hidden"
              />

              <div className="border-2 border-dashed border-border rounded-lg p-12 text-center">
                <Upload className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
                <p className="text-muted-foreground mb-4">
                  {uploading ? "Caricamento in corso..." : "Trascina i file qui o clicca per selezionare"}
                </p>
                <Button 
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploading}
                  className="gradient-hero-button"
                >
                  {uploading ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Elaborazione...
                    </>
                  ) : (
                    <>
                      <Upload className="w-4 h-4 mr-2" />
                      Seleziona File
                    </>
                  )}
                </Button>
              </div>

              {uploading && uploadProgress > 0 && (
                <div className="space-y-2">
                  <Progress value={uploadProgress} />
                  <p className="text-sm text-center text-muted-foreground">
                    {Math.round(uploadProgress)}% completato
                  </p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Documents List */}
          <div className="space-y-4">
            <h2 className="text-2xl font-semibold">Documenti Caricati ({documents.length})</h2>
            
            {loading ? (
              <div className="flex justify-center py-12">
                <Loader2 className="w-8 h-8 animate-spin text-primary" />
              </div>
            ) : documents.length === 0 ? (
              <Card className="p-12 text-center">
                <FileText className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
                <p className="text-muted-foreground">
                  Nessun documento caricato. Inizia caricando le normative che ti servono.
                </p>
              </Card>
            ) : (
              <div className="grid gap-4">
                {documents.map((doc) => (
                  <Card key={doc.id} className="document-card">
                    <CardHeader>
                      <div className="flex justify-between items-start">
                        <div className="space-y-1 flex-1">
                          <CardTitle className="text-xl">{doc.title}</CardTitle>
                          <CardDescription>
                            Caricato il {new Date(doc.created_at).toLocaleDateString('it-IT')}
                          </CardDescription>
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDelete(doc.id)}
                          className="text-destructive hover:text-destructive"
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <div className="flex flex-wrap gap-2">
                        <Badge variant="outline">
                          {doc.jurisdiction}
                        </Badge>
                        <Badge variant="outline">
                          {doc.sector}
                        </Badge>
                        <Badge variant="outline">
                          {doc.language}
                        </Badge>
                        <Badge variant="outline">
                          v{doc.version}
                        </Badge>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
};

export default Documents;
