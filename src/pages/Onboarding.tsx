import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { NativeSelect } from "@/components/ui/native-select";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Shield, ArrowRight, ArrowLeft } from "lucide-react";

const Onboarding = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [jurisdiction, setJurisdiction] = useState("");
  const [sector, setSector] = useState("");
  const [role, setRole] = useState("");
  const [companySize, setCompanySize] = useState("");
  const [dataRole, setDataRole] = useState("");

  useEffect(() => {
    // Precompila il modulo se il profilo esiste già (modifica profilo)
    const loadExisting = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user) return;
      const { data } = await supabase
        .from('profiles')
        .select('jurisdiction, sector, compliance_role, company_size, data_role')
        .eq('id', session.user.id)
        .maybeSingle();
      if (!data) return;
      setJurisdiction(data.jurisdiction || "");
      setSector(data.sector || "");
      setRole(data.compliance_role || "");
      setCompanySize(data.company_size || "");
      setDataRole(data.data_role || "");
    };
    loadExisting();
  }, []);

  useEffect(() => {
    const checkAuth = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        navigate('/auth');
      }
    };
    checkAuth();
  }, [navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault(); // Previene il reload della pagina
    
    if (!jurisdiction || !sector || !role) {
      toast({
        title: "Campi mancanti",
        description: "Compila tutti i campi per continuare",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user) {
        navigate('/auth');
        return;
      }

      // Verifica che l'utente esista in auth.users prima di fare upsert
      // Prova prima a fare update se il profilo esiste già
      const { data: existingProfile } = await supabase
        .from('profiles')
        .select('id')
        .eq('id', session.user.id)
        .maybeSingle();

      let error;
      
      if (existingProfile) {
        // Update profilo esistente
        const result = await supabase
          .from('profiles')
          .update({
            jurisdiction,
            sector,
            compliance_role: role,
            company_size: companySize || null,
            data_role: dataRole || null,
            updated_at: new Date().toISOString(),
          })
          .eq('id', session.user.id);
        error = result.error;
      } else {
        // Insert nuovo profilo - questo fallirà se l'utente non esiste in auth.users
        const result = await supabase
          .from('profiles')
          .insert({
            id: session.user.id,
            jurisdiction,
            sector,
            compliance_role: role,
            company_size: companySize || null,
            data_role: dataRole || null,
          });
        error = result.error;
      }

      if (error) {
        console.error('Error saving profile:', error);
        // Se l'errore è foreign key, significa che l'utente non esiste più
        if (error.message?.includes('foreign key') || error.code === '23503') {
          await supabase.auth.signOut();
          toast({
            title: "Sessione scaduta",
            description: "Per favore effettua nuovamente l'accesso",
            variant: "destructive",
          });
          navigate('/auth');
          return;
        }
        throw error;
      }

      // Profilo salvato con successo - rimuovi il flag di onboarding forzato
      sessionStorage.removeItem('force_demo_onboarding');

      toast({
        title: "Profilo configurato",
        description: "Il tuo profilo è stato salvato con successo",
      });

      // Check if we need to return to a specific page (es. analisi notizia)
      const returnPath = sessionStorage.getItem('auth_redirect');
      
      // IMPORTANTE: Verifica se c'è una pendingAnalysis da elaborare
      const hasPendingAnalysis = localStorage.getItem('pendingAnalysis');
      
      if (returnPath) {
        sessionStorage.removeItem('auth_redirect');
        navigate(returnPath);
      } else if (hasPendingAnalysis) {
        // Se c'è un'analisi pendente, vai alla chat con il parametro
        navigate('/chat?analysis=pending');
      } else {
        navigate('/chat');
      }
    } catch (error: any) {
      console.error('Error saving profile:', error);
      toast({
        title: "Errore",
        description: error.message || "Impossibile salvare il profilo",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-background to-muted/20 px-4 py-8">
      <Card className="w-full max-w-2xl animate-fade-in">
        <CardHeader className="text-center space-y-2">
          <div className="flex justify-center mb-2">
            <Shield className="w-10 h-10 sm:w-12 sm:h-12 text-primary" />
          </div>
          <CardTitle className="text-2xl sm:text-3xl">Configura il tuo Profilo</CardTitle>
          <CardDescription className="text-sm sm:text-base">
            Personalizza le risposte in base al tuo contesto organizzativo
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            <NativeSelect
              id="jurisdiction"
              label="Giurisdizione"
              value={jurisdiction}
              onChange={(e) => setJurisdiction(e.target.value)}
              required
              helperText="Le risposte saranno contestualizzate alle normative della tua giurisdizione"
            >
              <option value="" disabled>Seleziona la giurisdizione</option>
              <option value="IT">Italia</option>
              <option value="EU">Unione Europea (generale)</option>
              <option value="US">Stati Uniti</option>
              <option value="UK">Regno Unito</option>
              <option value="OTHER">Altro</option>
            </NativeSelect>

            <NativeSelect
              id="sector"
              label="Settore"
              value={sector}
              onChange={(e) => setSector(e.target.value)}
              required
              helperText="Alcuni requisiti normativi variano in base al settore"
            >
              <option value="" disabled>Seleziona il settore</option>
              <option value="healthcare">Sanità</option>
              <option value="finance">Finanza e Banking</option>
              <option value="tech">Tecnologia e Software</option>
              <option value="public">Pubblica Amministrazione</option>
              <option value="ecommerce">E-commerce</option>
              <option value="telecom">Telecomunicazioni</option>
              <option value="energy">Energia</option>
              <option value="other">Altro</option>
            </NativeSelect>

            <NativeSelect
              id="role"
              label="Ruolo"
              value={role}
              onChange={(e) => setRole(e.target.value)}
              required
              helperText="Le risposte saranno formulate in base alle tue responsabilità"
            >
              <option value="" disabled>Seleziona il tuo ruolo</option>
              <option value="dpo">Data Protection Officer (DPO)</option>
              <option value="ciso">Chief Information Security Officer (CISO)</option>
              <option value="owner">Titolare del Trattamento</option>
              <option value="consultant">Consulente Privacy/Security</option>
              <option value="legal">Legal Counsel</option>
              <option value="compliance">Compliance Officer</option>
              <option value="other">Altro</option>
            </NativeSelect>

            <NativeSelect
              id="companySize"
              label="Dimensione dell'organizzazione (facoltativo)"
              value={companySize}
              onChange={(e) => setCompanySize(e.target.value)}
              helperText="Le soglie di NIS2, DORA e di molti obblighi dipendono da addetti e fatturato: indicarla evita domande in chat"
            >
              <option value="">Seleziona la dimensione</option>
              <option value="micro">Micro (meno di 10 addetti)</option>
              <option value="small">Piccola (10-49 addetti)</option>
              <option value="medium">Media (50-249 addetti)</option>
              <option value="large">Grande (250 addetti o più)</option>
              <option value="unknown">Non lo so</option>
            </NativeSelect>

            <NativeSelect
              id="dataRole"
              label="Ruolo nel trattamento dei dati (facoltativo)"
              value={dataRole}
              onChange={(e) => setDataRole(e.target.value)}
              helperText="Titolare e responsabile hanno obblighi diversi: il RAG ne tiene conto nelle risposte"
            >
              <option value="">Seleziona il ruolo</option>
              <option value="controller">Titolare del trattamento</option>
              <option value="processor">Responsabile del trattamento (fornitore/processor)</option>
              <option value="both">Entrambi, a seconda del servizio</option>
              <option value="unknown">Non lo so</option>
            </NativeSelect>

            <div className="flex gap-3">
              <Button 
                type="button"
                variant="outline"
                className="w-1/3"
                onClick={async () => {
                  // Logout e torna alla schermata di login
                  await supabase.auth.signOut();
                  navigate('/auth');
                }}
              >
                <ArrowLeft className="mr-2 w-4 h-4" />
                Indietro
              </Button>
              <Button 
                type="submit" 
                className="flex-1 gradient-hero-button h-11 sm:h-10 touch-manipulation"
                disabled={loading || !jurisdiction || !sector || !role}
              >
                {loading ? "Salvataggio..." : "Continua alla Chat"}
                <ArrowRight className="ml-2 w-4 h-4" />
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
};

export default Onboarding;
