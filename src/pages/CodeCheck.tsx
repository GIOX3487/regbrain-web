import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { MobileNav } from "@/components/MobileNav";
import { RISK_STYLE } from "@/components/compliance/RiskScoreExplanation";
import {
  ArrowLeft, Code2, Download, FileCode, Loader2, MessageSquare, RefreshCw, ShieldCheck, Trash2, Upload, X,
} from "lucide-react";
import {
  CATEGORY_TEXT, type CodeCheckResult, type CodeFinding, exportCodeCheckPdf, RISK_TEXT, STATUS_TEXT,
} from "@/lib/code-check-report";

const MAX_FILES = 40;
const MAX_FILE_CHARS = 150_000;
const MAX_TOTAL_CHARS = 400_000;
const CODE_EXTENSIONS = [
  ".js", ".jsx", ".ts", ".tsx", ".mjs", ".cjs", ".py", ".java", ".kt", ".kts", ".swift", ".go", ".rb", ".php", ".cs",
  ".c", ".cc", ".cpp", ".h", ".hpp", ".rs", ".scala", ".dart", ".html", ".htm", ".vue", ".svelte", ".astro", ".css", ".scss",
  ".sql", ".sh", ".bash", ".ps1", ".yml", ".yaml", ".json", ".xml", ".gradle", ".properties", ".toml", ".ini", ".cfg", ".conf",
  ".tf", ".txt", ".md", ".erb", ".ejs", ".hbs", ".twig", ".cshtml", ".plist",
];
const CODE_NAMES = ["Dockerfile", "Makefile", "Procfile", "Gemfile", ".htaccess", "nginx.conf"];

type SourceFile = { name: string; content: string };
type Context = { appType: string; personalData: string; sector: string; usesAI: string; audience: string; notes: string };
const EMPTY_CONTEXT: Context = { appType: "", personalData: "", sector: "", usesAI: "", audience: "", notes: "" };

interface HistoryRow { id: string; title: string; overall_risk: string; counts: CodeCheckResult["counts"]; created_at: string }

const isCodeFile = (name: string) => CODE_NAMES.includes(name) || CODE_EXTENSIONS.some((ext) => name.toLowerCase().endsWith(ext));

function riskKey(risk: string): "high" | "medium" | "low" | "none" {
  return risk === "high" || risk === "medium" || risk === "low" ? risk : "none";
}

export default function CodeCheck() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [authChecked, setAuthChecked] = useState(false);
  const [signedIn, setSignedIn] = useState(false);
  const [title, setTitle] = useState("");
  const [pasted, setPasted] = useState("");
  const [pastedName, setPastedName] = useState("");
  const [files, setFiles] = useState<SourceFile[]>([]);
  const [skipped, setSkipped] = useState<string[]>([]);
  const [dragging, setDragging] = useState(false);
  const [context, setContext] = useState<Context>(EMPTY_CONTEXT);
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<CodeCheckResult | null>(null);
  const [answers, setAnswers] = useState<Record<number, string>>({});
  const [history, setHistory] = useState<HistoryRow[]>([]);
  const [lastInput, setLastInput] = useState<SourceFile[] | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const resultRef = useRef<HTMLDivElement>(null);

  const loadHistory = useCallback(async () => {
    const { data } = await supabase
      .from("code_checks")
      .select("id, title, overall_risk, counts, created_at")
      .order("created_at", { ascending: false })
      .limit(20);
    setHistory((data || []) as unknown as HistoryRow[]);
  }, []);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSignedIn(!!session);
      setAuthChecked(true);
      if (session) loadHistory();
    });
  }, [loadHistory]);

  const addFiles = async (list: FileList | File[]) => {
    const incoming = Array.from(list);
    const next = [...files];
    const rejected: string[] = [];
    for (const file of incoming) {
      const name = (file as File & { webkitRelativePath?: string }).webkitRelativePath || file.name;
      if (!isCodeFile(file.name)) { rejected.push(`${name}: formato non supportato`); continue; }
      if (next.length >= MAX_FILES) { rejected.push(`${name}: superato il limite di ${MAX_FILES} file`); continue; }
      if (file.size > MAX_FILE_CHARS * 2) { rejected.push(`${name}: file troppo grande`); continue; }
      const text = await file.text();
      if (text.includes("\u0000")) { rejected.push(`${name}: non è un file di testo`); continue; }
      if (text.length > MAX_FILE_CHARS) { rejected.push(`${name}: supera ${MAX_FILE_CHARS.toLocaleString("it-IT")} caratteri`); continue; }
      const existing = next.findIndex((f) => f.name === name);
      if (existing >= 0) next[existing] = { name, content: text }; else next.push({ name, content: text });
    }
    setFiles(next);
    setSkipped(rejected);
  };

  const collectInput = (): SourceFile[] => {
    const all = [...files];
    if (pasted.trim()) all.unshift({ name: pastedName.trim() || "codice-incollato.txt", content: pasted });
    return all;
  };

  const run = async (input: SourceFile[], withAnswers?: Array<{ q: string; a: string }>) => {
    const total = input.reduce((n, f) => n + f.content.length, 0);
    if (input.length === 0) { toast({ title: "Nessun codice", description: "Incolla del codice o carica almeno un file.", variant: "destructive" }); return; }
    if (total > MAX_TOTAL_CHARS) { toast({ title: "Troppo codice in una volta", description: `Il limite è ${MAX_TOTAL_CHARS.toLocaleString("it-IT")} caratteri: dividi la verifica in più parti.`, variant: "destructive" }); return; }
    setRunning(true);
    try {
      const { data, error } = await supabase.functions.invoke("code-compliance", {
        body: { title: title.trim() || undefined, files: input, context: { ...context, answers: withAnswers } },
      });
      if (error) {
        const details = error.context instanceof Response ? await error.context.clone().json().catch(() => null) : null;
        throw new Error(details?.error || error.message);
      }
      setResult(data as CodeCheckResult);
      setLastInput(input);
      setAnswers({});
      loadHistory();
      setTimeout(() => resultRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 100);
    } catch (e) {
      toast({ title: "Verifica non riuscita", description: e instanceof Error ? e.message : "Riprova tra poco.", variant: "destructive" });
    } finally {
      setRunning(false);
    }
  };

  const openHistory = async (id: string) => {
    const { data, error } = await supabase.from("code_checks").select("*").eq("id", id).maybeSingle();
    if (error || !data) { toast({ title: "Verifica non trovata", variant: "destructive" }); return; }
    setResult(data as unknown as CodeCheckResult);
    setLastInput(null);
    setAnswers({});
    setTimeout(() => resultRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 100);
  };

  const deleteHistory = async (id: string) => {
    const { error } = await supabase.from("code_checks").delete().eq("id", id);
    if (error) { toast({ title: "Eliminazione non riuscita", variant: "destructive" }); return; }
    setHistory((h) => h.filter((r) => r.id !== id));
    if (result?.id === id) setResult(null);
  };

  const rerunWithAnswers = () => {
    if (!result || !lastInput) return;
    const list = result.summary.questions
      .map((q, i) => ({ q, a: (answers[i] || "").trim() }))
      .filter((x) => x.a);
    if (list.length === 0) { toast({ title: "Nessuna risposta", description: "Rispondi ad almeno una domanda." }); return; }
    run(lastInput, list);
  };

  const askChat = (f: CodeFinding) => {
    const q = `Nel mio codice la verifica ha trovato: "${f.title}" (${f.occurrences[0] ? `${f.occurrences[0].file}, riga ${f.occurrences[0].line}` : "vari punti"}). Quali obblighi normativi sono coinvolti e come posso correggere?`;
    navigate(`/chat?q=${encodeURIComponent(q)}`);
  };

  if (authChecked && !signedIn) {
    return (
      <div className="min-h-screen bg-background">
        <MobileNav />
        <div className="container mx-auto py-16 px-4 text-center max-w-xl">
          <Code2 className="h-16 w-16 mx-auto text-primary mb-4" />
          <h1 className="text-3xl font-bold mb-3">Verifica del codice</h1>
          <p className="text-muted-foreground mb-6">Accedi per verificare il codice del tuo software rispetto a privacy, sicurezza, cookie, IA, accessibilità e licenze.</p>
          <Button onClick={() => navigate("/auth")}>Accedi</Button>
        </div>
      </div>
    );
  }

  const input = collectInput();
  const totalChars = input.reduce((n, f) => n + f.content.length, 0);
  const setCtx = (k: keyof Context) => (v: string) => setContext((c) => ({ ...c, [k]: v }));

  return (
    <div className="min-h-screen bg-background pb-20 lg:pb-0">
      <MobileNav />
      <div className="container mx-auto py-4 sm:py-8 px-4 max-w-5xl">
        <Button variant="ghost" size="sm" className="mb-3" onClick={() => navigate("/compliance")}>
          <ArrowLeft className="mr-2 h-4 w-4" />Compliance hub
        </Button>
        <h1 className="text-2xl sm:text-3xl font-bold mb-2 flex items-center gap-2"><Code2 className="h-7 w-7 text-primary" />Verifica del codice</h1>
        <p className="text-sm sm:text-base text-muted-foreground mb-6">
          Incolla il codice o carica i file: RegBrain lo controlla con regole fisse (stesso codice, stesso esito), recupera dal RAG
          il testo delle norme collegate e ti restituisce i problemi con rischio alto, medio o basso, dove si trovano e come correggerli.
        </p>

        <Card className="mb-6 border-primary/30 bg-primary/5">
          <CardContent className="pt-6 text-sm space-y-2">
            <p><strong>Cosa controlla:</strong> credenziali nel codice, crittografia debole, connessioni non cifrate, SQL injection, cookie e strumenti di tracciamento senza consenso, dati personali nei log, geolocalizzazione, dati sanitari o biometrici, uso di servizi di IA, accessibilità, licenze copyleft.</p>
            <p><strong>Fonti:</strong> GDPR, Codice privacy, ePrivacy e linee guida cookie del Garante, Cyber Resilience Act, AI Act e L. 132/2025, D.Lgs. 138/2024, WCAG 2.2 ed European Accessibility Act, OWASP ASVS, linee guida AgID sullo sviluppo sicuro, testi delle licenze.</p>
            <p><strong>Cosa resta salvato:</strong> l'esito, i nomi dei file e le poche righe citate come prova, con i segreti mascherati. Il codice non viene conservato. Per la revisione viene inviato al fornitore del modello AI, come i documenti della gap analysis.</p>
          </CardContent>
        </Card>

        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="text-lg">1. Il codice</CardTitle>
            <CardDescription>Fino a {MAX_FILES} file di testo e {MAX_TOTAL_CHARS.toLocaleString("it-IT")} caratteri per verifica. Non caricare file .env reali: se lo fai, i valori vengono mascherati nel report ma la chiave va comunque ruotata.</CardDescription>
          </CardHeader>
          <CardContent>
            <Tabs defaultValue="paste">
              <TabsList className="mb-4">
                <TabsTrigger value="paste">Incolla</TabsTrigger>
                <TabsTrigger value="upload">Carica file{files.length ? ` (${files.length})` : ""}</TabsTrigger>
              </TabsList>
              <TabsContent value="paste" className="space-y-3">
                <Input placeholder="Nome del file (facoltativo, aiuta a riconoscere il linguaggio: es. server.js)" value={pastedName} onChange={(e) => setPastedName(e.target.value)} />
                <Textarea
                  value={pasted}
                  onChange={(e) => setPasted(e.target.value)}
                  placeholder="Incolla qui il codice"
                  className="font-mono text-xs min-h-[260px]"
                  spellCheck={false}
                />
              </TabsContent>
              <TabsContent value="upload" className="space-y-3">
                <div
                  onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
                  onDragLeave={() => setDragging(false)}
                  onDrop={(e) => { e.preventDefault(); setDragging(false); addFiles(e.dataTransfer.files); }}
                  onClick={() => fileInput.current?.click()}
                  className={`border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors ${dragging ? "border-primary bg-primary/5" : "border-muted-foreground/30 hover:border-primary/60"}`}
                >
                  <Upload className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
                  <p className="text-sm font-medium">Trascina qui i file o clicca per sceglierli</p>
                  <p className="text-xs text-muted-foreground mt-1">JavaScript, TypeScript, Python, Java, Kotlin, Swift, Go, PHP, C#, HTML, SQL, configurazioni e altri file di testo</p>
                  <input ref={fileInput} type="file" multiple className="hidden" accept={CODE_EXTENSIONS.join(",")} onChange={(e) => { if (e.target.files) addFiles(e.target.files); e.target.value = ""; }} />
                </div>
                {files.length > 0 && (
                  <ul className="divide-y rounded-md border text-sm">
                    {files.map((f) => (
                      <li key={f.name} className="flex items-center justify-between gap-2 px-3 py-2">
                        <span className="flex items-center gap-2 min-w-0"><FileCode className="h-4 w-4 shrink-0 text-muted-foreground" /><span className="truncate">{f.name}</span></span>
                        <span className="flex items-center gap-2 shrink-0 text-xs text-muted-foreground">
                          {f.content.split(/\r?\n/).length} righe
                          <button type="button" aria-label={`Rimuovi ${f.name}`} onClick={() => setFiles((l) => l.filter((x) => x.name !== f.name))} className="p-1 rounded hover:bg-muted"><X className="h-3.5 w-3.5" /></button>
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
                {skipped.length > 0 && <p className="text-xs text-destructive">Non caricati: {skipped.join("; ")}</p>}
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>

        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="text-lg">2. Il contesto</CardTitle>
            <CardDescription>Facoltativo, ma cambia il peso dei problemi e le norme applicabili.</CardDescription>
          </CardHeader>
          <CardContent className="grid sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>Tipo di software</Label>
              <Select value={context.appType} onValueChange={setCtx("appType")}>
                <SelectTrigger><SelectValue placeholder="Scegli" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="web">Applicazione web</SelectItem>
                  <SelectItem value="mobile">App mobile</SelectItem>
                  <SelectItem value="backend">Backend o API</SelectItem>
                  <SelectItem value="desktop">Software desktop</SelectItem>
                  <SelectItem value="libreria">Libreria o componente</SelectItem>
                  <SelectItem value="altro">Altro</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Tratta dati personali?</Label>
              <Select value={context.personalData} onValueChange={setCtx("personalData")}>
                <SelectTrigger><SelectValue placeholder="Scegli" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="si">Sì</SelectItem>
                  <SelectItem value="no">No</SelectItem>
                  <SelectItem value="non_so">Non so</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Settore o regime</Label>
              <Select value={context.sector} onValueChange={setCtx("sector")}>
                <SelectTrigger><SelectValue placeholder="Scegli" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="generico">Nessuno in particolare</SelectItem>
                  <SelectItem value="pa">Pubblica amministrazione</SelectItem>
                  <SelectItem value="sanita">Sanità</SelectItem>
                  <SelectItem value="finanza">Finanza e pagamenti</SelectItem>
                  <SelectItem value="nis2">Soggetto NIS2 (essenziale o importante)</SelectItem>
                  <SelectItem value="cra">Prodotto venduto nell'UE (Cyber Resilience Act)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Usa servizi di intelligenza artificiale?</Label>
              <Select value={context.usesAI} onValueChange={setCtx("usesAI")}>
                <SelectTrigger><SelectValue placeholder="Scegli" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="si">Sì</SelectItem>
                  <SelectItem value="no">No</SelectItem>
                  <SelectItem value="non_so">Non so</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Chi lo usa</Label>
              <Select value={context.audience} onValueChange={setCtx("audience")}>
                <SelectTrigger><SelectValue placeholder="Scegli" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="consumatori">Consumatori</SelectItem>
                  <SelectItem value="dipendenti">Dipendenti dell'organizzazione</SelectItem>
                  <SelectItem value="business">Clienti business</SelectItem>
                  <SelectItem value="minori">Anche minori</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="cc-title">Nome della verifica</Label>
              <Input id="cc-title" placeholder="Es. Backend app prenotazioni" value={title} onChange={(e) => setTitle(e.target.value)} />
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="cc-notes">Note (facoltative)</Label>
              <Textarea id="cc-notes" rows={2} placeholder="Es. i dati sono ospitati su AWS Francoforte; il login usa Google" value={context.notes} onChange={(e) => setContext((c) => ({ ...c, notes: e.target.value.slice(0, 1000) }))} />
            </div>
          </CardContent>
        </Card>

        <div className="flex flex-col sm:flex-row sm:items-center gap-3 mb-10">
          <Button size="lg" disabled={running || input.length === 0} onClick={() => run(input)} className="min-h-[44px]">
            {running ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Verifica in corso, può richiedere un minuto</> : <><ShieldCheck className="mr-2 h-4 w-4" />Verifica il codice</>}
          </Button>
          <span className="text-xs text-muted-foreground">{input.length} {input.length === 1 ? "file" : "file"}, {totalChars.toLocaleString("it-IT")} caratteri</span>
        </div>

        {result && (
          <div ref={resultRef} className="scroll-mt-4 space-y-4 mb-10">
            <Card className={`border ${RISK_STYLE[riskKey(result.overall_risk)].panel}`}>
              <CardHeader>
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <CardTitle className="text-xl">{result.title}</CardTitle>
                    <CardDescription>{new Date(result.created_at).toLocaleString("it-IT")} · {result.files.length} file · regole {result.rules_version}</CardDescription>
                  </div>
                  <Button variant="outline" size="sm" onClick={() => exportCodeCheckPdf(result)}><Download className="mr-2 h-4 w-4" />Scarica il report PDF</Button>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className={`text-2xl font-bold flex items-center gap-2 ${RISK_STYLE[riskKey(result.overall_risk)].text}`}>
                  <span className={`h-3.5 w-3.5 rounded-full ${RISK_STYLE[riskKey(result.overall_risk)].dot}`} />
                  Rischio {RISK_TEXT[result.overall_risk].toLowerCase()}
                </div>
                <p className="text-sm text-muted-foreground">{result.counts.high} alti, {result.counts.medium} medi, {result.counts.low} bassi{result.counts.possibleFalsePositives ? `, ${result.counts.possibleFalsePositives} possibili falsi positivi` : ""}</p>
                <p className="text-sm leading-relaxed whitespace-pre-line">{result.summary.text}</p>
                {!result.summary.aiUsed && <p className="text-xs text-muted-foreground">La revisione AI non era disponibile: gli esiti sono solo quelli delle regole.</p>}
              </CardContent>
            </Card>

            {result.findings.map((f) => {
              const style = RISK_STYLE[riskKey(f.risk)];
              const sources = f.refs.map((r) => result.summary.sources.find((s) => s.id === r)).filter(Boolean);
              return (
                <Card key={f.id} className={f.status === "possibile_falso_positivo" ? "opacity-75" : ""}>
                  <CardHeader className="pb-3">
                    <div className="flex flex-wrap items-center gap-2 mb-1">
                      <Badge variant="outline" className={style.badge}>Rischio {RISK_TEXT[f.risk].toLowerCase()}</Badge>
                      <Badge variant="secondary">{CATEGORY_TEXT[f.category] || f.category}</Badge>
                      <Badge variant="outline">{STATUS_TEXT[f.status]}</Badge>
                      {f.ruleId && <span className="text-xs text-muted-foreground">Regola {f.ruleId}</span>}
                    </div>
                    <CardTitle className="text-base">{f.title}</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3 text-sm">
                    <p><span className="font-medium">Perché conta: </span>{f.why}</p>
                    {f.aiNote && <p><span className="font-medium">Nel tuo codice: </span>{f.aiNote}</p>}
                    <p className="rounded-md bg-muted/50 p-3"><span className="font-medium">Azione suggerita: </span>{f.action}</p>
                    <div>
                      <p className="text-xs font-medium text-muted-foreground mb-1">
                        Dove: {f.totalOccurrences} {f.totalOccurrences === 1 ? "occorrenza" : "occorrenze"}{f.totalOccurrences > f.occurrences.length ? `, ne mostro ${f.occurrences.length}` : ""}
                      </p>
                      <div className="space-y-1.5">
                        {f.occurrences.map((o, i) => (
                          <div key={i} className="rounded border bg-background">
                            <div className="px-2 py-1 text-[11px] text-muted-foreground border-b">{o.file}:{o.line}{o.note ? ` · ${o.note}` : ""}</div>
                            <pre className="px-2 py-1.5 text-xs overflow-x-auto whitespace-pre-wrap break-all font-mono">{o.snippet}</pre>
                          </div>
                        ))}
                      </div>
                    </div>
                    {sources.length > 0 && (
                      <details className="text-xs">
                        <summary className="cursor-pointer text-muted-foreground">Fonti: {sources.map((s) => s!.citation).join("; ")}</summary>
                        <div className="mt-2 space-y-2">
                          {sources.map((s) => (
                            <div key={s!.id} className="rounded border p-2">
                              <p className="font-medium mb-1">{s!.citation}</p>
                              <p className="whitespace-pre-line text-muted-foreground max-h-60 overflow-y-auto">{s!.text}</p>
                            </div>
                          ))}
                        </div>
                      </details>
                    )}
                    <Button variant="ghost" size="sm" className="h-8 px-2 text-xs" onClick={() => askChat(f)}>
                      <MessageSquare className="mr-1.5 h-3.5 w-3.5" />Approfondisci in chat
                    </Button>
                  </CardContent>
                </Card>
              );
            })}

            {result.findings.length === 0 && (
              <Card><CardContent className="pt-6 text-sm">Nessun problema rilevato. Le regole coprono i casi più comuni: non è una certificazione di conformità.</CardContent></Card>
            )}

            {result.summary.questions.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Domande per completare la verifica</CardTitle>
                  <CardDescription>Rispondi e rilancia: la revisione terrà conto delle risposte{lastInput ? "" : ". Per rilanciare una verifica dallo storico ricarica prima il codice"}.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  {result.summary.questions.map((q, i) => (
                    <div key={i} className="space-y-1.5">
                      <Label className="text-sm font-normal leading-snug">{i + 1}. {q}</Label>
                      <Textarea rows={2} value={answers[i] || ""} onChange={(e) => setAnswers((a) => ({ ...a, [i]: e.target.value.slice(0, 600) }))} />
                    </div>
                  ))}
                  <Button onClick={rerunWithAnswers} disabled={running || !lastInput}>
                    {running ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}Aggiorna la verifica con le risposte
                  </Button>
                </CardContent>
              </Card>
            )}
          </div>
        )}

        {history.length > 0 && (
          <Card>
            <CardHeader><CardTitle className="text-lg">Verifiche precedenti</CardTitle></CardHeader>
            <CardContent>
              <ul className="divide-y text-sm">
                {history.map((h) => (
                  <li key={h.id} className="flex items-center justify-between gap-2 py-2">
                    <button type="button" className="flex items-center gap-2 min-w-0 text-left hover:underline" onClick={() => openHistory(h.id)}>
                      <span className={`h-2.5 w-2.5 rounded-full shrink-0 ${RISK_STYLE[riskKey(h.overall_risk)].dot}`} />
                      <span className="truncate">{h.title}</span>
                    </button>
                    <span className="flex items-center gap-2 shrink-0 text-xs text-muted-foreground">
                      {new Date(h.created_at).toLocaleDateString("it-IT")}
                      <button type="button" aria-label="Elimina verifica" className="p-1 rounded hover:bg-muted" onClick={() => deleteHistory(h.id)}><Trash2 className="h-3.5 w-3.5" /></button>
                    </span>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
