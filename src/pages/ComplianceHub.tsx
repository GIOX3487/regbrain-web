import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { useToast } from "@/hooks/use-toast";
import { MobileNav } from "@/components/MobileNav";
import {
  AlertTriangle,
  CheckCircle2,
  FileText,
  TrendingUp,
  ListTodo,
  Plus,
  BarChart3,
  Shield,
  ArrowLeft,
  Activity,
  Target,
  Zap,
  Globe,
  Trash2
} from "lucide-react";
import { RISK_STYLE, riskProfileOf, overallRiskProfile, type RiskProfile } from "@/components/compliance/RiskScoreExplanation";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

interface Assessment {
  id: string;
  title: string;
  assessment_type: string;
  overall_risk_score: number;
  overall_compliance_percentage: number;
  status: string;
  created_at: string;
}

interface Gap {
  id: string;
  requirement_reference: string;
  gap_description: string;
  risk_level: string;
  risk_score: number;
  priority: number;
  status: string;
}

export default function ComplianceHub() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [assessments, setAssessments] = useState<Assessment[]>([]);
  const [gaps, setGaps] = useState<Gap[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  useEffect(() => {
    checkAuthAndLoadData();
  }, []);

  const checkAuthAndLoadData = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    setIsAuthenticated(!!session);
    if (session) {
      await loadData();
    } else {
      setLoading(false);
    }
  };

  const loadData = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      // Load assessments
      const { data: assessmentsData, error: assessmentsError } = await supabase
        .from('compliance_assessments')
        .select('*')
        .order('created_at', { ascending: false });

      if (assessmentsError) throw assessmentsError;
      setAssessments(assessmentsData || []);

      // Load all gaps for dashboard overview
      const { data: gapsData, error: gapsError } = await supabase
        .from('identified_gaps')
        .select('*')
        .in('status', ['open', 'in_progress'])
        .order('priority', { ascending: true });

      if (gapsError) throw gapsError;
      setGaps(gapsData || []);

    } catch (error) {
      console.error('Error loading data:', error);
      toast({
        title: "Errore",
        description: "Impossibile caricare i dati",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteAssessment = async (assessmentId: string, e: React.MouseEvent) => {
    e.stopPropagation(); // Prevent card click
    
    try {
      // First delete related records (gaps, action plans, benchmarks)
      await supabase.from('action_plans').delete().eq('assessment_id', assessmentId);
      await supabase.from('identified_gaps').delete().eq('assessment_id', assessmentId);
      await supabase.from('assessment_benchmarks').delete().eq('assessment_id', assessmentId);
      
      // Then delete the assessment
      const { error } = await supabase
        .from('compliance_assessments')
        .delete()
        .eq('id', assessmentId);

      if (error) throw error;

      // Update local state
      setAssessments(prev => prev.filter(a => a.id !== assessmentId));

      toast({
        title: "Valutazione eliminata",
        description: "La valutazione è stata eliminata con successo",
      });
      
      // Reload gaps data
      await loadData();
    } catch (error) {
      console.error('Error deleting assessment:', error);
      toast({
        title: "Errore",
        description: "Impossibile eliminare la valutazione",
        variant: "destructive",
      });
    }
  };


  const highGaps = gaps.filter(g => riskProfileOf(g.risk_level) === 'high').length;
  const mediumGaps = gaps.filter(g => riskProfileOf(g.risk_level) === 'medium').length;
  const lowGaps = gaps.filter(g => riskProfileOf(g.risk_level) === 'low').length;
  const hubProfile = overallRiskProfile(gaps);
  const hubProfileLabel: Record<RiskProfile, string> = { high: 'Alto', medium: 'Medio', low: 'Basso', none: 'Nessuno' };
  const profileOfScore = (score: number | null | undefined): RiskProfile =>
    !score || score <= 0 ? 'none' : score >= 66 ? 'high' : score >= 36 ? 'medium' : 'low';
  // Solo le valutazioni concluse hanno una percentuale: includere le altre come zero
  // farebbe crollare la media nel momento stesso in cui si avvia una nuova analisi.
  const completedWithScore = assessments.filter(
    a => a.status === 'completed' && typeof a.overall_compliance_percentage === 'number',
  );
  const avgCompliance = completedWithScore.length > 0
    ? completedWithScore.reduce((acc, a) => acc + a.overall_compliance_percentage, 0) / completedWithScore.length
    : null;

  return (
    <div className="min-h-screen bg-background pb-20 lg:pb-0">
      <MobileNav />
      {!isAuthenticated ? (
        <div className="container mx-auto py-16 px-4 text-center">
          <Shield className="h-24 w-24 mx-auto text-primary mb-6" />
          <h1 className="text-4xl font-bold mb-4">Compliance Hub</h1>
          <p className="text-xl text-muted-foreground mb-8">
            Gap analysis • Risk assessment • Audit documentation • Predictive analytics
          </p>
          <p className="text-muted-foreground mb-6 max-w-2xl mx-auto">
            Accedi per gestire le tue valutazioni di conformità, identificare gap normativi, 
            generare documenti audit e utilizzare l'analisi predittiva del rischio.
          </p>
          <Button onClick={() => navigate('/auth')} size="lg">
            Accedi per iniziare
          </Button>
        </div>
      ) : (
        <div className="container mx-auto py-4 sm:py-8 px-4">
        {/* Header */}
        <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4 mb-6 sm:mb-8">
          <div className="w-full lg:w-auto">
            <Button 
              variant="ghost" 
              onClick={() => navigate('/chat')}
              className="mb-3 sm:mb-4"
              size="sm"
            >
              <ArrowLeft className="mr-2 h-4 w-4" />
              <span className="hidden sm:inline">Torna alla Chat</span>
              <span className="sm:hidden">Chat</span>
            </Button>
            <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold mb-2">Compliance hub</h1>
            <p className="text-sm sm:text-base text-muted-foreground">
              Le tue gap analysis: documenti confrontati con i requisiti delle normative, con evidenze e profilo di rischio
            </p>
          </div>
          <div className="flex gap-2 flex-wrap w-full lg:w-auto">
            <Button 
              onClick={() => navigate('/compliance/new-assessment')}
              size="sm"
              className="w-full sm:w-auto min-h-[44px]"
            >
              <Plus className="mr-2 h-4 w-4" />
              Nuova gap analysis
            </Button>
          </div>
        </div>

        {/* Document Preparation Guide */}
        {assessments.length === 0 && (
          <Card className="mb-6 border-primary/50 bg-primary/5">
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <FileText className="h-5 w-5 text-primary" />
                Documenti necessari per la compliance
              </CardTitle>
              <CardDescription>
                Prima di iniziare una nuova analisi, assicurati di avere questi documenti pronti
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid md:grid-cols-3 gap-4 text-sm">
                <div className="space-y-2">
                  <h4 className="font-semibold text-primary">📋 Policy aziendali</h4>
                  <ul className="space-y-1 text-muted-foreground">
                    <li>• Privacy Policy</li>
                    <li>• Information Security Policy</li>
                    <li>• Cookie Policy</li>
                    <li>• Data Retention Policy</li>
                    <li>• Acceptable Use Policy</li>
                  </ul>
                </div>
                <div className="space-y-2">
                  <h4 className="font-semibold text-primary">🔐 Procedure operative</h4>
                  <ul className="space-y-1 text-muted-foreground">
                    <li>• Data Breach Response Plan</li>
                    <li>• Access Control Procedure</li>
                    <li>• Backup & Recovery Plan</li>
                    <li>• Incident Response Plan</li>
                    <li>• Change Management</li>
                  </ul>
                </div>
                <div className="space-y-2">
                  <h4 className="font-semibold text-primary">📊 Registri GDPR</h4>
                  <ul className="space-y-1 text-muted-foreground">
                    <li>• Registro Art. 30 (trattamenti)</li>
                    <li>• Elenco fornitori + DPA</li>
                    <li>• DPIA (se necessario)</li>
                    <li>• Registro data breach</li>
                    <li>• Formazione dipendenti</li>
                  </ul>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* KPI Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 mb-6 sm:mb-8">
          <Card>
            <CardHeader className="pb-2 sm:pb-3">
              <CardTitle className="text-xs sm:text-sm font-medium flex items-center gap-1.5 sm:gap-2">
                <Shield className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-blue-500 shrink-0" />
                <span className="truncate">Compliance</span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl sm:text-3xl font-bold">
                {avgCompliance === null ? '--' : `${avgCompliance.toFixed(1)}%`}
              </div>
              <Progress value={avgCompliance ?? 0} className="mt-2" />
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2 sm:pb-3">
              <CardTitle className="text-xs sm:text-sm font-medium flex items-center gap-1.5 sm:gap-2">
                <TrendingUp className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-orange-500 shrink-0" />
                <span className="truncate">Rischio</span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className={`text-2xl sm:text-3xl font-bold flex items-center gap-2 ${RISK_STYLE[hubProfile].text}`}>
                <span className={`w-3.5 h-3.5 rounded-full shrink-0 ${RISK_STYLE[hubProfile].dot}`} />
                {hubProfileLabel[hubProfile]}
              </div>
              <p className="text-xs sm:text-sm text-muted-foreground mt-1">{highGaps} alti, {mediumGaps} medi, {lowGaps} bassi</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2 sm:pb-3">
              <CardTitle className="text-xs sm:text-sm font-medium flex items-center gap-1.5 sm:gap-2">
                <AlertTriangle className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-red-500 shrink-0" />
                <span className="truncate">Gap a rischio alto</span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl sm:text-3xl font-bold">{highGaps}</div>
              <p className="text-xs sm:text-sm text-muted-foreground mt-1">
                su {gaps.length} gap aperti
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2 sm:pb-3">
              <CardTitle className="text-xs sm:text-sm font-medium flex items-center gap-1.5 sm:gap-2">
                <BarChart3 className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-green-500 shrink-0" />
                <span className="truncate">Valutazioni</span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl sm:text-3xl font-bold">{assessments.length}</div>
              <p className="text-xs sm:text-sm text-muted-foreground mt-1">
                {assessments.filter(a => a.status === 'completed').length} completate
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Main Content */}
        <div className="space-y-4">
          <h2 className="text-lg font-semibold">Valutazioni</h2>
          <div className="space-y-4">
            {assessments.length === 0 ? (
              <Card>
                <CardContent className="py-12 text-center">
                  <FileText className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                  <h3 className="text-lg font-semibold mb-2">Nessuna valutazione</h3>
                  <p className="text-muted-foreground mb-4">
                    Inizia creando la tua prima valutazione
                  </p>
                  <Button onClick={() => navigate('/compliance/new-assessment')}>
                    <Plus className="mr-2 h-4 w-4" />
                    Crea valutazione
                  </Button>
                </CardContent>
              </Card>
            ) : (
              assessments.map((assessment) => (
                <Card 
                  key={assessment.id}
                  className="cursor-pointer hover:shadow-lg transition-shadow"
                  onClick={() => navigate(`/compliance/assessment/${assessment.id}`)}
                >
                  <CardHeader>
                    <div className="flex justify-between items-start">
                      <div className="flex-1">
                        <CardTitle>{assessment.title}</CardTitle>
                        <CardDescription className="mt-2">
                          Tipo: {assessment.assessment_type} • 
                          Creata: {new Date(assessment.created_at).toLocaleDateString('it-IT')}
                        </CardDescription>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant={assessment.status === 'completed' ? 'default' : 'secondary'}>
                          {assessment.status}
                        </Badge>
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button 
                              variant="ghost" 
                              size="icon"
                              className="h-8 w-8 text-muted-foreground hover:text-destructive"
                              onClick={(e) => e.stopPropagation()}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent onClick={(e) => e.stopPropagation()}>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Eliminare questa valutazione?</AlertDialogTitle>
                              <AlertDialogDescription>
                                Questa azione non può essere annullata. Verranno eliminati anche tutti i gap e i piani d'azione associati a questa valutazione.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Annulla</AlertDialogCancel>
                              <AlertDialogAction 
                                onClick={(e) => handleDeleteAssessment(assessment.id, e)}
                                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                              >
                                Elimina
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <p className="text-sm text-muted-foreground mb-1">Compliance</p>
                        <div className="flex items-center gap-2">
                          <Progress value={assessment.overall_compliance_percentage || 0} className="flex-1" />
                          <span className="text-sm font-medium">
                            {(assessment.overall_compliance_percentage || 0).toFixed(0)}%
                          </span>
                        </div>
                      </div>
                      <div>
                        <p className="text-sm text-muted-foreground mb-1">Profilo di rischio</p>
                        {(() => {
                          const p = assessment.status === 'completed' ? profileOfScore(assessment.overall_risk_score) : 'none';
                          return (
                            <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full border text-xs font-semibold ${RISK_STYLE[p].badge}`}>
                              <span className={`w-2 h-2 rounded-full ${RISK_STYLE[p].dot}`} />
                              {assessment.status === 'completed' ? hubProfileLabel[p] : 'In analisi'}
                            </span>
                          );
                        })()}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))
            )}
          </div>
        </div>
        </div>
      )}
    </div>
  );
}
