import { ArrowLeft, Shield, Database, Users, Globe, Lock, Clock, FileCheck, Mail, Server, Brain } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import { Separator } from "@/components/ui/separator";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

const PrivacyPolicy = () => {
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
              ai sensi degli articoli 13 e 14 del Regolamento (UE) 2016/679
            </p>
            <p className="text-sm text-muted-foreground">Ultimo aggiornamento: {lastUpdated}</p>
          </div>

          {/* Intro */}
          <div className="bg-primary/5 border border-primary/20 rounded-lg p-6 mb-8">
            <p className="text-muted-foreground m-0">
              Questa informativa descrive quali dati personali {companyName} raccoglie attraverso il sito e la
              piattaforma, perché li tratta, a chi li comunica e per quanto tempo li conserva. Descrive il
              prodotto come funziona oggi: dove una funzione non esiste ancora, l'informativa lo dice invece di
              anticiparla. Per quello che il browser memorizza sul tuo dispositivo, si veda la Cookie Policy.
            </p>
          </div>

          {/* Section 1 */}
          <section className="mb-8">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2 rounded-lg bg-primary/10">
                <Users className="h-5 w-5 text-primary" />
              </div>
              <h2 className="text-2xl font-bold m-0">1. Titolare del trattamento</h2>
            </div>
            <Separator className="mb-4" />

            <Table>
              <TableBody>
                <TableRow>
                  <TableCell className="font-medium">Titolare</TableCell>
                  <TableCell>{companyName}</TableCell>
                </TableRow>
                <TableRow>
                  <TableCell className="font-medium">Contatto</TableCell>
                  <TableCell><a href={`mailto:${companyEmail}`} className="text-primary">{companyEmail}</a></TableCell>
                </TableRow>
                <TableRow>
                  <TableCell className="font-medium">Responsabile della protezione dei dati</TableCell>
                  <TableCell>Non designato. Le richieste vanno all'indirizzo sopra.</TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </section>

          {/* Section 2 */}
          <section className="mb-8">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2 rounded-lg bg-primary/10">
                <Database className="h-5 w-5 text-primary" />
              </div>
              <h2 className="text-2xl font-bold m-0">2. Dati trattati</h2>
            </div>
            <Separator className="mb-4" />

            <h3 className="text-lg font-semibold mb-3">2.1 Dati che fornisci tu</h3>
            <ul className="list-disc pl-6 space-y-2 text-muted-foreground">
              <li>
                <strong>Registrazione:</strong> indirizzo email e password. La password non viene mai conservata
                in chiaro: è gestita dal servizio di autenticazione con funzione di hash bcrypt. Al momento della
                registrazione non chiediamo nome, cognome, telefono né altri dati anagrafici.
              </li>
              <li>
                <strong>Profilo professionale:</strong> giurisdizione, settore, dimensione dell'organizzazione,
                ruolo in materia di compliance e ruolo rispetto al trattamento dei dati.
              </li>
              <li>
                <strong>Valutazioni di conformità:</strong> titolo e descrizione della valutazione, normative
                selezionate, ambito, fatturato annuo dichiarato e risposte al questionario di applicabilità.
              </li>
              <li>
                <strong>Documenti caricati:</strong> i file che carichi per l'analisi, con il testo che contengono.
                Restano in un archivio non pubblico, accessibile solo al tuo account.
              </li>
              <li>
                <strong>Domande all'assistente:</strong> le domande poste al copilot e le risposte generate,
                conservate insieme alle fonti citate e al modello usato.
              </li>
              <li>
                <strong>Sessioni demo:</strong> per la demo gratuita, l'indirizzo email e la scadenza della
                sessione.
              </li>
            </ul>

            <h3 className="text-lg font-semibold mb-3 mt-6">2.2 Dati raccolti automaticamente</h3>
            <p className="text-muted-foreground mb-4">
              La piattaforma non raccoglie dati di navigazione a fini statistici o di profilazione: non registra
              in nessuna tabella l'indirizzo IP, il browser, il sistema operativo o le pagine visitate, e non
              integra alcuno strumento di analisi del traffico.
            </p>
            <p className="text-muted-foreground">
              L'indirizzo IP e l'intestazione del browser compaiono soltanto nei registri tecnici dei fornitori
              di infrastruttura, generati automaticamente da qualunque server web e conservati per sicurezza e
              diagnosi dei guasti secondo i tempi del fornitore. Non li usiamo per costruire profili né li
              incrociamo con il tuo account.
            </p>

            <h3 className="text-lg font-semibold mb-3 mt-6">2.3 Dati prodotti dall'analisi</h3>
            <ul className="list-disc pl-6 space-y-2 text-muted-foreground">
              <li>esito di ciascun obbligo verificato, con le citazioni testuali estratte dai tuoi documenti</li>
              <li>percentuale di conformità, punteggio di rischio e stato di avanzamento dell'analisi</li>
              <li>documenti generati su tua richiesta a partire dai risultati</li>
            </ul>
          </section>

          {/* Section 3 */}
          <section className="mb-8">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2 rounded-lg bg-primary/10">
                <FileCheck className="h-5 w-5 text-primary" />
              </div>
              <h2 className="text-2xl font-bold m-0">3. Finalità, basi giuridiche e conservazione</h2>
            </div>
            <Separator className="mb-4" />

            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Finalità</TableHead>
                  <TableHead>Base giuridica</TableHead>
                  <TableHead>Conservazione</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                <TableRow>
                  <TableCell>Creazione e gestione dell'account</TableCell>
                  <TableCell>Esecuzione del contratto (art. 6.1.b)</TableCell>
                  <TableCell>Fino alla cancellazione dell'account</TableCell>
                </TableRow>
                <TableRow>
                  <TableCell>Analisi dei documenti e produzione dei risultati</TableCell>
                  <TableCell>Esecuzione del contratto (art. 6.1.b)</TableCell>
                  <TableCell>Fino alla cancellazione dell'account o del singolo contenuto</TableCell>
                </TableRow>
                <TableRow>
                  <TableCell>Assistenza all'utente</TableCell>
                  <TableCell>Esecuzione del contratto (art. 6.1.b)</TableCell>
                  <TableCell>24 mesi dalla chiusura della richiesta</TableCell>
                </TableRow>
                <TableRow>
                  <TableCell>Sicurezza del servizio e diagnosi dei guasti</TableCell>
                  <TableCell>Legittimo interesse (art. 6.1.f)</TableCell>
                  <TableCell>Secondo i tempi dei registri tecnici dei fornitori</TableCell>
                </TableRow>
                <TableRow>
                  <TableCell>Adempimenti contabili e fiscali, per i clienti sotto contratto</TableCell>
                  <TableCell>Obbligo legale (art. 6.1.c)</TableCell>
                  <TableCell>10 anni</TableCell>
                </TableRow>
              </TableBody>
            </Table>

            <p className="text-sm text-muted-foreground mt-4 italic">
              Non inviamo comunicazioni commerciali e non gestiamo liste di contatti a fini di marketing: nella
              piattaforma non esiste alcuna funzione che lo permetta. Se verrà introdotta, questa informativa sarà
              aggiornata e il consenso raccolto separatamente.
            </p>
          </section>

          {/* Section 4 */}
          <section className="mb-8">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2 rounded-lg bg-primary/10">
                <Server className="h-5 w-5 text-primary" />
              </div>
              <h2 className="text-2xl font-bold m-0">4. Responsabili del trattamento</h2>
            </div>
            <Separator className="mb-4" />

            <p className="text-muted-foreground mb-4">
              Per erogare il servizio ci avvaliamo dei fornitori elencati qui sotto, e di nessun altro. Ognuno
              tratta i dati su nostra istruzione, nei limiti del proprio servizio.
            </p>

            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Fornitore</TableHead>
                  <TableHead>Cosa fa</TableHead>
                  <TableHead>Dove</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                <TableRow>
                  <TableCell className="font-medium">Supabase Inc.</TableCell>
                  <TableCell>
                    Banca dati, autenticazione, archivio dei documenti caricati ed esecuzione delle funzioni di
                    analisi
                  </TableCell>
                  <TableCell>Unione Europea (Irlanda, regione eu-west-1)</TableCell>
                </TableRow>
                <TableRow>
                  <TableCell className="font-medium">Amazon Web Services</TableCell>
                  <TableCell>Infrastruttura su cui gira il servizio di Supabase</TableCell>
                  <TableCell>Unione Europea (Irlanda)</TableCell>
                </TableRow>
                <TableRow>
                  <TableCell className="font-medium">Vercel Inc.</TableCell>
                  <TableCell>
                    Pubblicazione dell'applicazione web e instradamento delle chiamate verso la banca dati
                  </TableCell>
                  <TableCell>Stati Uniti, con distribuzione su rete globale</TableCell>
                </TableRow>
                <TableRow>
                  <TableCell className="font-medium">Google LLC</TableCell>
                  <TableCell>
                    Modelli linguistici e calcolo degli indici semantici, tramite l'API Gemini
                  </TableCell>
                  <TableCell>Stati Uniti</TableCell>
                </TableRow>
              </TableBody>
            </Table>

            <p className="text-muted-foreground mt-4">
              Non usiamo alcun fornitore di pagamenti, alcuna piattaforma pubblicitaria, alcuno strumento di
              analisi del traffico e alcun servizio di chat o di invio email integrato nel prodotto.
            </p>
          </section>

          {/* Section 5 */}
          <section className="mb-8">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2 rounded-lg bg-primary/10">
                <Brain className="h-5 w-5 text-primary" />
              </div>
              <h2 className="text-2xl font-bold m-0">5. Trattamento mediante intelligenza artificiale</h2>
            </div>
            <Separator className="mb-4" />

            <h3 className="text-lg font-semibold mb-3">5.1 Cosa viene inviato al modello</h3>
            <p className="text-muted-foreground mb-4">
              Per verificare un obbligo, la piattaforma invia all'API di Google porzioni del testo dei documenti
              che hai caricato, insieme al testo dell'obbligo da verificare. Lo stesso vale per le domande poste
              all'assistente e per la generazione dei documenti. Se i tuoi documenti contengono dati personali,
              quelle porzioni contengono dati personali.
            </p>
            <p className="text-muted-foreground mb-4">
              Il fornitore tratta questi contenuti come responsabile, per la sola esecuzione della richiesta.
              RegBrain non autorizza alcun uso diverso, compreso l'addestramento di modelli.
            </p>

            <h3 className="text-lg font-semibold mb-3 mt-6">5.2 Nessuna decisione automatizzata</h3>
            <p className="text-muted-foreground mb-4">
              Gli esiti prodotti dalla piattaforma non sono decisioni automatizzate ai sensi dell'articolo 22 del
              GDPR: non producono effetti giuridici né incidono in modo analogamente significativo su una persona.
              Sono elaborazioni che devono essere verificate e assunte da chi è responsabile della conformità.
            </p>

            <h3 className="text-lg font-semibold mb-3 mt-6">5.3 Revisione umana</h3>
            <p className="text-muted-foreground">
              Ogni esito riporta le citazioni testuali su cui si fonda, così da poter essere controllato alla
              fonte. Puoi comunque chiedere una revisione scrivendo a {companyEmail}.
            </p>
          </section>

          {/* Section 6 */}
          <section className="mb-8">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2 rounded-lg bg-primary/10">
                <Globe className="h-5 w-5 text-primary" />
              </div>
              <h2 className="text-2xl font-bold m-0">6. Trasferimenti fuori dall'Unione Europea</h2>
            </div>
            <Separator className="mb-4" />

            <p className="text-muted-foreground mb-4">
              La banca dati, l'archivio dei documenti e l'esecuzione delle analisi restano nell'Unione Europea,
              in Irlanda. Escono dall'Unione Europea due flussi:
            </p>
            <ul className="list-disc pl-6 space-y-2 text-muted-foreground">
              <li>
                le porzioni di testo inviate all'API di Google per l'analisi e per il calcolo degli indici
                semantici;
              </li>
              <li>
                il traffico web verso la rete di distribuzione di Vercel, che serve le pagine e instrada le
                chiamate.
              </li>
            </ul>
            <p className="text-muted-foreground mt-4">
              Entrambi i trasferimenti avvengono sulla base delle clausole contrattuali tipo adottate dalla
              Commissione europea, previste dalle condizioni per il trattamento dei dati dei due fornitori.
            </p>
          </section>

          {/* Section 7 */}
          <section className="mb-8">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2 rounded-lg bg-primary/10">
                <Lock className="h-5 w-5 text-primary" />
              </div>
              <h2 className="text-2xl font-bold m-0">7. I tuoi diritti</h2>
            </div>
            <Separator className="mb-4" />

            <p className="text-muted-foreground mb-4">
              Ai sensi degli articoli da 15 a 22 del GDPR hai diritto di:
            </p>

            <div className="grid md:grid-cols-2 gap-4">
              {[
                { title: "Accesso", desc: "Ottenere conferma del trattamento e copia dei dati" },
                { title: "Rettifica", desc: "Correggere dati inesatti o incompleti" },
                { title: "Cancellazione", desc: "Ottenere la cancellazione dei dati" },
                { title: "Limitazione", desc: "Limitare il trattamento nei casi previsti" },
                { title: "Portabilità", desc: "Ricevere i dati in formato strutturato e leggibile" },
                { title: "Opposizione", desc: "Opporti al trattamento fondato sul legittimo interesse" },
              ].map((right, index) => (
                <div key={index} className="bg-muted/50 rounded-lg p-4">
                  <h4 className="font-semibold mb-1">{right.title}</h4>
                  <p className="text-sm text-muted-foreground m-0">{right.desc}</p>
                </div>
              ))}
            </div>

            <p className="text-muted-foreground mt-4">
              Le richieste vanno inviate a <a href={`mailto:${companyEmail}`} className="text-primary">{companyEmail}</a>{" "}
              e ricevono risposta entro un mese, prorogabile di due mesi nei casi previsti dall'articolo 12.
            </p>
            <p className="text-muted-foreground">
              Hai inoltre diritto di proporre reclamo al Garante per la protezione dei dati personali
              (<a href="https://www.garanteprivacy.it" className="text-primary" target="_blank" rel="noopener noreferrer">www.garanteprivacy.it</a>).
            </p>
          </section>

          {/* Section 8 */}
          <section className="mb-8">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2 rounded-lg bg-primary/10">
                <Shield className="h-5 w-5 text-primary" />
              </div>
              <h2 className="text-2xl font-bold m-0">8. Misure di sicurezza</h2>
            </div>
            <Separator className="mb-4" />

            <p className="text-muted-foreground mb-4">
              Le misure effettivamente attive sono queste:
            </p>

            <ul className="list-disc pl-6 space-y-2 text-muted-foreground">
              <li>
                <strong>Separazione dei dati fra account:</strong> tutte le tabelle della banca dati hanno le
                regole di sicurezza a livello di riga attive, così che ogni account veda solo i propri dati.
              </li>
              <li>
                <strong>Archivio documenti non pubblico:</strong> i file caricati non sono raggiungibili da un
                indirizzo web pubblico e hanno un limite di dimensione per file.
              </li>
              <li>
                <strong>Cifratura:</strong> traffico cifrato in transito con TLS e dati cifrati a riposo dal
                fornitore di infrastruttura.
              </li>
              <li>
                <strong>Credenziali:</strong> password conservate come hash bcrypt dal servizio di
                autenticazione, mai in chiaro. Chiavi dei fornitori conservate nel gestore dei segreti e mai
                esposte al browser.
              </li>
              <li>
                <strong>Accesso riservato:</strong> nella fase attuale il sito è protetto da una password di
                accesso e la piattaforma richiede un account.
              </li>
            </ul>

            <div className="bg-amber-500/10 border border-amber-500/20 rounded-lg p-4 mt-4">
              <p className="text-sm text-muted-foreground m-0">
                <strong>Quello che ancora non c'è:</strong> l'autenticazione a più fattori non è disponibile e
                non esiste un registro applicativo degli accessi consultabile dall'utente. Le diciamo qui invece
                di ometterle: sono limiti noti, non misure implicite.
              </p>
            </div>
          </section>

          {/* Section 9 */}
          <section className="mb-8">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2 rounded-lg bg-primary/10">
                <Clock className="h-5 w-5 text-primary" />
              </div>
              <h2 className="text-2xl font-bold m-0">9. Cancellazione dei dati</h2>
            </div>
            <Separator className="mb-4" />

            <p className="text-muted-foreground mb-4">
              Puoi chiedere in qualsiasi momento la cancellazione dell'account scrivendo all'indirizzo di
              contatto. Alla cancellazione vengono rimossi il profilo, le valutazioni, i documenti caricati, i
              risultati delle analisi e lo storico delle domande all'assistente.
            </p>
            <p className="text-muted-foreground">
              Restano solo i dati che siamo tenuti a conservare per obbligo di legge, come la documentazione
              contabile dei clienti sotto contratto, e i registri tecnici dei fornitori fino alla loro naturale
              scadenza.
            </p>
          </section>

          {/* Section 10 */}
          <section className="mb-8">
            <h2 className="text-2xl font-bold mb-4">10. Minori</h2>
            <Separator className="mb-4" />

            <p className="text-muted-foreground">
              Il servizio si rivolge a professionisti e organizzazioni e non è destinato a minori di diciotto
              anni. Non raccogliamo consapevolmente dati di minori.
            </p>
          </section>

          {/* Section 11 */}
          <section className="mb-8">
            <h2 className="text-2xl font-bold mb-4">11. Modifiche</h2>
            <Separator className="mb-4" />

            <p className="text-muted-foreground">
              Questa informativa viene aggiornata quando cambia il modo in cui il prodotto tratta i dati. La data
              in alto indica l'ultima revisione. Le modifiche sostanziali vengono comunicate via email agli
              utenti registrati con almeno trenta giorni di anticipo.
            </p>
          </section>

          {/* Contact */}
          <section className="bg-muted/50 rounded-lg p-6 mt-12">
            <div className="flex items-center gap-3 mb-4">
              <Mail className="h-5 w-5 text-primary" />
              <h2 className="text-xl font-bold m-0">Contatti</h2>
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
