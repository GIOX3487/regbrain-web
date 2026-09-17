import { ArrowLeft, Cookie, Info, Settings, BarChart3, Target, Mail } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import { Separator } from "@/components/ui/separator";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

const CookiePolicy = () => {
  const navigate = useNavigate();
  const lastUpdated = "17 settembre 2026";
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
              Informativa sull'uso dei cookie e delle tecnologie di memorizzazione nel browser
            </p>
            <p className="text-sm text-muted-foreground">Ultimo aggiornamento: {lastUpdated}</p>
          </div>

          {/* Intro */}
          <div className="bg-primary/5 border border-primary/20 rounded-lg p-6 mb-8">
            <p className="text-muted-foreground m-0">
              <strong className="text-foreground">In breve: RegBrain non usa cookie.</strong> Il sito e la
              piattaforma non installano alcun cookie sul tuo dispositivo, non usano strumenti di analisi del
              traffico, non usano strumenti di profilazione pubblicitaria e non caricano contenuti di terze parti
              nel browser. Usiamo solo la memoria locale del browser per le funzioni che chiedi tu, come restare
              connesso dopo il login. Per questo non trovi un banner di consenso: non c'è niente per cui chiederlo.
              Questa informativa integra la Privacy Policy e si applica al sito e alla piattaforma RegBrain.
            </p>
          </div>

          {/* Section 1 */}
          <section className="mb-8">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2 rounded-lg bg-primary/10">
                <Info className="h-5 w-5 text-primary" />
              </div>
              <h2 className="text-2xl font-bold m-0">1. Cookie e tecnologie equivalenti</h2>
            </div>
            <Separator className="mb-4" />

            <p className="text-muted-foreground mb-4">
              I cookie sono piccoli file di testo che un sito salva sul dispositivo di chi lo visita e che il
              browser rimanda al sito a ogni richiesta successiva. La normativa non riguarda però solo i cookie in
              senso stretto: l'articolo 122 del Codice privacy e le linee guida del Garante sui cookie e altri
              strumenti di tracciamento si applicano a qualunque archiviazione di informazioni nel dispositivo
              dell'utente, compresi il local storage e il session storage del browser.
            </p>

            <p className="text-muted-foreground">
              Per questo motivo l'elenco della sezione 2 non riporta cookie, che non esistono, ma tutto ciò che
              RegBrain effettivamente scrive nella memoria del tuo browser.
            </p>
          </section>

          {/* Section 2 - What we actually store */}
          <section className="mb-8">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2 rounded-lg bg-primary/10">
                <Settings className="h-5 w-5 text-primary" />
              </div>
              <h2 className="text-2xl font-bold m-0">2. Cosa memorizziamo davvero</h2>
            </div>
            <Separator className="mb-4" />

            <div className="bg-muted/50 border border-border rounded-lg p-4 mb-6">
              <p className="text-sm text-muted-foreground m-0">
                <strong className="text-foreground">Cookie installati: nessuno.</strong> Aprendo il sito senza
                effettuare il login, il browser non riceve alcun cookie, né di prima né di terza parte.
              </p>
            </div>

            <h3 className="text-lg font-semibold mb-3">2.1 Memoria persistente (local storage)</h3>
            <p className="text-muted-foreground mb-4">
              Resta nel browser finché non esci dall'account o non la cancelli tu. Non viene inviata
              automaticamente a nessun server, a differenza dei cookie.
            </p>

            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nome</TableHead>
                  <TableHead>Scopo</TableHead>
                  <TableHead>Durata</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                <TableRow>
                  <TableCell className="font-mono text-sm">sb-&lt;progetto&gt;-auth-token</TableCell>
                  <TableCell>
                    Sessione di autenticazione, per non dover rifare il login a ogni pagina. Scritta solo dopo
                    l'accesso.
                  </TableCell>
                  <TableCell>Fino al logout</TableCell>
                </TableRow>
                <TableRow>
                  <TableCell className="font-mono text-sm">pendingAnalysis</TableCell>
                  <TableCell>
                    Conserva i dati di un'analisi avviata mentre completi un passaggio intermedio, per non
                    perderli.
                  </TableCell>
                  <TableCell>Fino al completamento</TableCell>
                </TableRow>
                <TableRow>
                  <TableCell className="font-mono text-sm">returnToAnalysis</TableCell>
                  <TableCell>Ti riporta all'analisi da cui eri partito dopo una deviazione di percorso.</TableCell>
                  <TableCell>Fino al rientro</TableCell>
                </TableRow>
                <TableRow>
                  <TableCell className="font-mono text-sm">continueConversation</TableCell>
                  <TableCell>Riprende una conversazione con l'assistente interrotta da un cambio pagina.</TableCell>
                  <TableCell>Fino alla ripresa</TableCell>
                </TableRow>
              </TableBody>
            </Table>

            <h3 className="text-lg font-semibold mb-3 mt-8">2.2 Memoria di sessione (session storage)</h3>
            <p className="text-muted-foreground mb-4">
              Viene cancellata dal browser quando chiudi la scheda. Non sopravvive alla sessione di navigazione.
            </p>

            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nome</TableHead>
                  <TableHead>Scopo</TableHead>
                  <TableHead>Durata</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                <TableRow>
                  <TableCell className="font-mono text-sm">site_auth_token</TableCell>
                  <TableCell>
                    Accesso al sito durante la fase ad accesso riservato, per non dover reinserire la password a
                    ogni pagina.
                  </TableCell>
                  <TableCell>Chiusura della scheda</TableCell>
                </TableRow>
                <TableRow>
                  <TableCell className="font-mono text-sm">auth_redirect</TableCell>
                  <TableCell>Ricorda la pagina a cui tornare subito dopo il login.</TableCell>
                  <TableCell>Chiusura della scheda</TableCell>
                </TableRow>
                <TableRow>
                  <TableCell className="font-mono text-sm">chatState, chatReturn, restoreMessages</TableCell>
                  <TableCell>
                    Stato della conversazione con l'assistente e messaggi da ripristinare dopo un cambio pagina.
                  </TableCell>
                  <TableCell>Chiusura della scheda</TableCell>
                </TableRow>
                <TableRow>
                  <TableCell className="font-mono text-sm">force_demo_onboarding</TableCell>
                  <TableCell>Avvia la procedura guidata iniziale quando entri nella demo.</TableCell>
                  <TableCell>Chiusura della scheda</TableCell>
                </TableRow>
              </TableBody>
            </Table>

            <p className="text-sm text-muted-foreground mt-4 italic">
              Tutte queste voci sono tecniche, cioè strettamente necessarie a fornire il servizio che hai
              richiesto. L'articolo 122 comma 1 del Codice privacy non richiede il consenso per questo tipo di
              archiviazione. Il trattamento dei dati collegati è fondato sull'esecuzione del contratto
              (art. 6.1.b GDPR).
            </p>
          </section>

          {/* Section 3 - Analytics */}
          <section className="mb-8">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2 rounded-lg bg-primary/10">
                <BarChart3 className="h-5 w-5 text-primary" />
              </div>
              <h2 className="text-2xl font-bold m-0">3. Cookie analitici</h2>
            </div>
            <Separator className="mb-4" />

            <p className="text-muted-foreground mb-4">
              <strong className="text-foreground">Non ne usiamo.</strong> Il sito non integra alcuno strumento di
              analisi del traffico o del comportamento degli utenti: né Google Analytics, né Plausible, né
              PostHog, né Matomo, né mappe di calore o registrazioni di sessione. Non misuriamo le visite.
            </p>

            <div className="bg-muted/50 border border-border rounded-lg p-4">
              <p className="text-sm text-muted-foreground m-0">
                Se in futuro introdurremo uno strumento di misurazione, aggiorneremo questa pagina prima di
                attivarlo e, se non sarà esente da consenso, chiederemo il tuo consenso preventivo con un banner
                dedicato.
              </p>
            </div>
          </section>

          {/* Section 4 - Marketing */}
          <section className="mb-8">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2 rounded-lg bg-primary/10">
                <Target className="h-5 w-5 text-primary" />
              </div>
              <h2 className="text-2xl font-bold m-0">4. Cookie di marketing e profilazione</h2>
            </div>
            <Separator className="mb-4" />

            <p className="text-muted-foreground mb-4">
              <strong className="text-foreground">Non ne usiamo.</strong> Nessun pixel pubblicitario, nessun
              identificativo per il retargeting, nessuna piattaforma di advertising. RegBrain non vende e non
              cede i tuoi dati a terzi per finalità pubblicitarie.
            </p>
          </section>

          {/* Section 5 - Third Party */}
          <section className="mb-8">
            <h2 className="text-2xl font-bold mb-4">5. Terze parti</h2>
            <Separator className="mb-4" />

            <p className="text-muted-foreground mb-4">
              Nessun servizio di terza parte viene caricato nel tuo browser mentre usi RegBrain. Le pagine non
              richiamano font esterni, video incorporati, widget social, chat di supporto o script di fornitori
              terzi: tutte le risorse arrivano dal dominio di RegBrain.
            </p>

            <p className="text-muted-foreground mb-4">
              I fornitori che trattano dati per conto nostro lo fanno lato server, senza scrivere niente nel tuo
              browser. Sono elencati nella Privacy Policy insieme alla loro funzione e alla base giuridica. Se in
              futuro integreremo nel sito un servizio che imposta cookie propri, come un sistema di pagamento o
              una chat di assistenza, questa sezione verrà aggiornata prima dell'attivazione.
            </p>
          </section>

          {/* Section 6 - No banner */}
          <section className="mb-8">
            <h2 className="text-2xl font-bold mb-4">6. Perché non c'è un banner di consenso</h2>
            <Separator className="mb-4" />

            <p className="text-muted-foreground mb-4">
              Il consenso preventivo serve per l'archiviazione non tecnica: analisi, profilazione, tracciamento
              pubblicitario. RegBrain non ne fa nessuna, quindi un banner che chiede di accettare o rifiutare
              categorie inesistenti non avrebbe alcun effetto reale, e le linee guida del Garante scoraggiano la
              raccolta di consensi non necessari.
            </p>

            <p className="text-muted-foreground">
              Se e quando introdurremo strumenti soggetti a consenso, il banner comparirà, con rifiuto altrettanto
              facile dell'accettazione e possibilità di revoca in ogni momento.
            </p>
          </section>

          {/* Section 7 - Manage */}
          <section className="mb-8">
            <h2 className="text-2xl font-bold mb-4">7. Come cancellare quello che memorizziamo</h2>
            <Separator className="mb-4" />

            <p className="text-muted-foreground mb-4">
              La memoria di sessione si svuota chiudendo la scheda. La memoria persistente si svuota uscendo
              dall'account, oppure cancellando i dati del sito dal browser:
            </p>
            <ul className="list-disc pl-6 space-y-2 text-muted-foreground">
              <li>
                <strong>Chrome:</strong>{" "}
                <a href="https://support.google.com/chrome/answer/95647" className="text-primary hover:underline" target="_blank" rel="noopener noreferrer">
                  cancellare i dati dei siti in Chrome
                </a>
              </li>
              <li>
                <strong>Firefox:</strong>{" "}
                <a href="https://support.mozilla.org/it/kb/eliminare-i-cookie-e-i-dati-dei-siti-in-firefox" className="text-primary hover:underline" target="_blank" rel="noopener noreferrer">
                  cancellare i dati dei siti in Firefox
                </a>
              </li>
              <li>
                <strong>Safari:</strong>{" "}
                <a href="https://support.apple.com/it-it/guide/safari/sfri11471/mac" className="text-primary hover:underline" target="_blank" rel="noopener noreferrer">
                  gestire i dati dei siti in Safari
                </a>
              </li>
              <li>
                <strong>Edge:</strong>{" "}
                <a href="https://support.microsoft.com/it-it/microsoft-edge/eliminare-i-cookie-in-microsoft-edge-63947406-40ac-c3b8-57b9-2a946a29ae09" className="text-primary hover:underline" target="_blank" rel="noopener noreferrer">
                  eliminare i dati di navigazione in Edge
                </a>
              </li>
            </ul>

            <div className="bg-amber-500/10 border border-amber-500/20 rounded-lg p-4 mt-4">
              <p className="text-sm text-muted-foreground m-0">
                <strong>Attenzione:</strong> cancellando questi dati esci dall'account e perdi le analisi avviate
                ma non ancora completate. I documenti e i risultati già salvati restano nel tuo spazio di lavoro,
                perché non sono conservati nel browser.
              </p>
            </div>
          </section>

          {/* Section 8 - Rights */}
          <section className="mb-8">
            <h2 className="text-2xl font-bold mb-4">8. I tuoi diritti</h2>
            <Separator className="mb-4" />

            <p className="text-muted-foreground mb-4">
              Sui dati personali trattati da RegBrain hai i diritti previsti dagli articoli da 15 a 22 del GDPR:
            </p>
            <ul className="list-disc pl-6 space-y-2 text-muted-foreground">
              <li>accedere ai dati che ti riguardano e ottenerne copia</li>
              <li>chiederne la rettifica o la cancellazione</li>
              <li>chiedere la limitazione del trattamento</li>
              <li>ricevere i dati in formato strutturato e trasferirli ad altro titolare</li>
              <li>opporti al trattamento nei casi previsti dall'articolo 21</li>
              <li>presentare reclamo al Garante per la protezione dei dati personali</li>
            </ul>
            <p className="text-muted-foreground mt-4">
              Le modalità di esercizio e i tempi di risposta sono indicati nella Privacy Policy.
            </p>
          </section>

          {/* Section 9 - Updates */}
          <section className="mb-8">
            <h2 className="text-2xl font-bold mb-4">9. Aggiornamenti</h2>
            <Separator className="mb-4" />

            <p className="text-muted-foreground">
              Questa pagina viene aggiornata ogni volta che cambia ciò che il sito memorizza nel browser. La data
              in alto indica l'ultima revisione. Se un aggiornamento introducesse strumenti soggetti a consenso,
              te lo comunicheremo prima di attivarli.
            </p>
          </section>

          {/* Contact */}
          <section className="bg-muted/50 rounded-lg p-6 mt-12">
            <div className="flex items-center gap-3 mb-4">
              <Mail className="h-5 w-5 text-primary" />
              <h2 className="text-xl font-bold m-0">Contatti</h2>
            </div>
            <p className="text-muted-foreground mb-2">
              Per domande su questa informativa o per esercitare i tuoi diritti:
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
