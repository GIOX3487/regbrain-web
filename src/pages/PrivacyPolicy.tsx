import { ArrowLeft, Shield, Database, Users, Globe, Lock, Clock, FileCheck, Mail, Server, Brain } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import { Separator } from "@/components/ui/separator";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

const PrivacyPolicy = () => {
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
            <Shield className="h-5 w-5 text-primary" />
            <span className="font-semibold">Privacy Policy</span>
          </div>
          <div className="w-24" />
        </div>
      </header>

      {/* Content */}
      <main className="container mx-auto px-4 py-8 max-w-4xl">
        <div className="prose prose-slate dark:prose-invert max-w-none">
          {/* Title */}
          <div className="text-center mb-12">
            <h1 className="text-3xl md:text-4xl font-bold mb-4">Informativa sulla Privacy</h1>
            <p className="text-muted-foreground mb-2">
              ai sensi degli artt. 13 e 14 del Regolamento (UE) 2016/679 (GDPR)
            </p>
          </div>

          {/* Intro */}
          <div className="bg-primary/5 border border-primary/20 rounded-lg p-6 mb-8">
            <p className="text-muted-foreground m-0">
              La presente informativa descrive come {companyName} ("Titolare", "noi") raccoglie, utilizza e protegge 
              i dati personali degli utenti della piattaforma RegBrain, in conformità al Regolamento Generale 
              sulla Protezione dei Dati (GDPR) e alla normativa italiana vigente.
            </p>
          </div>

          {/* Section 1 - Titolare */}
          <section className="mb-8">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2 rounded-lg bg-primary/10">
                <Users className="h-5 w-5 text-primary" />
              </div>
              <h2 className="text-2xl font-bold m-0">1. Titolare del Trattamento</h2>
            </div>
            <Separator className="mb-4" />
            
            <Table>
              <TableBody>
                <TableRow>
                  <TableCell className="font-medium">Ragione Sociale</TableCell>
                  <TableCell>{companyName}</TableCell>
                </TableRow>
                <TableRow>
                  <TableCell className="font-medium">Email</TableCell>
                  <TableCell><a href={`mailto:${companyEmail}`} className="text-primary">{companyEmail}</a></TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </section>

          {/* Section 2 - Dati Raccolti */}
          <section className="mb-8">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2 rounded-lg bg-primary/10">
                <Database className="h-5 w-5 text-primary" />
              </div>
              <h2 className="text-2xl font-bold m-0">2. Categorie di Dati Raccolti</h2>
            </div>
            <Separator className="mb-4" />
            
            <h3 className="text-lg font-semibold mb-3">2.1 Dati forniti direttamente dall'utente</h3>
            <ul className="list-disc pl-6 space-y-2 text-muted-foreground">
              <li><strong>Dati di registrazione:</strong> nome, cognome, email, password (criptata), ruolo professionale</li>
              <li><strong>Dati del profilo aziendale:</strong> settore, giurisdizione, dimensione aziendale</li>
              <li><strong>Documenti caricati:</strong> policy aziendali, documenti di compliance, registri</li>
              <li><strong>Comunicazioni:</strong> richieste di supporto, feedback</li>
            </ul>

            <h3 className="text-lg font-semibold mb-3 mt-6">2.2 Dati raccolti automaticamente</h3>
            <ul className="list-disc pl-6 space-y-2 text-muted-foreground">
              <li><strong>Dati di navigazione:</strong> indirizzo IP, browser, sistema operativo, pagine visitate</li>
              <li><strong>Dati di utilizzo:</strong> funzionalità utilizzate, frequenza di accesso, interazioni</li>
              <li><strong>Cookie tecnici e analitici:</strong> come descritto nella Cookie Policy</li>
            </ul>

            <h3 className="text-lg font-semibold mb-3 mt-6">2.3 Dati derivanti dall'elaborazione AI</h3>
            <ul className="list-disc pl-6 space-y-2 text-muted-foreground">
              <li>Analisi di gap di compliance generate dall'intelligenza artificiale</li>
              <li>Raccomandazioni e suggerimenti personalizzati</li>
              <li>Score di rischio e metriche di conformità</li>
            </ul>
          </section>

          {/* Section 3 - Finalità */}
          <section className="mb-8">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2 rounded-lg bg-primary/10">
                <FileCheck className="h-5 w-5 text-primary" />
              </div>
              <h2 className="text-2xl font-bold m-0">3. Finalità e Basi Giuridiche</h2>
            </div>
            <Separator className="mb-4" />
            
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Finalità</TableHead>
                  <TableHead>Base Giuridica</TableHead>
                  <TableHead>Conservazione</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                <TableRow>
                  <TableCell>Erogazione del servizio</TableCell>
                  <TableCell>Esecuzione contrattuale (Art. 6.1.b)</TableCell>
                  <TableCell>Durata del contratto + 10 anni</TableCell>
                </TableRow>
                <TableRow>
                  <TableCell>Gestione account e autenticazione</TableCell>
                  <TableCell>Esecuzione contrattuale (Art. 6.1.b)</TableCell>
                  <TableCell>Durata dell'account + 30 giorni</TableCell>
                </TableRow>
                <TableRow>
                  <TableCell>Fatturazione e pagamenti</TableCell>
                  <TableCell>Obbligo legale (Art. 6.1.c)</TableCell>
                  <TableCell>10 anni (obblighi fiscali)</TableCell>
                </TableRow>
                <TableRow>
                  <TableCell>Miglioramento del servizio</TableCell>
                  <TableCell>Legittimo interesse (Art. 6.1.f)</TableCell>
                  <TableCell>24 mesi</TableCell>
                </TableRow>
                <TableRow>
                  <TableCell>Comunicazioni marketing</TableCell>
                  <TableCell>Consenso (Art. 6.1.a)</TableCell>
                  <TableCell>Fino a revoca del consenso</TableCell>
                </TableRow>
                <TableRow>
                  <TableCell>Sicurezza e prevenzione frodi</TableCell>
                  <TableCell>Legittimo interesse (Art. 6.1.f)</TableCell>
                  <TableCell>12 mesi</TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </section>

          {/* Section 4 - Sub-processori */}
          <section className="mb-8">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2 rounded-lg bg-primary/10">
                <Server className="h-5 w-5 text-primary" />
              </div>
              <h2 className="text-2xl font-bold m-0">4. Responsabili del Trattamento e Sub-processori</h2>
            </div>
            <Separator className="mb-4" />
            
            <p className="text-muted-foreground mb-4">
              Per l'erogazione del servizio, ci avvaliamo dei seguenti sub-processori:
            </p>

            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Fornitore</TableHead>
                  <TableHead>Servizio</TableHead>
                  <TableHead>Localizzazione</TableHead>
                  <TableHead>Garanzie</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                <TableRow>
                  <TableCell className="font-medium">Supabase Inc.</TableCell>
                  <TableCell>Database e autenticazione</TableCell>
                  <TableCell>UE (AWS Frankfurt)</TableCell>
                  <TableCell>DPA, SCCs</TableCell>
                </TableRow>
                <TableRow>
                  <TableCell className="font-medium">Amazon Web Services</TableCell>
                  <TableCell>Infrastruttura cloud</TableCell>
                  <TableCell>UE (eu-central-1)</TableCell>
                  <TableCell>DPA, SCCs, ISO 27001</TableCell>
                </TableRow>
                <TableRow>
                  <TableCell className="font-medium">Stripe Inc.</TableCell>
                  <TableCell>Pagamenti</TableCell>
                  <TableCell>UE/USA</TableCell>
                  <TableCell>DPA, SCCs, PCI-DSS</TableCell>
                </TableRow>
                <TableRow>
                  <TableCell className="font-medium">OpenAI</TableCell>
                  <TableCell>Elaborazione AI</TableCell>
                  <TableCell>USA</TableCell>
                  <TableCell>DPA, SCCs, SOC 2</TableCell>
                </TableRow>
                <TableRow>
                  <TableCell className="font-medium">Google Cloud</TableCell>
                  <TableCell>Servizi AI (Gemini)</TableCell>
                  <TableCell>UE/USA</TableCell>
                  <TableCell>DPA, SCCs, ISO 27001</TableCell>
                </TableRow>
              </TableBody>
            </Table>

            <div className="bg-amber-500/10 border border-amber-500/20 rounded-lg p-4 mt-4">
              <p className="text-sm text-muted-foreground m-0">
                <strong>Nota sui trasferimenti extra-UE:</strong> I trasferimenti verso paesi terzi sono effettuati 
                sulla base di Clausole Contrattuali Standard (SCCs) approvate dalla Commissione Europea e, 
                ove applicabile, del Data Privacy Framework UE-USA.
              </p>
            </div>
          </section>

          {/* Section 5 - AI Processing */}
          <section className="mb-8">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2 rounded-lg bg-primary/10">
                <Brain className="h-5 w-5 text-primary" />
              </div>
              <h2 className="text-2xl font-bold m-0">5. Trattamento mediante Intelligenza Artificiale</h2>
            </div>
            <Separator className="mb-4" />
            
            <h3 className="text-lg font-semibold mb-3">5.1 Funzionalità AI</h3>
            <p className="text-muted-foreground mb-4">
              RegBrain utilizza modelli di intelligenza artificiale per:
            </p>
            <ul className="list-disc pl-6 space-y-2 text-muted-foreground">
              <li>Analizzare documenti e policy aziendali per identificare gap di compliance</li>
              <li>Generare raccomandazioni personalizzate basate sul contesto normativo</li>
              <li>Rispondere a domande sulla normativa (chatbot AI Copilot)</li>
              <li>Generare documenti e policy template</li>
            </ul>

            <h3 className="text-lg font-semibold mb-3 mt-6">5.2 Processo Decisionale Automatizzato</h3>
            <p className="text-muted-foreground mb-4">
              Le analisi AI non comportano decisioni automatizzate con effetti legali significativi. 
              Tutti i risultati sono suggerimenti che richiedono validazione umana.
            </p>

            <h3 className="text-lg font-semibold mb-3 mt-6">5.3 Diritto di Contestazione</h3>
            <p className="text-muted-foreground">
              L'utente ha diritto di richiedere la revisione umana di qualsiasi analisi o raccomandazione 
              generata dal sistema AI, contattando il supporto all'indirizzo {companyEmail}.
            </p>
          </section>

          {/* Section 6 - Diritti */}
          <section className="mb-8">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2 rounded-lg bg-primary/10">
                <Lock className="h-5 w-5 text-primary" />
              </div>
              <h2 className="text-2xl font-bold m-0">6. Diritti dell'Interessato</h2>
            </div>
            <Separator className="mb-4" />
            
            <p className="text-muted-foreground mb-4">
              Ai sensi degli artt. 15-22 del GDPR, l'interessato ha diritto di:
            </p>

            <div className="grid md:grid-cols-2 gap-4">
              {[
                { title: "Accesso", desc: "Ottenere conferma del trattamento e copia dei dati" },
                { title: "Rettifica", desc: "Correggere dati inesatti o incompleti" },
                { title: "Cancellazione", desc: "Ottenere la cancellazione dei dati (diritto all'oblio)" },
                { title: "Limitazione", desc: "Limitare il trattamento in determinate circostanze" },
                { title: "Portabilità", desc: "Ricevere i dati in formato strutturato e leggibile" },
                { title: "Opposizione", desc: "Opporsi al trattamento per motivi legittimi" },
              ].map((right, index) => (
                <div key={index} className="bg-muted/50 rounded-lg p-4">
                  <h4 className="font-semibold mb-1">{right.title}</h4>
                  <p className="text-sm text-muted-foreground m-0">{right.desc}</p>
                </div>
              ))}
            </div>

            <p className="text-muted-foreground mt-4">
              Per esercitare i propri diritti, contattare: <a href={`mailto:${companyEmail}`} className="text-primary">{companyEmail}</a>
            </p>
            <p className="text-muted-foreground">
              L'interessato ha inoltre il diritto di proporre reclamo all'Autorità Garante per la Protezione 
              dei Dati Personali (<a href="https://www.garanteprivacy.it" className="text-primary" target="_blank" rel="noopener noreferrer">www.garanteprivacy.it</a>).
            </p>
          </section>

          {/* Section 7 - Security */}
          <section className="mb-8">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2 rounded-lg bg-primary/10">
                <Shield className="h-5 w-5 text-primary" />
              </div>
              <h2 className="text-2xl font-bold m-0">7. Misure di Sicurezza</h2>
            </div>
            <Separator className="mb-4" />
            
            <p className="text-muted-foreground mb-4">
              Adottiamo misure tecniche e organizzative appropriate per proteggere i dati personali:
            </p>

            <ul className="list-disc pl-6 space-y-2 text-muted-foreground">
              <li><strong>Crittografia:</strong> TLS 1.3 per dati in transito, AES-256 per dati a riposo</li>
              <li><strong>Autenticazione:</strong> Password con hashing bcrypt, supporto MFA</li>
              <li><strong>Controllo accessi:</strong> Row Level Security (RLS) a livello di database</li>
              <li><strong>Backup:</strong> Backup giornalieri con retention di 30 giorni</li>
              <li><strong>Monitoraggio:</strong> Logging degli accessi e delle operazioni</li>
              <li><strong>Formazione:</strong> Training periodico del personale sulla protezione dati</li>
            </ul>
          </section>

          {/* Section 8 - Retention */}
          <section className="mb-8">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2 rounded-lg bg-primary/10">
                <Clock className="h-5 w-5 text-primary" />
              </div>
              <h2 className="text-2xl font-bold m-0">8. Conservazione dei Dati</h2>
            </div>
            <Separator className="mb-4" />
            
            <p className="text-muted-foreground mb-4">
              I dati personali sono conservati per il tempo strettamente necessario alle finalità per cui sono stati raccolti:
            </p>

            <ul className="list-disc pl-6 space-y-2 text-muted-foreground">
              <li><strong>Dati account:</strong> per la durata del contratto + 30 giorni dalla cancellazione</li>
              <li><strong>Documenti caricati:</strong> per la durata del contratto, poi cancellati</li>
              <li><strong>Dati di fatturazione:</strong> 10 anni (obblighi fiscali)</li>
              <li><strong>Log di sicurezza:</strong> 12 mesi</li>
              <li><strong>Dati analytics:</strong> 24 mesi in forma aggregata/anonimizzata</li>
            </ul>
          </section>

          {/* Section 9 - International */}
          <section className="mb-8">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2 rounded-lg bg-primary/10">
                <Globe className="h-5 w-5 text-primary" />
              </div>
              <h2 className="text-2xl font-bold m-0">9. Trasferimenti Internazionali</h2>
            </div>
            <Separator className="mb-4" />
            
            <p className="text-muted-foreground mb-4">
              I dati sono principalmente trattati all'interno dell'UE. Eventuali trasferimenti verso paesi terzi 
              avvengono esclusivamente sulla base di:
            </p>
            <ul className="list-disc pl-6 space-y-2 text-muted-foreground">
              <li>Decisioni di adeguatezza della Commissione Europea</li>
              <li>Clausole Contrattuali Standard (SCCs) approvate dalla Commissione</li>
              <li>Data Privacy Framework UE-USA (per i fornitori certificati)</li>
            </ul>
          </section>

          {/* Section 10 - Updates */}
          <section className="mb-8">
            <h2 className="text-2xl font-bold mb-4">10. Modifiche alla Privacy Policy</h2>
            <Separator className="mb-4" />
            
            <p className="text-muted-foreground">
              Ci riserviamo il diritto di modificare la presente informativa. Le modifiche sostanziali saranno 
              comunicate via email almeno 30 giorni prima dell'entrata in vigore.
            </p>
          </section>

          {/* Contact */}
          <section className="bg-muted/50 rounded-lg p-6 mt-12">
            <div className="flex items-center gap-3 mb-4">
              <Mail className="h-5 w-5 text-primary" />
              <h2 className="text-xl font-bold m-0">Contatti per la Privacy</h2>
            </div>
            <p className="text-sm text-muted-foreground">
              Email: <a href={`mailto:${companyEmail}`} className="text-primary">{companyEmail}</a>
            </p>
          </section>
        </div>
      </main>
    </div>
  );
};

export default PrivacyPolicy;
