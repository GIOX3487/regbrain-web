import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Loader2, Target, CheckCircle2, Clock } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";

export function RemediationOrchestrator() {
  const [loading, setLoading] = useState(false);
  const [assessmentId, setAssessmentId] = useState("");
  const [workflowType, setWorkflowType] = useState("semi_automated");
  const [assessments, setAssessments] = useState<any[]>([]);
  const [workflows, setWorkflows] = useState<any[]>([]);

  useEffect(() => {
    loadAssessments();
    loadWorkflows();
  }, []);

  const loadAssessments = async () => {
    const { data } = await supabase
      .from('compliance_assessments')
      .select('*')
      .order('created_at', { ascending: false });
    
    if (data) setAssessments(data);
  };

  const loadWorkflows = async () => {
    const { data } = await supabase
      .from('remediation_workflows')
      .select('*')
      .order('created_at', { ascending: false });
    
    if (data) setWorkflows(data);
  };

  const handleOrchestrate = async () => {
    if (!assessmentId) {
      toast.error("Seleziona un assessment");
      return;
    }

    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('orchestrate-remediation', {
        body: {
          assessmentId,
          workflowType
        }
      });

      if (error) throw error;

      toast.success("Workflow di remediation creato!");
      loadWorkflows();
    } catch (error: any) {
      console.error('Error:', error);
      toast.error(error.message || "Errore nell'orchestrazione");
    } finally {
      setLoading(false);
    }
  };

  const getPhaseColor = (phase: string) => {
    const colors: Record<string, string> = {
      planning: "bg-blue-100 text-blue-800",
      execution: "bg-yellow-100 text-yellow-800",
      verification: "bg-orange-100 text-orange-800",
      completed: "bg-green-100 text-green-800",
    };
    return colors[phase] || colors.planning;
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Target className="h-5 w-5" />
            Orchestratore Remediation
          </CardTitle>
          <CardDescription>
            Crea workflow automatizzati per remediation gap compliance
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <label className="text-sm font-medium mb-2 block">Assessment</label>
            <Select value={assessmentId} onValueChange={setAssessmentId}>
              <SelectTrigger>
                <SelectValue placeholder="Seleziona assessment" />
              </SelectTrigger>
              <SelectContent>
                {assessments.map(a => (
                  <SelectItem key={a.id} value={a.id}>
                    {a.title}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <label className="text-sm font-medium mb-2 block">Tipo di Workflow</label>
            <Select value={workflowType} onValueChange={setWorkflowType}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="automated">Completamente Automatico</SelectItem>
                <SelectItem value="semi_automated">Semi-Automatico</SelectItem>
                <SelectItem value="manual">Manuale</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <Button 
            onClick={handleOrchestrate} 
            disabled={loading}
            className="w-full"
            size="lg"
          >
            {loading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Orchestrazione in corso...
              </>
            ) : (
              <>
                <Target className="mr-2 h-4 w-4" />
                Crea Workflow
              </>
            )}
          </Button>
        </CardContent>
      </Card>

      {workflows.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Workflow Attivi</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {workflows.map((workflow) => {
                const completionPercentage = workflow.total_actions > 0 
                  ? (workflow.completed_actions / workflow.total_actions) * 100 
                  : 0;

                return (
                  <Card key={workflow.id}>
                    <CardHeader>
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <CardTitle className="text-base">{workflow.workflow_name}</CardTitle>
                          <p className="text-sm text-muted-foreground mt-1">
                            {workflow.completed_actions} / {workflow.total_actions} azioni completate
                          </p>
                        </div>
                        <Badge className={getPhaseColor(workflow.current_phase)}>
                          {workflow.current_phase}
                        </Badge>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div>
                        <div className="flex items-center justify-between text-sm mb-2">
                          <span className="text-muted-foreground">Progresso</span>
                          <span className="font-medium">{completionPercentage.toFixed(0)}%</span>
                        </div>
                        <Progress value={completionPercentage} className="h-2" />
                      </div>

                      <div className="grid grid-cols-2 gap-4 text-sm">
                        <div>
                          <p className="text-muted-foreground flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            Data target
                          </p>
                          <p className="font-medium">
                            {workflow.target_completion_date 
                              ? new Date(workflow.target_completion_date).toLocaleDateString('it-IT')
                              : 'Non definita'}
                          </p>
                        </div>
                        <div>
                          <p className="text-muted-foreground flex items-center gap-1">
                            <CheckCircle2 className="h-3 w-3" />
                            Stato
                          </p>
                          <p className="font-medium capitalize">{workflow.status}</p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
