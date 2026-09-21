import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { ChevronDown, History, RefreshCw, AlertTriangle } from "lucide-react";
import { GAP_ANALYSIS_ENGINE_VERSION } from "@/lib/engine-version";

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
    outdatedTitle: 'Analisi eseguita con una versione precedente del sistema',
    outdatedBody: 'Gli esiti restano quelli consegnati. Per vedere il risultato con la versione attuale puoi ripetere l\'analisi sugli stessi documenti: la versione precedente resta consultabile.',
    rerun: 'Ripeti l\'analisi',
    rerunning: 'Analisi in corso...',
    updated: (quando: string, prima: string) => `Analisi aggiornata il ${quando}, rispetto a quella del ${prima}`,
    changed: (n: number) => n === 1 ? '1 obbligo ha cambiato esito' : `${n} obblighi hanno cambiato esito`,
    noChanges: 'Nessun obbligo ha cambiato esito',
    compliance: 'Conformità',
    statuses: { covered: 'documentato', partial: 'parziale', missing: 'mancante', to_verify: 'da verificare', not_applicable: 'non applicabile' } as Record<CheckStatus, string>,
  },
  en: {
    outdatedTitle: 'Analysis run with an earlier version of the system',
    outdatedBody: 'The results stay as delivered. To see the outcome with the current version you can repeat the analysis on the same documents: the earlier version remains available.',
    rerun: 'Repeat the analysis',
    rerunning: 'Analysis in progress...',
    updated: (quando: string, prima: string) => `Analysis updated on ${quando}, compared with the one of ${prima}`,
    changed: (n: number) => n === 1 ? '1 requirement changed outcome' : `${n} requirements changed outcome`,
    noChanges: 'No requirement changed outcome',
    compliance: 'Compliance',
    statuses: { covered: 'documented', partial: 'partial', missing: 'missing', to_verify: 'to verify', not_applicable: 'not applicable' } as Record<CheckStatus, string>,
  },
  es: {
    outdatedTitle: 'Análisis realizado con una versión anterior del sistema',
    outdatedBody: 'Los resultados siguen siendo los entregados. Para ver el resultado con la versión actual puedes repetir el análisis sobre los mismos documentos: la versión anterior sigue disponible.',
    rerun: 'Repetir el análisis',
    rerunning: 'Análisis en curso...',
    updated: (quando: string, prima: string) => `Análisis actualizado el ${quando}, respecto al del ${prima}`,
    changed: (n: number) => n === 1 ? '1 requisito cambió de resultado' : `${n} requisitos cambiaron de resultado`,
    noChanges: 'Ningún requisito cambió de resultado',
    compliance: 'Cumplimiento',
    statuses: { covered: 'documentado', partial: 'parcial', missing: 'ausente', to_verify: 'por verificar', not_applicable: 'no aplicable' } as Record<CheckStatus, string>,
  },
  fr: {
    outdatedTitle: 'Analyse réalisée avec une version antérieure du système',
    outdatedBody: 'Les résultats restent ceux qui ont été livrés. Pour voir le résultat avec la version actuelle, vous pouvez répéter l\'analyse sur les mêmes documents : la version antérieure reste consultable.',
    rerun: 'Répéter l\'analyse',
    rerunning: 'Analyse en cours...',
    updated: (quando: string, prima: string) => `Analyse mise à jour le ${quando}, par rapport à celle du ${prima}`,
    changed: (n: number) => n === 1 ? '1 exigence a changé de résultat' : `${n} exigences ont changé de résultat`,
    noChanges: 'Aucune exigence n\'a changé de résultat',
    compliance: 'Conformité',
    statuses: { covered: 'documentée', partial: 'partielle', missing: 'absente', to_verify: 'à vérifier', not_applicable: 'non applicable' } as Record<CheckStatus, string>,
  },
  de: {
    outdatedTitle: 'Analyse mit einer früheren Version des Systems durchgeführt',
    outdatedBody: 'Die Ergebnisse bleiben wie ausgeliefert. Um das Ergebnis mit der aktuellen Version zu sehen, können Sie die Analyse mit denselben Dokumenten wiederholen: die frühere Version bleibt einsehbar.',
    rerun: 'Analyse wiederholen',
    rerunning: 'Analyse läuft...',
    updated: (quando: string, prima: string) => `Analyse aktualisiert am ${quando}, im Vergleich zu der vom ${prima}`,
    changed: (n: number) => n === 1 ? '1 Anforderung hat ihr Ergebnis geändert' : `${n} Anforderungen haben ihr Ergebnis geändert`,
    noChanges: 'Keine Anforderung hat ihr Ergebnis geändert',
    compliance: 'Konformität',
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
 * Compare solo quando ha qualcosa da dire al lettore del referto:
 *  - l'analisi e' stata prodotta da una versione precedente del sistema, e allora si offre di
 *    ripeterla senza farlo da sola;
 *  - esiste una versione precedente dell'analisi, e allora si mostra cosa e' cambiato.
 * Nel caso comune, una sola analisi fatta con il sistema attuale, non mostra nulla: numero di
 * versione e sigla del motore sono dati interni che a un DPO non servono.
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
  if (!vecchia && !precedente) return null;

  const fmt = (d: string) => new Date(d).toLocaleDateString(LOCALE[language] || 'it-IT');
  const deltaConformita = precedente && ultima.compliance_percentage !== null && precedente.compliance_percentage !== null
    ? Math.round(ultima.compliance_percentage) - Math.round(precedente.compliance_percentage)
    : null;

  return (
    <Card className={`mb-6 ${vecchia ? 'border-amber-500/50' : ''}`}>
      <CardContent className="p-4 space-y-3">
        {vecchia && (
          <div className="flex flex-wrap items-start gap-3">
            <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
            <div className="flex-1 min-w-[16rem] space-y-1">
              <p className="text-sm font-medium">{t.outdatedTitle}</p>
              <p className="text-xs text-muted-foreground">{t.outdatedBody}</p>
            </div>
            <Button size="sm" onClick={onRerun} disabled={rerunning}>
              <RefreshCw className={`mr-2 h-3 w-3 ${rerunning ? 'animate-spin' : ''}`} />
              {rerunning ? t.rerunning : t.rerun}
            </Button>
          </div>
        )}

        {precedente && (
          <Collapsible open={open} onOpenChange={setOpen}>
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
              <History className="h-4 w-4 text-muted-foreground shrink-0" />
              <span className="text-sm">{t.updated(fmt(ultima.created_at), fmt(precedente.created_at))}</span>
              {deltaConformita !== null && deltaConformita !== 0 && (
                <span className="text-xs text-muted-foreground">
                  {t.compliance} {Math.round(precedente.compliance_percentage!)}% &rarr; {Math.round(ultima.compliance_percentage!)}%
                </span>
              )}
            </div>
            <CollapsibleTrigger asChild>
              <button className="mt-1 ml-7 flex items-center gap-1.5 text-xs font-medium hover:underline">
                {cambiati.length > 0 && (
                  <ChevronDown className={`h-3.5 w-3.5 transition-transform ${open ? 'rotate-180' : ''}`} />
                )}
                {cambiati.length === 0 ? t.noChanges : t.changed(cambiati.length)}
              </button>
            </CollapsibleTrigger>
            {cambiati.length > 0 && (
              <CollapsibleContent className="pt-2 ml-7">
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
              </CollapsibleContent>
            )}
          </Collapsible>
        )}
      </CardContent>
    </Card>
  );
}
