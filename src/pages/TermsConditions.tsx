import { ArrowLeft, FileText, Scale, AlertTriangle, Shield, CreditCard, XCircle, RefreshCw, Mail } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import { Separator } from "@/components/ui/separator";

const TermsConditions = () => {
  const navigate = useNavigate();
  const lastUpdated = "29 Dicembre 2024";
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
              <li><strong>"Abbonamento"</strong>: il contratto di utilizzo del servizio secondo i piani tariffari disponibili</li>
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
              <h2 className="text-2xl font-bold m-0">3. Piani di Abbonamento e Pagamenti</h2>
            </div>
            <Separator className="mb-4" />
            
            <h3 className="text-lg font-semibold mb-3">3.1 Piani Disponibili</h3>
            <p className="text-muted-foreground mb-4">
              La Piattaforma offre diversi piani di abbonamento:
            </p>
            <ul className="list-disc pl-6 space-y-2 text-muted-foreground">
              <li><strong>Starter</strong>: funzionalità base per professionisti individuali</li>
              <li><strong>Professional</strong>: funzionalità avanzate per PMI</li>
              <li><strong>Business</strong>: soluzione completa per aziende</li>
              <li><strong>Enterprise</strong>: soluzione personalizzata con supporto dedicato</li>
            </ul>

            <h3 className="text-lg font-semibold mb-3 mt-6">3.2 Modalità di Pagamento</h3>
            <p className="text-muted-foreground">
              I pagamenti sono gestiti tramite Stripe, piattaforma certificata PCI-DSS. 
              Gli abbonamenti sono fatturati mensilmente o annualmente in anticipo. 
              Le fatture sono emesse elettronicamente tramite il Sistema di Interscambio (SDI).
            </p>

            <h3 className="text-lg font-semibold mb-3 mt-6">3.3 Rinnovo Automatico</h3>
            <p className="text-muted-foreground">
              Gli abbonamenti si rinnovano automaticamente alla scadenza. 
              L'Utente può disattivare il rinnovo automatico in qualsiasi momento dalle impostazioni del proprio account.
            </p>
          </section>

          {/* Section 4 */}
          <section className="mb-8">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2 rounded-lg bg-primary/10">
                <XCircle className="h-5 w-5 text-primary" />
              </div>
              <h2 className="text-2xl font-bold m-0">4. Diritto di Recesso e Rimborsi</h2>
            </div>
            <Separator className="mb-4" />
            
            <h3 className="text-lg font-semibold mb-3">4.1 Diritto di Recesso</h3>
            <p className="text-muted-foreground mb-4">
              Ai sensi del Codice del Consumo (D.Lgs. 206/2005), i consumatori hanno diritto di recedere 
              dal contratto entro 14 giorni dalla sottoscrizione dell'abbonamento, senza dover fornire alcuna motivazione.
            </p>

            <h3 className="text-lg font-semibold mb-3 mt-6">4.2 Esclusioni</h3>
            <p className="text-muted-foreground">
              Il diritto di recesso non si applica quando l'Utente ha iniziato ad utilizzare attivamente 
              il servizio (es. esecuzione di analisi, caricamento documenti, generazione report) 
              con il consenso esplicito alla perdita del diritto di recesso.
            </p>

            <h3 className="text-lg font-semibold mb-3 mt-6">4.3 Rimborsi</h3>
            <p className="text-muted-foreground">
              I rimborsi sono elaborati entro 14 giorni dalla ricezione della richiesta valida 
              e accreditati sullo stesso metodo di pagamento utilizzato per l'acquisto.
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
              In nessun caso il Titolare sarà responsabile per danni indiretti, incidentali, consequenziali 
              o punitivi derivanti dall'uso della Piattaforma. La responsabilità massima è limitata 
              all'importo pagato dall'Utente nei 12 mesi precedenti l'evento.
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
              <li>Modelli di intelligenza artificiale forniti da OpenAI e Google</li>
              <li>Infrastruttura cloud e database gestiti da fornitori terzi</li>
              <li>Framework e librerie open-source (React, Tailwind CSS, etc.)</li>
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
