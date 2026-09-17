import { ArrowLeft, FileText, Scale, AlertTriangle, Shield, CreditCard, XCircle, RefreshCw, Mail } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import { Separator } from "@/components/ui/separator";

const TermsConditions = () => {
  const navigate = useNavigate();
  const lastUpdated = "17 settembre 2026";
  const companyName = "RegBrain";
  const companyEmail = "regbrain.contact@gmail.com";

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border/40 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 sticky top-0 z-50">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <Button 
            variant="ghost" 
            onClick={() => navigate('/')}
            className="gap-2"
          >
            <ArrowLeft className="h-4 w-4" />
            Home
          </Button>
          <div className="flex items-center gap-2">
            <Scale className="h-5 w-5 text-primary" />
            <span className="font-semibold">Termini e Condizioni</span>
          </div>
          <div className="w-24" /> {/* Spacer for centering */}
        </div>
      </header>

      {/* Content */}
      <main className="container mx-auto px-4 py-8 max-w-4xl">
        <div className="prose prose-slate dark:prose-invert max-w-none">
          {/* Title */}
          <div className="text-center mb-12">
            <h1 className="text-3xl md:text-4xl font-bold mb-4">Termini e Condizioni di Utilizzo</h1>
            <p className="text-sm text-muted-foreground">Ultimo aggiornamento: {lastUpdated}</p>
          </div>

          {/* Important Notice */}
          <div className="bg-amber-500/10 border border-amber-500/20 rounded-lg p-6 mb-8">
            <div className="flex items-start gap-3">
              <AlertTriangle className="h-6 w-6 text-amber-500 flex-shrink-0 mt-0.5" />
              <div>
                <h3 className="font-semibold text-amber-500 mb-2">Avviso Importante</h3>
                <p className="text-sm text-muted-foreground">
                  Leggere attentamente i presenti Termini e Condizioni prima di utilizzare la piattaforma RegBrain. 
                  L'utilizzo del servizio implica l'accettazione integrale dei presenti termini.
                </p>
              </div>
            </div>
          </div>

          {/* Section 1 */}
          <section className="mb-8">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2 rounded-lg bg-primary/10">
                <FileText className="h-5 w-5 text-primary" />
              </div>
              <h2 className="text-2xl font-bold m-0">1. Definizioni e Ambito di Applicazione</h2>
            </div>
            <Separator className="mb-4" />
            
            <h3 className="text-lg font-semibold mb-3">1.1 Definizioni</h3>
            <ul className="list-disc pl-6 space-y-2 text-muted-foreground">
              <li><strong>"Piattaforma"</strong>: il servizio software-as-a-service (SaaS) RegBrain accessibile via web</li>
              <li><strong>"Titolare"</strong>: {companyName}</li>
              <li><strong>"Utente"</strong>: qualsiasi persona fisica o giuridica che accede alla Piattaforma</li>
              <li><strong>"Accordo"</strong>: il contratto con cui il Titolare concede all'Utente l'accesso alla Piattaforma</li>
              <li><strong>"Contenuti"</strong>: tutti i documenti, dati e informazioni caricati dall'Utente</li>
            </ul>

            <h3 className="text-lg font-semibold mb-3 mt-6">1.2 Oggetto del Servizio</h3>
            <p className="text-muted-foreground">
              RegBrain è una piattaforma di compliance normativa che utilizza intelligenza artificiale per supportare 
              aziende e professionisti nell'analisi, gestione e monitoraggio della conformità alle normative europee 
              in materia di protezione dati, cybersecurity e intelligenza artificiale (GDPR, NIS2, AI Act, DORA, CRA).
            </p>
          </section>

          {/* Section 2 */}
          <section className="mb-8">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2 rounded-lg bg-primary/10">
                <Shield className="h-5 w-5 text-primary" />
              </div>
              <h2 className="text-2xl font-bold m-0">2. Registrazione e Account</h2>
            </div>
            <Separator className="mb-4" />
            
            <h3 className="text-lg font-semibold mb-3">2.1 Requisiti di Registrazione</h3>
            <p className="text-muted-foreground mb-4">
              Per utilizzare la Piattaforma è necessario:
            </p>
            <ul className="list-disc pl-6 space-y-2 text-muted-foreground">
              <li>Avere almeno 18 anni di età o la capacità legale di stipulare contratti</li>
              <li>Fornire informazioni accurate e complete durante la registrazione</li>
              <li>Mantenere la riservatezza delle credenziali di accesso</li>
              <li>Notificare immediatamente qualsiasi uso non autorizzato dell'account</li>
            </ul>

            <h3 className="text-lg font-semibold mb-3 mt-6">2.2 Responsabilità dell'Account</h3>
            <p className="text-muted-foreground">
              L'Utente è responsabile di tutte le attività svolte attraverso il proprio account. 
              Il Titolare si riserva il diritto di sospendere o terminare account che violino i presenti termini.
            </p>
          </section>

          {/* Section 3 */}
          <section className="mb-8">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2 rounded-lg bg-primary/10">
                <CreditCard className="h-5 w-5 text-primary" />
              </div>
              <h2 className="text-2xl font-bold m-0">3. Accesso al servizio e corrispettivi</h2>
            </div>
            <Separator className="mb-4" />
            
            <h3 className="text-lg font-semibold mb-3">3.1 Fase attuale</h3>
            <p className="text-muted-foreground mb-4">
              La Piattaforma non prevede al momento alcun listino pubblico, alcun carrello e alcuna procedura di
              acquisto online. L'accesso viene concesso gratuitamente, per prova o valutazione, oppure a
              condizioni economiche definite in un accordo scritto separato fra il Titolare e l'Utente.
            </p>

            <h3 className="text-lg font-semibold mb-3 mt-6">3.2 Pagamenti</h3>
            <p className="text-muted-foreground mb-4">
              La Piattaforma non tratta pagamenti e non integra alcun fornitore di servizi di pagamento: non
              vengono richiesti né conservati dati di carte o di conti correnti. Gli eventuali corrispettivi
              previsti da un accordo scritto sono fatturati fuori dalla Piattaforma, con le modalità e le
              scadenze indicate nell'accordo stesso.
            </p>

            <h3 className="text-lg font-semibold mb-3 mt-6">3.3 Rinnovo</h3>
            <p className="text-muted-foreground">
              Non esistono abbonamenti a rinnovo automatico. Durata e rinnovo dell'accesso sono quelli previsti
              dall'accordo scritto, se presente. Quando verranno introdotti piani a pagamento con sottoscrizione
              diretta, questi Termini saranno aggiornati prima dell'attivazione.
            </p>
          </section>

          {/* Section 4 */}
          <section className="mb-8">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2 rounded-lg bg-primary/10">
                <XCircle className="h-5 w-5 text-primary" />
              </div>
              <h2 className="text-2xl font-bold m-0">4. Cessazione e recesso</h2>
            </div>
            <Separator className="mb-4" />
            
            <p className="text-muted-foreground mb-4">
              Non essendoci una procedura di acquisto online sulla Piattaforma, non si apre alcun termine di
              recesso a distanza e non ci sono importi da rimborsare. L'Utente può interrompere in qualsiasi
              momento l'uso del servizio e chiedere la cancellazione dell'account scrivendo all'indirizzo di
              contatto.
            </p>
            <p className="text-muted-foreground mb-4">
              Se l'accesso è regolato da un accordo scritto, valgono le clausole di recesso e di cessazione
              previste da quell'accordo.
            </p>
            <p className="text-muted-foreground">
              Quando la Piattaforma consentirà la sottoscrizione diretta di un piano a pagamento, ai
              consumatori si applicherà il diritto di recesso di quattordici giorni previsto dal Codice del
              Consumo e questa sezione sarà riscritta di conseguenza.
            </p>
          </section>

          {/* Section 5 */}
          <section className="mb-8">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2 rounded-lg bg-primary/10">
                <RefreshCw className="h-5 w-5 text-primary" />
              </div>
              <h2 className="text-2xl font-bold m-0">5. Limitazioni di Responsabilità</h2>
            </div>
            <Separator className="mb-4" />
            
            <h3 className="text-lg font-semibold mb-3">5.1 Natura del Servizio</h3>
            <p className="text-muted-foreground mb-4">
              RegBrain fornisce strumenti di supporto alla compliance normativa. Le analisi e i suggerimenti 
              generati dalla Piattaforma <strong>non costituiscono parere legale</strong> e non sostituiscono 
              la consulenza di professionisti qualificati.
            </p>

            <h3 className="text-lg font-semibold mb-3 mt-6">5.2 Esclusione di Garanzie</h3>
            <p className="text-muted-foreground">
              Il servizio è fornito "così com'è" (as-is). Il Titolare non garantisce che la Piattaforma 
              sia priva di errori, che funzioni ininterrottamente o che i risultati delle analisi 
              siano completi o accurati al 100%.
            </p>

            <h3 className="text-lg font-semibold mb-3 mt-6">5.3 Limitazione dei Danni</h3>
            <p className="text-muted-foreground">
              Nei limiti consentiti dalla legge, il Titolare non risponde dei danni indiretti o consequenziali
              derivanti dall'uso della Piattaforma. Quando l'accesso è concesso a titolo gratuito, la
              responsabilità è limitata ai casi di dolo e colpa grave; quando è regolato da un accordo
              scritto, valgono i limiti previsti da quell'accordo. Restano ferme le responsabilità che la legge
              non consente di escludere.
            </p>
          </section>

          {/* Section 6 */}
          <section className="mb-8">
            <h2 className="text-2xl font-bold mb-4">6. Proprietà Intellettuale e Tecnologie</h2>
            <Separator className="mb-4" />
            
            <h3 className="text-lg font-semibold mb-3">6.1 Proprietà del Titolare</h3>
            <p className="text-muted-foreground mb-4">
              Il Titolare detiene i diritti di proprietà intellettuale relativi a:
            </p>
            <ul className="list-disc pl-6 space-y-2 text-muted-foreground mb-4">
              <li>L'interfaccia utente e il design della Piattaforma</li>
              <li>I workflow, le logiche di business e l'implementazione specifica</li>
              <li>I prompt e le configurazioni proprietarie per l'elaborazione AI</li>
              <li>Il marchio "RegBrain" e i relativi elementi grafici</li>
              <li>La documentazione e i materiali di supporto originali</li>
            </ul>

            <h3 className="text-lg font-semibold mb-3">6.2 Tecnologie di Terze Parti</h3>
            <p className="text-muted-foreground mb-4">
              La Piattaforma utilizza tecnologie e servizi di terze parti, tra cui:
            </p>
            <ul className="list-disc pl-6 space-y-2 text-muted-foreground mb-4">
              <li>modelli di intelligenza artificiale forniti da Google, tramite l'API Gemini</li>
              <li>banca dati, autenticazione e archivio documenti forniti da Supabase, su infrastruttura AWS</li>
              <li>pubblicazione dell'applicazione web su Vercel</li>
              <li>librerie open source, fra cui React e Tailwind CSS</li>
            </ul>
            <p className="text-muted-foreground mb-4">
              I rispettivi diritti su tali tecnologie rimangono di proprietà dei relativi titolari.
            </p>

            <h3 className="text-lg font-semibold mb-3">6.3 Contenuti Normativi</h3>
            <p className="text-muted-foreground mb-4">
              I testi normativi (GDPR, NIS2, AI Act, etc.) sono documenti pubblici dell'Unione Europea 
              e delle autorità nazionali. RegBrain non rivendica alcun diritto su tali contenuti.
            </p>

            <h3 className="text-lg font-semibold mb-3">6.4 Contenuti dell'Utente</h3>
            <p className="text-muted-foreground">
              L'Utente mantiene tutti i diritti sui propri Contenuti caricati sulla Piattaforma 
              e concede al Titolare una licenza limitata, non esclusiva e revocabile per elaborarli 
              ai soli fini dell'erogazione del servizio. Tale licenza termina con la cancellazione dell'account.
            </p>
          </section>

          {/* Section 7 */}
          <section className="mb-8">
            <h2 className="text-2xl font-bold mb-4">7. Modifiche ai Termini</h2>
            <Separator className="mb-4" />
            
            <p className="text-muted-foreground">
              Il Titolare si riserva il diritto di modificare i presenti Termini in qualsiasi momento. 
              Le modifiche saranno comunicate via email con almeno 30 giorni di preavviso. 
              L'uso continuato della Piattaforma dopo tale periodo costituisce accettazione delle modifiche.
            </p>
          </section>

          {/* Section 8 */}
          <section className="mb-8">
            <h2 className="text-2xl font-bold mb-4">8. Legge Applicabile e Foro Competente</h2>
            <Separator className="mb-4" />
            
            <p className="text-muted-foreground mb-4">
              I presenti Termini sono regolati dalla legge italiana. Per le controversie con consumatori, 
              è competente il foro del luogo di residenza del consumatore. Per le controversie con 
              professionisti e aziende, è competente in via esclusiva il Foro di Milano.
            </p>
            <p className="text-muted-foreground">
              È disponibile la piattaforma ODR (Online Dispute Resolution) della Commissione Europea 
              all'indirizzo: <a href="https://ec.europa.eu/consumers/odr" className="text-primary hover:underline" target="_blank" rel="noopener noreferrer">https://ec.europa.eu/consumers/odr</a>
            </p>
          </section>

          {/* Contact */}
          <section className="bg-muted/50 rounded-lg p-6 mt-12">
            <div className="flex items-center gap-3 mb-4">
              <Mail className="h-5 w-5 text-primary" />
              <h2 className="text-xl font-bold m-0">Contatti</h2>
            </div>
            <p className="text-muted-foreground mb-2">
              Per qualsiasi domanda sui presenti Termini e Condizioni:
            </p>
            <ul className="text-muted-foreground space-y-1">
              <li><strong>Email:</strong> {companyEmail}</li>
            </ul>
          </section>
        </div>
      </main>
    </div>
  );
};

export default TermsConditions;
