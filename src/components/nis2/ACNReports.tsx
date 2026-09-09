import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Loader2, FileText, Send } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";

const REPORT_TYPES = [
  { value: "incident", label: "Incident Report" },
  { value: "annual_compliance", label: "Annual Compliance Report" },
  { value: "risk_assessment", label: "Risk Assessment Report" },
  { value: "audit", label: "Audit Report" },
];

export function ACNReports() {
  const [loading, setLoading] = useState(false);
  const [reportType, setReportType] = useState("");
  const [periodStart, setPeriodStart] = useState("");
  const [periodEnd, setPeriodEnd] = useState("");
  const [reports, setReports] = useState<any[]>([]);

  useEffect(() => {
    loadReports();
  }, []);

  const loadReports = async () => {
    const { data } = await supabase
      .from('acn_reports')
      .select('*')
      .order('created_at', { ascending: false });
    
    if (data) setReports(data);
  };

  const handleGenerate = async () => {
    if (!reportType || !periodStart || !periodEnd) {
      toast.error("Compila tutti i campi obbligatori");
      return;
    }

    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('generate-acn-report', {
        body: {
          reportType,
          periodStart,
          periodEnd
        }
      });

      if (error) throw error;

      toast.success("Report ACN generato con successo!");
      loadReports();
    } catch (error: any) {
      console.error('Error:', error);
      toast.error(error.message || "Errore nella generazione");
    } finally {
      setLoading(false);
    }
  };

  const getStatusBadge = (status: string) => {
    const variants: Record<string, any> = {
      draft: { variant: "secondary", label: "Bozza" },
      submitted: { variant: "default", label: "Inviato" },
      acknowledged: { variant: "success", label: "Confermato" },
    };
    const config = variants[status] || variants.draft;
    return <Badge variant={config.variant}>{config.label}</Badge>;
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Report ACN
          </CardTitle>
          <CardDescription>
            Genera report formali per l'Agenzia per la Cybersicurezza Nazionale
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <label className="text-sm font-medium mb-2 block">Tipo di Report</label>
            <Select value={reportType} onValueChange={setReportType}>
              <SelectTrigger>
                <SelectValue placeholder="Seleziona tipo" />
              </SelectTrigger>
              <SelectContent>
                {REPORT_TYPES.map(type => (
                  <SelectItem key={type.value} value={type.value}>
                    {type.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-medium mb-2 block">Periodo Inizio</label>
              <Input
                type="date"
                value={periodStart}
                onChange={(e) => setPeriodStart(e.target.value)}
              />
            </div>
            <div>
              <label className="text-sm font-medium mb-2 block">Periodo Fine</label>
              <Input
                type="date"
                value={periodEnd}
                onChange={(e) => setPeriodEnd(e.target.value)}
              />
            </div>
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
                <FileText className="mr-2 h-4 w-4" />
                Genera Report ACN
              </>
            )}
          </Button>
        </CardContent>
      </Card>

      {reports.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Report Generati</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {reports.map((report) => (
                <Card key={report.id}>
                  <CardHeader className="pb-3">
                    <div className="flex items-start justify-between">
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <Badge variant="outline">
                            {REPORT_TYPES.find(t => t.value === report.report_type)?.label}
                          </Badge>
                          {getStatusBadge(report.status)}
                        </div>
                        <p className="text-sm text-muted-foreground">
                          {new Date(report.reporting_period_start).toLocaleDateString('it-IT')} - 
                          {new Date(report.reporting_period_end).toLocaleDateString('it-IT')}
                        </p>
                      </div>
                      <Button variant="outline" size="sm">
                        <Send className="h-4 w-4 mr-2" />
                        Invia ad ACN
                      </Button>
                    </div>
                  </CardHeader>
                </Card>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
