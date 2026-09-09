import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useNavigate } from "react-router-dom";
import { Shield, Search, FileText, ArrowRight, CheckCircle2, Target, Zap, BookOpen, Activity, Eye, Scale, Globe } from "lucide-react";
import { MobileNav } from "@/components/MobileNav";
import { FeatureGuide } from "@/components/FeatureGuide";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import regbrainLogo from "@/assets/regbrain-logo.png";
import regbrainBrainLogo from "@/assets/regbrain-brain-logo.jpeg";

const Landing = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [guideOpen, setGuideOpen] = useState(false);
  const [selectedFeature, setSelectedFeature] = useState<'predictive' | 'gap' | 'market-intelligence' | 'document' | 'compliance'>('compliance');
  const [loadingDemo, setLoadingDemo] = useState(false);

  const handleFeatureClick = (feature: 'predictive' | 'gap' | 'market-intelligence' | 'document' | 'compliance') => {
    setSelectedFeature(feature);
    setGuideOpen(true);
  };

  const handleStartDemo = async () => {
    setLoadingDemo(true);
    try {
      // Generate unique demo email
      const demoId = crypto.randomUUID();
      const demoEmail = `demo-${demoId}@demo.regbrain.com`;
      const demoPassword = crypto.randomUUID();

      console.log('Creating temporary demo account...');

      // Create temporary demo account
      const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
        email: demoEmail,
        password: demoPassword,
        options: {
          emailRedirectTo: `${window.location.origin}/onboarding`,
          data: {
            is_demo: true
          }
        }
      });

      if (signUpError) {
        console.error('Demo signup error:', signUpError);
        throw signUpError;
      }

      if (signUpData.user) {
        // Store demo session in database
        const { error: sessionError } = await supabase
          .from('demo_sessions')
          .insert({
            user_id: signUpData.user.id,
            email: demoEmail,
            created_at: new Date().toISOString(),
            expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
            last_activity: new Date().toISOString()
          });

        if (sessionError) {
          console.error('Error creating demo session:', sessionError);
        }

        // Set flag to force onboarding for new demo account
        sessionStorage.setItem('force_demo_onboarding', 'true');

        toast({
          title: "Demo Account Creato",
          description: "Account temporaneo valido per 24 ore. I tuoi dati sono privati e saranno eliminati automaticamente.",
        });

        // Navigate to onboarding
        navigate('/onboarding');
      }
    } catch (error: any) {
      console.error('Error creating demo:', error);
      toast({
        title: "Errore",
        description: "Impossibile creare l'account demo. Riprova.",
        variant: "destructive"
      });
      setLoadingDemo(false);
    }
  };

  const handleUsaOra = async () => {
    try {
      // Check if user is authenticated
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session) {
        // Not authenticated, save redirect path and go to auth
        sessionStorage.setItem('auth_redirect', '/chat');
        navigate('/auth');
        return;
      }

      // Check if user has completed onboarding
      const { data: profile } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', session.user.id)
        .maybeSingle();

      // If no profile OR profile is incomplete (missing required fields), go to onboarding
      if (!profile || !profile.sector || !profile.jurisdiction || !profile.compliance_role) {
        navigate('/onboarding');
        return;
      }

      // All good, go to chat
      navigate('/chat');
    } catch (error) {
      console.error('Error checking auth:', error);
      sessionStorage.setItem('auth_redirect', '/chat');
      navigate('/auth');
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-muted/20 pb-20 lg:pb-0">
      <FeatureGuide 
        open={guideOpen} 
        onOpenChange={setGuideOpen} 
        featureType={selectedFeature}
      />
      <MobileNav />
      <div className="px-4 sm:px-6 pt-4 flex items-center gap-3">
        <div className="h-16 w-16 rounded-full bg-background flex items-center justify-center flex-shrink-0 overflow-hidden">
          <img src={regbrainBrainLogo} alt="RegBrain logo" className="h-12 w-12 object-contain" />
        </div>
        <span className="text-2xl font-bold tracking-tight bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent">RegBrain</span>
      </div>
      <section className="relative overflow-hidden px-4 sm:px-6 pt-6 sm:pt-12 pb-16 sm:pb-32">
        <div className="max-w-6xl mx-auto">
          <div className="text-center space-y-6 sm:space-y-8 animate-fade-in">
            <h1 className="text-3xl sm:text-5xl md:text-7xl font-bold tracking-tight px-2">
              <span className="bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent">
                Compliance Automation
              </span>
            </h1>
            
            <p className="text-base sm:text-xl md:text-2xl text-muted-foreground max-w-3xl mx-auto px-4">
              L'intelligenza artificiale come strumento di supporto per la conformità normativa
            </p>
            
            <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 justify-center pt-4 px-4">
              <Button 
                size="lg" 
                className="gradient-hero-button text-base sm:text-lg px-6 sm:px-8 py-5 sm:py-6 w-full sm:w-auto"
                onClick={handleStartDemo}
                disabled={loadingDemo}
              >
                {loadingDemo ? "Creazione demo..." : "Prova la demo gratuita"}
                <ArrowRight className="ml-2 w-4 h-4 sm:w-5 sm:h-5" />
              </Button>
            </div>
          </div>
        </div>
        
        {/* Decorative gradient orbs */}
        <div className="absolute top-0 left-0 w-48 h-48 sm:w-96 sm:h-96 bg-primary/20 rounded-full blur-3xl -z-10 animate-pulse" />
        <div className="absolute bottom-0 right-0 w-48 h-48 sm:w-96 sm:h-96 bg-secondary/20 rounded-full blur-3xl -z-10 animate-pulse" />
      </section>



      {/* Features Section - UPDATED */}
      <section className="px-6 py-20 bg-gradient-to-b from-muted/30 to-background">
        <div className="max-w-6xl mx-auto">
          <div className="text-center space-y-4 mb-16">
            <h2 className="text-4xl md:text-5xl font-bold">Piattaforma GRC enterprise</h2>
            <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
              Non solo un chatbot: un sistema completo per gap analysis, risk assessment e audit documentation
            </p>
          </div>

          <div className="grid md:grid-cols-2 gap-8">
            {/* Feature 1: Analisi Conformità Unificata */}
            <div className="document-card space-y-4 hover:scale-105 transition-transform relative group">
              <Button
                size="sm"
                variant="secondary"
                className="absolute top-4 right-4 opacity-0 group-hover:opacity-100 transition-opacity"
                onClick={() => handleFeatureClick('compliance')}
              >
                <Target className="w-4 h-4 mr-2" />
                Usa ora
              </Button>
              <div className="w-12 h-12 rounded-lg bg-gradient-to-br from-blue-600 to-purple-600 flex items-center justify-center">
                <Target className="w-6 h-6 text-white" />
              </div>
              <h3 className="text-2xl font-semibold">Analisi conformità</h3>
              <p className="text-muted-foreground">
                <strong>Gap Analysis + Predictive Analytics unificati:</strong> analizza lo stato attuale e prevedi rischi futuri con Machine Learning. 
                Report dettagliati con priorità, sanzioni potenziali e ROI della rimediazione.
              </p>
              <ul className="space-y-2 text-sm">
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-green-600" />
                  <span>Gap analysis automatica in tempo reale</span>
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-green-600" />
                  <span>Previsioni Machine Learning sui rischi futuri</span>
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-green-600" />
                  <span>Calcolo sanzioni e ROI rimediazione</span>
                </li>
              </ul>
            </div>

            {/* Feature 5: RAG Chat */}
            <div className="document-card space-y-4 hover:scale-105 transition-transform relative group">
              <Button
                size="sm"
                variant="secondary"
                className="absolute top-4 right-4 opacity-0 group-hover:opacity-100 transition-opacity"
                onClick={handleUsaOra}
              >
                <Search className="w-4 h-4 mr-2" />
                Usa ora
              </Button>
              <div className="w-12 h-12 rounded-lg bg-gradient-to-br from-primary to-primary-glow flex items-center justify-center">
                <Search className="w-6 h-6 text-white" />
              </div>
              <h3 className="text-2xl font-semibold">RAG normativo</h3>
              <p className="text-muted-foreground">
                Risposte immediate su GDPR, NIS2, AI Act, CRA, DORA, CER con citazioni precise.
              </p>
            </div>


          </div>
        </div>
      </section>


      {/* RAG vs AI Generalista Section */}
      <section className="px-6 py-20 bg-muted/20">
        <div className="max-w-6xl mx-auto">
          <div className="text-center space-y-4 mb-16">
            <h2 className="text-4xl md:text-5xl font-bold">
              Perché un RAG specifico supera
              <br />
              <span className="bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent">
                qualsiasi AI generalista
              </span>
            </h2>
            <p className="text-xl text-muted-foreground max-w-3xl mx-auto">
              Le AI generaliste sono potenti, ma non abbastanza per la conformità normativa
            </p>
          </div>

          <div className="grid md:grid-cols-2 gap-8 mb-12">
            {/* Vantaggio 1 */}
            <div className="document-card border-l-4 border-l-primary space-y-4">
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 rounded-lg bg-gradient-to-br from-primary to-primary-glow flex items-center justify-center shrink-0">
                  <BookOpen className="w-6 h-6 text-white" />
                </div>
                <div className="space-y-2">
                  <h3 className="text-xl font-semibold">Fonti aggiornate e verificabili</h3>
                  <p className="text-muted-foreground">
                    <strong>RAG specifico:</strong> accede a documenti normativi ufficiali aggiornati in tempo reale,
                    con citazioni precise e tracciabili ai testi di legge.
                  </p>
                  <p className="text-muted-foreground">
                    <strong>AI generalista:</strong> conosce solo informazioni fino alla data di training,
                    spesso obsolete per normative in continua evoluzione. Nessuna fonte verificabile.
                  </p>
                </div>
              </div>
            </div>

            {/* Vantaggio 2 */}
            <div className="document-card border-l-4 border-l-secondary space-y-4">
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 rounded-lg bg-gradient-to-br from-secondary to-secondary-glow flex items-center justify-center shrink-0">
                  <Target className="w-6 h-6 text-white" />
                </div>
                <div className="space-y-2">
                  <h3 className="text-xl font-semibold">Precisione legale vs approssimazione</h3>
                  <p className="text-muted-foreground">
                    <strong>RAG specifico:</strong> addestrato su corpus normativo specializzato,
                    comprende terminologia legale, riferimenti incrociati tra normative e contesto giuridico.
                  </p>
                  <p className="text-muted-foreground">
                    <strong>AI generalista:</strong> genera risposte plausibili ma generiche,
                    con rischio elevato di "allucinazioni" su dettagli normativi critici.
                  </p>
                </div>
              </div>
            </div>

            {/* Vantaggio 3 */}
            <div className="document-card border-l-4 border-l-accent space-y-4">
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 rounded-lg bg-gradient-to-br from-accent to-accent/80 flex items-center justify-center shrink-0">
                  <Scale className="w-6 h-6 text-white" />
                </div>
                <div className="space-y-2">
                  <h3 className="text-xl font-semibold">Contestualizzazione automatica</h3>
                  <p className="text-muted-foreground">
                    <strong>RAG specifico:</strong> personalizza risposte in base a giurisdizione,
                    settore e ruolo aziendale. Integra automaticamente normative correlate (GDPR + NIS2 + AI Act).
                  </p>
                  <p className="text-muted-foreground">
                    <strong>AI generalista:</strong> richiede prompt engineering complesso per ottenere il contesto adeguato.
                    Non conosce le interazioni tra normative diverse.
                  </p>
                </div>
              </div>
            </div>

            {/* Vantaggio 4 */}
            <div className="document-card border-l-4 border-l-primary space-y-4">
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 rounded-lg bg-gradient-to-br from-primary to-primary-glow flex items-center justify-center shrink-0">
                  <Zap className="w-6 h-6 text-white" />
                </div>
                <div className="space-y-2">
                  <h3 className="text-xl font-semibold">Audit trail e conformità</h3>
                  <p className="text-muted-foreground">
                    <strong>RAG specifico:</strong> ogni risposta è tracciata con timestamp, fonte
                    e percentuale di rilevanza. Pieno rispetto dei requisiti di accountability normativa.
                  </p>
                  <p className="text-muted-foreground">
                    <strong>AI generalista:</strong> nessuna tracciabilità delle fonti,
                    non utilizzabile per documentazione di conformità o audit esterni.
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Comparison Table */}
          <div className="document-card overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b bg-muted/30">
                    <th className="text-left p-4 font-semibold">Caratteristica</th>
                    <th className="text-left p-4 font-semibold text-primary">RAG normativo RegBrain</th>
                    <th className="text-left p-4 font-semibold text-muted-foreground">AI generalista</th>
                  </tr>
                </thead>
                <tbody>
                  <tr className="border-b">
                    <td className="p-4 font-medium">Aggiornamento normative</td>
                    <td className="p-4"><CheckCircle2 className="w-5 h-5 text-primary inline mr-2" />Tempo reale</td>
                    <td className="p-4 text-muted-foreground">Fermo alla data di training</td>
                  </tr>
                  <tr className="border-b bg-muted/10">
                    <td className="p-4 font-medium">Citazioni verificabili</td>
                    <td className="p-4"><CheckCircle2 className="w-5 h-5 text-primary inline mr-2" />Con % rilevanza e link</td>
                    <td className="p-4 text-muted-foreground">Non disponibili</td>
                  </tr>
                  <tr className="border-b">
                    <td className="p-4 font-medium">Precisione legale</td>
                    <td className="p-4"><CheckCircle2 className="w-5 h-5 text-primary inline mr-2" />98% di accuratezza</td>
                    <td className="p-4 text-muted-foreground">Approssimativa, rischio allucinazioni</td>
                  </tr>
                  <tr className="border-b bg-muted/10">
                    <td className="p-4 font-medium">Contestualizzazione</td>
                    <td className="p-4"><CheckCircle2 className="w-5 h-5 text-primary inline mr-2" />Automatica per settore/ruolo</td>
                    <td className="p-4 text-muted-foreground">Richiede prompt complessi</td>
                  </tr>
                  <tr className="border-b">
                    <td className="p-4 font-medium">Audit trail</td>
                    <td className="p-4"><CheckCircle2 className="w-5 h-5 text-primary inline mr-2" />Completo e certificabile</td>
                    <td className="p-4 text-muted-foreground">Non tracciabile</td>
                  </tr>
                  <tr className="bg-muted/10">
                    <td className="p-4 font-medium">Costo</td>
                    <td className="p-4"><CheckCircle2 className="w-5 h-5 text-primary inline mr-2" />Ottimizzato per uso specifico</td>
                    <td className="p-4 text-muted-foreground">Costo elevato per risultati generici</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          <div className="mt-12 text-center">
            <div className="inline-block document-card bg-gradient-to-br from-primary/10 to-secondary/10 p-8 max-w-3xl">
              <p className="text-muted-foreground">
                Per la conformità normativa, un RAG specializzato non è solo "migliore" di un AI generalista:
                è l'<strong>unica soluzione affidabile</strong> per ottenere risposte legalmente accurate,
                aggiornate e verificabili. Gli AI generalisti sono eccellenti per conversazioni generiche,
                ma quando si tratta di GDPR, NIS2 o AI Act serve precisione chirurgica.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Personalization Section */}
      <section className="px-4 sm:px-6 py-12 sm:py-20 bg-gradient-to-br from-primary/5 via-background to-secondary/5">
        <div className="max-w-6xl mx-auto">
          <div className="text-center space-y-3 sm:space-y-4 mb-8 sm:mb-12">
            <h2 className="text-3xl sm:text-4xl md:text-5xl font-bold">
              Risposte
              <span className="bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent"> personalizzate </span>
              in base al tuo profilo
            </h2>
            <p className="text-base sm:text-xl text-muted-foreground max-w-3xl mx-auto px-4">
              Nessuna risposta generica: ogni analisi si adatta automaticamente al tuo ruolo, settore e giurisdizione
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-6 sm:gap-8 mb-12">
            {/* Ruolo */}
            <div className="document-card space-y-4 border-l-4 border-l-primary">
              <div className="space-y-2">
                <h3 className="text-xl font-semibold flex items-center gap-2">
                  <Scale className="w-5 h-5 text-primary" />
                  In base al tuo ruolo
                </h3>
                <div className="space-y-3 text-sm text-muted-foreground">
                  <div className="p-3 bg-muted/50 rounded">
                    <strong className="text-foreground">DPO:</strong> Focus su GDPR, DPIA, registri trattamenti, notifiche al Garante
                  </div>
                  <div className="p-3 bg-muted/50 rounded">
                    <strong className="text-foreground">CISO:</strong> Misure tecniche, gestione rischi ICT, incident response, cybersecurity
                  </div>
                  <div className="p-3 bg-muted/50 rounded">
                    <strong className="text-foreground">Legal:</strong> Interpretazione normativa approfondita, rischi giuridici, contrattualistica
                  </div>
                </div>
              </div>
            </div>

            {/* Settore */}
            <div className="document-card space-y-4 border-l-4 border-l-secondary">
              <div className="space-y-2">
                <h3 className="text-xl font-semibold flex items-center gap-2">
                  <Target className="w-5 h-5 text-secondary" />
                  In base al tuo settore
                </h3>
                <div className="space-y-3 text-sm text-muted-foreground">
                  <div className="p-3 bg-muted/50 rounded">
                    <strong className="text-foreground">Finance:</strong> DORA, NIS2, requisiti specifici settore finanziario
                  </div>
                  <div className="p-3 bg-muted/50 rounded">
                    <strong className="text-foreground">Healthcare:</strong> GDPR categoriale sanitario, normative settoriali
                  </div>
                  <div className="p-3 bg-muted/50 rounded">
                    <strong className="text-foreground">Tech:</strong> AI Act, CRA, sviluppo prodotti digitali
                  </div>
                </div>
              </div>
            </div>

            {/* Giurisdizione */}
            <div className="document-card space-y-4 border-l-4 border-l-accent">
              <div className="space-y-2">
                <h3 className="text-xl font-semibold flex items-center gap-2">
                  <Shield className="w-5 h-5 text-accent" />
                  In base alla tua giurisdizione
                </h3>
                <div className="space-y-3 text-sm text-muted-foreground">
                  <div className="p-3 bg-muted/50 rounded">
                    <strong className="text-foreground">IT:</strong> Recepimenti italiani, specificità Garante Privacy
                  </div>
                  <div className="p-3 bg-muted/50 rounded">
                    <strong className="text-foreground">EU:</strong> Normative direttamente applicabili, orientamenti EDPB
                  </div>
                  <div className="p-3 bg-muted/50 rounded">
                    <strong className="text-foreground">Multi-jurisdiction:</strong> Comparazione tra normative di diverse giurisdizioni
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Example comparison */}
          <div className="document-card bg-gradient-to-br from-primary/10 to-secondary/10 p-6 sm:p-8">
            <h3 className="text-lg sm:text-xl font-semibold mb-4 flex items-center gap-2">
              <Zap className="w-5 h-5 text-primary" />
              Esempio concreto: stessa domanda, risposte diverse
            </h3>
            
            {/* La domanda esempio */}
            <div className="mb-6 p-4 bg-background/80 rounded-lg border border-primary/20">
              <p className="text-sm text-muted-foreground mb-1">Domanda posta:</p>
              <p className="text-base font-medium italic">"Quali obblighi ho con DORA e come devo prepararmi alla compliance?"</p>
            </div>
            
            <div className="grid md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <div className="text-sm font-medium text-primary">DPO nel settore Finance (IT)</div>
                <div className="text-sm text-muted-foreground bg-background/50 p-4 rounded">
                  "Per DORA, come responsabile privacy in una banca italiana, devi coordinare la gestione rischi ICT con il CISO. 
                  Secondo l'<strong>Articolo 5 DORA</strong>, sei coinvolto nella governance del framework ICT risk management. 
                  Il Garante Privacy italiano richiede inoltre..."
                </div>
              </div>
              <div className="space-y-2">
                <div className="text-sm font-medium text-secondary">CISO nel settore Tech (EU)</div>
                <div className="text-sm text-muted-foreground bg-background/50 p-4 rounded">
                  "Come CISO in ambito tech, DORA si applica se fornisci servizi ICT a entità finanziarie. 
                  L'<strong>Articolo 28</strong> definisce criteri di criticità. Per te è più rilevante il <strong>Cyber Resilience Act</strong> 
                  sui prodotti digitali che sviluppi..."
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>



      {/* Progettato per professionisti */}
      <section className="px-6 py-20">
        <div className="max-w-6xl mx-auto">
          <div className="grid md:grid-cols-2 gap-12 items-center">
            <div className="space-y-6">
              <h2 className="text-4xl font-bold">Progettato per professionisti</h2>
              <div className="space-y-4">
                <div className="flex gap-3">
                  <CheckCircle2 className="w-6 h-6 text-primary shrink-0 mt-1" />
                  <div>
                    <h3 className="font-semibold text-lg">Citazioni verificabili</h3>
                    <p className="text-muted-foreground">Ogni risposta include riferimenti precisi con percentuale di rilevanza</p>
                  </div>
                </div>
                <div className="flex gap-3">
                  <CheckCircle2 className="w-6 h-6 text-primary shrink-0 mt-1" />
                  <div>
                    <h3 className="font-semibold text-lg">Personalizzazione contestuale</h3>
                    <p className="text-muted-foreground">Risposte adattate a giurisdizione, settore e ruolo specifici</p>
                  </div>
                </div>
                <div className="flex gap-3">
                  <CheckCircle2 className="w-6 h-6 text-primary shrink-0 mt-1" />
                  <div>
                    <h3 className="font-semibold text-lg">Audit trail completo</h3>
                    <p className="text-muted-foreground">Traccia ogni consultazione per conformità e accountability</p>
                  </div>
                </div>
                <div className="flex gap-3">
                  <CheckCircle2 className="w-6 h-6 text-primary shrink-0 mt-1" />
                  <div>
                    <h3 className="font-semibold text-lg">Multi-normativa</h3>
                    <p className="text-muted-foreground">
                      GDPR, NIS2, AI Act, Cyber Resilience Act, DORA, Direttiva CER, 
                      Codice della Cybersicurezza (ACN, DL 82/2021, D.lgs. NIS, DL Perimetro, normativa settori critici energia/trasporti/bancario/sanitario, reati informatici)
                      e possibilità di estensione con altre normative europee
                    </p>
                  </div>
                </div>
              </div>
            </div>
            
            <div className="document-card bg-gradient-to-br from-primary/5 to-secondary/5 p-8">
              <div className="space-y-4">
                <div className="text-6xl font-bold text-primary">98%</div>
                <p className="text-xl font-semibold">Precisione delle citazioni</p>
                <p className="text-muted-foreground">
                  Basato su retrieval semantico avanzato e re-ranking dei risultati
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Vision Section */}
      <section className="px-6 py-20 bg-gradient-to-br from-primary/5 via-background to-secondary/5">
        <div className="max-w-4xl mx-auto space-y-12">
          <div className="text-center space-y-6">
            <h2 className="text-4xl md:text-5xl font-bold">
              <span className="bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent">
                La nostra visione
              </span>
            </h2>
          </div>

          <div className="document-card p-8 bg-gradient-to-br from-primary/10 to-secondary/10 border-2 border-primary/20">
            <div className="flex items-start gap-4">
              <div className="flex-shrink-0 w-12 h-12 rounded-full bg-primary/20 flex items-center justify-center">
                <Shield className="w-6 h-6 text-primary" />
              </div>
              <blockquote className="flex-1 space-y-2">
                <p className="text-lg md:text-xl text-foreground italic leading-relaxed">
                  "La compliance non dovrebbe essere un peso burocratico, ma un vantaggio competitivo. 
                  La nostra AI permette alle aziende di concentrarsi sull'innovazione, mentre noi gestiamo 
                  la complessità normativa."
                </p>
              </blockquote>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="px-6 py-20">
        <div className="max-w-4xl mx-auto text-center space-y-8">
          <h2 className="text-4xl md:text-5xl font-bold">
            Pronto a semplificare la conformità?
          </h2>
          <p className="text-xl text-muted-foreground">
            Inizia gratuitamente con la demo, nessuna carta di credito richiesta.
          </p>
          <Button 
            size="lg" 
            className="gradient-hero-button text-lg px-12 py-6"
            onClick={() => navigate('/auth')}
          >
            Accedi alla demo
            <ArrowRight className="ml-2 w-5 h-5" />
          </Button>
        </div>
      </section>

      {/* Contact Section */}
      <section className="px-6 py-16 bg-muted/30 border-t">
        <div className="max-w-4xl mx-auto text-center space-y-6">
          <h2 className="text-3xl md:text-4xl font-bold">Hai domande?</h2>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            Il nostro team è a disposizione per rispondere a qualsiasi domanda generica o specifica 
            sulla piattaforma e sui servizi di compliance.
          </p>
          <div className="document-card inline-block p-6 bg-gradient-to-br from-card to-background">
            <div className="flex items-center justify-center gap-3">
              <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
                <BookOpen className="w-6 h-6 text-primary" />
              </div>
              <div className="text-left">
                <p className="text-sm text-muted-foreground mb-1">Scrivici a</p>
                <a 
                  href="mailto:regbrain.contact@gmail.com"
                  className="text-lg font-semibold text-primary hover:underline"
                >
                  regbrain.contact@gmail.com
                </a>
                <a 
                  href="https://www.linkedin.com/company/reg-brain/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm text-muted-foreground hover:text-primary transition-colors mt-1 block"
                >
                  Seguici su LinkedIn
                </a>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Team Section */}
      <section className="px-6 py-16 bg-background border-t">
        <div className="max-w-4xl mx-auto space-y-10">
          <h2 className="text-3xl font-bold text-center text-foreground">Il nostro team</h2>
          <div className="grid gap-8 md:grid-cols-2">
            <div className="space-y-2">
              <h3 className="text-lg font-bold text-foreground">Matteo Piccirilli — CEO</h3>
              <p className="text-sm text-muted-foreground">
                Esperto in cybersecurity compliance. MSc Data Science and Management e vincitore della borsa di studio come ricercatore in cybersecurity al Campus Biomedico di Roma.
              </p>
            </div>
            <div className="space-y-2">
              <h3 className="text-lg font-bold text-foreground">Giovanni Sollami — CTO</h3>
              <p className="text-sm text-muted-foreground">
                Ingegnere gestionale con background in IT e financial services, focalizzato sullo sviluppo di soluzioni e automazioni basate sull'AI per innovare e ottimizzare i processi aziendali. Presidia retrieval, orchestrazione degli agenti e audit trail.
              </p>
            </div>
            <div className="space-y-2">
              <h3 className="text-lg font-bold text-foreground">Luca D'Agostino — Chief Legal Officer</h3>
              <p className="text-sm text-muted-foreground">
                Avvocato specializzato in privacy e cybersecurity EU, autore del codice della cibersicurezza. LLM Privacy Law.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Legal Disclaimer */}
      <section className="px-6 py-12 bg-muted/20 border-t">
        <div className="max-w-4xl mx-auto text-center space-y-3">
          <h3 className="text-lg font-semibold text-foreground">Disclaimer legale</h3>
          <p className="text-sm text-muted-foreground max-w-2xl mx-auto">
            RegBrain è uno strumento di supporto informativo e non costituisce consulenza legale. 
            Per questioni legali specifiche, consultare sempre un professionista qualificato.
          </p>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t px-6 py-8 bg-card/50">
        <div className="max-w-6xl mx-auto">
          <div className="flex flex-col md:flex-row justify-between items-start gap-8 mb-8">
            {/* Brand */}
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <Shield className="w-6 h-6 text-primary" />
                <span className="font-semibold text-lg">RegBrain</span>
              </div>
              <p className="text-sm text-muted-foreground max-w-xs">
                Piattaforma GRC enterprise per la compliance normativa europea con AI.
              </p>
            </div>

            {/* Legal Links */}
            <div className="space-y-3">
              <h4 className="font-semibold text-sm uppercase tracking-wider text-muted-foreground">Legale</h4>
              <nav className="flex flex-col gap-2">
                <a 
                  href="/terms" 
                  className="text-sm text-muted-foreground hover:text-foreground transition-colors"
                  onClick={(e) => { e.preventDefault(); navigate('/terms'); }}
                >
                  Termini e Condizioni
                </a>
                <a 
                  href="/privacy" 
                  className="text-sm text-muted-foreground hover:text-foreground transition-colors"
                  onClick={(e) => { e.preventDefault(); navigate('/privacy'); }}
                >
                  Privacy Policy
                </a>
                <a 
                  href="/cookie-policy" 
                  className="text-sm text-muted-foreground hover:text-foreground transition-colors"
                  onClick={(e) => { e.preventDefault(); navigate('/cookie-policy'); }}
                >
                  Cookie Policy
                </a>
              </nav>
            </div>

            {/* Contact */}
            <div className="space-y-3">
              <h4 className="font-semibold text-sm uppercase tracking-wider text-muted-foreground">Contatti</h4>
              <nav className="flex flex-col gap-2">
                <a 
                  href="mailto:regbrain.contact@gmail.com" 
                  className="text-sm text-muted-foreground hover:text-foreground transition-colors"
                >
                  regbrain.contact@gmail.com
                </a>
                <a 
                  href="https://www.linkedin.com/company/reg-brain/" 
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm text-muted-foreground hover:text-foreground transition-colors"
                >
                  LinkedIn
                </a>
              </nav>
            </div>
          </div>

          {/* Copyright */}
          <div className="border-t pt-6 flex flex-col md:flex-row justify-between items-center gap-4">
            <p className="text-sm text-muted-foreground">
              © 2026 RegBrain — RegTech per cybersecurity e privacy.
            </p>
            <div className="flex items-center gap-4 text-xs text-muted-foreground">
              <span>Dati su server UE</span>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default Landing;
