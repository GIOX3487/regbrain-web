import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { RefreshCw, Newspaper, CheckCircle2, AlertCircle, Globe } from "lucide-react";

export const NewsUpdater = () => {
  const { toast } = useToast();
  const [isUpdating, setIsUpdating] = useState(false);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);
  const [updateStats, setUpdateStats] = useState<{
    updates_found: number;
    updates_inserted: number;
    sources_scraped: number;
  } | null>(null);

  const handleUpdate = async () => {
    setIsUpdating(true);
    
    try {
      console.log('🔄 Triggering regulatory updates scraping...');
      const { data, error } = await supabase.functions.invoke('auto-update-news', {
        body: {}
      });

      console.log('📡 Raw response:', { data, error });

      if (error) {
        console.error('❌ Error from edge function:', error);
        throw error;
      }

      console.log('✅ Successfully received data:', data);
      console.log('📊 Parsed values:', {
        inserted: data?.inserted,
        total_found: data?.total_found,
        type_of_inserted: typeof data?.inserted,
        type_of_total_found: typeof data?.total_found
      });
      
      const insertedCount = data?.inserted || 0;
      const totalCount = data?.total_found || 0;
      
      console.log('📈 Setting stats:', { insertedCount, totalCount });
      
      setUpdateStats({
        updates_found: totalCount,
        updates_inserted: insertedCount,
        sources_scraped: 5 // EUR-Lex, EDPB, ENISA, ACN, Normattiva
      });
      setLastUpdate(new Date());

      const toastMessage = insertedCount > 0 
        ? `${insertedCount} nuovi aggiornamenti dalle fonti ufficiali`
        : "Nessun nuovo aggiornamento disponibile. Le news sono già aggiornate.";
      
      console.log('🔔 Toast message:', toastMessage);

      toast({
        title: "Aggiornamento completato",
        description: toastMessage,
      });

      // Ricarica la pagina per mostrare i nuovi aggiornamenti
      if (insertedCount > 0) {
        console.log('🔄 Reloading page in 1.5 seconds...');
        setTimeout(() => {
          window.location.reload();
        }, 1500);
      }
    } catch (error) {
      console.error('💥 Error updating news:', error);
      toast({
        title: "Errore aggiornamento",
        description: error instanceof Error ? error.message : "Impossibile scaricare gli aggiornamenti",
        variant: "destructive",
      });
    } finally {
      setIsUpdating(false);
    }
  };

  return (
    <Card className="border-blue-200 dark:border-blue-800">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Newspaper className="h-5 w-5 text-blue-600 dark:text-blue-400" />
              Scraping Automatico Aggiornamenti
            </CardTitle>
            <CardDescription className="mt-2">
              Scarica automaticamente da EUR-Lex, EDPB, ENISA, ACN, Normattiva
            </CardDescription>
          </div>
          {lastUpdate && (
            <Badge variant="outline" className="flex items-center gap-1 border-blue-200 dark:border-blue-800">
              <CheckCircle2 className="h-3 w-3 text-blue-600 dark:text-blue-400" />
              {lastUpdate.toLocaleTimeString()}
            </Badge>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {updateStats && (
          <div className="grid grid-cols-3 gap-4 p-4 bg-blue-50 dark:bg-blue-950/20 rounded-lg">
            <div className="space-y-1">
              <p className="text-sm text-muted-foreground">Trovati</p>
              <p className="text-2xl font-bold text-blue-600 dark:text-blue-400">
                {updateStats.updates_found}
              </p>
            </div>
            <div className="space-y-1">
              <p className="text-sm text-muted-foreground">Inseriti</p>
              <p className="text-2xl font-bold text-green-600 dark:text-green-400">
                {updateStats.updates_inserted}
              </p>
            </div>
            <div className="space-y-1">
              <p className="text-sm text-muted-foreground">Fonti</p>
              <p className="text-2xl font-bold text-purple-600 dark:text-purple-400">
                {updateStats.sources_scraped}
              </p>
            </div>
          </div>
        )}

        <div className="bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-950/20 dark:to-indigo-950/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
          <div className="flex gap-2">
            <Globe className="h-5 w-5 text-blue-600 dark:text-blue-400 flex-shrink-0 mt-0.5" />
            <div className="space-y-2 text-sm">
              <p className="font-medium text-blue-900 dark:text-blue-100">
                Fonti Monitorate (Aggiornamento Automatico Settimanale):
              </p>
              <ul className="space-y-1 text-blue-800 dark:text-blue-200">
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="h-3 w-3 text-green-600" />
                  <span>EUR-Lex - Gazzetta Ufficiale UE</span>
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="h-3 w-3 text-green-600" />
                  <span>EDPB - European Data Protection Board</span>
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="h-3 w-3 text-green-600" />
                  <span>ENISA - EU Cybersecurity Agency</span>
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="h-3 w-3 text-green-600" />
                  <span>ACN - Agenzia per la Cybersicurezza Nazionale</span>
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="h-3 w-3 text-green-600" />
                  <span>Normattiva.it - Gazzetta Ufficiale Italiana</span>
                </li>
              </ul>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 text-sm text-muted-foreground bg-muted/50 p-3 rounded-lg">
          <AlertCircle className="h-4 w-4 flex-shrink-0" />
          <span>
            Lo scraping automatico viene eseguito ogni settimana. Clicca "Aggiorna Ora" per un aggiornamento immediato.
          </span>
        </div>

        <Button 
          onClick={handleUpdate} 
          disabled={isUpdating}
          className="w-full"
          size="lg"
        >
          {isUpdating ? (
            <>
              <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
              Scaricamento in corso...
            </>
          ) : (
            <>
              <RefreshCw className="mr-2 h-4 w-4" />
              Aggiorna Ora
            </>
          )}
        </Button>
      </CardContent>
    </Card>
  );
};
