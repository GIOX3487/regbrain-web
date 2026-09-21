import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { formatDistanceToNow, format } from "date-fns";
import { it } from "date-fns/locale";
import { supabase } from "@/integrations/supabase/client";
import type { Json } from "@/integrations/supabase/types";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { toast } from "sonner";
import {
  Activity, AlertTriangle, ArrowLeft, Bell, BellOff, CheckCheck, ChevronDown, CircleAlert,
  Info, Loader2, LogIn, MessageSquare, RefreshCw, ShieldCheck, ThumbsDown, ThumbsUp,
  Users, Wrench, FileSearch,
} from "lucide-react";

// ---------------------------------------------------------------------------
// Tipi
// ---------------------------------------------------------------------------
interface Overview {
  users_registered: number;
  users_new_7d: number;
  demo_active: number;
  demo_started_7d: number;
  active_24h: number;
  assessments_total: number;
  assessments_in_progress: number;
  assessments_completed_7d: number;
  queries_24h: number;
  queries_7d: number;
  rag_latency_ms_7d: number | null;
  feedback_up_30d: number;
  feedback_down_30d: number;
  feedback_unread: number;
  errors_24h: number;
  warnings_24h: number;
}

interface FeedbackRow {
  id: string;
  author_email: string | null;
  is_demo: boolean;
  source: string;
  rating: number;
  comment: string | null;
  context: Json;
  seen_at: string | null;
  created_at: string;
  updated_at: string;
  assessment_id: string | null;
  query_log_id: string | null;
}

interface EventRow {
  id: number;
  created_at: string;
  level: "info" | "warning" | "error" | string;
  kind: string;
  actor_email: string | null;
  is_demo: boolean;
  message: string;
  details: Json;
}

type QueryRow = {
  id: string; created_at: string; email: string | null; is_demo: boolean; question: string;
  answer: string | null; latency_ms: number | null; model: string | null; citations: number;
  rating: number | null; comment: string | null;
};

type AssessmentRow = {
  id: string; created_at: string; completed_at: string | null; email: string | null; is_demo: boolean;
  title: string; status: string; compliance: number | null; regulations: string[] | null; progress: Json | null;
  documents: number; runs: number; feedback_up: number; feedback_down: number;
};

type UserRow = {
  id: string; email: string | null; is_demo: boolean; is_admin: boolean; created_at: string;
  last_sign_in_at: string | null; email_confirmed: boolean; demo_expires_at: string | null;
  sector: string | null; assessments: number; queries: number; feedback_up: number; feedback_down: number;
};

// ---------------------------------------------------------------------------
// Etichette
// ---------------------------------------------------------------------------
const SOURCE_LABEL: Record<string, string> = {
  rag: "Chat normativa",
  gap_analysis: "Gap analysis (intera)",
  gap_item: "Gap analysis (singolo esito)",
};

const KIND_LABEL: Record<string, string> = {
  signup: "Registrazione",
  email_confirmed: "Email confermata",
  login: "Accesso",
  demo_start: "Demo avviata",
  rag_query: "Domanda in chat",
  assessment_created: "Analisi creata",
  assessment_completed: "Analisi completata",
  documents_uploaded: "Documenti caricati",
  feedback: "Feedback",
  edge_error: "Errore del servizio",
  edge_warning: "Richiesta rifiutata",
};

const STATUS_LABEL: Record<string, string> = {
  covered: "Coperto",
  partial: "Parziale",
  missing: "Mancante",
  to_verify: "Da verificare",
  not_applicable: "Non applicabile",
};

const EVENT_GROUPS: Array<{ key: string; label: string; kinds: string[] | null }> = [
  { key: "all", label: "Tutto", kinds: null },
  { key: "users", label: "Utenti", kinds: ["signup", "email_confirmed", "login", "demo_start"] },
  { key: "chat", label: "Chat", kinds: ["rag_query"] },
  { key: "gap", label: "Gap analysis", kinds: ["assessment_created", "assessment_completed", "documents_uploaded"] },
  { key: "feedback", label: "Feedback", kinds: ["feedback"] },
  { key: "problems", label: "Errori e avvisi", kinds: ["edge_error", "edge_warning"] },
];

const ADMIN_TOOLS = [
  { path: "/admin/rag-quality", label: "Qualità del retrieval normativo", desc: "Banco di prova e caricamento dei testi ufficiali" },
  { path: "/admin/manage-requirements", label: "Catalogo degli obblighi", desc: "Obblighi usati dalla gap analysis" },
  { path: "/admin/verify-knowledge-base", label: "Verifica della base di conoscenza", desc: "Documenti e sezioni indicizzate" },
  { path: "/admin/manage-regulations", label: "Normative", desc: "Gestione dei testi normativi" },
  { path: "/admin/load-documents", label: "Caricamento documenti", desc: "Import di nuovi testi" },
];

// ---------------------------------------------------------------------------
// Utilità
// ---------------------------------------------------------------------------
const ago = (iso: string | null | undefined) =>
  iso ? formatDistanceToNow(new Date(iso), { addSuffix: true, locale: it }) : "mai";
const exact = (iso: string | null | undefined) => (iso ? format(new Date(iso), "dd/MM/yyyy HH:mm:ss") : "");

function obj(j: Json | null | undefined): Record<string, unknown> {
  return j && typeof j === "object" && !Array.isArray(j) ? (j as Record<string, unknown>) : {};
}
function str(v: unknown): string {
  if (v === null || v === undefined) return "";
  return typeof v === "string" ? v : typeof v === "number" || typeof v === "boolean" ? String(v) : JSON.stringify(v);
}

function Who({ email, demo }: { email: string | null; demo: boolean }) {
  return (
    <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
      <span className="truncate max-w-[220px]">{demo ? "Utente demo" : email || "utente eliminato"}</span>
      {demo && <Badge variant="outline" className="px-1.5 py-0 text-[10px]">demo</Badge>}
    </span>
  );
}

function LevelIcon({ level }: { level: string }) {
  if (level === "error") return <CircleAlert className="h-4 w-4 shrink-0 text-rose-600 dark:text-rose-400" aria-label="Errore" />;
  if (level === "warning") return <AlertTriangle className="h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400" aria-label="Avviso" />;
  return <Info className="h-4 w-4 shrink-0 text-muted-foreground" aria-label="Informazione" />;
}

function Stat({ label, value, sub, tone }: { label: string; value: string | number; sub?: string; tone?: "bad" | "warn" }) {
  return (
    <Card>
      <CardContent className="p-4">
        <p className="text-xs font-medium text-muted-foreground">{label}</p>
        <p className="mt-1 text-2xl font-semibold tabular-nums text-foreground">
          {value}
          {tone === "bad" && <CircleAlert className="ml-2 inline h-4 w-4 align-middle text-rose-600 dark:text-rose-400" aria-label="Da controllare" />}
          {tone === "warn" && <AlertTriangle className="ml-2 inline h-4 w-4 align-middle text-amber-600 dark:text-amber-400" aria-label="Da controllare" />}
        </p>
        {sub && <p className="mt-0.5 text-xs text-muted-foreground">{sub}</p>}
      </CardContent>
    </Card>
  );
}

function FeedbackContext({ row }: { row: FeedbackRow }) {
  const c = obj(row.context);
  if (row.source === "rag") {
    return (
      <div className="space-y-2 text-xs">
        {str(c.question) && (
          <div>
            <p className="font-medium text-foreground">Domanda</p>
            <p className="whitespace-pre-wrap text-muted-foreground">{str(c.question)}</p>
          </div>
        )}
        {str(c.answer) && (
          <div>
            <p className="font-medium text-foreground">Risposta mostrata</p>
            <p className="max-h-72 overflow-y-auto whitespace-pre-wrap rounded border bg-muted/40 p-2 text-muted-foreground">{str(c.answer)}</p>
          </div>
        )}
        <p className="text-muted-foreground">
          Citazioni: {str(c.citations) || "0"}{str(c.confidence) ? ` · affidabilità dichiarata: ${str(c.confidence)}` : ""}
        </p>
      </div>
    );
  }
  const evidence = Array.isArray(c.evidence) ? (c.evidence as Array<Record<string, unknown>>) : [];
  return (
    <div className="space-y-2 text-xs">
      <p className="text-muted-foreground">
        Analisi: <span className="text-foreground">{str(c.assessment_title) || "senza titolo"}</span>
        {str(c.engine_version) && <> · motore {str(c.engine_version)}</>}
      </p>
      {row.source === "gap_analysis" ? (
        <p className="text-muted-foreground">
          Conformità {str(c.compliance) ? `${Math.round(Number(c.compliance))}%` : "n.d."} · lacune {str(c.gaps) || "0"}
          {Array.isArray(c.regulations) && ` · ${(c.regulations as string[]).join(", ")}`}
        </p>
      ) : (
        <>
          <p>
            <span className="font-medium text-foreground">{str(c.reference)}</span>{" "}
            <span className="text-muted-foreground">{str(c.description)}</span>
          </p>
          <p className="text-muted-foreground">
            Esito dato dal motore: <span className="font-medium text-foreground">{STATUS_LABEL[str(c.status)] || str(c.status) || "n.d."}</span>
            {str(c.risk_level) && ` · rischio ${str(c.risk_level)}`}
          </p>
          {(str(c.assessment) || str(c.gap_description)) && (
            <p className="whitespace-pre-wrap text-muted-foreground">{str(c.assessment) || str(c.gap_description)}</p>
          )}
          {evidence.length > 0 && (
            <div className="space-y-1">
              {evidence.map((e, i) => (
                <p key={i} className="rounded border bg-muted/40 p-2 italic text-muted-foreground">
                  {str(e.document)}: “{str(e.quote)}”
                </p>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Pagina
// ---------------------------------------------------------------------------
export default function AdminDashboard() {
  const navigate = useNavigate();
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);
  const [overview, setOverview] = useState<Overview | null>(null);
  const [feedback, setFeedback] = useState<FeedbackRow[]>([]);
  const [events, setEvents] = useState<EventRow[]>([]);
  const [queries, setQueries] = useState<QueryRow[]>([]);
  const [assessments, setAssessments] = useState<AssessmentRow[]>([]);
  const [users, setUsers] = useState<UserRow[]>([]);
  const [live, setLive] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);
  const [fbRating, setFbRating] = useState<"all" | "down" | "up" | "unread">("all");
  const [fbSource, setFbSource] = useState<"all" | "rag" | "gap">("all");
  const [eventGroup, setEventGroup] = useState("all");
  const [browserAlerts, setBrowserAlerts] = useState(
    typeof Notification !== "undefined" && Notification.permission === "granted",
  );
  const browserAlertsRef = useRef(browserAlerts);
  useEffect(() => { browserAlertsRef.current = browserAlerts; }, [browserAlerts]);

  // Accesso: sessione valida e ruolo admin.
  useEffect(() => {
    (async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { sessionStorage.setItem("auth_redirect", "/admin"); navigate("/auth"); return; }
      const { data } = await supabase
        .from("user_roles").select("role")
        .eq("user_id", session.user.id).eq("role", "admin").maybeSingle();
      setIsAdmin(!!data);
    })();
  }, [navigate]);

  const loadOverview = useCallback(async () => {
    const { data, error } = await supabase.rpc("admin_overview");
    if (!error && data) setOverview(data as unknown as Overview);
  }, []);

  const loadAll = useCallback(async () => {
    setRefreshing(true);
    const [ov, fb, ev, q, a, u] = await Promise.all([
      supabase.rpc("admin_overview"),
      supabase.from("feedback").select("id, author_email, is_demo, source, rating, comment, context, seen_at, created_at, updated_at, assessment_id, query_log_id").order("updated_at", { ascending: false }).limit(300),
      supabase.from("app_events").select("id, created_at, level, kind, actor_email, is_demo, message, details").order("created_at", { ascending: false }).limit(300),
      supabase.rpc("admin_recent_queries", { p_limit: 100 }),
      supabase.rpc("admin_recent_assessments", { p_limit: 100 }),
      supabase.rpc("admin_users"),
    ]);
    if (ov.data) setOverview(ov.data as unknown as Overview);
    if (fb.data) setFeedback(fb.data as FeedbackRow[]);
    if (ev.data) setEvents(ev.data as EventRow[]);
    if (q.data) setQueries(q.data as QueryRow[]);
    if (a.data) setAssessments(a.data as AssessmentRow[]);
    if (u.data) setUsers(u.data as UserRow[]);
    const firstError = [ov, fb, ev, q, a, u].find((r) => r.error)?.error;
    if (firstError) toast.error(`Caricamento parziale: ${firstError.message}`);
    setLastUpdate(new Date());
    setRefreshing(false);
  }, []);

  useEffect(() => {
    if (!isAdmin) return;
    loadAll();
    const timer = setInterval(loadAll, 60_000);
    return () => clearInterval(timer);
  }, [isAdmin, loadAll]);

  // Tempo reale: nuovi eventi e nuovi feedback arrivano senza ricaricare.
  useEffect(() => {
    if (!isAdmin) return;
    let overviewTimer: ReturnType<typeof setTimeout> | null = null;
    const refreshOverviewSoon = () => {
      if (overviewTimer) clearTimeout(overviewTimer);
      overviewTimer = setTimeout(loadOverview, 800);
    };
    const notify = (title: string, body: string) => {
      if (browserAlertsRef.current && typeof Notification !== "undefined" && Notification.permission === "granted" && document.hidden) {
        try { new Notification(title, { body }); } catch { /* notifiche non disponibili */ }
      }
    };
    const channel = supabase
      .channel("admin-console")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "app_events" }, (payload) => {
        const row = payload.new as EventRow;
        setEvents((prev) => [row, ...prev.filter((e) => e.id !== row.id)].slice(0, 500));
        setLastUpdate(new Date());
        refreshOverviewSoon();
        if (row.level === "error") {
          toast.error(row.message);
          notify("RegBrain: errore", row.message);
        }
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "feedback" }, (payload) => {
        if (payload.eventType === "DELETE") {
          const old = payload.old as { id?: string };
          setFeedback((prev) => prev.filter((f) => f.id !== old.id));
          return;
        }
        const row = payload.new as FeedbackRow;
        setFeedback((prev) => [row, ...prev.filter((f) => f.id !== row.id)]);
        setLastUpdate(new Date());
        refreshOverviewSoon();
        if (!row.seen_at) {
          const what = SOURCE_LABEL[row.source] || row.source;
          const title = row.rating > 0 ? "Nuovo pollice su" : "Nuovo pollice giù";
          const body = `${what}${row.comment ? `: "${row.comment.slice(0, 120)}"` : ""}`;
          if (row.rating > 0) toast.success(`${title} · ${body}`); else toast.warning(`${title} · ${body}`);
          notify(`RegBrain: ${title.toLowerCase()}`, body);
        }
      })
      .subscribe((status) => setLive(status === "SUBSCRIBED"));
    return () => {
      if (overviewTimer) clearTimeout(overviewTimer);
      supabase.removeChannel(channel);
    };
  }, [isAdmin, loadOverview]);

  const toggleBrowserAlerts = async () => {
    if (typeof Notification === "undefined") {
      toast.error("Questo browser non supporta le notifiche.");
      return;
    }
    if (browserAlerts) { setBrowserAlerts(false); return; }
    const permission = Notification.permission === "granted" ? "granted" : await Notification.requestPermission();
    if (permission === "granted") {
      setBrowserAlerts(true);
      toast.success("Notifiche attive: arrivano anche quando la scheda non è in primo piano.");
    } else {
      toast.error("Il browser ha negato le notifiche. Puoi abilitarle dalle impostazioni del sito.");
    }
  };

  const markSeen = async (ids: string[]) => {
    if (ids.length === 0) return;
    const now = new Date().toISOString();
    const { error } = await supabase.from("feedback").update({ seen_at: now }).in("id", ids);
    if (error) { toast.error(`Non è stato possibile aggiornare: ${error.message}`); return; }
    setFeedback((prev) => prev.map((f) => (ids.includes(f.id) ? { ...f, seen_at: now } : f)));
    loadOverview();
  };

  const filteredFeedback = useMemo(() => feedback.filter((f) => {
    if (fbRating === "down" && f.rating !== -1) return false;
    if (fbRating === "up" && f.rating !== 1) return false;
    if (fbRating === "unread" && f.seen_at) return false;
    if (fbSource === "rag" && f.source !== "rag") return false;
    if (fbSource === "gap" && f.source === "rag") return false;
    return true;
  }), [feedback, fbRating, fbSource]);

  const filteredEvents = useMemo(() => {
    const group = EVENT_GROUPS.find((g) => g.key === eventGroup);
    return group?.kinds ? events.filter((e) => group.kinds!.includes(e.kind)) : events;
  }, [events, eventGroup]);

  const problems = useMemo(() => events.filter((e) => e.level === "error" || e.kind === "edge_warning"), [events]);

  // -------------------------------------------------------------------------
  if (isAdmin === null) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 p-6 text-center">
        <ShieldCheck className="h-10 w-10 text-muted-foreground" />
        <p className="max-w-md text-muted-foreground">
          Questa pagina è riservata agli amministratori. Se dovresti avere accesso, entra con l'account autorizzato.
        </p>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => navigate("/")}>Torna alla homepage</Button>
          <Button onClick={async () => { await supabase.auth.signOut(); sessionStorage.setItem("auth_redirect", "/admin"); navigate("/auth"); }}>Accedi con un altro account</Button>
        </div>
      </div>
    );
  }

  const o = overview;
  const fbTotal = o ? o.feedback_up_30d + o.feedback_down_30d : 0;
  const fbPositive = o && fbTotal > 0 ? Math.round((o.feedback_up_30d / fbTotal) * 100) : null;
  const unreadIds = feedback.filter((f) => !f.seen_at).map((f) => f.id);

  const chip = (active: boolean) =>
    `rounded-full border px-3 py-1 text-xs transition-colors ${active ? "border-primary bg-primary text-primary-foreground" : "hover:bg-muted"}`;

  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto max-w-7xl space-y-6 p-4 md:p-8">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <Button variant="ghost" size="sm" onClick={() => navigate("/chat")} className="-ml-2 mb-2 gap-2">
              <ArrowLeft className="h-4 w-4" /> Torna all'app
            </Button>
            <h1 className="text-2xl font-semibold tracking-tight">Console di amministrazione</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Cosa succede sulla piattaforma, in tempo reale: accessi, chat, gap analysis, feedback ed errori.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs text-muted-foreground">
              <span className={`h-2 w-2 rounded-full ${live ? "bg-emerald-500" : "bg-muted-foreground/40"}`} />
              {live ? "In diretta" : "Connessione in corso"}
              {lastUpdate && <span>· aggiornato {ago(lastUpdate.toISOString())}</span>}
            </span>
            <Button variant="outline" size="sm" onClick={toggleBrowserAlerts} className="gap-2">
              {browserAlerts ? <Bell className="h-4 w-4" /> : <BellOff className="h-4 w-4" />}
              {browserAlerts ? "Notifiche attive" : "Attiva notifiche"}
            </Button>
            <Button variant="outline" size="sm" onClick={loadAll} disabled={refreshing} className="gap-2">
              <RefreshCw className={`h-4 w-4 ${refreshing ? "animate-spin" : ""}`} /> Aggiorna
            </Button>
          </div>
        </div>

        {/* Indicatori */}
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4 xl:grid-cols-6">
          <Stat label="Utenti registrati" value={o?.users_registered ?? "…"} sub={o ? `+${o.users_new_7d} negli ultimi 7 giorni` : undefined} />
          <Stat label="Demo attive" value={o?.demo_active ?? "…"} sub={o ? `${o.demo_started_7d} avviate in 7 giorni` : undefined} />
          <Stat label="Persone attive (24 ore)" value={o?.active_24h ?? "…"} />
          <Stat label="Domande in chat (24 ore)" value={o?.queries_24h ?? "…"} sub={o ? `${o.queries_7d} in 7 giorni${o.rag_latency_ms_7d ? ` · ${(o.rag_latency_ms_7d / 1000).toFixed(1)} s in media` : ""}` : undefined} />
          <Stat label="Gap analysis" value={o?.assessments_total ?? "…"} sub={o ? `${o.assessments_in_progress} in corso · ${o.assessments_completed_7d} completate in 7 giorni` : undefined} />
          <Stat
            label="Feedback (30 giorni)"
            value={o ? (fbPositive === null ? "nessuno" : `${fbPositive}% positivi`) : "…"}
            sub={o ? `${o.feedback_up_30d} su · ${o.feedback_down_30d} giù · ${o.feedback_unread} da leggere` : undefined}
            tone={o && o.feedback_unread > 0 ? "warn" : undefined}
          />
        </div>
        {o && (o.errors_24h > 0 || o.warnings_24h > 0) && (
          <Card className="border-rose-500/40">
            <CardContent className="flex flex-wrap items-center gap-3 p-4 text-sm">
              <CircleAlert className="h-4 w-4 text-rose-600 dark:text-rose-400" />
              <span>
                Ultime 24 ore: <strong>{o.errors_24h}</strong> {o.errors_24h === 1 ? "errore" : "errori"} del servizio e{" "}
                <strong>{o.warnings_24h}</strong> {o.warnings_24h === 1 ? "richiesta rifiutata" : "richieste rifiutate"}.
              </span>
            </CardContent>
          </Card>
        )}

        <Tabs defaultValue="feedback" className="space-y-4">
          <TabsList className="h-auto flex-wrap">
            <TabsTrigger value="feedback" className="gap-1.5"><ThumbsUp className="h-3.5 w-3.5" /> Feedback{o && o.feedback_unread > 0 ? ` (${o.feedback_unread})` : ""}</TabsTrigger>
            <TabsTrigger value="activity" className="gap-1.5"><Activity className="h-3.5 w-3.5" /> Attività</TabsTrigger>
            <TabsTrigger value="problems" className="gap-1.5"><CircleAlert className="h-3.5 w-3.5" /> Errori ({problems.length})</TabsTrigger>
            <TabsTrigger value="chat" className="gap-1.5"><MessageSquare className="h-3.5 w-3.5" /> Chat</TabsTrigger>
            <TabsTrigger value="gap" className="gap-1.5"><FileSearch className="h-3.5 w-3.5" /> Gap analysis</TabsTrigger>
            <TabsTrigger value="users" className="gap-1.5"><Users className="h-3.5 w-3.5" /> Utenti</TabsTrigger>
            <TabsTrigger value="tools" className="gap-1.5"><Wrench className="h-3.5 w-3.5" /> Strumenti</TabsTrigger>
          </TabsList>

          {/* Feedback */}
          <TabsContent value="feedback" className="space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex flex-wrap gap-2">
                {([["all", "Tutti"], ["unread", "Da leggere"], ["down", "Pollice giù"], ["up", "Pollice su"]] as const).map(([k, l]) => (
                  <button key={k} type="button" className={chip(fbRating === k)} onClick={() => setFbRating(k)}>{l}</button>
                ))}
                <span className="mx-1 w-px bg-border" />
                {([["all", "Ovunque"], ["rag", "Chat"], ["gap", "Gap analysis"]] as const).map(([k, l]) => (
                  <button key={k} type="button" className={chip(fbSource === k)} onClick={() => setFbSource(k)}>{l}</button>
                ))}
              </div>
              <Button variant="outline" size="sm" className="gap-2" disabled={unreadIds.length === 0} onClick={() => markSeen(unreadIds)}>
                <CheckCheck className="h-4 w-4" /> Segna tutti come letti
              </Button>
            </div>
            {filteredFeedback.length === 0 && (
              <Card><CardContent className="py-10 text-center text-sm text-muted-foreground">Nessun feedback con questi filtri.</CardContent></Card>
            )}
            {filteredFeedback.map((f) => (
              <Card key={f.id} className={f.seen_at ? "" : "border-primary/50"}>
                <CardContent className="space-y-2 p-4">
                  <div className="flex flex-wrap items-center gap-2">
                    {f.rating > 0
                      ? <span className="inline-flex items-center gap-1 text-sm font-medium"><ThumbsUp className="h-4 w-4 text-emerald-600 dark:text-emerald-400" /> Pollice su</span>
                      : <span className="inline-flex items-center gap-1 text-sm font-medium"><ThumbsDown className="h-4 w-4 text-rose-600 dark:text-rose-400" /> Pollice giù</span>}
                    <Badge variant="secondary">{SOURCE_LABEL[f.source] || f.source}</Badge>
                    {!f.seen_at && <Badge>Nuovo</Badge>}
                    <Who email={f.author_email} demo={f.is_demo} />
                    <span className="text-xs text-muted-foreground" title={exact(f.updated_at)}>{ago(f.updated_at)}</span>
                    {!f.seen_at && (
                      <Button variant="ghost" size="sm" className="ml-auto h-7 gap-1 text-xs" onClick={() => markSeen([f.id])}>
                        <CheckCheck className="h-3.5 w-3.5" /> Letto
                      </Button>
                    )}
                  </div>
                  {f.comment
                    ? <p className="whitespace-pre-wrap text-sm">“{f.comment}”</p>
                    : <p className="text-xs text-muted-foreground">Nessun commento scritto.</p>}
                  <Collapsible>
                    <CollapsibleTrigger asChild>
                      <Button variant="ghost" size="sm" className="-ml-2 h-7 gap-1 text-xs">
                        Cosa ha visto l'utente <ChevronDown className="h-3 w-3" />
                      </Button>
                    </CollapsibleTrigger>
                    <CollapsibleContent className="pt-1"><FeedbackContext row={f} /></CollapsibleContent>
                  </Collapsible>
                </CardContent>
              </Card>
            ))}
          </TabsContent>

          {/* Attività */}
          <TabsContent value="activity" className="space-y-3">
            <div className="flex flex-wrap gap-2">
              {EVENT_GROUPS.map((g) => (
                <button key={g.key} type="button" className={chip(eventGroup === g.key)} onClick={() => setEventGroup(g.key)}>{g.label}</button>
              ))}
            </div>
            <Card>
              <CardContent className="divide-y p-0">
                {filteredEvents.length === 0 && <p className="p-6 text-center text-sm text-muted-foreground">Nessun evento registrato.</p>}
                {filteredEvents.map((e) => (
                  <div key={e.id} className="flex items-start gap-3 px-4 py-3">
                    {e.kind === "login" ? <LogIn className="h-4 w-4 shrink-0 text-muted-foreground" /> : <LevelIcon level={e.level} />}
                    <div className="min-w-0 flex-1">
                      <p className="break-words text-sm">{e.message}</p>
                      <div className="mt-0.5 flex flex-wrap items-center gap-2">
                        <span className="text-xs font-medium text-muted-foreground">{KIND_LABEL[e.kind] || e.kind}</span>
                        <Who email={e.actor_email} demo={e.is_demo} />
                      </div>
                    </div>
                    <span className="shrink-0 text-xs text-muted-foreground" title={exact(e.created_at)}>{ago(e.created_at)}</span>
                  </div>
                ))}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Errori */}
          <TabsContent value="problems" className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Risposte con errore delle funzioni del server (5xx) e richieste rifiutate (4xx, escluse le sessioni scadute). Per ogni riga: funzione, codice, messaggio e durata.
            </p>
            <Card>
              <CardContent className="divide-y p-0">
                {problems.length === 0 && <p className="p-6 text-center text-sm text-muted-foreground">Nessun errore registrato. Bene così.</p>}
                {problems.map((e) => {
                  const d = obj(e.details);
                  return (
                    <div key={e.id} className="flex items-start gap-3 px-4 py-3">
                      <LevelIcon level={e.level} />
                      <div className="min-w-0 flex-1">
                        <p className="break-words font-mono text-xs">{e.message}</p>
                        <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                          {str(d.function) && <Badge variant="outline" className="font-mono text-[10px]">{str(d.function)}</Badge>}
                          {str(d.status) && <span>codice {str(d.status)}</span>}
                          {str(d.duration_ms) && <span>· {Math.round(Number(d.duration_ms) / 100) / 10} s</span>}
                          <Who email={e.actor_email} demo={e.is_demo} />
                        </div>
                      </div>
                      <span className="shrink-0 text-xs text-muted-foreground" title={exact(e.created_at)}>{ago(e.created_at)}</span>
                    </div>
                  );
                })}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Chat */}
          <TabsContent value="chat" className="space-y-3">
            {queries.length === 0 && <Card><CardContent className="py-10 text-center text-sm text-muted-foreground">Nessuna domanda registrata.</CardContent></Card>}
            {queries.map((q) => (
              <Card key={q.id}>
                <CardContent className="space-y-2 p-4">
                  <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                    <Who email={q.email} demo={q.is_demo} />
                    <span title={exact(q.created_at)}>{ago(q.created_at)}</span>
                    {q.latency_ms ? <span>· {(q.latency_ms / 1000).toFixed(1)} s</span> : null}
                    <span>· {q.citations} {q.citations === 1 ? "citazione" : "citazioni"}</span>
                    {q.rating === 1 && <span className="inline-flex items-center gap-1 text-foreground"><ThumbsUp className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" /> utile</span>}
                    {q.rating === -1 && <span className="inline-flex items-center gap-1 text-foreground"><ThumbsDown className="h-3.5 w-3.5 text-rose-600 dark:text-rose-400" /> non utile</span>}
                  </div>
                  <p className="text-sm font-medium">{q.question}</p>
                  {q.comment && <p className="text-sm text-muted-foreground">Commento: “{q.comment}”</p>}
                  {q.answer && (
                    <Collapsible>
                      <CollapsibleTrigger asChild>
                        <Button variant="ghost" size="sm" className="-ml-2 h-7 gap-1 text-xs">Risposta <ChevronDown className="h-3 w-3" /></Button>
                      </CollapsibleTrigger>
                      <CollapsibleContent>
                        <p className="max-h-80 overflow-y-auto whitespace-pre-wrap rounded border bg-muted/40 p-2 text-xs text-muted-foreground">{q.answer}</p>
                      </CollapsibleContent>
                    </Collapsible>
                  )}
                </CardContent>
              </Card>
            ))}
          </TabsContent>

          {/* Gap analysis */}
          <TabsContent value="gap" className="space-y-3">
            {assessments.length === 0 && <Card><CardContent className="py-10 text-center text-sm text-muted-foreground">Nessuna gap analysis.</CardContent></Card>}
            {assessments.map((a) => {
              const p = obj(a.progress);
              const done = Number(p.done ?? 0);
              const total = Number(p.total ?? 0);
              return (
                <Card key={a.id}>
                  <CardContent className="space-y-1.5 p-4">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-sm font-medium">{a.title || "Senza titolo"}</p>
                      <Badge variant={a.status === "completed" ? "secondary" : "outline"}>
                        {a.status === "completed" ? "Completata" : a.status === "in_progress" ? "In corso" : a.status}
                      </Badge>
                      {a.compliance !== null && a.status === "completed" && (
                        <span className="text-sm tabular-nums">{Math.round(Number(a.compliance))}% conformità</span>
                      )}
                    </div>
                    <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                      <Who email={a.email} demo={a.is_demo} />
                      <span title={exact(a.created_at)}>creata {ago(a.created_at)}</span>
                      {a.status !== "completed" && total > 0 && <span>· {done}/{total} obblighi valutati</span>}
                      <span>· {a.documents} {a.documents === 1 ? "documento" : "documenti"}</span>
                      <span>· {a.runs} {a.runs === 1 ? "giro" : "giri"}</span>
                      {(a.regulations || []).length > 0 && <span>· {(a.regulations || []).join(", ")}</span>}
                      {(a.feedback_up > 0 || a.feedback_down > 0) && (
                        <span className="inline-flex items-center gap-2 text-foreground">
                          · <ThumbsUp className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" /> {a.feedback_up}
                          <ThumbsDown className="h-3.5 w-3.5 text-rose-600 dark:text-rose-400" /> {a.feedback_down}
                        </span>
                      )}
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </TabsContent>

          {/* Utenti */}
          <TabsContent value="users">
            <Card>
              <CardContent className="overflow-x-auto p-0">
                <table className="w-full min-w-[760px] text-sm">
                  <thead>
                    <tr className="border-b text-left text-xs text-muted-foreground">
                      <th className="px-4 py-2 font-medium">Utente</th>
                      <th className="px-4 py-2 font-medium">Registrato</th>
                      <th className="px-4 py-2 font-medium">Ultimo accesso</th>
                      <th className="px-4 py-2 text-right font-medium">Analisi</th>
                      <th className="px-4 py-2 text-right font-medium">Domande</th>
                      <th className="px-4 py-2 text-right font-medium">Feedback</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {users.map((u) => (
                      <tr key={u.id}>
                        <td className="px-4 py-2">
                          <div className="flex flex-wrap items-center gap-1.5">
                            <span className="truncate">{u.is_demo ? "Utente demo" : u.email}</span>
                            {u.is_admin && <Badge className="px-1.5 py-0 text-[10px]">admin</Badge>}
                            {u.is_demo && <Badge variant="outline" className="px-1.5 py-0 text-[10px]">demo, scade {ago(u.demo_expires_at)}</Badge>}
                            {!u.is_demo && !u.email_confirmed && <Badge variant="outline" className="px-1.5 py-0 text-[10px]">email non confermata</Badge>}
                          </div>
                          {u.sector && <p className="text-xs text-muted-foreground">{u.sector}</p>}
                        </td>
                        <td className="px-4 py-2 text-xs text-muted-foreground" title={exact(u.created_at)}>{ago(u.created_at)}</td>
                        <td className="px-4 py-2 text-xs text-muted-foreground" title={exact(u.last_sign_in_at)}>{ago(u.last_sign_in_at)}</td>
                        <td className="px-4 py-2 text-right tabular-nums">{u.assessments}</td>
                        <td className="px-4 py-2 text-right tabular-nums">{u.queries}</td>
                        <td className="px-4 py-2 text-right tabular-nums text-xs">{u.feedback_up} su · {u.feedback_down} giù</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Strumenti */}
          <TabsContent value="tools">
            <div className="grid gap-3 md:grid-cols-2">
              {ADMIN_TOOLS.map((tool) => (
                <Card key={tool.path} className="cursor-pointer transition-colors hover:bg-muted/40" onClick={() => navigate(tool.path)}>
                  <CardHeader className="p-4">
                    <CardTitle className="text-base">{tool.label}</CardTitle>
                    <CardDescription>{tool.desc}</CardDescription>
                  </CardHeader>
                </Card>
              ))}
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
