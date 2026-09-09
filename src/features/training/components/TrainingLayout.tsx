import { PropsWithChildren, useMemo, useState } from "react";
import { Link, NavLink, useLocation, useParams } from "react-router-dom";
import {
  BarChart3,
  Bell,
  BookOpenCheck,
  Building2,
  ChevronDown,
  FileBadge,
  FileText,
  Gauge,
  GraduationCap,
  LayoutDashboard,
  Menu,
  Search,
  Settings,
  ShieldCheck,
  Users,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const platformItems = [
  { label: "Dashboard", icon: LayoutDashboard, href: "/formazione/demo/dashboard" },
  { label: "Gap Analysis", icon: ShieldCheck, href: "/formazione/demo/gap-analysis" },
  { label: "Documenti & Policy", icon: FileText, href: "/formazione/demo/documenti-policy" },
  { label: "Risk Scoring", icon: Gauge, href: "/formazione/demo/risk-scoring" },
  { label: "Market Intelligence", icon: BarChart3, href: "/formazione/demo/market-intelligence" },
];

const trainingItems = [
  { label: "Panoramica", href: "/formazione", icon: LayoutDashboard },
  { label: "Corsi assegnati", href: "/formazione/corsi-assegnati", icon: BookOpenCheck },
  { label: "Catalogo corsi", href: "/formazione/catalogo", icon: GraduationCap },
  { label: "Certificati & Attestati", href: "/formazione/certificati", icon: FileBadge },
  { label: "Team & Ruoli", href: "/formazione/team-ruoli", icon: Users },
  { label: "Audit Trail Formativo", href: "/formazione/audit-trail", icon: ShieldCheck },
];

const crumbs: Record<string, string> = {
  "/formazione": "Panoramica",
  "/formazione/corsi-assegnati": "Corsi assegnati",
  "/formazione/catalogo": "Catalogo corsi",
  "/formazione/certificati": "Certificati & Attestati",
  "/formazione/team-ruoli": "Team & Ruoli",
  "/formazione/audit-trail": "Audit Trail Formativo",
};

export function TrainingLayout({ children }: PropsWithChildren) {
  const [collapsed, setCollapsed] = useState(false);
  const { pathname } = useLocation();
  const page = crumbs[pathname] ?? "Modulo demo";

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <aside className={cn("fixed inset-y-0 left-0 z-30 hidden border-r border-slate-200 bg-white shadow-sm transition-all lg:flex lg:flex-col", collapsed ? "w-20" : "w-72")}>
        <div className="flex h-16 items-center gap-3 border-b border-slate-200 px-4">
          <Link to="/formazione" className="flex min-w-0 items-center gap-3">
            <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-primary text-primary-foreground"><ShieldCheck className="h-5 w-5" /></span>
            {!collapsed && <span className="truncate text-lg font-semibold tracking-tight">RegBrain</span>}
          </Link>
          <Button variant="ghost" size="icon" className="ml-auto h-8 w-8" onClick={() => setCollapsed((value) => !value)}>
            <Menu className="h-4 w-4" />
          </Button>
        </div>
        <nav className="flex-1 overflow-y-auto px-3 py-4 text-sm">
          <div className="space-y-1">
            {platformItems.map((item) => <SidebarLink key={item.href} collapsed={collapsed} {...item} />)}
          </div>
          <div className="mt-6">
            {!collapsed && <p className="px-3 pb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">Formazione</p>}
            <div className="space-y-1 rounded-2xl bg-slate-50 p-2">
              {trainingItems.map((item) => <SidebarLink key={item.href} collapsed={collapsed} {...item} exact={item.href === "/formazione"} />)}
            </div>
          </div>
          <div className="mt-6">
            <SidebarLink collapsed={collapsed} label="Impostazioni" icon={Settings} href="/formazione/demo/impostazioni" />
          </div>
        </nav>
      </aside>

      <div className={cn("min-h-screen transition-all", collapsed ? "lg:pl-20" : "lg:pl-72")}>
        <header className="sticky top-0 z-20 flex h-16 items-center gap-4 border-b border-slate-200 bg-white/95 px-4 backdrop-blur lg:px-6">
          <div className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700">
            <Building2 className="h-4 w-4 text-slate-500" />
            RegBrain Italia S.r.l.
            <ChevronDown className="h-4 w-4 text-slate-400" />
          </div>
          <div className="hidden min-w-0 flex-1 items-center rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 md:flex">
            <Search className="mr-2 h-4 w-4 text-slate-400" />
            <span className="text-sm text-slate-500">Cerca corsi, gap, attestati...</span>
          </div>
          <Button variant="ghost" size="icon" className="h-9 w-9"><Bell className="h-4 w-4" /></Button>
          <div className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-2 py-1.5">
            <span className="grid h-7 w-7 place-items-center rounded-full bg-slate-900 text-xs font-semibold text-white">MP</span>
            <div className="hidden text-left leading-tight sm:block">
              <p className="text-xs font-semibold">Matteo Piccirilli</p>
              <p className="text-[11px] text-slate-500">Admin</p>
            </div>
          </div>
        </header>
        <main className="px-4 py-6 lg:px-8">
          <div className="mb-5 flex items-center gap-2 text-sm text-slate-500">
            <Link to="/formazione" className="hover:text-slate-900">Formazione</Link>
            <span>/</span>
            <span className="font-medium text-slate-900">{page}</span>
          </div>
          {children}
        </main>
      </div>
    </div>
  );
}

function SidebarLink({ label, href, icon: Icon, collapsed, exact }: { label: string; href: string; icon: typeof LayoutDashboard; collapsed: boolean; exact?: boolean }) {
  return (
    <NavLink
      to={href}
      end={exact}
      className={({ isActive }) => cn(
        "flex items-center gap-3 rounded-lg px-3 py-2.5 font-medium transition-colors",
        isActive ? "bg-primary text-primary-foreground shadow-sm" : "text-slate-600 hover:bg-slate-100 hover:text-slate-950",
        collapsed && "justify-center px-2",
      )}
    >
      <Icon className="h-4 w-4 shrink-0" />
      {!collapsed && <span className="truncate">{label}</span>}
    </NavLink>
  );
}

export function TrainingDemoPlaceholder() {
  const params = useParams();
  const title = useMemo(() => (params.module ?? "modulo").replace(/-/g, " "), [params.module]);
  return (
    <TrainingLayout>
      <section className="rounded-2xl border border-slate-200 bg-white p-10 text-center shadow-sm">
        <ShieldCheck className="mx-auto mb-4 h-10 w-10 text-slate-400" />
        <h1 className="text-2xl font-semibold tracking-tight text-slate-900">Modulo non incluso in questa demo</h1>
        <p className="mt-2 text-sm capitalize text-slate-500">{title}</p>
      </section>
    </TrainingLayout>
  );
}
