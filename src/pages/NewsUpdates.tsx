import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { NewsCard } from "@/components/NewsCard";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Newspaper, Filter, Plus, ArrowLeft, RefreshCw, MessageSquare } from "lucide-react";
import { useNavigate, useLocation } from "react-router-dom";
import { useToast } from "@/hooks/use-toast";
import { MobileNav } from "@/components/MobileNav";
import { NewsUpdater } from "@/components/news/NewsUpdater";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const regulationTypes = [
  { value: "all", label: "Tutte le Normative" },
  { value: "GDPR", label: "GDPR" },
  { value: "NIS2", label: "NIS 2" },
  { value: "AI Act", label: "AI Act" },
  { value: "DORA", label: "DORA" },
  { value: "CRA", label: "Cyber Resilience Act" },
  { value: "CER", label: "CER Directive" },
  { value: "Cybersecurity", label: "Cybersecurity" },
];


export default function NewsUpdates() {
  const [selectedRegulation, setSelectedRegulation] = useState("all");
  const [isSeeding, setIsSeeding] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  const { toast } = useToast();
  const navigate = useNavigate();
  const location = useLocation();

  const [fromChat, setFromChat] = useState(
    location.state?.fromChat === true || sessionStorage.getItem('chatReturn') === 'true'
  );

  useEffect(() => {
    if (location.state?.fromChat === true) {
      sessionStorage.setItem('chatReturn', 'true');
      setFromChat(true);
    }
  }, [location.state]);

  const { data: news, isLoading } = useQuery({
    queryKey: ['news-updates', selectedRegulation],
    queryFn: async () => {
      let query = supabase
        .from('news_updates')
        .select('*')
        .gte('published_at', '2024-01-01T00:00:00')
        .in('regulation_type', ['GDPR', 'NIS2', 'DORA', 'AI Act', 'CRA', 'CER', 'Cybersecurity', 'Cyber Resilience Act'])
        .order('published_at', { ascending: false });
      
      if (selectedRegulation !== 'all') {
        query = query.eq('regulation_type', selectedRegulation);
      }
      
      const { data, error } = await query;
      if (error) throw error;
      
      // Rimuovi duplicati basati su title
      const uniqueNews = data?.reduce((acc: any[], current) => {
        const exists = acc.find(item => item.title === current.title);
        if (!exists) {
          acc.push(current);
        }
        return acc;
      }, []);
      
      // Se non ci sono news, carica automaticamente le news di esempio
      if (!uniqueNews || uniqueNews.length === 0) {
        await seedInitialNews();
        // Ricarica dopo aver popolato
        const { data: newData } = await query;
        return newData?.reduce((acc: any[], current) => {
          const exists = acc.find(item => item.title === current.title);
          if (!exists) {
            acc.push(current);
          }
          return acc;
        }, []) || [];
      }
      
      return uniqueNews;
    },
  });

  const seedInitialNews = async () => {
    const currentDate = new Date().toISOString();
    const sampleNews = [
      {
        title: 'NIS2: Scadenza per il recepimento nazionale - 17 gennaio 2025',
        summary: 'Gli Stati membri dell\'UE devono recepire la Direttiva NIS2 entro il 17 gennaio 2025. Le organizzazioni essenziali e importanti devono prepararsi ai nuovi obblighi di cybersecurity, inclusi incident reporting entro 24 ore, gestione del rischio cyber, formazione del personale e obblighi per l\'organo di gestione. Le sanzioni per non conformità possono raggiungere i 10 milioni di euro.',
        source: 'Direttiva UE 2022/2555',
        source_url: 'https://eur-lex.europa.eu/legal-content/IT/TXT/?uri=CELEX:32022L2555',
        published_at: currentDate,
        regulation_type: 'NIS2',
        jurisdiction: 'EU',
        impact_level: 'high'
      },
      {
        title: 'GDPR: Nuove linee guida EDPB su AI e protezione dati',
        summary: 'L\'European Data Protection Board ha pubblicato nuove linee guida sull\'applicazione del GDPR ai sistemi di intelligenza artificiale. Focus su minimizzazione dei dati, valutazioni d\'impatto DPIA obbligatorie per AI ad alto rischio, principi di privacy by design e diritti degli interessati nei processi automatizzati. Le organizzazioni devono allineare i loro sistemi AI ai principi GDPR.',
        source: 'EDPB',
        source_url: 'https://www.edpb.europa.eu/our-work-tools/our-documents/guidelines_en',
        published_at: currentDate,
        regulation_type: 'GDPR',
        jurisdiction: 'EU',
        impact_level: 'high'
      },
      {
        title: 'AI Act: Fase di implementazione - Obblighi progressivi dal 2025',
        summary: 'Il Regolamento UE sull\'IA (AI Act) entra in vigore con applicazione graduale. Dal febbraio 2025 divieto di pratiche AI vietate. Agosto 2025: obblighi per modelli AI general-purpose. Agosto 2026: obblighi per sistemi ad alto rischio. Le organizzazioni devono classificare i loro sistemi AI e implementare governance, documentazione tecnica, valutazione conformità e monitoraggio post-market.',
        source: 'Regolamento UE 2024/1689',
        source_url: 'https://eur-lex.europa.eu/legal-content/IT/TXT/?uri=CELEX:32024R1689',
        published_at: currentDate,
        regulation_type: 'AI Act',
        jurisdiction: 'EU',
        impact_level: 'high'
      },
      {
        title: 'DORA: Applicabilità dal 17 gennaio 2025 per il settore finanziario',
        summary: 'Il Digital Operational Resilience Act diventa applicabile per tutte le entità finanziarie dell\'UE. Richiede framework di gestione rischio ICT, incident reporting entro 4 ore per incidenti gravi, test di resilienza operativa annuali, gestione del rischio di terze parti ICT e requisiti specifici per critical ICT third-party service providers. Le autorità di vigilanza inizieranno controlli immediati.',
        source: 'Regolamento UE 2022/2554',
        source_url: 'https://eur-lex.europa.eu/legal-content/IT/TXT/?uri=CELEX:32022R2554',
        published_at: currentDate,
        regulation_type: 'DORA',
        jurisdiction: 'EU',
        impact_level: 'high'
      },
      {
        title: 'Cyber Resilience Act: Periodo di transizione fino a dicembre 2027',
        summary: 'Il CRA è stato pubblicato nella Gazzetta Ufficiale UE (20 novembre 2024) e sarà applicabile dall\'11 dicembre 2027. I prodotti con elementi digitali dovranno essere conformi ai requisiti di cybersecurity. Focus su vulnerabilità zero-day, aggiornamenti di sicurezza obbligatori, valutazione conformità pre-market e notifica incidenti attivamente sfruttati. Fabbricanti, importatori e distributori devono prepararsi ora.',
        source: 'Regolamento UE 2024/2847',
        source_url: 'https://eur-lex.europa.eu/legal-content/IT/TXT/?uri=OJ:L_202402847',
        published_at: currentDate,
        regulation_type: 'CRA',
        jurisdiction: 'EU',
        impact_level: 'high'
      },
      {
        title: 'Data Act: Applicazione dal settembre 2025',
        summary: 'Il Data Act entrerà in vigore il 12 settembre 2025, introducendo nuove regole per la condivisione e l\'accesso ai dati generati da prodotti connessi e servizi correlati. Gli utenti avranno diritto di accesso ai dati generati dai loro dispositivi IoT e potranno condividerli con terze parti. Le imprese devono preparare infrastrutture per data portability e interoperabilità.',
        source: 'Regolamento UE 2023/2854',
        source_url: 'https://eur-lex.europa.eu/legal-content/IT/TXT/?uri=CELEX:32023R2854',
        published_at: currentDate,
        regulation_type: 'GDPR',
        jurisdiction: 'EU',
        impact_level: 'medium'
      },
      {
        title: 'CER Directive: Identificazione entità critiche nazionali entro ottobre 2024',
        summary: 'La Direttiva sulla Resilienza delle Entità Critiche richiede agli Stati membri di identificare le entità critiche nazionali nei settori energia, trasporti, banche, infrastrutture digitali, acqua, sanità e altri. Le entità identificate devono implementare misure di resilienza fisica e cyber, condurre valutazioni del rischio e sviluppare piani di continuità operativa. Coordinamento tra autorità NIS2 e CER per protezione combinata.',
        source: 'Direttiva UE 2022/2557',
        source_url: 'https://eur-lex.europa.eu/legal-content/IT/TXT/?uri=CELEX:32022L2557',
        published_at: currentDate,
        regulation_type: 'CER',
        jurisdiction: 'EU',
        impact_level: 'high'
      },
      {
        title: 'Certificazione Cybersecurity UE: Schema EUCS in fase finale',
        summary: 'ENISA sta finalizzando lo schema di certificazione European Cybersecurity Certification Scheme (EUCS) per servizi cloud. Lo schema fornirà livelli di assurance (Basic, Substantial, High) per valutare la sicurezza dei cloud service providers. Diventerà requisito per appalti pubblici e settori regolamentati. I provider cloud dovranno ottenere certificazione EUCS per operare nel mercato EU.',
        source: 'ENISA',
        source_url: 'https://www.enisa.europa.eu/topics/cybersecurity-certification',
        published_at: currentDate,
        regulation_type: 'NIS2',
        jurisdiction: 'EU',
        impact_level: 'medium'
      }
    ];

    try {
      const { error } = await supabase
        .from('news_updates')
        .insert(sampleNews);

      if (error) throw error;
    } catch (error) {
      console.error('Error seeding initial news:', error);
    }
  };

  const handleSeedNews = async () => {
    setIsSeeding(true);
    try {
      const currentDate = new Date().toISOString();
      const sampleNews = [
        {
          title: 'NIS2: Scadenza per il recepimento nazionale - 17 gennaio 2025',
          summary: 'Gli Stati membri dell\'UE devono recepire la Direttiva NIS2 entro il 17 gennaio 2025. Le organizzazioni essenziali e importanti devono prepararsi ai nuovi obblighi di cybersecurity, inclusi incident reporting entro 24 ore, gestione del rischio cyber, formazione del personale e obblighi per l\'organo di gestione. Le sanzioni per non conformità possono raggiungere i 10 milioni di euro.',
          source: 'Direttiva UE 2022/2555',
          source_url: 'https://eur-lex.europa.eu/legal-content/IT/TXT/?uri=CELEX:32022L2555',
          published_at: currentDate,
          regulation_type: 'NIS2',
          jurisdiction: 'EU',
          impact_level: 'high'
        },
        {
          title: 'GDPR: Nuove linee guida EDPB su AI e protezione dati',
          summary: 'L\'European Data Protection Board ha pubblicato nuove linee guida sull\'applicazione del GDPR ai sistemi di intelligenza artificiale. Focus su minimizzazione dei dati, valutazioni d\'impatto DPIA obbligatorie per AI ad alto rischio, principi di privacy by design e diritti degli interessati nei processi automatizzati. Le organizzazioni devono allineare i loro sistemi AI ai principi GDPR.',
          source: 'EDPB',
          source_url: 'https://www.edpb.europa.eu/our-work-tools/our-documents/guidelines_en',
          published_at: currentDate,
          regulation_type: 'GDPR',
          jurisdiction: 'EU',
          impact_level: 'high'
        },
        {
          title: 'AI Act: Fase di implementazione - Obblighi progressivi dal 2025',
          summary: 'Il Regolamento UE sull\'IA (AI Act) entra in vigore con applicazione graduale. Dal febbraio 2025 divieto di pratiche AI vietate. Agosto 2025: obblighi per modelli AI general-purpose. Agosto 2026: obblighi per sistemi ad alto rischio. Le organizzazioni devono classificare i loro sistemi AI e implementare governance, documentazione tecnica, valutazione conformità e monitoraggio post-market.',
          source: 'Regolamento UE 2024/1689',
          source_url: 'https://eur-lex.europa.eu/legal-content/IT/TXT/?uri=CELEX:32024R1689',
          published_at: currentDate,
          regulation_type: 'AI Act',
          jurisdiction: 'EU',
          impact_level: 'high'
        },
        {
          title: 'DORA: Applicabilità dal 17 gennaio 2025 per il settore finanziario',
          summary: 'Il Digital Operational Resilience Act diventa applicabile per tutte le entità finanziarie dell\'UE. Richiede framework di gestione rischio ICT, incident reporting entro 4 ore per incidenti gravi, test di resilienza operativa annuali, gestione del rischio di terze parti ICT e requisiti specifici per critical ICT third-party service providers. Le autorità di vigilanza inizieranno controlli immediati.',
          source: 'Regolamento UE 2022/2554',
          source_url: 'https://eur-lex.europa.eu/legal-content/IT/TXT/?uri=CELEX:32022R2554',
          published_at: currentDate,
          regulation_type: 'DORA',
          jurisdiction: 'EU',
          impact_level: 'high'
        },
        {
          title: 'Cyber Resilience Act: Periodo di transizione fino a dicembre 2027',
          summary: 'Il CRA è stato pubblicato nella Gazzetta Ufficiale UE (20 novembre 2024) e sarà applicabile dall\'11 dicembre 2027. I prodotti con elementi digitali dovranno essere conformi ai requisiti di cybersecurity. Focus su vulnerabilità zero-day, aggiornamenti di sicurezza obbligatori, valutazione conformità pre-market e notifica incidenti attivamente sfruttati. Fabbricanti, importatori e distributori devono prepararsi ora.',
          source: 'Regolamento UE 2024/2847',
          source_url: 'https://eur-lex.europa.eu/legal-content/IT/TXT/?uri=OJ:L_202402847',
          published_at: currentDate,
          regulation_type: 'CRA',
          jurisdiction: 'EU',
          impact_level: 'high'
        },
        {
          title: 'Data Act: Applicazione dal settembre 2025',
          summary: 'Il Data Act entrerà in vigore il 12 settembre 2025, introducendo nuove regole per la condivisione e l\'accesso ai dati generati da prodotti connessi e servizi correlati. Gli utenti avranno diritto di accesso ai dati generati dai loro dispositivi IoT e potranno condividerli con terze parti. Le imprese devono preparare infrastrutture per data portability e interoperabilità.',
          source: 'Regolamento UE 2023/2854',
          source_url: 'https://eur-lex.europa.eu/legal-content/IT/TXT/?uri=CELEX:32023R2854',
          published_at: currentDate,
          regulation_type: 'GDPR',
          jurisdiction: 'EU',
          impact_level: 'medium'
        },
        {
          title: 'CER Directive: Identificazione entità critiche nazionali entro ottobre 2024',
          summary: 'La Direttiva sulla Resilienza delle Entità Critiche richiede agli Stati membri di identificare le entità critiche nazionali nei settori energia, trasporti, banche, infrastrutture digitali, acqua, sanità e altri. Le entità identificate devono implementare misure di resilienza fisica e cyber, condurre valutazioni del rischio e sviluppare piani di continuità operativa. Coordinamento tra autorità NIS2 e CER per protezione combinata.',
          source: 'Direttiva UE 2022/2557',
          source_url: 'https://eur-lex.europa.eu/legal-content/IT/TXT/?uri=CELEX:32022L2557',
          published_at: currentDate,
          regulation_type: 'CER',
          jurisdiction: 'EU',
          impact_level: 'high'
        },
        {
          title: 'Certificazione Cybersecurity UE: Schema EUCS in fase finale',
          summary: 'ENISA sta finalizzando lo schema di certificazione European Cybersecurity Certification Scheme (EUCS) per servizi cloud. Lo schema fornirà livelli di assurance (Basic, Substantial, High) per valutare la sicurezza dei cloud service providers. Diventerà requisito per appalti pubblici e settori regolamentati. I provider cloud dovranno ottenere certificazione EUCS per operare nel mercato EU.',
          source: 'ENISA',
          source_url: 'https://www.enisa.europa.eu/topics/cybersecurity-certification',
          published_at: currentDate,
          regulation_type: 'NIS2',
          jurisdiction: 'EU',
          impact_level: 'medium'
        }
      ];

      const { error } = await supabase
        .from('news_updates')
        .insert(sampleNews);

      if (error) throw error;

      toast({
        title: "News caricate!",
        description: `${sampleNews.length} aggiornamenti normativi aggiunti con successo`,
      });

      // Ricarica i dati
      window.location.reload();
    } catch (error: any) {
      toast({
        title: "Errore",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setIsSeeding(false);
    }
  };

  const handleUpdateNews = async () => {
    setIsUpdating(true);
    try {
      const { data, error } = await supabase.functions.invoke('auto-update-news');

      if (error) throw error;

      toast({
        title: "Aggiornamento completato!",
        description: data.inserted > 0
          ? `${data.inserted} nuove news aggiunte da fonti ufficiali`
          : "Nessuna nuova news disponibile. Il database è già aggiornato.",
      });

      // Ricarica i dati
      window.location.reload();
    } catch (error: any) {
      toast({
        title: "Errore nell'aggiornamento",
        description: error.message || "Errore durante lo scraping delle news",
        variant: "destructive",
      });
    } finally {
      setIsUpdating(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-background via-background to-muted/20 pb-20 lg:pb-0">
      <MobileNav />
      {/* Header */}
      <div className="border-b bg-card/50 backdrop-blur-sm sticky top-0 z-10">
        <div className="container mx-auto px-4 sm:px-6 py-4 sm:py-8">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-4">
            <div className="flex items-center gap-2 sm:gap-3">
              <Newspaper className="h-6 w-6 sm:h-8 sm:w-8 text-primary shrink-0" />
              <h1 className="text-2xl sm:text-3xl md:text-4xl font-bold text-foreground">
                Aggiornamenti Normativi
              </h1>
            </div>
            <Button 
              variant="outline" 
              onClick={() => {
                if (fromChat) {
                  sessionStorage.removeItem('chatReturn');
                  navigate('/chat');
                } else {
                  navigate('/');
                }
              }}
              className="flex items-center gap-2 self-end sm:self-auto"
              size="sm"
            >
              {fromChat ? <MessageSquare className="h-4 w-4" /> : <ArrowLeft className="h-4 w-4" />}
              <span className="hidden sm:inline">{fromChat ? 'Torna alla Chat' : 'Torna alla Homepage'}</span>
              <span className="sm:hidden">{fromChat ? 'Chat' : 'Home'}</span>
            </Button>
          </div>
          <p className="text-sm sm:text-base md:text-lg text-muted-foreground">
            Monitoriamo costantemente le evoluzioni normative per mantenerti aggiornato su compliance e regolamentazioni
          </p>
        </div>
      </div>

      {/* Filters */}
      <div className="container mx-auto px-4 sm:px-6 py-4 sm:py-6">
        {/* News Updater Component */}
        <div className="mb-6 sm:mb-8">
          <NewsUpdater />
        </div>

        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 sm:gap-4 mb-6 sm:mb-8">
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 sm:gap-4 flex-1">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Filter className="h-4 w-4" />
              <span>Filtra per:</span>
            </div>
            <Select value={selectedRegulation} onValueChange={setSelectedRegulation}>
              <SelectTrigger className="w-full sm:w-[280px]">
                <SelectValue placeholder="Seleziona normativa" />
              </SelectTrigger>
              <SelectContent>
                {regulationTypes.map((type) => (
                  <SelectItem key={type.value} value={type.value}>
                    {type.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex gap-2">
            <Button 
              onClick={handleUpdateNews} 
              disabled={isUpdating} 
              variant="default"
              className="w-full sm:w-auto"
              size="sm"
            >
              <RefreshCw className={`h-4 w-4 mr-2 ${isUpdating ? 'animate-spin' : ''}`} />
              {isUpdating ? 'Aggiornamento...' : 'Aggiorna News'}
            </Button>
          </div>
        </div>

        {/* News Grid */}
        {isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <Skeleton key={i} className="h-[280px] sm:h-[320px] rounded-lg" />
            ))}
          </div>
        ) : news && news.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
            {news.map((item) => (
              <NewsCard
                key={item.id}
                id={item.id}
                title={item.title}
                summary={item.summary}
                source={item.source}
                sourceUrl={item.source_url || undefined}
                publishedAt={item.published_at}
                regulationType={item.regulation_type}
                impactLevel={item.impact_level as 'low' | 'medium' | 'high' || 'medium'}
              />
            ))}
          </div>
        ) : (
          <div className="text-center py-20 bg-muted/30 rounded-lg border border-dashed">
            <Newspaper className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-xl font-semibold mb-2">Nessun aggiornamento trovato</h3>
            <p className="text-muted-foreground">
              {selectedRegulation === 'all' 
                ? "Non ci sono aggiornamenti disponibili al momento"
                : `Nessun aggiornamento per ${regulationTypes.find(r => r.value === selectedRegulation)?.label}`
              }
            </p>
            {selectedRegulation !== 'all' && (
              <Button 
                variant="outline" 
                className="mt-4"
                onClick={() => setSelectedRegulation('all')}
              >
                Mostra tutte le normative
              </Button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
