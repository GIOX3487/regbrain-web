import { useState } from "react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Loader2 } from "lucide-react";

const LoadNewDocuments = () => {
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();

  const newDocuments = [
    {
      title: "GPDPDigest - Attività Garante Privacy Dicembre 2024",
      content: "DICEMBRE 2024 IGPDP DIGEST - Telemarketing, dati sulla salute, cartelle cliniche, data breach, ChatGPT, giornalismo, concorsi PA...",
      version: "Dicembre 2024",
      jurisdiction: "IT",
      sector: "data_protection",
      language: "IT"
    },
    {
      title: "Garante Privacy - Parere AI Act e Intelligenza Artificiale",
      content: "Parere su schema di disegno di legge AI - Regolamento UE 2024/1689...",
      version: "2024",
      jurisdiction: "IT",
      sector: "data_protection",
      language: "IT"
    },
    {
      title: "Digital Services Act (DSA) - Regolamento UE 2022/2065",
      content: "Regolamento servizi digitali - mercato unico...",
      version: "2022/2065",
      jurisdiction: "EU",
      sector: "technology",
      language: "IT"
    },
    {
      title: "Data Governance Act - Regolamento UE 2022/868",
      content: "Governance europea dei dati...",
      version: "2022/868",
      jurisdiction: "EU",
      sector: "data_protection",
      language: "IT"
    },
    {
      title: "ENISA - National Capabilities Assessment Framework",
      content: "Framework ENISA cybersecurity assessment...",
      version: "2020",
      jurisdiction: "EU",
      sector: "cybersecurity",
      language: "EN"
    }
  ];

  const handleLoad = async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('batch-load-documents', {
        body: { documents: newDocuments }
      });

      if (error) throw error;

      toast({
        title: "Documenti caricati",
        description: `${data.results.filter((r: any) => r.status === 'success').length} documenti caricati con successo`
      });
    } catch (error) {
      toast({
        title: "Errore",
        description: "Impossibile caricare i documenti",
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="p-8">
      <Button onClick={handleLoad} disabled={isLoading}>
        {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
        Carica nuovi documenti nel RAG
      </Button>
    </div>
  );
};

export default LoadNewDocuments;
