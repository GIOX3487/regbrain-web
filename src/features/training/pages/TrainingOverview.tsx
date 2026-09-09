import { ArrowUpRight, BadgeCheck, BookOpenCheck, Clock, FileBadge, Sparkles } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { trainingEmployees } from "@/mocks/training/employees";
import { trainingGaps } from "@/mocks/training/gaps";
import { TrainingLayout } from "../components/TrainingLayout";
import { cn } from "@/lib/utils";

const roleCoverage = [
  ["DPO", 95], ["CISO", 88], ["IT Lead", 76], ["HR", 62], ["Marketing", 54], ["Legal", 91],
] as const;

const deadlines = [
  { title: "AI Act Art. 4", detail: "AI literacy obbligatoria", date: "02/02/2026", days: "-71 gg" },
  { title: "NIS2 Art. 23", detail: "Notifica incidenti significativi", date: "15/04/2026", days: "1 gg" },
  { title: "DORA Art. 28", detail: "Rischio terze parti ICT", date: "30/04/2026", days: "16 gg" },
];

export default function TrainingOverview() {
  return (
    <TrainingLayout>
      <div className="mb-6 flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
        <div>
          <h1 className="text-[28px] font-semibold tracking-tight text-slate-950">Adaptive Compliance Training</h1>
          <p className="mt-1 text-sm text-slate-600">Percorsi formativi generati dai gap, verificati con quiz normativi e pronti per audit.</p>
        </div>
        <Button className="bg-primary text-primary-foreground hover:bg-primary/90"><Sparkles className="h-4 w-4" /> Genera corso da gap</Button>
      </div>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <KpiCard icon={BookOpenCheck} label="Corsi auto-generati da gap" value="23" subtitle="negli ultimi 30 giorni" trend="+18%" />
        <KpiCard icon={ArrowUpRight} label="Tasso di completamento" value="87%" subtitle="team aziendale" ring={87} />
        <KpiCard icon={FileBadge} label="Attestati validi" value="142" subtitle="audit-ready" />
        <KpiCard icon={BadgeCheck} label="Gap rimediati via formazione" value="19/23" subtitle="82% closure rate" />
      </section>

      <section className="mt-6 grid gap-6 xl:grid-cols-3">
        <div className="xl:col-span-2">
          <div className="rounded-2xl border border-slate-200 bg-white shadow-sm">
            <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
              <div>
                <h2 className="text-xl font-semibold tracking-tight">Pipeline Formativa Attiva</h2>
                <p className="text-sm text-slate-500">Gap che hanno attivato micro-corsi assegnati ai ruoli responsabili.</p>
              </div>
              <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-600">{trainingGaps.length} gap</span>
            </div>
            <div className="divide-y divide-slate-100">
              {trainingGaps.slice(0, 8).map((gap) => <PipelineRow key={gap.id} gap={gap} />)}
            </div>
          </div>
        </div>

        <aside className="space-y-6">
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="text-xl font-semibold tracking-tight">Coverage per Ruolo</h2>
            <div className="mt-5 space-y-4">
              {roleCoverage.map(([role, value]) => (
                <div key={role}>
                  <div className="mb-1.5 flex items-center justify-between text-sm">
                    <span className="font-medium text-slate-700">{role}</span>
                    <span className="text-slate-500">{value}%</span>
                  </div>
                  <Progress value={value} className="h-2 bg-slate-100" />
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="text-xl font-semibold tracking-tight">Prossime scadenze normative</h2>
            <div className="mt-4 space-y-3">
              {deadlines.map((item, index) => (
                <div key={item.title} className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold text-slate-900">{item.title}</p>
                      <p className="mt-1 text-xs text-slate-600">{item.detail} entro {item.date}</p>
                    </div>
                    <span className={cn("shrink-0 rounded-full px-2 py-1 text-[11px] font-semibold", index === 0 ? "bg-red-100 text-red-700" : "bg-amber-100 text-amber-700")}>{item.days}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </aside>
      </section>
    </TrainingLayout>
  );
}

function KpiCard({ icon: Icon, label, value, subtitle, trend, ring }: { icon: typeof BookOpenCheck; label: string; value: string; subtitle: string; trend?: string; ring?: number }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div className="grid h-10 w-10 place-items-center rounded-xl bg-blue-50 text-primary"><Icon className="h-5 w-5" /></div>
        {ring ? <div className="grid h-11 w-11 place-items-center rounded-full border-4 border-teal-500 text-[11px] font-semibold text-slate-700">{ring}%</div> : trend ? <span className="rounded-full bg-teal-50 px-2 py-1 text-xs font-semibold text-teal-700">↗ {trend}</span> : null}
      </div>
      <p className="mt-4 text-xs font-medium uppercase tracking-wide text-slate-500">{label}</p>
      <p className="mt-1 text-[28px] font-semibold leading-tight tracking-tight text-slate-950">{value}</p>
      <p className="text-sm text-slate-500">{subtitle}</p>
    </div>
  );
}

function PipelineRow({ gap }: { gap: (typeof trainingGaps)[number] }) {
  const navigate = useNavigate();
  const assignees = gap.assigneeIds.map((id) => trainingEmployees.find((employee) => employee.id === id)).filter(Boolean).slice(0, 3);
  const hidden = Math.max(0, gap.assigneeIds.length - 3);
  const status = gap.status === "Rimediato" ? "Completato" : gap.status;

  return (
    <button onClick={() => navigate(`/formazione/gap/${gap.id}`)} className="grid w-full gap-4 px-5 py-4 text-left transition-colors hover:bg-slate-50 md:grid-cols-[1fr_auto] md:items-center">
      <div className="relative pl-5">
        <span className="absolute left-0 top-1.5 h-2.5 w-2.5 rounded-full bg-primary ring-4 ring-blue-50" />
        <div className="flex flex-wrap items-center gap-2">
          <h3 className="text-sm font-semibold text-slate-950">{gap.title}</h3>
          <span className="inline-flex items-center gap-1 rounded-full bg-violet-50 px-2 py-0.5 text-[11px] font-semibold text-violet-700"><Sparkles className="h-3 w-3" /> AI-GENERATED</span>
        </div>
        <p className="mt-1 text-xs text-slate-500">{gap.source}</p>
        <div className="mt-3 flex flex-wrap items-center gap-3">
          <div className="flex -space-x-2">
            {assignees.map((employee) => <span key={employee!.id} className="grid h-7 w-7 place-items-center rounded-full border-2 border-white bg-slate-900 text-[10px] font-semibold text-white">{employee!.initials}</span>)}
            {hidden > 0 && <span className="grid h-7 w-7 place-items-center rounded-full border-2 border-white bg-slate-100 text-[10px] font-semibold text-slate-600">+{hidden}</span>}
          </div>
          <span className={cn("rounded-full px-2.5 py-1 text-xs font-semibold", status === "Completato" ? "bg-teal-50 text-teal-700" : status === "In ritardo" ? "bg-red-50 text-red-700" : "bg-amber-50 text-amber-700")}>{status}</span>
          <div className="w-40"><Progress value={gap.progress} className="h-2 bg-slate-100" /></div>
          <span className="text-xs font-medium text-slate-500">{gap.progress}%</span>
        </div>
      </div>
      <Button variant="outline" size="sm" className="justify-self-start md:justify-self-end"><Clock className="h-4 w-4" /> Apri</Button>
    </button>
  );
}
