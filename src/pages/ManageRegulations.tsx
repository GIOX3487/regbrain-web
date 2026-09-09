import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Shield, Plus, Trash2, Save, Loader2, Upload, Download, RefreshCw } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Progress } from "@/components/ui/progress";

interface Regulation {
  titolo: string;
  numero: string;
  data: string;
  fonte: string;
  lingua: string;
  url_pdf: string;
}

const ManageRegulations = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [regulations, setRegulations] = useState<Regulation[]>([]);
  const [loading, setLoading] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [isAdmin, setIsAdmin] = useState(false);
  const [checking, setChecking] = useState(true);
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [processedDocs, setProcessedDocs] = useState<string[]>([]);
  const [failedDocs, setFailedDocs] = useState<string[]>([]);
  const [reindexing, setReindexing] = useState(false);
  const [reindexProgress, setReindexProgress] = useState('');

  const [newReg, setNewReg] = useState<Regulation>({
    titolo: "",
    numero: "",
    data: new Date().toISOString().split('T')[0],
    fonte: "EUR-Lex",
    lingua: "IT",
    url_pdf: "",
  });

  useEffect(() => {
    const checkAdminRole = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        
        if (!session?.user) {
          navigate('/auth');
          return;
        }

        const { data, error } = await supabase.rpc('has_role', {
          _user_id: session.user.id,
          _role: 'admin'
        });

        if (error || !data) {
          toast({
            title: "Accesso Negato",
            description: "Non hai i permessi per accedere a questa pagina",
            variant: "destructive",
          });
          navigate('/chat');
          return;
        }

        setIsAdmin(true);
        loadRegulations();
      } catch (error) {
        console.error('Error:', error);
        navigate('/chat');
      } finally {
        setChecking(false);
      }
    };

    checkAdminRole();
  }, [navigate, toast]);

  const loadRegulations = async () => {
    try {
      const response = await fetch('/manifest_normative_rag.json');
      const data = await response.json();
      setRegulations(data);
    } catch (error: any) {
      toast({
        title: "Errore",
        description: "Impossibile caricare le normative",
        variant: "destructive"
      });
    }
  };

  const addRegulation = () => {
    if (!newReg.titolo || !newReg.numero || !newReg.url_pdf) {
      toast({
        title: "Campi mancanti",
        description: "Compila tutti i campi obbligatori",
        variant: "destructive"
      });
      return;
    }

    // Validate URL
    try {
      new URL(newReg.url_pdf);
    } catch {
      toast({
        title: "URL non valido",
        description: "Inserisci un URL PDF valido",
        variant: "destructive"
      });
      return;
    }

    setRegulations([...regulations, newReg]);
    setNewReg({
      titolo: "",
      numero: "",
      data: new Date().toISOString().split('T')[0],
      fonte: "EUR-Lex",
      lingua: "IT",
      url_pdf: "",
    });

    toast({
      title: "Normativa aggiunta",
      description: "Ricorda di salvare le modifiche",
    });
  };

  const removeRegulation = (index: number) => {
    setRegulations(regulations.filter((_, i) => i !== index));
    toast({
      title: "Normativa rimossa",
      description: "Ricorda di salvare le modifiche",
    });
  };

  const updateRegulation = (index: number, updated: Regulation) => {
    const newRegulations = [...regulations];
    newRegulations[index] = updated;
    setRegulations(newRegulations);
  };

  const saveManifest = async () => {
    setLoading(true);
    try {
      // In production, this would call an API endpoint to update the manifest file
      // For now, we'll show the JSON for manual update
      const manifestJson = JSON.stringify(regulations, null, 2);
      const blob = new Blob([manifestJson], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'manifest_normative_rag.json';
      a.click();
      
      toast({
        title: "Manifest scaricato",
        description: "Sostituisci il file in public/manifest_normative_rag.json",
      });
    } catch (error: any) {
      toast({
        title: "Errore",
        description: error.message,
        variant: "destructive"
      });
    }
    setLoading(false);
  };

  const processAllRegulations = async () => {
    setProcessing(true);
    setProgress(0);
    setProcessedDocs([]);
    setFailedDocs([]);

    const totalDocs = regulations.length;
    let processed = 0;

    for (const regulation of regulations) {
      try {
        // Check if already exists
        const { data: existing } = await supabase
          .from('documents')
          .select('id')
          .eq('title', regulation.titolo)
          .eq('version', regulation.numero)
          .maybeSingle();

        if (existing) {
          console.log(`Skipping ${regulation.titolo} - already exists`);
          setProcessedDocs(prev => [...prev, `${regulation.titolo} (già presente)`]);
        } else {
          console.log(`Processing: ${regulation.titolo}`);
          
          const { error } = await supabase.functions.invoke('process-document', {
            body: {
              pdf_url: regulation.url_pdf,
              title: regulation.titolo,
              version: regulation.numero,
              jurisdiction: regulation.lingua === 'IT' ? 'IT' : 'EU',
              sector: 'general',
              source_url: regulation.url_pdf,
              language: regulation.lingua,
            }
          });

          if (error) throw error;

          setProcessedDocs(prev => [...prev, regulation.titolo]);
          toast({
            title: "Documento caricato",
            description: regulation.titolo,
          });

          // Delay between processing to avoid overwhelming
          await new Promise(resolve => setTimeout(resolve, 2000));
        }
      } catch (error: any) {
        console.error('Error processing', regulation.titolo, error);
        setFailedDocs(prev => [...prev, `${regulation.titolo}: ${error.message}`]);
        toast({
          title: "Errore caricamento",
          description: regulation.titolo,
          variant: "destructive"
        });
      }

      processed++;
      setProgress((processed / totalDocs) * 100);
    }

    toast({
      title: "Processamento completato",
      description: `${processedDocs.length} documenti processati, ${failedDocs.length} errori`,
    });

    setProcessing(false);
  };

  const retryFailed = async () => {
    if (failedDocs.length === 0) return;

    setProcessing(true);
    const failedTitles = failedDocs.map(f => f.split(':')[0]);
    const toRetry = regulations.filter(r => failedTitles.includes(r.titolo));
    
    setFailedDocs([]);
    
    for (const regulation of toRetry) {
      try {
        const { error } = await supabase.functions.invoke('process-document', {
          body: {
            pdf_url: regulation.url_pdf,
            title: regulation.titolo,
            version: regulation.numero,
            jurisdiction: regulation.lingua === 'IT' ? 'IT' : 'EU',
            sector: 'general',
            source_url: regulation.url_pdf,
            language: regulation.lingua,
          }
        });

        if (error) throw error;

        setProcessedDocs(prev => [...prev, regulation.titolo]);
        toast({
          title: "Documento caricato",
          description: regulation.titolo,
        });

        await new Promise(resolve => setTimeout(resolve, 2000));
      } catch (error: any) {
        setFailedDocs(prev => [...prev, `${regulation.titolo}: ${error.message}`]);
      }
    }

    setProcessing(false);
  };

  const reindexAllEmbeddings = async () => {
    setReindexing(true);
    setReindexProgress('Avvio re-indicizzazione con OpenAI embeddings...');
    try {
      const { data, error } = await supabase.functions.invoke('generate-embedding', {
        body: { reindex_all: true }
      });

      if (error) throw error;

      setReindexProgress(`✅ Completato: ${data.total_chunks_updated} chunks aggiornati su ${data.documents_processed} documenti`);
      toast({
        title: "Re-indicizzazione completata",
        description: `${data.total_chunks_updated} chunks aggiornati con embedding OpenAI reali`,
      });
    } catch (error: any) {
      setReindexProgress(`❌ Errore: ${error.message}`);
      toast({
        title: "Errore re-indicizzazione",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setReindexing(false);
    }
  };

  if (checking) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!isAdmin) {
    return null;
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-muted/20 p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div className="flex items-center gap-3">
            <Shield className="w-8 h-8 text-primary" />
            <div>
              <h1 className="text-3xl font-bold">Gestione Normative</h1>
              <p className="text-muted-foreground">Amministra il dataset delle normative</p>
            </div>
          </div>
          <div className="flex flex-col sm:flex-row gap-2 w-full md:w-auto">
            <Button
              variant="default"
              onClick={reindexAllEmbeddings}
              disabled={reindexing}
              className="gap-2 w-full sm:w-auto"
            >
              {reindexing ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
              {reindexing ? 'Re-indicizzazione in corso...' : 'Rigenera Embedding (OpenAI)'}
            </Button>
            <Button variant="ghost" onClick={() => navigate('/chat')} className="w-full sm:w-auto">
              ← Torna alla Chat
            </Button>
          </div>
        </div>

        {reindexProgress && (
          <Card className="p-4 border-primary/20 bg-primary/5">
            <p className="text-sm font-mono">{reindexProgress}</p>
          </Card>
        )}

        <div className="grid md:grid-cols-2 gap-6">
          {/* Add New Regulation */}
          <Card className="p-6">
            <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
              <Plus className="w-5 h-5" />
              Aggiungi Normativa
            </h2>
            
            <div className="space-y-4">
              <div>
                <Label htmlFor="titolo">Titolo *</Label>
                <Input
                  id="titolo"
                  value={newReg.titolo}
                  onChange={(e) => setNewReg({ ...newReg, titolo: e.target.value })}
                  placeholder="es. GDPR - IT"
                />
              </div>

              <div>
                <Label htmlFor="numero">Numero/Codice *</Label>
                <Input
                  id="numero"
                  value={newReg.numero}
                  onChange={(e) => setNewReg({ ...newReg, numero: e.target.value })}
                  placeholder="es. Regulation (EU) 2016/679"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="data">Data</Label>
                  <Input
                    id="data"
                    type="date"
                    value={newReg.data}
                    onChange={(e) => setNewReg({ ...newReg, data: e.target.value })}
                  />
                </div>

                <div>
                  <Label htmlFor="lingua">Lingua</Label>
                  <Select value={newReg.lingua} onValueChange={(v) => setNewReg({ ...newReg, lingua: v })}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="IT">IT</SelectItem>
                      <SelectItem value="EN">EN</SelectItem>
                      <SelectItem value="FR">FR</SelectItem>
                      <SelectItem value="DE">DE</SelectItem>
                      <SelectItem value="ES">ES</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div>
                <Label htmlFor="fonte">Fonte</Label>
                <Input
                  id="fonte"
                  value={newReg.fonte}
                  onChange={(e) => setNewReg({ ...newReg, fonte: e.target.value })}
                  placeholder="es. EUR-Lex"
                />
              </div>

              <div>
                <Label htmlFor="url_pdf">URL PDF *</Label>
                <Input
                  id="url_pdf"
                  value={newReg.url_pdf}
                  onChange={(e) => setNewReg({ ...newReg, url_pdf: e.target.value })}
                  placeholder="https://..."
                />
              </div>

              <Button onClick={addRegulation} className="w-full gap-2">
                <Plus className="w-4 h-4" />
                Aggiungi alla Lista
              </Button>
            </div>
          </Card>

          {/* Actions */}
          <Card className="p-6">
            <h2 className="text-xl font-semibold mb-4">Azioni</h2>
            
            <div className="space-y-4">
              <div className="p-4 bg-muted rounded-lg">
                <p className="text-sm mb-2">Normative nel manifest: <strong>{regulations.length}</strong></p>
                <p className="text-sm text-muted-foreground">
                  Aggiungi, modifica o rimuovi normative, poi processa il database
                </p>
              </div>

              <Button 
                onClick={saveManifest} 
                disabled={loading}
                variant="outline"
                className="w-full gap-2"
              >
                <Download className="w-4 h-4" />
                Scarica Manifest JSON
              </Button>

              <Button 
                onClick={processAllRegulations}
                disabled={processing}
                className="w-full gap-2"
              >
                {processing ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Processando...
                  </>
                ) : (
                  <>
                    <Upload className="w-4 h-4" />
                    Processa Tutte ({regulations.length})
                  </>
                )}
              </Button>

              {failedDocs.length > 0 && (
                <Button 
                  onClick={retryFailed}
                  disabled={processing}
                  variant="destructive"
                  className="w-full gap-2"
                >
                  Riprova Falliti ({failedDocs.length})
                </Button>
              )}

              {processing && (
                <div className="space-y-2">
                  <Progress value={progress} />
                  <p className="text-sm text-center text-muted-foreground">
                    {Math.round(progress)}% completato
                  </p>
                </div>
              )}

              {(processedDocs.length > 0 || failedDocs.length > 0) && (
                <div className="text-sm">
                  <p className="text-green-600">✓ Successi: {processedDocs.length}</p>
                  <p className="text-red-600">✗ Errori: {failedDocs.length}</p>
                </div>
              )}
            </div>
          </Card>
        </div>

        {/* Regulations List */}
        <Card className="p-6">
          <h2 className="text-xl font-semibold mb-4">Normative Attuali ({regulations.length})</h2>
          
          <ScrollArea className="h-[600px]">
            <div className="space-y-2">
              {regulations.map((reg, index) => (
                <div 
                  key={index}
                  className="p-4 border rounded-lg hover:bg-muted/50 transition-colors"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 space-y-1">
                      <h3 className="font-semibold">{reg.titolo}</h3>
                      <p className="text-sm text-muted-foreground">{reg.numero}</p>
                      <div className="flex gap-4 text-xs text-muted-foreground">
                        <span>📅 {reg.data}</span>
                        <span>🗣️ {reg.lingua}</span>
                        <span>📚 {reg.fonte}</span>
                      </div>
                      <p className="text-xs text-muted-foreground truncate">{reg.url_pdf}</p>
                    </div>
                    
                    <div className="flex gap-2">
                      <Dialog>
                        <DialogTrigger asChild>
                          <Button 
                            variant="ghost" 
                            size="sm"
                            onClick={() => setEditingIndex(index)}
                          >
                            Modifica
                          </Button>
                        </DialogTrigger>
                        <DialogContent>
                          <DialogHeader>
                            <DialogTitle>Modifica Normativa</DialogTitle>
                            <DialogDescription>
                              Aggiorna i dettagli della normativa
                            </DialogDescription>
                          </DialogHeader>
                          {editingIndex === index && (
                            <div className="space-y-4">
                              <div>
                                <Label>Titolo</Label>
                                <Input
                                  value={reg.titolo}
                                  onChange={(e) => updateRegulation(index, { ...reg, titolo: e.target.value })}
                                />
                              </div>
                              <div>
                                <Label>Numero</Label>
                                <Input
                                  value={reg.numero}
                                  onChange={(e) => updateRegulation(index, { ...reg, numero: e.target.value })}
                                />
                              </div>
                              <div>
                                <Label>URL PDF</Label>
                                <Input
                                  value={reg.url_pdf}
                                  onChange={(e) => updateRegulation(index, { ...reg, url_pdf: e.target.value })}
                                />
                              </div>
                              <Button onClick={() => setEditingIndex(null)} className="w-full">
                                <Save className="w-4 h-4 mr-2" />
                                Salva
                              </Button>
                            </div>
                          )}
                        </DialogContent>
                      </Dialog>
                      
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => removeRegulation(index)}
                      >
                        <Trash2 className="w-4 h-4 text-destructive" />
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </ScrollArea>
        </Card>
      </div>
    </div>
  );
};

export default ManageRegulations;
