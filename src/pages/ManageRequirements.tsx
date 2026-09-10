import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase, supabaseHttpUrl } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft, Download, RefreshCw, Check, CheckCheck, Edit, Loader2, Database, BookOpen, Sparkles } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

interface Requirement {
  id: string;
  requirement_id: string;
  regulation: string;
  reference: string;
  article_number: number;
  description_it: string;
  description_en: string;
  risk_level: string;
  remediation_effort: string;
  coverage_keywords: string[];
  gap_description_it: string;
  recommended_action_it: string;
  action_hours: number;
  action_cost_eur: number;
  coverage_threshold: number;
  min_keyword_matches: number;
  source: string;
  verified: boolean;
  active: boolean;
}

const REGULATIONS = ['GDPR', 'NIS2', 'DORA', 'AI Act', 'CRA', 'Data Act', 'ISO 27001', 'D.Lgs 81/08'];

const HARDCODED_COUNTS: Record<string, number> = {
  'GDPR': 10, 'NIS2': 5, 'DORA': 5, 'AI Act': 7, 'CRA': 3,
  'Data Act': 2, 'ISO 27001': 4, 'D.Lgs 81/08': 5,
};

export default function ManageRequirements() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [requirements, setRequirements] = useState<Requirement[]>([]);
  const [loading, setLoading] = useState(true);
  const [extracting, setExtracting] = useState<string | null>(null);
  const [selectedReg, setSelectedReg] = useState('GDPR');
  const [editReq, setEditReq] = useState<Requirement | null>(null);
  const [cleaning, setCleaning] = useState(false);
  const [cleanupReport, setCleanupReport] = useState<any>(null);
  const [balancing, setBalancing] = useState(false);
  const [balanceReport, setBalanceReport] = useState<any>(null);

  useEffect(() => { loadRequirements(); }, []);

  const loadRequirements = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('regulatory_requirements')
      .select('*')
      .order('regulation')
      .order('article_number');
    if (error) {
      toast({ title: 'Errore', description: error.message, variant: 'destructive' });
    } else {
      setRequirements((data as any[]) || []);
    }
    setLoading(false);
  };

  const extractRequirements = async (regulation: string) => {
    setExtracting(regulation);
    let totalExtracted = 0;
    let totalArticles = 0;
    let offset = 0;
    const batchLimit = 30;

    try {
      const { data: { session } } = await supabase.auth.getSession();
      const supabaseUrl = supabaseHttpUrl;

      while (true) {
        toast({
          title: `⏳ Estrazione ${regulation}...`,
          description: `Processando articoli da ${offset + 1}...`,
        });

        const res = await fetch(
          `${supabaseUrl}/functions/v1/extract-requirements`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${session?.access_token}`,
            },
            body: JSON.stringify({ regulation, offset, limit: batchLimit }),
          }
        );
        const result = await res.json();
        if (!res.ok) {
          toast({ title: 'Errore', description: result.error, variant: 'destructive' });
          break;
        }

        totalExtracted += result.requirements_extracted || 0;
        totalArticles += result.articles_processed || 0;

        if (!result.has_more) break;
        offset = result.next_offset;
      }

      toast({
        title: `✅ Estrazione completata per ${regulation}`,
        description: `${totalExtracted} requisiti estratti da ${totalArticles} articoli`,
      });
      loadRequirements();
    } catch (err: any) {
      toast({ title: 'Errore', description: err.message, variant: 'destructive' });
    }
    setExtracting(null);
  };

  const toggleVerified = async (req: Requirement) => {
    const { error } = await supabase
      .from('regulatory_requirements')
      .update({ verified: !req.verified } as any)
      .eq('id', req.id);
    if (!error) {
      setRequirements(prev => prev.map(r => r.id === req.id ? { ...r, verified: !r.verified } : r));
    }
  };

  const toggleActive = async (req: Requirement) => {
    const { error } = await supabase
      .from('regulatory_requirements')
      .update({ active: !req.active } as any)
      .eq('id', req.id);
    if (!error) {
      setRequirements(prev => prev.map(r => r.id === req.id ? { ...r, active: !r.active } : r));
    }
  };

  const activateAllVerified = async (regulation: string) => {
    const toActivate = requirements.filter(r => r.regulation === regulation && r.verified && !r.active);
    for (const req of toActivate) {
      await supabase
        .from('regulatory_requirements')
        .update({ active: true } as any)
        .eq('id', req.id);
    }
    toast({ title: `✅ Attivati ${toActivate.length} requisiti verificati per ${regulation}` });
    loadRequirements();
  };

  const runCleanup = async () => {
    setCleaning(true);
    setCleanupReport(null);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const supabaseUrl = supabaseHttpUrl;
      const res = await fetch(`${supabaseUrl}/functions/v1/cleanup-requirements`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session?.access_token}`,
        },
        body: JSON.stringify({}),
      });
      const result = await res.json();
      if (result.success) {
        setCleanupReport(result.report);
        toast({
          title: '✅ Pulizia completata',
          description: `${result.report.initial_count} → ${result.report.final_count} requisiti (${result.report.activated} attivati)`,
        });
        loadRequirements();
      } else {
        toast({ title: 'Errore', description: result.error, variant: 'destructive' });
      }
    } catch (err: any) {
      toast({ title: 'Errore', description: err.message, variant: 'destructive' });
    }
    setCleaning(false);
  };

  const runBalance = async () => {
    setBalancing(true);
    setBalanceReport(null);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const supabaseUrl = supabaseHttpUrl;
      const res = await fetch(`${supabaseUrl}/functions/v1/balance-requirements`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session?.access_token}`,
        },
        body: JSON.stringify({}),
      });
      const result = await res.json();
      if (result.success) {
        setBalanceReport(result.report);
        toast({
          title: '⚖️ Bilanciamento completato',
          description: `${result.report.total_before} → ${result.report.total_after} requisiti`,
        });
        loadRequirements();
      } else {
        toast({ title: 'Errore', description: result.error, variant: 'destructive' });
      }
    } catch (err: any) {
      toast({ title: 'Errore', description: err.message, variant: 'destructive' });
    }
    setBalancing(false);
  };

  const saveEditedReq = async () => {
    if (!editReq) return;
    const { error } = await supabase
      .from('regulatory_requirements')
      .update({
        description_it: editReq.description_it,
        coverage_keywords: editReq.coverage_keywords,
        gap_description_it: editReq.gap_description_it,
        recommended_action_it: editReq.recommended_action_it,
        action_hours: editReq.action_hours,
        action_cost_eur: editReq.action_cost_eur,
        risk_level: editReq.risk_level,
        remediation_effort: editReq.remediation_effort,
      } as any)
      .eq('id', editReq.id);
    if (!error) {
      toast({ title: 'Requisito aggiornato' });
      setEditReq(null);
      loadRequirements();
    }
  };

  const getRegCounts = (reg: string) => {
    const dbReqs = requirements.filter(r => r.regulation === reg);
    return {
      hardcoded: HARDCODED_COUNTS[reg] || 0,
      extracted: dbReqs.length,
      verified: dbReqs.filter(r => r.verified).length,
      active: dbReqs.filter(r => r.active).length,
    };
  };

  const filteredReqs = requirements.filter(r => r.regulation === selectedReg);

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto py-8 px-4">
        <div className="flex items-center gap-4 mb-6">
          <Button variant="ghost" onClick={() => navigate('/compliance')}>
            <ArrowLeft className="h-4 w-4 mr-2" /> Torna al Hub
          </Button>
          <div>
            <h1 className="text-2xl font-bold">Gestione Requisiti Normativi</h1>
            <p className="text-sm text-muted-foreground">
              Estrai, verifica e attiva i requisiti dal knowledge base RAG
            </p>
          </div>
        </div>

        {/* Overview Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
          {REGULATIONS.map(reg => {
            const counts = getRegCounts(reg);
            return (
              <Card key={reg} className={`cursor-pointer transition-all ${selectedReg === reg ? 'ring-2 ring-primary' : ''}`}
                onClick={() => setSelectedReg(reg)}>
                <CardHeader className="pb-2 pt-4 px-4">
                  <CardTitle className="text-sm">{reg}</CardTitle>
                </CardHeader>
                <CardContent className="px-4 pb-4">
                  <div className="flex items-center gap-1 flex-wrap">
                    <Badge variant="outline" className="text-xs">{counts.hardcoded} base</Badge>
                    <Badge variant="secondary" className="text-xs">{counts.extracted} estratti</Badge>
                    <Badge variant={counts.active > 0 ? 'default' : 'outline'} className="text-xs">{counts.active} attivi</Badge>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>

        {/* Actions */}
        <div className="flex gap-3 mb-6 flex-wrap">
          <Button
            onClick={() => extractRequirements(selectedReg)}
            disabled={!!extracting}
          >
            {extracting === selectedReg ? (
              <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Estrazione in corso...</>
            ) : (
              <><Download className="h-4 w-4 mr-2" /> Estrai Requisiti {selectedReg}</>
            )}
          </Button>
          <Button variant="outline" onClick={() => activateAllVerified(selectedReg)}>
            <CheckCheck className="h-4 w-4 mr-2" /> Attiva Tutti i Verificati
          </Button>

          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="destructive" disabled={cleaning}>
                {cleaning ? (
                  <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Pulizia in corso...</>
                ) : (
                  <><Sparkles className="h-4 w-4 mr-2" /> Pulisci e Attiva</>
                )}
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Conferma Pulizia Requisiti</AlertDialogTitle>
                <AlertDialogDescription>
                  Questa operazione pulirà i requisiti duplicati, non applicabili alle aziende (obblighi per stati membri), 
                  con numeri di articolo invalidi, keyword insufficienti e costi fuori range. 
                  I requisiti sopravvissuti verranno attivati automaticamente. Procedere?
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Annulla</AlertDialogCancel>
                <AlertDialogAction onClick={runCleanup} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                  Procedi con la pulizia
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>

          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="outline" className="border-amber-500 text-amber-600 hover:bg-amber-50" disabled={balancing}>
                {balancing ? (
                  <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Bilanciamento...</>
                ) : (
                  <><BookOpen className="h-4 w-4 mr-2" /> Bilancia Catalogo</>
                )}
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Conferma Bilanciamento Catalogo</AlertDialogTitle>
                <AlertDialogDescription>
                  Questa operazione ridurrà i requisiti di D.Lgs 81/08, AI Act, GDPR e DORA mantenendo solo 
                  gli articoli chiave per ogni normativa, bilanciando il catalogo per la gap analysis. Procedere?
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Annulla</AlertDialogCancel>
                <AlertDialogAction onClick={runBalance} className="bg-amber-600 text-white hover:bg-amber-700">
                  Procedi con il bilanciamento
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>

          <Button variant="ghost" onClick={loadRequirements}>
            <RefreshCw className="h-4 w-4 mr-2" /> Ricarica
          </Button>
        </div>

        {/* Cleanup Report */}
        {cleanupReport && (
          <Card className="mb-6 border-primary/30">
            <CardHeader className="pb-3">
              <CardTitle className="text-lg flex items-center gap-2">
                <Sparkles className="h-5 w-5 text-primary" />
                Report Pulizia
              </CardTitle>
              <CardDescription>
                {cleanupReport.initial_count} → {cleanupReport.final_count} requisiti ({cleanupReport.activated} attivati)
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mb-4">
                <div className="text-sm"><span className="text-muted-foreground">Obblighi stati rimossi:</span> <strong>{cleanupReport.removed_state_obligations}</strong></div>
                <div className="text-sm"><span className="text-muted-foreground">Articoli invalidi rimossi:</span> <strong>{cleanupReport.removed_invalid_articles}</strong></div>
                <div className="text-sm"><span className="text-muted-foreground">Duplicati rimossi:</span> <strong>{cleanupReport.removed_duplicates}</strong></div>
                <div className="text-sm"><span className="text-muted-foreground">Costi corretti:</span> <strong>{cleanupReport.fixed_costs}</strong></div>
                <div className="text-sm"><span className="text-muted-foreground">Keyword vuote rimosse:</span> <strong>{cleanupReport.removed_empty_keywords}</strong></div>
                <div className="text-sm"><span className="text-muted-foreground">Finale attivati:</span> <strong className="text-primary">{cleanupReport.activated}</strong></div>
              </div>
              {cleanupReport.per_regulation && (
                <div className="flex flex-wrap gap-2">
                  {Object.entries(cleanupReport.per_regulation).map(([reg, counts]: [string, any]) => (
                    <Badge key={reg} variant="outline" className="text-xs">
                      {reg}: {counts.before} → {counts.after}
                    </Badge>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Balance Report */}
        {balanceReport && (
          <Card className="mb-6 border-amber-500/30">
            <CardHeader className="pb-3">
              <CardTitle className="text-lg flex items-center gap-2">
                <BookOpen className="h-5 w-5 text-amber-600" />
                Report Bilanciamento
              </CardTitle>
              <CardDescription>
                {balanceReport.total_before} → {balanceReport.total_after} requisiti
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-2">
                {Object.entries(balanceReport).filter(([key]) => !key.startsWith('total_')).map(([reg, counts]: [string, any]) => (
                  <Badge key={reg} variant="outline" className="text-xs">
                    {reg}: {counts.before} → {counts.after}
                  </Badge>
                ))}
              </div>
            </CardContent>
          </Card>
        )}
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : filteredReqs.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <Database className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <h3 className="text-lg font-semibold mb-2">Nessun requisito estratto per {selectedReg}</h3>
              <p className="text-muted-foreground mb-4">
                Clicca "Estrai Requisiti" per generare automaticamente il catalogo dal knowledge base RAG
              </p>
              <Button onClick={() => extractRequirements(selectedReg)} disabled={!!extracting}>
                <Download className="h-4 w-4 mr-2" /> Estrai Requisiti
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {filteredReqs.map(req => (
              <Card key={req.id} className={`${req.active ? 'border-primary/30' : 'opacity-70'}`}>
                <CardContent className="p-4">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-2 flex-wrap">
                        <Badge variant={req.risk_level === 'critical' ? 'destructive' : req.risk_level === 'high' ? 'destructive' : 'secondary'}>
                          {req.risk_level}
                        </Badge>
                        <Badge variant="outline">{req.reference}</Badge>
                        <Badge variant="outline" className="text-xs">{req.remediation_effort} effort</Badge>
                        <span className="text-xs text-muted-foreground">{req.action_hours}h · €{req.action_cost_eur}</span>
                      </div>
                      <p className="text-sm mb-2">{req.description_it}</p>
                      <div className="flex flex-wrap gap-1">
                        {req.coverage_keywords?.slice(0, 8).map((kw, i) => (
                          <span key={i} className="text-xs bg-muted px-1.5 py-0.5 rounded">{kw}</span>
                        ))}
                        {(req.coverage_keywords?.length || 0) > 8 && (
                          <span className="text-xs text-muted-foreground">+{req.coverage_keywords.length - 8} altre</span>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-3 shrink-0">
                      <div className="flex flex-col items-center gap-1">
                        <Checkbox 
                          checked={req.verified}
                          onCheckedChange={() => toggleVerified(req)}
                        />
                        <span className="text-xs text-muted-foreground">Verificato</span>
                      </div>
                      <div className="flex flex-col items-center gap-1">
                        <Checkbox 
                          checked={req.active}
                          onCheckedChange={() => toggleActive(req)}
                        />
                        <span className="text-xs text-muted-foreground">Attivo</span>
                      </div>
                      <Dialog>
                        <DialogTrigger asChild>
                          <Button variant="ghost" size="icon" onClick={() => setEditReq({ ...req })}>
                            <Edit className="h-4 w-4" />
                          </Button>
                        </DialogTrigger>
                        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
                          <DialogHeader>
                            <DialogTitle>Modifica Requisito: {editReq?.requirement_id}</DialogTitle>
                          </DialogHeader>
                          {editReq && (
                            <div className="space-y-4">
                              <div>
                                <Label>Descrizione (IT)</Label>
                                <Textarea value={editReq.description_it} 
                                  onChange={e => setEditReq({ ...editReq, description_it: e.target.value })} />
                              </div>
                              <div>
                                <Label>Coverage Keywords (una per riga)</Label>
                                <Textarea 
                                  value={editReq.coverage_keywords?.join('\n')} 
                                  rows={8}
                                  onChange={e => setEditReq({ ...editReq, coverage_keywords: e.target.value.split('\n').filter(Boolean) })}
                                />
                              </div>
                              <div>
                                <Label>Gap Description (IT)</Label>
                                <Textarea value={editReq.gap_description_it}
                                  onChange={e => setEditReq({ ...editReq, gap_description_it: e.target.value })} />
                              </div>
                              <div>
                                <Label>Azione Raccomandata (IT)</Label>
                                <Textarea value={editReq.recommended_action_it}
                                  onChange={e => setEditReq({ ...editReq, recommended_action_it: e.target.value })} />
                              </div>
                              <div className="grid grid-cols-2 gap-4">
                                <div>
                                  <Label>Ore stimate</Label>
                                  <Input type="number" value={editReq.action_hours}
                                    onChange={e => setEditReq({ ...editReq, action_hours: parseInt(e.target.value) || 0, action_cost_eur: (parseInt(e.target.value) || 0) * 85 })} />
                                </div>
                                <div>
                                  <Label>Costo (€)</Label>
                                  <Input type="number" value={editReq.action_cost_eur} disabled />
                                </div>
                              </div>
                              <div className="grid grid-cols-2 gap-4">
                                <div>
                                  <Label>Risk Level</Label>
                                  <Select value={editReq.risk_level} onValueChange={v => setEditReq({ ...editReq, risk_level: v })}>
                                    <SelectTrigger><SelectValue /></SelectTrigger>
                                    <SelectContent>
                                      <SelectItem value="critical">Critical</SelectItem>
                                      <SelectItem value="high">High</SelectItem>
                                      <SelectItem value="medium">Medium</SelectItem>
                                      <SelectItem value="low">Low</SelectItem>
                                    </SelectContent>
                                  </Select>
                                </div>
                                <div>
                                  <Label>Remediation Effort</Label>
                                  <Select value={editReq.remediation_effort} onValueChange={v => setEditReq({ ...editReq, remediation_effort: v })}>
                                    <SelectTrigger><SelectValue /></SelectTrigger>
                                    <SelectContent>
                                      <SelectItem value="very_high">Very High</SelectItem>
                                      <SelectItem value="high">High</SelectItem>
                                      <SelectItem value="medium">Medium</SelectItem>
                                      <SelectItem value="low">Low</SelectItem>
                                    </SelectContent>
                                  </Select>
                                </div>
                              </div>
                              <Button onClick={saveEditedReq} className="w-full">
                                <Check className="h-4 w-4 mr-2" /> Salva Modifiche
                              </Button>
                            </div>
                          )}
                        </DialogContent>
                      </Dialog>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
