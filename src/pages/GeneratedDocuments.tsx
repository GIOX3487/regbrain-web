import { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { NativeSelect } from "@/components/ui/native-select";
import {
  FileText,
  Download,
  Plus,
  Loader2,
  ArrowLeft,
  Shield,
  CheckCircle2,
  Clock,
  Eye,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { format } from "date-fns";
import DocumentPreviewDialog from "@/components/documents/DocumentPreviewDialog";
import { exportDocumentToPDF } from "@/lib/document-pdf-export";

interface GeneratedDocument {
  id: string;
  title: string;
  document_type: string;
  created_at: string;
  content: any;
  metadata?: any;
  assessment_id?: string | null;
  version: number;
}

interface Assessment {
  id: string;
  title: string;
  assessment_type: string;
  status: string;
}

const DOCUMENT_TYPES = [
  { value: 'dpia', label: 'DPIA - Data Protection Impact Assessment (Art. 35 GDPR)', description: 'Valutazione d\'impatto sulla protezione dei dati personali - Documento completo con pre-assessment, matrice rischio R=f(M,p), misure di sicurezza e parere DPO' },
  { value: 'ropa', label: 'RoPA - Registro Attività di Trattamento (Art. 30 GDPR)', description: 'Registro completo delle attività di trattamento con schede dettagliate per ogni trattamento, responsabili, misure di sicurezza e condizioni di liceità' },
];

export default function GeneratedDocuments() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { toast } = useToast();
  const [documents, setDocuments] = useState<GeneratedDocument[]>([]);
  const [assessments, setAssessments] = useState<Assessment[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [showGenerateDialog, setShowGenerateDialog] = useState(false);
  const [selectedType, setSelectedType] = useState('');
  const [selectedAssessment, setSelectedAssessment] = useState('');
  const [selectedMode, setSelectedMode] = useState('standard');
  const [previewDoc, setPreviewDoc] = useState<GeneratedDocument | null>(null);
  useEffect(() => {
    checkAuthAndLoadData();
  }, []);

  // Finché un documento è in generazione, ricarica l'elenco ogni 8 secondi
  useEffect(() => {
    const pending = documents.some((d) => (d.content as any)?._status === 'generating');
    if (!pending) return;
    const timer = setInterval(() => { loadData(); }, 8000);
    return () => clearInterval(timer);
  }, [documents]);

  // Arrivo dalla chat: tipo di documento preselezionato e dialogo già aperto
  useEffect(() => {
    const requestedType = searchParams.get('type');
    if (requestedType && DOCUMENT_TYPES.some((t) => t.value === requestedType)) {
      setSelectedType(requestedType);
      if (searchParams.get('nuovo') === '1') setShowGenerateDialog(true);
    }
  }, [searchParams]);

  const checkAuthAndLoadData = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    setIsAuthenticated(!!session);
    if (session) {
      await loadData();
    } else {
      setLoading(false);
    }
  };

  const loadData = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      // Load generated documents
      const { data: docsData, error: docsError } = await supabase
        .from('generated_documents')
        .select('*')
        .order('created_at', { ascending: false });

      if (docsError) throw docsError;
      setDocuments(docsData || []);

      // Load assessments for document generation
      const { data: assessmentsData, error: assessmentsError } = await supabase
        .from('compliance_assessments')
        .select('id, title, assessment_type, status')
        .eq('status', 'completed')
        .order('created_at', { ascending: false });

      if (assessmentsError) throw assessmentsError;
      setAssessments(assessmentsData || []);

    } catch (error) {
      console.error('Error loading data:', error);
      toast({
        title: "Errore",
        description: "Impossibile caricare i documenti",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const generateDocument = async () => {
    if (!selectedType || !selectedAssessment) {
      toast({
        title: "Campi mancanti",
        description: "Seleziona tipo documento e valutazione",
        variant: "destructive",
      });
      return;
    }

    try {
      setGenerating(true);
      
      const { data, error } = await supabase.functions.invoke('generate-audit-document', {
        body: {
          documentType: selectedType,
          assessmentId: selectedAssessment,
          mode: selectedMode,
        }
      });

      if (error) throw error;

      toast({
        title: "✅ Documento generato",
        description: `${DOCUMENT_TYPES.find(t => t.value === selectedType)?.label} creato con successo`,
      });

      setShowGenerateDialog(false);
      setSelectedType('');
      setSelectedAssessment('');
      setSelectedMode('standard');
      await loadData();

    } catch (error: any) {
      console.error('Error generating document:', error);
      toast({
        title: "Errore nella generazione",
        description: error.message || "Impossibile generare il documento",
        variant: "destructive",
      });
    } finally {
      setGenerating(false);
    }
  };

  const downloadDocumentJSON = (doc: GeneratedDocument) => {
    const content = JSON.stringify(doc.content, null, 2);
    const blob = new Blob([content], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${doc.document_type}_${format(new Date(doc.created_at), 'yyyy-MM-dd')}.json`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const downloadDocumentPDF = (doc: GeneratedDocument) => {
    exportDocumentToPDF(doc);
    toast({
      title: "PDF scaricato",
      description: "Documento esportato in formato PDF professionale",
    });
  };

  const getDocumentTypeBadge = (type: string) => {
    const colors: Record<string, "default" | "destructive" | "outline" | "secondary"> = {
      dpia: 'destructive',
      ropa: 'default',
    };
    return colors[type] || 'default';
  };

  const getDocumentTypeLabel = (type: string) => {
    return DOCUMENT_TYPES.find(t => t.value === type)?.label.split(' - ')[0] || type.toUpperCase();
  };

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-background">
        <div className="container mx-auto py-16 px-4 text-center">
          <Shield className="h-24 w-24 mx-auto text-primary mb-6" />
          <h1 className="text-4xl font-bold mb-4">Documenti di Compliance</h1>
          <p className="text-xl text-muted-foreground mb-8">
            Genera automaticamente DPIA, RoPA, LIA e altri documenti audit-ready
          </p>
          <p className="text-muted-foreground mb-6 max-w-2xl mx-auto">
            Accedi per generare documenti professionali precompilati con i dati delle tue valutazioni di conformità.
            Risparmia settimane di lavoro manuale.
          </p>
          <Button onClick={() => navigate('/auth')} size="lg">
            Accedi per iniziare
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto py-8 px-4">
        {/* Header */}
        <div className="flex justify-between items-center mb-8">
          <div>
            <Button 
              variant="ghost" 
              onClick={() => navigate('/compliance')}
              className="mb-4"
            >
              <ArrowLeft className="mr-2 h-4 w-4" />
              Torna al Compliance Hub
            </Button>
            <h1 className="text-4xl font-bold mb-2">Document Generator</h1>
          </div>
          <Button 
            onClick={() => setShowGenerateDialog(true)}
            disabled={assessments.length === 0}
          >
            <Plus className="mr-2 h-4 w-4" />
            Genera Documento
          </Button>
        </div>

        {/* No Assessments Alert */}
        {assessments.length === 0 && (
          <Card className="mb-6 border-orange-500/50 bg-orange-500/5">
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Clock className="h-5 w-5 text-orange-500" />
                Completa prima una valutazione
              </CardTitle>
              <CardDescription>
                Per generare documenti hai bisogno di almeno una valutazione di conformità completata
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button onClick={() => navigate('/compliance/new-assessment')}>
                <Plus className="mr-2 h-4 w-4" />
                Crea Nuova Valutazione
              </Button>
            </CardContent>
          </Card>
        )}

        {/* Feature Description */}
        <Card className="mb-6 border-primary/50 bg-primary/5">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <FileText className="h-5 w-5 text-primary" />
              Come funziona il Document Generator
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid md:grid-cols-2 gap-4 text-sm">
              <div className="space-y-2">
                <h4 className="font-semibold text-primary">📋 DPIA (Art. 35 GDPR) - 11 Sezioni</h4>
                <p className="text-muted-foreground">
                  Data Protection Impact Assessment completa con pre-assessment, criteri WP29,
                  matrice rischio R=f(M,p), misure di sicurezza trasversali e su asset,
                  valutazione minacce con rischio iniziale e residuo, parere DPO,
                  decisione finale, piano di revisione, checklist GDPR e suggerimenti privacy-by-design.
                </p>
              </div>
              <div className="space-y-2">
                <h4 className="font-semibold text-primary">📋 RoPA (Art. 30 GDPR)</h4>
                <p className="text-muted-foreground">
                  Registro delle Attività di Trattamento del Titolare con schede dettagliate
                  per ogni trattamento: titolare, responsabile Art. 28, DPO, categorie dati,
                  tempi di conservazione, misure di sicurezza, condizioni di liceità,
                  suggerimenti privacy-by-design e log revisione documento.
                </p>
              </div>
            </div>
            <div className="mt-4 p-3 bg-muted rounded-lg text-sm">
              <p className="font-medium mb-1">🎯 Tre modalità disponibili:</p>
              <ul className="text-muted-foreground space-y-1">
                <li><strong>Standard:</strong> Documento completo professionale pronto per audit (25-30 pagine)</li>
                <li><strong>Breve:</strong> Executive summary sintetico con punti chiave (5-8 pagine)</li>
                <li><strong>Audit:</strong> Versione estesa con mapping ISO 27001 + GDPR (40+ pagine)</li>
              </ul>
            </div>
          </CardContent>
        </Card>

        {/* Documents List */}
        {loading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : documents.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <FileText className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <h3 className="text-lg font-semibold mb-2">Nessun documento generato</h3>
              <p className="text-muted-foreground mb-4">
                Inizia generando il tuo primo documento di compliance
              </p>
              {assessments.length > 0 && (
                <Button onClick={() => setShowGenerateDialog(true)}>
                  <Plus className="mr-2 h-4 w-4" />
                  Genera Primo Documento
                </Button>
              )}
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4">
            {documents.map((doc) => (
              <Card key={doc.id} className="hover:shadow-lg transition-shadow">
                <CardHeader>
                  <div className="flex justify-between items-start">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <Badge variant={getDocumentTypeBadge(doc.document_type)}>
                          {getDocumentTypeLabel(doc.document_type)}
                        </Badge>
                        <Badge variant="outline">v{doc.version}</Badge>
                        {(doc.content as any)?._status === 'generating' && (
                          <Badge variant="secondary" className="gap-1"><Loader2 className="h-3 w-3 animate-spin" /> Generazione in corso</Badge>
                        )}
                        {(doc.content as any)?._status === 'failed' && (
                          <Badge variant="destructive">Generazione fallita</Badge>
                        )}
                        {(doc.metadata as any)?.source === 'chat' && (
                          <Badge variant="outline">Dalla chat</Badge>
                        )}
                        {searchParams.get('doc') === doc.id && (
                          <Badge>Nuovo</Badge>
                        )}
                        <span className="text-sm text-muted-foreground">
                          {format(new Date(doc.created_at), 'dd/MM/yyyy HH:mm')}
                        </span>
                      </div>
                      <CardTitle>{doc.title}</CardTitle>
                    </div>
                    <div className="flex gap-2 shrink-0">
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={(doc.content as any)?._status === 'generating'}
                        onClick={() => setPreviewDoc(doc)}
                      >
                        <Eye className="h-4 w-4 mr-2" />
                        Anteprima
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={(doc.content as any)?._status === 'generating'}
                        onClick={() => downloadDocumentPDF(doc)}
                      >
                        <Download className="h-4 w-4 mr-2" />
                        PDF
                      </Button>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <CheckCircle2 className="h-4 w-4 text-green-500" />
                    <span>Documento audit-ready generato automaticamente</span>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {/* Generate Document Dialog */}
        <Dialog open={showGenerateDialog} onOpenChange={setShowGenerateDialog}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Genera Nuovo Documento</DialogTitle>
              <DialogDescription>
                Seleziona il tipo di documento e la valutazione di riferimento.
                Il documento sarà precompilato automaticamente con i dati della valutazione.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-4">
              <NativeSelect
                label="Tipo di documento"
                value={selectedType}
                onChange={(e) => setSelectedType(e.target.value)}
              >
                <option value="">Seleziona tipo documento...</option>
                {DOCUMENT_TYPES.map((type) => (
                  <option key={type.value} value={type.value}>
                    {type.label}
                  </option>
                ))}
              </NativeSelect>

              {selectedType && (
                <div className="p-3 bg-muted rounded-lg text-sm">
                  <p className="text-muted-foreground">
                    {DOCUMENT_TYPES.find(t => t.value === selectedType)?.description}
                  </p>
                </div>
              )}

              <NativeSelect
                label="Valutazione di riferimento"
                value={selectedAssessment}
                onChange={(e) => setSelectedAssessment(e.target.value)}
                helperText="Solo valutazioni completate"
              >
                <option value="">Seleziona valutazione...</option>
                {assessments.map((assessment) => (
                  <option key={assessment.id} value={assessment.id}>
                    {assessment.title} ({assessment.assessment_type})
                  </option>
                ))}
              </NativeSelect>

              <NativeSelect
                label="Modalità di generazione"
                value={selectedMode}
                onChange={(e) => setSelectedMode(e.target.value)}
                helperText="Standard: documento completo | Breve: executive summary | Audit: con mapping ISO 27001"
              >
                <option value="standard">📄 Standard - Documento completo professionale</option>
                <option value="breve">⚡ Breve - Executive summary sintetico</option>
                <option value="audit">🔍 Audit - Completo + checklist ISO 27001 / GDPR mapping</option>
              </NativeSelect>

              <div className="flex gap-3 pt-4">
                <Button
                  onClick={generateDocument}
                  disabled={generating || !selectedType || !selectedAssessment}
                  className="flex-1"
                >
                  {generating ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Generazione in corso...
                    </>
                  ) : (
                    <>
                      <FileText className="mr-2 h-4 w-4" />
                      Genera Documento
                    </>
                  )}
                </Button>
                <Button
                  variant="outline"
                  onClick={() => setShowGenerateDialog(false)}
                  disabled={generating}
                >
                  Annulla
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        {/* Preview Dialog */}
        <DocumentPreviewDialog
          open={!!previewDoc}
          onOpenChange={(open) => !open && setPreviewDoc(null)}
          document={previewDoc}
        />
      </div>
    </div>
  );
}
