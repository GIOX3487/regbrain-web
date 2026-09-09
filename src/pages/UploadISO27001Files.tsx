import { useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Upload, FileText, CheckCircle, AlertCircle, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface UploadedFile {
  file: File;
  status: 'pending' | 'processing' | 'success' | 'error';
  chunks?: number;
  error?: string;
}

export default function UploadISO27001Files() {
  const [files, setFiles] = useState<UploadedFile[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState(0);

  const handleFileSelect = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = event.target.files;
    if (!selectedFiles) return;

    const newFiles: UploadedFile[] = Array.from(selectedFiles).map(file => ({
      file,
      status: 'pending'
    }));

    setFiles(prev => [...prev, ...newFiles]);
  }, []);

  // Helper function to extract readable text from binary files (.doc, .xls)
  const extractTextFromBinary = (arrayBuffer: ArrayBuffer): string => {
    const bytes = new Uint8Array(arrayBuffer);
    const chunks: string[] = [];
    let currentWord = '';
    
    for (let i = 0; i < bytes.length; i++) {
      const byte = bytes[i];
      // Check if printable ASCII character
      if (byte >= 32 && byte <= 126) {
        currentWord += String.fromCharCode(byte);
      } else if (byte === 10 || byte === 13) {
        // Newline
        if (currentWord.length > 2) {
          chunks.push(currentWord);
        }
        currentWord = '';
      } else {
        // Non-printable character
        if (currentWord.length > 3) {
          chunks.push(currentWord);
        }
        currentWord = '';
      }
    }
    
    if (currentWord.length > 3) {
      chunks.push(currentWord);
    }
    
    // Filter out garbage and keep meaningful text
    const meaningfulText = chunks
      .filter(chunk => {
        // Keep chunks with at least some letters
        const letterCount = (chunk.match(/[a-zA-ZàèéìòùÀÈÉÌÒÙ]/g) || []).length;
        return letterCount >= chunk.length * 0.3 && chunk.length >= 3;
      })
      .join(' ')
      .replace(/\s+/g, ' ')
      .trim();
    
    return meaningfulText;
  };

  const extractTextFromFile = async (file: File): Promise<string> => {
    const arrayBuffer = await file.arrayBuffer();
    const fileName = file.name.toLowerCase();

    if (fileName.endsWith('.txt') || fileName.endsWith('.md')) {
      return new TextDecoder('utf-8').decode(arrayBuffer);
    }

    // Handle .doc files (old Word format) using mammoth
    if (fileName.endsWith('.doc') && !fileName.endsWith('.docx')) {
      try {
        const mammoth = await import('mammoth');
        const result = await mammoth.extractRawText({ arrayBuffer });
        if (result.value && result.value.length > 10) {
          return result.value;
        }
        throw new Error('Nessun testo estratto dal file .doc');
      } catch (e: any) {
        // Fallback: try to extract text from binary
        const text = extractTextFromBinary(arrayBuffer);
        if (text.length > 20) {
          return text;
        }
        throw new Error(`Impossibile leggere file .doc: ${e.message}`);
      }
    }

    if (fileName.endsWith('.docx')) {
      // Extract text from DOCX (ZIP containing XML)
      const { default: JSZip } = await import('jszip');
      const zip = await JSZip.loadAsync(arrayBuffer);
      const documentXml = await zip.file('word/document.xml')?.async('string');
      
      if (!documentXml) throw new Error('Invalid DOCX file');
      
      // Extract text from XML
      const text = documentXml
        .replace(/<w:p[^>]*>/g, '\n')
        .replace(/<w:tab[^>]*>/g, '\t')
        .replace(/<[^>]+>/g, '')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&amp;/g, '&')
        .replace(/&quot;/g, '"')
        .replace(/\n{3,}/g, '\n\n')
        .trim();
      
      return text;
    }

    // Handle .xls files (old Excel format)
    if (fileName.endsWith('.xls') && !fileName.endsWith('.xlsx')) {
      // Extract text from binary XLS
      const text = extractTextFromBinary(arrayBuffer);
      if (text.length > 20) {
        return text;
      }
      throw new Error('File .xls: nessun testo leggibile trovato. Prova a convertire in .xlsx');
    }

    if (fileName.endsWith('.xlsx')) {
      // Extract text from XLSX
      const { default: JSZip } = await import('jszip');
      
      const zip = await JSZip.loadAsync(arrayBuffer);
      
      // Get shared strings
      const sharedStringsXml = await zip.file('xl/sharedStrings.xml')?.async('string') || '';
      const sharedStrings: string[] = [];
      const ssMatches = sharedStringsXml.matchAll(/<t[^>]*>([^<]*)<\/t>/g);
      for (const match of ssMatches) {
        sharedStrings.push(match[1]);
      }
      
      // Get all sheets
      const sheets: string[] = [];
      const sheetFiles = Object.keys(zip.files).filter(f => f.startsWith('xl/worksheets/sheet'));
      
      for (const sheetFile of sheetFiles.sort()) {
        const sheetXml = await zip.file(sheetFile)?.async('string') || '';
        const rows: string[] = [];
        
        // Extract ALL cell values
        const cellRegex = /<c[^>]*(?:t="s")?[^>]*>(?:<f>[^<]*<\/f>)?<v>([^<]*)<\/v><\/c>|<c[^>]*t="inlineStr"[^>]*>.*?<t>([^<]*)<\/t>.*?<\/c>|<c[^>]*t="str"[^>]*>.*?<v>([^<]*)<\/v>.*?<\/c>/gs;
        const cellMatches = sheetXml.matchAll(cellRegex);
        
        for (const match of cellMatches) {
          if (match[2]) {
            rows.push(match[2]);
          } else if (match[3]) {
            rows.push(match[3]);
          } else if (match[1]) {
            const val = match[1];
            if (/^\d+$/.test(val) && sharedStrings[parseInt(val)]) {
              rows.push(sharedStrings[parseInt(val)]);
            } else {
              rows.push(val);
            }
          }
        }
        
        if (rows.length > 0) {
          sheets.push(rows.join(' | '));
        }
      }
      
      if (sheets.join('').length < 50 && sharedStrings.length > 0) {
        return sharedStrings.join(' | ');
      }
      
      return sheets.join('\n\n');
    }

    // For unsupported types, try to read as text anyway
    try {
      const text = new TextDecoder('utf-8').decode(arrayBuffer);
      if (text && text.length > 50) {
        return text;
      }
    } catch (e) {
      // Ignore
    }

    throw new Error(`Formato file non supportato: ${file.name}`);
  };

  const processFiles = async () => {
    setIsProcessing(true);
    setProgress(0);

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      toast.error("Devi essere autenticato");
      setIsProcessing(false);
      return;
    }

    let processed = 0;
    const total = files.length;

    for (let i = 0; i < files.length; i++) {
      const uploadedFile = files[i];
      
      setFiles(prev => prev.map((f, idx) => 
        idx === i ? { ...f, status: 'processing' } : f
      ));

      try {
        // Extract text from file
        const text = await extractTextFromFile(uploadedFile.file);
        
        if (text.length < 20) {
          throw new Error('Testo estratto troppo corto (meno di 20 caratteri)');
        }

        // Convert to base64
        const encoder = new TextEncoder();
        const textBytes = encoder.encode(text);
        const base64 = btoa(String.fromCharCode(...textBytes));

        // Generate title from filename
        const title = uploadedFile.file.name
          .replace(/\.(docx|xlsx|txt|md)$/i, '')
          .replace(/[-_]/g, ' ')
          .trim();

        // Send to process-document edge function
        const { data, error } = await supabase.functions.invoke('process-document', {
          body: {
            file_data: base64,
            file_name: uploadedFile.file.name,
            title: `ISO 27001 - ${title}`,
            version: '1.0',
            jurisdiction: 'EU',
            sector: 'Technology',
            language: 'IT'
          }
        });

        if (error) throw error;

        setFiles(prev => prev.map((f, idx) => 
          idx === i ? { ...f, status: 'success', chunks: data.chunks_created } : f
        ));

        processed++;
        setProgress((processed / total) * 100);
        
        toast.success(`${uploadedFile.file.name}: ${data.chunks_created} chunks creati`);
      } catch (error: any) {
        console.error('Error processing file:', error);
        setFiles(prev => prev.map((f, idx) => 
          idx === i ? { ...f, status: 'error', error: error.message } : f
        ));
        toast.error(`Errore: ${uploadedFile.file.name}`);
      }

      // Small delay between files
      await new Promise(r => setTimeout(r, 500));
    }

    setIsProcessing(false);
    toast.success(`Completato! ${processed}/${total} file processati`);
  };

  const clearFiles = () => {
    setFiles([]);
    setProgress(0);
  };

  const retryFailed = () => {
    setFiles(prev => prev.map(f => 
      f.status === 'error' ? { ...f, status: 'pending', error: undefined } : f
    ));
  };

  const successCount = files.filter(f => f.status === 'success').length;
  const errorCount = files.filter(f => f.status === 'error').length;
  const pendingCount = files.filter(f => f.status === 'pending').length;
  const totalChunks = files.reduce((sum, f) => sum + (f.chunks || 0), 0);

  return (
    <div className="container mx-auto py-8 px-4 max-w-4xl">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Upload className="h-6 w-6" />
            Carica File ISO 27001 Originali
          </CardTitle>
          <CardDescription>
            Carica i file .docx e .xlsx originali per estrarre il contenuto completo e indicizzarlo nel RAG
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* File Input */}
          <div className="border-2 border-dashed border-muted-foreground/25 rounded-lg p-8 text-center">
            <input
              type="file"
              multiple
              accept=".docx,.xlsx,.doc,.xls,.txt,.md,.pdf,*/*"
              onChange={handleFileSelect}
              className="hidden"
              id="file-upload"
              disabled={isProcessing}
            />
            <label 
              htmlFor="file-upload" 
              className="cursor-pointer flex flex-col items-center gap-2"
            >
              <Upload className="h-12 w-12 text-muted-foreground" />
              <span className="text-lg font-medium">Clicca per selezionare file</span>
              <span className="text-sm text-muted-foreground">
                Supportati: .docx, .xlsx, .doc, .xls, .txt, .md (tutti i tipi visibili)
              </span>
            </label>
          </div>

          {/* File List */}
          {files.length > 0 && (
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <h3 className="font-medium">{files.length} file selezionati</h3>
                <Button variant="outline" size="sm" onClick={clearFiles} disabled={isProcessing}>
                  Pulisci lista
                </Button>
              </div>

              <div className="max-h-64 overflow-y-auto space-y-2">
                {files.map((f, idx) => (
                  <div 
                    key={idx} 
                    className="flex items-center gap-3 p-2 rounded bg-muted/50"
                  >
                    <FileText className="h-4 w-4 shrink-0" />
                    <span className="flex-1 text-sm truncate">{f.file.name}</span>
                    {f.status === 'pending' && (
                      <span className="text-xs text-muted-foreground">In attesa</span>
                    )}
                    {f.status === 'processing' && (
                      <Loader2 className="h-4 w-4 animate-spin text-primary" />
                    )}
                    {f.status === 'success' && (
                      <div className="flex items-center gap-1 text-emerald-600 dark:text-emerald-400">
                        <CheckCircle className="h-4 w-4" />
                        <span className="text-xs">{f.chunks} chunks</span>
                      </div>
                    )}
                    {f.status === 'error' && (
                      <div className="flex items-center gap-1 text-destructive" title={f.error}>
                        <AlertCircle className="h-4 w-4" />
                        <span className="text-xs truncate max-w-[150px]">{f.error || 'Errore'}</span>
                      </div>
                    )}
                  </div>
                ))}
              </div>

              {/* Progress */}
              {isProcessing && (
                <div className="space-y-2">
                  <Progress value={progress} />
                  <p className="text-sm text-center text-muted-foreground">
                    Elaborazione in corso...
                  </p>
                </div>
              )}

              {/* Stats */}
              {(successCount > 0 || errorCount > 0) && (
                <div className="flex flex-wrap gap-4 text-sm">
                  <span className="text-emerald-600 dark:text-emerald-400">✓ {successCount} completati</span>
                  {errorCount > 0 && (
                    <span className="text-destructive">✗ {errorCount} errori</span>
                  )}
                  <span className="text-muted-foreground">
                    Totale chunks: {totalChunks}
                  </span>
                </div>
              )}

              {/* Buttons */}
              <div className="flex gap-2">
                <Button 
                  onClick={processFiles} 
                  disabled={isProcessing || pendingCount === 0}
                  className="flex-1"
                >
                  {isProcessing ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Elaborazione...
                    </>
                  ) : (
                    <>
                      <Upload className="mr-2 h-4 w-4" />
                      Processa {pendingCount} file
                    </>
                  )}
                </Button>
                
                {errorCount > 0 && !isProcessing && (
                  <Button 
                    variant="outline"
                    onClick={retryFailed}
                  >
                    Riprova {errorCount} falliti
                  </Button>
                )}
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
