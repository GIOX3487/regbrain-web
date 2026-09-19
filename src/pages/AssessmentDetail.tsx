import { useState, useEffect, useMemo, useRef } from "react";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { supabase, supabaseHttpUrl } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useToast } from "@/hooks/use-toast";
import { useContentTranslation } from "@/hooks/useContentTranslation";
import {
  AlertTriangle,
  ArrowLeft,
  BookOpen,
  ChevronDown,
  Download,
  FileText,
  Info,
  TrendingDown,
  TrendingUp,
  CheckCircle2,
  XCircle,
  Languages
} from "lucide-react";
import { RiskScoreExplanation, RISK_STYLE, riskProfileOf, overallRiskProfile, type RiskProfile } from "@/components/compliance/RiskScoreExplanation";
import { DocumentConfigDialog, type ConfigDocumentType, type DocumentConfig } from "@/components/DocumentConfigDialog";
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { format } from 'date-fns';

interface Assessment {
  id: string;
  title: string;
  description: string;
  assessment_type: string;
  overall_risk_score: number;
  overall_compliance_percentage: number;
  scope_jurisdiction: string;
  scope_sector: string;
  scope_regulations: string[];
  status: string;
  created_at: string;
  completed_at: string;
  annual_revenue_eur?: number;
  requirement_checks?: RequirementChecksPayload | null;
  analysis_progress?: { done: number; total: number; updated_at?: string; status?: string; pending?: string[] } | null;
}

interface RequirementCheck {
  requirement_id: string;
  regulation: string;
  reference: string;
  description: string;
  severity: string;
  remediation_effort: string;
  conditional: boolean;
  applicability_note?: string | null;
  status: 'covered' | 'partial' | 'missing' | 'to_verify' | 'not_applicable';
  risk_level: 'high' | 'medium' | 'low' | null;
  assessment: string;
  evidence: Array<{ document: string; quote: string }>;
  missing_elements: string[];
  improvement_suggestions?: string[];
  recommended_actions: string[];
  confidence: number | null;
  method: string;
}

interface RequirementChecksPayload {
  version?: string;
  status?: 'in_progress' | 'completed';
  updated_at?: string;
  generated_at?: string;
  total?: number;
  pending?: string[];
  unreadable_documents?: string[];
  documents_analyzed?: string[];
  counts?: Record<string, number>;
  checks?: RequirementCheck[];
}

interface Gap {
  id: string;
  requirement_reference: string;
  requirement_description: string;
  current_state: string;
  gap_description: string;
  risk_level: string;
  risk_score: number;
  potential_fine_eur: number;
  priority: number;
  remediation_effort: string;
  recommended_actions: any;
  status: string;
  source_chunk_id: string | null;
  article_text_excerpt: string | null;
  detection_method: string | null;
  evidence?: Array<{ document: string; quote: string }> | null;
  coverage_status?: string | null;
  severity?: string | null;
}

interface ActionPlan {
  id: string;
  title: string;
  description: string;
  priority: number;
  status: string;
  estimated_cost_eur: number;
  estimated_hours: number;
  progress_percentage: number;
  due_date: string;
  assigned_to?: string;
}

function CoverageScopeDisclaimer({ regulations, checks, unreadableDocuments, documentsAnalyzed, language }: {
  regulations: string[];
  checks: RequirementCheck[];
  unreadableDocuments: string[];
  documentsAnalyzed: string[];
  language: string;
}) {
  const isIt = language === 'it';
  const perRegulation = regulations.map(reg => ({
    regulation: reg,
    analyzed: checks.filter(c => c.regulation.toLowerCase() === reg.toLowerCase()).length,
  }));
  return (
    <Card className="bg-muted/50 border-muted mb-8">
      <CardContent className="p-4">
        <div className="flex items-start gap-2">
          <Info className="h-5 w-5 text-muted-foreground mt-0.5 shrink-0" />
          <div className="space-y-2">
            <p className="text-sm text-muted-foreground">
              {isIt
                ? `Verifica documentale su ${checks.length} requisiti: le disposizioni delle normative selezionate che impongono obblighi all'organizzazione, confrontate con ${documentsAnalyzed.length} documenti leggibili. L'analisi valuta ciò che risulta dai documenti, non l'effettiva applicazione delle misure, e non sostituisce il parere di un legale.`
                : `Documentary check on ${checks.length} requirements: the provisions of the selected regulations that impose obligations on the organisation, compared with ${documentsAnalyzed.length} readable documents. The analysis assesses what the documents show, not the actual application of measures, and does not replace legal advice.`}
            </p>
            <div className="flex flex-wrap gap-2">
              {perRegulation.map(reg => (
                <Badge key={reg.regulation} variant="secondary">
                  {reg.regulation}: {reg.analyzed} {isIt ? 'requisiti' : 'requirements'}
                </Badge>
              ))}
            </div>
            {unreadableDocuments.length > 0 && (
              <p className="text-sm text-amber-700 dark:text-amber-300">
                {isIt
                  ? `${unreadableDocuments.length} documenti non erano leggibili e sono stati esclusi: ${unreadableDocuments.join(', ')}. Se contengono evidenze utili, ricaricali in formato testuale (PDF con testo o .docx) e ripeti l'analisi.`
                  : `${unreadableDocuments.length} documents were not readable and were excluded: ${unreadableDocuments.join(', ')}. If they contain useful evidence, upload them again as text (PDF with text or .docx) and rerun the analysis.`}
              </p>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// A tab-scoped marker prevents a reload from restarting calls during a provider outage.
function providerPauseKey(id: string) { return `regbrain:gap-provider-paused:${id}`; }
function readProviderPause(id?: string): boolean {
  try { return !!id && sessionStorage.getItem(providerPauseKey(id)) === '1'; } catch { return false; }
}
function writeProviderPause(id: string, paused: boolean) {
  try {
    if (paused) sessionStorage.setItem(providerPauseKey(id), '1');
    else sessionStorage.removeItem(providerPauseKey(id));
  } catch { /* The visible pause still works if storage is unavailable. */ }
}

export default function AssessmentDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const { toast } = useToast();
  const [assessment, setAssessment] = useState<Assessment | null>(null);
  const [gaps, setGaps] = useState<Gap[]>([]);
  const [actionPlans, setActionPlans] = useState<ActionPlan[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedLanguage, setSelectedLanguage] = useState<'it' | 'en' | 'es' | 'fr' | 'de'>('it');
  const [configDialogOpen, setConfigDialogOpen] = useState(false);
  const [configDocType, setConfigDocType] = useState<ConfigDocumentType | null>(null);

  const { translatedContent, isTranslating, getTranslatedText } = useContentTranslation(
    selectedLanguage,
    assessment,
    gaps,
    actionPlans
  );

  // UI Translations
  const uiTranslations: Record<string, any> = {
    it: {
      analysisPausedTitle: "Analisi in pausa",
      resultsPending: "Risultati disponibili al termine dell’analisi",
      analysisPaused: "Il servizio IA è temporaneamente indisponibile. I risultati già ottenuti sono salvati. Riprova più tardi con “Riprendi l’analisi”.",
      backToHub: 'Torna al Compliance Hub',
      exportPDF: 'Esporta PDF',
      loading: 'Caricamento...',
      notFound: 'Valutazione non trovata',
      created: 'Creata',
      completed: 'Completata',
      jurisdiction: 'Giurisdizione',
      sector: 'Settore',
      compliance: 'Compliance',
      good: 'Buono',
      needsImprovement: 'Da migliorare',
      critical: 'critici',
      high: 'alti',
      identifiedGaps: 'Gap Identificati',
      open: 'aperti',
      complianceExcellent: 'Eccellente',
      complianceGood: 'Buono',
      complianceSufficient: 'Sufficiente',
      complianceInsufficient: 'Insufficiente',
      complianceCritical: 'Critico',
      finesLow: 'Rischio sanzionatorio basso',
      finesMedium: 'Rischio sanzionatorio moderato',
      finesHigh: 'Rischio sanzionatorio elevato',
      finesCritical: 'Rischio sanzionatorio critico',
      gapsTab: 'Gap Identificati',
      actionPlanTab: 'Piano d\'Azione',
      documentsTab: 'Documenti',
      priority: 'Priorità',
      effort: 'sforzo',
      recommendedActions: 'Azioni Raccomandate',
      noDocuments: 'Nessun documento generato',
      noDocumentsDesc: 'I documenti generati appariranno qui',
      status: 'Stato',
      description: 'Descrizione',
      timeline: 'Scadenze',
      assignedTo: 'Assegnato a',
      notAssigned: 'Non assegnato',
      progress: 'Progresso',
      currentState: 'Stato attuale',
      noActionPlan: 'Nessun piano d\'azione',
      noActionPlanDesc: 'I piani d\'azione verranno generati automaticamente per i gap prioritari',
      generateDocsTitle: 'Genera Documentazione Audit-Ready',
      generateDocsDesc: 'Crea automaticamente documenti di conformità basati sui risultati di questa valutazione',
      translating: 'Traduzione in corso...',
      // Risk levels
      riskLevelCritical: 'critico',
      riskLevelHigh: 'alto',
      riskLevelMedium: 'medio',
      riskLevelLow: 'basso',
      // Remediation effort
      effortVeryHigh: 'molto alto',
      effortHigh: 'alto',
      effortMedium: 'medio',
      effortLow: 'basso',
      // Statuses
      statusPending: 'in attesa',
      statusInProgress: 'in corso',
      statusCompleted: 'completato',
      statusOpen: 'aperto',
      statusResolved: 'risolto',
      riskProfile: 'Profilo di rischio',
      riskHigh: 'Alto',
      riskMedium: 'Medio',
      riskLow: 'Basso',
      riskNone: 'Nessun rischio rilevato',
      riskCounts: '{h} alti, {m} medi, {l} bassi',
      requirementsChecked: 'Requisiti verificati',
      documentedCount: '{n} documentati',
      toVerifyCount: '{n} da verificare',
      coveredTab: 'Requisiti documentati',
      toVerifyTab: 'Da verificare',
      docMissing: 'Documentazione assente',
      docPartial: 'Documentazione parziale',
      whatFound: 'Cosa risulta dai documenti',
      missingElements: 'Cosa manca',
      evidenceFound: 'Evidenze trovate',
      noEvidence: 'Nessuna evidenza testuale',
      methodAi: 'Verifica documentale AI',
      methodKeyword: 'Analisi testuale',
      statusDocumented: 'Documentato',
      statusToVerify: 'Da verificare',
      statusNotApplicable: 'Non applicabile',
      toVerifyIntro: 'Obblighi che valgono solo in certe situazioni: dai documenti non risulta se ricorrono. Non sono conteggiati come gap, ma vanno chiariti.',
      notApplicableIntro: 'Requisiti non applicabili in base a quanto dichiarato nei documenti:',
      noCovered: 'Nessun requisito risulta documentato in modo completo.',
      noToVerify: 'Nessun requisito da verificare.',
      analysisInProgress: 'Analisi in corso: la pagina si aggiorna da sola appena i risultati sono pronti.',
      resumeAnalysis: 'Riprendi l\'analisi',
      appliesWhen: 'Si applica se',
      suggestedActions: 'Azioni suggerite'
    },
    en: {
      analysisPausedTitle: "Analysis paused",
      resultsPending: "Results available when the analysis is complete",
      analysisPaused: "The AI service is temporarily unavailable. Your results are saved. Try “Resume analysis” again later.",
      backToHub: 'Back to Compliance Hub',
      exportPDF: 'Export PDF',
      loading: 'Loading...',
      notFound: 'Assessment not found',
      created: 'Created',
      completed: 'Completed',
      jurisdiction: 'Jurisdiction',
      sector: 'Sector',
      compliance: 'Compliance',
      good: 'Good',
      needsImprovement: 'Needs Improvement',
      critical: 'critical',
      high: 'high',
      identifiedGaps: 'Identified Gaps',
      open: 'open',
      complianceExcellent: 'Excellent',
      complianceGood: 'Good',
      complianceSufficient: 'Sufficient',
      complianceInsufficient: 'Insufficient',
      complianceCritical: 'Critical',
      finesLow: 'Low sanction risk',
      finesMedium: 'Moderate sanction risk',
      finesHigh: 'High sanction risk',
      finesCritical: 'Critical sanction risk',
      gapsTab: 'Identified Gaps',
      actionPlanTab: 'Action Plan',
      documentsTab: 'Documents',
      priority: 'Priority',
      effort: 'effort',
      recommendedActions: 'Recommended Actions',
      noDocuments: 'No documents generated',
      noDocumentsDesc: 'Generated documents will appear here',
      status: 'Status',
      description: 'Description',
      timeline: 'Timeline',
      assignedTo: 'Assigned to',
      notAssigned: 'Not assigned',
      progress: 'Progress',
      currentState: 'Current State',
      noActionPlan: 'No action plan',
      noActionPlanDesc: 'Action plans will be automatically generated for priority gaps',
      generateDocsTitle: 'Generate Audit-Ready Documentation',
      generateDocsDesc: 'Automatically create compliance documents based on this assessment results',
      translating: 'Translating...',
      // Risk levels
      riskLevelCritical: 'critical',
      riskLevelHigh: 'high',
      riskLevelMedium: 'medium',
      riskLevelLow: 'low',
      // Remediation effort
      effortVeryHigh: 'very high',
      effortHigh: 'high',
      effortMedium: 'medium',
      effortLow: 'low',
      // Statuses
      statusPending: 'pending',
      statusInProgress: 'in progress',
      statusCompleted: 'completed',
      statusOpen: 'open',
      statusResolved: 'resolved',
      riskProfile: 'Risk profile',
      riskHigh: 'High',
      riskMedium: 'Medium',
      riskLow: 'Low',
      riskNone: 'No risk detected',
      riskCounts: '{h} high, {m} medium, {l} low',
      requirementsChecked: 'Requirements checked',
      documentedCount: '{n} documented',
      toVerifyCount: '{n} to verify',
      coveredTab: 'Documented requirements',
      toVerifyTab: 'To verify',
      docMissing: 'No documentation',
      docPartial: 'Partial documentation',
      whatFound: 'What the documents show',
      missingElements: 'What is missing',
      evidenceFound: 'Evidence found',
      noEvidence: 'No textual evidence',
      methodAi: 'AI document check',
      methodKeyword: 'Text analysis',
      statusDocumented: 'Documented',
      statusToVerify: 'To verify',
      statusNotApplicable: 'Not applicable',
      toVerifyIntro: 'Obligations that apply only in certain situations: the documents do not show whether they occur. Not counted as gaps, but to be clarified.',
      notApplicableIntro: 'Requirements not applicable according to the documents:',
      noCovered: 'No requirement is fully documented.',
      noToVerify: 'Nothing to verify.',
      analysisInProgress: 'Analysis in progress: this page refreshes automatically when results are ready.',
      resumeAnalysis: 'Resume analysis',
      appliesWhen: 'Applies when',
      suggestedActions: 'Suggested actions'
    },
    es: {
      analysisPausedTitle: "Análisis en pausa",
      resultsPending: "Resultados disponibles al finalizar el análisis",
      analysisPaused: "El servicio de IA no está disponible temporalmente. Los resultados están guardados. Prueba “Reanudar el análisis” más tarde.",
      backToHub: 'Volver al Centro de Cumplimiento',
      exportPDF: 'Exportar PDF',
      loading: 'Cargando...',
      notFound: 'Evaluación no encontrada',
      created: 'Creado',
      completed: 'Completado',
      jurisdiction: 'Jurisdicción',
      sector: 'Sector',
      compliance: 'Cumplimiento',
      good: 'Bueno',
      needsImprovement: 'Necesita Mejora',
      critical: 'críticos',
      high: 'altos',
      identifiedGaps: 'Brechas Identificadas',
      open: 'abiertas',
      complianceExcellent: 'Excelente',
      complianceGood: 'Bueno',
      complianceSufficient: 'Suficiente',
      complianceInsufficient: 'Insuficiente',
      complianceCritical: 'Crítico',
      finesLow: 'Riesgo sancionador bajo',
      finesMedium: 'Riesgo sancionador moderado',
      finesHigh: 'Riesgo sancionador elevado',
      finesCritical: 'Riesgo sancionador crítico',
      gapsTab: 'Brechas Identificadas',
      actionPlanTab: 'Plan de Acción',
      documentsTab: 'Documentos',
      priority: 'Prioridad',
      effort: 'esfuerzo',
      recommendedActions: 'Acciones Recomendadas',
      noDocuments: 'No hay documentos generados',
      noDocumentsDesc: 'Los documentos generados aparecerán aquí',
      status: 'Estado',
      description: 'Descripción',
      timeline: 'Cronología',
      assignedTo: 'Asignado a',
      notAssigned: 'No asignado',
      progress: 'Progreso',
      currentState: 'Estado Actual',
      noActionPlan: 'Sin plan de acción',
      noActionPlanDesc: 'Los planes de acción se generarán automáticamente para las brechas prioritarias',
      generateDocsTitle: 'Generar Documentación Lista para Auditoría',
      generateDocsDesc: 'Crea automáticamente documentos de cumplimiento basados en los resultados de esta evaluación',
      translating: 'Traduciendo...',
      // Risk levels
      riskLevelCritical: 'crítico',
      riskLevelHigh: 'alto',
      riskLevelMedium: 'medio',
      riskLevelLow: 'bajo',
      // Remediation effort
      effortVeryHigh: 'muy alto',
      effortHigh: 'alto',
      effortMedium: 'medio',
      effortLow: 'bajo',
      // Statuses
      statusPending: 'pendiente',
      statusInProgress: 'en progreso',
      statusCompleted: 'completado',
      statusOpen: 'abierto',
      statusResolved: 'resuelto',
      riskProfile: 'Perfil de riesgo',
      riskHigh: 'Alto',
      riskMedium: 'Medio',
      riskLow: 'Bajo',
      riskNone: 'Sin riesgo detectado',
      riskCounts: '{h} altos, {m} medios, {l} bajos',
      requirementsChecked: 'Requisitos verificados',
      documentedCount: '{n} documentados',
      toVerifyCount: '{n} por verificar',
      coveredTab: 'Requisitos documentados',
      toVerifyTab: 'Por verificar',
      docMissing: 'Sin documentación',
      docPartial: 'Documentación parcial',
      whatFound: 'Qué muestran los documentos',
      missingElements: 'Qué falta',
      evidenceFound: 'Evidencias encontradas',
      noEvidence: 'Sin evidencia textual',
      methodAi: 'Verificación documental IA',
      methodKeyword: 'Análisis textual',
      statusDocumented: 'Documentado',
      statusToVerify: 'Por verificar',
      statusNotApplicable: 'No aplicable',
      toVerifyIntro: 'Obligaciones que solo aplican en ciertas situaciones: los documentos no muestran si se dan. No cuentan como brechas, pero deben aclararse.',
      notApplicableIntro: 'Requisitos no aplicables según los documentos:',
      noCovered: 'Ningún requisito está documentado por completo.',
      noToVerify: 'Nada por verificar.',
      analysisInProgress: 'Análisis en curso: la página se actualiza sola cuando los resultados están listos.',
      resumeAnalysis: 'Reanudar el análisis',
      appliesWhen: 'Se aplica si',
      suggestedActions: 'Acciones sugeridas'
    },
    fr: {
      analysisPausedTitle: "Analyse en pause",
      resultsPending: "Résultats disponibles à la fin de l’analyse",
      analysisPaused: "Le service IA est temporairement indisponible. Les résultats sont enregistrés. Réessayez « Reprendre l’analyse » plus tard.",
      backToHub: 'Retour au Centre de Conformité',
      exportPDF: 'Exporter PDF',
      loading: 'Chargement...',
      notFound: 'Évaluation non trouvée',
      created: 'Créé',
      completed: 'Terminé',
      jurisdiction: 'Juridiction',
      sector: 'Secteur',
      compliance: 'Conformité',
      good: 'Bon',
      needsImprovement: 'À améliorer',
      critical: 'critiques',
      high: 'élevés',
      identifiedGaps: 'Écarts Identifiés',
      open: 'ouverts',
      complianceExcellent: 'Excellent',
      complianceGood: 'Bon',
      complianceSufficient: 'Suffisant',
      complianceInsufficient: 'Insuffisant',
      complianceCritical: 'Critique',
      finesLow: 'Risque de sanction faible',
      finesMedium: 'Risque de sanction modéré',
      finesHigh: 'Risque de sanction élevé',
      finesCritical: 'Risque de sanction critique',
      gapsTab: 'Écarts Identifiés',
      actionPlanTab: 'Plan d\'Action',
      documentsTab: 'Documents',
      priority: 'Priorité',
      effort: 'effort',
      recommendedActions: 'Actions Recommandées',
      noDocuments: 'Aucun document généré',
      noDocumentsDesc: 'Les documents générés apparaîtront ici',
      status: 'Statut',
      description: 'Description',
      timeline: 'Chronologie',
      assignedTo: 'Assigné à',
      notAssigned: 'Non assigné',
      progress: 'Progrès',
      currentState: 'État actuel',
      noActionPlan: 'Aucun plan d\'action',
      noActionPlanDesc: 'Les plans d\'action seront générés automatiquement pour les lacunes prioritaires',
      generateDocsTitle: 'Générer une Documentation Prête pour l\'Audit',
      generateDocsDesc: 'Créez automatiquement des documents de conformité basés sur les résultats de cette évaluation',
      translating: 'Traduction...',
      // Risk levels
      riskLevelCritical: 'critique',
      riskLevelHigh: 'élevé',
      riskLevelMedium: 'moyen',
      riskLevelLow: 'faible',
      // Remediation effort
      effortVeryHigh: 'très élevé',
      effortHigh: 'élevé',
      effortMedium: 'moyen',
      effortLow: 'faible',
      // Statuses
      statusPending: 'en attente',
      statusInProgress: 'en cours',
      statusCompleted: 'terminé',
      statusOpen: 'ouvert',
      statusResolved: 'résolu',
      riskProfile: 'Profil de risque',
      riskHigh: 'Élevé',
      riskMedium: 'Moyen',
      riskLow: 'Faible',
      riskNone: 'Aucun risque détecté',
      riskCounts: '{h} élevés, {m} moyens, {l} faibles',
      requirementsChecked: 'Exigences vérifiées',
      documentedCount: '{n} documentées',
      toVerifyCount: '{n} à vérifier',
      coveredTab: 'Exigences documentées',
      toVerifyTab: 'À vérifier',
      docMissing: 'Documentation absente',
      docPartial: 'Documentation partielle',
      whatFound: 'Ce que montrent les documents',
      missingElements: 'Ce qui manque',
      evidenceFound: 'Preuves trouvées',
      noEvidence: 'Aucune preuve textuelle',
      methodAi: 'Vérification documentaire IA',
      methodKeyword: 'Analyse textuelle',
      statusDocumented: 'Documentée',
      statusToVerify: 'À vérifier',
      statusNotApplicable: 'Non applicable',
      toVerifyIntro: 'Obligations qui ne s\'appliquent que dans certaines situations : les documents ne montrent pas si elles se présentent. Non comptées comme écarts, mais à clarifier.',
      notApplicableIntro: 'Exigences non applicables selon les documents :',
      noCovered: 'Aucune exigence n\'est entièrement documentée.',
      noToVerify: 'Rien à vérifier.',
      analysisInProgress: 'Analyse en cours : la page se met à jour automatiquement dès que les résultats sont prêts.',
      resumeAnalysis: 'Reprendre l\'analyse',
      appliesWhen: "S'applique si",
      suggestedActions: 'Actions suggérées'
    },
    de: {
      analysisPausedTitle: "Analyse pausiert",
      resultsPending: "Ergebnisse nach Abschluss der Analyse verfügbar",
      analysisPaused: "Der KI-Dienst ist vorübergehend nicht verfügbar. Die Ergebnisse sind gespeichert. Versuchen Sie später „Analyse fortsetzen“.",
      backToHub: 'Zurück zum Compliance Hub',
      exportPDF: 'PDF Exportieren',
      loading: 'Lädt...',
      notFound: 'Bewertung nicht gefunden',
      created: 'Erstellt',
      completed: 'Abgeschlossen',
      jurisdiction: 'Gerichtsbarkeit',
      sector: 'Sektor',
      compliance: 'Compliance',
      good: 'Gut',
      needsImprovement: 'Verbesserungsbedarf',
      critical: 'kritisch',
      high: 'hoch',
      identifiedGaps: 'Identifizierte Lücken',
      open: 'offen',
      complianceExcellent: 'Ausgezeichnet',
      complianceGood: 'Gut',
      complianceSufficient: 'Ausreichend',
      complianceInsufficient: 'Ungenügend',
      complianceCritical: 'Kritisch',
      finesLow: 'Niedriges Sanktionsrisiko',
      finesMedium: 'Moderates Sanktionsrisiko',
      finesHigh: 'Hohes Sanktionsrisiko',
      finesCritical: 'Kritisches Sanktionsrisiko',
      gapsTab: 'Identifizierte Lücken',
      actionPlanTab: 'Aktionsplan',
      documentsTab: 'Dokumente',
      priority: 'Priorität',
      effort: 'Aufwand',
      recommendedActions: 'Empfohlene Maßnahmen',
      noDocuments: 'Keine Dokumente generiert',
      noDocumentsDesc: 'Generierte Dokumente werden hier angezeigt',
      status: 'Status',
      description: 'Beschreibung',
      timeline: 'Zeitplan',
      assignedTo: 'Zugewiesen an',
      notAssigned: 'Nicht zugewiesen',
      progress: 'Fortschritt',
      currentState: 'Aktueller Zustand',
      noActionPlan: 'Kein Aktionsplan',
      noActionPlanDesc: 'Aktionspläne werden automatisch für prioritäre Lücken generiert',
      generateDocsTitle: 'Audit-bereite Dokumentation Generieren',
      generateDocsDesc: 'Erstellen Sie automatisch Compliance-Dokumente basierend auf den Ergebnissen dieser Bewertung',
      translating: 'Übersetzen...',
      // Risk levels
      riskLevelCritical: 'kritisch',
      riskLevelHigh: 'hoch',
      riskLevelMedium: 'mittel',
      riskLevelLow: 'niedrig',
      // Remediation effort
      effortVeryHigh: 'sehr hoch',
      effortHigh: 'hoch',
      effortMedium: 'mittel',
      effortLow: 'niedrig',
      // Statuses
      statusPending: 'ausstehend',
      statusInProgress: 'in Bearbeitung',
      statusCompleted: 'abgeschlossen',
      statusOpen: 'offen',
      statusResolved: 'gelöst',
      riskProfile: 'Risikoprofil',
      riskHigh: 'Hoch',
      riskMedium: 'Mittel',
      riskLow: 'Gering',
      riskNone: 'Kein Risiko festgestellt',
      riskCounts: '{h} hoch, {m} mittel, {l} gering',
      requirementsChecked: 'Geprüfte Anforderungen',
      documentedCount: '{n} dokumentiert',
      toVerifyCount: '{n} zu prüfen',
      coveredTab: 'Dokumentierte Anforderungen',
      toVerifyTab: 'Zu prüfen',
      docMissing: 'Keine Dokumentation',
      docPartial: 'Teilweise Dokumentation',
      whatFound: 'Was die Dokumente zeigen',
      missingElements: 'Was fehlt',
      evidenceFound: 'Gefundene Belege',
      noEvidence: 'Keine Textbelege',
      methodAi: 'KI-Dokumentenprüfung',
      methodKeyword: 'Textanalyse',
      statusDocumented: 'Dokumentiert',
      statusToVerify: 'Zu prüfen',
      statusNotApplicable: 'Nicht anwendbar',
      toVerifyIntro: 'Pflichten, die nur in bestimmten Situationen gelten: aus den Dokumenten geht nicht hervor, ob sie vorliegen. Nicht als Lücken gezählt, aber zu klären.',
      notApplicableIntro: 'Laut Dokumenten nicht anwendbare Anforderungen:',
      noCovered: 'Keine Anforderung ist vollständig dokumentiert.',
      noToVerify: 'Nichts zu prüfen.',
      analysisInProgress: 'Analyse läuft: die Seite aktualisiert sich automatisch, sobald Ergebnisse vorliegen.',
      resumeAnalysis: 'Analyse fortsetzen',
      appliesWhen: 'Gilt wenn',
      suggestedActions: 'Vorgeschlagene Maßnahmen'
    }
  };

  // Helper functions for translations
  const translateRiskLevel = (riskLevel: string): string => {
    const map: Record<string, string> = {
      'critical': t.riskLevelCritical,
      'high': t.riskLevelHigh,
      'medium': t.riskLevelMedium,
      'low': t.riskLevelLow
    };
    return map[riskLevel?.toLowerCase()] || riskLevel;
  };

  const translateEffort = (effort: string): string => {
    if (!effort) return '';
    const normalized = effort.toLowerCase().replace(/_/g, ' ');
    const map: Record<string, string> = {
      'very high': t.effortVeryHigh,
      'very_high': t.effortVeryHigh,
      'high': t.effortHigh,
      'medium': t.effortMedium,
      'low': t.effortLow
    };
    return map[normalized] || map[effort.toLowerCase()] || effort;
  };

  const translateStatus = (status: string): string => {
    if (!status) return '';
    const normalized = status.toLowerCase().replace(/_/g, ' ');
    const map: Record<string, string> = {
      'pending': t.statusPending,
      'in_progress': t.statusInProgress,
      'in progress': t.statusInProgress,
      'completed': t.statusCompleted,
      'open': t.statusOpen,
      'resolved': t.statusResolved
    };
    return map[normalized] || map[status.toLowerCase()] || status;
  };

  const t = useMemo(() => ({ ...uiTranslations.it, ...uiTranslations.en, ...(uiTranslations[selectedLanguage] || {}) }), [selectedLanguage]);
  const dateLocale = useMemo(() => 
    selectedLanguage === 'en' ? 'en-US' : 
    selectedLanguage === 'es' ? 'es-ES' : 
    selectedLanguage === 'fr' ? 'fr-FR' : 
    selectedLanguage === 'de' ? 'de-DE' : 'it-IT',
  [selectedLanguage]);

  useEffect(() => {
    loadAssessment();
  }, [id]);

  // Finché l'analisi è in corso, ricarica ogni 5 secondi; se nessuno la sta portando avanti
  // (ultimo aggiornamento più vecchio di 45 secondi) la riprende da qui.
  const [resuming, setResuming] = useState(false);
  const resumingRef = useRef(false);
  const [providerPaused, setProviderPaused] = useState(() => !!location.state?.providerUnavailable || readProviderPause(id));
  const resumeFailuresRef = useRef(providerPaused ? 3 : 0);
  useEffect(() => {
    const paused = !!location.state?.providerUnavailable || readProviderPause(id);
    setProviderPaused(paused);
    resumeFailuresRef.current = paused ? 3 : 0;
    if (id && paused) writeProviderPause(id, true);
    if (location.state?.providerUnavailable) {
      navigate(location.pathname + location.search + location.hash, {
        replace: true, state: { ...location.state, providerUnavailable: false },
      });
    }
  }, [id, location.key]);
  useEffect(() => {
    if (id && assessment?.id === id && assessment.status === 'completed') {
      writeProviderPause(id, false);
      setProviderPaused(false);
    }
  }, [id, assessment?.id, assessment?.status]);
  // La callback dell'intervallo vive quanto l'effetto: senza questo riferimento leggerebbe
  // sempre lo stato della prima render e crederebbe ferma un'analisi che sta avanzando.
  const assessmentRef = useRef<Assessment | null>(null);
  useEffect(() => { assessmentRef.current = assessment; }, [assessment]);
  useEffect(() => {
    if (!assessment || assessment.status === 'completed') return;
    const timer = setInterval(async () => {
      await loadAssessment(true);
      const progress = assessmentRef.current?.analysis_progress;
      const stale = progress?.status === 'in_progress' && Array.isArray(progress.pending) && progress.pending.length > 0
        && progress.updated_at && Date.now() - Date.parse(progress.updated_at) > 40000;
      if (assessmentRef.current?.id === id && stale && !resumingRef.current && resumeFailuresRef.current < 3) resumeAnalysis();
    }, 5000);
    return () => clearInterval(timer);
  }, [assessment?.status, id]);

  const resumeAnalysis = async () => {
    if (resumingRef.current || !id) return;
    resumingRef.current = true;
    setResuming(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Sessione scaduta. Accedi nuovamente per riprendere l’analisi.');
      const anonKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
      let guard = 0;
      let transientRetries = 0;
      while (guard < 60) {
        guard++;
        const response = await fetch(`${supabaseHttpUrl}/functions/v1/gap-analysis`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${session.access_token}`, 'apikey': anonKey },
          body: JSON.stringify({ assessmentId: id, continue: true }),
        });
        const data = await response.json().catch(() => ({}));
        if (data?.code === 'AI_ANALYSIS_UNAVAILABLE') {
          // Stop background retries during a provider outage; manual resume remains available.
          resumeFailuresRef.current = 2;
          setProviderPaused(true);
          writeProviderPause(id, true);
          throw new Error(data.error || 'Servizio IA temporaneamente non disponibile. Riprendi più tardi.');
        }
        if (response.status === 409) {
          resumeFailuresRef.current = 3;
          throw new Error('Questa analisi non può più essere ripresa: rilanciala dalla pagina della nuova gap analysis.');
        }
        // Limite di CPU, sovraccarico o errore momentaneo: lo stato salvato consente di riprovare.
        if (response.status === 546 || response.status === 429 || response.status >= 500) {
          transientRetries++;
          if (transientRetries > 3) throw new Error(data?.error || `Errore ${response.status}`);
          await new Promise(r => setTimeout(r, 4000 * transientRetries));
          continue;
        }
        transientRetries = 0;
        if (!response.ok) throw new Error(data?.error || `Errore ${response.status}`);
        await loadAssessment(true);
        setProviderPaused(false);
        writeProviderPause(id, false);
        resumeFailuresRef.current = 0;
        if (data.status !== 'in_progress') break;
      }
    } catch (err) {
      console.error('Resume analysis failed:', err);
      resumeFailuresRef.current += 1;
      if (resumeFailuresRef.current <= 3) {
        toast({
          title: 'Impossibile riprendere l\'analisi',
          description: err instanceof Error ? err.message : 'Riprova tra poco.',
          variant: 'destructive',
        });
      }
    } finally {
      resumingRef.current = false;
      setResuming(false);
    }
  };

  const loadAssessment = async (silent = false) => {
    try {
      const { data: assessmentData, error: assessmentError } = await supabase
        .from('compliance_assessments')
        .select('*')
        .eq('id', id)
        .single();

      if (assessmentError) throw assessmentError;
      setAssessment(assessmentData as unknown as Assessment);

      const { data: gapsData, error: gapsError } = await supabase
        .from('identified_gaps')
        .select('*')
        .eq('assessment_id', id)
        .order('priority', { ascending: true });

      if (gapsError) throw gapsError;
      const riskOrder: Record<string, number> = { high: 0, critical: 0, medium: 1, low: 2 };
      const sortedGaps = ((gapsData || []) as unknown as Gap[]).sort((a, b) =>
        (riskOrder[a.risk_level] ?? 3) - (riskOrder[b.risk_level] ?? 3) || (a.priority - b.priority) || a.requirement_reference.localeCompare(b.requirement_reference)
      );
      setGaps(sortedGaps);

      const { data: plansData, error: plansError } = await supabase
        .from('action_plans')
        .select('*')
        .eq('assessment_id', id)
        .order('priority', { ascending: true });

      if (plansError) throw plansError;
      setActionPlans(plansData || []);

    } catch (error) {
      console.error('Error loading assessment:', error);
      if (!silent) {
        toast({
          title: "Errore",
          description: "Impossibile caricare la valutazione",
          variant: "destructive",
        });
      }
    } finally {
      setLoading(false);
    }
  };

  const exportToPDF = async () => {
    if (!assessment) return;
    
    // Translations
    const translations: Record<string, any> = {
      it: {
        title: assessment.title,
        assessmentInfo: 'Informazioni Valutazione',
        status: 'Stato',
        jurisdiction: 'Giurisdizione',
        sector: 'Settore',
        created: 'Creata',
        regulations: 'Regolamenti',
        completed: 'Completata',
        keyMetrics: 'Metriche Principali',
        compliance: 'Compliance',
        identifiedGaps: 'Gap Identificati',
        critical: 'critici',
        high: 'alti',
        actionsInPlan: 'Azioni nel Piano',
        gapsDetailTitle: 'Gap Identificati - Dettaglio Completo',
        gap: 'Gap',
        reference: 'Riferimento',
        riskLevel: 'Livello di Rischio',
        priority: 'Priorità',
        requirement: 'Requisito',
        currentState: 'Stato Attuale',
        gapDescription: 'Descrizione Gap',
        recommendedActions: 'Azioni Raccomandate',
        actionPlanTitle: 'Piano d\'Azione Dettagliato',
        action: 'Azione',
        progress: 'Progresso',
        dueDate: 'Scadenza',
        assignedTo: 'Assegnato a',
        page: 'Pagina',
        of: 'di',
        notSpecified: 'Non specificato',
        effort: 'Effort',
        identifiedGap: 'Gap Identificato',
        generatedOn: 'Generato il',
        pdfExported: '✅ PDF Esportato',
        pdfExportedDesc: 'Report completo scaricato con successo',
        exportError: 'Errore',
        exportErrorDesc: 'Impossibile esportare il PDF'
      },
      en: {
        title: assessment.title,
        assessmentInfo: 'Assessment Information',
        status: 'Status',
        jurisdiction: 'Jurisdiction',
        sector: 'Sector',
        created: 'Created',
        regulations: 'Regulations',
        completed: 'Completed',
        keyMetrics: 'Key Metrics',
        compliance: 'Compliance',
        identifiedGaps: 'Identified Gaps',
        critical: 'critical',
        high: 'high',
        actionsInPlan: 'Actions in Plan',
        gapsDetailTitle: 'Identified Gaps - Full Detail',
        gap: 'Gap',
        reference: 'Reference',
        riskLevel: 'Risk Level',
        priority: 'Priority',
        requirement: 'Requirement',
        currentState: 'Current State',
        gapDescription: 'Gap Description',
        recommendedActions: 'Recommended Actions',
        actionPlanTitle: 'Detailed Action Plan',
        action: 'Action',
        progress: 'Progress',
        dueDate: 'Due Date',
        assignedTo: 'Assigned to',
        page: 'Page',
        of: 'of',
        notSpecified: 'Not specified',
        effort: 'Effort',
        identifiedGap: 'Identified Gap',
        generatedOn: 'Generated on',
        pdfExported: '✅ PDF Exported',
        pdfExportedDesc: 'Complete report downloaded successfully',
        exportError: 'Error',
        exportErrorDesc: 'Unable to export PDF'
      },
      es: {
        title: assessment.title,
        assessmentInfo: 'Información de Evaluación',
        status: 'Estado',
        jurisdiction: 'Jurisdicción',
        sector: 'Sector',
        created: 'Creada',
        regulations: 'Regulaciones',
        completed: 'Completada',
        keyMetrics: 'Métricas Clave',
        compliance: 'Cumplimiento',
        identifiedGaps: 'Brechas Identificadas',
        critical: 'críticas',
        high: 'altas',
        notSpecified: 'No especificado',
        effort: 'Esfuerzo',
        identifiedGap: 'Brecha Identificada',
        generatedOn: 'Generado el',
        pdfExported: '✅ PDF Exportado',
        pdfExportedDesc: 'Informe completo descargado con éxito',
        exportError: 'Error',
        exportErrorDesc: 'No se pudo exportar el PDF',
        areasAheadTitle: 'Áreas por Delante del Mercado',
        areasBehindTitle: 'Áreas por Detrás del Mercado',
        actionsInPlan: 'Acciones en el Plan',
        gapsDetailTitle: 'Brechas Identificadas - Detalle Completo',
        gap: 'Brecha',
        reference: 'Referencia',
        riskLevel: 'Nivel de Riesgo',
        priority: 'Prioridad',
        requirement: 'Requisito',
        currentState: 'Estado Actual',
        gapDescription: 'Descripción de Brecha',
        recommendedActions: 'Acciones Recomendadas',
        actionPlanTitle: 'Plan de Acción Detallado',
        action: 'Acción',
        progress: 'Progreso',
        dueDate: 'Fecha Límite',
        assignedTo: 'Asignado a',
        page: 'Página',
        of: 'de'
      },
      fr: {
        title: assessment.title,
        assessmentInfo: 'Informations d\'Évaluation',
        status: 'Statut',
        jurisdiction: 'Juridiction',
        sector: 'Secteur',
        created: 'Créée',
        regulations: 'Réglementations',
        completed: 'Complétée',
        keyMetrics: 'Métriques Clés',
        compliance: 'Conformité',
        identifiedGaps: 'Lacunes Identifiées',
        critical: 'critiques',
        high: 'élevées',
        actionsInPlan: 'Actions dans le Plan',
        gapsDetailTitle: 'Lacunes Identifiées - Détail Complet',
        gap: 'Lacune',
        reference: 'Référence',
        riskLevel: 'Niveau de Risque',
        priority: 'Priorité',
        requirement: 'Exigence',
        currentState: 'État Actuel',
        gapDescription: 'Description de la Lacune',
        recommendedActions: 'Actions Recommandées',
        actionPlanTitle: 'Plan d\'Action Détaillé',
        action: 'Action',
        progress: 'Progrès',
        dueDate: 'Date Limite',
        assignedTo: 'Assigné à',
        page: 'Page',
        of: 'de',
        notSpecified: 'Non spécifié',
        effort: 'Effort',
        identifiedGap: 'Écart Identifié',
        generatedOn: 'Généré le',
        pdfExported: '✅ PDF Exporté',
        pdfExportedDesc: 'Rapport complet téléchargé avec succès',
        exportError: 'Erreur',
        exportErrorDesc: 'Impossible d\'exporter le PDF'
      },
      de: {
        title: assessment.title,
        assessmentInfo: 'Bewertungsinformationen',
        status: 'Status',
        jurisdiction: 'Gerichtsbarkeit',
        sector: 'Sektor',
        created: 'Erstellt',
        regulations: 'Vorschriften',
        completed: 'Abgeschlossen',
        keyMetrics: 'Hauptmetriken',
        compliance: 'Compliance',
        identifiedGaps: 'Identifizierte Lücken',
        critical: 'kritisch',
        high: 'hoch',
        actionsInPlan: 'Maßnahmen im Plan',
        gapsDetailTitle: 'Identifizierte Lücken - Vollständige Details',
        gap: 'Lücke',
        reference: 'Referenz',
        riskLevel: 'Risikoniveau',
        priority: 'Priorität',
        requirement: 'Anforderung',
        currentState: 'Aktueller Stand',
        gapDescription: 'Lückenbeschreibung',
        recommendedActions: 'Empfohlene Maßnahmen',
        actionPlanTitle: 'Detaillierter Aktionsplan',
        action: 'Maßnahme',
        progress: 'Fortschritt',
        dueDate: 'Fälligkeitsdatum',
        assignedTo: 'Zugewiesen an',
        page: 'Seite',
        of: 'von',
        notSpecified: 'Nicht angegeben',
        effort: 'Aufwand',
        identifiedGap: 'Identifizierte Lücke',
        generatedOn: 'Generiert am',
        pdfExported: '✅ PDF Exportiert',
        pdfExportedDesc: 'Vollständiger Bericht erfolgreich heruntergeladen',
        exportError: 'Fehler',
        exportErrorDesc: 'PDF konnte nicht exportiert werden'
      }
    };
    
    const t = translations[selectedLanguage] || translations.it;
    const uiT = { ...uiTranslations.it, ...uiTranslations.en, ...(uiTranslations[selectedLanguage] || {}) };
    
    try {
      const doc = new jsPDF();
      const pageWidth = doc.internal.pageSize.getWidth();
      const pageHeight = doc.internal.pageSize.getHeight();
      const marginLeft = 15;
      const marginRight = 15;
      const safeMargin = 5; // Additional safety margin for text
      const contentWidth = pageWidth - marginLeft - marginRight - safeMargin; // Extra safe text width
      let yPos = 20;
      
      // Helper to add new page if needed
      const checkPageBreak = (neededSpace: number) => {
        if (yPos + neededSpace > pageHeight - 25) {
          doc.addPage();
          yPos = 20;
          return true;
        }
        return false;
      };
      
      // Helper function to safely render wrapped text - NEVER exceeds margins
      const renderWrappedText = (text: string, x: number, maxWidth: number, fontSize: number, isBold: boolean = false) => {
        doc.setFontSize(fontSize);
        doc.setFont('helvetica', isBold ? 'bold' : 'normal');
        const safeMaxWidth = Math.min(maxWidth, pageWidth - x - marginRight - 2);
        const lines = doc.splitTextToSize(text || '', safeMaxWidth);
        const lineHeight = fontSize * 0.45;
        lines.forEach((line: string) => {
          checkPageBreak(lineHeight + 2);
          doc.text(line, x, yPos);
          yPos += lineHeight;
        });
        return lines.length;
      };
      
      // Title Page
      doc.setFontSize(18);
      doc.setFont('helvetica', 'bold');
      const translatedTitle = (getTranslatedText('assessmentTitle') as string) || assessment.title;
      const titleLines = doc.splitTextToSize(translatedTitle, contentWidth);
      titleLines.forEach((line: string) => {
        doc.text(line, pageWidth / 2, yPos, { align: 'center' });
        yPos += 8;
      });
      yPos += 10;
      
      // Description
      const translatedDescription = (getTranslatedText('assessmentDescription') as string) || assessment.description;
      if (translatedDescription) {
        doc.setFontSize(10);
        doc.setFont('helvetica', 'normal');
        const descLines = doc.splitTextToSize(translatedDescription, contentWidth - 10);
        descLines.forEach((line: string) => {
          doc.text(line, pageWidth / 2, yPos, { align: 'center' });
          yPos += 5;
        });
        yPos += 12;
      } else {
        yPos += 10;
      }
      
      // Assessment Info Box
      checkPageBreak(50);
      doc.setFillColor(240, 240, 245);
      doc.rect(20, yPos, pageWidth - 40, 52, 'F');
      yPos += 8;
      
      doc.setFontSize(10);
      doc.setFont('helvetica', 'bold');
      doc.text(t.assessmentInfo, 25, yPos);
      yPos += 7;
      
      doc.setFont('helvetica', 'normal');
      doc.text(`${t.status}: ${assessment.status}`, 25, yPos);
      doc.text(`${t.jurisdiction}: ${assessment.scope_jurisdiction}`, 110, yPos);
      yPos += 6;
      doc.text(`${t.sector}: ${assessment.scope_sector}`, 25, yPos);
      doc.text(`${t.created}: ${new Date(assessment.created_at).toLocaleDateString(selectedLanguage === 'en' ? 'en-US' : selectedLanguage === 'es' ? 'es-ES' : selectedLanguage === 'fr' ? 'fr-FR' : selectedLanguage === 'de' ? 'de-DE' : 'it-IT')}`, 110, yPos);
      yPos += 6;
      
      if (assessment.scope_regulations.length > 0) {
        doc.text(`${t.regulations}: ${assessment.scope_regulations.join(', ')}`, 25, yPos);
        yPos += 6;
      }
      
      if (assessment.completed_at) {
        doc.text(`${t.completed}: ${new Date(assessment.completed_at).toLocaleDateString(selectedLanguage === 'en' ? 'en-US' : selectedLanguage === 'es' ? 'es-ES' : selectedLanguage === 'fr' ? 'fr-FR' : selectedLanguage === 'de' ? 'de-DE' : 'it-IT')}`, 25, yPos);
      }
      yPos += 25;
      
      // KPIs Section with improved spacing
      checkPageBreak(70);
      doc.setFontSize(14);
      doc.setFont('helvetica', 'bold');
      doc.text(t.keyMetrics, 20, yPos);
      yPos += 15;
      
      doc.setFontSize(10);
      doc.setFont('helvetica', 'normal');
      const pdfChecks: RequirementCheck[] = Array.isArray((assessment.requirement_checks as RequirementChecksPayload | null)?.checks)
        ? ((assessment.requirement_checks as RequirementChecksPayload).checks as RequirementCheck[])
        : [];
      const pdfCovered = pdfChecks.filter(c => c.status === 'covered');
      const pdfToVerify = pdfChecks.filter(c => c.status === 'to_verify');
      const pdfNotApplicable = pdfChecks.filter(c => c.status === 'not_applicable');
      const pdfUnreadable: string[] = (assessment.requirement_checks as RequirementChecksPayload | null)?.unreadable_documents || [];
      const highGaps = gaps.filter(g => riskProfileOf(g.risk_level) === 'high').length;
      const mediumGaps = gaps.filter(g => riskProfileOf(g.risk_level) === 'medium').length;
      const lowGaps = gaps.filter(g => riskProfileOf(g.risk_level) === 'low').length;
      const pdfProfile = overallRiskProfile(gaps);
      const pdfProfileLabel: Record<string, string> = { high: uiT.riskHigh, medium: uiT.riskMedium, low: uiT.riskLow, none: uiT.riskNone };
      const riskCountsText = uiT.riskCounts.replace('{h}', String(highGaps)).replace('{m}', String(mediumGaps)).replace('{l}', String(lowGaps));
      
      doc.text(`• ${t.compliance}: ${assessment.overall_compliance_percentage ?? 0}%`, 25, yPos);
      yPos += 8;
      doc.text(`• ${uiT.riskProfile}: ${pdfProfileLabel[pdfProfile]} (${riskCountsText})`, 25, yPos);
      yPos += 8;
      doc.text(`• ${t.identifiedGaps}: ${gaps.length}`, 25, yPos);
      yPos += 8;
      if (pdfChecks.length > 0) {
        doc.text(`• ${uiT.requirementsChecked}: ${pdfChecks.length} (${uiT.documentedCount.replace('{n}', String(pdfCovered.length))}${pdfToVerify.length > 0 ? `, ${uiT.toVerifyCount.replace('{n}', String(pdfToVerify.length))}` : ''})`, 25, yPos);
        yPos += 8;
      }
      doc.text(`• ${t.actionsInPlan}: ${actionPlans.length}`, 25, yPos);
      yPos += 10;
      
      // Executive Summary
      checkPageBreak(50);
      doc.setFontSize(12);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(20, 60, 120);
      const execSummaryTitle = selectedLanguage === 'it' ? 'Executive Summary' : selectedLanguage === 'es' ? 'Resumen Ejecutivo' : selectedLanguage === 'fr' ? 'Résumé Exécutif' : selectedLanguage === 'de' ? 'Zusammenfassung' : 'Executive Summary';
      doc.text(execSummaryTitle, marginLeft, yPos);
      yPos += 8;
      doc.setTextColor(0, 0, 0);
      
      const complianceLevel = (assessment.overall_compliance_percentage || 0) >= 80 ? (selectedLanguage === 'it' ? 'buono' : 'good') : 
        (assessment.overall_compliance_percentage || 0) >= 60 ? (selectedLanguage === 'it' ? 'sufficiente' : 'sufficient') : 
        (assessment.overall_compliance_percentage || 0) >= 40 ? (selectedLanguage === 'it' ? 'insufficiente' : 'insufficient') : (selectedLanguage === 'it' ? 'critico' : 'critical');
      
      const checksSentenceIt = pdfChecks.length > 0
        ? ` Sono stati verificati ${pdfChecks.length} requisiti: ${pdfCovered.length} risultano documentati, ${gaps.length} presentano lacune${pdfToVerify.length > 0 ? `, ${pdfToVerify.length} richiedono una verifica sull'applicabilità` : ''}${pdfNotApplicable.length > 0 ? `, ${pdfNotApplicable.length} non sono applicabili` : ''}.` : '';
      const checksSentenceEn = pdfChecks.length > 0
        ? ` ${pdfChecks.length} requirements were checked: ${pdfCovered.length} are documented, ${gaps.length} show gaps${pdfToVerify.length > 0 ? `, ${pdfToVerify.length} need an applicability check` : ''}${pdfNotApplicable.length > 0 ? `, ${pdfNotApplicable.length} are not applicable` : ''}.` : '';
      const summaryText = selectedLanguage === 'it' 
        ? `L'analisi ha confrontato la documentazione caricata con i requisiti di ${assessment.scope_regulations?.join(', ') || 'le normative selezionate'}.${checksSentenceIt} Il livello di conformità documentale è del ${assessment.overall_compliance_percentage ?? 0}% (${complianceLevel}) e il profilo di rischio complessivo è ${pdfProfileLabel[pdfProfile].toLowerCase()} (${riskCountsText}). Il piano d'azione elenca, per ciascun gap, le azioni per colmarlo. L'analisi valuta ciò che risulta dai documenti, non l'effettiva applicazione delle misure, e non sostituisce il parere di un legale o del DPO.${pdfUnreadable.length > 0 ? ` Documenti esclusi perché non leggibili: ${pdfUnreadable.join(', ')}.` : ''}`
        : `The analysis compared the uploaded documentation with the requirements of ${assessment.scope_regulations?.join(', ') || 'the selected regulations'}.${checksSentenceEn} Documentary compliance is ${assessment.overall_compliance_percentage ?? 0}% (${complianceLevel}) and the overall risk profile is ${pdfProfileLabel[pdfProfile].toLowerCase()} (${riskCountsText}). The action plan lists, for each gap, the actions to close it. The analysis assesses what the documents show, not the actual application of measures, and does not replace legal or DPO advice.${pdfUnreadable.length > 0 ? ` Documents excluded as unreadable: ${pdfUnreadable.join(', ')}.` : ''}`;
      
      doc.setFontSize(9);
      doc.setFont('helvetica', 'normal');
      const summaryLines = doc.splitTextToSize(summaryText, contentWidth);
      summaryLines.forEach((line: string) => {
        checkPageBreak(5);
        doc.text(line, marginLeft, yPos);
        yPos += 5;
      });
      yPos += 10;
      
      // Detailed Gaps Section - FIXED TEXT CLIPPING
      if (gaps.length > 0) {
        doc.addPage();
        yPos = 20;
        doc.setFontSize(14);
        doc.setFont('helvetica', 'bold');
        doc.text(t.gapsDetailTitle, marginLeft, yPos);
        yPos += 12;
        
        // CRITICAL: Define safe widths that NEVER exceed page margins
        const gapTextIndent = marginLeft + 3;
        const safeGapTitleWidth = pageWidth - marginLeft - marginRight - 5;
        const safeGapTextWidth = pageWidth - gapTextIndent - marginRight - 5;
        const lineHeight = 4.5;
        const sectionSpacing = 8;
        
        gaps.forEach((gap, index) => {
          // Check for minimum space, but allow flexible overflow handling
          checkPageBreak(60);
          
          // Gap header with SAFE width calculation
          const fullGapTitle = `${t.gap} ${index + 1}: ${gap.requirement_reference}`;
          doc.setFontSize(9);
          doc.setFont('helvetica', 'bold');
          const gapTitleLines = doc.splitTextToSize(fullGapTitle, safeGapTitleWidth);
          gapTitleLines.forEach((line: string) => {
            checkPageBreak(5);
            doc.text(line, marginLeft, yPos);
            yPos += 5;
          });
          yPos += 3;
          
          // Requirement section
          doc.setFontSize(8);
          doc.setFont('helvetica', 'bold');
          doc.text(`${t.requirement}:`, gapTextIndent, yPos);
          yPos += 4;
          doc.setFont('helvetica', 'normal');
          const translatedRequirement = (getTranslatedText('gap_requirement', gap.id) as string) || gap.requirement_description;
          const reqLines = doc.splitTextToSize(translatedRequirement || '', safeGapTextWidth);
          reqLines.forEach((line: string) => {
            checkPageBreak(5);
            doc.text(line, gapTextIndent, yPos);
            yPos += lineHeight;
          });
          yPos += sectionSpacing;
          
          // Current State section
          checkPageBreak(20);
          doc.setFont('helvetica', 'bold');
          doc.text(`${t.currentState}:`, gapTextIndent, yPos);
          yPos += 4;
          doc.setFont('helvetica', 'normal');
          const translatedCurrentState = (getTranslatedText('gap_currentState', gap.id) as string) || gap.current_state || t.notSpecified;
          const currentLines = doc.splitTextToSize(translatedCurrentState || '', safeGapTextWidth);
          currentLines.forEach((line: string) => {
            checkPageBreak(5);
            doc.text(line, gapTextIndent, yPos);
            yPos += lineHeight;
          });
          yPos += sectionSpacing;
          
          // Gap Description section
          checkPageBreak(20);
          doc.setFont('helvetica', 'bold');
          doc.text(`${t.identifiedGap}:`, gapTextIndent, yPos);
          yPos += 4;
          doc.setFont('helvetica', 'normal');
          const translatedGapDescription = (getTranslatedText('gap_description', gap.id) as string) || gap.gap_description;
          const gapLines = doc.splitTextToSize(translatedGapDescription || '', safeGapTextWidth);
          gapLines.forEach((line: string) => {
            checkPageBreak(5);
            doc.text(line, gapTextIndent, yPos);
            yPos += lineHeight;
          });
          yPos += sectionSpacing;
          
          // Evidence found in the documents
          const gapEvidence = Array.isArray(gap.evidence) ? gap.evidence.slice(0, 3) : [];
          if (gapEvidence.length > 0) {
            checkPageBreak(20);
            doc.setFont('helvetica', 'bold');
            doc.text(`${uiT.evidenceFound}:`, gapTextIndent, yPos);
            yPos += 4;
            doc.setFont('helvetica', 'italic');
            gapEvidence.forEach((e) => {
              const evLines = doc.splitTextToSize(`[${e.document}] "${e.quote}"`, safeGapTextWidth - 4);
              evLines.forEach((line: string) => {
                checkPageBreak(5);
                doc.text(line, gapTextIndent + 2, yPos);
                yPos += lineHeight;
              });
            });
            doc.setFont('helvetica', 'normal');
            yPos += sectionSpacing;
          }

          // Risk profile row (colours become words on paper)
          checkPageBreak(15);
          const gapProfile = riskProfileOf(gap.risk_level);
          const profileRgb: Record<string, [number, number, number]> = { high: [220, 38, 38], medium: [234, 88, 12], low: [161, 98, 7] };
          doc.setFillColor(...profileRgb[gapProfile]);
          doc.circle(gapTextIndent + 1.5, yPos - 1.2, 1.5, 'F');
          doc.setFontSize(7);
          doc.setFont('helvetica', 'bold');
          doc.text(`${uiT.riskProfile}: ${pdfProfileLabel[gapProfile].toUpperCase()}`, gapTextIndent + 5, yPos);
          doc.text(`${gap.coverage_status === 'partial' ? uiT.docPartial : uiT.docMissing}`, gapTextIndent + 55, yPos);
          if (gap.remediation_effort) {
            doc.text(`${t.effort}: ${translateEffort(gap.remediation_effort)}`, gapTextIndent + 110, yPos);
          }
          yPos += 5;
          doc.setFont('helvetica', 'normal');
          doc.text(`${t.status}: ${translateStatus(gap.status)}`, gapTextIndent, yPos);
          yPos += 8;
          
          // Recommended Actions
          if (gap.recommended_actions && Array.isArray(gap.recommended_actions) && gap.recommended_actions.length > 0) {
            checkPageBreak(20);
            doc.setFontSize(8);
            doc.setFont('helvetica', 'bold');
            doc.text(`${t.recommendedActions}:`, gapTextIndent, yPos);
            yPos += 5;
            doc.setFont('helvetica', 'normal');
            doc.setFontSize(7);
            
            const translatedActions = getTranslatedText('gap_recommendedActions', gap.id) as string[] | null;
            const actionsToDisplay = translatedActions || gap.recommended_actions;
            
            actionsToDisplay.forEach((action: any, i: number) => {
              checkPageBreak(10);
              const actionText = typeof action === 'string' ? action : action.action || action.description || '';
              const safeActionWidth = safeGapTextWidth - 8;
              const actionLines = doc.splitTextToSize(`${i + 1}. ${actionText}`, safeActionWidth);
              actionLines.forEach((line: string) => {
                checkPageBreak(4);
                doc.text(line, gapTextIndent + 3, yPos);
                yPos += 4;
              });
              yPos += 1;
            });
          }
          
          yPos += 10;
          
          // Separator
          if (index < gaps.length - 1) {
            checkPageBreak(8);
            doc.setDrawColor(180, 180, 180);
            doc.line(marginLeft, yPos, pageWidth - marginRight, yPos);
            yPos += 10;
          }
        });
      }
      
      // Action Plans Section with improved spacing - FIXED TEXT CLIPPING
      if (actionPlans.length > 0) {
        doc.addPage();
        yPos = 20;
        doc.setFontSize(14);
        doc.setFont('helvetica', 'bold');
        doc.text(t.actionPlanTitle, marginLeft, yPos);
        yPos += 15;
        
        // CRITICAL: Calculate safe widths that NEVER exceed page margins
        const actionTextIndent = marginLeft + 3;
        const safeActionTitleWidth = pageWidth - marginLeft - marginRight - 5; // Safe width for titles
        const safeActionDescWidth = pageWidth - actionTextIndent - marginRight - 5; // Safe width for descriptions
        const actionLineHeight = 4.5;
        
        actionPlans.forEach((plan, index) => {
          // Get translated content
          const translatedPlanTitle = (getTranslatedText('action_title', plan.id) as string) || plan.title;
          const fullTitle = `${t.action} ${index + 1}: ${translatedPlanTitle}`;
          const translatedPlanDescription = (getTranslatedText('action_description', plan.id) as string) || plan.description;
          
          // Calculate wrapped lines with SAFE widths - font size reduced for very long titles
          doc.setFontSize(9); // Slightly smaller font for better fit
          const titleLines = doc.splitTextToSize(fullTitle, safeActionTitleWidth);
          const descLines = doc.splitTextToSize(translatedPlanDescription || '', safeActionDescWidth);
          
          // Estimate total height needed
          const estimatedTitleHeight = titleLines.length * 5;
          const estimatedDescHeight = descLines.length * actionLineHeight;
          const totalEstimatedHeight = estimatedTitleHeight + estimatedDescHeight + 45;
          
          checkPageBreak(Math.min(totalEstimatedHeight, 80)); // Cap at 80 to avoid excessive page breaks
          
          // Render action plan title - each line checked for page break
          doc.setFontSize(9);
          doc.setFont('helvetica', 'bold');
          titleLines.forEach((line: string) => {
            checkPageBreak(6);
            doc.text(line, marginLeft, yPos);
            yPos += 5;
          });
          yPos += 3;
          
          // Render description with proper wrapping - each line checked for page break
          doc.setFontSize(8);
          doc.setFont('helvetica', 'normal');
          descLines.forEach((line: string) => {
            checkPageBreak(5);
            doc.text(line, actionTextIndent, yPos);
            yPos += actionLineHeight;
          });
          yPos += 6;
          
          // Metadata row - compact layout
          checkPageBreak(20);
          doc.setFontSize(7);
          doc.setFont('helvetica', 'bold');
          doc.text(`${t.priority}: ${plan.priority}`, actionTextIndent, yPos);
          doc.text(`${t.status}: ${translateStatus(plan.status)}`, actionTextIndent + 35, yPos);
          doc.text(`${t.progress}: ${plan.progress_percentage || 0}%`, actionTextIndent + 70, yPos);
          yPos += 5;
          
          doc.setFont('helvetica', 'normal');
          if (plan.due_date) {
            const dateFormatLocale = selectedLanguage === 'en' ? 'en-US' : selectedLanguage === 'es' ? 'es-ES' : selectedLanguage === 'fr' ? 'fr-FR' : selectedLanguage === 'de' ? 'de-DE' : 'it-IT';
            doc.text(`${t.dueDate}: ${new Date(plan.due_date).toLocaleDateString(dateFormatLocale)}`, actionTextIndent, yPos);
            yPos += 5;
          }
          
          if (plan.assigned_to) {
            doc.text(`${t.assignedTo}: ${plan.assigned_to}`, actionTextIndent, yPos);
            yPos += 5;
          }
          
          yPos += 8;
          
          // Separator
          if (index < actionPlans.length - 1) {
            checkPageBreak(8);
            doc.setDrawColor(180, 180, 180);
            doc.line(marginLeft, yPos, pageWidth - marginRight, yPos);
            yPos += 10;
          }
        });
      }
      
      // Documented requirements (green) and requirements to verify
      const renderCheckList = (title: string, list: RequirementCheck[], intro: string, withEvidence: boolean) => {
        if (list.length === 0) return;
        doc.addPage();
        yPos = 20;
        doc.setFontSize(14);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(0, 0, 0);
        doc.text(title, marginLeft, yPos);
        yPos += 8;
        if (intro) {
          doc.setFontSize(8);
          doc.setFont('helvetica', 'normal');
          doc.setTextColor(90, 90, 90);
          doc.splitTextToSize(intro, contentWidth).forEach((line: string) => { checkPageBreak(5); doc.text(line, marginLeft, yPos); yPos += 4; });
          doc.setTextColor(0, 0, 0);
          yPos += 4;
        }
        list.forEach((c, index) => {
          checkPageBreak(25);
          doc.setFontSize(9);
          doc.setFont('helvetica', 'bold');
          doc.splitTextToSize(`${index + 1}. ${c.reference}`, contentWidth).forEach((line: string) => { checkPageBreak(5); doc.text(line, marginLeft, yPos); yPos += 5; });
          doc.setFontSize(8);
          doc.setFont('helvetica', 'normal');
          if (c.assessment) {
            doc.splitTextToSize(c.assessment, contentWidth - 3).forEach((line: string) => { checkPageBreak(5); doc.text(line, marginLeft + 3, yPos); yPos += 4.2; });
          }
          if (withEvidence && Array.isArray(c.evidence) && c.evidence.length > 0) {
            doc.setFont('helvetica', 'italic');
            c.evidence.slice(0, 2).forEach((e) => {
              doc.splitTextToSize(`[${e.document}] "${e.quote}"`, contentWidth - 6).forEach((line: string) => { checkPageBreak(5); doc.text(line, marginLeft + 5, yPos); yPos += 4; });
            });
            doc.setFont('helvetica', 'normal');
          }
          if (!withEvidence && Array.isArray(c.recommended_actions) && c.recommended_actions.length > 0) {
            c.recommended_actions.forEach((a) => {
              doc.splitTextToSize(`- ${a}`, contentWidth - 6).forEach((line: string) => { checkPageBreak(5); doc.text(line, marginLeft + 5, yPos); yPos += 4; });
            });
          }
          yPos += 6;
        });
      };
      renderCheckList(uiT.coveredTab, pdfCovered, '', true);
      renderCheckList(uiT.toVerifyTab, pdfToVerify, uiT.toVerifyIntro, false);
      if (pdfNotApplicable.length > 0) {
        checkPageBreak(20);
        doc.setFontSize(9);
        doc.setFont('helvetica', 'bold');
        doc.text(uiT.notApplicableIntro, marginLeft, yPos);
        yPos += 6;
        doc.setFontSize(8);
        doc.setFont('helvetica', 'normal');
        pdfNotApplicable.forEach((c) => {
          doc.splitTextToSize(`- ${c.reference}${c.assessment ? `: ${c.assessment}` : ''}`, contentWidth - 3).forEach((line: string) => { checkPageBreak(5); doc.text(line, marginLeft + 3, yPos); yPos += 4.2; });
        });
      }
      
      // Footer on last page
      const totalPages = doc.getNumberOfPages();
      const dateFormat = selectedLanguage === 'en' ? 'en-US' : selectedLanguage === 'es' ? 'es-ES' : selectedLanguage === 'fr' ? 'fr-FR' : selectedLanguage === 'de' ? 'de-DE' : 'it-IT';
      
      for (let i = 1; i <= totalPages; i++) {
        doc.setPage(i);
        doc.setFontSize(8);
        doc.setTextColor(150, 150, 150);
        doc.text(`${t.page} ${i} ${t.of} ${totalPages}`, pageWidth / 2, pageHeight - 10, { align: 'center' });
        doc.text(`${t.generatedOn} ${new Date().toLocaleDateString(dateFormat)}`, pageWidth - 20, pageHeight - 10, { align: 'right' });
      }
      
      // Save PDF
      doc.save(`valutazione-${assessment.title.substring(0, 30)}-${new Date().toISOString().split('T')[0]}.pdf`);
      
      toast({
        title: t.pdfExported,
        description: t.pdfExportedDesc,
      });
    } catch (error) {
      console.error('Error exporting PDF:', error);
      toast({
        title: t.exportError,
        description: t.exportErrorDesc,
        variant: "destructive",
      });
    }
  };

  const [documentLanguage, setDocumentLanguage] = useState<'it' | 'en'>('it');

  const openConfigDialog = (docType: ConfigDocumentType) => {
    setConfigDocType(docType);
    setConfigDialogOpen(true);
  };

  const handleGenerateWithConfig = async (config: DocumentConfig) => {
    if (!configDocType) return;
    setConfigDialogOpen(false);
    await generateDocument(configDocType, config);
  };

  const generateDocument = async (type: string, userConfig?: DocumentConfig) => {
    try {
      const toastRef = toast({
        title: documentLanguage === 'it' ? "Generazione in corso..." : "Generating...",
        description: documentLanguage === 'it' ? "Il documento verrà generato in background. Potrebbe richiedere 2-3 minuti." : "The document will be generated in the background. This may take 2-3 minutes.",
        duration: 300000, // keep toast visible during generation
      });

      // Fetch user documents associated with this assessment for DPIA context
      const { data: userDocEmbeddings } = await supabase
        .from('user_document_embeddings')
        .select('document_name, section_text')
        .eq('assessment_id', id)
        .order('section_index', { ascending: true })
        .limit(50);

      const userDocumentsSummary = userDocEmbeddings && userDocEmbeddings.length > 0
        ? userDocEmbeddings.reduce((acc: Record<string, string[]>, row) => {
            if (!acc[row.document_name]) acc[row.document_name] = [];
            acc[row.document_name].push(row.section_text);
            return acc;
          }, {} as Record<string, string[]>)
        : null;

      const formattedDocsSummary = userDocumentsSummary
        ? Object.entries(userDocumentsSummary)
            .map(([name, sections]) => `[${name}]: ${(sections as string[]).join(' ').substring(0, 1500)}`)
            .join('\n---\n')
        : '';

      const { data, error } = await supabase.functions.invoke('generate-audit-document', {
        body: {
          documentType: type,
          assessmentId: id,
          conversationHistory: [],
          language: documentLanguage,
          userDocumentsSummary: formattedDocsSummary,
          userConfig: userConfig || null,
        }
      });

      if (error) throw error;

      // If the response indicates async generation, poll for completion
      if (data?.status === 'generating' && data?.document?.id) {
        const docId = data.document.id;
        const maxAttempts = 60; // 5 minutes max (60 * 5s)
        let attempts = 0;

        const pollForDocument = async (): Promise<any> => {
          attempts++;
          const { data: doc, error: pollError } = await supabase
            .from('generated_documents')
            .select('*')
            .eq('id', docId)
            .single();

          if (pollError) throw pollError;

          const status = (doc?.metadata as any)?.status || (doc?.content as any)?._status;

          if (status === 'completed') {
            return doc;
          }

          if (status === 'failed') {
            const errMsg = (doc?.content as any)?._error || (doc?.metadata as any)?.error || 'Generazione fallita';
            throw new Error(errMsg);
          }

          if (attempts >= maxAttempts) {
            throw new Error('Timeout: la generazione ha impiegato troppo tempo. Riprova.');
          }

          // Wait 5 seconds and try again
          await new Promise(resolve => setTimeout(resolve, 5000));
          return pollForDocument();
        };

        const completedDoc = await pollForDocument();

        // Dismiss the "generating" toast
        toastRef.dismiss();

        // Download PDF
        const { exportDocumentToPDF } = await import('@/lib/document-pdf-export');
        exportDocumentToPDF(completedDoc);

        toast({
          title: "✅ Documento generato",
          description: `${type.toUpperCase()} creato e scaricato in formato PDF`,
        });
      } else if (data?.document) {
        // Fallback: synchronous response (shouldn't happen, but handle gracefully)
        toastRef.dismiss();
        const { exportDocumentToPDF } = await import('@/lib/document-pdf-export');
        exportDocumentToPDF(data.document);

        toast({
          title: "✅ Documento generato",
          description: `${type.toUpperCase()} creato e scaricato in formato PDF`,
        });
      }

    } catch (error) {
      console.error('Error generating document:', error);
      toast({
        title: "Errore",
        description: error instanceof Error ? error.message : "Impossibile generare il documento",
        variant: "destructive",
      });
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
          <p className="mt-4 text-muted-foreground">{t.loading}</p>
        </div>
      </div>
    );
  }

  if (!assessment) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <XCircle className="h-16 w-16 text-destructive mx-auto mb-4" />
          <h2 className="text-2xl font-bold mb-2">{t.notFound}</h2>
          <Button onClick={() => navigate('/compliance')}>
            {t.backToHub}
          </Button>
        </div>
      </div>
    );
  }

  const checksPayload = (assessment.requirement_checks || null) as RequirementChecksPayload | null;
  const checks: RequirementCheck[] = Array.isArray(checksPayload?.checks) ? checksPayload!.checks! : [];
  const coveredChecks = checks.filter(c => c.status === 'covered');
  const toVerifyChecks = checks.filter(c => c.status === 'to_verify');
  const notApplicableChecks = checks.filter(c => c.status === 'not_applicable');
  const unreadableDocuments = checksPayload?.unreadable_documents || [];
  const documentsAnalyzed = checksPayload?.documents_analyzed || [];
  const highGaps = gaps.filter(g => riskProfileOf(g.risk_level) === 'high').length;
  const mediumGaps = gaps.filter(g => riskProfileOf(g.risk_level) === 'medium').length;
  const lowGaps = gaps.filter(g => riskProfileOf(g.risk_level) === 'low').length;
  const overallProfile: RiskProfile = overallRiskProfile(gaps);
  const profileLabel: Record<RiskProfile, string> = { high: t.riskHigh, medium: t.riskMedium, low: t.riskLow, none: t.riskNone };
  const analysisInProgress = assessment.status !== 'completed';
  const progressDone = assessment.analysis_progress?.done ?? checks.length;
  const progressTotal = assessment.analysis_progress?.total ?? checksPayload?.total ?? 0;

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto py-8 px-4">
        <div className="flex justify-between items-center mb-6">
          <Button 
            variant="ghost" 
            onClick={() => navigate('/compliance')}
          >
            <ArrowLeft className="mr-2 h-4 w-4" />
            {t.backToHub}
          </Button>
          
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-2">
              <Languages className="h-4 w-4 text-muted-foreground" />
              <Select
                value={selectedLanguage}
                onValueChange={(value) => setSelectedLanguage(value as 'it' | 'en' | 'es' | 'fr' | 'de')}
              >
                <SelectTrigger className="w-[140px] h-9">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="it">🇮🇹 Italiano</SelectItem>
                  <SelectItem value="en">🇬🇧 English</SelectItem>
                  <SelectItem value="es">🇪🇸 Español</SelectItem>
                  <SelectItem value="fr">🇫🇷 Français</SelectItem>
                  <SelectItem value="de">🇩🇪 Deutsch</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Button 
              onClick={exportToPDF}
              disabled={analysisInProgress}
              title={analysisInProgress ? t.resultsPending : undefined}
              variant="outline"
              size="sm"
            >
              <Download className="mr-2 h-3 w-3" />
              {t.exportPDF}
            </Button>
          </div>
        </div>

        {/* Header */}
        <div className="mb-8">
          <div className="flex justify-between items-start mb-4">
            <div>
              <h1 className="text-4xl font-bold mb-2">
                {getTranslatedText('assessmentTitle') || assessment.title}
                {isTranslating && selectedLanguage !== 'it' && (
                  <span className="ml-3 text-base text-muted-foreground font-normal">({t.translating})</span>
                )}
              </h1>
              <p className="text-muted-foreground">{getTranslatedText('assessmentDescription') || assessment.description}</p>
            </div>
            <Badge variant={assessment.status === 'completed' ? 'default' : 'secondary'}>
              {analysisInProgress && providerPaused && !resuming ? t.analysisPausedTitle : translateStatus(assessment.status)}
            </Badge>
          </div>
          <div className="flex gap-4 text-sm text-muted-foreground">
            <span>{t.created}: {new Date(assessment.created_at).toLocaleDateString(dateLocale)}</span>
            {assessment.completed_at && (
              <span>{t.completed}: {new Date(assessment.completed_at).toLocaleDateString(dateLocale)}</span>
            )}
            <span>{t.jurisdiction}: {assessment.scope_jurisdiction}</span>
            <span>{t.sector}: {assessment.scope_sector}</span>
          </div>
        </div>

        {analysisInProgress && (
          <Card className="mb-6 border-primary/40">
            <CardContent className="p-4 space-y-2">
              <div className="flex items-center gap-3">
                {providerPaused && !resuming
                  ? <AlertTriangle className="h-5 w-5 text-amber-600 shrink-0" aria-hidden="true" />
                  : <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-primary shrink-0" aria-hidden="true"></div>}
                <p className="text-sm flex-1" role="status">
                  {providerPaused && !resuming ? t.analysisPaused : t.analysisInProgress}
                  {progressTotal ? ` ${progressDone} / ${progressTotal}` : ''}
                </p>
                {!resuming && assessment.analysis_progress?.status === 'in_progress' && (
                  <Button size="sm" variant="outline" onClick={resumeAnalysis}>{t.resumeAnalysis}</Button>
                )}
              </div>
              {progressTotal ? (
                <Progress value={Math.round((progressDone / Math.max(1, progressTotal)) * 100)} />
              ) : null}
            </CardContent>
          </Card>
        )}

        {/* KPIs */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium">{t.compliance}</CardTitle>
            </CardHeader>
            <CardContent>
              {assessment.status !== 'completed' || assessment.overall_compliance_percentage === null ? (
                <>
                  <div className="text-3xl font-bold mb-2 text-muted-foreground">--</div>
                  <Progress value={0} />
                  <div className="mt-2 text-sm text-muted-foreground">
                    {assessment.status === 'completed'
                      ? 'Nessun requisito valutabile con i documenti caricati'
                      : 'Disponibile al termine dell\'analisi'}
                  </div>
                </>
              ) : (<>
              <div className="text-3xl font-bold mb-2">
                {(assessment.overall_compliance_percentage ?? 0).toFixed(0)}%
              </div>
              <Progress value={assessment.overall_compliance_percentage ?? 0} />
              {(() => {
                const pct = assessment.overall_compliance_percentage ?? 0;
                if (pct >= 90) return (
                  <div className="flex items-center gap-1 mt-2 text-green-600 text-sm">
                    <TrendingUp className="h-3 w-3" />{t.complianceExcellent}
                  </div>
                );
                if (pct >= 75) return (
                  <div className="flex items-center gap-1 mt-2 text-green-600 text-sm">
                    <TrendingUp className="h-3 w-3" />{t.complianceGood}
                  </div>
                );
                if (pct >= 60) return (
                  <div className="flex items-center gap-1 mt-2 text-yellow-600 text-sm">
                    <TrendingDown className="h-3 w-3" />{t.complianceSufficient}
                  </div>
                );
                if (pct >= 40) return (
                  <div className="flex items-center gap-1 mt-2 text-orange-600 text-sm">
                    <TrendingDown className="h-3 w-3" />{t.complianceInsufficient}
                  </div>
                );
                return (
                  <div className="flex items-center gap-1 mt-2 text-destructive text-sm">
                    <TrendingDown className="h-3 w-3" />{t.complianceCritical}
                  </div>
                );
              })()}
              </>)}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium">{t.riskProfile}</CardTitle>
            </CardHeader>
            <CardContent>
              {analysisInProgress ? <p className="text-sm text-muted-foreground">{t.resultsPending}</p> : <>
              <div className={`flex items-center gap-2 text-2xl font-bold mb-2 ${RISK_STYLE[overallProfile].text}`}>
                <span className={`w-4 h-4 rounded-full shrink-0 ${RISK_STYLE[overallProfile].dot}`} />
                {profileLabel[overallProfile]}
              </div>
              <div className="flex gap-1 h-2 rounded-full overflow-hidden bg-muted">
                {gaps.length > 0 ? (
                  <>
                    {highGaps > 0 && <span className={RISK_STYLE.high.dot} style={{ flex: highGaps }} />}
                    {mediumGaps > 0 && <span className={RISK_STYLE.medium.dot} style={{ flex: mediumGaps }} />}
                    {lowGaps > 0 && <span className={RISK_STYLE.low.dot} style={{ flex: lowGaps }} />}
                  </>
                ) : (
                  <span className={`${RISK_STYLE.none.dot} flex-1`} />
                )}
              </div>
              <p className="text-xs text-muted-foreground mt-2">
                {t.riskCounts.replace('{h}', String(highGaps)).replace('{m}', String(mediumGaps)).replace('{l}', String(lowGaps))}
              </p>
              </>}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium">{t.identifiedGaps}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold mb-2">{analysisInProgress ? "--" : gaps.length}</div>
              <p className="text-sm text-muted-foreground">
                {analysisInProgress ? t.resultsPending : `${gaps.filter(g => g.status === 'open').length} ${t.open}`}
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium">{t.requirementsChecked}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold mb-2">{analysisInProgress ? progressDone : checks.length > 0 ? checks.length : gaps.length}</div>
              {checks.length > 0 && (
                <p className="text-sm text-muted-foreground">
                  <span className="text-green-700 dark:text-green-400">{t.documentedCount.replace('{n}', String(coveredChecks.length))}</span>
                  {toVerifyChecks.length > 0 && <>, {t.toVerifyCount.replace('{n}', String(toVerifyChecks.length))}</>}
                </p>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Risk Score Explanation */}
        {!analysisInProgress && <div className="mb-8">
          <RiskScoreExplanation 
            gaps={gaps}
            checks={checks}
            language={selectedLanguage}
          />
        </div>}

        {checks.length > 0 && (
          <CoverageScopeDisclaimer
            regulations={assessment.scope_regulations || []}
            checks={checks}
            unreadableDocuments={unreadableDocuments}
            documentsAnalyzed={documentsAnalyzed}
            language={selectedLanguage}
          />
        )}

        {/* Main Content */}
        <Tabs defaultValue="gaps" className="space-y-4">
          <TabsList className="flex-wrap h-auto">
            <TabsTrigger value="gaps">{t.gapsTab} ({gaps.length})</TabsTrigger>
            {checks.length > 0 && (
              <TabsTrigger value="covered">{t.coveredTab} ({coveredChecks.length})</TabsTrigger>
            )}
            {(toVerifyChecks.length > 0 || notApplicableChecks.length > 0) && (
              <TabsTrigger value="verify">
                {t.toVerifyTab} ({toVerifyChecks.length + notApplicableChecks.length})
              </TabsTrigger>
            )}
            <TabsTrigger value="actions">{t.actionPlanTab} ({actionPlans.length})</TabsTrigger>
            <TabsTrigger value="documents">{t.documentsTab}</TabsTrigger>
          </TabsList>

          <TabsContent value="gaps" className="space-y-4">
            {gaps.length === 0 && (
              <Card>
                <CardContent className="py-12 text-center">
                  {analysisInProgress
                    ? <Info className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                    : <CheckCircle2 className="h-12 w-12 mx-auto text-green-600 mb-4" />}
                  <h3 className="text-lg font-semibold mb-2">{analysisInProgress ? t.resultsPending : t.riskNone}</h3>
                </CardContent>
              </Card>
            )}
            {gaps.map((gap) => {
              const profile = riskProfileOf(gap.risk_level);
              const evidence = Array.isArray(gap.evidence) ? gap.evidence : [];
              const actions = ((getTranslatedText('gap_recommendedActions', gap.id) as string[]) || gap.recommended_actions || []) as any[];
              return (
              <Card key={gap.id} className={`border-l-4 ${profile === 'high' ? 'border-l-red-500' : profile === 'medium' ? 'border-l-orange-500' : 'border-l-yellow-400'}`}>
                <CardHeader>
                  <div className="flex justify-between items-start gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex flex-wrap items-center gap-2 mb-3">
                        <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full border text-xs font-semibold ${RISK_STYLE[profile].badge}`}>
                          <span className={`w-2 h-2 rounded-full ${RISK_STYLE[profile].dot}`} />
                          {t.riskProfile}: {profileLabel[profile]}
                        </span>
                        {gap.coverage_status && (
                          <Badge variant="outline">
                            {gap.coverage_status === 'partial' ? t.docPartial : t.docMissing}
                          </Badge>
                        )}
                        <Badge variant="outline">
                          {translateEffort(gap.remediation_effort)} {t.effort}
                        </Badge>
                      </div>
                      <p className="text-sm text-muted-foreground mb-1">{gap.requirement_reference}</p>
                      <CardTitle className="text-lg mb-2">
                        {getTranslatedText('gap_requirement', gap.id) || gap.requirement_description}
                      </CardTitle>
                      {gap.current_state && (
                        <div className="text-sm mt-2">
                          <span className="font-medium">{t.whatFound}:</span>{' '}
                          {getTranslatedText('gap_currentState', gap.id) || gap.current_state}
                        </div>
                      )}
                      <CardDescription className="mt-2">
                        <span className="font-medium text-foreground">{t.missingElements}:</span>{' '}
                        {((getTranslatedText('gap_description', gap.id) as string) || gap.gap_description).replace(/^(Elementi mancanti|Missing elements):\s*/i, '')}
                      </CardDescription>
                    </div>
                    <div className={`hidden sm:flex flex-col items-center justify-center rounded-lg border px-4 py-3 shrink-0 ${RISK_STYLE[profile].panel}`}>
                      <span className={`w-5 h-5 rounded-full ${RISK_STYLE[profile].dot}`} />
                      <span className={`mt-1 text-xs font-semibold uppercase tracking-wide ${RISK_STYLE[profile].text}`}>{profileLabel[profile]}</span>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  {evidence.length > 0 && (
                    <Collapsible className="mb-4">
                      <CollapsibleTrigger asChild>
                        <Button variant="ghost" size="sm" className="gap-1 text-xs -ml-2">
                          <FileText className="h-3 w-3" />
                          {t.evidenceFound} ({evidence.length})
                          <ChevronDown className="h-3 w-3" />
                        </Button>
                      </CollapsibleTrigger>
                      <CollapsibleContent className="mt-2 space-y-2">
                        {evidence.map((e, i) => (
                          <div key={i} className="rounded-md border border-green-200 bg-green-50 dark:bg-green-950/30 dark:border-green-900 p-3">
                            <p className="text-xs font-medium text-green-800 dark:text-green-200 mb-1">{e.document}</p>
                            <p className="text-xs italic text-foreground">“{e.quote}”</p>
                          </div>
                        ))}
                      </CollapsibleContent>
                    </Collapsible>
                  )}

                  <div className="space-y-2">
                    <h4 className="font-semibold text-sm mb-2">{t.recommendedActions}:</h4>
                    {actions.map((action: any, idx: number) => (
                      <div key={idx} className="bg-muted p-3 rounded-lg flex gap-3">
                        <span className="text-xs font-semibold text-muted-foreground mt-0.5">{idx + 1}.</span>
                        <p className="text-sm">{typeof action === 'string' ? action : action.action}</p>
                      </div>
                    ))}
                  </div>

                  {/* Source traceability */}
                  <div className="flex flex-wrap items-center gap-3 mt-4 pt-3 border-t border-border">
                    {gap.detection_method && (
                      <Badge variant="outline" className="text-xs">
                        {gap.detection_method === 'llm_evidence' ? t.methodAi : t.methodKeyword}
                      </Badge>
                    )}
                    {gap.article_text_excerpt && (
                      <Collapsible>
                        <CollapsibleTrigger asChild>
                          <Button variant="ghost" size="sm" className="gap-1 text-xs">
                            <BookOpen className="h-3 w-3" />
                            {selectedLanguage === 'it' ? 'Vedi fonte normativa' : 'View regulatory source'}
                            <ChevronDown className="h-3 w-3" />
                          </Button>
                        </CollapsibleTrigger>
                        <CollapsibleContent className="mt-2">
                          <div className="bg-muted/50 border border-border rounded-lg p-3 text-xs text-muted-foreground italic leading-relaxed">
                            {gap.article_text_excerpt}
                            {gap.article_text_excerpt.length >= 295 && '...'}
                          </div>
                        </CollapsibleContent>
                      </Collapsible>
                    )}
                  </div>
                </CardContent>
              </Card>
              );
            })}
          </TabsContent>

          <TabsContent value="covered" className="space-y-3">
            {coveredChecks.length === 0 && (
              <Card><CardContent className="py-8 text-center text-muted-foreground">{t.noCovered}</CardContent></Card>
            )}
            {coveredChecks.map((c) => (
              <Card key={c.requirement_id} className="border-l-4 border-l-green-500">
                <CardHeader className="pb-3">
                  <div className="flex flex-wrap items-center gap-2 mb-1">
                    <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full border text-xs font-semibold ${RISK_STYLE.none.badge}`}>
                      <span className={`w-2 h-2 rounded-full ${RISK_STYLE.none.dot}`} />
                      {t.statusDocumented}
                    </span>
                    <span className="text-sm text-muted-foreground">{c.reference}</span>
                  </div>
                  <CardTitle className="text-base">{c.description}</CardTitle>
                  {c.assessment && <CardDescription className="mt-1">{c.assessment}</CardDescription>}
                </CardHeader>
                {(c.evidence?.length > 0 || c.recommended_actions?.length > 0) && (
                  <CardContent className="pt-0 space-y-3">
                    {c.evidence?.length > 0 && (
                      <Collapsible>
                        <CollapsibleTrigger asChild>
                          <Button variant="ghost" size="sm" className="gap-1 text-xs -ml-2">
                            <FileText className="h-3 w-3" />
                            {t.evidenceFound} ({c.evidence.length})
                            <ChevronDown className="h-3 w-3" />
                          </Button>
                        </CollapsibleTrigger>
                        <CollapsibleContent className="mt-2 space-y-2">
                          {c.evidence.map((e, i) => (
                            <div key={i} className="rounded-md border border-green-200 bg-green-50 dark:bg-green-950/30 dark:border-green-900 p-3">
                              <p className="text-xs font-medium text-green-800 dark:text-green-200 mb-1">{e.document}</p>
                              <p className="text-xs italic">“{e.quote}”</p>
                            </div>
                          ))}
                        </CollapsibleContent>
                      </Collapsible>
                    )}
                    {c.recommended_actions?.length > 0 && (
                      <p className="text-xs text-muted-foreground">
                        <span className="font-medium">{t.suggestedActions}:</span> {c.recommended_actions.join(' ')}
                      </p>
                    )}
                  </CardContent>
                )}
              </Card>
            ))}
          </TabsContent>

          <TabsContent value="verify" className="space-y-3">
            {toVerifyChecks.length > 0 && (
              <p className="text-sm text-muted-foreground">{t.toVerifyIntro}</p>
            )}
            {toVerifyChecks.length === 0 && (
              <Card><CardContent className="py-8 text-center text-muted-foreground">{t.noToVerify}</CardContent></Card>
            )}
            {toVerifyChecks.map((c) => (
              <Card key={c.requirement_id} className="border-l-4 border-l-slate-400">
                <CardHeader className="pb-3">
                  <div className="flex flex-wrap items-center gap-2 mb-1">
                    <Badge variant="secondary">{t.statusToVerify}</Badge>
                    <span className="text-sm text-muted-foreground">{c.reference}</span>
                  </div>
                  <CardTitle className="text-base">{c.description}</CardTitle>
                  {c.applicability_note && (
                    <CardDescription className="mt-1">
                      <span className="font-medium text-foreground">{t.appliesWhen}:</span> {c.applicability_note}
                    </CardDescription>
                  )}
                  {c.assessment && <CardDescription className="mt-1">{c.assessment}</CardDescription>}
                </CardHeader>
                {c.recommended_actions?.length > 0 && (
                  <CardContent className="pt-0">
                    <div className="space-y-2">
                      {c.recommended_actions.map((a, i) => (
                        <div key={i} className="bg-muted p-3 rounded-lg text-sm">{a}</div>
                      ))}
                    </div>
                  </CardContent>
                )}
              </Card>
            ))}
            {notApplicableChecks.length > 0 && (
              <div className="pt-4">
                <p className="text-sm text-muted-foreground mb-2">{t.notApplicableIntro}</p>
                <div className="space-y-2">
                  {(() => {
                    // Quando una normativa intera è esclusa la motivazione è la stessa per decine
                    // di requisiti: raggrupparli evita un muro di righe identiche.
                    const groups = new Map<string, RequirementCheck[]>();
                    for (const c of notApplicableChecks) {
                      const key = `${c.regulation}|${c.assessment || ''}`;
                      groups.set(key, [...(groups.get(key) || []), c]);
                    }
                    return Array.from(groups.entries()).map(([key, items]) => (
                      items.length > 3 ? (
                        <div key={key} className="rounded-md border p-3">
                          <div className="flex flex-wrap items-center gap-2">
                            <Badge variant="outline">{t.statusNotApplicable}</Badge>
                            <span className="text-sm font-medium">
                              {items[0].regulation}: {items.length} requisiti
                            </span>
                          </div>
                          {items[0].assessment && (
                            <p className="text-xs text-muted-foreground mt-1">{items[0].assessment}</p>
                          )}
                          <p className="text-xs text-muted-foreground mt-2">
                            {items.slice(0, 12).map(i => i.reference).join(' · ')}
                            {items.length > 12 ? ` · e altri ${items.length - 12}` : ''}
                          </p>
                        </div>
                      ) : (
                        items.map(c => (
                          <div key={c.requirement_id} className="rounded-md border p-3">
                            <div className="flex flex-wrap items-center gap-2">
                              <Badge variant="outline">{t.statusNotApplicable}</Badge>
                              <span className="text-sm font-medium">{c.reference}</span>
                            </div>
                            {c.assessment && <p className="text-xs text-muted-foreground mt-1">{c.assessment}</p>}
                          </div>
                        ))
                      )
                    ));
                  })()}
                </div>
              </div>
            )}
          </TabsContent>

          <TabsContent value="actions" className="space-y-4">
            {actionPlans.length === 0 ? (
              <Card>
                <CardContent className="py-12 text-center">
                  <CheckCircle2 className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                  <h3 className="text-lg font-semibold mb-2">{t.noActionPlan}</h3>
                  <p className="text-muted-foreground">
                    {t.noActionPlanDesc}
                  </p>
                </CardContent>
              </Card>
            ) : (
              actionPlans.map((plan) => (
                <Card key={plan.id}>
                  <CardHeader>
                    <div className="flex justify-between items-start">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          <Badge variant="outline">{t.priority} {plan.priority}</Badge>
                          <Badge variant={
                            plan.status === 'completed' ? 'default' :
                            plan.status === 'in_progress' ? 'secondary' : 'outline'
                          }>
                            {translateStatus(plan.status)}
                          </Badge>
                        </div>
                        <CardTitle className="text-base mb-2">
                          {getTranslatedText('action_title', plan.id) || plan.title}
                        </CardTitle>
                        <CardDescription>
                          {getTranslatedText('action_description', plan.id) || plan.description}
                        </CardDescription>
                      </div>
                    </div>
                  </CardHeader>
                  {plan.progress_percentage > 0 && (
                    <CardContent>
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">{t.progress}</span>
                      <span className="font-medium">{plan.progress_percentage}%</span>
                    </div>
                    <Progress value={plan.progress_percentage} />
                  </div>
                    </CardContent>
                  )}
                </Card>
              ))
            )}
          </TabsContent>

          <TabsContent value="documents">
            <Card>
              <CardHeader>
                <div className="flex justify-between items-start">
                  <div>
                    <CardTitle>{t.generateDocsTitle}</CardTitle>
                    <CardDescription>
                      {t.generateDocsDesc}
                    </CardDescription>
                  </div>
                  <div className="flex items-center gap-2">
                    <Languages className="h-4 w-4 text-muted-foreground" />
                    <Select
                      value={documentLanguage}
                      onValueChange={(value) => setDocumentLanguage(value as 'it' | 'en')}
                    >
                      <SelectTrigger className="w-[130px] h-9">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="it">🇮🇹 Italiano</SelectItem>
                        <SelectItem value="en">🇬🇧 English</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <Button 
                    variant="outline" 
                    className="justify-start h-auto py-4"
                    onClick={() => openConfigDialog('dpia')}
                  >
                    <FileText className="mr-2 h-5 w-5" />
                    <div className="text-left">
                      <div className="font-semibold">DPIA</div>
                      <div className="text-xs text-muted-foreground">
                        Data Protection Impact Assessment
                      </div>
                    </div>
                  </Button>


                  <Button 
                    variant="outline" 
                    className="justify-start h-auto py-4"
                    onClick={() => openConfigDialog('lia')}
                  >
                    <FileText className="mr-2 h-5 w-5" />
                    <div className="text-left">
                      <div className="font-semibold">LIA</div>
                      <div className="text-xs text-muted-foreground">
                        Legitimacy Impact Assessment (AI Act)
                      </div>
                    </div>
                  </Button>

                  <Button 
                    variant="outline" 
                    className="justify-start h-auto py-4"
                    onClick={() => openConfigDialog('risk_analysis')}
                  >
                    <FileText className="mr-2 h-5 w-5" />
                    <div className="text-left">
                      <div className="font-semibold">Analisi Rischi Art. 24</div>
                      <div className="text-xs text-muted-foreground">
                        Analisi generica dei rischi ex Art. 24 GDPR
                      </div>
                    </div>
                  </Button>

                  <Button 
                    variant="outline" 
                    className="justify-start h-auto py-4"
                    onClick={() => generateDocument('gap_report')}
                  >
                    <Download className="mr-2 h-5 w-5" />
                    <div className="text-left">
                      <div className="font-semibold">Gap Report</div>
                      <div className="text-xs text-muted-foreground">
                        Executive Gap Analysis Report
                      </div>
                    </div>
                  </Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
        <DocumentConfigDialog
          open={configDialogOpen}
          onOpenChange={setConfigDialogOpen}
          documentType={configDocType}
          assessment={assessment}
          gaps={gaps}
          onGenerate={handleGenerateWithConfig}
        />
      </div>
    </div>
  );
}
