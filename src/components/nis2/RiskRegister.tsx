import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Loader2, AlertTriangle, TrendingUp } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";

const RISK_COLORS = {
  very_low: "bg-green-500",
  low: "bg-blue-500",
  medium: "bg-yellow-500",
  high: "bg-orange-500",
  very_high: "bg-red-500",
};

export function RiskRegister() {
  const [loading, setLoading] = useState(false);
  const [assessmentId, setAssessmentId] = useState("");
  const [assessments, setAssessments] = useState<any[]>([]);
  const [risks, setRisks] = useState<any[]>([]);

  useEffect(() => {
    loadAssessments();
    loadRisks();
  }, []);

  const loadAssessments = async () => {
    const { data } = await supabase
      .from('compliance_assessments')
      .select('*')
      .order('created_at', { ascending: false });
    
    if (data) setAssessments(data);
  };

  const loadRisks = async () => {
    const { data } = await supabase
      .from('risk_register')
      .select('*')
      .order('residual_risk_score', { ascending: false });
    
    if (data) setRisks(data);
  };

  const handleGenerate = async () => {
    if (!assessmentId) {
      toast.error("Seleziona un assessment");
      return;
    }

    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('generate-risk-register', {
        body: { assessmentId }
      });

      if (error) throw error;

      toast.success(`${data.count} rischi generati con successo!`);
      loadRisks();
    } catch (error: any) {
      console.error('Error:', error);
      toast.error(error.message || "Errore nella generazione");
    } finally {
      setLoading(false);
    }
  };

  const getRiskLevelBadge = (level: string) => {
    const colors: Record<string, string> = {
      very_low: "bg-green-100 text-green-800 border-green-300",
      low: "bg-blue-100 text-blue-800 border-blue-300",
      medium: "bg-yellow-100 text-yellow-800 border-yellow-300",
      high: "bg-orange-100 text-orange-800 border-orange-300",
      very_high: "bg-red-100 text-red-800 border-red-300",
    };
    return colors[level] || colors.medium;
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5" />
            Registro Rischi NIS2
          </CardTitle>
          <CardDescription>
            Genera e gestisci registro rischi conforme ISO 27005 e ACN
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <label className="text-sm font-medium mb-2 block">Assessment di Riferimento</label>
            <Select value={assessmentId} onValueChange={setAssessmentId}>
              <SelectTrigger>
                <SelectValue placeholder="Seleziona assessment" />
              </SelectTrigger>
              <SelectContent>
                {assessments.map(a => (
                  <SelectItem key={a.id} value={a.id}>
                    {a.title} ({Math.round(a.overall_compliance_percentage)}% compliance)
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <Button 
            onClick={handleGenerate} 
            disabled={loading}
            className="w-full"
            size="lg"
          >
            {loading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Generazione in corso...
              </>
            ) : (
              <>
                <AlertTriangle className="mr-2 h-4 w-4" />
                Genera Registro Rischi
              </>
            )}
          </Button>
        </CardContent>
      </Card>

      {risks.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <span>Rischi Identificati</span>
              <Badge variant="outline">{risks.length} totali</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {risks.slice(0, 10).map((risk) => (
                <Card key={risk.id} className="border-l-4" style={{ borderLeftColor: `hsl(var(--${risk.residual_risk_score > 7 ? 'destructive' : risk.residual_risk_score > 4 ? 'warning' : 'success'}))` }}>
                  <CardHeader className="pb-3">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <Badge variant="outline" className="font-mono text-xs">
                            {risk.risk_id}
                          </Badge>
                          <Badge className={getRiskLevelBadge(risk.likelihood)}>
                            {risk.likelihood}
                          </Badge>
                        </div>
                        <CardTitle className="text-base">{risk.risk_title}</CardTitle>
                        <p className="text-sm text-muted-foreground mt-1">
                          {risk.risk_description}
                        </p>
                      </div>
                      <div className="text-right">
                        <div className="text-2xl font-bold text-primary">
                          {risk.residual_risk_score.toFixed(1)}
                        </div>
                        <p className="text-xs text-muted-foreground">Risk Score</p>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    <div className="flex items-center gap-4 text-sm">
                      <div className="flex-1">
                        <p className="text-muted-foreground mb-1">Categoria</p>
                        <Badge variant="secondary">{risk.risk_category}</Badge>
                      </div>
                      <div className="flex-1">
                        <p className="text-muted-foreground mb-1">Strategia</p>
                        <Badge variant="outline">{risk.risk_appetite}</Badge>
                      </div>
                      <div className="flex-1">
                        <p className="text-muted-foreground mb-1">Owner</p>
                        <p className="font-medium">{risk.owner || 'Non assegnato'}</p>
                      </div>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground mb-2">Riduzione rischio</p>
                      <Progress 
                        value={((risk.inherent_risk_score - risk.residual_risk_score) / risk.inherent_risk_score) * 100} 
                        className="h-2"
                      />
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
