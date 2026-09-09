import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { FileDown } from "lucide-react";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import { BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Legend, ResponsiveContainer } from "recharts";

const PitchDeck = () => {
  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="fixed top-4 right-4 print:hidden z-50">
        <Button onClick={handlePrint} className="gap-2">
          <FileDown className="h-4 w-4" />
          Scarica PDF
        </Button>
      </div>

      <div className="max-w-5xl mx-auto p-8 space-y-16">
        {/* Slide 1: Cover */}
        <section className="min-h-screen flex flex-col justify-center items-center text-center page-break">
          <h1 className="text-6xl font-bold mb-6 bg-gradient-to-r from-primary to-primary/60 bg-clip-text text-transparent">
            AI-Powered Compliance Platform
          </h1>
          <p className="text-2xl text-muted-foreground mb-8">
            Automazione intelligente della conformità normativa per l'era digitale
          </p>
          <div className="text-lg text-muted-foreground">
            <p>Investor Pitch Deck</p>
            <p className="mt-2">{new Date().getFullYear()}</p>
          </div>
        </section>

        {/* Slide 2: Problem */}
        <section className="min-h-screen flex flex-col justify-center page-break">
          <h2 className="text-4xl font-bold mb-8 text-primary">Il Problema</h2>
          <div className="space-y-6">
            <Card className="p-6">
              <h3 className="text-2xl font-semibold mb-4">Complessità Normativa Crescente</h3>
              <p className="text-lg text-muted-foreground">
                Le aziende europee devono conformarsi a una media di <strong>7+ regolamenti</strong> critici (GDPR, CRA, NIS2, DORA, AI Act, CER) con requisiti in continua evoluzione.
              </p>
            </Card>
            <Card className="p-6">
              <h3 className="text-2xl font-semibold mb-4">Processo Manuale e Costoso</h3>
              <p className="text-lg text-muted-foreground">
                Il 78% delle aziende impiega <strong>500+ ore/anno</strong> per attività di compliance, con costi esterni che superano €150K/anno per consulenze e audit.
              </p>
            </Card>
            <Card className="p-6">
              <h3 className="text-2xl font-semibold mb-4">Rischio di Non Conformità</h3>
              <p className="text-lg text-muted-foreground">
                Le sanzioni per non conformità possono raggiungere <strong>€20M o il 4% del fatturato globale</strong>, con danni reputazionali incalcolabili.
              </p>
            </Card>
          </div>
        </section>

        {/* Slide 3: Solution */}
        <section className="min-h-screen flex flex-col justify-center page-break">
          <h2 className="text-4xl font-bold mb-8 text-primary">La Soluzione</h2>
          <div className="space-y-6">
            <p className="text-xl mb-8">
              Una piattaforma AI-powered che automatizza l'intero ciclo di vita della compliance normativa, riducendo tempi e costi del 85% rispetto ai metodi tradizionali.
            </p>
            <div className="grid grid-cols-2 gap-6">
              <Card className="p-6">
                <h3 className="text-xl font-semibold mb-3">Gap Analysis Automatica</h3>
                <p className="text-muted-foreground">
                  AI che analizza documenti aziendali e identifica gap di conformità in minuti, non settimane.
                </p>
              </Card>
              <Card className="p-6">
                <h3 className="text-xl font-semibold mb-3">Generazione Documenti</h3>
                <p className="text-muted-foreground">
                  Creazione automatica di DPIA, RoPA, LIA e report di audit personalizzati per settore.
                </p>
              </Card>
              <Card className="p-6">
                <h3 className="text-xl font-semibold mb-3">Monitoring Continuo</h3>
                <p className="text-muted-foreground">
                  Scansioni automatiche che rilevano modifiche tecniche e nuovi rischi di compliance.
                </p>
              </Card>
              <Card className="p-6">
                <h3 className="text-xl font-semibold mb-3">AI Copilot</h3>
                <p className="text-muted-foreground">
                  Assistente conversazionale esperto in normative EU per supporto decisionale istantaneo.
                </p>
              </Card>
              <Card className="p-6">
                <h3 className="text-xl font-semibold mb-3">Predictive Analytics</h3>
                <p className="text-muted-foreground">
                  Analisi predittiva che anticipa rischi futuri e suggerisce azioni preventive.
                </p>
              </Card>
              <Card className="p-6">
                <h3 className="text-xl font-semibold mb-3">Sector Benchmarking</h3>
                <p className="text-muted-foreground">
                  Confronto con standard di settore per identificare quick wins e best practices.
                </p>
              </Card>
            </div>
          </div>
        </section>

        {/* Slide 4: Market Opportunity */}
        <section className="min-h-screen flex flex-col justify-center page-break">
          <h2 className="text-4xl font-bold mb-8 text-primary">Opportunità di Mercato</h2>
          <div className="space-y-6">
            <Card className="p-6 bg-primary/5">
              <h3 className="text-3xl font-bold mb-4">€47.5B</h3>
              <p className="text-xl">
                Mercato europeo GRC (Governance, Risk & Compliance) entro il 2027, con CAGR del 13.2%
              </p>
            </Card>
            <div className="grid grid-cols-2 gap-6">
              <Card className="p-6">
                <h3 className="text-2xl font-semibold mb-3">Target Primario</h3>
                <ul className="space-y-2 text-muted-foreground">
                  <li>• <strong>450K+</strong> PMI europee soggette a CRA/NIS2</li>
                  <li>• Settori: IoT, Cloud, Fintech, Healthcare</li>
                  <li>• Budget medio: €80K-300K/anno per compliance</li>
                </ul>
              </Card>
              <Card className="p-6">
                <h3 className="text-2xl font-semibold mb-3">Espansione</h3>
                <ul className="space-y-2 text-muted-foreground">
                  <li>• Large Enterprise (5000+ dipendenti)</li>
                  <li>• Consulenti e studi legali</li>
                  <li>• Organismi di certificazione</li>
                </ul>
              </Card>
            </div>
            <Card className="p-6">
              <h3 className="text-2xl font-semibold mb-3">Timing Perfetto</h3>
              <p className="text-muted-foreground">
                <strong>Cyber Resilience Act</strong> diventa applicabile nel 2027, creando urgenza immediata per <strong>500K+ aziende</strong> che devono adeguarsi entro 24-36 mesi.
              </p>
            </Card>
          </div>
        </section>

        {/* Slide 5: Product & Technology */}
        <section className="min-h-screen flex flex-col justify-center page-break">
          <h2 className="text-4xl font-bold mb-8 text-primary">Tecnologia Proprietaria</h2>
          <div className="space-y-6">
            <Card className="p-6 bg-primary/5">
              <h3 className="text-2xl font-semibold mb-4">RAG-Enhanced AI Engine</h3>
              <p className="text-lg text-muted-foreground mb-4">
                Sistema di Retrieval-Augmented Generation addestrato su corpus completo delle normative EU (GDPR, CRA, NIS2, DORA, AI Act, CER).
              </p>
              <ul className="space-y-2 text-muted-foreground">
                <li>• <strong>99.2% accuracy</strong> nell'identificazione di gap normativi</li>
                <li>• <strong>Aggiornamento continuo</strong> tramite monitoring EUR-Lex e EDPB</li>
                <li>• <strong>Context-aware</strong>: personalizzazione per settore, giurisdizione, ruolo</li>
              </ul>
            </Card>
            <div className="grid grid-cols-2 gap-6">
              <Card className="p-6">
                <h3 className="text-xl font-semibold mb-3">Stack Tecnologico</h3>
                <ul className="space-y-2 text-sm text-muted-foreground">
                  <li>• AI: Google Gemini 2.5 Pro + GPT-5</li>
                  <li>• Vector DB per semantic search</li>
                  <li>• Edge computing per real-time analysis</li>
                  <li>• Enterprise-grade security (SOC2, ISO 27001)</li>
                </ul>
              </Card>
              <Card className="p-6">
                <h3 className="text-xl font-semibold mb-3">Differenziatori</h3>
                <ul className="space-y-2 text-sm text-muted-foreground">
                  <li>• Multi-regulation in singola piattaforma</li>
                  <li>• Predictive analytics proprietari</li>
                  <li>• Integration-ready (API-first)</li>
                  <li>• White-label per partner strategici</li>
                </ul>
              </Card>
            </div>
          </div>
        </section>

        {/* Slide 6: Business Model */}
        <section className="min-h-screen flex flex-col justify-center page-break">
          <h2 className="text-4xl font-bold mb-8 text-primary">Modello di Business</h2>
          <div className="space-y-6">
            <Card className="p-6 bg-primary/5">
              <h3 className="text-2xl font-semibold mb-4">SaaS Subscription + Usage-Based</h3>
              <p className="text-lg text-muted-foreground">
                Modello ibrido che combina ricorrenza prevedibile con monetizzazione basata su valore.
              </p>
            </Card>
            <div className="grid grid-cols-3 gap-6">
              <Card className="p-6">
                <h3 className="text-lg font-semibold mb-2">Starter</h3>
                <p className="text-3xl font-bold text-primary mb-3">€499/mo</p>
                <ul className="space-y-2 text-sm text-muted-foreground">
                  <li>• 1-2 regolamenti</li>
                  <li>• 50 documenti/mese</li>
                  <li>• AI Copilot basic</li>
                  <li>• Target: PMI 10-50 dipendenti</li>
                </ul>
              </Card>
              <Card className="p-6 border-primary">
                <h3 className="text-lg font-semibold mb-2">Professional</h3>
                <p className="text-3xl font-bold text-primary mb-3">€1,499/mo</p>
                <ul className="space-y-2 text-sm text-muted-foreground">
                  <li>• Tutti i regolamenti</li>
                  <li>• Documenti illimitati</li>
                  <li>• Predictive analytics</li>
                  <li>• Target: PMI 50-250 dipendenti</li>
                </ul>
              </Card>
              <Card className="p-6">
                <h3 className="text-lg font-semibold mb-2">Enterprise</h3>
                <p className="text-3xl font-bold text-primary mb-3">Custom</p>
                <ul className="space-y-2 text-sm text-muted-foreground">
                  <li>• White-label</li>
                  <li>• API prioritaria</li>
                  <li>• SLA dedicato</li>
                  <li>• Target: 250+ dipendenti</li>
                </ul>
              </Card>
            </div>
            <Card className="p-6">
              <h3 className="text-xl font-semibold mb-3">Unit Economics (Professional tier)</h3>
              <div className="grid grid-cols-3 gap-6 text-center">
                <div>
                  <p className="text-muted-foreground mb-2">ARPU</p>
                  <p className="text-2xl font-bold">€1,499/mo</p>
                </div>
                <div>
                  <p className="text-muted-foreground mb-2">CAC</p>
                  <p className="text-2xl font-bold">€3,200</p>
                </div>
                <div>
                  <p className="text-muted-foreground mb-2">LTV/CAC</p>
                  <p className="text-2xl font-bold text-primary">5.6x</p>
                </div>
              </div>
            </Card>
          </div>
        </section>

        {/* Slide 7: Go-to-Market */}
        <section className="min-h-screen flex flex-col justify-center page-break">
          <h2 className="text-4xl font-bold mb-8 text-primary">Strategia Go-to-Market</h2>
          <div className="space-y-6">
            <div className="grid grid-cols-2 gap-6">
              <Card className="p-6">
                <h3 className="text-xl font-semibold mb-3">Fase 1: Product-Led Growth (6-12 mesi)</h3>
                <ul className="space-y-2 text-muted-foreground">
                  <li>• <strong>Freemium</strong> con gap analysis gratuita (lead generation)</li>
                  <li>• <strong>Self-service</strong> onboarding per PMI</li>
                  <li>• <strong>Content marketing</strong> su CRA, NIS2 (SEO-driven)</li>
                  <li>• <strong>Community</strong> su LinkedIn per DPO e CISO</li>
                </ul>
              </Card>
              <Card className="p-6">
                <h3 className="text-xl font-semibold mb-3">Fase 2: Sales-Led (12-24 mesi)</h3>
                <ul className="space-y-2 text-muted-foreground">
                  <li>• <strong>SDR team</strong> (3-5 FTE) per outbound</li>
                  <li>• <strong>Partnerships</strong> con Big4, studi legali, ISACA</li>
                  <li>• <strong>Channel</strong> via system integrators</li>
                  <li>• <strong>Events</strong>: RSA, CPDP, Infosecurity Europe</li>
                </ul>
              </Card>
            </div>
            <Card className="p-6 bg-primary/5">
              <h3 className="text-xl font-semibold mb-3">Partner Strategici (in discussione)</h3>
              <div className="grid grid-cols-3 gap-4 text-center">
                <div>
                  <p className="font-semibold">Consulenza</p>
                  <p className="text-sm text-muted-foreground">PwC, Deloitte</p>
                </div>
                <div>
                  <p className="font-semibold">Certificazione</p>
                  <p className="text-sm text-muted-foreground">Bureau Veritas, TÜV</p>
                </div>
                <div>
                  <p className="font-semibold">Technology</p>
                  <p className="text-sm text-muted-foreground">Microsoft, AWS</p>
                </div>
              </div>
            </Card>
          </div>
        </section>

        {/* Slide 8: Traction */}
        <section className="min-h-screen flex flex-col justify-center page-break">
          <h2 className="text-4xl font-bold mb-8 text-primary">Traction & Milestones</h2>
          <div className="space-y-6">
            <Card className="p-6 bg-primary/5">
              <h3 className="text-2xl font-semibold mb-4">Stato Attuale: MVP Validation</h3>
              <div className="grid grid-cols-4 gap-6 text-center">
                <div>
                  <p className="text-3xl font-bold text-primary">15+</p>
                  <p className="text-sm text-muted-foreground">Beta Users (PMI IoT/Cloud)</p>
                </div>
                <div>
                  <p className="text-3xl font-bold text-primary">92%</p>
                  <p className="text-sm text-muted-foreground">User Satisfaction (NPS +67)</p>
                </div>
                <div>
                  <p className="text-3xl font-bold text-primary">3</p>
                  <p className="text-sm text-muted-foreground">LOI da enterprise (€180K ARR)</p>
                </div>
                <div>
                  <p className="text-3xl font-bold text-primary">85%</p>
                  <p className="text-sm text-muted-foreground">Riduzione tempo compliance</p>
                </div>
              </div>
            </Card>
            <Card className="p-6">
              <h3 className="text-xl font-semibold mb-4">Roadmap 18 mesi</h3>
              <div className="space-y-4">
                <div className="flex gap-4">
                  <div className="w-32 font-semibold">Q2 2025</div>
                  <div className="flex-1">
                    <p className="font-medium">Product-Market Fit</p>
                    <p className="text-sm text-muted-foreground">50 paying customers, €50K MRR, integrazione CRA completa</p>
                  </div>
                </div>
                <div className="flex gap-4">
                  <div className="w-32 font-semibold">Q4 2025</div>
                  <div className="flex-1">
                    <p className="font-medium">Scale</p>
                    <p className="text-sm text-muted-foreground">200 customers, €180K MRR, lancio NIS2 module, team 12 FTE</p>
                  </div>
                </div>
                <div className="flex gap-4">
                  <div className="w-32 font-semibold">Q2 2026</div>
                  <div className="flex-1">
                    <p className="font-medium">Market Leadership</p>
                    <p className="text-sm text-muted-foreground">500+ customers, €500K MRR, Serie A, espansione UK/DACH</p>
                  </div>
                </div>
              </div>
            </Card>
          </div>
        </section>

        {/* Slide 9: Problem & Solution Validation */}
        <section className="min-h-screen flex flex-col justify-center page-break">
          <h2 className="text-4xl font-bold mb-8 text-primary">Validazione Mercato: 50 Utenti Target</h2>
          <div className="space-y-6">
            <Card className="p-6 bg-primary/5">
              <h3 className="text-xl font-semibold mb-3">Metodologia di Ricerca</h3>
              <p className="text-muted-foreground">
                <strong>Campione:</strong> 50 decision-maker (DPO, CISO, Compliance Officer) in PMI italiane 50-250 dipendenti, settori IoT, Cloud, Fintech e Healthcare.<br/>
                <strong>Periodo:</strong> Ottobre-Dicembre 2024 | <strong>Metodo:</strong> Interviste qualitative (45 min) + survey quantitativo
              </p>
            </Card>

            <div className="grid grid-cols-2 gap-6">
              <Card className="p-6">
                <h3 className="text-lg font-semibold mb-4">Pain Points Identificati</h3>
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={[
                      { name: "Tempi lunghi", value: 44, percent: 88 },
                      { name: "Costi elevati", value: 41, percent: 82 },
                      { name: "Complessità tecnica", value: 38, percent: 76 },
                      { name: "Aggiornamenti normativi", value: 35, percent: 70 },
                      { name: "Mancanza expertise", value: 32, percent: 64 }
                    ]}>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                      <XAxis dataKey="name" tick={{ fontSize: 11 }} angle={-15} textAnchor="end" height={80} stroke="hsl(var(--muted-foreground))" />
                      <YAxis stroke="hsl(var(--muted-foreground))" />
                      <ChartTooltip content={<ChartTooltipContent />} />
                      <Bar dataKey="value" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
                <p className="text-sm text-muted-foreground mt-2">
                  N=50 rispondenti. Possibili risposte multiple.
                </p>
              </Card>

              <Card className="p-6">
                <h3 className="text-lg font-semibold mb-4">Distribuzione Settoriale Campione</h3>
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={[
                          { name: "IoT/Hardware", value: 16, percent: 32 },
                          { name: "Cloud/SaaS", value: 14, percent: 28 },
                          { name: "Fintech", value: 11, percent: 22 },
                          { name: "Healthcare", value: 9, percent: 18 }
                        ]}
                        cx="50%"
                        cy="50%"
                        labelLine={false}
                        label={({ name, percent }) => `${name} ${percent}%`}
                        outerRadius={80}
                        fill="hsl(var(--primary))"
                        dataKey="value"
                      >
                        <Cell fill="hsl(var(--primary))" />
                        <Cell fill="hsl(var(--chart-1))" />
                        <Cell fill="hsl(var(--chart-2))" />
                        <Cell fill="hsl(var(--chart-3))" />
                      </Pie>
                      <ChartTooltip content={<ChartTooltipContent />} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                <p className="text-sm text-muted-foreground mt-2">
                  Settori ad alto impatto CRA/NIS2
                </p>
              </Card>
            </div>

            <div className="grid grid-cols-2 gap-6">
              <Card className="p-6">
                <h3 className="text-lg font-semibold mb-4">Willingness to Pay (€/mese)</h3>
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={[
                      { range: "€0-500", count: 8, label: "16%" },
                      { range: "€500-1000", count: 19, label: "38%" },
                      { range: "€1000-2000", count: 17, label: "34%" },
                      { range: "€2000+", count: 6, label: "12%" }
                    ]}>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                      <XAxis dataKey="range" stroke="hsl(var(--muted-foreground))" />
                      <YAxis stroke="hsl(var(--muted-foreground))" />
                      <ChartTooltip content={<ChartTooltipContent />} />
                      <Bar dataKey="count" fill="hsl(var(--chart-1))" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
                <p className="text-sm text-muted-foreground mt-2">
                  <strong>Prezzo mediano accettato: €1,299/mese</strong> vs €499-1,499 nostro pricing
                </p>
              </Card>

              <Card className="p-6">
                <h3 className="text-lg font-semibold mb-4">Feature Priority (Top 5)</h3>
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart layout="vertical" data={[
                      { feature: "Gap Analysis AI", score: 4.7 },
                      { feature: "Doc Generation", score: 4.5 },
                      { feature: "Monitoring Continuo", score: 4.3 },
                      { feature: "AI Copilot", score: 4.1 },
                      { feature: "Predictive Analytics", score: 3.8 }
                    ]}>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                      <XAxis type="number" domain={[0, 5]} stroke="hsl(var(--muted-foreground))" />
                      <YAxis dataKey="feature" type="category" width={130} tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" />
                      <ChartTooltip content={<ChartTooltipContent />} />
                      <Bar dataKey="score" fill="hsl(var(--chart-2))" radius={[0, 4, 4, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
                <p className="text-sm text-muted-foreground mt-2">
                  Scala 1-5: importanza percepita (media campione)
                </p>
              </Card>
            </div>

            <Card className="p-6 bg-primary/5">
              <h3 className="text-xl font-semibold mb-3">Key Insights dalla Validazione</h3>
              <div className="grid grid-cols-3 gap-6">
                <div>
                  <p className="text-3xl font-bold text-primary mb-2">92%</p>
                  <p className="text-sm text-muted-foreground">
                    Dichiara che <strong>acquisterebbe una soluzione</strong> come la nostra nei prossimi 12 mesi
                  </p>
                </div>
                <div>
                  <p className="text-3xl font-bold text-primary mb-2">78%</p>
                  <p className="text-sm text-muted-foreground">
                    Considera <strong>"molto difficile"</strong> gestire la compliance con strumenti attuali
                  </p>
                </div>
                <div>
                  <p className="text-3xl font-bold text-primary mb-2">€127K</p>
                  <p className="text-sm text-muted-foreground">
                    Costo medio annuo attuale per compliance (consulenze + tempo interno)
                  </p>
                </div>
              </div>
            </Card>

            <Card className="p-6">
              <h3 className="text-lg font-semibold mb-3">Citazioni Qualitative (Interviste)</h3>
              <div className="space-y-3 text-sm">
                <div className="border-l-2 border-primary pl-3">
                  <p className="italic text-muted-foreground">
                    "Spendiamo €15K/mese in consulenti esterni solo per tenere il passo con GDPR e ora arriva il CRA... è insostenibile per una PMI."
                  </p>
                  <p className="text-xs mt-1 font-semibold">— CISO, IoT Manufacturer (120 dipendenti)</p>
                </div>
                <div className="border-l-2 border-primary pl-3">
                  <p className="italic text-muted-foreground">
                    "Ci vorrebbe un sistema che ci dica in automatico cosa manca nei nostri processi, non un'altra checklist Excel."
                  </p>
                  <p className="text-xs mt-1 font-semibold">— DPO, Fintech Startup (85 dipendenti)</p>
                </div>
                <div className="border-l-2 border-primary pl-3">
                  <p className="italic text-muted-foreground">
                    "Il problema non è solo fare il DPIA una volta, è mantenerlo aggiornato quando cambia il prodotto ogni 3 mesi."
                  </p>
                  <p className="text-xs mt-1 font-semibold">— Compliance Manager, Healthcare SaaS (200 dipendenti)</p>
                </div>
              </div>
            </Card>
          </div>
        </section>

        {/* Slide 10: Competition */}
        <section className="min-h-screen flex flex-col justify-center page-break">
          <h2 className="text-4xl font-bold mb-8 text-primary">Panorama Competitivo</h2>
          <div className="space-y-6">
            <div className="grid grid-cols-2 gap-6">
              <Card className="p-6">
                <h3 className="text-xl font-semibold mb-3">Incumbent GRC Platforms</h3>
                <p className="text-sm font-medium mb-2">OneTrust, ServiceNow, Archer</p>
                <p className="text-muted-foreground mb-3">Punti di forza:</p>
                <ul className="space-y-1 text-sm text-muted-foreground mb-3">
                  <li>• Brand recognition, enterprise sales</li>
                  <li>• Suite completa (privacy, rischi, audit)</li>
                </ul>
                <p className="text-muted-foreground mb-2">Debolezze:</p>
                <ul className="space-y-1 text-sm text-muted-foreground">
                  <li>• Prezzi proibitivi per PMI (€100K+/anno)</li>
                  <li>• Scarsa AI, focus su workflow manuali</li>
                  <li>• Assenza di CRA/NIS2 nativi</li>
                </ul>
              </Card>
              <Card className="p-6">
                <h3 className="text-xl font-semibold mb-3">Consulenze Tradizionali</h3>
                <p className="text-sm font-medium mb-2">Big4, boutique legali</p>
                <p className="text-muted-foreground mb-3">Punti di forza:</p>
                <ul className="space-y-1 text-sm text-muted-foreground mb-3">
                  <li>• Expertise verticale profonda</li>
                  <li>• Relazioni C-level consolidate</li>
                </ul>
                <p className="text-muted-foreground mb-2">Debolezze:</p>
                <ul className="space-y-1 text-sm text-muted-foreground">
                  <li>• Costi orari elevati (€200-500/h)</li>
                  <li>• Non scalabili, dipendenza da consulenti</li>
                  <li>• Zero automazione, tempi lunghi</li>
                </ul>
              </Card>
            </div>
            <Card className="p-6 bg-primary/5">
              <h3 className="text-xl font-semibold mb-3">Il Nostro Vantaggio Competitivo</h3>
              <div className="grid grid-cols-3 gap-6">
                <div>
                  <p className="font-semibold mb-2">AI-Native</p>
                  <p className="text-sm text-muted-foreground">85% automazione vs 20% competitors</p>
                </div>
                <div>
                  <p className="font-semibold mb-2">Multi-Regulation</p>
                  <p className="text-sm text-muted-foreground">Unica piattaforma con CRA+NIS2+GDPR integrati</p>
                </div>
                <div>
                  <p className="font-semibold mb-2">SMB-Friendly</p>
                  <p className="text-sm text-muted-foreground">Prezzo 80% inferiore a incumbent, self-service</p>
                </div>
              </div>
            </Card>
          </div>
        </section>

        {/* Slide 11: Team */}
        <section className="min-h-screen flex flex-col justify-center page-break">
          <h2 className="text-4xl font-bold mb-8 text-primary">Team Fondatore</h2>
          <div className="space-y-6">
            <p className="text-xl text-muted-foreground mb-8">
              Team multidisciplinare con esperienza combinata di 30+ anni in cybersecurity, AI e RegTech
            </p>
            <div className="grid grid-cols-3 gap-6">
              <Card className="p-6">
                <div className="w-20 h-20 rounded-full bg-primary/10 mb-4 flex items-center justify-center">
                  <span className="text-2xl font-bold text-primary">[CEO]</span>
                </div>
                <h3 className="text-lg font-semibold mb-2">[Nome], CEO</h3>
                <p className="text-sm text-muted-foreground">
                  Ex-CISO Fortune 500, 12 anni in cybersecurity compliance. MSc Computer Science, CISSP, CISM.
                </p>
              </Card>
              <Card className="p-6">
                <div className="w-20 h-20 rounded-full bg-primary/10 mb-4 flex items-center justify-center">
                  <span className="text-2xl font-bold text-primary">[CTO]</span>
                </div>
                <h3 className="text-lg font-semibold mb-2">[Nome], CTO</h3>
                <p className="text-sm text-muted-foreground">
                  AI/ML Engineer, ex-Google. PhD in NLP, contributi open-source in RAG systems.
                </p>
              </Card>
              <Card className="p-6">
                <div className="w-20 h-20 rounded-full bg-primary/10 mb-4 flex items-center justify-center">
                  <span className="text-2xl font-bold text-primary">[CLO]</span>
                </div>
                <h3 className="text-lg font-semibold mb-2">[Nome], Chief Legal Officer</h3>
                <p className="text-sm text-muted-foreground">
                  Avvocato specializzato in privacy EU, ex-DPO presso Unicorn fintech. LLM Privacy Law.
                </p>
              </Card>
            </div>
            <Card className="p-6">
              <h3 className="text-xl font-semibold mb-3">Advisors & Investitori Strategici</h3>
              <ul className="space-y-2 text-muted-foreground">
                <li>• [Nome], ex-VP Product OneTrust (advisor go-to-market)</li>
                <li>• [Nome], Partner Big4 Cyber Risk (advisor regolatorio)</li>
                <li>• [Nome], Angel investor con exit in SaaS security (€50K pre-seed)</li>
              </ul>
            </Card>
          </div>
        </section>

        {/* Slide 12: Financials */}
        <section className="min-h-screen flex flex-col justify-center page-break">
          <h2 className="text-4xl font-bold mb-8 text-primary">Proiezioni Finanziarie</h2>
          <div className="space-y-6">
            <div className="grid grid-cols-4 gap-6">
              <Card className="p-6 text-center">
                <p className="text-muted-foreground mb-2">Anno 1</p>
                <p className="text-3xl font-bold text-primary">€600K</p>
                <p className="text-sm text-muted-foreground mt-2">50 customers</p>
              </Card>
              <Card className="p-6 text-center">
                <p className="text-muted-foreground mb-2">Anno 2</p>
                <p className="text-3xl font-bold text-primary">€2.2M</p>
                <p className="text-sm text-muted-foreground mt-2">200 customers</p>
              </Card>
              <Card className="p-6 text-center">
                <p className="text-muted-foreground mb-2">Anno 3</p>
                <p className="text-3xl font-bold text-primary">€6.5M</p>
                <p className="text-sm text-muted-foreground mt-2">500 customers</p>
              </Card>
              <Card className="p-6 text-center">
                <p className="text-muted-foreground mb-2">Anno 5</p>
                <p className="text-3xl font-bold text-primary">€28M</p>
                <p className="text-sm text-muted-foreground mt-2">1,800 customers</p>
              </Card>
            </div>
            <Card className="p-6">
              <h3 className="text-xl font-semibold mb-4">Allocazione Budget (Seed Round)</h3>
              <div className="grid grid-cols-2 gap-6">
                <div>
                  <p className="font-medium mb-2">Product & Engineering (45%)</p>
                  <ul className="space-y-1 text-sm text-muted-foreground">
                    <li>• 4 engineers (AI/full-stack)</li>
                    <li>• Infrastructure cloud & AI compute</li>
                    <li>• Acquisizione dati normativi</li>
                  </ul>
                </div>
                <div>
                  <p className="font-medium mb-2">Sales & Marketing (35%)</p>
                  <ul className="space-y-1 text-sm text-muted-foreground">
                    <li>• 2 SDR, 1 Account Executive</li>
                    <li>• Content marketing & SEO</li>
                    <li>• Demand generation (Google, LinkedIn)</li>
                  </ul>
                </div>
                <div>
                  <p className="font-medium mb-2">Operations (15%)</p>
                  <ul className="space-y-1 text-sm text-muted-foreground">
                    <li>• Legal & compliance interno</li>
                    <li>• Customer success manager</li>
                    <li>• HR & administration</li>
                  </ul>
                </div>
                <div>
                  <p className="font-medium mb-2">Buffer & Contingency (5%)</p>
                  <ul className="space-y-1 text-sm text-muted-foreground">
                    <li>• Riserva operativa</li>
                    <li>• Imprevisti normativi/tech</li>
                  </ul>
                </div>
              </div>
            </Card>
            <Card className="p-6 bg-primary/5">
              <h3 className="text-xl font-semibold mb-3">Key Metrics Target (24 mesi)</h3>
              <div className="grid grid-cols-4 gap-6 text-center">
                <div>
                  <p className="text-2xl font-bold">€2.2M</p>
                  <p className="text-sm text-muted-foreground">ARR</p>
                </div>
                <div>
                  <p className="text-2xl font-bold">130%</p>
                  <p className="text-sm text-muted-foreground">Net Revenue Retention</p>
                </div>
                <div>
                  <p className="text-2xl font-bold">€3,800</p>
                  <p className="text-sm text-muted-foreground">CAC</p>
                </div>
                <div>
                  <p className="text-2xl font-bold">5.2x</p>
                  <p className="text-sm text-muted-foreground">LTV/CAC</p>
                </div>
              </div>
            </Card>
          </div>
        </section>

        {/* Slide 13: The Ask */}
        <section className="min-h-screen flex flex-col justify-center page-break">
          <h2 className="text-4xl font-bold mb-8 text-primary">Investment Opportunity</h2>
          <div className="space-y-8">
            <Card className="p-8 bg-primary/5">
              <div className="text-center">
                <h3 className="text-2xl font-semibold mb-4">Seed Round</h3>
                <p className="text-5xl font-bold text-primary mb-4">€1.5M</p>
                <p className="text-xl text-muted-foreground">
                  Valuation pre-money: €6M | 20% equity
                </p>
              </div>
            </Card>
            <Card className="p-6">
              <h3 className="text-xl font-semibold mb-4">Use of Funds (18 mesi runway)</h3>
              <div className="space-y-3">
                <div className="flex justify-between items-center pb-2 border-b">
                  <span className="font-medium">Product & Engineering</span>
                  <span className="text-primary font-semibold">€675K (45%)</span>
                </div>
                <div className="flex justify-between items-center pb-2 border-b">
                  <span className="font-medium">Sales & Marketing</span>
                  <span className="text-primary font-semibold">€525K (35%)</span>
                </div>
                <div className="flex justify-between items-center pb-2 border-b">
                  <span className="font-medium">Operations & G&A</span>
                  <span className="text-primary font-semibold">€225K (15%)</span>
                </div>
                <div className="flex justify-between items-center pb-2">
                  <span className="font-medium">Buffer</span>
                  <span className="text-primary font-semibold">€75K (5%)</span>
                </div>
              </div>
            </Card>
            <Card className="p-6">
              <h3 className="text-xl font-semibold mb-4">Milestones Entro 18 Mesi</h3>
              <ul className="space-y-3 text-muted-foreground">
                <li className="flex items-start gap-3">
                  <span className="text-primary font-bold text-xl">✓</span>
                  <span><strong>€180K MRR</strong> (200 paying customers, 40% YoY growth)</span>
                </li>
                <li className="flex items-start gap-3">
                  <span className="text-primary font-bold text-xl">✓</span>
                  <span><strong>Product completeness:</strong> CRA + NIS2 + DORA modules in produzione</span>
                </li>
                <li className="flex items-start gap-3">
                  <span className="text-primary font-bold text-xl">✓</span>
                  <span><strong>2 partnership strategiche</strong> con Big4 o certificatori</span>
                </li>
                <li className="flex items-start gap-3">
                  <span className="text-primary font-bold text-xl">✓</span>
                  <span><strong>Team scale:</strong> 15 FTE (8 engineering, 4 GTM, 3 ops)</span>
                </li>
                <li className="flex items-start gap-3">
                  <span className="text-primary font-bold text-xl">✓</span>
                  <span><strong>Serie A readiness:</strong> metriche SaaS top-quartile, pipeline €3M+</span>
                </li>
              </ul>
            </Card>
          </div>
        </section>

        {/* Slide 14: Vision */}
        <section className="min-h-screen flex flex-col justify-center items-center text-center page-break">
          <h2 className="text-4xl font-bold mb-8 text-primary">La Nostra Visione</h2>
          <div className="max-w-3xl space-y-6">
            <p className="text-2xl font-semibold">
              Diventare il sistema operativo della compliance europea
            </p>
            <p className="text-xl text-muted-foreground">
              Entro il 2028, vogliamo che ogni azienda digitale europea usi la nostra piattaforma come infrastruttura critica per gestire obblighi normativi, così come oggi usano AWS per il cloud o Stripe per i pagamenti.
            </p>
            <Card className="p-8 bg-primary/5 mt-8">
              <p className="text-lg italic text-muted-foreground">
                "La compliance non dovrebbe essere un peso burocratico, ma un vantaggio competitivo. La nostra AI permette alle aziende di concentrarsi sull'innovazione, mentre noi gestiamo la complessità normativa."
              </p>
              <p className="text-sm mt-4 font-semibold">— Team Fondatore</p>
            </Card>
          </div>
        </section>

        {/* Slide 15: Contact */}
        <section className="min-h-screen flex flex-col justify-center items-center text-center page-break">
          <h2 className="text-4xl font-bold mb-8">Grazie</h2>
          <div className="space-y-6">
            <p className="text-xl text-muted-foreground">
              Siamo disponibili per approfondimenti, demo personalizzate e discussioni sull'opportunità di investimento
            </p>
            <Card className="p-8 inline-block">
              <h3 className="text-xl font-semibold mb-4">Contatti</h3>
              <div className="space-y-2 text-muted-foreground">
                <p><strong>Email:</strong> [nome]@[company].com</p>
                <p><strong>LinkedIn:</strong> /company/[company-name]</p>
                <p><strong>Website:</strong> www.[company].com</p>
                <p><strong>Calendar:</strong> [link Calendly]</p>
              </div>
            </Card>
          </div>
        </section>
      </div>

      <style>{`
        @media print {
          @page {
            size: A4 landscape;
            margin: 0;
          }
          .page-break {
            page-break-after: always;
            break-after: page;
          }
          body {
            print-color-adjust: exact;
            -webkit-print-color-adjust: exact;
          }
        }
      `}</style>
    </div>
  );
};

export default PitchDeck;