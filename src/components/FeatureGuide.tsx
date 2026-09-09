import { useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { CheckCircle2, FileText, Upload, Play } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";

interface Step {
  number: number;
  title: string;
  description: string;
  example?: string;
}

interface FeatureGuideProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  featureType: 'predictive' | 'gap' | 'benchmark' | 'market-intelligence' | 'document' | 'compliance';
}

const featureContent = {
  compliance: {
    title: "Analisi conformità - Gap Analysis & Predictive Analytics",
    description: "Sistema unificato per analizzare lo stato attuale della conformità e prevedere rischi futuri con Machine Learning",
    steps: [
      {
        number: 1,
        title: "Avvia Gap Analysis",
        description: "Carica i tuoi documenti aziendali (policy, procedure, registri) e seleziona le normative da verificare",
        example: "Es. Privacy Policy + Registro Trattamenti → Verifica GDPR + NIS2"
      },
      {
        number: 2,
        title: "Visualizza i gap identificati",
        description: "Il sistema confronta automaticamente i tuoi documenti con ogni requisito normativo e mostra cosa manca",
        example: "Gap trovato: Art. 30 GDPR - Manca registro trattamenti completo (Priorità: Alta)"
      },
      {
        number: 3,
        title: "Genera previsioni Machine Learning",
        description: "Passa alla tab Predictive Analytics per ottenere forecast a 3/6/12 mesi sui rischi di conformità",
        example: "Previsione: Rischio elevato Art. 32 GDPR nei prossimi 6 mesi - Probabilità sanzione: 65%"
      },
      {
        number: 4,
        title: "Calcola impatto finanziario e ROI",
        description: "Visualizza sanzioni potenziali, investimenti necessari e ROI della rimediazione",
        example: "Sanzione prevista: €50.000 - Investimento rimediazione: €12.000 - ROI: 4.2x"
      },
      {
        number: 5,
        title: "Crea action plan",
        description: "Per ogni gap, genera azioni correttive automatiche con priorità, stime e quick wins",
        example: "Quick win: Implementa MFA → +15% compliance score in 2 settimane"
      }
    ],
    actionPath: "/compliance/analysis"
  },
  predictive: {
    title: "Predictive Risk Analytics ML",
    description: "Analisi predittiva dei rischi basata su machine learning per prevedere trend futuri di compliance",
    steps: [
      {
        number: 1,
        title: "Seleziona le tue valutazioni",
        description: "Scegli una o più valutazioni di compliance già completate per analizzarle",
        example: "Es. Valutazione GDPR Q4 2024, Audit NIS2 gennaio 2025"
      },
      {
        number: 2,
        title: "Avvia l'analisi predittiva",
        description: "Il sistema ML analizzerà i dati storici e i gap identificati per generare previsioni",
        example: "L'algoritmo esaminerà tendenze, pattern di non conformità e benchmark di settore"
      },
      {
        number: 3,
        title: "Visualizza i risultati",
        description: "Ottieni previsioni di rischio a 3/6/12 mesi, probabilità di sanzioni e trend di compliance",
        example: "Rischio elevato per Art. 32 GDPR nei prossimi 6 mesi - Probabilità sanzione: 65%"
      }
    ],
    actionPath: "/compliance/predictive-analytics"
  },
  gap: {
    title: "Gap Analysis Automatica",
    description: "Confronto automatico tra i tuoi documenti e i requisiti normativi per identificare mancanze",
    steps: [
      {
        number: 1,
        title: "Carica i tuoi documenti",
        description: "Carica policy, procedure, documentazione tecnica in formato PDF, DOCX o TXT",
        example: "Es. Privacy Policy, Procedura Data Breach, Registro Trattamenti"
      },
      {
        number: 2,
        title: "Seleziona le normative",
        description: "Indica quali normative vuoi verificare (GDPR, NIS2, AI Act, ecc.)",
        example: "Seleziona GDPR + NIS2 per un'analisi combinata"
      },
      {
        number: 3,
        title: "Analizza i gap identificati",
        description: "Il sistema confronta i tuoi documenti con ogni requisito normativo e mostra cosa manca",
        example: "Gap trovato: Art. 30 GDPR - Manca il registro dei trattamenti completo"
      },
      {
        number: 4,
        title: "Crea action plan",
        description: "Per ogni gap, genera automaticamente azioni correttive con priorità e stime",
        example: "Azione: Completare registro trattamenti - Priorità: Alta - 8 ore stimate"
      }
    ],
    actionPath: "/compliance/new"
  },
  benchmark: {
    title: "Benchmark di Settore (Coming Soon)",
    description: "Funzionalità di benchmark interno tra aziende in arrivo prossimamente.",
    steps: [
      {
        number: 1,
        title: "Funzionalità in sviluppo",
        description: "Stiamo sviluppando un sistema di benchmark interno che confronterà anonimamente le aziende dello stesso settore e giurisdizione",
        example: "Disponibile a breve: confronta la tua compliance con aziende simili in modo anonimo"
      },
      {
        number: 2,
        title: "Confronto per settore",
        description: "Potrai vedere la tua posizione rispetto ad altre aziende del tuo stesso settore (Finance, Tech, Healthcare, ecc.)",
        example: "Es. Scopri se sei sopra o sotto la media del settore Finance per conformità NIS2"
      },
      {
        number: 3,
        title: "Analisi per giurisdizione",
        description: "Confronti specifici per paese: Italia, Germania, Francia, Spagna, EU",
        example: "Benchmark Italia: posizione percentile rispetto alle aziende italiane del tuo settore"
      }
    ],
    actionPath: "/compliance/benchmark"
  },
  "market-intelligence": {
    title: "Market Intelligence",
    description: "Notizie e dati di mercato personalizzati in base al tuo settore, ruolo e giurisdizione.",
    steps: [
      {
        number: 1,
        title: "Profilo configurato automaticamente",
        description: "Il sistema utilizza il tuo profilo (settore, giurisdizione, ruolo) per personalizzare la ricerca di insights",
        example: "Es. Settore: Finance, Giurisdizione: IT, Ruolo: CISO → Focus su NIS2, DORA, minacce cyber settore bancario"
      },
      {
        number: 2,
        title: "Ricerca web in tempo reale",
        description: "Cerca notizie, trend e dati di mercato rilevanti per il tuo profilo specifico",
        example: "Trova: nuove linee guida ACN, sanzioni settore, trend conformità, statistiche di mercato"
      },
      {
        number: 3,
        title: "Insights con fonti verificate",
        description: "Ogni insight include link alle fonti originali per approfondimenti e verifica",
        example: "Trend identificato: 'Aumento budget cybersecurity 15% nel 2025' - Fonte: Gartner Report"
      },
      {
        number: 4,
        title: "Raccomandazioni personalizzate",
        description: "Ricevi suggerimenti operativi basati sui trend di mercato e le best practice del tuo settore",
        example: "Raccomandazione: Implementare zero-trust entro Q2 2025 per allineamento benchmark settore"
      }
    ],
    actionPath: "/compliance/market-intelligence"
  },
  document: {
    title: "Document Generator",
    description: "Genera documenti di compliance audit-ready precompilati con i dati delle tue analisi",
    steps: [
      {
        number: 1,
        title: "Scegli il tipo di documento",
        description: "Seleziona tra DPIA (Art. 35 GDPR), RoPA (Art. 30 GDPR) o LIA (AI Act)",
        example: "Scegli DPIA se stai introducendo un nuovo trattamento di dati"
      },
      {
        number: 2,
        title: "Collega una valutazione",
        description: "Seleziona una valutazione esistente per precompilare automaticamente il documento",
        example: "Seleziona 'Valutazione GDPR Q4 2024' per generare la DPIA basata sui dati reali"
      },
      {
        number: 3,
        title: "Personalizza il contenuto",
        description: "Rivedi e completa le sezioni generate automaticamente",
        example: "Il sistema compila automaticamente rischi, misure e DPO, tu aggiungi dettagli specifici"
      },
      {
        number: 4,
        title: "Esporta e usa",
        description: "Scarica il documento in formato PDF o DOCX, pronto per audit e autorità",
        example: "Documento DPIA conforme all'Art. 35 GDPR, pronto per la notifica al Garante"
      }
    ],
    actionPath: "/compliance/documents"
  },
};

export const FeatureGuide = ({ open, onOpenChange, featureType }: FeatureGuideProps) => {
  const navigate = useNavigate();
  const content = featureContent[featureType];

  const handleStartNow = async () => {
    // Check if user is authenticated
    const { data: { session } } = await supabase.auth.getSession();
    
    if (!session) {
      // Save the intended destination and navigate to auth
      sessionStorage.setItem('auth_redirect', content.actionPath);
      navigate('/auth');
      onOpenChange(false);
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
      sessionStorage.setItem('auth_redirect', content.actionPath);
      navigate('/onboarding');
      onOpenChange(false);
      return;
    }

    // All good, navigate to the feature
    navigate(content.actionPath);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-2xl">{content.title}</DialogTitle>
          <DialogDescription className="text-base">
            {content.description}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          <div className="space-y-4">
            {content.steps.map((step) => (
              <Card key={step.number} className="p-4 border-l-4 border-l-primary">
                <div className="flex gap-4">
                  <div className="flex-shrink-0">
                    <div className="w-8 h-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center font-bold">
                      {step.number}
                    </div>
                  </div>
                  <div className="flex-1 space-y-2">
                    <h4 className="font-semibold text-lg">{step.title}</h4>
                    <p className="text-muted-foreground">{step.description}</p>
                    {step.example && (
                      <div className="bg-muted/50 rounded-lg p-3 mt-2">
                        <div className="flex items-start gap-2">
                          <FileText className="w-4 h-4 mt-0.5 text-primary flex-shrink-0" />
                          <p className="text-sm">
                            <span className="font-medium">Esempio: </span>
                            {step.example}
                          </p>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </Card>
            ))}
          </div>

          <Card className="p-6 bg-gradient-to-br from-primary/5 to-primary/10 border-primary/20">
            <div className="flex items-start gap-4">
              <CheckCircle2 className="w-6 h-6 text-primary flex-shrink-0 mt-1" />
              <div className="space-y-2">
                <h4 className="font-semibold text-lg">Pronto per iniziare?</h4>
                <p className="text-sm text-muted-foreground">
                  Segui questi step per ottenere il massimo da questa funzionalità. 
                  I risultati saranno salvati automaticamente e potrai sempre ritornarci.
                </p>
              </div>
            </div>
          </Card>

          <div className="flex gap-3">
            <Button onClick={handleStartNow} className="flex-1" size="lg">
              <Play className="mr-2 h-5 w-5" />
              Inizia Ora
            </Button>
            <Button onClick={() => onOpenChange(false)} variant="outline" size="lg">
              Chiudi
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

// Document guide components for chat and assessment pages
export function DocumentGuideAlert() {
  return (
    <div className="mb-3 p-3 bg-primary/5 rounded-lg border border-primary/20">
      <div className="flex items-start gap-2">
        <FileText className="h-4 w-4 text-primary mt-0.5 flex-shrink-0" />
        <div className="text-sm">
          <strong className="text-primary">Prepara i tuoi documenti aziendali:</strong>
          <p className="text-muted-foreground mt-1">
            Policy (Privacy, Security), Procedure operative (Data Breach, Backup), Registri GDPR (Art. 30, DPA fornitori, DPIA), 
            Documentazione tecnica (Architetture, Flussi dati). Formati: PDF, Word, immagini.
          </p>
        </div>
      </div>
    </div>
  );
}