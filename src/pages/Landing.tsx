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
    if (loadingDemo) return;
    setLoadingDemo(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (session && (!session.user.app_metadata?.demo_expires_at ||
        Date.parse(session.user.app_metadata.demo_expires_at) > Date.now())) {
        navigate('/onboarding');
        return;
      }
      const siteToken = sessionStorage.getItem('site_auth_token');
      if (!siteToken) throw new Error('Rientra nel sito con la password per avviare la demo.');
      const response = await fetch('/api/supabase/functions/v1/start-demo', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + siteToken },
        body: '{}',
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Demo temporaneamente non disponibile.');
      if (!data.access_token || !data.refresh_token) throw new Error('La sessione demo non è stata attivata.');
      const { error } = await supabase.auth.setSession({ access_token: data.access_token, refresh_token: data.refresh_token });
      if (error) throw new Error('Non è stato possibile completare l’accesso alla demo.');
      sessionStorage.setItem('force_demo_onboarding', 'true');
      toast({ title: 'Demo attivata', description: 'Account temporaneo valido per 24 ore. Configura il profilo per iniziare.' });
      navigate('/onboarding');
    } catch (error) {
      toast({ title: 'Demo non disponibile', description: error instanceof Error ? error.message : 'Riprova tra poco.', variant: 'destructive' });
    } finally {
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
      {/* Hero */}
      <section className="relative overflow-hidden px-4 sm:px-6 pt-6 sm:pt-12 pb-16 sm:pb-28">
        <div className="max-w-5xl mx-auto">
          <div className="text-center space-y-6 sm:space-y-8 animate-fade-in">
            <Badge variant="secondary" className="text-xs sm:text-sm px-3 py-1">
              GDPR · NIS2 · DORA · AI Act · CRA · Data Act
            </Badge>
            <h1 className="text-3xl sm:text-5xl md:text-6xl font-bold tracking-tight px-2 leading-tight">
              Automazione della compliance: dove gli agenti fanno il lavoro e{" "}
              <span className="bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent">
                tu firmi.
              </span>
            </h1>

            <p className="text-base sm:text-xl md:text-2xl text-muted-foreground max-w-3xl mx-auto px-4">
              Il SaaS di compliance cyber e privacy in cui gli agenti AI eseguono il lavoro di routine
              e chi è responsabile supervisiona e firma.
            </p>

            <p className="text-sm sm:text-base text-muted-foreground/80 max-w-2xl mx-auto px-4">
              Per i DPO e i consulenti che seguono molti clienti. Per le PMI che la compliance devono gestirla in casa.
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

      {/* Costruito con i DPO */}
      <section className="px-4 sm:px-6 py-10 sm:py-12 border-y border-border bg-muted/30">
        <div className="max-w-5xl mx-auto text-center space-y-6">
          <div className="space-y-2">
            <h2 className="text-2xl sm:text-3xl font-bold">Costruito con i DPO, per i DPO</h2>
            <p className="text-muted-foreground max-w-2xl mx-auto">
              Non è una scrivania di sviluppatori che immagina come si fa compliance: il prodotto è costruito
              attorno al lavoro di chi la responsabilità se la prende davvero.
            </p>
          </div>
          <div className="max-w-2xl mx-auto text-sm text-left">
            <div className="document-card space-y-1">
              <p className="font-semibold text-foreground">La firma resta a chi risponde</p>
              <p className="text-muted-foreground">
                l'app prepara l'istruttoria e la prova; la valutazione e la responsabilità restano del DPO o
                del titolare.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Cosa fa */}
      <section className="px-4 sm:px-6 py-16 sm:py-20 bg-gradient-to-b from-muted/30 to-background">
        <div className="max-w-6xl mx-auto">
          <div className="text-center space-y-4 mb-12 sm:mb-16">
            <h2 className="text-3xl sm:text-4xl md:text-5xl font-bold">Cosa fa RegBrain</h2>
            <p className="text-lg sm:text-xl text-muted-foreground max-w-3xl mx-auto">
              Quattro agenti specializzati coprono il ciclo della compliance. Il responsabile interviene
              solo dove serve il giudizio e chiude con la firma.
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-6 sm:gap-8">
            <div className="document-card space-y-4">
              <div className="w-12 h-12 rounded-lg bg-gradient-to-br from-primary to-primary-glow flex items-center justify-center">
                <Target className="w-6 h-6 text-white" />
              </div>
              <h3 className="text-xl sm:text-2xl font-semibold">Capisce cosa ti si applica</h3>
              <p className="text-muted-foreground">
                Dal profilo dell'organizzazione agli obblighi reali: GDPR, NIS2, DORA, AI Act, CRA e Data Act
                qualificati sul tuo perimetro, non in generale.
              </p>
            </div>

            <div className="document-card space-y-4">
              <div className="w-12 h-12 rounded-lg bg-gradient-to-br from-primary to-primary-glow flex items-center justify-center">
                <FileText className="w-6 h-6 text-white" />
              </div>
              <h3 className="text-xl sm:text-2xl font-semibold">Fa il lavoro</h3>
              <p className="text-muted-foreground">
                Confronta i tuoi documenti con gli obblighi, redige DPIA, RoPA e LIA pronte all'audit
                con citazione alla fonte, e sorveglia in continuo cosa cambia.
              </p>
            </div>

            <div className="document-card space-y-4">
              <div className="w-12 h-12 rounded-lg bg-gradient-to-br from-primary to-primary-glow flex items-center justify-center">
                <Shield className="w-6 h-6 text-white" />
              </div>
              <h3 className="text-xl sm:text-2xl font-semibold">Ti dà la prova</h3>
              <p className="text-muted-foreground">
                Ogni azione dell'agente e ogni decisione umana finiscono in un audit trail immutabile:
                la catena di evidenza che serve in ispezione.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Il problema */}
      <section className="px-4 sm:px-6 py-16 sm:py-20">
        <div className="max-w-6xl mx-auto">
          <div className="text-center space-y-4 mb-12">
            <h2 className="text-3xl sm:text-4xl md:text-5xl font-bold">
              La compliance cresce.{" "}
              <span className="bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent">
                Le ore per farla, no.
              </span>
            </h2>
          </div>

          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6 mb-8">
            <div className="document-card space-y-2">
              <div className="text-3xl sm:text-4xl font-bold text-primary">~100</div>
              <p className="text-sm text-muted-foreground">
                leggi UE sul digitale e oltre 270 autorità di regolazione, che tra loro spesso non si coordinano.
              </p>
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground/60">Rapporto Draghi, 2024</p>
            </div>
            <div className="document-card space-y-2">
              <div className="text-3xl sm:text-4xl font-bold text-primary">60%</div>
              <p className="text-sm text-muted-foreground">
                delle imprese UE indica la regolamentazione come un ostacolo diretto agli investimenti.
              </p>
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground/60">Rapporto Draghi, 2024</p>
            </div>
            <div className="document-card space-y-2">
              <div className="text-3xl sm:text-4xl font-bold text-primary">24%</div>
              <p className="text-sm text-muted-foreground">
                del personale delle PMI italiane assorbito dagli adempimenti normativi, contro l'11% tedesco.
              </p>
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground/60">CGIA di Mestre</p>
            </div>
            <div className="document-card space-y-2">
              <div className="text-3xl sm:text-4xl font-bold text-primary">20.000</div>
              <p className="text-sm text-muted-foreground">
                soggetti NIS2 italiani che l'ACN può ispezionare e sanzionare dal 31 ottobre 2026.
              </p>
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground/60">ACN, calendario 2026</p>
            </div>
          </div>

          <div className="grid md:grid-cols-2 gap-6">
            <div className="document-card border-l-4 border-l-primary space-y-2">
              <h3 className="text-lg font-semibold">Per il DPO e il consulente</h3>
              <p className="text-muted-foreground">
                Ogni cliente in più sono ore in più: DPIA, RoPA e LIA si scrivono a mano, una alla volta.
                Il portafoglio è limitato dalle ore di una persona che risponde in proprio davanti al Garante.
              </p>
            </div>
            <div className="document-card border-l-4 border-l-secondary space-y-2">
              <h3 className="text-lg font-semibold">Per la PMI</h3>
              <p className="text-muted-foreground">
                Consapevolezza media 55 su 100, sotto la soglia di sufficienza (Cyber Index PMI 2025).
                Gli obblighi arrivano lo stesso, ma dentro l'azienda non c'è nessuno che li presidia.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Perché il problema resta */}
      <section className="px-4 sm:px-6 py-16 sm:py-20 bg-muted/20">
        <div className="max-w-6xl mx-auto">
          <div className="text-center space-y-4 mb-12">
            <h2 className="text-3xl sm:text-4xl md:text-5xl font-bold">
              Le soluzioni esistono.{" "}
              <span className="bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent">
                Il problema resta.
              </span>
            </h2>
          </div>

          <div className="grid md:grid-cols-3 gap-6 sm:gap-8 mb-8">
            <div className="document-card space-y-3">
              <h3 className="text-xl font-semibold">La consulenza tradizionale</h3>
              <p className="text-muted-foreground">
                Compri ore, non capacità. La fotografia vale il giorno della firma e il conto cresce a ogni
                nuovo adempimento. Il consulente, a sua volta, è limitato dalle sue ore.
              </p>
              <p className="text-sm font-semibold uppercase tracking-wider text-primary">Non scala</p>
            </div>
            <div className="document-card space-y-3">
              <h3 className="text-xl font-semibold">I gestionali privacy</h3>
              <p className="text-muted-foreground">
                Archiviano ciò che scrivi tu. Il registro diventa un contenitore ordinato, ma l'analisi,
                la redazione e l'aggiornamento restano interamente lavoro manuale.
              </p>
              <p className="text-sm font-semibold uppercase tracking-wider text-primary">Archiviano, non ragionano</p>
            </div>
            <div className="document-card space-y-3">
              <h3 className="text-xl font-semibold">Le AI generaliste</h3>
              <p className="text-muted-foreground">
                Rispondono su tutto, ma senza fonte qualificata né versione della norma, senza memoria del
                fascicolo e senza traccia. In ispezione, avere chiesto a un chatbot non è due diligence.
              </p>
              <p className="text-sm font-semibold uppercase tracking-wider text-primary">Non sono difendibili</p>
            </div>
          </div>

          <div className="document-card bg-gradient-to-br from-primary/10 to-secondary/10 border-2 border-primary/20">
            <p className="text-base sm:text-lg text-foreground leading-relaxed">
              In tutti e tre i casi il lavoro e la responsabilità tornano sulla stessa persona. Il punto non è
              generare testo: è <strong>produrre evidenza che regga davanti a un'autorità</strong>, a un cliente
              enterprise o in una due diligence.
            </p>
          </div>
        </div>
      </section>

      {/* A chi serve */}
      <section className="px-4 sm:px-6 py-16 sm:py-20">
        <div className="max-w-6xl mx-auto">
          <div className="text-center space-y-4 mb-12">
            <h2 className="text-3xl sm:text-4xl md:text-5xl font-bold">Due destinatari, lo stesso problema</h2>
            <p className="text-lg sm:text-xl text-muted-foreground max-w-3xl mx-auto">
              La compliance privacy e cyber ricade su chi la esercita per professione e su chi la subisce come
              impresa. RegBrain serve entrambi con lo stesso motore e due modalità d'uso.
            </p>
          </div>

          <div className="grid md:grid-cols-2 gap-6 sm:gap-8 mb-8">
            <div className="document-card space-y-4">
              <h3 className="text-2xl font-semibold">Il professionista della compliance</h3>
              <p className="text-muted-foreground">DPO interni, DPO esterni e frazionali, studi e società di consulenza.</p>
              <div className="space-y-3 pt-2">
                <div className="flex gap-3">
                  <CheckCircle2 className="w-5 h-5 text-primary shrink-0 mt-0.5" />
                  <p className="text-muted-foreground">Il vincolo è il tempo: ogni cliente in più significa ore in più</p>
                </div>
                <div className="flex gap-3">
                  <CheckCircle2 className="w-5 h-5 text-primary shrink-0 mt-0.5" />
                  <p className="text-muted-foreground">Documenti e monitoraggio prodotti a mano, cliente per cliente</p>
                </div>
              </div>
            </div>

            <div className="document-card space-y-4">
              <h3 className="text-2xl font-semibold">La PMI soggetta agli obblighi</h3>
              <p className="text-muted-foreground">
                Aziende in perimetro GDPR, NIS2, DORA, AI Act o CRA senza una funzione compliance strutturata.
              </p>
              <div className="space-y-3 pt-2">
                <div className="flex gap-3">
                  <CheckCircle2 className="w-5 h-5 text-secondary shrink-0 mt-0.5" />
                  <p className="text-muted-foreground">Il vincolo è la competenza: gli obblighi ci sono, il presidio interno no</p>
                </div>
                <div className="flex gap-3">
                  <CheckCircle2 className="w-5 h-5 text-secondary shrink-0 mt-0.5" />
                  <p className="text-muted-foreground">Compliance a episodi, senza evidenza pronta quando serve</p>
                </div>
              </div>
            </div>
          </div>

          <div className="document-card bg-muted/40">
            <p className="text-base sm:text-lg text-muted-foreground">
              Sono due facce dello stesso vuoto di mercato: i gestionali archiviano ma non ragionano,
              i tool AI generici rispondono ma non sono difendibili.
            </p>
          </div>
        </div>
      </section>

      {/* Come si lavora */}
      <section className="px-4 sm:px-6 py-16 sm:py-20 bg-gradient-to-br from-primary/5 via-background to-secondary/5">
        <div className="max-w-6xl mx-auto">
          <div className="text-center space-y-4 mb-12">
            <h2 className="text-3xl sm:text-4xl md:text-5xl font-bold">
              Si adatta a come la{" "}
              <span className="bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent">
                compliance viene esercitata
              </span>
            </h2>
            <p className="text-lg sm:text-xl text-muted-foreground max-w-3xl mx-auto">
              Quattro profili d'uso sullo stesso motore. Il soggetto accountable resta sempre umano:
              l'app non è mai il DPO e non è mai il titolare.
            </p>
          </div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
            <div className="document-card space-y-3">
              <h3 className="text-lg font-semibold">DPO interno</h3>
              <p className="text-sm text-muted-foreground">
                Presidi la conformità di una sola organizzazione. Gli agenti coprono il lavoro di routine,
                tu ti concentri sulle decisioni.
              </p>
              <p className="text-xs font-semibold uppercase tracking-wider text-primary">Presidio supervisionato</p>
            </div>
            <div className="document-card space-y-3">
              <h3 className="text-lg font-semibold">DPO esterno o frazionale</h3>
              <p className="text-sm text-muted-foreground">
                Segui molti clienti in parallelo. Ogni cliente ha profilo, documenti e audit trail separati.
              </p>
              <p className="text-xs font-semibold uppercase tracking-wider text-primary">Multi-cliente</p>
            </div>
            <div className="document-card space-y-3">
              <h3 className="text-lg font-semibold">Studio o società di consulenza</h3>
              <p className="text-sm text-muted-foreground">
                Il team lavora sugli stessi fascicoli con ruoli e firme tracciate. Scali i clienti senza
                moltiplicare le ore.
              </p>
              <p className="text-xs font-semibold uppercase tracking-wider text-primary">Team con ruoli</p>
            </div>
            <div className="document-card space-y-3">
              <h3 className="text-lg font-semibold">PMI</h3>
              <p className="text-sm text-muted-foreground">
                Il referente interno, titolare, IT manager o responsabile qualità, guida gli agenti e firma.
                Il consulente esterno entra sullo stesso fascicolo.
              </p>
              <p className="text-xs font-semibold uppercase tracking-wider text-primary">Presidio interno assistito</p>
            </div>
          </div>
        </div>
      </section>

      {/* Il valore */}
      <section className="px-4 sm:px-6 py-16 sm:py-20">
        <div className="max-w-6xl mx-auto">
          <div className="text-center space-y-4 mb-12">
            <h2 className="text-3xl sm:text-4xl md:text-5xl font-bold">Cosa cambia in concreto</h2>
          </div>

          <div className="grid md:grid-cols-2 gap-6 sm:gap-8 mb-8">
            <div className="document-card space-y-4">
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Prima, oggi</p>
              <div className="space-y-3">
                <p className="text-muted-foreground">Ogni DPIA, RoPA e LIA redatta da zero, a mano</p>
                <p className="text-muted-foreground">Aggiornamenti normativi inseguiti a colpi di newsletter e circolari</p>
                <p className="text-muted-foreground">Nessuna prova strutturata della due diligence in caso di ispezione</p>
                <p className="text-muted-foreground">
                  Il professionista è limitato dalle sue ore, l'azienda dalla consulenza che può permettersi
                </p>
              </div>
            </div>

            <div className="document-card bg-gradient-to-br from-primary/10 to-secondary/10 border-2 border-primary/20 space-y-4">
              <p className="text-xs font-semibold uppercase tracking-wider text-primary">Con RegBrain</p>
              <div className="space-y-3">
                <div className="flex gap-3">
                  <CheckCircle2 className="w-5 h-5 text-primary shrink-0 mt-0.5" />
                  <p className="text-foreground">Documenti generati pronti all'audit, con citazioni alle fonti ufficiali</p>
                </div>
                <div className="flex gap-3">
                  <CheckCircle2 className="w-5 h-5 text-primary shrink-0 mt-0.5" />
                  <p className="text-foreground">Monitoraggio continuo, già qualificato sul profilo dell'organizzazione</p>
                </div>
                <div className="flex gap-3">
                  <CheckCircle2 className="w-5 h-5 text-primary shrink-0 mt-0.5" />
                  <p className="text-foreground">Audit trail immutabile: la catena di evidenza è la prova della due diligence</p>
                </div>
                <div className="flex gap-3">
                  <CheckCircle2 className="w-5 h-5 text-primary shrink-0 mt-0.5" />
                  <p className="text-foreground">Il professionista scala il portafoglio, la PMI presidia con le persone che ha già</p>
                </div>
              </div>
            </div>
          </div>

          <div className="grid md:grid-cols-2 gap-6">
            <div className="document-card bg-muted/40">
              <p className="text-muted-foreground">
                <strong className="text-foreground">Per il DPO e il consulente.</strong> Più clienti a parità di ore,
                margine per il lavoro di giudizio, evidenza difendibile su ogni pratica.
              </p>
            </div>
            <div className="document-card bg-muted/40">
              <p className="text-muted-foreground">
                <strong className="text-foreground">Per la PMI.</strong> Costi prevedibili, obblighi qualificati sul
                proprio perimetro invece che scoperti in ritardo, documentazione pronta per autorità, clienti
                enterprise e bandi.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Qualità misurata */}
      <section className="px-4 sm:px-6 py-16 sm:py-20 bg-muted/20">
        <div className="max-w-6xl mx-auto">
          <div className="text-center space-y-4 mb-12">
            <h2 className="text-3xl sm:text-4xl md:text-5xl font-bold">
              Numeri che si verificano,{" "}
              <span className="bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent">
                non percezioni
              </span>
            </h2>
            <p className="text-lg sm:text-xl text-muted-foreground max-w-3xl mx-auto">
              In compliance la differenza tra un documento generato e un documento difendibile è la possibilità
              di risalire alla fonte.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 sm:gap-6 mb-12">
            <div className="document-card space-y-2">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Fedeltà delle citazioni
              </p>
              <div className="text-3xl sm:text-4xl font-bold text-primary">55 su 55</div>
              <p className="text-sm text-muted-foreground">
                citazioni ritrovate alla lettera nel documento indicato e attribuite al file giusto,
                confrontate a macchina con il testo caricato.
              </p>
            </div>
            <div className="document-card space-y-2">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Copertura normativa
              </p>
              <div className="text-3xl sm:text-4xl font-bold text-primary">254</div>
              <p className="text-sm text-muted-foreground">
                obblighi a catalogo, articolo per articolo su sei regolamenti, ciascuno con la prova
                documentale attesa e la condizione che lo rende applicabile.
              </p>
            </div>
            <div className="document-card space-y-2">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Tempo di analisi
              </p>
              <div className="text-3xl sm:text-4xl font-bold text-primary">70 sec</div>
              <p className="text-sm text-muted-foreground">
                per un'analisi completa sulle sei normative, dal caricamento dei documenti al referto
                con le evidenze.
              </p>
            </div>
          </div>

          {/* Il confronto sta sotto i numeri e non sopra: prima la prova, poi la spiegazione.
              Ogni riga descrive un comportamento osservabile del prodotto, non un aggettivo. */}
          <div className="max-w-4xl mx-auto">
            <h3 className="text-xl sm:text-2xl font-bold text-center mb-2">
              Perché non basta chiedere a un'AI generalista
            </h3>
            <p className="text-sm text-muted-foreground text-center mb-6">
              La differenza non è quanto scrive bene: è da dove prende quello che scrive e cosa fa quando non lo sa.
            </p>
            <div className="document-card overflow-x-auto p-0">
              <table className="w-full text-sm border-collapse">
                <thead>
                  <tr className="border-b border-border">
                    <th className="text-left font-semibold p-3 sm:p-4 w-1/4"></th>
                    <th className="text-left font-semibold p-3 sm:p-4">AI generalista</th>
                    <th className="text-left font-semibold p-3 sm:p-4 text-primary">RegBrain</th>
                  </tr>
                </thead>
                <tbody className="text-muted-foreground">
                  <tr className="border-b border-border/60">
                    <td className="p-3 sm:p-4 font-medium text-foreground align-top">Da dove viene la risposta</td>
                    <td className="p-3 sm:p-4 align-top">Dalla memoria del modello, ferma alla data di addestramento</td>
                    <td className="p-3 sm:p-4 align-top">Dal testo dei regolamenti indicizzato articolo per articolo e dai documenti che carichi</td>
                  </tr>
                  <tr className="border-b border-border/60">
                    <td className="p-3 sm:p-4 font-medium text-foreground align-top">Come si verifica</td>
                    <td className="p-3 sm:p-4 align-top">Il riferimento normativo va ricontrollato a mano, uno per uno</td>
                    <td className="p-3 sm:p-4 align-top">Ogni constatazione cita la frase del tuo documento, ritrovata alla lettera nel file indicato</td>
                  </tr>
                  <tr className="border-b border-border/60">
                    <td className="p-3 sm:p-4 font-medium text-foreground align-top">Quando non sa</td>
                    <td className="p-3 sm:p-4 align-top">Risponde comunque, in modo plausibile</td>
                    <td className="p-3 sm:p-4 align-top">Dichiara l'obbligo da verificare e dice quale condizione manca per deciderlo</td>
                  </tr>
                  <tr className="border-b border-border/60">
                    <td className="p-3 sm:p-4 font-medium text-foreground align-top">Aggiornamento normativo</td>
                    <td className="p-3 sm:p-4 align-top">Dipende da quando il modello è stato addestrato</td>
                    <td className="p-3 sm:p-4 align-top">Il catalogo si aggiorna dalle fonti ufficiali senza riaddestrare nulla</td>
                  </tr>
                  <tr>
                    <td className="p-3 sm:p-4 font-medium text-foreground align-top">Cosa ottieni</td>
                    <td className="p-3 sm:p-4 align-top">Un testo da rileggere e riscrivere</td>
                    <td className="p-3 sm:p-4 align-top">Per ogni obbligo: esito, prova, cosa manca, azione, con il profilo di rischio</td>
                  </tr>
                </tbody>
              </table>
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
              <h3 className="text-lg font-bold text-foreground">Avv. Mara Parpaglioni — Chief Legal Officer</h3>
              <p className="text-sm text-muted-foreground">
                Avvocato specializzato in privacy e cybersecurity EU.
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
                Compliance cyber e privacy: gli agenti fanno il lavoro, chi è responsabile supervisiona e firma.
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
