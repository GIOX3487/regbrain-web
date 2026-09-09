import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { 
  HelpCircle, 
  ChevronDown, 
  ChevronUp,
  AlertTriangle,
  Scale,
  Clock,
  Euro
} from "lucide-react";

interface RiskScoreExplanationProps {
  overallRiskScore: number;
  gaps: Array<{
    risk_level: string;
    risk_score: number;
    remediation_effort: string;
    potential_fine_eur: number;
  }>;
  language?: 'it' | 'en' | 'es' | 'fr' | 'de';
}

const translations = {
  it: {
    title: "Come viene calcolato il punteggio di rischio?",
    subtitle: "Metodologia deterministica basata su standard ISO 27005 e NIST RMF",
    overallScore: "Punteggio complessivo",
    methodology: "Metodologia di calcolo",
    methodologyDesc: "Il punteggio di rischio è calcolato attraverso una formula deterministica che considera:",
    factor1Title: "Livello di rischio del gap",
    factor1Desc: "Ogni gap viene classificato in 4 livelli: critico (peso 4), alto (peso 3), medio (peso 2), basso (peso 1)",
    factor2Title: "Sforzo di remediation",
    factor2Desc: "Lo sforzo richiesto influenza il rischio: alto (×1.5), medio (×1.2), basso (×1.0)",
    factor3Title: "Impatto economico",
    factor3Desc: "Le sanzioni potenziali pesano proporzionalmente sul punteggio finale",
    formula: "Formula",
    formulaDesc: "Risk Score = Σ(livello_gap × moltiplicatore_effort × peso_sanzione) / numero_gap × normalizzazione_100",
    breakdown: "Dettaglio per livello",
    critical: "Critici",
    high: "Alti",
    medium: "Medi",
    low: "Bassi",
    interpretation: "Interpretazione",
    interpret0_30: "0-30: Rischio basso - Conformità sostanziale raggiunta",
    interpret31_60: "31-60: Rischio moderato - Interventi mirati necessari",
    interpret61_80: "61-80: Rischio alto - Azioni correttive urgenti",
    interpret81_100: "81-100: Rischio critico - Intervento immediato richiesto",
    showDetails: "Mostra dettagli metodologia",
    hideDetails: "Nascondi dettagli"
  },
  en: {
    title: "How is the risk score calculated?",
    subtitle: "Deterministic methodology based on ISO 27005 and NIST RMF standards",
    overallScore: "Overall score",
    methodology: "Calculation methodology",
    methodologyDesc: "The risk score is calculated through a deterministic formula considering:",
    factor1Title: "Gap risk level",
    factor1Desc: "Each gap is classified into 4 levels: critical (weight 4), high (weight 3), medium (weight 2), low (weight 1)",
    factor2Title: "Remediation effort",
    factor2Desc: "Required effort influences risk: high (×1.5), medium (×1.2), low (×1.0)",
    factor3Title: "Economic impact",
    factor3Desc: "Potential sanctions proportionally weight the final score",
    formula: "Formula",
    formulaDesc: "Risk Score = Σ(gap_level × effort_multiplier × sanction_weight) / gap_count × normalization_100",
    breakdown: "Breakdown by level",
    critical: "Critical",
    high: "High",
    medium: "Medium",
    low: "Low",
    interpretation: "Interpretation",
    interpret0_30: "0-30: Low risk - Substantial compliance achieved",
    interpret31_60: "31-60: Moderate risk - Targeted interventions needed",
    interpret61_80: "61-80: High risk - Urgent corrective actions",
    interpret81_100: "81-100: Critical risk - Immediate intervention required",
    showDetails: "Show methodology details",
    hideDetails: "Hide details"
  },
  es: {
    title: "¿Cómo se calcula la puntuación de riesgo?",
    subtitle: "Metodología determinista basada en estándares ISO 27005 y NIST RMF",
    overallScore: "Puntuación general",
    methodology: "Metodología de cálculo",
    methodologyDesc: "La puntuación de riesgo se calcula mediante una fórmula determinista que considera:",
    factor1Title: "Nivel de riesgo de la brecha",
    factor1Desc: "Cada brecha se clasifica en 4 niveles: crítico (peso 4), alto (peso 3), medio (peso 2), bajo (peso 1)",
    factor2Title: "Esfuerzo de remediación",
    factor2Desc: "El esfuerzo requerido influye en el riesgo: alto (×1.5), medio (×1.2), bajo (×1.0)",
    factor3Title: "Impacto económico",
    factor3Desc: "Las sanciones potenciales pesan proporcionalmente en la puntuación final",
    formula: "Fórmula",
    formulaDesc: "Risk Score = Σ(nivel_brecha × multiplicador_esfuerzo × peso_sanción) / número_brechas × normalización_100",
    breakdown: "Desglose por nivel",
    critical: "Críticos",
    high: "Altos",
    medium: "Medios",
    low: "Bajos",
    interpretation: "Interpretación",
    interpret0_30: "0-30: Riesgo bajo - Cumplimiento sustancial alcanzado",
    interpret31_60: "31-60: Riesgo moderado - Intervenciones específicas necesarias",
    interpret61_80: "61-80: Riesgo alto - Acciones correctivas urgentes",
    interpret81_100: "81-100: Riesgo crítico - Intervención inmediata requerida",
    showDetails: "Mostrar detalles de metodología",
    hideDetails: "Ocultar detalles"
  },
  fr: {
    title: "Comment le score de risque est-il calculé?",
    subtitle: "Méthodologie déterministe basée sur les normes ISO 27005 et NIST RMF",
    overallScore: "Score global",
    methodology: "Méthodologie de calcul",
    methodologyDesc: "Le score de risque est calculé par une formule déterministe considérant:",
    factor1Title: "Niveau de risque de l'écart",
    factor1Desc: "Chaque écart est classé en 4 niveaux: critique (poids 4), élevé (poids 3), moyen (poids 2), faible (poids 1)",
    factor2Title: "Effort de remédiation",
    factor2Desc: "L'effort requis influence le risque: élevé (×1.5), moyen (×1.2), faible (×1.0)",
    factor3Title: "Impact économique",
    factor3Desc: "Les sanctions potentielles pèsent proportionnellement sur le score final",
    formula: "Formule",
    formulaDesc: "Risk Score = Σ(niveau_écart × multiplicateur_effort × poids_sanction) / nombre_écarts × normalisation_100",
    breakdown: "Répartition par niveau",
    critical: "Critiques",
    high: "Élevés",
    medium: "Moyens",
    low: "Faibles",
    interpretation: "Interprétation",
    interpret0_30: "0-30: Risque faible - Conformité substantielle atteinte",
    interpret31_60: "31-60: Risque modéré - Interventions ciblées nécessaires",
    interpret61_80: "61-80: Risque élevé - Actions correctives urgentes",
    interpret81_100: "81-100: Risque critique - Intervention immédiate requise",
    showDetails: "Afficher les détails de la méthodologie",
    hideDetails: "Masquer les détails"
  },
  de: {
    title: "Wie wird der Risikoscore berechnet?",
    subtitle: "Deterministische Methodik basierend auf ISO 27005 und NIST RMF Standards",
    overallScore: "Gesamtpunktzahl",
    methodology: "Berechnungsmethodik",
    methodologyDesc: "Der Risikoscore wird durch eine deterministische Formel berechnet, die berücksichtigt:",
    factor1Title: "Risikoniveau der Lücke",
    factor1Desc: "Jede Lücke wird in 4 Stufen eingeteilt: kritisch (Gewicht 4), hoch (Gewicht 3), mittel (Gewicht 2), niedrig (Gewicht 1)",
    factor2Title: "Sanierungsaufwand",
    factor2Desc: "Der erforderliche Aufwand beeinflusst das Risiko: hoch (×1.5), mittel (×1.2), niedrig (×1.0)",
    factor3Title: "Wirtschaftliche Auswirkung",
    factor3Desc: "Potenzielle Sanktionen gewichten proportional den Endwert",
    formula: "Formel",
    formulaDesc: "Risk Score = Σ(Lücken_niveau × Aufwand_multiplikator × Sanktion_gewicht) / Lücken_anzahl × Normalisierung_100",
    breakdown: "Aufschlüsselung nach Niveau",
    critical: "Kritisch",
    high: "Hoch",
    medium: "Mittel",
    low: "Niedrig",
    interpretation: "Interpretation",
    interpret0_30: "0-30: Niedriges Risiko - Wesentliche Compliance erreicht",
    interpret31_60: "31-60: Moderates Risiko - Gezielte Maßnahmen erforderlich",
    interpret61_80: "61-80: Hohes Risiko - Dringende Korrekturmaßnahmen",
    interpret81_100: "81-100: Kritisches Risiko - Sofortiges Eingreifen erforderlich",
    showDetails: "Methodikdetails anzeigen",
    hideDetails: "Details ausblenden"
  }
};

export function RiskScoreExplanation({ 
  overallRiskScore, 
  gaps,
  language = 'it' 
}: RiskScoreExplanationProps) {
  const [isOpen, setIsOpen] = useState(false);
  const t = translations[language] || translations.it;

  const criticalCount = gaps.filter(g => g.risk_level === 'critical').length;
  const highCount = gaps.filter(g => g.risk_level === 'high').length;
  const mediumCount = gaps.filter(g => g.risk_level === 'medium').length;
  const lowCount = gaps.filter(g => g.risk_level === 'low').length;

  const getRiskColor = (score: number) => {
    if (score <= 30) return 'text-green-600';
    if (score <= 60) return 'text-yellow-600';
    if (score <= 80) return 'text-orange-600';
    return 'text-destructive';
  };

  const getRiskBgColor = (score: number) => {
    if (score <= 30) return 'bg-green-100 border-green-200';
    if (score <= 60) return 'bg-yellow-100 border-yellow-200';
    if (score <= 80) return 'bg-orange-100 border-orange-200';
    return 'bg-red-100 border-red-200';
  };

  return (
    <Card className="border-dashed">
      <Collapsible open={isOpen} onOpenChange={setIsOpen}>
        <CollapsibleTrigger className="w-full">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-muted rounded-lg">
                  <HelpCircle className="h-5 w-5 text-primary" />
                </div>
                <div className="text-left">
                  <CardTitle className="text-base">{t.title}</CardTitle>
                  <CardDescription className="text-xs mt-1">
                    {t.subtitle}
                  </CardDescription>
                </div>
              </div>
              <div className="flex items-center gap-4">
                <div className={`px-4 py-2 rounded-lg border ${getRiskBgColor(overallRiskScore)}`}>
                  <span className={`text-2xl font-bold ${getRiskColor(overallRiskScore)}`}>
                    {overallRiskScore.toFixed(0)}
                  </span>
                  <span className="text-sm text-muted-foreground">/100</span>
                </div>
                {isOpen ? (
                  <ChevronUp className="h-5 w-5 text-muted-foreground" />
                ) : (
                  <ChevronDown className="h-5 w-5 text-muted-foreground" />
                )}
              </div>
            </div>
          </CardHeader>
        </CollapsibleTrigger>

        <CollapsibleContent>
          <CardContent className="pt-0 space-y-6">
            {/* Methodology */}
            <div className="space-y-4">
              <h4 className="font-semibold text-sm flex items-center gap-2">
                <Scale className="h-4 w-4 text-primary" />
                {t.methodology}
              </h4>
              <p className="text-sm text-muted-foreground">{t.methodologyDesc}</p>
              
              <div className="grid gap-3">
                <div className="flex items-start gap-3 p-3 bg-muted/50 rounded-lg">
                  <AlertTriangle className="h-4 w-4 text-destructive mt-0.5 shrink-0" />
                  <div>
                    <p className="text-sm font-medium">{t.factor1Title}</p>
                    <p className="text-xs text-muted-foreground">{t.factor1Desc}</p>
                  </div>
                </div>
                <div className="flex items-start gap-3 p-3 bg-muted/50 rounded-lg">
                  <Clock className="h-4 w-4 text-orange-500 mt-0.5 shrink-0" />
                  <div>
                    <p className="text-sm font-medium">{t.factor2Title}</p>
                    <p className="text-xs text-muted-foreground">{t.factor2Desc}</p>
                  </div>
                </div>
                <div className="flex items-start gap-3 p-3 bg-muted/50 rounded-lg">
                  <Euro className="h-4 w-4 text-yellow-600 mt-0.5 shrink-0" />
                  <div>
                    <p className="text-sm font-medium">{t.factor3Title}</p>
                    <p className="text-xs text-muted-foreground">{t.factor3Desc}</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Formula */}
            <div className="p-4 bg-slate-900 text-slate-100 rounded-lg">
              <p className="text-xs text-slate-400 mb-2">{t.formula}</p>
              <code className="text-sm font-mono break-all">
                {t.formulaDesc}
              </code>
            </div>

            {/* Breakdown */}
            <div className="space-y-3">
              <h4 className="font-semibold text-sm">{t.breakdown}</h4>
              <div className="grid grid-cols-4 gap-2">
                <div className="text-center p-3 rounded-lg bg-red-50 border border-red-200">
                  <div className="text-2xl font-bold text-red-600">{criticalCount}</div>
                  <div className="text-xs text-red-700">{t.critical}</div>
                  <div className="text-xs text-muted-foreground mt-1">×4</div>
                </div>
                <div className="text-center p-3 rounded-lg bg-orange-50 border border-orange-200">
                  <div className="text-2xl font-bold text-orange-600">{highCount}</div>
                  <div className="text-xs text-orange-700">{t.high}</div>
                  <div className="text-xs text-muted-foreground mt-1">×3</div>
                </div>
                <div className="text-center p-3 rounded-lg bg-yellow-50 border border-yellow-200">
                  <div className="text-2xl font-bold text-yellow-600">{mediumCount}</div>
                  <div className="text-xs text-yellow-700">{t.medium}</div>
                  <div className="text-xs text-muted-foreground mt-1">×2</div>
                </div>
                <div className="text-center p-3 rounded-lg bg-green-50 border border-green-200">
                  <div className="text-2xl font-bold text-green-600">{lowCount}</div>
                  <div className="text-xs text-green-700">{t.low}</div>
                  <div className="text-xs text-muted-foreground mt-1">×1</div>
                </div>
              </div>
            </div>

            {/* Interpretation */}
            <div className="space-y-3">
              <h4 className="font-semibold text-sm">{t.interpretation}</h4>
              <div className="space-y-2 text-sm">
                <div className={`flex items-center gap-2 p-2 rounded ${overallRiskScore <= 30 ? 'bg-green-50 border border-green-200' : ''}`}>
                  <div className="w-3 h-3 rounded-full bg-green-500" />
                  <span>{t.interpret0_30}</span>
                </div>
                <div className={`flex items-center gap-2 p-2 rounded ${overallRiskScore > 30 && overallRiskScore <= 60 ? 'bg-yellow-50 border border-yellow-200' : ''}`}>
                  <div className="w-3 h-3 rounded-full bg-yellow-500" />
                  <span>{t.interpret31_60}</span>
                </div>
                <div className={`flex items-center gap-2 p-2 rounded ${overallRiskScore > 60 && overallRiskScore <= 80 ? 'bg-orange-50 border border-orange-200' : ''}`}>
                  <div className="w-3 h-3 rounded-full bg-orange-500" />
                  <span>{t.interpret61_80}</span>
                </div>
                <div className={`flex items-center gap-2 p-2 rounded ${overallRiskScore > 80 ? 'bg-red-50 border border-red-200' : ''}`}>
                  <div className="w-3 h-3 rounded-full bg-red-500" />
                  <span>{t.interpret81_100}</span>
                </div>
              </div>
            </div>
          </CardContent>
        </CollapsibleContent>
      </Collapsible>
    </Card>
  );
}
