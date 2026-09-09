import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, Newspaper } from "lucide-react";
import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";

export default function SeedNews() {
  const [loading, setLoading] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [checking, setChecking] = useState(true);
  const { toast } = useToast();
  const navigate = useNavigate();

  useEffect(() => {
    const checkAdminRole = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        
        if (!user) {
          navigate('/auth');
          return;
        }

        const { data, error } = await supabase.rpc('has_role', {
          _user_id: user.id,
          _role: 'admin'
        });

        if (error) {
          console.error('Error checking admin role:', error);
          navigate('/chat');
          return;
        }

        if (!data) {
          toast({
            title: "Accesso Negato",
            description: "Non hai i permessi per accedere a questa pagina",
            variant: "destructive",
          });
          navigate('/chat');
          return;
        }

        setIsAdmin(true);
      } catch (error) {
        console.error('Error:', error);
        navigate('/chat');
      } finally {
        setChecking(false);
      }
    };

    checkAdminRole();
  }, [navigate, toast]);

  const handleSeedNews = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('seed-news');
      
      if (error) {
        if (error.message.includes('Forbidden')) {
          throw new Error('Accesso negato. Sono richiesti privilegi di amministratore.');
        }
        throw error;
      }

      toast({
        title: "News caricate con successo",
        description: `${data.inserted} notizie aggiunte al database`,
      });
    } catch (error: any) {
      toast({
        title: "Errore",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  if (checking) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!isAdmin) {
    return null;
  }

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-2xl mx-auto space-y-6">
        <Card className="p-8">
          <div className="space-y-6">
            <div className="flex items-center gap-3">
              <Newspaper className="h-8 w-8 text-primary" />
              <h1 className="text-3xl font-bold">Carica News di Esempio</h1>
            </div>

            <p className="text-muted-foreground">
              Questa funzione popola il database con 6 notizie di esempio sugli aggiornamenti normativi europei.
              Include news su GDPR, NIS2, AI Act, DORA, CRA e CER.
            </p>

            <Button
              onClick={handleSeedNews}
              disabled={loading}
              className="w-full"
              size="lg"
            >
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {loading ? "Caricamento..." : "Carica News di Esempio"}
            </Button>

            <div className="bg-muted/50 p-4 rounded-lg border">
              <p className="text-sm text-muted-foreground">
                <strong>Nota:</strong> Questa è una funzione amministrativa. Le news saranno visibili 
                sia nella landing page che nella pagina dedicata /aggiornamenti.
              </p>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}
