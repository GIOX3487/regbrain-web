import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

const LoadCodiceCyber = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [completed, setCompleted] = useState(false);

  const handleLoadCodiceCyber = async () => {
    setLoading(true);
    try {
      const response = await fetch('/documents/codice-cybersicurezza-2025-full.txt');
      if (!response.ok) throw new Error('Failed to fetch Codice Cybersicurezza document');
      
      const content = await response.text();
      console.log('Codice Cybersicurezza content loaded:', content.length, 'characters');

      const { data, error } = await supabase.functions.invoke('load-regulatory-documents', {
        body: {
          content,
          title: 'Codice della Cybersicurezza',
          version: '2025',
          jurisdiction: 'IT',
          sector: 'General',
          sourceUrl: 'https://www.acn.gov.it'
        }
      });

      if (error) throw error;

      console.log('Codice Cybersicurezza load result:', data);
      toast.success("Codice della Cybersicurezza caricato con successo!");
      setCompleted(true);
    } catch (error) {
      console.error('Error loading Codice Cybersicurezza:', error);
      toast.error("Errore nel caricamento del Codice della Cybersicurezza");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-muted/20 p-4 md:p-8">
      <div className="max-w-4xl mx-auto">
        <Button
          variant="ghost"
          onClick={() => navigate('/chat')}
          className="mb-6"
        >
          ← Torna alla Chat
        </Button>

        <Card className="border-primary/20 shadow-lg">
          <CardHeader className="space-y-4">
            <CardTitle className="text-3xl font-bold">Carica Codice della Cybersicurezza nel RAG</CardTitle>
            <CardDescription className="text-lg">
              Normativa italiana sulla Cybersicurezza - 2025
            </CardDescription>
          </CardHeader>

          <CardContent className="space-y-6">
            <div className="space-y-4">
              <p className="text-muted-foreground">
                Questa funzionalità carica il testo completo del Codice della Cybersicurezza italiano nel sistema RAG per permettere al chatbot di rispondere a domande specifiche sulla normativa nazionale.
              </p>

              <div className="bg-muted/50 p-4 rounded-lg space-y-2">
                <h3 className="font-semibold">Contenuto del Codice:</h3>
                <ul className="list-disc list-inside space-y-1 text-sm text-muted-foreground">
                  <li>Architettura nazionale di cybersicurezza</li>
                  <li>Autorità competenti e responsabilità</li>
                  <li>Perimetro di sicurezza nazionale cibernetica</li>
                  <li>Notifiche di incidenti</li>
                  <li>Misure tecniche e organizzative</li>
                  <li>Sanzioni e enforcement</li>
                </ul>
              </div>
            </div>

            <Button
              onClick={handleLoadCodiceCyber}
              disabled={loading || completed}
              className="w-full"
              size="lg"
            >
              {loading ? "Caricamento in corso..." : completed ? "✓ Codice Caricato" : "Carica Codice nel RAG"}
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default LoadCodiceCyber;
