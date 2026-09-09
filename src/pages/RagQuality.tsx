import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { toast } from "sonner";
import {
  ArrowLeft,
  Download,
  FlaskConical,
  Loader2,
  ShieldCheck,
} from "lucide-react";

const ACTS = [
  { code: "GDPR", label: "GDPR — Reg. UE 2016/679" },
  { code: "NIS2", label: "NIS2 — Dir. UE 2022/2555" },
  { code: "DORA", label: "DORA — Reg. UE 2022/2554" },
  { code: "AI_ACT", label: "AI Act — Reg. UE 2024/1689" },
  { code: "CRA", label: "CRA — Reg. UE 2024/2847" },
];

interface EvalRun {
  id: string;
  label: string;
  queries_total: number;
  recall_at_10: number | null;
  mrr: number | null;
  article_precision: number | null;
  rerank_enabled: boolean;
  created_at: string;
}

export default function RagQuality() {
  const navigate = useNavigate();
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);
  const [ingesting, setIngesting] = useState<string | null>(null);
  const [progress, setProgress] = useState<{ done: number; total: number }>({
    done: 0,
    total: 0,
  });
  const [logs, setLogs] = useState<string[]>([]);
  const [evaluating, setEvaluating] = useState(false);
  const [runs, setRuns] = useState<EvalRun[]>([]);
  const [goldenCount, setGoldenCount] = useState(0);
  const [chunkStats, setChunkStats] = useState<
    { formex: number; total: number; withParagraph: number }
  >({ formex: 0, total: 0, withParagraph: 0 });

  const addLog = (line: string) =>
    setLogs((prev) => [`${new Date().toLocaleTimeString()} — ${line}`, ...prev].slice(0, 200));

  useEffect(() => {
    const check = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setIsAdmin(false);
        return;
      }
      const { data } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", user.id)
        .eq("role", "admin")
        .maybeSingle();
      setIsAdmin(!!data);
    };
    check();
  }, []);

  const loadStats = async () => {
    const [{ count: golden }, { count: total }, { count: formex }, { count: withPar }] =
      await Promise.all([
        supabase.from("rag_golden_queries").select("*", { count: "exact", head: true }).eq("active", true),
        supabase.from("structured_chunks").select("*", { count: "exact", head: true }),
        supabase.from("structured_chunks").select("*", { count: "exact", head: true }).eq("source_format", "formex"),
        supabase.from("structured_chunks").select("*", { count: "exact", head: true }).not("paragraph", "is", null),
      ]);
    setGoldenCount(golden ?? 0);
    setChunkStats({
      total: total ?? 0,
      formex: formex ?? 0,
      withParagraph: withPar ?? 0,
    });
    const { data: runData } = await supabase
      .from("rag_eval_runs")
      .select("id, label, queries_total, recall_at_10, mrr, article_precision, rerank_enabled, created_at")
      .order("created_at", { ascending: false })
      .limit(15);
    setRuns((runData as EvalRun[]) ?? []);
  };

  useEffect(() => {
    if (isAdmin) loadStats();
  }, [isAdmin]);

  const ingest = async (code: string) => {
    setIngesting(code);
    setProgress({ done: 0, total: 0 });
    addLog(`Avvio caricamento ${code} dal testo ufficiale strutturato…`);
    try {
      let offset: number | null = 0;
      let total = 0;
      let guard = 0;
      while (offset !== null && guard < 60) {
        guard++;
        const { data, error } = await supabase.functions.invoke(
          "ingest-eurlex-formex",
          { body: { regulation: code, lang: "IT", offset, limit: 60 } },
        );
        if (error) throw error;
        if (data?.error) throw new Error(data.error);
        total = data.totalUnits ?? total;
        setProgress({ done: offset + (data.processed ?? 0), total });
        addLog(
          `${code}: ${data.inserted} testi salvati (${data.embedded} con indice semantico) — ${offset + (data.processed ?? 0)}/${total}`,
        );
        offset = data.nextOffset ?? null;
      }
      addLog(`${code}: caricamento completato.`);
      toast.success(`${code} caricato con citazioni a livello di comma`);
      await loadStats();
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      addLog(`Errore su ${code}: ${msg}`);
      toast.error(`Errore su ${code}: ${msg}`);
    } finally {
      setIngesting(null);
    }
  };

  const runEval = async () => {
    setEvaluating(true);
    addLog("Avvio prova sul banco di riferimento…");
    try {
      const { data, error } = await supabase.functions.invoke("rag-eval", {
        body: { label: "manuale", rerank: true, maxQueries: 40 },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      addLog(
        `Prova conclusa: richiamo ${(data.recall_at_10 * 100).toFixed(1)}%, posizione media ${data.mrr.toFixed(3)}`,
      );
      toast.success("Prova completata");
      await loadStats();
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      addLog(`Errore nella prova: ${msg}`);
      toast.error(msg);
    } finally {
      setEvaluating(false);
    }
  };

  if (isAdmin === null) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4 p-6 text-center">
        <ShieldCheck className="h-10 w-10 text-muted-foreground" />
        <p className="text-muted-foreground">
          Questa pagina è riservata agli amministratori.
        </p>
        <Button variant="outline" onClick={() => navigate("/")}>
          Torna alla Homepage
        </Button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background p-4 md:p-8">
      <div className="mx-auto max-w-5xl space-y-6">
        <Button variant="ghost" onClick={() => navigate("/")} className="gap-2">
          <ArrowLeft className="h-4 w-4" /> Torna alla Homepage
        </Button>

        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            Qualità del retrieval normativo
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Caricamento dei testi ufficiali strutturati con citazioni a livello
            di comma e banco di prova per misurare la precisione.
          </p>
        </div>

        <div className="grid gap-4 sm:grid-cols-3">
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Testi normativi indicizzati</CardDescription>
              <CardTitle className="text-2xl">{chunkStats.total}</CardTitle>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Da testo ufficiale strutturato</CardDescription>
              <CardTitle className="text-2xl">{chunkStats.formex}</CardTitle>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Con comma citabile</CardDescription>
              <CardTitle className="text-2xl">
                {chunkStats.withParagraph}
              </CardTitle>
            </CardHeader>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Download className="h-4 w-4" /> Caricamento dai testi ufficiali
            </CardTitle>
            <CardDescription>
              Ogni comma diventa una citazione verificabile (es. "GDPR, art. 35,
              par. 3") con date di validità. Il caricamento sostituisce solo i
              testi della stessa versione.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {ingesting && progress.total > 0 && (
              <Progress
                value={(progress.done / progress.total) * 100}
                className="h-2"
              />
            )}
            <div className="flex flex-wrap gap-2">
              {ACTS.map((a) => (
                <Button
                  key={a.code}
                  variant="outline"
                  size="sm"
                  disabled={!!ingesting}
                  onClick={() => ingest(a.code)}
                  className="min-h-[44px]"
                >
                  {ingesting === a.code && (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  )}
                  {a.label}
                </Button>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <FlaskConical className="h-4 w-4" /> Banco di prova
            </CardTitle>
            <CardDescription>
              {goldenCount} domande di riferimento annotate. La prova misura
              quante volte l'articolo corretto compare fra i primi dieci
              risultati.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Button
              onClick={runEval}
              disabled={evaluating}
              className="min-h-[44px]"
            >
              {evaluating && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Esegui la prova
            </Button>

            {runs.length > 0 && (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b text-left text-muted-foreground">
                      <th className="py-2 pr-4 font-medium">Data</th>
                      <th className="py-2 pr-4 font-medium">Domande</th>
                      <th className="py-2 pr-4 font-medium">Richiamo</th>
                      <th className="py-2 pr-4 font-medium">Posizione media</th>
                      <th className="py-2 pr-4 font-medium">Precisione</th>
                      <th className="py-2 font-medium">Riordinamento</th>
                    </tr>
                  </thead>
                  <tbody>
                    {runs.map((r) => (
                      <tr key={r.id} className="border-b last:border-0">
                        <td className="py-2 pr-4 whitespace-nowrap">
                          {new Date(r.created_at).toLocaleString("it-IT")}
                        </td>
                        <td className="py-2 pr-4">{r.queries_total}</td>
                        <td className="py-2 pr-4">
                          {r.recall_at_10 !== null
                            ? `${(r.recall_at_10 * 100).toFixed(1)}%`
                            : "—"}
                        </td>
                        <td className="py-2 pr-4">
                          {r.mrr !== null ? r.mrr.toFixed(3) : "—"}
                        </td>
                        <td className="py-2 pr-4">
                          {r.article_precision !== null
                            ? `${(r.article_precision * 100).toFixed(1)}%`
                            : "—"}
                        </td>
                        <td className="py-2">
                          <Badge variant="outline">
                            {r.rerank_enabled ? "attivo" : "disattivo"}
                          </Badge>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>

        {logs.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Registro operazioni</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="max-h-64 overflow-y-auto space-y-1 font-mono text-xs text-muted-foreground">
                {logs.map((l, i) => <div key={i}>{l}</div>)}
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
