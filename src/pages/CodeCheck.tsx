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
import { cn } from "@/lib/utils";
import {
  ArrowLeft, Check, Code2, Download, FileCode, FolderOpen, Loader2, MessageSquare, RefreshCw, ShieldCheck, Trash2, Upload, X,
} from "lucide-react";
import {
  CATEGORY_TEXT, type CodeCheckResult, type CodeFinding, exportCodeCheckPdf, RISK_TEXT, STATUS_TEXT,
} from "@/lib/code-check-report";
import {
  CODE_EXTENSIONS, collectDropped, collectFiles, collectZip, type CollectResult, type LocalScan, MAX_FILES, runLocalScan,
} from "@/lib/code-check/local-scan";
import type { InputFile } from "../../supabase/functions/code-compliance/scan.ts";

type Context = { appTypes: string[]; personalData: string; sectors: string[]; usesAI: string; audiences: string[]; notes: string };
const EMPTY_CONTEXT: Context = { appTypes: [], personalData: "", sectors: [], usesAI: "", audiences: [], notes: "" };

const APP_TYPE_OPTIONS = [["web", "Applicazione web"], ["mobile", "App mobile"], ["backend", "Backend o API"], ["desktop", "Software desktop"], ["libreria", "Libreria o componente"]] as const;
const SECTOR_OPTIONS = [["pa", "Pubblica amministrazione"], ["sanita", "Sanità"], ["finanza", "Finanza e pagamenti"], ["nis2", "Soggetto NIS2"], ["cra", "Prodotto venduto nell'UE (CRA)"]] as const;
const AUDIENCE_OPTIONS = [["consumatori", "Consumatori"], ["dipendenti", "Dipendenti"], ["business", "Clienti business"], ["minori", "Anche minori"]] as const;

interface HistoryRow { id: string; title: string; overall_risk: string; counts: CodeCheckResult["counts"]; created_at: string }

function riskKey(risk: string): "high" | "medium" | "low" | "none" {
  return risk === "high" || risk === "medium" || risk === "low" ? risk : "none";
}

/** Bottoni a scelta multipla: le voci dedotte dal codice hanno un segno e una prova. */
function Chips({ options, value, onChange, detected }: { options: ReadonlyArray<readonly [string, string]>; value: string[]; onChange: (v: string[]) => void; detected?: Record<string, string> }) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {options.map(([k, label]) => {
        const on = value.includes(k);
        const proof = detected?.[k];
        return (
          <button
            key={k}
            type="button"
            aria-pressed={on}
            title={proof ? `Rilevato nel codice: ${proof}` : undefined}
            onClick={() => onChange(on ? value.filter((v) => v !== k) : [...value, k])}
            className={cn(
              "inline-flex items-center gap-1 rounded-full border px-3 py-1 text-xs transition-colors",
              on ? "border-primary bg-primary/10 text-primary" : "border-muted-foreground/30 text-muted-foreground hover:border-primary/60",
            )}
          >
            {on && <Check className="h-3 w-3" />}
            {label}
            {proof && <span className="ml-0.5 rounded bg-primary/15 px-1 text-[10px] leading-4">{proof.startsWith("probabile") ? "forse" : "dal codice"}</span>}
          </button>
        );
      })}
    </div>
  );
}

export default function CodeCheck() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [authChecked, setAuthChecked] = useState(false);
  const [signedIn, setSignedIn] = useState(false);
  const [title, setTitle] = useState("");
  const [pasted, setPasted] = useState("");
  const [pastedName, setPastedName] = useState("");
  const [mode, setMode] = useState<"folder" | "paste">("folder");
  const [collected, setCollected] = useState<CollectResult | null>(null);
  const [localScan, setLocalScan] = useState<LocalScan | null>(null);
  const [reading, setReading] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);
  const [context, setContext] = useState<Context>(EMPTY_CONTEXT);
  const [touched, setTouched] = useState<Set<keyof Context>>(new Set());
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<CodeCheckResult | null>(null);
  const [answers, setAnswers] = useState<Record<number, string>>({});
  const [history, setHistory] = useState<HistoryRow[]>([]);
  const [lastInput, setLastInput] = useState<{ scan: LocalScan } | { files: InputFile[] } | null>(null);
  const folderInput = useRef<HTMLInputElement>(null);
  const zipInput = useRef<HTMLInputElement>(null);
  const filesInput = useRef<HTMLInputElement>(null);
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

  // Il contesto dedotto dal codice riempie le voci che l'utente non ha ancora toccato.
  const applyInferred = (ls: LocalScan) => {
    setContext((c) => {
      const next = { ...c };
      // Le voci sicure si preselezionano; quelle solo probabili restano suggerimenti da confermare.
      const sure = (l: Array<{ value: string; confidence: string }>) => l.filter((a) => a.confidence === "alta").map((a) => a.value);
      if (!touched.has("appTypes")) next.appTypes = ls.inferred.appTypes.map((a) => a.value);
      if (!touched.has("sectors")) next.sectors = sure(ls.inferred.sectors);
      if (!touched.has("audiences")) next.audiences = sure(ls.inferred.audiences);
      if (!touched.has("personalData")) next.personalData = ls.inferred.personalData.length ? "si" : c.personalData;
      if (!touched.has("usesAI")) next.usesAI = ls.inferred.usesAI.length ? "si" : "no";
      return next;
    });
  };

  const analyzeLocally = async (col: CollectResult) => {
    setCollected(col);
    setLocalScan(null);
    if (col.files.length === 0) {
      toast({ title: "Nessun file di codice", description: "Nella cartella non ci sono file di testo riconosciuti come codice.", variant: "destructive" });
      return;
    }
    setReading("Analisi nel browser in corso");
    try {
      const ls = await runLocalScan(col.files, (step) => setReading(`Analisi nel browser: ${step}`));
      setLocalScan(ls);
      applyInferred(ls);
      if (!title.trim() && col.root) setTitle(col.root.replace(/[-_]?(main|master)$/, ""));
    } finally {
      setReading(null);
    }
  };

  const onFolderPicked = async (list: FileList | File[]) => {
    setReading("Lettura dei file");
    try {
      const col = await collectFiles(list, (n) => setReading(`Lettura dei file: ${n}`));
      await analyzeLocally(col);
    } catch (e) {
      setReading(null);
      toast({ title: "Lettura non riuscita", description: e instanceof Error ? e.message : String(e), variant: "destructive" });
    }
  };

  const onZipPicked = async (file: File) => {
    setReading("Apertura dell'archivio");
    try {
      const col = await collectZip(file, (n) => setReading(`Apertura dell'archivio: ${n} voci`));
      await analyzeLocally(col);
    } catch (e) {
      setReading(null);
      toast({ title: "Archivio non leggibile", description: e instanceof Error ? e.message : String(e), variant: "destructive" });
    }
  };

  const onDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    const items = e.dataTransfer.items;
    const zip = Array.from(e.dataTransfer.files).find((f) => /\.zip$/i.test(f.name));
    if (zip && e.dataTransfer.files.length === 1) return onZipPicked(zip);
    if (items && items.length && items[0].webkitGetAsEntry) {
      setReading("Lettura della cartella");
      const files = await collectDropped(items);
      return onFolderPicked(files);
    }
    return onFolderPicked(e.dataTransfer.files);
  };

  const pastedFiles = (): InputFile[] => (pasted.trim() ? [{ name: pastedName.trim() || "codice-incollato.txt", content: pasted }] : []);

  const invoke = async (payload: Record<string, unknown>) => {
    const { data, error } = await supabase.functions.invoke("code-compliance", { body: payload });
    if (error) {
      const details = error.context instanceof Response ? await error.context.clone().json().catch(() => null) : null;
      throw new Error(details?.error || error.message);
    }
    return data as CodeCheckResult;
  };

  const run = async (input: { scan: LocalScan } | { files: InputFile[] }, withAnswers?: Array<{ q: string; a: string }>) => {
    setRunning(true);
    try {
      const ctx = { ...context, answers: withAnswers };
      const body = "scan" in input
        ? { title: title.trim() || undefined, context: ctx, scan: { rulesVersion: input.scan.rulesVersion, findings: input.scan.findings, inferred: input.scan.inferred, excerpts: input.scan.excerpts, inventory: input.scan.inventory } }
        : { title: title.trim() || undefined, context: ctx, files: input.files };
      const data = await invoke(body);
      setResult(data);
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

  const startVerification = () => {
    if (mode === "folder") {
      if (!localScan) { toast({ title: "Nessun codice", description: "Scegli una cartella, un archivio zip o dei file.", variant: "destructive" }); return; }
      return run({ scan: localScan });
    }
    const files = pastedFiles();
    if (files.length === 0) { toast({ title: "Nessun codice", description: "Incolla del codice.", variant: "destructive" }); return; }
    return run({ files });
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

  const setCtx = <K extends keyof Context>(k: K) => (v: Context[K]) => {
    setTouched((t) => new Set(t).add(k));
    setContext((c) => ({ ...c, [k]: v }));
  };
  const detectedMap = (list: Array<{ value: string; evidence: Array<{ file: string; line: number }>; confidence: string }> | undefined) =>
    Object.fromEntries((list || []).map((d) => [d.value, `${d.confidence === "alta" ? "" : "probabile, da confermare: "}${d.evidence.map((e) => `${e.file}:${e.line}`).slice(0, 2).join(", ")}`]));
  const inf = localScan?.inferred;
  const ready = mode === "folder" ? !!localScan : pasted.trim().length > 0;
  const localCounts = localScan ? { high: localScan.findings.filter((f) => f.risk === "high").length, medium: localScan.findings.filter((f) => f.risk === "medium").length, low: localScan.findings.filter((f) => f.risk === "low").length } : null;

  return (
    <div className="min-h-screen bg-background pb-20 lg:pb-0">
      <MobileNav />
      <div className="container mx-auto py-4 sm:py-8 px-4 max-w-5xl">
        <Button variant="ghost" size="sm" className="mb-3" onClick={() => navigate("/compliance")}>
          <ArrowLeft className="mr-2 h-4 w-4" />Compliance hub
        </Button>
        <h1 className="text-2xl sm:text-3xl font-bold mb-2 flex items-center gap-2"><Code2 className="h-7 w-7 text-primary" />Verifica del codice</h1>
        <p className="text-sm sm:text-base text-muted-foreground mb-6">
          Analisi di conformità normativa dell'intera base di codice di un'applicazione. La verifica viene eseguita direttamente nel browser:
          il codice sorgente resta sul computer dell'utente e non viene trasmesso. Al servizio pervengono esclusivamente gli esiti, l'inventario dei file
          e gli estratti necessari alla revisione, dai quali credenziali e chiavi vengono rimosse in automatico prima dell'invio.
        </p>

        <Card className="mb-6 border-primary/30 bg-primary/5">
          <CardContent className="pt-6 text-sm space-y-4">
            <div>
              <p className="font-semibold mb-1">Ambiti verificati</p>
              <p className="text-muted-foreground">
                Sicurezza applicativa (credenziali nel codice, algoritmi crittografici deboli, comunicazioni non cifrate e versioni di TLS obsolete, iniezioni SQL, esecuzione dinamica di codice, deserializzazione di dati non fidati, percorsi di file costruiti con dati dell'utente, token JWT non verificati, configurazione dei cookie e delle intestazioni di sicurezza);
                protezione dei dati personali (dati identificativi nei log, categorie particolari come dati sanitari e biometrici, geolocalizzazione, accesso a fotocamera, microfono e contatti, trasferimenti verso Paesi extra UE compresi caratteri e video caricati da server esteri, tracciamento web e mobile senza consenso, consensi preselezionati);
                intelligenza artificiale (integrazione di servizi di IA e obblighi di trasparenza, contenuti sintetici, riconoscimento delle emozioni e categorizzazione biometrica, decisioni automatizzate su candidati, dipendenti, clienti, studenti o pazienti); accessibilità delle interfacce; licenze delle componenti open source.
              </p>
            </div>
            <div>
              <p className="font-semibold mb-1">Base normativa e criteri di analisi</p>
              <p className="text-muted-foreground mb-2">
                Ogni regola è collegata a una disposizione specifica presente nella base documentale di RegBrain. Gli esiti citano l'articolo applicabile e la revisione
                del modello consulta il testo della norma, non una sua sintesi.
              </p>
              <ul className="space-y-1 text-muted-foreground list-disc pl-5">
                <li><span className="text-foreground">Regolamento (UE) 2016/679 (GDPR)</span>, art. 5, 6, 7, 8, 9, 13, 22, 25, 28, 32, 35 e 44, e D.Lgs. 196/2003 (art. 2-quinquies e 122): liceità e minimizzazione del trattamento, validità del consenso, minori, categorie particolari di dati, decisioni automatizzate, privacy by design, misure di sicurezza, trasferimenti extra UE.</li>
                <li><span className="text-foreground">Direttiva 2002/58/CE (ePrivacy)</span>, Linee guida cookie del Garante e Linee guida EDPB 3/2022 sui modelli di progettazione ingannevoli: consenso preventivo per cookie, tracciamento web e mobile, risorse di terze parti, caselle preselezionate.</li>
                <li><span className="text-foreground">Regolamento (UE) 2024/2847 (Cyber Resilience Act)</span>, Allegato I: requisiti essenziali di sicurezza dei prodotti con elementi digitali, dalla gestione delle credenziali alla protezione dei dati in transito.</li>
                <li><span className="text-foreground">Regolamento (UE) 2024/1689 (AI Act)</span>, art. 5, 6, 26 e 50 e Allegato III, e Legge 132/2025: pratiche vietate, sistemi ad alto rischio, obblighi del deployer e di trasparenza, impiego dell'IA anche in ambito lavorativo.</li>
                <li><span className="text-foreground">D.Lgs. 138/2024 (recepimento NIS2)</span>, art. 24: misure di gestione dei rischi per la sicurezza informatica dei soggetti obbligati.</li>
                <li><span className="text-foreground">Direttiva (UE) 2019/882 (European Accessibility Act)</span> e WCAG 2.2: requisiti di accessibilità delle interfacce digitali.</li>
                <li><span className="text-foreground">OWASP ASVS 5.0</span> e Linee guida AgID per lo sviluppo sicuro: standard tecnici di riferimento per le verifiche di sicurezza del codice (segreti, cifratura, TLS, iniezioni, deserializzazione, gestione dei file, token, cookie, log).</li>
                <li><span className="text-foreground">Fonti di settore</span>, attivate quando il contesto lo richiede: MDR 2017/745 per il software medicale, PSD2 (autenticazione forte) e DORA per i servizi finanziari, CAD e SPID per la pubblica amministrazione, Data Act per i prodotti connessi, direttiva 2024/2853 sulla responsabilità da prodotto, Codice del consumo per le app rivolte ai consumatori.</li>
                <li><span className="text-foreground">Licenze open source</span>: individuazione di componenti con licenza copyleft (GPL, AGPL) e relativi obblighi di redistribuzione.</li>
              </ul>
            </div>
            <div>
              <p className="font-semibold mb-1">Metodo</p>
              <p className="text-muted-foreground">
                Un primo livello di regole deterministiche individua le evidenze nel codice e ne classifica il rischio; un secondo livello di revisione, basato sul modello
                e sulla base documentale normativa, valuta il contesto applicativo, integra gli esiti e formula le domande necessarie quando le informazioni non sono deducibili dal codice.
              </p>
            </div>
            <div>
              <p className="font-semibold mb-1">Conservazione dei dati</p>
              <p className="text-muted-foreground">
                Vengono conservati l'esito della verifica, l'elenco dei file con la rispettiva impronta crittografica e le righe citate a supporto di ciascun rilievo, prive di credenziali e chiavi.
                Il codice sorgente completo non viene conservato né trasmesso: alla revisione del modello sono sottoposti unicamente gli estratti pertinenti.
              </p>
            </div>
          </CardContent>
        </Card>

        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="text-lg">1. Il codice</CardTitle>
            <CardDescription>Una cartella intera (fino a {MAX_FILES.toLocaleString("it-IT")} file di testo), un archivio zip come quello che esporta GitHub, oppure del codice incollato. Cartelle come node_modules, .git, dist e vendor vengono saltate da sole.</CardDescription>
          </CardHeader>
          <CardContent>
            <Tabs value={mode} onValueChange={(v) => setMode(v as "folder" | "paste")}>
              <TabsList className="mb-4">
                <TabsTrigger value="folder">Cartella, zip o file</TabsTrigger>
                <TabsTrigger value="paste">Incolla</TabsTrigger>
              </TabsList>
              <TabsContent value="folder" className="space-y-3">
                <div
                  onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
                  onDragLeave={() => setDragging(false)}
                  onDrop={onDrop}
                  className={`border-2 border-dashed rounded-lg p-6 sm:p-8 text-center transition-colors ${dragging ? "border-primary bg-primary/5" : "border-muted-foreground/30"}`}
                >
                  <FolderOpen className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
                  <p className="text-sm font-medium">Trascina qui la cartella del progetto o un file .zip</p>
                  <p className="text-xs text-muted-foreground mt-1 mb-3">JavaScript, TypeScript, Python, Java, Kotlin, Swift, Go, PHP, C#, HTML, SQL, configurazioni e altri file di testo</p>
                  <div className="flex flex-wrap justify-center gap-2">
                    <Button type="button" variant="outline" size="sm" onClick={() => folderInput.current?.click()} disabled={!!reading}><FolderOpen className="mr-2 h-4 w-4" />Scegli una cartella</Button>
                    <Button type="button" variant="outline" size="sm" onClick={() => zipInput.current?.click()} disabled={!!reading}><Upload className="mr-2 h-4 w-4" />Carica uno zip</Button>
                    <Button type="button" variant="ghost" size="sm" onClick={() => filesInput.current?.click()} disabled={!!reading}><FileCode className="mr-2 h-4 w-4" />File singoli</Button>
                  </div>
                  <input ref={folderInput} type="file" multiple className="hidden" {...({ webkitdirectory: "", directory: "" } as Record<string, string>)} onChange={(e) => { if (e.target.files?.length) onFolderPicked(e.target.files); e.target.value = ""; }} />
                  <input ref={zipInput} type="file" accept=".zip" className="hidden" onChange={(e) => { if (e.target.files?.[0]) onZipPicked(e.target.files[0]); e.target.value = ""; }} />
                  <input ref={filesInput} type="file" multiple className="hidden" accept={CODE_EXTENSIONS.join(",")} onChange={(e) => { if (e.target.files?.length) onFolderPicked(e.target.files); e.target.value = ""; }} />
                </div>
                {reading && <p className="text-sm text-muted-foreground flex items-center gap-2"><Loader2 className="h-4 w-4 animate-spin" />{reading}</p>}
                {collected && !reading && (
                  <div className="rounded-md border bg-muted/30 p-3 text-sm space-y-1">
                    <p><strong>{collected.files.length.toLocaleString("it-IT")} file di codice</strong>, {collected.chars.toLocaleString("it-IT")} caratteri
                      {collected.skipped.ignoredDirs + collected.skipped.notCode + collected.skipped.binary + collected.skipped.tooLarge > 0 && (
                        <span className="text-muted-foreground"> · saltati: {collected.skipped.ignoredDirs} in cartelle escluse, {collected.skipped.notCode} non di codice, {collected.skipped.binary} binari, {collected.skipped.tooLarge} troppo grandi</span>
                      )}
                    </p>
                    {localScan && localCounts && (
                      <p className="text-muted-foreground">
                        Regole eseguite nel browser: {localScan.findings.length} tipi di problema ({localCounts.high} alti, {localCounts.medium} medi, {localCounts.low} bassi). Alla revisione andranno {localScan.excerpts.length} estratti per {localScan.excerpts.reduce((n, e) => n + e.text.length, 0).toLocaleString("it-IT")} caratteri.
                      </p>
                    )}
                    {inf && (
                      <p className="text-muted-foreground">
                        Dal codice: {Object.entries(inf.languages).sort((a, b) => b[1] - a[1]).slice(0, 4).map(([l, n]) => `${l} (${n})`).join(", ")}{inf.frameworks.length ? `; ${inf.frameworks.join(", ")}` : ""}.
                      </p>
                    )}
                  </div>
                )}
              </TabsContent>
              <TabsContent value="paste" className="space-y-3">
                <Input placeholder="Nome del file (facoltativo, aiuta a riconoscere il linguaggio: es. server.js)" value={pastedName} onChange={(e) => setPastedName(e.target.value)} />
                <Textarea value={pasted} onChange={(e) => setPasted(e.target.value)} placeholder="Incolla qui il codice" className="font-mono text-xs min-h-[260px]" spellCheck={false} />
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>

        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="text-lg">2. Il contesto</CardTitle>
            <CardDescription>
              {inf ? "Compilato dal codice: le voci con il segno \"dal codice\" hanno una prova (passa il mouse per vederla). Correggi solo se serve." : "Facoltativo: dopo la lettura di una cartella si compila da solo. Cambia il peso dei problemi e le norme applicabili."}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-1.5">
              <Label>Tipo di software (anche più di uno)</Label>
              <Chips options={APP_TYPE_OPTIONS} value={context.appTypes} onChange={setCtx("appTypes")} detected={detectedMap(inf?.appTypes)} />
            </div>
            <div className="space-y-1.5">
              <Label>Chi lo usa (anche più di uno)</Label>
              <Chips options={AUDIENCE_OPTIONS} value={context.audiences} onChange={setCtx("audiences")} detected={detectedMap(inf?.audiences)} />
            </div>
            <div className="space-y-1.5">
              <Label>Settore o regime (anche più di uno)</Label>
              <Chips options={SECTOR_OPTIONS} value={context.sectors} onChange={setCtx("sectors")} detected={detectedMap(inf?.sectors)} />
            </div>
            <div className="grid sm:grid-cols-2 gap-4">
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
                {inf && inf.personalData.length > 0 && <p className="text-xs text-muted-foreground">Nel codice: {inf.personalData.map((d) => d.value).join(", ")}</p>}
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
                {inf && inf.usesAI.length > 0 && <p className="text-xs text-muted-foreground">Nel codice: {inf.usesAI.map((d) => d.value).join(", ")}</p>}
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="cc-title">Nome della verifica</Label>
                <Input id="cc-title" placeholder="Es. Backend app prenotazioni" value={title} onChange={(e) => setTitle(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="cc-notes">Note (facoltative)</Label>
                <Textarea id="cc-notes" rows={2} placeholder="Es. i dati sono ospitati su AWS Francoforte; il login usa Google" value={context.notes} onChange={(e) => setCtx("notes")(e.target.value.slice(0, 1000))} />
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="flex flex-col sm:flex-row sm:items-center gap-3 mb-10">
          <Button size="lg" disabled={running || !ready || !!reading} onClick={startVerification} className="min-h-[44px]">
            {running ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Revisione in corso, può richiedere un minuto</> : <><ShieldCheck className="mr-2 h-4 w-4" />Verifica il codice</>}
          </Button>
          {mode === "folder" && localScan && <span className="text-xs text-muted-foreground">{localScan.stats.files.toLocaleString("it-IT")} file analizzati nel browser</span>}
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
