import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Loader2, FileText, Download } from "lucide-react";
import { Badge } from "@/components/ui/badge";

const POLICY_TYPES = [
  { value: "incident_response", label: "Incident Response" },
  { value: "data_protection", label: "Data Protection" },
  { value: "access_control", label: "Access Control" },
  { value: "business_continuity", label: "Business Continuity" },
  { value: "supplier_security", label: "Supplier Security" },
  { value: "vulnerability_management", label: "Vulnerability Management" },
  { value: "asset_management", label: "Asset Management" },
  { value: "cryptography", label: "Cryptography" },
];

export function PolicyGenerator() {
  const [loading, setLoading] = useState(false);
  const [policyType, setPolicyType] = useState("");
  const [context, setContext] = useState("");
  const [generatedPolicies, setGeneratedPolicies] = useState<any[]>([]);

  const handleGenerate = async () => {
    if (!policyType) {
      toast.error("Seleziona un tipo di policy");
      return;
    }

    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('generate-policy', {
        body: {
          policyType,
          organizationContext: context
        }
      });

      if (error) throw error;

      toast.success("Policy generata con successo!");
      loadPolicies();
    } catch (error: any) {
      console.error('Error:', error);
      toast.error(error.message || "Errore nella generazione");
    } finally {
      setLoading(false);
    }
  };

  const loadPolicies = async () => {
    const { data } = await supabase
      .from('generated_policies')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(10);
    
    if (data) setGeneratedPolicies(data);
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Generatore Policy NIS2
          </CardTitle>
          <CardDescription>
            Genera policy aziendali conformi a D.lgs. 138/2024 e linee guida ACN
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <label className="text-sm font-medium mb-2 block">Tipo di Policy</label>
            <Select value={policyType} onValueChange={setPolicyType}>
              <SelectTrigger>
                <SelectValue placeholder="Seleziona tipo di policy" />
              </SelectTrigger>
              <SelectContent>
                {POLICY_TYPES.map(type => (
                  <SelectItem key={type.value} value={type.value}>
                    {type.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <label className="text-sm font-medium mb-2 block">
              Contesto Organizzativo (Opzionale)
            </label>
            <Textarea
              placeholder="Es: Azienda finanziaria con 500 dipendenti, infrastruttura cloud AWS..."
              value={context}
              onChange={(e) => setContext(e.target.value)}
              rows={3}
            />
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
                Genera Policy
              </>
            )}
          </Button>
        </CardContent>
      </Card>

      {generatedPolicies.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Policy Generate</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {generatedPolicies.map((policy) => (
                <div key={policy.id} className="flex items-center justify-between p-4 border rounded-lg hover:bg-accent/50 transition-colors">
                  <div className="flex-1">
                    <h4 className="font-semibold">{policy.title}</h4>
                    <p className="text-sm text-muted-foreground">
                      {policy.policy_type} - Versione {policy.version}
                    </p>
                    <Badge variant={policy.status === 'active' ? 'default' : 'secondary'} className="mt-1">
                      {policy.status}
                    </Badge>
                  </div>
                  <Button variant="outline" size="sm">
                    <Download className="h-4 w-4 mr-2" />
                    Scarica
                  </Button>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
