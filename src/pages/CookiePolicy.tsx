import { ArrowLeft, Cookie, Info, Settings, BarChart3, Target, Mail } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import { Separator } from "@/components/ui/separator";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

const CookiePolicy = () => {
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
            <Cookie className="h-5 w-5 text-primary" />
            <span className="font-semibold">Cookie Policy</span>
          </div>
          <div className="w-24" />
        </div>
      </header>

      {/* Content */}
      <main className="container mx-auto px-4 py-8 max-w-4xl">
        <div className="prose prose-slate dark:prose-invert max-w-none">
          {/* Title */}
          <div className="text-center mb-12">
            <h1 className="text-3xl md:text-4xl font-bold mb-4">Cookie Policy</h1>
            <p className="text-muted-foreground mb-2">
              Informativa sull'utilizzo dei cookie e tecnologie simili
            </p>
          </div>

          {/* Intro */}
          <div className="bg-primary/5 border border-primary/20 rounded-lg p-6 mb-8">
            <p className="text-muted-foreground m-0">
              La presente Cookie Policy spiega cosa sono i cookie, quali tipologie utilizziamo, 
              come puoi gestire le tue preferenze e i tuoi diritti in merito. Questa policy integra 
              la nostra Privacy Policy e si applica al sito web e alla piattaforma RegBrain.
            </p>
          </div>

          {/* Section 1 */}
          <section className="mb-8">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2 rounded-lg bg-primary/10">
                <Info className="h-5 w-5 text-primary" />
              </div>
              <h2 className="text-2xl font-bold m-0">1. Cosa sono i Cookie</h2>
            </div>
            <Separator className="mb-4" />
            
            <p className="text-muted-foreground mb-4">
              I cookie sono piccoli file di testo che vengono memorizzati sul tuo dispositivo (computer, tablet, smartphone) 
              quando visiti un sito web. Servono a migliorare l'esperienza di navigazione, ricordare le tue preferenze 
              e fornire informazioni ai proprietari del sito.
            </p>

            <h3 className="text-lg font-semibold mb-3">Tecnologie simili ai cookie</h3>
            <p className="text-muted-foreground">
              Oltre ai cookie, utilizziamo tecnologie simili come:
            </p>
            <ul className="list-disc pl-6 space-y-2 text-muted-foreground">
              <li><strong>Local Storage:</strong> per memorizzare dati persistenti nel browser</li>
              <li><strong>Session Storage:</strong> per dati temporanei della sessione</li>
              <li><strong>Web Beacons:</strong> per tracciare l'apertura di email (solo con consenso)</li>
            </ul>
          </section>

          {/* Section 2 - Technical Cookies */}
          <section className="mb-8">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2 rounded-lg bg-primary/10">
                <Settings className="h-5 w-5 text-primary" />
              </div>
              <h2 className="text-2xl font-bold m-0">2. Cookie Tecnici (Necessari)</h2>
            </div>
            <Separator className="mb-4" />
            
            <p className="text-muted-foreground mb-4">
              Questi cookie sono essenziali per il funzionamento del sito e non possono essere disattivati. 
              Vengono impostati in risposta ad azioni dell'utente (login, compilazione form, preferenze privacy).
            </p>

            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nome</TableHead>
                  <TableHead>Scopo</TableHead>
                  <TableHead>Durata</TableHead>
                  <TableHead>Tipo</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                <TableRow>
                  <TableCell className="font-mono text-sm">sb-*-auth-token</TableCell>
                  <TableCell>Autenticazione utente (Supabase)</TableCell>
                  <TableCell>Sessione / 7 giorni</TableCell>
                  <TableCell>First-party</TableCell>
                </TableRow>
                <TableRow>
                  <TableCell className="font-mono text-sm">cookie_consent</TableCell>
                  <TableCell>Memorizza le preferenze cookie</TableCell>
                  <TableCell>12 mesi</TableCell>
                  <TableCell>First-party</TableCell>
                </TableRow>
                <TableRow>
                  <TableCell className="font-mono text-sm">theme</TableCell>
                  <TableCell>Preferenza tema chiaro/scuro</TableCell>
                  <TableCell>12 mesi</TableCell>
                  <TableCell>First-party</TableCell>
                </TableRow>
                <TableRow>
                  <TableCell className="font-mono text-sm">language</TableCell>
                  <TableCell>Preferenza lingua</TableCell>
                  <TableCell>12 mesi</TableCell>
                  <TableCell>First-party</TableCell>
                </TableRow>
                <TableRow>
                  <TableCell className="font-mono text-sm">onboarding_complete</TableCell>
                  <TableCell>Stato del wizard iniziale</TableCell>
                  <TableCell>Persistente</TableCell>
                  <TableCell>First-party</TableCell>
                </TableRow>
              </TableBody>
            </Table>

            <p className="text-sm text-muted-foreground mt-4 italic">
              Base giuridica: Legittimo interesse (Art. 6.1.f GDPR) - necessari per il funzionamento del servizio.
            </p>
          </section>

          {/* Section 3 - Analytics */}
          <section className="mb-8">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2 rounded-lg bg-primary/10">
                <BarChart3 className="h-5 w-5 text-primary" />
              </div>
              <h2 className="text-2xl font-bold m-0">3. Cookie Analitici</h2>
            </div>
            <Separator className="mb-4" />
            
            <p className="text-muted-foreground mb-4">
              Questi cookie ci aiutano a capire come i visitatori interagiscono con il sito, 
              raccogliendo informazioni in forma aggregata e anonima.
            </p>

            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Fornitore</TableHead>
                  <TableHead>Cookie</TableHead>
                  <TableHead>Scopo</TableHead>
                  <TableHead>Durata</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                <TableRow>
                  <TableCell className="font-medium">Plausible Analytics</TableCell>
                  <TableCell className="font-mono text-sm">Nessun cookie</TableCell>
                  <TableCell>Analytics privacy-friendly senza cookie</TableCell>
                  <TableCell>N/A</TableCell>
                </TableRow>
                <TableRow>
                  <TableCell className="font-medium">Posthog</TableCell>
                  <TableCell className="font-mono text-sm">ph_*</TableCell>
                  <TableCell>Product analytics e funnel</TableCell>
                  <TableCell>12 mesi</TableCell>
                </TableRow>
              </TableBody>
            </Table>

            <p className="text-sm text-muted-foreground mt-4 italic">
              Base giuridica: Consenso (Art. 6.1.a GDPR). Puoi revocare il consenso in qualsiasi momento.
            </p>
          </section>

          {/* Section 4 - Marketing */}
          <section className="mb-8">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2 rounded-lg bg-primary/10">
                <Target className="h-5 w-5 text-primary" />
              </div>
              <h2 className="text-2xl font-bold m-0">4. Cookie di Marketing (Opzionali)</h2>
            </div>
            <Separator className="mb-4" />
            
            <p className="text-muted-foreground mb-4">
              Attualmente <strong>non utilizziamo cookie di marketing o profilazione</strong>. 
              Se in futuro decidessimo di implementarli, aggiorneremo questa policy e richiederemo 
              il tuo consenso esplicito prima di attivarli.
            </p>

            <div className="bg-green-500/10 border border-green-500/20 rounded-lg p-4">
              <p className="text-sm text-muted-foreground m-0">
                <strong>✓ Scelta privacy-first:</strong> RegBrain non vende né condivide i tuoi dati con terze parti 
                per finalità pubblicitarie. Non utilizziamo Google Analytics né Facebook Pixel.
              </p>
            </div>
          </section>

          {/* Section 5 - Third Party */}
          <section className="mb-8">
            <h2 className="text-2xl font-bold mb-4">5. Cookie di Terze Parti</h2>
            <Separator className="mb-4" />
            
            <p className="text-muted-foreground mb-4">
              Alcuni servizi integrati potrebbero impostare propri cookie:
            </p>

            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Servizio</TableHead>
                  <TableHead>Scopo</TableHead>
                  <TableHead>Privacy Policy</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                <TableRow>
                  <TableCell className="font-medium">Stripe</TableCell>
                  <TableCell>Elaborazione pagamenti sicuri</TableCell>
                  <TableCell>
                    <a href="https://stripe.com/privacy" className="text-primary hover:underline" target="_blank" rel="noopener noreferrer">
                      stripe.com/privacy
                    </a>
                  </TableCell>
                </TableRow>
                <TableRow>
                  <TableCell className="font-medium">Intercom</TableCell>
                  <TableCell>Chat di supporto (se attivo)</TableCell>
                  <TableCell>
                    <a href="https://www.intercom.com/legal/privacy" className="text-primary hover:underline" target="_blank" rel="noopener noreferrer">
                      intercom.com/legal/privacy
                    </a>
                  </TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </section>

          {/* Section 6 - Manage Cookies */}
          <section className="mb-8">
            <h2 className="text-2xl font-bold mb-4">6. Come Gestire i Cookie</h2>
            <Separator className="mb-4" />
            
            <h3 className="text-lg font-semibold mb-3">6.1 Banner di Consenso</h3>
            <p className="text-muted-foreground mb-4">
              Al primo accesso alla piattaforma, ti verrà mostrato un banner che ti permette di accettare 
              o rifiutare i cookie non essenziali. Puoi modificare le tue preferenze in qualsiasi momento 
              cliccando su "Impostazioni Cookie" nel footer del sito.
            </p>

            <h3 className="text-lg font-semibold mb-3">6.2 Impostazioni del Browser</h3>
            <p className="text-muted-foreground mb-4">
              Puoi gestire i cookie direttamente dal tuo browser:
            </p>
            <ul className="list-disc pl-6 space-y-2 text-muted-foreground">
              <li>
                <strong>Chrome:</strong>{" "}
                <a href="https://support.google.com/chrome/answer/95647" className="text-primary hover:underline" target="_blank" rel="noopener noreferrer">
                  Gestisci cookie in Chrome
                </a>
              </li>
              <li>
                <strong>Firefox:</strong>{" "}
                <a href="https://support.mozilla.org/it/kb/protezione-antitracciamento-avanzata-firefox-desktop" className="text-primary hover:underline" target="_blank" rel="noopener noreferrer">
                  Gestisci cookie in Firefox
                </a>
              </li>
              <li>
                <strong>Safari:</strong>{" "}
                <a href="https://support.apple.com/it-it/guide/safari/sfri11471/mac" className="text-primary hover:underline" target="_blank" rel="noopener noreferrer">
                  Gestisci cookie in Safari
                </a>
              </li>
              <li>
                <strong>Edge:</strong>{" "}
                <a href="https://support.microsoft.com/it-it/microsoft-edge/eliminare-i-cookie-in-microsoft-edge-63947406-40ac-c3b8-57b9-2a946a29ae09" className="text-primary hover:underline" target="_blank" rel="noopener noreferrer">
                  Gestisci cookie in Edge
                </a>
              </li>
            </ul>

            <div className="bg-amber-500/10 border border-amber-500/20 rounded-lg p-4 mt-4">
              <p className="text-sm text-muted-foreground m-0">
                <strong>Attenzione:</strong> La disattivazione dei cookie tecnici potrebbe compromettere 
                il funzionamento del sito e impedirti di accedere ad alcune funzionalità.
              </p>
            </div>
          </section>

          {/* Section 7 - Rights */}
          <section className="mb-8">
            <h2 className="text-2xl font-bold mb-4">7. I Tuoi Diritti</h2>
            <Separator className="mb-4" />
            
            <p className="text-muted-foreground mb-4">
              In relazione ai cookie e al trattamento dei dati, hai diritto di:
            </p>
            <ul className="list-disc pl-6 space-y-2 text-muted-foreground">
              <li>Revocare il consenso ai cookie opzionali in qualsiasi momento</li>
              <li>Accedere ai dati raccolti tramite cookie</li>
              <li>Richiedere la cancellazione dei dati</li>
              <li>Opporti al trattamento basato sul legittimo interesse</li>
              <li>Presentare reclamo al Garante Privacy</li>
            </ul>
          </section>

          {/* Section 8 - Updates */}
          <section className="mb-8">
            <h2 className="text-2xl font-bold mb-4">8. Aggiornamenti della Cookie Policy</h2>
            <Separator className="mb-4" />
            
            <p className="text-muted-foreground">
              Questa policy potrebbe essere aggiornata periodicamente. Ti informeremo di modifiche 
              significative tramite banner sul sito o comunicazione email.
            </p>
          </section>

          {/* Contact */}
          <section className="bg-muted/50 rounded-lg p-6 mt-12">
            <div className="flex items-center gap-3 mb-4">
              <Mail className="h-5 w-5 text-primary" />
              <h2 className="text-xl font-bold m-0">Contatti</h2>
            </div>
            <p className="text-muted-foreground mb-2">
              Per domande sulla Cookie Policy o per esercitare i tuoi diritti:
            </p>
            <p className="text-muted-foreground">
              Email: <a href={`mailto:${companyEmail}`} className="text-primary">{companyEmail}</a>
            </p>
          </section>
        </div>
      </main>
    </div>
  );
};

export default CookiePolicy;
