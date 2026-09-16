import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase, supabaseHttpUrl } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft, Upload, Loader2, Info } from "lucide-react";
import { extractDocumentText, DocumentExtractionError } from "@/lib/client-document-extract";

const AVAILABLE_REGULATIONS = [
  { id: 'GDPR', name: 'GDPR', description: 'Regolamento generale sulla protezione dei dati (UE 2016/679)' },
  { id: 'NIS2', name: 'NIS2', description: 'Direttiva sulla sicurezza delle reti e dei sistemi informativi (UE 2022/2555)' },
  { id: 'DORA', name: 'DORA', description: 'Digital Operational Resilience Act (UE 2022/2554)' },
  { id: 'AI Act', name: 'AI Act', description: 'Regolamento sull\'intelligenza artificiale (UE 2024/1689)' },
  { id: 'CRA', name: 'Cyber Resilience Act', description: 'Regolamento sulla cyber-resilienza (UE 2024)' },
  { id: 'Data Act', name: 'Data Act', description: 'Regolamento sui dati (UE 2023/2854)' },
  { id: 'ISO 27001', name: 'ISO 27001', description: 'Standard internazionale per la sicurezza delle informazioni' },
  { id: 'D.Lgs 81/08', name: 'D.Lgs 81/08', description: 'Testo Unico sulla Salute e Sicurezza sul Lavoro (D.Lgs. 9 aprile 2008, n. 81)' },
  { id: 'Legge 124/2024 Albania', name: 'Legge 124/2024 Albania', description: 'Legge sulla protezione dei dati personali della Repubblica d\'Albania (Legge n. 124/2024)' },
];

export default function NewAssessment() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    title: '',
    assessment_type: 'gap_analysis',
    scope_jurisdiction: 'EU',
    scope_sector: 'Technology',
    scope_regulations: [] as string[],
    annual_revenue_eur: null as number | null
  });
  const [language, setLanguage] = useState('it');
  const [uploadedFiles, setUploadedFiles] = useState<Array<{ name: string, content: string, type: string, truncated: boolean }>>([]);
  const [unreadableFiles, setUnreadableFiles] = useState<Array<{ name: string, reason: string }>>([]);
  const [extracting, setExtracting] = useState(false);

  const MAX_FILES = 30;
  const MAX_CHARS_PER_FILE = 40000;
  const MAX_TOTAL_CHARS = 400000;

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;

    const remainingSlots = Math.max(0, MAX_FILES - uploadedFiles.length);
    const filesToProcess = Array.from(files).slice(0, remainingSlots);

    if (filesToProcess.length === 0) {
      toast({
        title: "Limite file raggiunto",
        description: `Puoi analizzare massimo ${MAX_FILES} documenti per valutazione`,
        variant: "destructive",
      });
      return;
    }

    setExtracting(true);
    const currentChars = uploadedFiles.reduce((acc, file) => acc + file.content.length, 0);
    let nextTotalChars = currentChars;
    const newFiles: Array<{ name: string, content: string, type: string, truncated: boolean }> = [];
    const skipped: Array<{ name: string, reason: string }> = [];

    for (const file of filesToProcess) {
      if (uploadedFiles.some((f) => f.name === file.name) || newFiles.some((f) => f.name === file.name)) {
        skipped.push({ name: file.name, reason: 'file già caricato' });
        continue;
      }
      try {
        // Estrazione onesta: se il file non è leggibile viene scartato con una spiegazione,
        // mai inviato come contenuto binario (falserebbe l'analisi).
        const fullText = await extractDocumentText(file, Number.MAX_SAFE_INTEGER);
        const truncated = fullText.length > MAX_CHARS_PER_FILE;
        const trimmedContent = fullText.slice(0, MAX_CHARS_PER_FILE);

        if (nextTotalChars + trimmedContent.length > MAX_TOTAL_CHARS) {
          skipped.push({ name: file.name, reason: 'superato il limite complessivo di testo analizzabile' });
          continue;
        }

        newFiles.push({
          name: file.name,
          content: trimmedContent,
          type: file.type || 'application/octet-stream',
          truncated,
        });
        nextTotalChars += trimmedContent.length;
      } catch (err) {
        const reason = err instanceof DocumentExtractionError
          ? err.message
          : `errore di lettura (${err instanceof Error ? err.message : 'sconosciuto'})`;
        console.warn('Documento scartato:', file.name, reason);
        skipped.push({ name: file.name, reason });
      }
    }

    setExtracting(false);
    setUploadedFiles(prev => [...prev, ...newFiles]);
    setUnreadableFiles(prev => [...prev, ...skipped]);
    e.target.value = '';

    if (newFiles.length > 0) {
      toast({
        title: skipped.length > 0 ? "File caricati, alcuni scartati" : "File caricati",
        description: skipped.length > 0
          ? `${newFiles.length} documento/i pronti per l'analisi, ${skipped.length} non leggibili (vedi elenco sotto).`
          : `${newFiles.length} documento/i pronti per l'analisi`,
      });
    } else {
      toast({
        title: "Nessun documento leggibile",
        description: skipped.map((f) => `${f.name}: ${f.reason}`).join('; '),
        variant: "destructive",
      });
    }
  };

  const removeUploadedFile = (name: string) => {
    setUploadedFiles(prev => prev.filter((f) => f.name !== name));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        navigate('/auth');
        return;
      }

      const { data: assessment, error: assessmentError } = await supabase
        .from('compliance_assessments')
        .insert({
          user_id: session.user.id,
          ...formData
        })
        .select()
        .single();

      if (assessmentError) throw assessmentError;

      const safeDocuments = uploadedFiles.map((file) => ({
        name: file.name,
        type: file.type,
        content: file.content.slice(0, MAX_CHARS_PER_FILE)
      }));
      if (safeDocuments.length === 0) {
        toast({ title: "Nessun documento leggibile", description: "Carica almeno un documento con testo leggibile.", variant: "destructive" });
        setLoading(false);
        return;
      }

      // Fire-and-forget: invoke edge function, then poll DB for results
      const supabaseUrl = supabaseHttpUrl;
      const sessionToken = session.access_token;
      const anonKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

      // Launch the edge function (don't await response - connection may drop on long analyses)
      fetch(`${supabaseUrl}/functions/v1/gap-analysis`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${sessionToken}`,
          'apikey': anonKey,
        },
        body: JSON.stringify({
          assessmentId: assessment.id,
          userDocuments: safeDocuments,
          regulations: formData.scope_regulations,
          language
        }),
      }).catch(() => {
        // Connection may close before response - that's OK, we poll instead
        console.log('Edge function connection closed, polling for results...');
      });

      // Poll the database for results (the edge function saves gaps to DB)
      const maxPollTime = 480000; // 8 minutes max
      const pollInterval = 3000; // check every 3 seconds
      const startTime = Date.now();
      let found = false;

      toast({
        title: "⏳ Analisi in corso",
        description: "L'analisi dei documenti è in corso, attendere...",
      });

      while (Date.now() - startTime < maxPollTime) {
        await new Promise(resolve => setTimeout(resolve, pollInterval));

        // Quick status check first (lightweight query)
        const { data: updatedAssessment } = await supabase
          .from('compliance_assessments')
          .select('overall_compliance_percentage, status')
          .eq('id', assessment.id)
          .single();

        if (updatedAssessment && updatedAssessment.status === 'completed') {
          const { data: gaps } = await supabase
            .from('identified_gaps')
            .select('id')
            .eq('assessment_id', assessment.id);

          found = true;
          toast({
            title: "✅ Analisi completata",
            description: `${gaps?.length || 0} gap identificati - navigazione ai risultati...`,
          });
          setTimeout(() => {
            navigate(`/compliance/assessment/${assessment.id}`);
          }, 500);
          break;
        }
      }

      if (!found) {
        // Don't show error - navigate to assessment page which will show results when ready
        toast({
          title: "⏳ Analisi ancora in corso",
          description: "L'analisi è ancora in elaborazione. Verrai reindirizzato alla pagina dei risultati.",
        });
        setTimeout(() => {
          navigate(`/compliance/assessment/${assessment.id}`);
        }, 1000);
      }

    } catch (error) {
      console.error('Error:', error);
      const message = error instanceof Error ? error.message : 'Impossibile creare la valutazione';
      toast({
        title: "Errore",
        description: message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto py-8 px-4 max-w-3xl">
        <Button 
          variant="ghost" 
          onClick={() => navigate('/compliance')}
          className="mb-6"
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          Torna al Compliance Hub
        </Button>

        <Card>
          <CardHeader>
            <CardTitle>Nuova valutazione compliance (Gap Analysis)</CardTitle>
            <CardDescription>
              Analizza la conformità della tua organizzazione rispetto alle normative applicabili
            </CardDescription>
          </CardHeader>
          <CardContent>
            {/* Explanation Banner */}
            <div className="mb-6 p-4 bg-primary/5 border border-primary/20 rounded-lg">
              <div className="flex items-start gap-3">
                <Info className="h-5 w-5 text-primary mt-0.5 shrink-0" />
                <div className="space-y-2">
                  <h4 className="font-semibold text-sm">Cos'è la Gap Analysis?</h4>
                  <p className="text-sm text-muted-foreground">
                    La <strong>Gap Analysis</strong> è un'analisi <strong>puntuale</strong> che identifica i gap specifici 
                    tra la tua documentazione aziendale e i requisiti normativi. Ti dice <strong>dove sei non conforme oggi</strong> 
                    e quali azioni correttive intraprendere.
                  </p>
                  <div className="text-sm text-muted-foreground">
                    <strong>Come funziona:</strong> ogni requisito della normativa viene confrontato con i tuoi documenti; per ciascuno ottieni l'esito (documentato, parziale, mancante), le evidenze trovate, cosa manca e le azioni per rimediare, con un profilo di rischio a colori.
                  </div>
                  <p className="text-xs text-muted-foreground mt-2">
                    💡 <em>Dopo aver creato almeno 3 assessment, potrai accedere alla <strong>Predictive Analytics</strong> 
                    per vedere come evolverà il tuo rischio nel tempo e pianificare investimenti futuri.</em>
                  </p>
                </div>
              </div>
            </div>
            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="space-y-2">
                <Label htmlFor="title">Titolo Valutazione</Label>
                <Input
                  id="title"
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  placeholder="es. Valutazione GDPR Q1 2025"
                  required
                />
              </div>


              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="jurisdiction">Giurisdizione</Label>
                  <Select
                    value={formData.scope_jurisdiction}
                    onValueChange={(value) => setFormData({ ...formData, scope_jurisdiction: value })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="EU">UE</SelectItem>
                      <SelectItem value="IT">Italia</SelectItem>
                      <SelectItem value="US">USA</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="sector">Settore</Label>
                  <Select
                    value={formData.scope_sector}
                    onValueChange={(value) => setFormData({ ...formData, scope_sector: value })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Technology">Technology</SelectItem>
                      <SelectItem value="Healthcare">Healthcare</SelectItem>
                      <SelectItem value="Finance">Finance</SelectItem>
                      <SelectItem value="Manufacturing">Manufacturing</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="revenue">Fatturato annuale (EUR, facoltativo)</Label>
                <p className="text-xs text-muted-foreground mb-2">
                  Serve solo a inquadrare la dimensione dell'organizzazione nei documenti generati.
                </p>
                <div className="grid grid-cols-2 gap-4">
                  <Input
                    id="revenue"
                    type="number"
                    min="0"
                    step="1000"
                    value={formData.annual_revenue_eur || ''}
                    onChange={(e) => setFormData({ 
                      ...formData, 
                      annual_revenue_eur: e.target.value ? parseFloat(e.target.value) : null 
                    })}
                    placeholder="es. 5000000"
                    className="col-span-2 sm:col-span-1"
                  />
                  <Select
                    value={formData.annual_revenue_eur ? 'custom' : ''}
                    onValueChange={(value) => {
                      if (value !== 'custom') {
                        setFormData({ ...formData, annual_revenue_eur: parseFloat(value) });
                      }
                    }}
                  >
                    <SelectTrigger className="col-span-2 sm:col-span-1">
                      <SelectValue placeholder="Selezione rapida" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="500000">€500K (Micro impresa)</SelectItem>
                      <SelectItem value="2000000">€2M (Piccola impresa)</SelectItem>
                      <SelectItem value="10000000">€10M (Media impresa)</SelectItem>
                      <SelectItem value="50000000">€50M (Grande impresa)</SelectItem>
                      <SelectItem value="250000000">€250M+ (Enterprise)</SelectItem>
                      <SelectItem value="custom">Inserisci manualmente</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                {formData.annual_revenue_eur && (
                  <p className="text-sm text-muted-foreground">
                    Fatturato: <span className="font-medium text-foreground">
                      €{formData.annual_revenue_eur.toLocaleString('it-IT')}
                    </span>
                  </p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="language">Lingua dell'analisi</Label>
                <Select
                  value={language}
                  onValueChange={setLanguage}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="it">🇮🇹 Italiano</SelectItem>
                    <SelectItem value="en">🇬🇧 English</SelectItem>
                    <SelectItem value="es">🇪🇸 Español</SelectItem>
                    <SelectItem value="fr">🇫🇷 Français</SelectItem>
                    <SelectItem value="de">🇩🇪 Deutsch</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <Label>Normative da analizzare *</Label>
                  <div className="group relative">
                    <Info className="h-4 w-4 text-muted-foreground cursor-help" />
                    <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-3 py-2 bg-popover text-popover-foreground text-xs rounded-md shadow-lg opacity-0 group-hover:opacity-100 transition-opacity w-64 pointer-events-none z-50">
                      Seleziona le normative rispetto alle quali vuoi analizzare la conformità dei tuoi documenti aziendali
                    </div>
                  </div>
                </div>
                <p className="text-xs text-muted-foreground">
                  Seleziona una o più normative per un'analisi mirata e accurata
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-4 border rounded-lg bg-muted/30">
                  {AVAILABLE_REGULATIONS.map((reg) => (
                    <div key={reg.id} className="flex items-start space-x-3">
                      <Checkbox
                        id={`reg-${reg.id}`}
                        checked={formData.scope_regulations.includes(reg.id)}
                        onCheckedChange={(checked) => {
                          if (checked) {
                            setFormData({
                              ...formData,
                              scope_regulations: [...formData.scope_regulations, reg.id]
                            });
                          } else {
                            setFormData({
                              ...formData,
                              scope_regulations: formData.scope_regulations.filter(r => r !== reg.id)
                            });
                          }
                        }}
                      />
                      <div className="space-y-0.5">
                        <label
                          htmlFor={`reg-${reg.id}`}
                          className="text-sm font-medium leading-none cursor-pointer"
                        >
                          {reg.name}
                        </label>
                        <p className="text-xs text-muted-foreground">
                          {reg.description}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
                {formData.scope_regulations.length > 0 && (
                  <p className="text-sm text-primary">
                    ✓ {formData.scope_regulations.length} normativa/e selezionata/e: {formData.scope_regulations.join(', ')}
                  </p>
                )}
              </div>

              <div className="space-y-2">
                <Label>Carica Documenti aziendali per Gap Analysis</Label>
                <div className="mb-3 p-4 bg-muted/50 rounded-lg border-l-4 border-primary">
                  <p className="text-sm font-semibold mb-2">📋 Documenti necessari per l'analisi:</p>
                  <div className="space-y-2 text-xs text-muted-foreground">
                    <div>
                      <strong className="text-foreground">Policy e procedure obbligatorie:</strong>
                      <ul className="ml-4 mt-1 space-y-0.5">
                        <li>• Privacy Policy e Cookie Policy</li>
                        <li>• Information Security Policy</li>
                        <li>• Data Breach Response Procedure</li>
                        <li>• Business Continuity Plan</li>
                      </ul>
                    </div>
                    <div>
                      <strong className="text-foreground">Documentazione operativa:</strong>
                      <ul className="ml-4 mt-1 space-y-0.5">
                        <li>• Registro delle attività di trattamento (Art. 30 GDPR)</li>
                        <li>• Elenco fornitori e Data Processing Agreements (DPA)</li>
                        <li>• DPIA (Data Protection Impact Assessment) se applicabile</li>
                        <li>• Documentazione formazione dipendenti</li>
                      </ul>
                    </div>
                    <div>
                      <strong className="text-foreground">Documentazione tecnica (se disponibile):</strong>
                      <ul className="ml-4 mt-1 space-y-0.5">
                        <li>• Diagrammi architettura IT e flussi dati</li>
                        <li>• Report vulnerability assessment o penetration test</li>
                        <li>• Configurazioni firewall e sistemi di sicurezza</li>
                      </ul>
                    </div>
                  </div>
                </div>
                <div className="border-2 border-dashed rounded-lg p-6 text-center">
                  <Upload className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
                  <p className="text-sm text-muted-foreground mb-2">
                    Trascina qui i tuoi documenti o clicca per selezionarli
                  </p>
                  <Input
                    type="file"
                    multiple
                    accept=".pdf,.docx,.txt,.md,.xlsx,.xls,.csv"
                    onChange={handleFileUpload}
                    disabled={extracting}
                    className="max-w-xs mx-auto"
                  />
                  <p className="text-xs text-muted-foreground mt-2">
                    Formati accettati: PDF con testo, Word (.docx), Excel, CSV, testo. Le scansioni senza testo e i file .doc non possono essere letti.
                  </p>
                  {extracting && (
                    <p className="text-sm text-muted-foreground mt-3 flex items-center justify-center gap-2">
                      <Loader2 className="h-4 w-4 animate-spin" /> Lettura dei documenti in corso...
                    </p>
                  )}
                  {uploadedFiles.length > 0 && (
                    <div className="mt-4">
                      <p className="text-sm font-medium mb-2">{uploadedFiles.length} documenti pronti per l'analisi:</p>
                      <ul className="text-sm text-left max-w-md mx-auto space-y-1">
                        {uploadedFiles.map((file) => (
                          <li key={file.name} className="flex items-center gap-2">
                            <span className="w-2 h-2 bg-green-600 rounded-full shrink-0"></span>
                            <span className="flex-1 truncate">{file.name}</span>
                            <span className="text-xs text-muted-foreground shrink-0">
                              {Math.round(file.content.length / 1000)}k car.{file.truncated ? ', tagliato' : ''}
                            </span>
                            <button
                              type="button"
                              className="text-xs text-muted-foreground hover:text-destructive shrink-0"
                              onClick={() => removeUploadedFile(file.name)}
                              aria-label={`Rimuovi ${file.name}`}
                            >
                              rimuovi
                            </button>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                  {unreadableFiles.length > 0 && (
                    <div className="mt-4 text-left max-w-md mx-auto rounded-md border border-amber-300 bg-amber-50 dark:bg-amber-950/30 p-3">
                      <p className="text-sm font-medium mb-1 text-amber-800 dark:text-amber-200">
                        {unreadableFiles.length} file non analizzabili (esclusi dall'analisi):
                      </p>
                      <ul className="text-xs text-amber-900 dark:text-amber-100 space-y-1">
                        {unreadableFiles.map((file, i) => (
                          <li key={`${file.name}-${i}`}>
                            <span className="font-medium">{file.name}</span>: {file.reason}
                          </li>
                        ))}
                      </ul>
                      <button
                        type="button"
                        className="mt-2 text-xs underline text-amber-800 dark:text-amber-200"
                        onClick={() => setUnreadableFiles([])}
                      >
                        Nascondi elenco
                      </button>
                    </div>
                  )}
                </div>
              </div>

              <Button 
                type="submit" 
                className="w-full" 
                size="lg"
                disabled={loading || uploadedFiles.length === 0 || formData.scope_regulations.length === 0}
              >
                {loading ? (
                  <>
                    <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                    Analisi in corso...
                  </>
                ) : (
                  'Avvia analisi compliance'
                )}
              </Button>
              {formData.scope_regulations.length === 0 && (
                <p className="text-sm text-destructive text-center">
                  Seleziona almeno una normativa per procedere
                </p>
              )}
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
