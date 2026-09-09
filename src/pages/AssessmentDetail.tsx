import { useState, useEffect, useMemo } from "react";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { useNavigate, useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
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
import { RiskScoreExplanation } from "@/components/compliance/RiskScoreExplanation";
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

const SCOPE_ESTIMATES: Record<string, number> = {
  'GDPR': 35, 'NIS2': 20, 'DORA': 25, 'AI Act': 30, 'CRA': 15,
  'Data Act': 15, 'ISO 27001': 20, 'D.Lgs 81/08': 25, 'Legge Protezione Dati Albania': 15,
};
const SCOPE_CATALOG: Record<string, number> = {
  'GDPR': 10, 'NIS2': 5, 'DORA': 5, 'AI Act': 7, 'CRA': 3,
  'Data Act': 3, 'ISO 27001': 5, 'D.Lgs 81/08': 5, 'Legge Protezione Dati Albania': 3,
};

function CoverageScopeDisclaimer({ regulations, gapsCount, compliancePercentage }: { 
  regulations: string[]; gapsCount: number; compliancePercentage: number 
}) {
  const breakdown = regulations.map(reg => {
    const keyEst = Object.keys(SCOPE_ESTIMATES).find(k => k.toLowerCase() === reg.toLowerCase());
    const keyCat = Object.keys(SCOPE_CATALOG).find(k => k.toLowerCase() === reg.toLowerCase());
    const total = keyEst ? SCOPE_ESTIMATES[keyEst] : 15;
    const analyzed = keyCat ? SCOPE_CATALOG[keyCat] : 3;
    const ratio = analyzed / total;
    const depth = ratio >= 0.7 ? 'comprehensive' : ratio >= 0.4 ? 'standard' : 'basic';
    return { regulation: reg, analyzed, total, depth };
  });
  const totalAnalyzed = breakdown.reduce((s, b) => s + b.analyzed, 0);
  const totalEst = breakdown.reduce((s, b) => s + b.total, 0);

  return (
    <Card className="bg-muted/50 border-muted mb-8">
      <CardContent className="p-4">
        <div className="flex items-start gap-2">
          <Info className="h-5 w-5 text-muted-foreground mt-0.5 shrink-0" />
          <div>
            <p className="text-sm text-muted-foreground">
              Analisi basata su {totalAnalyzed} requisiti chiave su {totalEst} totali stimati. 
              Per una valutazione esaustiva, si consiglia un audit completo con un consulente certificato.
            </p>
            <div className="mt-2 flex flex-wrap gap-2">
              {breakdown.map(reg => (
                <Badge 
                  key={reg.regulation} 
                  variant={reg.depth === 'comprehensive' ? 'default' : reg.depth === 'standard' ? 'secondary' : 'outline'}
                >
                  {reg.regulation}: {reg.analyzed}/{reg.total}
                </Badge>
              ))}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export default function AssessmentDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
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
      overallRisk: 'Rischio Complessivo',
      critical: 'critici',
      high: 'alti',
      identifiedGaps: 'Gap Identificati',
      open: 'aperti',
      potentialFines: 'Sanzioni Potenziali',
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
      riskScore: 'Punteggio di Rischio',
      fine: 'Sanzione',
      recommendedActions: 'Azioni Raccomandate',
      noDocuments: 'Nessun documento generato',
      noDocumentsDesc: 'I documenti generati appariranno qui',
      status: 'Stato',
      description: 'Descrizione',
      timeline: 'Scadenze',
      cost: 'Costo',
      assignedTo: 'Assegnato a',
      notAssigned: 'Non assegnato',
      progress: 'Progresso',
      currentState: 'Stato attuale',
      hoursAbbr: 'h',
      estimatedHoursTooltip: 'Ore stimate per completare questa azione. Stime basate su benchmark di mercato per consulenze compliance.',
      estimatedCostTooltip: 'Costo stimato di implementazione (tariffa: €85/h). Stime indicative basate su benchmark di mercato.',
      fineTooltip: 'I massimali sanzionatori sono legalmente accurati al 100%, derivati direttamente dagli articoli citati di ogni normativa.',
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
      statusResolved: 'risolto'
    },
    en: {
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
      overallRisk: 'Overall Risk',
      critical: 'critical',
      high: 'high',
      identifiedGaps: 'Identified Gaps',
      open: 'open',
      potentialFines: 'Potential Sanctions',
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
      riskScore: 'Risk Score',
      fine: 'Sanction',
      recommendedActions: 'Recommended Actions',
      noDocuments: 'No documents generated',
      noDocumentsDesc: 'Generated documents will appear here',
      status: 'Status',
      description: 'Description',
      timeline: 'Timeline',
      cost: 'Cost',
      assignedTo: 'Assigned to',
      notAssigned: 'Not assigned',
      progress: 'Progress',
      currentState: 'Current State',
      hoursAbbr: 'h',
      estimatedHoursTooltip: 'Estimated hours to complete this action. Based on compliance consulting market benchmarks.',
      estimatedCostTooltip: 'Estimated implementation cost (rate: €85/h). Indicative estimates based on market benchmarks.',
      fineTooltip: 'Penalty thresholds are 100% legally accurate, derived directly from the cited articles of each regulation.',
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
      statusResolved: 'resolved'
    },
    es: {
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
      overallRisk: 'Riesgo General',
      critical: 'críticos',
      high: 'altos',
      identifiedGaps: 'Brechas Identificadas',
      open: 'abiertas',
      potentialFines: 'Sanciones Potenciales',
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
      riskScore: 'Puntuación de Riesgo',
      fine: 'Sanción',
      recommendedActions: 'Acciones Recomendadas',
      noDocuments: 'No hay documentos generados',
      noDocumentsDesc: 'Los documentos generados aparecerán aquí',
      status: 'Estado',
      description: 'Descripción',
      timeline: 'Cronología',
      cost: 'Costo',
      assignedTo: 'Asignado a',
      notAssigned: 'No asignado',
      progress: 'Progreso',
      currentState: 'Estado Actual',
      hoursAbbr: 'h',
      estimatedHoursTooltip: 'Horas estimadas para completar esta acción. Basadas en benchmarks del mercado de consultoría.',
      estimatedCostTooltip: 'Costo estimado de implementación (tarifa: €85/h). Estimaciones indicativas basadas en benchmarks.',
      fineTooltip: 'Los umbrales sancionatorios son 100% legalmente precisos, derivados directamente de los artículos citados.',
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
      statusResolved: 'resuelto'
    },
    fr: {
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
      overallRisk: 'Risque Global',
      critical: 'critiques',
      high: 'élevés',
      identifiedGaps: 'Écarts Identifiés',
      open: 'ouverts',
      potentialFines: 'Sanctions Potentielles',
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
      riskScore: 'Score de Risque',
      fine: 'Sanction',
      recommendedActions: 'Actions Recommandées',
      noDocuments: 'Aucun document généré',
      noDocumentsDesc: 'Les documents générés apparaîtront ici',
      status: 'Statut',
      description: 'Description',
      timeline: 'Chronologie',
      cost: 'Coût',
      assignedTo: 'Assigné à',
      notAssigned: 'Non assigné',
      progress: 'Progrès',
      currentState: 'État actuel',
      hoursAbbr: 'h',
      estimatedHoursTooltip: 'Heures estimées pour réaliser cette action. Basées sur les benchmarks du marché du conseil.',
      estimatedCostTooltip: 'Coût estimé de mise en œuvre (tarif: €85/h). Estimations indicatives basées sur les benchmarks.',
      fineTooltip: 'Les seuils de sanctions sont 100% juridiquement précis, dérivés directement des articles cités.',
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
      statusResolved: 'résolu'
    },
    de: {
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
      overallRisk: 'Gesamtrisiko',
      critical: 'kritisch',
      high: 'hoch',
      identifiedGaps: 'Identifizierte Lücken',
      open: 'offen',
      potentialFines: 'Potenzielle Sanktionen',
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
      riskScore: 'Risikobewertung',
      fine: 'Sanktion',
      recommendedActions: 'Empfohlene Maßnahmen',
      noDocuments: 'Keine Dokumente generiert',
      noDocumentsDesc: 'Generierte Dokumente werden hier angezeigt',
      status: 'Status',
      description: 'Beschreibung',
      timeline: 'Zeitplan',
      cost: 'Kosten',
      assignedTo: 'Zugewiesen an',
      notAssigned: 'Nicht zugewiesen',
      progress: 'Fortschritt',
      currentState: 'Aktueller Zustand',
      hoursAbbr: 'Std',
      estimatedHoursTooltip: 'Geschätzte Stunden zur Fertigstellung dieser Aktion. Basierend auf Markt-Benchmarks.',
      estimatedCostTooltip: 'Geschätzte Implementierungskosten (Satz: €85/h). Richtwerte basierend auf Markt-Benchmarks.',
      fineTooltip: 'Die Sanktionshöchstgrenzen sind zu 100% rechtlich korrekt und direkt aus den zitierten Artikeln abgeleitet.',
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
      statusResolved: 'gelöst'
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

  const t = useMemo(() => uiTranslations[selectedLanguage] || uiTranslations.it, [selectedLanguage]);
  const dateLocale = useMemo(() => 
    selectedLanguage === 'en' ? 'en-US' : 
    selectedLanguage === 'es' ? 'es-ES' : 
    selectedLanguage === 'fr' ? 'fr-FR' : 
    selectedLanguage === 'de' ? 'de-DE' : 'it-IT',
  [selectedLanguage]);

  useEffect(() => {
    loadAssessment();
  }, [id]);

  const loadAssessment = async () => {
    try {
      const { data: assessmentData, error: assessmentError } = await supabase
        .from('compliance_assessments')
        .select('*')
        .eq('id', id)
        .single();

      if (assessmentError) throw assessmentError;
      setAssessment(assessmentData);

      const { data: gapsData, error: gapsError } = await supabase
        .from('identified_gaps')
        .select('*')
        .eq('assessment_id', id)
        .order('priority', { ascending: true });

      if (gapsError) throw gapsError;
      setGaps(gapsData || []);

      const { data: plansData, error: plansError } = await supabase
        .from('action_plans')
        .select('*')
        .eq('assessment_id', id)
        .order('priority', { ascending: true });

      if (plansError) throw plansError;
      setActionPlans(plansData || []);

    } catch (error) {
      console.error('Error loading assessment:', error);
      toast({
        title: "Errore",
        description: "Impossibile caricare la valutazione",
        variant: "destructive",
      });
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
        overallRisk: 'Rischio Complessivo',
        identifiedGaps: 'Gap Identificati',
        critical: 'critici',
        high: 'alti',
        potentialFines: 'Sanzioni Potenziali',
        actionsInPlan: 'Azioni nel Piano',
        gapsDetailTitle: 'Gap Identificati - Dettaglio Completo',
        gap: 'Gap',
        reference: 'Riferimento',
        riskLevel: 'Livello di Rischio',
        riskScore: 'Punteggio Rischio',
        priority: 'Priorità',
        potentialFine: 'Sanzione Potenziale',
        requirement: 'Requisito',
        currentState: 'Stato Attuale',
        gapDescription: 'Descrizione Gap',
        recommendedActions: 'Azioni Raccomandate',
        actionPlanTitle: 'Piano d\'Azione Dettagliato',
        action: 'Azione',
        hours: 'ore',
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
        overallRisk: 'Overall Risk',
        identifiedGaps: 'Identified Gaps',
        critical: 'critical',
        high: 'high',
        potentialFines: 'Potential Sanctions',
        actionsInPlan: 'Actions in Plan',
        gapsDetailTitle: 'Identified Gaps - Full Detail',
        gap: 'Gap',
        reference: 'Reference',
        riskLevel: 'Risk Level',
        riskScore: 'Risk Score',
        priority: 'Priority',
        potentialFine: 'Potential Sanction',
        requirement: 'Requirement',
        currentState: 'Current State',
        gapDescription: 'Gap Description',
        recommendedActions: 'Recommended Actions',
        actionPlanTitle: 'Detailed Action Plan',
        action: 'Action',
        hours: 'hours',
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
        overallRisk: 'Riesgo General',
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
        potentialFines: 'Sanciones Potenciales',
        actionsInPlan: 'Acciones en el Plan',
        gapsDetailTitle: 'Brechas Identificadas - Detalle Completo',
        gap: 'Brecha',
        reference: 'Referencia',
        riskLevel: 'Nivel de Riesgo',
        riskScore: 'Puntuación de Riesgo',
        priority: 'Prioridad',
        potentialFine: 'Sanción Potencial',
        requirement: 'Requisito',
        currentState: 'Estado Actual',
        gapDescription: 'Descripción de Brecha',
        recommendedActions: 'Acciones Recomendadas',
        actionPlanTitle: 'Plan de Acción Detallado',
        action: 'Acción',
        hours: 'horas',
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
        overallRisk: 'Risque Global',
        identifiedGaps: 'Lacunes Identifiées',
        critical: 'critiques',
        high: 'élevées',
        potentialFines: 'Sanctions Potentielles',
        actionsInPlan: 'Actions dans le Plan',
        gapsDetailTitle: 'Lacunes Identifiées - Détail Complet',
        gap: 'Lacune',
        reference: 'Référence',
        riskLevel: 'Niveau de Risque',
        riskScore: 'Score de Risque',
        priority: 'Priorité',
        potentialFine: 'Sanction Potentielle',
        requirement: 'Exigence',
        currentState: 'État Actuel',
        gapDescription: 'Description de la Lacune',
        recommendedActions: 'Actions Recommandées',
        actionPlanTitle: 'Plan d\'Action Détaillé',
        action: 'Action',
        hours: 'heures',
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
        overallRisk: 'Gesamtrisiko',
        identifiedGaps: 'Identifizierte Lücken',
        critical: 'kritisch',
        high: 'hoch',
        potentialFines: 'Potenzielle Sanktionen',
        actionsInPlan: 'Maßnahmen im Plan',
        gapsDetailTitle: 'Identifizierte Lücken - Vollständige Details',
        gap: 'Lücke',
        reference: 'Referenz',
        riskLevel: 'Risikoniveau',
        riskScore: 'Risikobewertung',
        priority: 'Priorität',
        potentialFine: 'Potenzielle Sanktion',
        requirement: 'Anforderung',
        currentState: 'Aktueller Stand',
        gapDescription: 'Lückenbeschreibung',
        recommendedActions: 'Empfohlene Maßnahmen',
        actionPlanTitle: 'Detaillierter Aktionsplan',
        action: 'Maßnahme',
        hours: 'Stunden',
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
      
      // Show annual revenue used for fine calculation
      const annualRevenue = assessment.annual_revenue_eur || 5000000;
      const revenueLabel = selectedLanguage === 'it' ? 'Fatturato di riferimento' : selectedLanguage === 'es' ? 'Facturación de referencia' : selectedLanguage === 'fr' ? 'Chiffre d\'affaires de référence' : selectedLanguage === 'de' ? 'Referenzumsatz' : 'Reference revenue';
      doc.text(`${revenueLabel}: €${annualRevenue.toLocaleString()}`, 25, yPos);
      yPos += 6;
      
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
      const totalFines = gaps.reduce((sum, gap) => sum + (gap.potential_fine_eur || 0), 0);
      const criticalGaps = gaps.filter(g => g.risk_level === 'critical').length;
      const highGaps = gaps.filter(g => g.risk_level === 'high').length;
      
      doc.text(`• ${t.compliance}: ${assessment.overall_compliance_percentage ?? 0}%`, 25, yPos);
      yPos += 8;
      doc.text(`• ${t.overallRisk}: ${assessment.overall_risk_score ?? 0}/100`, 25, yPos);
      yPos += 8;
      doc.text(`• ${t.identifiedGaps}: ${gaps.length} (${criticalGaps} ${t.critical}, ${highGaps} ${t.high})`, 25, yPos);
      yPos += 8;
      doc.text(`• ${t.potentialFines}: €${(totalFines / 1000000).toFixed(2)}M`, 25, yPos);
      yPos += 8;
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
      
      const totalRemediation = actionPlans.reduce((sum, p) => sum + (p.estimated_cost_eur || 0), 0);
      const totalHours = actionPlans.reduce((sum, p) => sum + (p.estimated_hours || 0), 0);
      const complianceLevel = (assessment.overall_compliance_percentage || 0) >= 80 ? (selectedLanguage === 'it' ? 'buono' : 'good') : 
        (assessment.overall_compliance_percentage || 0) >= 60 ? (selectedLanguage === 'it' ? 'sufficiente' : 'sufficient') : 
        (assessment.overall_compliance_percentage || 0) >= 40 ? (selectedLanguage === 'it' ? 'insufficiente' : 'insufficient') : (selectedLanguage === 'it' ? 'critico' : 'critical');
      
      const summaryText = selectedLanguage === 'it' 
        ? `L'analisi di conformità ha valutato ${assessment.scope_regulations?.join(', ') || 'le normative selezionate'} identificando ${gaps.length} gap di conformità, di cui ${criticalGaps} critici e ${highGaps} ad alto rischio. Il livello di compliance complessivo è del ${assessment.overall_compliance_percentage ?? 0}% (${complianceLevel}), con un punteggio di rischio di ${assessment.overall_risk_score ?? 0}/100. Le sanzioni potenziali stimate ammontano a €${(totalFines / 1000000).toFixed(2)}M. Il piano di remediation prevede un investimento di €${totalRemediation.toLocaleString()} e circa ${totalHours} ore di lavoro per colmare tutti i gap identificati.`
        : `The compliance analysis evaluated ${assessment.scope_regulations?.join(', ') || 'selected regulations'} identifying ${gaps.length} compliance gaps, including ${criticalGaps} critical and ${highGaps} high-risk. Overall compliance is ${assessment.overall_compliance_percentage ?? 0}% (${complianceLevel}), with a risk score of ${assessment.overall_risk_score ?? 0}/100. Estimated potential fines total €${(totalFines / 1000000).toFixed(2)}M. The remediation plan requires an investment of €${totalRemediation.toLocaleString()} and approximately ${totalHours} hours.`;
      
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
          
          // Risk info - compact single row
          checkPageBreak(15);
          doc.setFontSize(7);
          doc.setFont('helvetica', 'bold');
          doc.text(`${t.riskLevel}: ${translateRiskLevel(gap.risk_level).toUpperCase()}`, gapTextIndent, yPos);
          doc.text(`${t.priority}: ${gap.priority}`, gapTextIndent + 45, yPos);
          doc.text(`${t.status}: ${translateStatus(gap.status)}`, gapTextIndent + 80, yPos);
          yPos += 5;
          doc.setFont('helvetica', 'normal');
          doc.text(`${t.riskScore}: ${gap.risk_score}/100`, gapTextIndent, yPos);
          doc.text(`${t.potentialFine}: €${((gap.potential_fine_eur || 0) / 1000).toFixed(0)}K`, gapTextIndent + 45, yPos);
          if (gap.remediation_effort) {
            doc.text(`${t.effort}: ${translateEffort(gap.remediation_effort)}`, gapTextIndent + 90, yPos);
          }
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
          let metadataX = actionTextIndent;
          if (plan.estimated_hours) {
            doc.text(`${plan.estimated_hours} ${t.hours}`, metadataX, yPos);
            metadataX += 30;
          }
          if (plan.estimated_cost_eur) {
            doc.text(`€${plan.estimated_cost_eur.toLocaleString()}`, metadataX, yPos);
            metadataX += 35;
          }
          if (plan.due_date) {
            const dateFormatLocale = selectedLanguage === 'en' ? 'en-US' : selectedLanguage === 'es' ? 'es-ES' : selectedLanguage === 'fr' ? 'fr-FR' : selectedLanguage === 'de' ? 'de-DE' : 'it-IT';
            doc.text(`${t.dueDate}: ${new Date(plan.due_date).toLocaleDateString(dateFormatLocale)}`, metadataX, yPos);
          }
          yPos += 5;
          
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
      
      // Investment Summary
      if (actionPlans.length > 0) {
        yPos += 5;
        checkPageBreak(30);
        
        const totalInvestmentHours = actionPlans.reduce((sum, p) => sum + (p.estimated_hours || 0), 0);
        const totalInvestmentCost = actionPlans.reduce((sum, p) => sum + (p.estimated_cost_eur || 0), 0);
        
        doc.setDrawColor(20, 60, 120);
        doc.setLineWidth(0.5);
        doc.line(marginLeft, yPos, pageWidth - marginRight, yPos);
        yPos += 8;
        
        doc.setFontSize(10);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(20, 60, 120);
        const investmentTitle = selectedLanguage === 'it' ? 'Riepilogo Investimento' : selectedLanguage === 'es' ? 'Resumen de Inversión' : selectedLanguage === 'fr' ? 'Résumé de l\'Investissement' : selectedLanguage === 'de' ? 'Investitionsübersicht' : 'Investment Summary';
        doc.text(investmentTitle, marginLeft, yPos);
        yPos += 8;
        
        doc.setTextColor(0, 0, 0);
        doc.setFontSize(9);
        doc.setFont('helvetica', 'normal');
        
        const investLabel1 = selectedLanguage === 'it' ? 'Ore totali stimate' : 'Total estimated hours';
        const investLabel2 = selectedLanguage === 'it' ? 'Investimento totale stimato' : 'Total estimated investment';
        const investLabel3 = selectedLanguage === 'it' ? 'Sanzioni potenziali evitate' : 'Potential fines avoided';
        const investLabel4 = selectedLanguage === 'it' ? 'ROI della remediation' : 'Remediation ROI';
        
        doc.text(`${investLabel1}: ${totalInvestmentHours} ore`, marginLeft + 3, yPos);
        yPos += 6;
        doc.text(`${investLabel2}: €${totalInvestmentCost.toLocaleString()}`, marginLeft + 3, yPos);
        yPos += 6;
        
        const totalPotentialFines = gaps.reduce((sum, g) => sum + (g.potential_fine_eur || 0), 0);
        doc.text(`${investLabel3}: €${totalPotentialFines.toLocaleString()}`, marginLeft + 3, yPos);
        yPos += 6;
        
        if (totalInvestmentCost > 0) {
          const roi = Math.round(totalPotentialFines / totalInvestmentCost);
          doc.setFont('helvetica', 'bold');
          doc.text(`${investLabel4}: ${roi}x`, marginLeft + 3, yPos);
          doc.setFont('helvetica', 'normal');
          yPos += 6;
        }
        
        yPos += 4;
        doc.setFontSize(7);
        doc.setTextColor(120, 120, 120);
        const disclaimer = selectedLanguage === 'it' 
          ? 'Nota: le stime di costo sono calcolate con una tariffa oraria di riferimento di €85/h. I costi effettivi possono variare in base al fornitore e alla complessità specifica.'
          : 'Note: cost estimates are calculated using a reference hourly rate of €85/h. Actual costs may vary based on provider and specific complexity.';
        const disclaimerLines = doc.splitTextToSize(disclaimer, contentWidth);
        disclaimerLines.forEach((line: string) => {
          doc.text(line, marginLeft + 3, yPos);
          yPos += 4;
        });
        doc.setTextColor(0, 0, 0);
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

  const getRiskBadgeColor = (level: string): "default" | "destructive" | "outline" | "secondary" => {
    const colors: Record<string, "default" | "destructive" | "outline" | "secondary"> = {
      critical: 'destructive',
      high: 'destructive',
      medium: 'default',
      low: 'secondary'
    };
    return colors[level] || 'default';
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

  const criticalGaps = gaps.filter(g => g.risk_level === 'critical').length;
  const highGaps = gaps.filter(g => g.risk_level === 'high').length;
  const totalFines = gaps.reduce((acc, g) => acc + (g.potential_fine_eur || 0), 0);

  // Coverage scope estimation — aligned with backend TOTAL_REQUIREMENTS_ESTIMATE
  const TOTAL_REQUIREMENTS_ESTIMATE: Record<string, number> = {
    'GDPR': 35, 'NIS2': 20, 'DORA': 25, 'AI Act': 30, 'CRA': 15,
    'Data Act': 15, 'ISO 27001': 20, 'D.Lgs 81/08': 25, 'Legge Protezione Dati Albania': 15,
  };
  // Catalog sizes (how many requirements we actually check per regulation)
  const CATALOG_SIZES: Record<string, number> = {
    'GDPR': 10, 'NIS2': 5, 'DORA': 5, 'AI Act': 7, 'CRA': 3,
    'Data Act': 3, 'ISO 27001': 5, 'D.Lgs 81/08': 5, 'Legge Protezione Dati Albania': 3,
  };
  const totalEstimatedReqs = (assessment.scope_regulations || []).reduce((sum, reg) => {
    const key = Object.keys(TOTAL_REQUIREMENTS_ESTIMATE).find(k => k.toLowerCase() === reg.toLowerCase());
    return sum + (key ? TOTAL_REQUIREMENTS_ESTIMATE[key] : 15);
  }, 0);
  const analyzedReqs = (assessment.scope_regulations || []).reduce((sum, reg) => {
    const key = Object.keys(CATALOG_SIZES).find(k => k.toLowerCase() === reg.toLowerCase());
    return sum + (key ? CATALOG_SIZES[key] : 3);
  }, 0);
  const coveragePercent = totalEstimatedReqs > 0 ? Math.min(100, Math.round((analyzedReqs / totalEstimatedReqs) * 100)) : 0;

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
              {assessment.status}
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

        {/* KPIs */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium">{t.compliance}</CardTitle>
            </CardHeader>
            <CardContent>
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
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium">{t.overallRisk}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-destructive mb-2">
                {(assessment.overall_risk_score ?? 0).toFixed(0)}/100
              </div>
              <Progress value={assessment.overall_risk_score ?? 0} />
              <p className="text-xs text-muted-foreground mt-2">
                {criticalGaps} {t.critical}, {highGaps} {t.high}
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium">{t.identifiedGaps}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold mb-2">{gaps.length}</div>
              <p className="text-sm text-muted-foreground">
                {gaps.filter(g => g.status === 'open').length} {t.open}
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium">{t.potentialFines}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-destructive mb-2">
                €{(totalFines / 1000000).toFixed(1)}M
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Risk Score Explanation */}
        <div className="mb-8">
          <RiskScoreExplanation 
            overallRiskScore={assessment.overall_risk_score}
            gaps={gaps}
            language={selectedLanguage}
          />
        </div>

        {/* Main Content */}
        <Tabs defaultValue="gaps" className="space-y-4">
          <TabsList>
            <TabsTrigger value="gaps">{t.gapsTab} ({gaps.length})</TabsTrigger>
            <TabsTrigger value="actions">{t.actionPlanTab} ({actionPlans.length})</TabsTrigger>
            <TabsTrigger value="documents">{t.documentsTab}</TabsTrigger>
          </TabsList>

          <TabsContent value="gaps" className="space-y-4">
            {gaps.map((gap) => (
              <Card key={gap.id}>
                <CardHeader>
                  <div className="flex justify-between items-start">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-3">
                        <Badge variant={getRiskBadgeColor(gap.risk_level)}>
                          {translateRiskLevel(gap.risk_level)}
                        </Badge>
                        <Badge variant="outline">
                          {t.priority} {gap.priority}
                        </Badge>
                        <Badge variant="outline">
                          {translateEffort(gap.remediation_effort)} {t.effort}
                        </Badge>
                        <span className="text-sm text-muted-foreground">
                          {gap.requirement_reference}
                        </span>
                      </div>
                      <CardTitle className="text-lg mb-2">
                        {getTranslatedText('gap_requirement', gap.id) || gap.requirement_description}
                      </CardTitle>
                      <CardDescription>
                        {getTranslatedText('gap_description', gap.id) || gap.gap_description}
                      </CardDescription>
                      {gap.current_state && (
                        <p className="text-sm mt-2">
                          <span className="font-medium">{t.currentState}:</span>{' '}
                          {getTranslatedText('gap_currentState', gap.id) || gap.current_state}
                        </p>
                      )}
                    </div>
                    <div className="text-right ml-4">
                      <div className="text-3xl font-bold text-destructive">
                        {gap.risk_score.toFixed(0)}
                      </div>
                      <p className="text-xs text-muted-foreground">{t.riskScore}</p>
                      {gap.potential_fine_eur > 0 && (
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <p className="text-sm text-destructive mt-2 cursor-help flex items-center gap-1">
                              {t.fine}: €{(gap.potential_fine_eur / 1000000).toFixed(1)}M
                              <Info className="h-3 w-3 text-muted-foreground" />
                            </p>
                          </TooltipTrigger>
                          <TooltipContent side="left" className="max-w-xs">
                            <p className="text-xs">{t.fineTooltip}</p>
                          </TooltipContent>
                        </Tooltip>
                      )}
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    <h4 className="font-semibold text-sm mb-2">{t.recommendedActions}:</h4>
                    {((getTranslatedText('gap_recommendedActions', gap.id) as string[]) || gap.recommended_actions)?.map((action: any, idx: number) => (
                      <div key={idx} className="bg-muted p-3 rounded-lg">
                        <p className="text-sm mb-2">{typeof action === 'string' ? action : action.action}</p>
                        {typeof action !== 'string' && (
                          <div className="flex gap-4 text-xs text-muted-foreground">
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <span className="cursor-help">⏱ {action.estimated_hours}{t.hoursAbbr}</span>
                              </TooltipTrigger>
                              <TooltipContent>
                                <p>{t.estimatedHoursTooltip || 'Estimated hours to complete'}</p>
                              </TooltipContent>
                            </Tooltip>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <span className="cursor-help">💰 €{action.estimated_cost_eur?.toLocaleString()}</span>
                              </TooltipTrigger>
                              <TooltipContent>
                                <p>{t.estimatedCostTooltip || 'Estimated implementation cost'}</p>
                              </TooltipContent>
                            </Tooltip>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>

                  {/* Source traceability */}
                  <div className="flex items-center gap-3 mt-4 pt-3 border-t border-border">
                    {gap.detection_method && (
                      <Badge variant="outline" className="text-xs">
                        {gap.detection_method === 'keyword' ? 'Analisi testuale' : gap.detection_method === 'semantic' ? '📐 Semantic' : '🤖 LLM Discovery'}
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
            ))}
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
                      <div className="text-right ml-4">
                        {plan.estimated_cost_eur > 0 && (
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <div className="text-xl font-bold cursor-help flex items-center justify-end gap-1">
                                💰 €{plan.estimated_cost_eur?.toLocaleString()}
                              </div>
                            </TooltipTrigger>
                            <TooltipContent>
                              <p>{t.estimatedCostTooltip || 'Estimated implementation cost'}</p>
                            </TooltipContent>
                          </Tooltip>
                        )}
                        {plan.estimated_hours > 0 && (
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <p className="text-sm text-muted-foreground cursor-help flex items-center justify-end gap-1">
                                ⏱ {plan.estimated_hours}{t.hoursAbbr}
                              </p>
                            </TooltipTrigger>
                            <TooltipContent>
                              <p>{t.estimatedHoursTooltip || 'Estimated hours to complete'}</p>
                            </TooltipContent>
                          </Tooltip>
                        )}
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
