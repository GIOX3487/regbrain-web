import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { ChevronDown, History, RefreshCw, AlertTriangle } from "lucide-react";
import { GAP_ANALYSIS_ENGINE_VERSION, engineVersionLabel } from "@/lib/engine-version";

export type CheckStatus = 'covered' | 'partial' | 'missing' | 'to_verify' | 'not_applicable';

export interface AnalysisRun {
  id: string;
  run_number: number;
  engine_version: string;
  created_at: string;
  compliance_percentage: number | null;
  risk_score: number | null;
  checks: Array<{ requirement_id: string; reference?: string; status: CheckStatus }> | null;
}

const T = {
  it: {
    version: 'Versione',
    of: 'del',
    producedBy: 'motore',
    frozen: 'Gli esiti di questa analisi non cambiano piu\': riaprendola si ritrovano sempre questi.',
    outdated: 'Questa analisi e\' stata prodotta con una versione precedente del motore. Resta valida e non viene toccata: se vuoi vedere cosa cambierebbe oggi, rifalla.',
    rerun: 'Rifai l\'analisi',
    rerunning: 'Rifacimento in corso...',
    compare: (n: number) => n === 1 ? '1 obbligo cambiato rispetto alla versione precedente' : `${n} obblighi cambiati rispetto alla versione precedente`,
    noChanges: 'Nessun obbligo ha cambiato esito rispetto alla versione precedente.',
    complianceMoved: 'Conformita\'',
    statuses: { covered: 'documentato', partial: 'parziale', missing: 'mancante', to_verify: 'da verificare', not_applicable: 'non applicabile' } as Record<CheckStatus, string>,
  },
  en: {
    version: 'Version',
    of: 'of',
    producedBy: 'engine',
    frozen: 'The results of this analysis no longer change: reopening it always shows these.',
    outdated: 'This analysis was produced with an earlier version of the engine. It stays valid and untouched: to see what would change today, run it again.',
    rerun: 'Run the analysis again',
    rerunning: 'Running again...',
    compare: (n: number) => n === 1 ? '1 requirement changed from the previous version' : `${n} requirements changed from the previous version`,
    noChanges: 'No requirement changed status from the previous version.',
    complianceMoved: 'Compliance',
    statuses: { covered: 'documented', partial: 'partial', missing: 'missing', to_verify: 'to verify', not_applicable: 'not applicable' } as Record<CheckStatus, string>,
  },
  es: {
    version: 'Versión',
    of: 'del',
    producedBy: 'motor',
    frozen: 'Los resultados de este análisis ya no cambian: al reabrirlo se encuentran siempre estos.',
    outdated: 'Este análisis se produjo con una versión anterior del motor. Sigue siendo válido y no se toca: para ver qué cambiaría hoy, vuelve a ejecutarlo.',
    rerun: 'Repetir el análisis',
    rerunning: 'Repitiendo...',
    compare: (n: number) => n === 1 ? '1 requisito cambiado respecto a la versión anterior' : `${n} requisitos cambiados respecto a la versión anterior`,
    noChanges: 'Ningún requisito ha cambiado de estado respecto a la versión anterior.',
    complianceMoved: 'Cumplimiento',
    statuses: { covered: 'documentado', partial: 'parcial', missing: 'ausente', to_verify: 'por verificar', not_applicable: 'no aplicable' } as Record<CheckStatus, string>,
  },
  fr: {
    version: 'Version',
    of: 'du',
    producedBy: 'moteur',
    frozen: 'Les résultats de cette analyse ne changent plus : en la rouvrant on retrouve toujours ceux-ci.',
    outdated: 'Cette analyse a été produite avec une version antérieure du moteur. Elle reste valable et intacte : pour voir ce qui changerait aujourd\'hui, relancez-la.',
    rerun: 'Relancer l\'analyse',
    rerunning: 'Relance en cours...',
    compare: (n: number) => n === 1 ? '1 exigence modifiée par rapport à la version précédente' : `${n} exigences modifiées par rapport à la version précédente`,
    noChanges: 'Aucune exigence n\'a changé de statut par rapport à la version précédente.',
    complianceMoved: 'Conformité',
    statuses: { covered: 'documentée', partial: 'partielle', missing: 'absente', to_verify: 'à vérifier', not_applicable: 'non applicable' } as Record<CheckStatus, string>,
  },
  de: {
    version: 'Version',
    of: 'vom',
    producedBy: 'Engine',
    frozen: 'Die Ergebnisse dieser Analyse ändern sich nicht mehr: beim erneuten Öffnen erscheinen immer diese.',
    outdated: 'Diese Analyse wurde mit einer früheren Version der Engine erstellt. Sie bleibt gültig und unverändert: um zu sehen, was sich heute ändern würde, erneut ausführen.',
    rerun: 'Analyse erneut ausführen',
    rerunning: 'Wird erneut ausgeführt...',
    compare: (n: number) => n === 1 ? '1 Anforderung gegenüber der vorherigen Version geändert' : `${n} Anforderungen gegenüber der vorherigen Version geändert`,
    noChanges: 'Keine Anforderung hat sich gegenüber der vorherigen Version geändert.',
    complianceMoved: 'Konformität',
    statuses: { covered: 'dokumentiert', partial: 'teilweise', missing: 'fehlend', to_verify: 'zu prüfen', not_applicable: 'nicht anwendbar' } as Record<CheckStatus, string>,
  },
} as const;

const LOCALE: Record<string, string> = { it: 'it-IT', en: 'en-GB', es: 'es-ES', fr: 'fr-FR', de: 'de-DE' };

interface Props {
  runs: AnalysisRun[];
  language: keyof typeof T;
  onRerun: () => void;
  rerunning: boolean;
}

/**
 * Un'analisi conclusa e' un documento datato. Questo riquadro dice di quale versione si sta
 * guardando l'esito, se e' stata prodotta da un motore precedente, e cosa e' cambiato rispetto
 * alla versione prima. Il rifacimento resta un'azione dell'utente: nulla viene ricalcolato da solo.
 */
export function AnalysisVersions({ runs, language, onRerun, rerunning }: Props) {
  const t = T[language] || T.it;
  const [open, setOpen] = useState(false);
  const ultima = runs[0];
  const precedente = runs[1];

  const cambiati = useMemo(() => {
    if (!ultima?.checks || !precedente?.checks) return [];
    const prima = new Map(precedente.checks.map(c => [c.requirement_id, c]));
    return ultima.checks
      .map(c => {
        const p = prima.get(c.requirement_id);
        if (!p || p.status === c.status) return null;
        return { id: c.requirement_id, reference: c.reference || p.reference || c.requirement_id, da: p.status, a: c.status };
      })
      .filter((x): x is { id: string; reference: string; da: CheckStatus; a: CheckStatus } => x !== null)
      .sort((a, b) => a.reference.localeCompare(b.reference));
  }, [ultima, precedente]);

  if (!ultima) return null;

  const vecchia = ultima.engine_version !== GAP_ANALYSIS_ENGINE_VERSION;
  const data = new Date(ultima.created_at).toLocaleDateString(LOCALE[language] || 'it-IT');
  const deltaConformita = ultima.compliance_percentage !== null && precedente?.compliance_percentage != null
    ? Math.round(ultima.compliance_percentage) - Math.round(precedente.compliance_percentage)
    : null;

  return (
    <Card className={`mb-6 ${vecchia ? 'border-amber-500/50' : ''}`}>
      <CardContent className="p-4 space-y-3">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
          <History className="h-4 w-4 text-muted-foreground shrink-0" />
          <span className="text-sm font-medium">
            {t.version} {ultima.run_number} {t.of} {data}
          </span>
          <span className="text-xs text-muted-foreground">
            {t.producedBy} {engineVersionLabel(ultima.engine_version)}
          </span>
          {deltaConformita !== null && (
            <span className="text-xs text-muted-foreground">
              {t.complianceMoved} {Math.round(precedente!.compliance_percentage!)}%{' '}
              &rarr; {Math.round(ultima.compliance_percentage!)}%
              {deltaConformita !== 0 && ` (${deltaConformita > 0 ? '+' : ''}${deltaConformita})`}
            </span>
          )}
          <Button
            size="sm"
            variant={vecchia ? 'default' : 'outline'}
            className="ml-auto"
            onClick={onRerun}
            disabled={rerunning}
          >
            <RefreshCw className={`mr-2 h-3 w-3 ${rerunning ? 'animate-spin' : ''}`} />
            {rerunning ? t.rerunning : t.rerun}
          </Button>
        </div>

        <p className="text-xs text-muted-foreground flex items-start gap-2">
          {vecchia && <AlertTriangle className="h-3.5 w-3.5 text-amber-600 shrink-0 mt-0.5" />}
          <span>{vecchia ? t.outdated : t.frozen}</span>
        </p>

        {precedente && (
          <Collapsible open={open} onOpenChange={setOpen}>
            <CollapsibleTrigger asChild>
              <button className="flex items-center gap-1.5 text-xs font-medium hover:underline">
                <ChevronDown className={`h-3.5 w-3.5 transition-transform ${open ? 'rotate-180' : ''}`} />
                {cambiati.length === 0 ? t.noChanges : t.compare(cambiati.length)}
              </button>
            </CollapsibleTrigger>
            <CollapsibleContent className="pt-2">
              {cambiati.length > 0 && (
                <ul className="space-y-1 text-xs">
                  {cambiati.map(c => (
                    <li key={c.id} className="flex flex-wrap gap-x-2 border-l-2 border-muted pl-2 py-0.5">
                      <span className="font-medium">{c.reference}</span>
                      <span className="text-muted-foreground">
                        {t.statuses[c.da]} &rarr; {t.statuses[c.a]}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </CollapsibleContent>
          </Collapsible>
        )}
      </CardContent>
    </Card>
  );
}
