import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { 
  Globe, 
  Loader2, 
  RefreshCw, 
  ExternalLink,
  TrendingUp,
  AlertCircle,
  Newspaper,
  Building2,
  MapPin,
  Briefcase,
  Lightbulb,
  BookOpen,
  Settings2
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";

interface MarketInsight {
  title: string;
  summary: string;
  relevance: string;
  source_url?: string;
  source_title?: string;
  category: 'news' | 'trend' | 'regulation' | 'sanction' | 'best_practice';
  impact_level: 'high' | 'medium' | 'low';
  date?: string;
}

interface MarketData {
  sector_trends: MarketInsight[];
  regulatory_updates: MarketInsight[];
  market_statistics: {
    stat: string;
    value: string;
    source?: string;
  }[];
  recommendations: string[];
  generated_at: string;
}

interface UserProfile {
  sector: string;
  jurisdiction: string;
  compliance_role: string;
}

interface SearchProfile {
  sector: string;
  jurisdiction: string;
  compliance_role: string;
}

const SECTORS = [
  { value: 'Technology', label: 'Tecnologia' },
  { value: 'Healthcare', label: 'Sanità' },
  { value: 'Finance', label: 'Finanza' },
  { value: 'Energy', label: 'Energia' },
  { value: 'Manufacturing', label: 'Manifatturiero' },
  { value: 'Public Administration', label: 'Pubblica Amministrazione' },
  { value: 'Retail', label: 'Retail' },
  { value: 'Transport', label: 'Trasporti' }
];

const JURISDICTIONS = [
  { value: 'IT', label: 'Italia' },
  { value: 'EU', label: 'Unione Europea' },
  { value: 'DE', label: 'Germania' },
  { value: 'FR', label: 'Francia' },
  { value: 'ES', label: 'Spagna' }
];

const ROLES = [
  { value: 'DPO', label: 'DPO (Data Protection Officer)' },
  { value: 'CISO', label: 'CISO (Chief Information Security Officer)' },
  { value: 'compliance', label: 'Compliance Manager' },
  { value: 'legal', label: 'Legal Counsel' },
  { value: 'IT', label: 'IT Manager' },
  { value: 'consultant', label: 'Consulente Privacy/Security' }
];

const translations = {
  it: {
    title: "Market Intelligence",
    subtitle: "Notizie e dati di mercato rilevanti per il tuo profilo",
    loading: "Ricerca in corso...",
    generate: "Cerca Insights di Mercato",
    refresh: "Aggiorna",
    yourProfile: "Profilo di ricerca",
    sector: "Settore",
    jurisdiction: "Giurisdizione",
    role: "Ruolo",
    sectorTrends: "Trend di Settore",
    regulatoryUpdates: "Aggiornamenti Normativi",
    marketStats: "Statistiche di Mercato",
    recommendations: "Raccomandazioni",
    source: "Fonte",
    noProfile: "Completa il tuo profilo per ricevere insights personalizzati",
    goToOnboarding: "Completa Profilo",
    impactHigh: "Impatto Alto",
    impactMedium: "Impatto Medio",
    impactLow: "Impatto Basso",
    editProfile: "Modifica parametri di ricerca",
    applyChanges: "Applica e Cerca",
    customSearch: "Personalizza Ricerca"
  }
};

export function MarketIntelligence() {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [marketData, setMarketData] = useState<MarketData | null>(null);
  const [searchProfile, setSearchProfile] = useState<SearchProfile | null>(null);
  const [isCustomSearch, setIsCustomSearch] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [tempProfile, setTempProfile] = useState<SearchProfile>({
    sector: '',
    jurisdiction: '',
    compliance_role: ''
  });
  const [pendingSearch, setPendingSearch] = useState(false);

  const t = translations.it;

  useEffect(() => {
    loadProfile();
  }, []);

  // Auto-trigger search when custom profile is applied
  useEffect(() => {
    if (pendingSearch && searchProfile) {
      setPendingSearch(false);
      fetchMarketIntelligenceWithProfile(searchProfile, true);
    }
  }, [pendingSearch, searchProfile]);

  const loadProfile = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const { data, error } = await supabase
        .from('profiles')
        .select('sector, jurisdiction, compliance_role')
        .eq('id', session.user.id)
        .maybeSingle();

      if (data && !error) {
        setProfile(data);
        setSearchProfile(data);
        setTempProfile(data);
      }
    } catch (e) {
      console.error('Error loading profile:', e);
    }
  };

  const handleApplyCustomSearch = () => {
    // Check if parameters are different from original profile
    const isDifferent = !profile || 
      tempProfile.sector !== profile.sector ||
      tempProfile.jurisdiction !== profile.jurisdiction ||
      tempProfile.compliance_role !== profile.compliance_role;
    
    setIsCustomSearch(isDifferent);
    setSearchProfile({ ...tempProfile }); // Clone to ensure new reference
    setDialogOpen(false);
    setMarketData(null);
    setPendingSearch(true); // Trigger search automatically
  };

  const activeProfile = searchProfile || profile;

  const fetchMarketIntelligenceWithProfile = async (targetProfile: SearchProfile, forceRefresh: boolean) => {
    setLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Non autenticato');

      console.log('Fetching market intelligence with:', {
        sector: targetProfile.sector,
        jurisdiction: targetProfile.jurisdiction,
        role: targetProfile.compliance_role,
        forceRefresh
      });

      const { data, error } = await supabase.functions.invoke('market-intelligence', {
        body: {
          sector: targetProfile.sector,
          jurisdiction: targetProfile.jurisdiction,
          role: targetProfile.compliance_role,
          forceRefresh
        },
        headers: {
          Authorization: `Bearer ${session.access_token}`
        }
      });

      if (error) throw error;

      setMarketData(data);
      toast({
        title: "Insights generati",
        description: `Market intelligence per ${getSectorLabel(targetProfile.sector)} - ${targetProfile.jurisdiction}`
      });
    } catch (error: any) {
      console.error('Error fetching market intelligence:', error);
      toast({
        title: "Errore",
        description: error.message || "Impossibile recuperare i dati di mercato",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const fetchMarketIntelligence = async () => {
    if (!activeProfile) {
      toast({
        title: "Profilo incompleto",
        description: "Completa il tuo profilo per ricevere insights personalizzati",
        variant: "destructive"
      });
      return;
    }

    // Always force refresh when using custom search
    await fetchMarketIntelligenceWithProfile(activeProfile, isCustomSearch);
  };

  const getCategoryIcon = (category: string) => {
    switch (category) {
      case 'news': return <Newspaper className="h-4 w-4" />;
      case 'trend': return <TrendingUp className="h-4 w-4" />;
      case 'regulation': return <BookOpen className="h-4 w-4" />;
      case 'sanction': return <AlertCircle className="h-4 w-4" />;
      case 'best_practice': return <Lightbulb className="h-4 w-4" />;
      default: return <Globe className="h-4 w-4" />;
    }
  };

  const getImpactColor = (level: string) => {
    switch (level) {
      case 'high': return 'destructive';
      case 'medium': return 'default';
      case 'low': return 'secondary';
      default: return 'outline';
    }
  };

  const getImpactLabel = (level: string) => {
    switch (level) {
      case 'high': return t.impactHigh;
      case 'medium': return t.impactMedium;
      case 'low': return t.impactLow;
      default: return level;
    }
  };

  const getSectorLabel = (sector: string) => {
    const labels: Record<string, string> = {
      'Technology': 'Tecnologia',
      'Healthcare': 'Sanità',
      'Finance': 'Finanza',
      'Energy': 'Energia',
      'Manufacturing': 'Manifatturiero',
      'Public Administration': 'Pubblica Amministrazione',
      'Retail': 'Retail',
      'Transport': 'Trasporti'
    };
    return labels[sector] || sector;
  };

  return (
    <Card className="border-purple-500/30 bg-gradient-to-br from-purple-500/5 to-purple-500/10">
      <CardHeader>
        <div>
          <CardTitle className="flex items-center gap-2 text-purple-600">
            <Globe className="h-5 w-5" />
            {t.title}
          </CardTitle>
          <CardDescription className="mt-1">
            {t.subtitle}
          </CardDescription>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* User Profile Summary */}
        {activeProfile ? (
          <div className="bg-background/80 rounded-lg p-4 border">
            <div className="flex items-center justify-between mb-3">
              <h4 className="text-sm font-medium flex items-center gap-2">
                <Briefcase className="h-4 w-4" />
                {t.yourProfile}
                {searchProfile && searchProfile !== profile && (
                  <Badge variant="secondary" className="ml-2 text-xs">Personalizzato</Badge>
                )}
              </h4>
              <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
                <DialogTrigger asChild>
                  <Button variant="ghost" size="sm" className="h-8 gap-1">
                    <Settings2 className="h-4 w-4" />
                    <span className="hidden sm:inline">{t.customSearch}</span>
                  </Button>
                </DialogTrigger>
                <DialogContent className="sm:max-w-md">
                  <DialogHeader>
                    <DialogTitle>{t.editProfile}</DialogTitle>
                    <DialogDescription>
                      Modifica i parametri per cercare insights su settore, giurisdizione o ruolo differenti
                    </DialogDescription>
                  </DialogHeader>
                  <div className="space-y-4 py-4">
                    <div className="space-y-2">
                      <Label htmlFor="sector">{t.sector}</Label>
                      <Select
                        value={tempProfile.sector}
                        onValueChange={(value) => setTempProfile(prev => ({ ...prev, sector: value }))}
                      >
                        <SelectTrigger id="sector">
                          <SelectValue placeholder="Seleziona settore" />
                        </SelectTrigger>
                        <SelectContent>
                          {SECTORS.map(s => (
                            <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="jurisdiction">{t.jurisdiction}</Label>
                      <Select
                        value={tempProfile.jurisdiction}
                        onValueChange={(value) => setTempProfile(prev => ({ ...prev, jurisdiction: value }))}
                      >
                        <SelectTrigger id="jurisdiction">
                          <SelectValue placeholder="Seleziona giurisdizione" />
                        </SelectTrigger>
                        <SelectContent>
                          {JURISDICTIONS.map(j => (
                            <SelectItem key={j.value} value={j.value}>{j.label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="role">{t.role}</Label>
                      <Select
                        value={tempProfile.compliance_role}
                        onValueChange={(value) => setTempProfile(prev => ({ ...prev, compliance_role: value }))}
                      >
                        <SelectTrigger id="role">
                          <SelectValue placeholder="Seleziona ruolo" />
                        </SelectTrigger>
                        <SelectContent>
                          {ROLES.map(r => (
                            <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div className="flex justify-end gap-2">
                    <Button variant="outline" onClick={() => {
                      setTempProfile(profile || { sector: '', jurisdiction: '', compliance_role: '' });
                      setDialogOpen(false);
                    }}>
                      Annulla
                    </Button>
                    <Button onClick={handleApplyCustomSearch}>
                      {t.applyChanges}
                    </Button>
                  </div>
                </DialogContent>
              </Dialog>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-sm">
              <div className="flex items-center gap-2">
                <Building2 className="h-4 w-4 text-muted-foreground" />
                <span className="text-muted-foreground">{t.sector}:</span>
                <span className="font-medium">{getSectorLabel(activeProfile.sector)}</span>
              </div>
              <div className="flex items-center gap-2">
                <MapPin className="h-4 w-4 text-muted-foreground" />
                <span className="text-muted-foreground">{t.jurisdiction}:</span>
                <span className="font-medium">{activeProfile.jurisdiction}</span>
              </div>
              <div className="flex items-center gap-2">
                <Briefcase className="h-4 w-4 text-muted-foreground" />
                <span className="text-muted-foreground">{t.role}:</span>
                <span className="font-medium">{activeProfile.compliance_role}</span>
              </div>
            </div>
          </div>
        ) : (
          <div className="bg-yellow-50 dark:bg-yellow-950/20 rounded-lg p-4 border border-yellow-200 dark:border-yellow-800 text-center">
            <AlertCircle className="h-8 w-8 mx-auto mb-2 text-yellow-600" />
            <p className="text-sm text-yellow-800 dark:text-yellow-200 mb-3">
              {t.noProfile}
            </p>
            <Button variant="outline" size="sm" onClick={() => window.location.href = '/onboarding'}>
              {t.goToOnboarding}
            </Button>
          </div>
        )}

        {/* Generate Button */}
        {activeProfile && !marketData && !loading && (
          <Button 
            onClick={fetchMarketIntelligence} 
            className="w-full" 
            size="lg"
          >
            <Globe className="mr-2 h-4 w-4" />
            {t.generate}
          </Button>
        )}

        {/* Loading State */}
        {loading && (
          <div className="text-center py-8">
            <Loader2 className="h-8 w-8 animate-spin mx-auto text-purple-600 mb-3" />
            <p className="text-sm text-muted-foreground">{t.loading}</p>
          </div>
        )}

        {/* Results */}
        {marketData && (
          <div className="space-y-6">
            {/* Refresh Button */}
            <div className="flex justify-end">
              <Button 
                variant="outline" 
                size="sm" 
                onClick={fetchMarketIntelligence}
                disabled={loading}
              >
                <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
                {t.refresh}
              </Button>
            </div>

            {/* Market Statistics */}
            {marketData.market_statistics && marketData.market_statistics.length > 0 && (
              <div>
                <h4 className="font-semibold mb-3 flex items-center gap-2">
                  <TrendingUp className="h-4 w-4 text-purple-600" />
                  {t.marketStats}
                </h4>
                <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  {marketData.market_statistics.map((stat, i) => (
                    <div key={i} className="p-3 bg-background rounded-lg border">
                      <p className="text-sm text-muted-foreground">{stat.stat}</p>
                      <p className="text-xl font-bold text-purple-600">{stat.value}</p>
                      {stat.source && (
                        <p className="text-xs text-muted-foreground mt-1">{stat.source}</p>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Sector Trends */}
            {marketData.sector_trends && marketData.sector_trends.length > 0 && (
              <div>
                <h4 className="font-semibold mb-3 flex items-center gap-2">
                  <TrendingUp className="h-4 w-4 text-blue-600" />
                  {t.sectorTrends}
                </h4>
                <div className="space-y-3">
                  {marketData.sector_trends.map((trend, i) => (
                    <div key={i} className="p-4 bg-background rounded-lg border hover:border-primary/30 transition-colors">
                      <div className="flex items-start justify-between gap-3 mb-2">
                        <div className="flex items-start gap-2">
                          {getCategoryIcon(trend.category)}
                          <h5 className="font-medium">{trend.title}</h5>
                        </div>
                        <Badge variant={getImpactColor(trend.impact_level) as any}>
                          {getImpactLabel(trend.impact_level)}
                        </Badge>
                      </div>
                      <p className="text-sm text-muted-foreground mb-2">{trend.summary}</p>
                      {trend.relevance && (
                        <p className="text-sm text-primary mb-2">
                          <span className="font-medium">Rilevanza:</span> {trend.relevance}
                        </p>
                      )}
                      {trend.source_url && (
                        <a 
                          href={trend.source_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 text-xs text-blue-600 hover:underline"
                        >
                          <ExternalLink className="h-3 w-3" />
                          {trend.source_title || t.source}
                        </a>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Regulatory Updates */}
            {marketData.regulatory_updates && marketData.regulatory_updates.length > 0 && (
              <div>
                <h4 className="font-semibold mb-3 flex items-center gap-2">
                  <BookOpen className="h-4 w-4 text-orange-600" />
                  {t.regulatoryUpdates}
                </h4>
                <div className="space-y-3">
                  {marketData.regulatory_updates.map((update, i) => (
                    <div key={i} className="p-4 bg-background rounded-lg border hover:border-primary/30 transition-colors">
                      <div className="flex items-start justify-between gap-3 mb-2">
                        <div className="flex items-start gap-2">
                          {getCategoryIcon(update.category)}
                          <h5 className="font-medium">{update.title}</h5>
                        </div>
                        <Badge variant={getImpactColor(update.impact_level) as any}>
                          {getImpactLabel(update.impact_level)}
                        </Badge>
                      </div>
                      <p className="text-sm text-muted-foreground mb-2">{update.summary}</p>
                      {update.relevance && (
                        <p className="text-sm text-primary mb-2">
                          <span className="font-medium">Rilevanza:</span> {update.relevance}
                        </p>
                      )}
                      {update.source_url && (
                        <a 
                          href={update.source_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 text-xs text-blue-600 hover:underline"
                        >
                          <ExternalLink className="h-3 w-3" />
                          {update.source_title || t.source}
                        </a>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Recommendations */}
            {marketData.recommendations && marketData.recommendations.length > 0 && (
              <div>
                <h4 className="font-semibold mb-3 flex items-center gap-2">
                  <Lightbulb className="h-4 w-4 text-green-600" />
                  {t.recommendations}
                </h4>
                <ul className="space-y-2">
                  {marketData.recommendations.map((rec, i) => (
                    <li key={i} className="flex items-start gap-2 p-3 bg-green-50 dark:bg-green-950/20 rounded-lg border border-green-200 dark:border-green-800">
                      <div className="mt-1 h-2 w-2 rounded-full bg-green-500 flex-shrink-0" />
                      <span className="text-sm">{rec}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Generation Timestamp */}
            <p className="text-xs text-muted-foreground text-center">
              Generato: {new Date(marketData.generated_at).toLocaleString('it-IT')}
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
