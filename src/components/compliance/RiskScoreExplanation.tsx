import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { HelpCircle, ChevronDown, ChevronUp, FileSearch, Scale, Layers, Info } from "lucide-react";

export type RiskProfile = 'high' | 'medium' | 'low' | 'none';

interface RiskScoreExplanationProps {
  gaps: Array<{ risk_level: string; coverage_status?: string | null }>;
  checks?: Array<{ status: string }> | null;
  language?: 'it' | 'en' | 'es' | 'fr' | 'de';
}

// Colori del profilo di rischio, condivisi con la pagina della valutazione
export const RISK_STYLE: Record<RiskProfile, { dot: string; badge: string; text: string; panel: string }> = {
  high: { dot: 'bg-red-500', badge: 'bg-red-100 text-red-800 border-red-200 dark:bg-red-950/40 dark:text-red-200 dark:border-red-900', text: 'text-red-600 dark:text-red-400', panel: 'bg-red-50 border-red-200 dark:bg-red-950/30 dark:border-red-900' },
  medium: { dot: 'bg-orange-500', badge: 'bg-orange-100 text-orange-800 border-orange-200 dark:bg-orange-950/40 dark:text-orange-200 dark:border-orange-900', text: 'text-orange-600 dark:text-orange-400', panel: 'bg-orange-50 border-orange-200 dark:bg-orange-950/30 dark:border-orange-900' },
  low: { dot: 'bg-yellow-400', badge: 'bg-yellow-100 text-yellow-800 border-yellow-200 dark:bg-yellow-950/40 dark:text-yellow-200 dark:border-yellow-900', text: 'text-yellow-700 dark:text-yellow-400', panel: 'bg-yellow-50 border-yellow-200 dark:bg-yellow-950/30 dark:border-yellow-900' },
  none: { dot: 'bg-green-500', badge: 'bg-green-100 text-green-800 border-green-200 dark:bg-green-950/40 dark:text-green-200 dark:border-green-900', text: 'text-green-700 dark:text-green-400', panel: 'bg-green-50 border-green-200 dark:bg-green-950/30 dark:border-green-900' },
};

/** Normalizza i livelli storici (critical) sui tre colori del profilo. */
export function riskProfileOf(level?: string | null): Exclude<RiskProfile, 'none'> {
  const l = (level || '').toLowerCase();
  if (l === 'critical' || l === 'high') return 'high';
  if (l === 'medium') return 'medium';
  return 'low';
}

/** Profilo complessivo: il gap più grave determina il colore. */
export function overallRiskProfile(gaps: Array<{ risk_level: string }>): RiskProfile {
  if (gaps.some(g => riskProfileOf(g.risk_level) === 'high')) return 'high';
  if (gaps.some(g => riskProfileOf(g.risk_level) === 'medium')) return 'medium';
  if (gaps.length > 0) return 'low';
  return 'none';
}

const translations = {
  it: {
    title: "Come leggere il profilo di rischio",
    subtitle: "Colori al posto dei punteggi: cosa significano e come vengono assegnati",
    profileLabel: { high: 'Rischio alto', medium: 'Rischio medio', low: 'Rischio basso', none: 'Nessun rischio rilevato' },
    legendTitle: "Legenda",
    legend: {
      high: "Obbligo grave (principi, diritti, sicurezza, categorie particolari, violazioni) non documentato, oppure documentato solo in parte. Da affrontare per primo.",
      medium: "Obbligo rilevante documentato in modo incompleto, oppure obbligo di media gravità del tutto assente.",
      low: "Aspetto formale o di completamento: la sostanza c'è, manca un elemento accessorio.",
      none: "Requisito documentato: nei documenti caricati ci sono evidenze testuali che lo soddisfano.",
    },
    howTitle: "Come viene assegnato",
    step1Title: "Verifica documentale requisito per requisito",
    step1Desc: "Ogni obbligo della normativa selezionata viene confrontato con gli estratti pertinenti dei documenti caricati. L'esito è: documentato, parziale (esiste ma manca qualcosa), mancante, oppure da verificare quando l'obbligo vale solo in certe situazioni e dai documenti non si capisce se ricorrono.",
    step2Title: "Gravità dell'obbligo",
    step2Desc: "Deriva dalla normativa stessa: natura dell'obbligo e fascia sanzionatoria (per il GDPR, ad esempio, principi e diritti degli interessati stanno nella fascia più alta dell'art. 83, gli obblighi organizzativi in quella inferiore).",
    step3Title: "Combinazione",
    step3Desc: "Il colore nasce da gravità e stato della documentazione: un obbligo grave mancante o parziale è rosso; uno rilevante ma parziale è arancione; un elemento accessorio è giallo. Il profilo complessivo è quello del gap più grave.",
    limitsTitle: "Cosa non misura",
    limitsDesc: "L'analisi valuta ciò che è scritto nei documenti caricati, non se le misure sono davvero applicate. Non stima sanzioni in euro: gli importi dipendono da fattori che nessun documento può anticipare. Non sostituisce il parere di un legale o del DPO.",
    countsTitle: "Requisiti verificati",
    covered: "documentati",
    partial: "parziali",
    missing: "mancanti",
    toVerify: "da verificare",
    notApplicable: "non applicabili",
    showDetails: "Mostra come funziona",
    hideDetails: "Nascondi",
  },
  en: {
    title: "How to read the risk profile",
    subtitle: "Colours instead of scores: what they mean and how they are assigned",
    profileLabel: { high: 'High risk', medium: 'Medium risk', low: 'Low risk', none: 'No risk detected' },
    legendTitle: "Legend",
    legend: {
      high: "Serious obligation (principles, rights, security, special categories, breaches) not documented, or only partly documented. Address first.",
      medium: "Relevant obligation documented incompletely, or medium-severity obligation entirely absent.",
      low: "Formal or completion aspect: the substance is there, an ancillary element is missing.",
      none: "Documented requirement: the uploaded documents contain textual evidence that satisfies it.",
    },
    howTitle: "How it is assigned",
    step1Title: "Document check, requirement by requirement",
    step1Desc: "Each obligation of the selected regulation is compared with the relevant excerpts of the uploaded documents. The outcome is: documented, partial (exists but something is missing), missing, or to verify when the obligation applies only in certain situations and the documents do not show whether they occur.",
    step2Title: "Severity of the obligation",
    step2Desc: "It comes from the regulation itself: nature of the obligation and sanction tier (under the GDPR, for example, principles and data subject rights sit in the higher tier of Art. 83, organisational duties in the lower one).",
    step3Title: "Combination",
    step3Desc: "The colour results from severity and documentation status: a serious obligation missing or partial is red; a relevant but partial one is orange; an ancillary element is yellow. The overall profile is that of the most serious gap.",
    limitsTitle: "What it does not measure",
    limitsDesc: "The analysis assesses what is written in the uploaded documents, not whether measures are actually applied. It does not estimate fines in euro: amounts depend on factors no document can anticipate. It does not replace legal or DPO advice.",
    countsTitle: "Requirements checked",
    covered: "documented",
    partial: "partial",
    missing: "missing",
    toVerify: "to verify",
    notApplicable: "not applicable",
    showDetails: "Show how it works",
    hideDetails: "Hide",
  },
  es: {
    title: "Cómo leer el perfil de riesgo",
    subtitle: "Colores en lugar de puntuaciones: qué significan y cómo se asignan",
    profileLabel: { high: 'Riesgo alto', medium: 'Riesgo medio', low: 'Riesgo bajo', none: 'Sin riesgo detectado' },
    legendTitle: "Leyenda",
    legend: {
      high: "Obligación grave (principios, derechos, seguridad, categorías especiales, brechas) no documentada o documentada solo en parte. Atender primero.",
      medium: "Obligación relevante documentada de forma incompleta, u obligación de gravedad media totalmente ausente.",
      low: "Aspecto formal o de completado: la sustancia existe, falta un elemento accesorio.",
      none: "Requisito documentado: los documentos cargados contienen evidencias textuales que lo satisfacen.",
    },
    howTitle: "Cómo se asigna",
    step1Title: "Verificación documental requisito por requisito",
    step1Desc: "Cada obligación de la normativa seleccionada se compara con los extractos pertinentes de los documentos cargados. El resultado es: documentado, parcial, ausente, o por verificar cuando la obligación solo aplica en ciertas situaciones.",
    step2Title: "Gravedad de la obligación",
    step2Desc: "Deriva de la propia normativa: naturaleza de la obligación y tramo sancionador.",
    step3Title: "Combinación",
    step3Desc: "El color nace de gravedad y estado de la documentación: una obligación grave ausente o parcial es rojo; una relevante pero parcial es naranja; un elemento accesorio es amarillo. El perfil global es el de la brecha más grave.",
    limitsTitle: "Qué no mide",
    limitsDesc: "El análisis evalúa lo escrito en los documentos cargados, no si las medidas se aplican realmente. No estima sanciones en euros. No sustituye el consejo de un abogado o del DPO.",
    countsTitle: "Requisitos verificados",
    covered: "documentados",
    partial: "parciales",
    missing: "ausentes",
    toVerify: "por verificar",
    notApplicable: "no aplicables",
    showDetails: "Mostrar cómo funciona",
    hideDetails: "Ocultar",
  },
  fr: {
    title: "Comment lire le profil de risque",
    subtitle: "Des couleurs à la place des scores : ce qu'elles signifient et comment elles sont attribuées",
    profileLabel: { high: 'Risque élevé', medium: 'Risque moyen', low: 'Risque faible', none: 'Aucun risque détecté' },
    legendTitle: "Légende",
    legend: {
      high: "Obligation grave (principes, droits, sécurité, catégories particulières, violations) non documentée ou seulement en partie. À traiter en premier.",
      medium: "Obligation importante documentée de façon incomplète, ou obligation de gravité moyenne totalement absente.",
      low: "Aspect formel ou de complément : la substance existe, un élément accessoire manque.",
      none: "Exigence documentée : les documents chargés contiennent des preuves textuelles qui la satisfont.",
    },
    howTitle: "Comment il est attribué",
    step1Title: "Vérification documentaire exigence par exigence",
    step1Desc: "Chaque obligation de la réglementation choisie est comparée aux extraits pertinents des documents chargés. Le résultat est : documentée, partielle, manquante, ou à vérifier lorsque l'obligation ne s'applique que dans certaines situations.",
    step2Title: "Gravité de l'obligation",
    step2Desc: "Elle découle de la réglementation elle-même : nature de l'obligation et palier de sanction.",
    step3Title: "Combinaison",
    step3Desc: "La couleur résulte de la gravité et de l'état de la documentation : une obligation grave manquante ou partielle est rouge ; une obligation importante mais partielle est orange ; un élément accessoire est jaune. Le profil global est celui de l'écart le plus grave.",
    limitsTitle: "Ce qu'il ne mesure pas",
    limitsDesc: "L'analyse évalue ce qui est écrit dans les documents chargés, pas si les mesures sont réellement appliquées. Elle n'estime pas les sanctions en euros. Elle ne remplace pas l'avis d'un juriste ou du DPO.",
    countsTitle: "Exigences vérifiées",
    covered: "documentées",
    partial: "partielles",
    missing: "manquantes",
    toVerify: "à vérifier",
    notApplicable: "non applicables",
    showDetails: "Voir comment ça marche",
    hideDetails: "Masquer",
  },
  de: {
    title: "So lesen Sie das Risikoprofil",
    subtitle: "Farben statt Punktzahlen: was sie bedeuten und wie sie vergeben werden",
    profileLabel: { high: 'Hohes Risiko', medium: 'Mittleres Risiko', low: 'Geringes Risiko', none: 'Kein Risiko festgestellt' },
    legendTitle: "Legende",
    legend: {
      high: "Schwerwiegende Pflicht (Grundsätze, Rechte, Sicherheit, besondere Kategorien, Verletzungen) nicht oder nur teilweise dokumentiert. Zuerst angehen.",
      medium: "Relevante Pflicht unvollständig dokumentiert oder Pflicht mittlerer Schwere völlig fehlend.",
      low: "Formaler oder ergänzender Aspekt: die Substanz ist da, ein Nebenelement fehlt.",
      none: "Dokumentierte Anforderung: die hochgeladenen Dokumente enthalten Textbelege, die sie erfüllen.",
    },
    howTitle: "So wird es vergeben",
    step1Title: "Dokumentenprüfung Anforderung für Anforderung",
    step1Desc: "Jede Pflicht der gewählten Vorschrift wird mit den relevanten Auszügen der hochgeladenen Dokumente verglichen. Ergebnis: dokumentiert, teilweise, fehlend oder zu prüfen, wenn die Pflicht nur in bestimmten Situationen gilt.",
    step2Title: "Schwere der Pflicht",
    step2Desc: "Sie ergibt sich aus der Vorschrift selbst: Art der Pflicht und Bußgeldstufe.",
    step3Title: "Kombination",
    step3Desc: "Die Farbe ergibt sich aus Schwere und Dokumentationsstand: eine schwere Pflicht, die fehlt oder teilweise ist, ist rot; eine relevante, aber teilweise ist orange; ein Nebenelement ist gelb. Das Gesamtprofil entspricht der schwersten Lücke.",
    limitsTitle: "Was nicht gemessen wird",
    limitsDesc: "Die Analyse bewertet, was in den hochgeladenen Dokumenten steht, nicht ob Maßnahmen tatsächlich umgesetzt sind. Sie schätzt keine Bußgelder in Euro. Sie ersetzt keine Rechts- oder DSB-Beratung.",
    countsTitle: "Geprüfte Anforderungen",
    covered: "dokumentiert",
    partial: "teilweise",
    missing: "fehlend",
    toVerify: "zu prüfen",
    notApplicable: "nicht anwendbar",
    showDetails: "Funktionsweise anzeigen",
    hideDetails: "Ausblenden",
  },
};

export function RiskScoreExplanation({ gaps, checks, language = 'it' }: RiskScoreExplanationProps) {
  const [isOpen, setIsOpen] = useState(false);
  const t = translations[language] || translations.it;
  const profile = overallRiskProfile(gaps);
  const style = RISK_STYLE[profile];

  const count = (status: string) => (checks || []).filter(c => c.status === status).length;
  const hasChecks = Array.isArray(checks) && checks.length > 0;

  return (
    <Card className="border-dashed">
      <Collapsible open={isOpen} onOpenChange={setIsOpen}>
        <CollapsibleTrigger className="w-full text-left">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-3 min-w-0">
                <div className="p-2 bg-muted rounded-lg shrink-0">
                  <HelpCircle className="h-5 w-5 text-primary" />
                </div>
                <div className="min-w-0">
                  <CardTitle className="text-base">{t.title}</CardTitle>
                  <CardDescription className="text-xs mt-1">{t.subtitle}</CardDescription>
                </div>
              </div>
              <div className="flex items-center gap-3 shrink-0">
                <span className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full border text-sm font-medium ${style.badge}`}>
                  <span className={`w-2.5 h-2.5 rounded-full ${style.dot}`} />
                  {t.profileLabel[profile]}
                </span>
                {isOpen ? <ChevronUp className="h-5 w-5 text-muted-foreground" /> : <ChevronDown className="h-5 w-5 text-muted-foreground" />}
              </div>
            </div>
          </CardHeader>
        </CollapsibleTrigger>

        <CollapsibleContent>
          <CardContent className="pt-0 space-y-6">
            <div className="space-y-2">
              <h4 className="font-semibold text-sm">{t.legendTitle}</h4>
              <div className="grid gap-2">
                {(['high', 'medium', 'low', 'none'] as RiskProfile[]).map((p) => (
                  <div key={p} className={`flex items-start gap-3 p-3 rounded-lg border ${RISK_STYLE[p].panel}`}>
                    <span className={`mt-1 w-3 h-3 rounded-full shrink-0 ${RISK_STYLE[p].dot}`} />
                    <div>
                      <p className="text-sm font-medium">{t.profileLabel[p]}</p>
                      <p className="text-xs text-muted-foreground">{t.legend[p]}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="space-y-3">
              <h4 className="font-semibold text-sm">{t.howTitle}</h4>
              <div className="grid gap-3">
                <div className="flex items-start gap-3 p-3 bg-muted/50 rounded-lg">
                  <FileSearch className="h-4 w-4 text-primary mt-0.5 shrink-0" />
                  <div>
                    <p className="text-sm font-medium">{t.step1Title}</p>
                    <p className="text-xs text-muted-foreground">{t.step1Desc}</p>
                  </div>
                </div>
                <div className="flex items-start gap-3 p-3 bg-muted/50 rounded-lg">
                  <Scale className="h-4 w-4 text-primary mt-0.5 shrink-0" />
                  <div>
                    <p className="text-sm font-medium">{t.step2Title}</p>
                    <p className="text-xs text-muted-foreground">{t.step2Desc}</p>
                  </div>
                </div>
                <div className="flex items-start gap-3 p-3 bg-muted/50 rounded-lg">
                  <Layers className="h-4 w-4 text-primary mt-0.5 shrink-0" />
                  <div>
                    <p className="text-sm font-medium">{t.step3Title}</p>
                    <p className="text-xs text-muted-foreground">{t.step3Desc}</p>
                  </div>
                </div>
              </div>
            </div>

            {hasChecks && (
              <div className="space-y-2">
                <h4 className="font-semibold text-sm">{t.countsTitle}: {checks!.length}</h4>
                <div className="flex flex-wrap gap-2 text-xs">
                  <span className={`px-2 py-1 rounded border ${RISK_STYLE.none.badge}`}>{count('covered')} {t.covered}</span>
                  <span className={`px-2 py-1 rounded border ${RISK_STYLE.medium.badge}`}>{count('partial')} {t.partial}</span>
                  <span className={`px-2 py-1 rounded border ${RISK_STYLE.high.badge}`}>{count('missing')} {t.missing}</span>
                  <span className="px-2 py-1 rounded border bg-muted text-muted-foreground">{count('to_verify')} {t.toVerify}</span>
                  <span className="px-2 py-1 rounded border bg-muted text-muted-foreground">{count('not_applicable')} {t.notApplicable}</span>
                </div>
              </div>
            )}

            <div className="flex items-start gap-3 p-3 rounded-lg border border-border">
              <Info className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
              <div>
                <p className="text-sm font-medium">{t.limitsTitle}</p>
                <p className="text-xs text-muted-foreground">{t.limitsDesc}</p>
              </div>
            </div>
          </CardContent>
        </CollapsibleContent>
      </Collapsible>
    </Card>
  );
}
