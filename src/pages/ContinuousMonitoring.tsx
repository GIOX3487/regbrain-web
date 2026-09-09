import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { ArrowLeft, AlertTriangle, CheckCircle, Clock, Database, RefreshCw, X, Server, Cloud, Layers, Info } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface Monitor {
  id: string;
  name: string;
  description: string;
  monitor_type: string;
  status: string;
  last_check: string | null;
  total_scans: number;
}

interface Finding {
  id: string;
  title: string;
  description: string;
  severity: string;
  resource_name: string;
  recommended_actions: any;
  status: string;
  created_at: string;
}

const ContinuousMonitoring = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [initializing, setInitializing] = useState(false);
  const [monitors, setMonitors] = useState<Monitor[]>([]);
  const [findings, setFindings] = useState<Finding[]>([]);
  
  // Dialog states
  const [dbDialogOpen, setDbDialogOpen] = useState(false);
  const [apiDialogOpen, setApiDialogOpen] = useState(false);
  const [cloudDialogOpen, setCloudDialogOpen] = useState(false);
  
  // Form states
  const [dbConfig, setDbConfig] = useState({
    name: '',
    connection_string: '',
    tables_to_monitor: '',
    check_frequency: '60'
  });
  
  const [apiConfig, setApiConfig] = useState({
    name: '',
    base_url: '',
    auth_type: 'none',
    api_key: '',
    endpoints_to_monitor: '',
    check_frequency: '60'
  });
  
  const [cloudConfig, setCloudConfig] = useState({
    name: '',
    provider: 'aws',
    access_key: '',
    secret_key: '',
    region: '',
    resources_to_monitor: '',
    check_frequency: '60'
  });

  useEffect(() => {
    const checkAuth = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        navigate('/auth');
      } else {
        await loadData();
      }
    };
    checkAuth();
  }, [navigate]);

  const loadData = async () => {
    try {
      // Carica monitor
      const { data: monitorsData, error: monitorsError } = await supabase
        .from('compliance_monitors')
        .select('*')
        .order('created_at', { ascending: false });

      if (monitorsError) throw monitorsError;
      setMonitors(monitorsData || []);

      // Carica findings aperti
      const { data: findingsData, error: findingsError } = await supabase
        .from('monitoring_findings')
        .select('*')
        .eq('status', 'open')
        .order('created_at', { ascending: false });

      if (findingsError) throw findingsError;
      setFindings(findingsData || []);

    } catch (error: any) {
      console.error('Error loading data:', error);
      toast({
        title: "Errore",
        description: error.message,
        variant: "destructive"
      });
    }
  };

  const handleInitialize = async () => {
    setInitializing(true);
    try {
      const { data, error } = await supabase.functions.invoke('initialize-monitoring');
      
      if (error) throw error;

      toast({
        title: "Monitor inizializzati",
        description: `Creati ${data.monitorsCreated || 0} monitor di default`,
      });

      await loadData();
    } catch (error: any) {
      console.error('Error initializing:', error);
      toast({
        title: "Errore",
        description: error.message,
        variant: "destructive"
      });
    } finally {
      setInitializing(false);
    }
  };

  const handleRunScan = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('continuous-monitoring-scan');
      
      if (error) throw error;

      if (data.findingsCount > 0) {
        toast({
          title: `⚠️ Rilevati ${data.findingsCount} nuovi alert`,
          description: "Controlla i dettagli qui sotto",
        });
      } else {
        toast({
          title: "✓ Nessun problema rilevato",
          description: "Tutti i sistemi sono conformi",
        });
      }

      await loadData();
    } catch (error: any) {
      console.error('Error running scan:', error);
      toast({
        title: "Errore",
        description: error.message,
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const handleResolveFinding = async (findingId: string) => {
    try {
      const { error } = await supabase
        .from('monitoring_findings')
        .update({ 
          status: 'resolved',
          resolved_at: new Date().toISOString()
        })
        .eq('id', findingId);

      if (error) throw error;

      toast({
        title: "Finding risolto",
        description: "Il problema è stato marcato come risolto",
      });

      await loadData();
    } catch (error: any) {
      toast({
        title: "Errore",
        description: error.message,
        variant: "destructive"
      });
    }
  };

  const handleIgnoreFinding = async (findingId: string) => {
    try {
      const { error } = await supabase
        .from('monitoring_findings')
        .update({ status: 'ignored' })
        .eq('id', findingId);

      if (error) throw error;

      toast({
        title: "Finding ignorato",
        description: "Il problema è stato ignorato",
      });

      await loadData();
    } catch (error: any) {
      toast({
        title: "Errore",
        description: error.message,
        variant: "destructive"
      });
    }
  };

  const handleDatabaseSetup = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const { data, error } = await supabase
        .from('compliance_monitors')
        .insert({
          user_id: session.user.id,
          name: dbConfig.name,
          description: `Monitoraggio database - Tabelle: ${dbConfig.tables_to_monitor}`,
          monitor_type: 'database',
          check_frequency_minutes: parseInt(dbConfig.check_frequency),
          status: 'active',
          config: {
            connection_string: dbConfig.connection_string,
            tables: dbConfig.tables_to_monitor.split(',').map(t => t.trim())
          }
        })
        .select()
        .single();

      if (error) throw error;

      toast({
        title: "✓ Database configurato",
        description: "Il monitoring del database è stato attivato con successo",
      });

      setDbDialogOpen(false);
      setDbConfig({ name: '', connection_string: '', tables_to_monitor: '', check_frequency: '60' });
      await loadData();
    } catch (error: any) {
      toast({
        title: "Errore",
        description: error.message,
        variant: "destructive"
      });
    }
  };

  const handleApiSetup = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const { data, error } = await supabase
        .from('compliance_monitors')
        .insert({
          user_id: session.user.id,
          name: apiConfig.name,
          description: `Monitoraggio API - Endpoints: ${apiConfig.endpoints_to_monitor}`,
          monitor_type: 'api',
          check_frequency_minutes: parseInt(apiConfig.check_frequency),
          status: 'active',
          config: {
            base_url: apiConfig.base_url,
            auth_type: apiConfig.auth_type,
            api_key: apiConfig.api_key,
            endpoints: apiConfig.endpoints_to_monitor.split(',').map(e => e.trim())
          }
        })
        .select()
        .single();

      if (error) throw error;

      toast({
        title: "✓ API configurata",
        description: "Il monitoring API è stato attivato con successo",
      });

      setApiDialogOpen(false);
      setApiConfig({ name: '', base_url: '', auth_type: 'none', api_key: '', endpoints_to_monitor: '', check_frequency: '60' });
      await loadData();
    } catch (error: any) {
      toast({
        title: "Errore",
        description: error.message,
        variant: "destructive"
      });
    }
  };

  const handleCloudSetup = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const { data, error } = await supabase
        .from('compliance_monitors')
        .insert({
          user_id: session.user.id,
          name: cloudConfig.name,
          description: `Monitoraggio ${cloudConfig.provider.toUpperCase()} - Risorse: ${cloudConfig.resources_to_monitor}`,
          monitor_type: 'cloud',
          check_frequency_minutes: parseInt(cloudConfig.check_frequency),
          status: 'active',
          config: {
            provider: cloudConfig.provider,
            access_key: cloudConfig.access_key,
            secret_key: cloudConfig.secret_key,
            region: cloudConfig.region,
            resources: cloudConfig.resources_to_monitor.split(',').map(r => r.trim())
          }
        })
        .select()
        .single();

      if (error) throw error;

      toast({
        title: "✓ Cloud configurato",
        description: `Il monitoring ${cloudConfig.provider.toUpperCase()} è stato attivato con successo`,
      });

      setCloudDialogOpen(false);
      setCloudConfig({ name: '', provider: 'aws', access_key: '', secret_key: '', region: '', resources_to_monitor: '', check_frequency: '60' });
      await loadData();
    } catch (error: any) {
      toast({
        title: "Errore",
        description: error.message,
        variant: "destructive"
      });
    }
  };

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="flex items-center gap-4 mb-6">
          <Button variant="ghost" size="icon" onClick={() => navigate('/compliance')}>
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div className="flex-1">
            <h1 className="text-3xl font-bold">Continuous compliance monitoring</h1>
            <p className="text-muted-foreground">Monitoraggio real-time delle modifiche che impattano la compliance</p>
          </div>
          <Button onClick={handleRunScan} disabled={loading || monitors.length === 0}>
            <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            {loading ? 'Scansione...' : 'Avvia scan'}
          </Button>
          {monitors.length === 0 && (
            <Button onClick={handleInitialize} disabled={initializing} variant="outline">
              {initializing ? 'Inizializzazione...' : 'Inizializza monitoring'}
            </Button>
          )}
        </div>

        {/* Stats Cards */}
        <div className="grid md:grid-cols-4 gap-4 mb-8">
          <Card className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                <CheckCircle className="w-5 h-5 text-primary" />
              </div>
              <div>
                <p className="text-2xl font-bold">{monitors.length}</p>
                <p className="text-xs text-muted-foreground">Monitor attivi</p>
              </div>
            </div>
          </Card>

          <Card className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-yellow-500/10 flex items-center justify-center">
                <AlertTriangle className="w-5 h-5 text-yellow-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{findings.length}</p>
                <p className="text-xs text-muted-foreground">Alert attivi</p>
              </div>
            </div>
          </Card>

          <Card className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-green-500/10 flex items-center justify-center">
                <Database className="w-5 h-5 text-green-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">
                  {monitors.reduce((sum, m) => sum + (m.total_scans || 0), 0)}
                </p>
                <p className="text-xs text-muted-foreground">Scan totali</p>
              </div>
            </div>
          </Card>

          <Card className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-blue-500/10 flex items-center justify-center">
                <Clock className="w-5 h-5 text-blue-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">
                  {monitors.length > 0 && monitors[0].last_check 
                    ? Math.round((Date.now() - new Date(monitors[0].last_check).getTime()) / 60000) + 'm'
                    : '-'}
                </p>
                <p className="text-xs text-muted-foreground">Ultimo scan</p>
              </div>
            </div>
          </Card>
        </div>

        {/* Active Monitors */}
        <div className="space-y-4">
          <h2 className="text-xl font-semibold">Monitor configurati</h2>
          
          {monitors.length === 0 ? (
            <Card className="p-8 text-center">
              <p className="text-muted-foreground mb-4">Nessun monitor configurato</p>
              <Button onClick={handleInitialize} disabled={initializing}>
                {initializing ? 'Inizializzazione...' : 'Inizializza monitoring'}
              </Button>
            </Card>
          ) : (
            monitors.map((monitor) => (
              <Card key={monitor.id} className="p-6">
                <div className="flex items-start justify-between mb-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <h3 className="text-lg font-semibold">{monitor.name}</h3>
                      <Badge variant={monitor.status === 'active' ? 'default' : 'secondary'}>
                        {monitor.status}
                      </Badge>
                    </div>
                    <p className="text-sm text-muted-foreground mb-2">{monitor.description}</p>
                    <p className="text-xs text-muted-foreground">
                      {monitor.last_check 
                        ? `Ultimo controllo: ${new Date(monitor.last_check).toLocaleString('it-IT')}`
                        : 'Mai eseguito'}
                    </p>
                  </div>
                </div>
              </Card>
            ))
          )}
        </div>

        {/* Active Findings */}
        {findings.length > 0 && (
          <div className="space-y-4 mt-8">
            <h2 className="text-xl font-semibold">Alert attivi</h2>
            
            {findings.map((finding) => (
              <Card key={finding.id} className="p-6">
                <div className="p-4 bg-yellow-50 dark:bg-yellow-950/20 border border-yellow-200 dark:border-yellow-800 rounded-lg">
                  <div className="flex items-start gap-3">
                    <AlertTriangle className="w-5 h-5 text-yellow-600 mt-0.5" />
                    <div className="flex-1">
                      <div className="flex items-start justify-between mb-2">
                        <div>
                          <p className="font-semibold text-yellow-900 dark:text-yellow-100">
                            {finding.title}
                          </p>
                          <Badge variant={
                            finding.severity === 'critical' ? 'destructive' :
                            finding.severity === 'high' ? 'destructive' :
                            'default'
                          } className="mt-1">
                            {finding.severity}
                          </Badge>
                        </div>
                        <Button 
                          variant="ghost" 
                          size="icon"
                          onClick={() => handleIgnoreFinding(finding.id)}
                        >
                          <X className="w-4 h-4" />
                        </Button>
                      </div>
                      <p className="text-sm text-yellow-800 dark:text-yellow-200 mt-2">
                        {finding.description}
                      </p>
                      <p className="text-xs text-muted-foreground mt-1">
                        Risorsa: {finding.resource_name}
                      </p>
                      {finding.recommended_actions && finding.recommended_actions.length > 0 && (
                        <div className="mt-3">
                          <p className="text-sm font-semibold mb-1">Azioni consigliate:</p>
                          <ul className="text-sm space-y-1">
                            {finding.recommended_actions.map((action: string, idx: number) => (
                              <li key={idx} className="text-yellow-800 dark:text-yellow-200">
                                • {action}
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                      <div className="flex gap-2 mt-3">
                        <Button size="sm" onClick={() => handleResolveFinding(finding.id)}>
                          Risolvi
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => handleIgnoreFinding(finding.id)}>
                          Ignora
                        </Button>
                      </div>
                    </div>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        )}

        {/* Integration Setup Card */}
        <Card className="p-6 mt-8 bg-gradient-to-br from-primary/5 to-secondary/5">
          <div className="flex items-center gap-2 mb-4">
            <Layers className="h-5 w-5 text-primary" />
            <h3 className="text-lg font-semibold">Configura integrazioni</h3>
          </div>
          <p className="text-muted-foreground mb-6">
            Connetti i tuoi sistemi per monitoraggio automatico continuo delle modifiche che impattano la compliance
          </p>
          
          <div className="grid md:grid-cols-3 gap-4">
            {/* Database Integration */}
            <Dialog open={dbDialogOpen} onOpenChange={setDbDialogOpen}>
              <DialogTrigger asChild>
                <div className="p-4 bg-background rounded-lg border hover:border-primary transition-colors cursor-pointer">
                  <div className="flex items-center gap-2 mb-2">
                    <Database className="h-5 w-5 text-primary" />
                    <h4 className="font-semibold">Database</h4>
                  </div>
                  <p className="text-sm text-muted-foreground mb-3">
                    Monitora modifiche schema, nuove tabelle, campi dati personali
                  </p>
                  <Button size="sm" variant="outline" className="w-full">
                    Connetti DB
                  </Button>
                </div>
              </DialogTrigger>
              <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle className="flex items-center gap-2">
                    <Database className="h-5 w-5" />
                    Configura Monitoraggio Database
                  </DialogTitle>
                  <DialogDescription>
                    Monitora automaticamente modifiche allo schema e ai dati che potrebbero violare la compliance
                  </DialogDescription>
                </DialogHeader>
                
                <div className="space-y-6">
                  {/* How it works */}
                  <Card className="bg-muted/50">
                    <CardContent className="pt-6">
                      <div className="flex items-start gap-2 mb-3">
                        <Info className="h-5 w-5 text-primary mt-0.5" />
                        <div>
                          <h4 className="font-semibold mb-2">Come funziona</h4>
                          <ul className="text-sm space-y-1 text-muted-foreground">
                            <li>• Rileva nuove tabelle con dati personali (PII)</li>
                            <li>• Monitora modifiche allo schema (nuove colonne sensibili)</li>
                            <li>• Controlla permessi e accessi non conformi</li>
                            <li>• Identifica campi senza crittografia o mascheramento</li>
                          </ul>
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  {/* Configuration Form */}
                  <div className="space-y-4">
                    <div>
                      <Label htmlFor="db-name">Nome Monitor</Label>
                      <Input
                        id="db-name"
                        placeholder="es. Database Produzione GDPR"
                        value={dbConfig.name}
                        onChange={(e) => setDbConfig({ ...dbConfig, name: e.target.value })}
                      />
                    </div>

                    <div>
                      <Label htmlFor="db-connection">Connection String</Label>
                      <Input
                        id="db-connection"
                        type="password"
                        placeholder="postgresql://user:pass@host:5432/dbname"
                        value={dbConfig.connection_string}
                        onChange={(e) => setDbConfig({ ...dbConfig, connection_string: e.target.value })}
                      />
                      <p className="text-xs text-muted-foreground mt-1">
                        Formato: postgresql://username:password@host:port/database
                      </p>
                    </div>

                    <div>
                      <Label htmlFor="db-tables">Tabelle da Monitorare</Label>
                      <Textarea
                        id="db-tables"
                        placeholder="users, customers, orders (separate con virgola)"
                        value={dbConfig.tables_to_monitor}
                        onChange={(e) => setDbConfig({ ...dbConfig, tables_to_monitor: e.target.value })}
                        rows={3}
                      />
                      <p className="text-xs text-muted-foreground mt-1">
                        Lascia vuoto per monitorare tutte le tabelle
                      </p>
                    </div>

                    <div>
                      <Label htmlFor="db-frequency">Frequenza Controllo</Label>
                      <Select
                        value={dbConfig.check_frequency}
                        onValueChange={(value) => setDbConfig({ ...dbConfig, check_frequency: value })}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="15">Ogni 15 minuti</SelectItem>
                          <SelectItem value="30">Ogni 30 minuti</SelectItem>
                          <SelectItem value="60">Ogni ora</SelectItem>
                          <SelectItem value="360">Ogni 6 ore</SelectItem>
                          <SelectItem value="1440">Ogni giorno</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  {/* Example Results */}
                  <Card className="bg-primary/5">
                    <CardContent className="pt-6">
                      <h4 className="font-semibold mb-2">Esempio Alert che riceverai:</h4>
                      <div className="space-y-2 text-sm">
                        <div className="flex items-start gap-2">
                          <AlertTriangle className="h-4 w-4 text-yellow-600 mt-0.5" />
                          <div>
                            <p className="font-medium">Nuova colonna con dati sensibili rilevata</p>
                            <p className="text-muted-foreground">Tabella "users": colonna "tax_id" aggiunta senza crittografia</p>
                          </div>
                        </div>
                        <div className="flex items-start gap-2">
                          <AlertTriangle className="h-4 w-4 text-red-600 mt-0.5" />
                          <div>
                            <p className="font-medium">Nuova tabella con PII senza RLS</p>
                            <p className="text-muted-foreground">Tabella "medical_records" creata senza Row-Level Security</p>
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  <Button 
                    onClick={handleDatabaseSetup}
                    className="w-full"
                    disabled={!dbConfig.name || !dbConfig.connection_string}
                  >
                    Attiva Monitoraggio Database
                  </Button>
                </div>
              </DialogContent>
            </Dialog>

            {/* API Integration */}
            <Dialog open={apiDialogOpen} onOpenChange={setApiDialogOpen}>
              <DialogTrigger asChild>
                <div className="p-4 bg-background rounded-lg border hover:border-primary transition-colors cursor-pointer">
                  <div className="flex items-center gap-2 mb-2">
                    <Server className="h-5 w-5 text-primary" />
                    <h4 className="font-semibold">API / Microservizi</h4>
                  </div>
                  <p className="text-sm text-muted-foreground mb-3">
                    Traccia nuovi endpoint, modifiche parametri, data processing
                  </p>
                  <Button size="sm" variant="outline" className="w-full">
                    Configura API
                  </Button>
                </div>
              </DialogTrigger>
              <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle className="flex items-center gap-2">
                    <Server className="h-5 w-5" />
                    Configura Monitoraggio API
                  </DialogTitle>
                  <DialogDescription>
                    Monitora modifiche agli endpoint API che potrebbero esporre o processare dati personali
                  </DialogDescription>
                </DialogHeader>
                
                <div className="space-y-6">
                  {/* How it works */}
                  <Card className="bg-muted/50">
                    <CardContent className="pt-6">
                      <div className="flex items-start gap-2 mb-3">
                        <Info className="h-5 w-5 text-primary mt-0.5" />
                        <div>
                          <h4 className="font-semibold mb-2">Come funziona</h4>
                          <ul className="text-sm space-y-1 text-muted-foreground">
                            <li>• Rileva nuovi endpoint che espongono dati personali</li>
                            <li>• Monitora modifiche ai parametri di richiesta/risposta</li>
                            <li>• Controlla autenticazione e autorizzazione</li>
                            <li>• Identifica endpoint senza rate limiting o logging</li>
                          </ul>
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  {/* Configuration Form */}
                  <div className="space-y-4">
                    <div>
                      <Label htmlFor="api-name">Nome Monitor</Label>
                      <Input
                        id="api-name"
                        placeholder="es. API Utenti v2"
                        value={apiConfig.name}
                        onChange={(e) => setApiConfig({ ...apiConfig, name: e.target.value })}
                      />
                    </div>

                    <div>
                      <Label htmlFor="api-url">Base URL</Label>
                      <Input
                        id="api-url"
                        placeholder="https://api.esempio.com"
                        value={apiConfig.base_url}
                        onChange={(e) => setApiConfig({ ...apiConfig, base_url: e.target.value })}
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label htmlFor="api-auth">Tipo Autenticazione</Label>
                        <Select
                          value={apiConfig.auth_type}
                          onValueChange={(value) => setApiConfig({ ...apiConfig, auth_type: value })}
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="none">Nessuna</SelectItem>
                            <SelectItem value="bearer">Bearer Token</SelectItem>
                            <SelectItem value="api_key">API Key</SelectItem>
                            <SelectItem value="basic">Basic Auth</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>

                      {apiConfig.auth_type !== 'none' && (
                        <div>
                          <Label htmlFor="api-key">API Key / Token</Label>
                          <Input
                            id="api-key"
                            type="password"
                            placeholder="sk_..."
                            value={apiConfig.api_key}
                            onChange={(e) => setApiConfig({ ...apiConfig, api_key: e.target.value })}
                          />
                        </div>
                      )}
                    </div>

                    <div>
                      <Label htmlFor="api-endpoints">Endpoint da Monitorare</Label>
                      <Textarea
                        id="api-endpoints"
                        placeholder="/users, /customers/*/data, /orders (separate con virgola)"
                        value={apiConfig.endpoints_to_monitor}
                        onChange={(e) => setApiConfig({ ...apiConfig, endpoints_to_monitor: e.target.value })}
                        rows={3}
                      />
                      <p className="text-xs text-muted-foreground mt-1">
                        Usa * per wildcard. Lascia vuoto per monitorare tutti gli endpoint
                      </p>
                    </div>

                    <div>
                      <Label htmlFor="api-frequency">Frequenza Controllo</Label>
                      <Select
                        value={apiConfig.check_frequency}
                        onValueChange={(value) => setApiConfig({ ...apiConfig, check_frequency: value })}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="15">Ogni 15 minuti</SelectItem>
                          <SelectItem value="30">Ogni 30 minuti</SelectItem>
                          <SelectItem value="60">Ogni ora</SelectItem>
                          <SelectItem value="360">Ogni 6 ore</SelectItem>
                          <SelectItem value="1440">Ogni giorno</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  {/* Example Results */}
                  <Card className="bg-primary/5">
                    <CardContent className="pt-6">
                      <h4 className="font-semibold mb-2">Esempio Alert che riceverai:</h4>
                      <div className="space-y-2 text-sm">
                        <div className="flex items-start gap-2">
                          <AlertTriangle className="h-4 w-4 text-yellow-600 mt-0.5" />
                          <div>
                            <p className="font-medium">Nuovo endpoint con dati sensibili</p>
                            <p className="text-muted-foreground">GET /users/:id/medical-history espone dati sanitari senza mascheramento</p>
                          </div>
                        </div>
                        <div className="flex items-start gap-2">
                          <AlertTriangle className="h-4 w-4 text-red-600 mt-0.5" />
                          <div>
                            <p className="font-medium">Modifica parametri risposta API</p>
                            <p className="text-muted-foreground">GET /customers ora ritorna "tax_id" non presente prima</p>
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  <Button 
                    onClick={handleApiSetup}
                    className="w-full"
                    disabled={!apiConfig.name || !apiConfig.base_url}
                  >
                    Attiva Monitoraggio API
                  </Button>
                </div>
              </DialogContent>
            </Dialog>

            {/* Cloud Integration */}
            <Dialog open={cloudDialogOpen} onOpenChange={setCloudDialogOpen}>
              <DialogTrigger asChild>
                <div className="p-4 bg-background rounded-lg border hover:border-primary transition-colors cursor-pointer">
                  <div className="flex items-center gap-2 mb-2">
                    <Cloud className="h-5 w-5 text-primary" />
                    <h4 className="font-semibold">Cloud Services</h4>
                  </div>
                  <p className="text-sm text-muted-foreground mb-3">
                    AWS, Azure, GCP - rileva risorse che trattano dati personali
                  </p>
                  <Button size="sm" variant="outline" className="w-full">
                    Connetti Cloud
                  </Button>
                </div>
              </DialogTrigger>
              <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle className="flex items-center gap-2">
                    <Cloud className="h-5 w-5" />
                    Configura Monitoraggio Cloud
                  </DialogTitle>
                  <DialogDescription>
                    Monitora risorse cloud che potrebbero processare o archiviare dati personali
                  </DialogDescription>
                </DialogHeader>
                
                <div className="space-y-6">
                  {/* How it works */}
                  <Card className="bg-muted/50">
                    <CardContent className="pt-6">
                      <div className="flex items-start gap-2 mb-3">
                        <Info className="h-5 w-5 text-primary mt-0.5" />
                        <div>
                          <h4 className="font-semibold mb-2">Come funziona</h4>
                          <ul className="text-sm space-y-1 text-muted-foreground">
                            <li>• Rileva nuovi bucket S3/blob storage con dati personali</li>
                            <li>• Monitora modifiche a policy di accesso e crittografia</li>
                            <li>• Controlla configurazioni database cloud (RDS, Aurora, etc.)</li>
                            <li>• Identifica risorse senza backup o in regioni non conformi</li>
                          </ul>
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  {/* Configuration Form */}
                  <div className="space-y-4">
                    <div>
                      <Label htmlFor="cloud-name">Nome Monitor</Label>
                      <Input
                        id="cloud-name"
                        placeholder="es. AWS Produzione EU"
                        value={cloudConfig.name}
                        onChange={(e) => setCloudConfig({ ...cloudConfig, name: e.target.value })}
                      />
                    </div>

                    <div>
                      <Label htmlFor="cloud-provider">Provider Cloud</Label>
                      <Select
                        value={cloudConfig.provider}
                        onValueChange={(value) => setCloudConfig({ ...cloudConfig, provider: value })}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="aws">Amazon Web Services (AWS)</SelectItem>
                          <SelectItem value="azure">Microsoft Azure</SelectItem>
                          <SelectItem value="gcp">Google Cloud Platform (GCP)</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label htmlFor="cloud-access">Access Key ID</Label>
                        <Input
                          id="cloud-access"
                          type="password"
                          placeholder="AKIA..."
                          value={cloudConfig.access_key}
                          onChange={(e) => setCloudConfig({ ...cloudConfig, access_key: e.target.value })}
                        />
                      </div>

                      <div>
                        <Label htmlFor="cloud-secret">Secret Access Key</Label>
                        <Input
                          id="cloud-secret"
                          type="password"
                          placeholder="••••••••"
                          value={cloudConfig.secret_key}
                          onChange={(e) => setCloudConfig({ ...cloudConfig, secret_key: e.target.value })}
                        />
                      </div>
                    </div>

                    <div>
                      <Label htmlFor="cloud-region">Regione</Label>
                      <Input
                        id="cloud-region"
                        placeholder="eu-west-1 / westeurope / europe-west1"
                        value={cloudConfig.region}
                        onChange={(e) => setCloudConfig({ ...cloudConfig, region: e.target.value })}
                      />
                    </div>

                    <div>
                      <Label htmlFor="cloud-resources">Risorse da Monitorare</Label>
                      <Textarea
                        id="cloud-resources"
                        placeholder="s3://bucket-users, rds:db-customers, vm-instance-* (separate con virgola)"
                        value={cloudConfig.resources_to_monitor}
                        onChange={(e) => setCloudConfig({ ...cloudConfig, resources_to_monitor: e.target.value })}
                        rows={3}
                      />
                      <p className="text-xs text-muted-foreground mt-1">
                        Lascia vuoto per scansione automatica di tutte le risorse
                      </p>
                    </div>

                    <div>
                      <Label htmlFor="cloud-frequency">Frequenza Controllo</Label>
                      <Select
                        value={cloudConfig.check_frequency}
                        onValueChange={(value) => setCloudConfig({ ...cloudConfig, check_frequency: value })}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="15">Ogni 15 minuti</SelectItem>
                          <SelectItem value="30">Ogni 30 minuti</SelectItem>
                          <SelectItem value="60">Ogni ora</SelectItem>
                          <SelectItem value="360">Ogni 6 ore</SelectItem>
                          <SelectItem value="1440">Ogni giorno</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  {/* Example Results */}
                  <Card className="bg-primary/5">
                    <CardContent className="pt-6">
                      <h4 className="font-semibold mb-2">Esempio Alert che riceverai:</h4>
                      <div className="space-y-2 text-sm">
                        <div className="flex items-start gap-2">
                          <AlertTriangle className="h-4 w-4 text-yellow-600 mt-0.5" />
                          <div>
                            <p className="font-medium">Bucket S3 pubblico con dati sensibili</p>
                            <p className="text-muted-foreground">s3://customer-data ha ACL pubbliche attivate</p>
                          </div>
                        </div>
                        <div className="flex items-start gap-2">
                          <AlertTriangle className="h-4 w-4 text-red-600 mt-0.5" />
                          <div>
                            <p className="font-medium">Database RDS in regione non-EU</p>
                            <p className="text-muted-foreground">rds-userdata-prod si trova in us-east-1 (viola GDPR)</p>
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  <Button 
                    onClick={handleCloudSetup}
                    className="w-full"
                    disabled={!cloudConfig.name || !cloudConfig.access_key || !cloudConfig.secret_key || !cloudConfig.region}
                  >
                    Attiva Monitoraggio Cloud
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          </div>
        </Card>
      </div>
    </div>
  );
};

export default ContinuousMonitoring;
