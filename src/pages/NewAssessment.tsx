import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft, Upload, Loader2, Info } from "lucide-react";
import * as pdfjsLib from "pdfjs-dist";
import mammoth from "mammoth";
import * as XLSX from "xlsx";

// Configure pdf.js worker - force local worker to avoid CDN/network failures
pdfjsLib.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.mjs';

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
  const [uploadedFiles, setUploadedFiles] = useState<Array<{ name: string, content: string, type: string }>>([]);

  const MAX_FILES = 30;
  const MAX_CHARS_PER_FILE = 15000;
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

    const currentChars = uploadedFiles.reduce((acc, file) => acc + file.content.length, 0);
    let nextTotalChars = currentChars;
    const newFiles: Array<{ name: string, content: string, type: string }> = [];
    const skippedFiles: string[] = [];

    for (const file of filesToProcess) {
      try {
        let extractedText = '';
        const nameLower = file.name.toLowerCase();

        if (nameLower.endsWith('.pdf')) {
          try {
            extractedText = await extractPdfText(file);
          } catch (pdfError) {
            console.warn('Estrazione PDF standard fallita, provo fallback:', file.name, pdfError);
            extractedText = await extractBinaryTextFallback(file);
          }
        } else if (nameLower.endsWith('.docx') || nameLower.endsWith('.doc')) {
          try {
            extractedText = await extractDocxText(file);
          } catch {
            extractedText = await extractBinaryTextFallback(file);
          }
        } else if (nameLower.endsWith('.xlsx') || nameLower.endsWith('.xls') || nameLower.endsWith('.csv')) {
          try {
            extractedText = await extractSpreadsheetText(file);
          } catch (xlsErr) {
            console.warn('Estrazione foglio di calcolo fallita:', file.name, xlsErr);
            extractedText = await extractBinaryTextFallback(file);
          }
        } else {
          // Plain text files (.txt, .md, .json, .xml, .html, .rtf, etc.)
          extractedText = await file.text();
        }

        const normalizedContent = extractedText
          .replace(/\u0000/g, '')
          .replace(/\s+/g, ' ')
          .trim();

        if (!normalizedContent || normalizedContent.length < 10) {
          skippedFiles.push(`${file.name} (vuoto/illeggibile)`);
          continue;
        }

        const trimmedContent = normalizedContent.slice(0, MAX_CHARS_PER_FILE);

        if (nextTotalChars + trimmedContent.length > MAX_TOTAL_CHARS) {
          skippedFiles.push(`${file.name} (limite totale caratteri)`);
          continue;
        }

        newFiles.push({
          name: file.name,
          content: trimmedContent,
          type: file.type || 'application/octet-stream'
        });

        nextTotalChars += trimmedContent.length;
      } catch (err) {
        console.error('Errore lettura file:', file.name, err);
        const reason = err instanceof Error ? err.message : 'errore sconosciuto';
        skippedFiles.push(`${file.name} (errore estrazione: ${reason})`);
      }
    }
    
    setUploadedFiles(prev => [...prev, ...newFiles]);

    if (newFiles.length > 0) {
      const desc = skippedFiles.length > 0
        ? `${newFiles.length} documento/i aggiunto/i. ${skippedFiles.length} non leggibili: ${skippedFiles.join(', ')}`
        : `${newFiles.length} documento/i aggiunto/i`;
      toast({
        title: "File caricati",
        description: desc,
      });
    } else {
      toast({
        title: "Nessun file valido aggiunto",
        description: skippedFiles.length > 0
          ? `File non leggibili: ${skippedFiles.join(', ')}`
          : "Riduci numero/dimensione dei file o riprova con documenti più leggeri",
        variant: "destructive",
      });
    }
  };

  // Extract text from PDF using pdfjs-dist (tolerant mode)
  async function extractPdfText(file: File): Promise<string> {
    const arrayBuffer = await file.arrayBuffer();
    const loadingTask = pdfjsLib.getDocument({
      data: arrayBuffer,
      stopAtErrors: false,
      isEvalSupported: false,
    });

    const pdf = await loadingTask.promise;
    const pages: string[] = [];
    const maxPages = Math.min(pdf.numPages, 80);

    for (let i = 1; i <= maxPages; i++) {
      try {
        const page = await pdf.getPage(i);
        const textContent = await page.getTextContent();
        const pageText = textContent.items
          .map((item: any) => item.str)
          .join(' ')
          .trim();

        if (pageText.length > 0) {
          pages.push(pageText);
        }
      } catch (pageError) {
        console.warn(`Pagina PDF ${i} non leggibile:`, pageError);
      }
    }

    const joined = pages.join('\n').trim();
    if (!joined) {
      throw new Error('Nessun testo estraibile dal PDF con parser standard');
    }

    return joined;
  }

  // Generic fallback for binary formats (.pdf/.doc legacy) when standard parsers fail
  async function extractBinaryTextFallback(file: File): Promise<string> {
    const buffer = await file.arrayBuffer();

    const decoders = [
      new TextDecoder('utf-8', { fatal: false }),
      new TextDecoder('windows-1252', { fatal: false }),
      new TextDecoder('iso-8859-1', { fatal: false }),
    ];

    let bestCandidate = '';

    for (const decoder of decoders) {
      const raw = decoder.decode(buffer);
      const candidate = raw
        .replace(/\u0000/g, ' ')
        .match(/[A-Za-zÀ-ÿ0-9][A-Za-zÀ-ÿ0-9\s.,;:()\-_/]{20,}/g)?.join(' ') || '';

      if (candidate.length > bestCandidate.length) {
        bestCandidate = candidate;
      }
    }

    return bestCandidate;
  }

  // Extract text from DOCX using mammoth
  async function extractDocxText(file: File): Promise<string> {
    const arrayBuffer = await file.arrayBuffer();
    const result = await mammoth.extractRawText({ arrayBuffer });
    return result.value;
  }

  // Extract text from Excel/CSV: concatenate all sheets as CSV-like text
  async function extractSpreadsheetText(file: File): Promise<string> {
    const arrayBuffer = await file.arrayBuffer();
    const workbook = XLSX.read(arrayBuffer, { type: 'array' });
    const parts: string[] = [];
    for (const sheetName of workbook.SheetNames) {
      const sheet = workbook.Sheets[sheetName];
      const csv = XLSX.utils.sheet_to_csv(sheet, { blankrows: false });
      if (csv && csv.trim().length > 0) {
        parts.push(`--- ${sheetName} ---\n${csv}`);
      }
    }
    return parts.join('\n\n');
  }

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

      // Fire-and-forget: invoke edge function, then poll DB for results
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
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
                    <strong>Output:</strong> Lista di gap, azioni correttive prioritizzate, punteggio di rischio, stima sanzioni potenziali.
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
                <Label htmlFor="revenue">Fatturato annuale (EUR)</Label>
                <p className="text-xs text-muted-foreground mb-2">
                  Il fatturato è necessario per calcolare con precisione le potenziali sanzioni (es. GDPR: fino al 4% del fatturato annuo globale)
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
                    accept=".pdf,.doc,.docx,.txt,.xlsx,.xls,.csv"
                    onChange={handleFileUpload}
                    className="max-w-xs mx-auto"
                  />
                  {uploadedFiles.length > 0 && (
                    <div className="mt-4">
                      <p className="text-sm font-medium mb-2">{uploadedFiles.length} file caricati:</p>
                      <ul className="text-sm text-left max-w-md mx-auto space-y-1">
                        {uploadedFiles.map((file, i) => (
                          <li key={i} className="flex items-center gap-2">
                            <span className="w-2 h-2 bg-primary rounded-full"></span>
                            {file.name}
                          </li>
                        ))}
                      </ul>
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
