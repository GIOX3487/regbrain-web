import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { MarketIntelligence as MarketIntelligenceComponent } from "@/components/predictive/MarketIntelligence";
import { ArrowLeft, Globe } from "lucide-react";
import { MobileNav } from "@/components/MobileNav";

export default function MarketIntelligence() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    checkAuth();
  }, []);

  const checkAuth = async () => {
    setChecking(true);
    const { data: { session } } = await supabase.auth.getSession();
    
    if (!session) {
      sessionStorage.setItem('auth_redirect', '/compliance/market-intelligence');
      toast({
        title: "Accesso richiesto",
        description: "Effettua l'accesso per utilizzare Market Intelligence",
      });
      navigate('/auth');
      return;
    }
    
    setIsAuthenticated(true);
    setChecking(false);
  };

  if (checking) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return null;
  }

  return (
    <div className="min-h-screen bg-background pb-20 lg:pb-0">
      <MobileNav />
      <div className="container mx-auto py-8 px-4">
        {/* Header */}
        <div className="mb-8">
          <Button 
            variant="ghost" 
            onClick={() => navigate('/compliance')}
            className="mb-4"
          >
            <ArrowLeft className="mr-2 h-4 w-4" />
            Torna al Compliance Hub
          </Button>
          <h1 className="text-4xl font-bold mb-2 flex items-center gap-3">
            <Globe className="h-10 w-10 text-primary" />
            Market Intelligence
          </h1>
          <p className="text-muted-foreground">
            Notizie e dati di mercato rilevanti per il tuo profilo • Insights personalizzati • Fonti verificate
          </p>
        </div>

        {/* Market Intelligence Component - Full Width and Primary Focus */}
        <MarketIntelligenceComponent />
      </div>
    </div>
  );
}
