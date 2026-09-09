import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { MobileNav } from "@/components/MobileNav";
import { 
  ArrowLeft, 
  BarChart3, 
  Loader2, 
  Shield,
  Building2,
  Languages,
  Clock,
  Users,
  TrendingUp
} from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

// Traduzioni statiche
const translations = {
  it: {
    backToHub: "Torna al Compliance Hub",
    pageTitle: "Benchmark di Settore",
    pageSubtitle: "Confronta la tua compliance con altre aziende del settore",
    startNow: "Inizia subito",
    loginToCompare: "Accedi per vedere il benchmark di settore",
    login: "Accedi",
    comingSoonTitle: "Funzionalità in Arrivo",
    comingSoonDescription: "Stiamo lavorando a una nuova funzionalità di benchmark interno che ti permetterà di confrontare la tua compliance con altre aziende che effettuano le analisi sulla nostra piattaforma.",
    featuresList: [
      "Confronto anonimo tra aziende dello stesso settore",
      "Analisi per giurisdizione (Italia, Germania, Francia, Spagna, UE)",
      "Benchmark per tipologia di regolamento (GDPR, NIS2, AI Act, CRA, DORA)",
      "Posizionamento percentile nel tuo settore",
      "Identificazione delle aree di miglioramento rispetto alla media",
      "Quick wins basati sulle best practice del settore"
    ],
    stayTuned: "Resta aggiornato! Ti notificheremo quando questa funzionalità sarà disponibile.",
    currentlyAvailable: "Funzionalità Attualmente Disponibili",
    availableFeatures: [
      { title: "Gap Analysis Dettagliata", description: "Identifica le lacune di compliance rispetto alle normative" },
      { title: "Generazione Documenti", description: "DPIA, RoPA, LIA e altri documenti conformi" },
      { title: "Monitoraggio Continuo", description: "Tieni traccia dello stato di conformità nel tempo" },
      { title: "AI Copilot", description: "Assistente intelligente per domande sulla compliance" }
    ]
  },
  en: {
    backToHub: "Back to Compliance Hub",
    pageTitle: "Sector Benchmark",
    pageSubtitle: "Compare your compliance with other companies in your sector",
    startNow: "Get Started",
    loginToCompare: "Log in to see the sector benchmark",
    login: "Log In",
    comingSoonTitle: "Coming Soon",
    comingSoonDescription: "We're working on a new internal benchmark feature that will allow you to compare your compliance with other companies that perform analyses on our platform.",
    featuresList: [
      "Anonymous comparison between companies in the same sector",
      "Analysis by jurisdiction (Italy, Germany, France, Spain, EU)",
      "Benchmark by regulation type (GDPR, NIS2, AI Act, CRA, DORA)",
      "Percentile positioning in your sector",
      "Identification of improvement areas compared to the average",
      "Quick wins based on sector best practices"
    ],
    stayTuned: "Stay tuned! We'll notify you when this feature becomes available.",
    currentlyAvailable: "Currently Available Features",
    availableFeatures: [
      { title: "Detailed Gap Analysis", description: "Identify compliance gaps against regulations" },
      { title: "Document Generation", description: "DPIA, RoPA, LIA and other compliant documents" },
      { title: "Continuous Monitoring", description: "Track compliance status over time" },
      { title: "AI Copilot", description: "Intelligent assistant for compliance questions" }
    ]
  }
};

export default function SectorBenchmark() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [language, setLanguage] = useState<'it' | 'en'>('it');

  const t = translations[language];

  useEffect(() => {
    checkAuth();
  }, []);

  const checkAuth = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      setIsAuthenticated(!!session);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background">
        <MobileNav />
        <div className="container mx-auto py-20 flex justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pb-20 lg:pb-0">
      <MobileNav />
      <div className="container mx-auto py-4 sm:py-8 px-4 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <Button variant="ghost" onClick={() => navigate('/compliance')}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            {t.backToHub}
          </Button>
          
          {/* Language Selector */}
          <div className="flex items-center gap-2">
            <Select value={language} onValueChange={(v) => setLanguage(v as 'it' | 'en')}>
              <SelectTrigger className="w-[100px]">
                <Languages className="h-4 w-4 mr-2" />
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="it">Italiano</SelectItem>
                <SelectItem value="en">English</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <div>
          <h1 className="text-3xl sm:text-4xl font-bold mb-2">{t.pageTitle}</h1>
          <p className="text-muted-foreground flex items-center gap-2">
            <Building2 className="h-4 w-4" />
            {t.pageSubtitle}
          </p>
        </div>

        {/* Not authenticated */}
        {!isAuthenticated && (
          <Card>
            <CardContent className="py-12 text-center">
              <BarChart3 className="h-16 w-16 mx-auto mb-4 text-muted-foreground" />
              <h3 className="text-xl font-semibold mb-2">{t.startNow}</h3>
              <p className="text-muted-foreground mb-6">
                {t.loginToCompare}
              </p>
              <Button onClick={() => navigate('/auth')}>
                <Shield className="mr-2 h-4 w-4" />
                {t.login}
              </Button>
            </CardContent>
          </Card>
        )}

        {/* Coming Soon Card */}
        {isAuthenticated && (
          <div className="space-y-6">
            {/* Main Coming Soon Card */}
            <Card className="border-primary/30 bg-gradient-to-br from-primary/5 to-primary/10">
              <CardHeader className="text-center pb-4">
                <div className="mx-auto mb-4 p-4 bg-primary/10 rounded-full w-fit">
                  <Clock className="h-12 w-12 text-primary" />
                </div>
                <CardTitle className="text-2xl sm:text-3xl">
                  {t.comingSoonTitle}
                </CardTitle>
                <CardDescription className="text-base max-w-2xl mx-auto">
                  {t.comingSoonDescription}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Features List */}
                <div className="bg-background/80 rounded-lg p-6 border">
                  <h4 className="font-semibold mb-4 flex items-center gap-2">
                    <TrendingUp className="h-5 w-5 text-primary" />
                    {language === 'it' ? 'Cosa potrai fare:' : 'What you\'ll be able to do:'}
                  </h4>
                  <ul className="space-y-3">
                    {t.featuresList.map((feature, index) => (
                      <li key={index} className="flex items-start gap-3">
                        <div className="mt-1 h-2 w-2 rounded-full bg-primary flex-shrink-0" />
                        <span className="text-sm text-muted-foreground">{feature}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                {/* Stay Tuned Badge */}
                <div className="text-center">
                  <Badge variant="secondary" className="px-4 py-2 text-sm">
                    <Users className="h-4 w-4 mr-2" />
                    {t.stayTuned}
                  </Badge>
                </div>
              </CardContent>
            </Card>

            {/* Currently Available Features */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <BarChart3 className="h-5 w-5 text-primary" />
                  {t.currentlyAvailable}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid sm:grid-cols-2 gap-4">
                  {t.availableFeatures.map((feature, index) => (
                    <div 
                      key={index} 
                      className="p-4 bg-muted/50 rounded-lg border hover:border-primary/30 transition-colors"
                    >
                      <h4 className="font-semibold mb-1">{feature.title}</h4>
                      <p className="text-sm text-muted-foreground">{feature.description}</p>
                    </div>
                  ))}
                </div>
                
                <div className="mt-6 flex flex-wrap gap-3 justify-center">
                  <Button onClick={() => navigate('/compliance/new-assessment')}>
                    {language === 'it' ? 'Nuova Valutazione' : 'New Assessment'}
                  </Button>
                  <Button variant="outline" onClick={() => navigate('/compliance/ai-copilot')}>
                    {language === 'it' ? 'Parla con AI Copilot' : 'Talk to AI Copilot'}
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </div>
  );
}
