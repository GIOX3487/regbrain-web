import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ExternalLink, ArrowRight } from "lucide-react";
import { format } from "date-fns";
import { it } from "date-fns/locale";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";

interface NewsCardProps {
  id: string;
  title: string;
  summary: string;
  source: string;
  sourceUrl?: string;
  publishedAt: string;
  regulationType: string;
  impactLevel?: 'low' | 'medium' | 'high';
}

const impactColors = {
  low: "bg-blue-500/10 text-blue-700 dark:text-blue-400",
  medium: "bg-amber-500/10 text-amber-700 dark:text-amber-400",
  high: "bg-red-500/10 text-red-700 dark:text-red-400"
};

const impactLabels = {
  low: "Basso Impatto",
  medium: "Medio Impatto",
  high: "Alto Impatto"
};

export const NewsCard = ({ 
  title, 
  summary, 
  source, 
  sourceUrl, 
  publishedAt, 
  regulationType,
  impactLevel = 'medium'
}: NewsCardProps) => {
  const navigate = useNavigate();

  const handleAnalyze = async () => {
    // Prepare analysis context
    const analysisContext = `Analizza l'impatto di questo aggiornamento normativo sul mio caso specifico, considerando il mio profilo (ruolo, settore, giurisdizione):

📰 NOTIZIA: ${title}

📝 DETTAGLI: ${summary}

📌 NORMATIVA: ${regulationType}
⚠️ LIVELLO IMPATTO: ${impactLabels[impactLevel]}
📅 DATA PUBBLICAZIONE: ${format(new Date(publishedAt), "d MMMM yyyy", { locale: it })}
🔗 FONTE: ${source}

IMPORTANTE: Personalizza l'analisi in base al mio profilo configurato (ruolo, settore, giurisdizione).

Per favore:
1. Analizza come questo aggiornamento normativo potrebbe impattare la mia organizzazione in base al mio profilo
2. Identifica gli obblighi specifici che derivano da questo aggiornamento per il mio ruolo e settore
3. Suggerisci azioni concrete da intraprendere considerando le mie responsabilità
4. Indica eventuali scadenze o tempistiche da rispettare
5. Evidenzia i rischi di non conformità specifici per la mia giurisdizione`;

    // Save context to localStorage for persistence through login
    localStorage.setItem('pendingAnalysis', analysisContext);
    
    // Check authentication AND profile completeness
    const { data: { session } } = await supabase.auth.getSession();
    
    if (!session) {
      // User not authenticated - redirect to login with return path
      sessionStorage.setItem('auth_redirect', '/chat?analysis=pending');
      navigate('/auth');
      return;
    }

    // Check if user has completed profile
    const { data: profile, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', session.user.id)
      .maybeSingle();

    if (error || !profile) {
      // Profile doesn't exist or error - redirect to onboarding
      sessionStorage.setItem('auth_redirect', '/chat?analysis=pending');
      navigate('/onboarding');
      return;
    }

    // User is authenticated with valid profile - go directly to chat
    navigate('/chat?analysis=pending');
  };

  return (
    <Card className="p-6 hover:shadow-lg transition-all duration-300 border-border/50 bg-card/50 backdrop-blur-sm">
      <div className="flex items-start justify-between gap-4 mb-3">
        <Badge variant="secondary" className="font-medium">
          {regulationType}
        </Badge>
        {impactLevel && (
          <Badge className={impactColors[impactLevel]}>
            {impactLabels[impactLevel]}
          </Badge>
        )}
      </div>

      <h3 className="text-lg font-semibold mb-2 line-clamp-2 text-foreground">
        {title}
      </h3>

      <p className="text-sm text-muted-foreground mb-4 line-clamp-3">
        {summary}
      </p>

      <div className="flex items-center justify-between text-xs text-muted-foreground mb-4">
        <span className="flex items-center gap-1">
          {source}
        </span>
        <time>
          {format(new Date(publishedAt), "d MMM yyyy", { locale: it })}
        </time>
      </div>

      <div className="flex gap-2">
        <Button 
          variant="default" 
          size="sm" 
          className="flex-1"
          onClick={handleAnalyze}
        >
          Analizza Impatto
          <ArrowRight className="ml-2 h-4 w-4" />
        </Button>
        
        {sourceUrl && (
          <Button 
            variant="outline" 
            size="sm"
            asChild
          >
            <a href={sourceUrl} target="_blank" rel="noopener noreferrer">
              Leggi Articolo
              <ExternalLink className="ml-2 h-4 w-4" />
            </a>
          </Button>
        )}
      </div>
    </Card>
  );
};
