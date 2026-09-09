import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Download, ArrowLeft, TrendingUp, Shield, Zap, DollarSign, Server, Database, Cloud, Users, FileText, BarChart3 } from "lucide-react";
import { useNavigate } from "react-router-dom";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

export default function InvestorPitch() {
  const navigate = useNavigate();

  const generatePDF = () => {
    const doc = new jsPDF();
    let yPosition = 20;

    // Header
    doc.setFontSize(24);
    doc.setFont("helvetica", "bold");
    doc.text("RegBrain - Analisi infrastrutturale tecnica", 105, yPosition, { align: "center" });
    
    yPosition += 10;
    doc.setFontSize(16);
    doc.text("Piano di evoluzione Cyber 4.0", 105, yPosition, { align: "center" });
    
    yPosition += 20;

    // Infrastruttura Attuale
    doc.setFontSize(18);
    doc.setFont("helvetica", "bold");
    doc.text("Infrastruttura attuale", 20, yPosition);
    yPosition += 8;
    
    doc.setFontSize(11);
    doc.setFont("helvetica", "normal");
    doc.text("RegBrain attualmente si appoggia su Lovable Cloud, una piattaforma full-stack", 20, yPosition);
    yPosition += 5;
    doc.text("che utilizza Supabase come backend. L'architettura comprende:", 20, yPosition);
    yPosition += 10;

    doc.setFontSize(14);
    doc.setFont("helvetica", "bold");
    doc.text("Stack tecnologico corrente:", 20, yPosition);
    yPosition += 8;

    doc.setFontSize(11);
    doc.setFont("helvetica", "normal");
    const currentStack = [
      "Frontend: React 18 + TypeScript + Vite + Tailwind CSS",
      "Backend: Supabase (PostgreSQL + Edge Functions + Storage + Auth)",
      "AI Integration: Lovable AI (accesso a modelli Google Gemini e OpenAI GPT)",
      "Database: PostgreSQL con estensione pgvector per RAG",
      "Edge Functions: 30+ funzioni serverless Deno per logica backend",
      "Storage: Supabase Storage per documenti normativi PDF",
      "Autenticazione: Supabase Auth con email/password"
    ];
    
    currentStack.forEach(item => {
      doc.text("• " + item, 25, yPosition);
      yPosition += 6;
    });

    yPosition += 8;
    doc.setFontSize(14);
    doc.setFont("helvetica", "bold");
    doc.text("Dipendenze esterne:", 20, yPosition);
    yPosition += 8;

    doc.setFontSize(11);
    doc.setFont("helvetica", "normal");
    const dependencies = [
      "Hosting: Lovable.app (frontend) + Supabase Cloud (backend)",
      "AI Models: Accesso tramite API Lovable AI",
      "Email: Resend API per notifiche",
      "Database: Supabase PostgreSQL managed"
    ];
    
    dependencies.forEach(item => {
      doc.text("• " + item, 25, yPosition);
      yPosition += 6;
    });

    yPosition += 8;
    doc.setFontSize(14);
    doc.setFont("helvetica", "bold");
    doc.text("Modelli AI specifici utilizzati:", 20, yPosition);
    yPosition += 8;

    doc.setFontSize(11);
    doc.setFont("helvetica", "normal");
    
    doc.setFont("helvetica", "bold");
    doc.text("Sistema RAG (Retrieval-Augmented Generation):", 25, yPosition);
    yPosition += 6;
    doc.setFont("helvetica", "normal");
    
    const ragSpecs = [
      "Modello principale: google/gemini-2.5-flash",
      "Embedding: pgvector con OpenAI text-embedding-3-small (1536 dimensioni)",
      "Context window: 128k tokens",
      "Retrieval strategy: similarity search su 50 chunks candidati",
      "Source diversification: round-robin da max 5 documenti per risposta",
      "Latenza media: <2s per query complessa"
    ];
    
    ragSpecs.forEach(item => {
      doc.text("  • " + item, 25, yPosition);
      yPosition += 5;
    });

    yPosition += 5;
    doc.setFont("helvetica", "bold");
    doc.text("Analisi conformita modelli ML (AI Sentinel):", 25, yPosition);
    yPosition += 6;
    doc.setFont("helvetica", "normal");
    
    const mlAnalysisSpecs = [
      "Modello: google/gemini-2.5-pro (massima accuratezza)",
      "Analisi statica: metadata extraction, provenance verification",
      "Analisi dinamica: dataset quality metrics, poisoning detection",
      "Output: trust score (0-100), risk level, compliance status",
      "Framework di riferimento: EU AI Act, ISO/IEC 42001, NIST AI RMF"
    ];
    
    mlAnalysisSpecs.forEach(item => {
      doc.text("  • " + item, 25, yPosition);
      yPosition += 5;
    });

    yPosition += 5;
    doc.setFont("helvetica", "bold");
    doc.text("Gap Analysis & Assessment:", 25, yPosition);
    yPosition += 6;
    doc.setFont("helvetica", "normal");
    
    const gapAnalysisSpecs = [
      "Modello: google/gemini-2.5-flash",
      "Analisi normativa: GDPR, NIS2, DORA, CRA, AI Act",
      "Output: gap identification, risk scoring prioritizzato, action plans",
      "Benchmark integration: confronto con dati settoriali ACN/ENISA"
    ];
    
    gapAnalysisSpecs.forEach(item => {
      doc.text("  • " + item, 25, yPosition);
      yPosition += 5;
    });

    // Migrazione a Infrastruttura Proprietaria
    doc.addPage();
    yPosition = 20;
    doc.setFontSize(18);
    doc.setFont("helvetica", "bold");
    doc.text("Migrazione a infrastruttura proprietaria", 20, yPosition);
    yPosition += 15;

    doc.setFontSize(14);
    doc.setFont("helvetica", "bold");
    doc.text("Obiettivi strategici:", 20, yPosition);
    yPosition += 8;

    doc.setFontSize(11);
    doc.setFont("helvetica", "normal");
    const objectives = [
      "Controllo totale su dati e infrastruttura",
      "Scalabilita illimitata senza vincoli di terze parti",
      "Compliance avanzata per clienti enterprise (GDPR, NIS2, ISO 27001)",
      "Riduzione costi a lungo termine con economia di scala",
      "White-label completo del prodotto"
    ];

    objectives.forEach(item => {
      doc.text("• " + item, 25, yPosition);
      yPosition += 6;
    });

    yPosition += 10;
    doc.setFontSize(14);
    doc.setFont("helvetica", "bold");
    doc.text("Componenti da implementare:", 20, yPosition);
    yPosition += 8;

    // 1. Database
    doc.setFontSize(12);
    doc.setFont("helvetica", "bold");
    doc.text("1. Database proprietario", 20, yPosition);
    yPosition += 6;
    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");
    doc.text("• Tecnologia: PostgreSQL self-hosted con pgvector", 25, yPosition);
    yPosition += 5;
    doc.text("• Cloud provider: AWS RDS/Google Cloud SQL oppure cluster Kubernetes", 25, yPosition);
    yPosition += 5;
    doc.text("• Configurazione: Multi-AZ per alta disponibilita", 25, yPosition);
    yPosition += 5;
    doc.text("• Backup: Automatici giornalieri + point-in-time recovery", 25, yPosition);
    yPosition += 5;
    doc.text("• Costo stimato: EUR 300-800/mese (dipende da volume dati e IOPS)", 25, yPosition);
    yPosition += 8;

    // 2. Backend API
    doc.setFontSize(12);
    doc.setFont("helvetica", "bold");
    doc.text("2. Backend API Layer", 20, yPosition);
    yPosition += 6;
    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");
    doc.text("• Tecnologia: Node.js/Deno + Express o NestJS", 25, yPosition);
    yPosition += 5;
    doc.text("• 30+ edge functions da convertire in API endpoints", 25, yPosition);
    yPosition += 5;
    doc.text("• Sistema di autenticazione JWT proprietario", 25, yPosition);
    yPosition += 5;
    doc.text("• Rate limiting e API security", 25, yPosition);
    yPosition += 5;
    doc.text("• Infrastruttura: Kubernetes cluster o AWS ECS/Lambda", 25, yPosition);
    yPosition += 5;
    doc.text("• Costo stimato: EUR 200-600/mese (computing + load balancer)", 25, yPosition);
    yPosition += 8;

    // 3. Object Storage
    doc.setFontSize(12);
    doc.setFont("helvetica", "bold");
    doc.text("3. Object Storage", 20, yPosition);
    yPosition += 6;
    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");
    doc.text("• Tecnologia: AWS S3 o MinIO self-hosted", 25, yPosition);
    yPosition += 5;
    doc.text("• Uso: Documenti PDF normativi (attualmente ~5GB)", 25, yPosition);
    yPosition += 5;
    doc.text("• Costo stimato: EUR 50-200/mese (dipende da volume e traffico)", 25, yPosition);
    yPosition += 8;

    // 4. Frontend Hosting
    doc.setFontSize(12);
    doc.setFont("helvetica", "bold");
    doc.text("4. Frontend Hosting", 20, yPosition);
    yPosition += 6;
    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");
    doc.text("• Tecnologia: Vercel/Netlify o Nginx su cloud", 25, yPosition);
    yPosition += 5;
    doc.text("• Infrastruttura: CDN globale per performance", 25, yPosition);
    yPosition += 5;
    doc.text("• Costo stimato: EUR 100-300/mese", 25, yPosition);

    // AI Infrastructure
    doc.addPage();
    yPosition = 20;
    doc.setFontSize(12);
    doc.setFont("helvetica", "bold");
    doc.text("5. AI Infrastructure", 20, yPosition);
    yPosition += 8;
    
    doc.setFontSize(11);
    doc.setFont("helvetica", "bold");
    doc.text("Opzione A - API dirette: OpenAI API + Google AI API", 25, yPosition);
    yPosition += 6;
    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");
    doc.text("• Costo: Pay-per-use (~EUR 500-2.000/mese a seconda dell'utilizzo)", 30, yPosition);
    yPosition += 5;
    doc.text("• Piu semplice da implementare", 30, yPosition);
    yPosition += 8;

    doc.setFontSize(11);
    doc.setFont("helvetica", "bold");
    doc.text("Opzione B - Self-Hosted LLM (piu a lungo termine):", 25, yPosition);
    yPosition += 6;
    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");
    doc.text("• Llama 3, Mistral AI o modelli open-source", 30, yPosition);
    yPosition += 5;
    doc.text("• Richiede GPU dedicate (NVIDIA A100/H100)", 30, yPosition);
    yPosition += 5;
    doc.text("• Costo: EUR 2.000-5.000/mese per GPU cloud", 30, yPosition);
    yPosition += 5;
    doc.text("• Vantaggio: Zero costi API, privacy completa", 30, yPosition);
    yPosition += 10;

    // DevOps
    doc.setFontSize(12);
    doc.setFont("helvetica", "bold");
    doc.text("6. DevOps & Infrastructure", 20, yPosition);
    yPosition += 6;
    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");
    doc.text("• CI/CD: GitHub Actions + Docker Registry", 25, yPosition);
    yPosition += 5;
    doc.text("• Monitoring: Prometheus + Grafana + Sentry", 25, yPosition);
    yPosition += 5;
    doc.text("• Logging: ELK Stack (Elasticsearch, Logstash, Kibana)", 25, yPosition);
    yPosition += 5;
    doc.text("• Security: WAF, DDoS protection, penetration testing", 25, yPosition);
    yPosition += 5;
    doc.text("• Costo stimato: EUR 300-800/mese", 25, yPosition);

    // Business Case
    doc.addPage();
    yPosition = 20;
    doc.setFontSize(18);
    doc.setFont("helvetica", "bold");
    doc.text("Business case Cyber 4.0", 20, yPosition);
    yPosition += 15;

    doc.setFontSize(14);
    doc.setFont("helvetica", "bold");
    doc.text("Costi totali stimati:", 20, yPosition);
    yPosition += 10;

    autoTable(doc, {
      startY: yPosition,
      head: [["Fase", "Componenti", "Costo mensile", "Costo annuale"]],
      body: [
        ["Fase 1 - MVP Proprietario (6 mesi)", "Database, Backend API, Storage, Frontend", "EUR 1.000-2.500", "EUR 12.000-30.000"],
        ["Fase 2 - Scale-up (12 mesi)", "+ Monitoring, Security, Backup avanzati", "EUR 2.000-4.000", "EUR 24.000-48.000"],
        ["Fase 3 - Enterprise (18+ mesi)", "+ Self-hosted LLM, Multi-region, HA", "EUR 5.000-10.000", "EUR 60.000-120.000"]
      ],
      theme: 'grid',
      headStyles: { fillColor: [59, 130, 246] },
      styles: { fontSize: 10 }
    });

    yPosition = (doc as any).lastAutoTable.finalY + 15;

    doc.setFontSize(14);
    doc.setFont("helvetica", "bold");
    doc.text("Investimento iniziale richiesto:", 20, yPosition);
    yPosition += 10;

    doc.setFontSize(12);
    doc.setFont("helvetica", "bold");
    doc.text("Budget totale per migrazione completa: EUR 150.000-250.000", 25, yPosition);
    yPosition += 10;

    doc.setFontSize(11);
    doc.setFont("helvetica", "normal");
    doc.text("Breakdown:", 25, yPosition);
    yPosition += 8;

    const breakdown = [
      "Sviluppo infrastruttura: EUR 80.000-120.000 (6-9 mesi, 2-3 developer)",
      "Costi cloud primo anno: EUR 30.000-50.000",
      "Security audit & compliance: EUR 20.000-40.000",
      "AI infrastructure setup: EUR 20.000-40.000"
    ];

    breakdown.forEach(item => {
      doc.setFontSize(10);
      doc.text("• " + item, 30, yPosition);
      yPosition += 6;
    });

    // ROI
    doc.addPage();
    yPosition = 20;
    doc.setFontSize(18);
    doc.setFont("helvetica", "bold");
    doc.text("ROI & Vantaggi competitivi", 20, yPosition);
    yPosition += 15;

    doc.setFontSize(12);
    doc.setFont("helvetica", "bold");
    doc.text("1. Riduzione costi a lungo termine", 20, yPosition);
    yPosition += 7;
    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");
    doc.text("• Dopo 24-36 mesi, costi operativi inferiori del 40-60% rispetto a SaaS dipendenze", 25, yPosition);
    yPosition += 5;
    doc.text("• Eliminazione di vendor lock-in su Lovable/Supabase", 25, yPosition);
    yPosition += 10;

    doc.setFontSize(12);
    doc.setFont("helvetica", "bold");
    doc.text("2. Opportunita enterprise", 20, yPosition);
    yPosition += 7;
    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");
    doc.text("• Contratti on-premise per PA e settore bancario (EUR 50k-200k/anno per cliente)", 25, yPosition);
    yPosition += 5;
    doc.text("• Certificazioni ISO 27001, SOC 2 possibili solo con infrastruttura proprietaria", 25, yPosition);
    yPosition += 5;
    doc.text("• White-label per partner strategici (revenue stream aggiuntivo)", 25, yPosition);
    yPosition += 10;

    doc.setFontSize(12);
    doc.setFont("helvetica", "bold");
    doc.text("3. Valutazione aziendale", 20, yPosition);
    yPosition += 7;
    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");
    doc.text("• Infrastruttura proprietaria aumenta valuation del 30-50% (IP tecnologico completo)", 25, yPosition);
    yPosition += 5;
    doc.text("• Exit strategy piu attraente per M&A (no dipendenze critiche da terzi)", 25, yPosition);
    yPosition += 10;

    doc.setFontSize(12);
    doc.setFont("helvetica", "bold");
    doc.text("4. Scalabilita illimitata", 20, yPosition);
    yPosition += 7;
    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");
    doc.text("• Supporto per 10.000+ utenti simultanei senza colli di bottiglia", 25, yPosition);
    yPosition += 5;
    doc.text("• Multi-tenancy avanzato per clienti enterprise", 25, yPosition);
    yPosition += 5;
    doc.text("• Edge computing per latenza <50ms globale", 25, yPosition);

    // Roadmap
    doc.addPage();
    yPosition = 20;
    doc.setFontSize(18);
    doc.setFont("helvetica", "bold");
    doc.text("Roadmap di migrazione Cyber 4.0", 20, yPosition);
    yPosition += 15;

    doc.setFontSize(12);
    doc.setFont("helvetica", "bold");
    doc.text("Fase 1 - Foundation (periodo stimato: 6 mesi, budget EUR 80.000)", 20, yPosition);
    yPosition += 7;
    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");
    [
      "Setup infrastruttura cloud (AWS/GCP)",
      "Migrazione database PostgreSQL",
      "Conversione edge functions in API REST",
      "Sistema auth proprietario",
      "CI/CD pipeline"
    ].forEach(item => {
      doc.text("• " + item, 25, yPosition);
      yPosition += 5;
    });
    yPosition += 8;

    doc.setFontSize(12);
    doc.setFont("helvetica", "bold");
    doc.text("Fase 2 - Optimization (periodo stimato: 6 mesi successivi, budget EUR 70.000)", 20, yPosition);
    yPosition += 7;
    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");
    [
      "Self-hosted AI pipeline (Llama 3 + Mistral)",
      "Monitoring & observability avanzati",
      "Security hardening & penetration testing",
      "ISO 27001 certification preparazione"
    ].forEach(item => {
      doc.text("• " + item, 25, yPosition);
      yPosition += 5;
    });
    yPosition += 8;

    doc.setFontSize(12);
    doc.setFont("helvetica", "bold");
    doc.text("Fase 3 - Enterprise Ready (periodo stimato: 6 mesi successivi, budget EUR 100.000)", 20, yPosition);
    yPosition += 7;
    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");
    [
      "Multi-region deployment (EU + USA)",
      "On-premise installation package per clienti enterprise",
      "Advanced analytics & BI dashboard",
      "Partner API per integrazioni"
    ].forEach(item => {
      doc.text("• " + item, 25, yPosition);
      yPosition += 5;
    });

    // Analisi di mercato
    doc.addPage();
    yPosition = 20;
    doc.setFontSize(18);
    doc.setFont("helvetica", "bold");
    doc.text("Analisi di mercato - Settore RegTech/GRC", 20, yPosition);
    yPosition += 15;

    doc.setFontSize(12);
    doc.setFont("helvetica", "normal");
    
    doc.text("DIMENSIONI DEL MERCATO", 20, yPosition);
    yPosition += 8;
    doc.setFontSize(10);
    
    const marketData = [
      "• Mercato GRC globale: $151.5B entro 2034 (CAGR 13.2% - Custom Market Insights 2025)",
      "• Mercato europeo cybersecurity: +11.8% crescita annua 2025 (IDC)",
      "• Mercato europeo GRC: crescita sostenuta da NIS2, GDPR, DORA, CRA",
      "• 80% dei budget IT aziendali EMEA dedicati a cybersecurity compliance (2024)",
      "• Italia: €58M investimenti nazionali cybersecurity + ACN budget operativo"
    ];

    marketData.forEach(line => {
      doc.text(line, 25, yPosition);
      yPosition += 6;
    });

    yPosition += 5;
    doc.setFontSize(12);
    doc.text("TARGET ADDRESSABLE MARKET (TAM/SAM/SOM)", 20, yPosition);
    yPosition += 8;
    doc.setFontSize(10);

    const tamData = [
      "TAM (Total Addressable Market):",
      "  - Mercato europeo GRC enterprise: €12B annuo",
      "  - Settori: Banking, Healthcare, Energy, Trasporti, PA, Telco, Manufacturing",
      "",
      "SAM (Serviceable Addressable Market):",
      "  - PMI e grandi imprese italiane soggette a NIS2/GDPR/DORA: €850M annuo",
      "  - ~45.000 aziende italiane interessate (stima ACN + ENISA)",
      "",
      "SOM (Serviceable Obtainable Market) - 3 anni:",
      "  - Target realistico: 0.5-1% del SAM = €4-8M ARR",
      "  - ~400-800 clienti enterprise/PMI (€10k-50k/anno ARPU)"
    ];

    tamData.forEach(line => {
      if (line === "") {
        yPosition += 4;
      } else {
        doc.text(line, 25, yPosition);
        yPosition += 5;
      }
    });

    // Analisi competitiva
    doc.addPage();
    yPosition = 20;
    doc.setFontSize(18);
    doc.setFont("helvetica", "bold");
    doc.text("Analisi competitiva", 20, yPosition);
    yPosition += 15;

    doc.setFontSize(12);
    doc.setFont("helvetica", "normal");
    doc.text("COMPETITOR PRINCIPALI", 20, yPosition);
    yPosition += 8;
    doc.setFontSize(10);

    const competitors = [
      "OneTrust (Leader IDC 2025):",
      "  - Revenue: >$500M annuo, valuation >$5B",
      "  - Focus: Privacy management + GRC enterprise globale",
      "  - Debolezza: Costo elevato (€50k-200k/anno), complessità implementazione",
      "",
      "ServiceNow GRC:",
      "  - Parte ecosistema ServiceNow (market cap $150B)",
      "  - Focus: IT Service Management + GRC integrato",
      "  - Debolezza: Richiede piattaforma ServiceNow completa, non standalone",
      "",
      "TrustArc:",
      "  - Revenue stimato: $100-150M annuo",
      "  - Focus: Privacy compliance automatizzata",
      "  - Debolezza: Limitato su cybersecurity operativa",
      "",
      "Soluzioni locali italiane:",
      "  - Player frammentati, poca integrazione AI, focus audit tradizionale",
      "  - Opportunity: Mercato italiano sottopresidiato da soluzioni moderne"
    ];

    competitors.forEach(line => {
      if (line === "") {
        yPosition += 4;
      } else {
        doc.text(line, 25, yPosition);
        yPosition += 5;
      }
      if (yPosition > 270) {
        doc.addPage();
        yPosition = 20;
      }
    });

    yPosition += 5;
    doc.setFontSize(12);
    doc.setFont("helvetica", "bold");
    doc.text("Vantaggio competitivo RegBrain", 20, yPosition);
    yPosition += 8;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);

    const advantagesData = [
      {
        title: "Specializzazione normativa italiana",
        description: "Copertura completa di normative ACN, Garante Privacy e regolamenti locali"
      },
      {
        title: "Prezzo competitivo",
        description: "€5k-15k/anno vs €50k-200k/anno dei competitor enterprise"
      },
      {
        title: "AI-native RAG system",
        description: "Risposte normative contestuali in tempo reale, non solo checklist statiche"
      },
      {
        title: "Time-to-value ridotto",
        description: "Implementazione in 1 settimana vs 3-6 mesi dei competitor tradizionali"
      },
      {
        title: "Focus PMI",
        description: "Interfaccia semplificata e intuitiva, nessun consulente esterno necessario"
      },
      {
        title: "Aggiornamenti normativi automatici",
        description: "Scraping automatico da EUR-Lex, EDPB, ACN per contenuti sempre aggiornati"
      },
      {
        title: "White-label ready",
        description: "Architettura predisposta per partnership con studi legali e consulenti"
      }
    ];

    advantagesData.forEach((adv, index) => {
      doc.setFont("helvetica", "bold");
      doc.text(`${index + 1}. ${adv.title}`, 25, yPosition);
      yPosition += 5;
      doc.setFont("helvetica", "normal");
      doc.text(adv.description, 30, yPosition);
      yPosition += 7;
      
      if (yPosition > 270) {
        doc.addPage();
        yPosition = 20;
      }
    });

    // Business Plan dettagliato
    doc.addPage();
    yPosition = 20;
    doc.setFontSize(18);
    doc.setFont("helvetica", "bold");
    doc.text("Business plan dettagliato", 20, yPosition);
    yPosition += 15;

    doc.setFontSize(12);
    doc.text("REVENUE MODEL", 20, yPosition);
    yPosition += 8;
    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");

    const revenueModel = [
      "Subscription SaaS (B2B):",
      "  - Tier PMI: €5.000-10.000/anno (10-50 dipendenti)",
      "  - Tier Enterprise: €15.000-50.000/anno (50-500 dipendenti)",
      "  - Tier Corporate: €50.000-200.000/anno (500+ dipendenti)",
      "",
      "Professional Services (20-30% revenue):",
      "  - Assessment iniziale: €3.000-10.000 one-time",
      "  - Consulenza implementazione: €150-200/ora",
      "  - Training on-site: €2.000-5.000/giornata",
      "",
      "White-label & Partnership (target 15% revenue anno 3):",
      "  - Partnership studi legali: revenue share 30-40%",
      "  - Integration partner (consulting firms): referral fee 15-25%"
    ];

    revenueModel.forEach(line => {
      if (line === "") {
        yPosition += 4;
      } else {
        doc.text(line, 25, yPosition);
        yPosition += 5;
      }
    });

    yPosition += 5;
    doc.setFontSize(12);
    doc.setFont("helvetica", "bold");
    doc.text("GO-TO-MARKET STRATEGY", 20, yPosition);
    yPosition += 8;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);

    const gtmStrategy = [
      "Anno 1 (Foundation - Budget €500k):",
      "  - Direct sales: LinkedIn outreach, eventi ACN/CLUSIT, webinar",
      "  - Content marketing: SEO su \"conformità NIS2 Italia\", guide gratuite",
      "  - Target: 50 clienti paganti (€250-500k ARR)",
      "  - Team: 2 sales, 2 customer success, 3 dev, 1 marketing",
      "",
      "Anno 2 (Scale-up - Budget €1.2M):",
      "  - Channel partnerships: 5-10 studi legali, 3-5 consulting firms",
      "  - Inside sales team: 5 account executive",
      "  - Expansion europea: Germania, Francia (post-traduzione)",
      "  - Target: 200 clienti totali (€2-3M ARR)",
      "",
      "Anno 3 (Enterprise push - Budget €2M):",
      "  - Enterprise sales team: 3 senior AE per settore verticale",
      "  - Partnership strategiche: system integrator (Accenture, Deloitte)",
      "  - On-premise offering per PA e Banking",
      "  - Target: 400-600 clienti (€5-8M ARR)"
    ];

    gtmStrategy.forEach(line => {
      if (line === "") {
        yPosition += 4;
      } else {
        doc.text(line, 25, yPosition);
        yPosition += 5;
      }
      if (yPosition > 270) {
        doc.addPage();
        yPosition = 20;
      }
    });

    // Proiezioni finanziarie
    doc.addPage();
    yPosition = 20;
    doc.setFontSize(18);
    doc.setFont("helvetica", "bold");
    doc.text("Proiezioni finanziarie (3 anni)", 20, yPosition);
    yPosition += 15;

    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");
    doc.text("NOTA: Proiezioni basate su benchmark settore RegTech/GRC e crescita mercato 13.2% CAGR", 20, yPosition);
    yPosition += 10;

    // Tabella proiezioni
    doc.setFontSize(11);
    doc.setFont("helvetica", "bold");
    const projectionHeaders = ["Metrica", "Anno 1", "Anno 2", "Anno 3"];
    let xPos = 20;
    projectionHeaders.forEach(header => {
      doc.text(header, xPos, yPosition);
      xPos += 45;
    });
    yPosition += 8;

    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);

    const projectionRows = [
      ["Clienti totali", "50", "200", "500"],
      ["ARR (€)", "€400k", "€2.5M", "€6.5M"],
      ["MRR medio", "€33k", "€208k", "€542k"],
      ["ARPU (€/anno)", "€8.000", "€12.500", "€13.000"],
      ["Churn rate (%)", "15%", "10%", "8%"],
      ["CAC (€)", "€5.000", "€3.500", "€2.500"],
      ["LTV (€)", "€53k", "€125k", "€162k"],
      ["LTV/CAC ratio", "10.6x", "35.7x", "64.8x"],
      ["Costi operativi", "€600k", "€1.5M", "€2.8M"],
      ["EBITDA", "-€200k", "+€1M", "+€3.7M"],
      ["EBITDA margin", "Negativo", "40%", "57%"],
      ["Team size", "8", "18", "35"]
    ];

    projectionRows.forEach(row => {
      xPos = 20;
      row.forEach(cell => {
        doc.text(cell, xPos, yPosition);
        xPos += 45;
      });
      yPosition += 6;
    });

    yPosition += 10;
    doc.setFontSize(12);
    doc.setFont("helvetica", "bold");
    doc.text("ASSUNZIONI CHIAVE", 20, yPosition);
    yPosition += 8;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);

    const assumptions = [
      "• Tasso di conversione demo-to-paid: 12-15% (benchmark SaaS B2B)",
      "• Sales cycle medio: 45-90 giorni (PMI), 90-180 giorni (Enterprise)",
      "• Crescita mensile clienti: +15% mese-su-mese primi 18 mesi",
      "• Upsell/cross-sell: +25% ARR da clienti esistenti anno 2-3",
      "• Espansione europea: +40% TAM accessibile da anno 3",
      "• Costo infrastruttura: scala linearmente con utenti (+30% COGS su ARR)",
      "• Investimento R&D: 25% revenue reinvestito in prodotto"
    ];

    assumptions.forEach(line => {
      doc.text(line, 25, yPosition);
      yPosition += 6;
    });

    // Conclusioni
    doc.addPage();
    yPosition = 20;
    doc.setFontSize(18);
    doc.setFont("helvetica", "bold");
    doc.text("Conclusioni - Evoluzione Cyber 4.0", 20, yPosition);
    yPosition += 15;

    doc.setFontSize(12);
    doc.setFont("helvetica", "bold");
    doc.text("RegBrain oggi:", 20, yPosition);
    yPosition += 7;
    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");
    doc.text("Solida piattaforma SaaS su infrastruttura condivisa, time-to-market rapido,", 25, yPosition);
    yPosition += 5;
    doc.text("costi contenuti.", 25, yPosition);
    yPosition += 12;

    doc.setFontSize(12);
    doc.setFont("helvetica", "bold");
    doc.text("RegBrain domani con migrazione proprietaria:", 20, yPosition);
    yPosition += 7;
    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");
    const tomorrow = [
      "Piattaforma enterprise-grade competitiva con players come OneTrust, TrustArc",
      "Controllo totale su IP e dati",
      "Margini operativi superiori (60-70% vs 40-50% attuale)",
      "Valutazione aziendale 2-3x superiore",
      "Opportunita di mercato B2B enterprise e PA (EUR 5M-20M ARR potenziale)"
    ];
    tomorrow.forEach(item => {
      doc.text("• " + item, 25, yPosition);
      yPosition += 5;
    });
    yPosition += 12;

    doc.setFontSize(14);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(59, 130, 246);
    doc.text("Investimento richiesto: EUR 750.000 Seed Round", 20, yPosition);
    yPosition += 7;
    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(0, 0, 0);
    doc.text("EUR 250k per infrastruttura proprietaria completa + EUR 500k per go-to-market enterprise", 25, yPosition);
    yPosition += 12;

    doc.setFontSize(14);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(16, 185, 129);
    doc.text("Expected ROI: 3-5x in 36-48 mesi", 20, yPosition);
    yPosition += 7;
    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(0, 0, 0);
    doc.text("con acquisizione clienti enterprise.", 25, yPosition);

    // Save PDF
    doc.save("RegBrain_Investor_Pitch.pdf");
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-background via-background to-muted/20 py-12 px-4">
      <div className="container mx-auto max-w-5xl">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <Button variant="outline" onClick={() => navigate(-1)}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            Indietro
          </Button>
          <Button onClick={generatePDF} className="gap-2">
            <Download className="h-4 w-4" />
            Scarica PDF
          </Button>
        </div>

        {/* Title */}
        <div className="text-center mb-12">
          <h1 className="text-4xl md:text-5xl font-bold mb-4 bg-gradient-to-r from-primary to-blue-600 bg-clip-text text-transparent">
            RegBrain
          </h1>
          <p className="text-xl text-muted-foreground">
            Architettura tecnica - Piano di evoluzione Cyber 4.0
          </p>
        </div>

        {/* Infrastruttura Attuale */}
        <Card className="mb-8">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Shield className="h-5 w-5 text-primary" />
              Infrastruttura attuale
            </CardTitle>
            <CardDescription>
              RegBrain attualmente si appoggia su Lovable Cloud, una piattaforma full-stack che utilizza Supabase come backend
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div>
              <h3 className="font-semibold mb-3 text-sm">Stack tecnologico corrente</h3>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li>• <strong>Frontend:</strong> React 18 + TypeScript + Vite + Tailwind CSS</li>
                <li>• <strong>Backend:</strong> Supabase (PostgreSQL + Edge Functions + Storage + Auth)</li>
                <li>• <strong>AI Integration:</strong> Lovable AI (accesso a modelli Google Gemini e OpenAI GPT)</li>
                <li>• <strong>Database:</strong> PostgreSQL con estensione pgvector per RAG</li>
                <li>• <strong>Edge Functions:</strong> 30+ funzioni serverless Deno per logica backend</li>
                <li>• <strong>Storage:</strong> Supabase Storage per documenti normativi PDF</li>
                <li>• <strong>Autenticazione:</strong> Supabase Auth con email/password</li>
              </ul>
            </div>
            <div>
              <h3 className="font-semibold mb-3 text-sm">Dipendenze esterne</h3>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li>• <strong>Hosting:</strong> Lovable.app (frontend) + Supabase Cloud (backend)</li>
                <li>• <strong>AI Models:</strong> Accesso tramite API Lovable AI</li>
                <li>• <strong>Email:</strong> Resend API per notifiche</li>
                <li>• <strong>Database:</strong> Supabase PostgreSQL managed</li>
              </ul>
            </div>

            <div className="border-t pt-4">
              <h3 className="font-semibold mb-3 text-sm">Modelli AI specifici utilizzati</h3>
              
              <div className="space-y-4">
                <div className="bg-blue-50 dark:bg-blue-950/20 p-3 rounded-lg">
                  <p className="font-semibold text-sm mb-2">Sistema RAG (Retrieval-Augmented Generation)</p>
                  <ul className="space-y-1 text-xs text-muted-foreground">
                    <li>• <strong>Modello principale:</strong> google/gemini-2.5-flash</li>
                    <li>• <strong>Embedding:</strong> pgvector con OpenAI text-embedding-3-small (1536 dim)</li>
                    <li>• <strong>Context window:</strong> 128k tokens</li>
                    <li>• <strong>Retrieval strategy:</strong> similarity search su 50 chunks candidati</li>
                    <li>• <strong>Source diversification:</strong> round-robin da max 5 documenti</li>
                    <li>• <strong>Latenza media:</strong> {"<"}2s per query complessa</li>
                  </ul>
                </div>

                <div className="bg-purple-50 dark:bg-purple-950/20 p-3 rounded-lg">
                  <p className="font-semibold text-sm mb-2">Analisi conformità modelli ML (AI Sentinel)</p>
                  <ul className="space-y-1 text-xs text-muted-foreground">
                    <li>• <strong>Modello:</strong> google/gemini-2.5-pro (massima accuratezza)</li>
                    <li>• <strong>Analisi statica:</strong> metadata extraction, provenance verification</li>
                    <li>• <strong>Analisi dinamica:</strong> dataset quality, poisoning detection</li>
                    <li>• <strong>Output:</strong> trust score (0-100), risk level, compliance status</li>
                    <li>• <strong>Framework:</strong> EU AI Act, ISO/IEC 42001, NIST AI RMF</li>
                  </ul>
                </div>

                <div className="bg-green-50 dark:bg-green-950/20 p-3 rounded-lg">
                  <p className="font-semibold text-sm mb-2">Gap Analysis & Assessment</p>
                  <ul className="space-y-1 text-xs text-muted-foreground">
                    <li>• <strong>Modello:</strong> google/gemini-2.5-flash</li>
                    <li>• <strong>Analisi normativa:</strong> GDPR, NIS2, DORA, CRA, AI Act</li>
                    <li>• <strong>Output:</strong> gap identification, risk scoring, action plans</li>
                    <li>• <strong>Benchmark:</strong> confronto con dati settoriali ACN/ENISA</li>
                  </ul>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Migrazione */}
        <Card className="mb-8">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Zap className="h-5 w-5 text-primary" />
              Migrazione a infrastruttura proprietaria
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div>
              <h3 className="font-semibold mb-3">Obiettivi strategici</h3>
              <div className="grid md:grid-cols-2 gap-3">
                <div className="p-3 bg-primary/5 rounded-lg text-sm">
                  ✓ Controllo totale su dati e infrastruttura
                </div>
                <div className="p-3 bg-primary/5 rounded-lg text-sm">
                  ✓ Scalabilità illimitata senza vincoli di terze parti
                </div>
                <div className="p-3 bg-primary/5 rounded-lg text-sm">
                  ✓ Compliance avanzata per clienti enterprise (GDPR, NIS2, ISO 27001)
                </div>
                <div className="p-3 bg-primary/5 rounded-lg text-sm">
                  ✓ Riduzione costi a lungo termine con economia di scala
                </div>
                <div className="p-3 bg-primary/5 rounded-lg text-sm">
                  ✓ White-label completo del prodotto
                </div>
              </div>
            </div>

            <div>
              <h3 className="font-semibold mb-4">Componenti da implementare</h3>
              
              {/* Database */}
              <div className="mb-6 p-4 border rounded-lg bg-card">
                <div className="flex items-center gap-2 mb-3">
                  <Database className="h-4 w-4 text-primary" />
                  <h4 className="font-semibold text-sm">1. Database proprietario</h4>
                </div>
                <ul className="space-y-1 text-sm text-muted-foreground ml-6">
                  <li>• <strong>Tecnologia:</strong> PostgreSQL self-hosted con pgvector</li>
                  <li>• <strong>Infrastruttura:</strong> Cloud provider AWS RDS/Google Cloud SQL oppure cluster Kubernetes</li>
                  <li>• <strong>Configurazione:</strong> Multi-AZ per alta disponibilità</li>
                  <li>• <strong>Backup:</strong> Automatici giornalieri + point-in-time recovery</li>
                  <li>• <strong>Costo stimato:</strong> €300-800/mese (dipende da volume dati e IOPS)</li>
                </ul>
              </div>

              {/* Backend API */}
              <div className="mb-6 p-4 border rounded-lg bg-card">
                <div className="flex items-center gap-2 mb-3">
                  <Server className="h-4 w-4 text-primary" />
                  <h4 className="font-semibold text-sm">2. Backend API Layer</h4>
                </div>
                <ul className="space-y-1 text-sm text-muted-foreground ml-6">
                  <li>• <strong>Tecnologia:</strong> Node.js/Deno + Express o NestJS</li>
                  <li>• <strong>Funzionalità da replicare:</strong></li>
                  <li className="ml-4">- 30+ edge functions da convertire in API endpoints</li>
                  <li className="ml-4">- Sistema di autenticazione JWT proprietario</li>
                  <li className="ml-4">- Rate limiting e API security</li>
                  <li>• <strong>Infrastruttura:</strong> Kubernetes cluster o AWS ECS/Lambda</li>
                  <li>• <strong>Costo stimato:</strong> €200-600/mese (computing + load balancer)</li>
                </ul>
              </div>

              {/* Object Storage */}
              <div className="mb-6 p-4 border rounded-lg bg-card">
                <div className="flex items-center gap-2 mb-3">
                  <Cloud className="h-4 w-4 text-primary" />
                  <h4 className="font-semibold text-sm">3. Object Storage</h4>
                </div>
                <ul className="space-y-1 text-sm text-muted-foreground ml-6">
                  <li>• <strong>Tecnologia:</strong> AWS S3 o MinIO self-hosted</li>
                  <li>• <strong>Uso:</strong> Documenti PDF normativi (attualmente ~5GB)</li>
                  <li>• <strong>Costo stimato:</strong> €50-200/mese (dipende da volume e traffico)</li>
                </ul>
              </div>

              {/* Frontend Hosting */}
              <div className="mb-6 p-4 border rounded-lg bg-card">
                <h4 className="font-semibold text-sm mb-3">4. Frontend Hosting</h4>
                <ul className="space-y-1 text-sm text-muted-foreground ml-6">
                  <li>• <strong>Tecnologia:</strong> Vercel/Netlify o Nginx su cloud</li>
                  <li>• <strong>Infrastruttura:</strong> CDN globale per performance</li>
                  <li>• <strong>Costo stimato:</strong> €100-300/mese</li>
                </ul>
              </div>

              {/* AI Infrastructure */}
              <div className="mb-6 p-4 border rounded-lg bg-card">
                <h4 className="font-semibold text-sm mb-3">5. AI Infrastructure</h4>
                
                <div className="mb-4 p-3 bg-blue-50 dark:bg-blue-950/20 rounded">
                  <p className="text-sm font-semibold mb-2">Opzione A - API Dirette: OpenAI API + Google AI API</p>
                  <ul className="space-y-1 text-sm text-muted-foreground ml-4">
                    <li>• Costo: Pay-per-use (~€500-2000/mese a seconda dell'utilizzo)</li>
                    <li>• Più semplice da implementare</li>
                  </ul>
                </div>

                <div className="p-3 bg-green-50 dark:bg-green-950/20 rounded">
                  <p className="text-sm font-semibold mb-2">Opzione B - Self-Hosted LLM (più a lungo termine):</p>
                  <ul className="space-y-1 text-sm text-muted-foreground ml-4">
                    <li>• Llama 3, Mistral AI o modelli open-source</li>
                    <li>• Richiede GPU dedicate (NVIDIA A100/H100)</li>
                    <li>• Costo: €2000-5000/mese per GPU cloud</li>
                    <li>• <strong>Vantaggio:</strong> Zero costi API, privacy completa</li>
                  </ul>
                </div>
              </div>

              {/* DevOps */}
              <div className="p-4 border rounded-lg bg-card">
                <h4 className="font-semibold text-sm mb-3">6. DevOps & Infrastructure</h4>
                <ul className="space-y-1 text-sm text-muted-foreground ml-6">
                  <li>• <strong>CI/CD:</strong> GitHub Actions + Docker Registry</li>
                  <li>• <strong>Monitoring:</strong> Prometheus + Grafana + Sentry</li>
                  <li>• <strong>Logging:</strong> ELK Stack (Elasticsearch, Logstash, Kibana)</li>
                  <li>• <strong>Security:</strong> WAF, DDoS protection, penetration testing</li>
                  <li>• <strong>Costo stimato:</strong> €300-800/mese</li>
                </ul>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Analisi di mercato */}
        <Card className="mb-8">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-primary" />
              Analisi di mercato - Settore RegTech/GRC
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div>
              <h3 className="font-semibold mb-3">Dimensioni del mercato</h3>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li>• <strong>Mercato GRC globale:</strong> $151.5B entro 2034 (CAGR 13.2% - Custom Market Insights 2025)</li>
                <li>• <strong>Mercato europeo cybersecurity:</strong> +11.8% crescita annua 2025 (IDC)</li>
                <li>• <strong>Mercato europeo GRC:</strong> crescita sostenuta da NIS2, GDPR, DORA, CRA</li>
                <li>• <strong>Budget IT aziendali EMEA:</strong> 80% dedicati a cybersecurity compliance (2024)</li>
                <li>• <strong>Italia:</strong> €58M investimenti nazionali cybersecurity + budget operativo ACN</li>
              </ul>
            </div>

            <div className="border-t pt-4">
              <h3 className="font-semibold mb-3">Target Addressable Market (TAM/SAM/SOM)</h3>
              <div className="space-y-3 text-sm">
                <div>
                  <p className="font-medium">TAM (Total Addressable Market):</p>
                  <p className="text-muted-foreground ml-4">Mercato europeo GRC enterprise: €12B annuo</p>
                  <p className="text-muted-foreground ml-4 text-xs">Settori: Banking, Healthcare, Energy, Trasporti, PA, Telco, Manufacturing</p>
                </div>
                <div>
                  <p className="font-medium">SAM (Serviceable Addressable Market):</p>
                  <p className="text-muted-foreground ml-4">PMI e grandi imprese italiane soggette a NIS2/GDPR/DORA: €850M annuo</p>
                  <p className="text-muted-foreground ml-4 text-xs">~45.000 aziende italiane interessate (stima ACN + ENISA)</p>
                </div>
                <div>
                  <p className="font-medium">SOM (Serviceable Obtainable Market - 3 anni):</p>
                  <p className="text-muted-foreground ml-4">Target realistico: 0.5-1% del SAM = €4-8M ARR</p>
                  <p className="text-muted-foreground ml-4 text-xs">~400-800 clienti enterprise/PMI (€10k-50k/anno ARPU)</p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Analisi competitiva */}
        <Card className="mb-8">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5 text-primary" />
              Analisi competitiva
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div>
              <h3 className="font-semibold mb-3">Competitor principali</h3>
              <div className="space-y-4">
                <div className="border-l-4 border-red-500 pl-4">
                  <p className="font-medium">OneTrust (Leader IDC 2025)</p>
                  <p className="text-sm text-muted-foreground">Revenue: &gt;$500M annuo, valuation &gt;$5B</p>
                  <p className="text-sm text-muted-foreground">Focus: Privacy management + GRC enterprise globale</p>
                  <p className="text-sm text-red-600">Debolezza: Costo elevato (€50k-200k/anno), complessità implementazione</p>
                </div>

                <div className="border-l-4 border-orange-500 pl-4">
                  <p className="font-medium">ServiceNow GRC</p>
                  <p className="text-sm text-muted-foreground">Parte ecosistema ServiceNow (market cap $150B)</p>
                  <p className="text-sm text-muted-foreground">Focus: IT Service Management + GRC integrato</p>
                  <p className="text-sm text-orange-600">Debolezza: Richiede piattaforma ServiceNow completa, non standalone</p>
                </div>

                <div className="border-l-4 border-yellow-500 pl-4">
                  <p className="font-medium">TrustArc</p>
                  <p className="text-sm text-muted-foreground">Revenue stimato: $100-150M annuo</p>
                  <p className="text-sm text-muted-foreground">Focus: Privacy compliance automatizzata</p>
                  <p className="text-sm text-yellow-600">Debolezza: Limitato su cybersecurity operativa</p>
                </div>

                <div className="border-l-4 border-gray-400 pl-4">
                  <p className="font-medium">Soluzioni locali italiane</p>
                  <p className="text-sm text-muted-foreground">Player frammentati, poca integrazione AI, focus audit tradizionale</p>
                  <p className="text-sm text-green-600">Opportunity: Mercato italiano sottopresidiato da soluzioni moderne</p>
                </div>
              </div>
            </div>

            <div className="border-t pt-4">
              <h3 className="font-semibold mb-3 text-primary">Vantaggio competitivo RegBrain</h3>
              <div className="grid gap-3">
                <div className="p-3 border-l-4 border-primary bg-primary/5 rounded-r">
                  <p className="font-semibold text-sm mb-1">1. Specializzazione normativa italiana</p>
                  <p className="text-xs text-muted-foreground">Copertura completa di normative ACN, Garante Privacy e regolamenti locali</p>
                </div>
                
                <div className="p-3 border-l-4 border-primary bg-primary/5 rounded-r">
                  <p className="font-semibold text-sm mb-1">2. Prezzo competitivo</p>
                  <p className="text-xs text-muted-foreground">€5k-15k/anno vs €50k-200k/anno dei competitor enterprise</p>
                </div>
                
                <div className="p-3 border-l-4 border-primary bg-primary/5 rounded-r">
                  <p className="font-semibold text-sm mb-1">3. AI-native RAG system</p>
                  <p className="text-xs text-muted-foreground">Risposte normative contestuali in tempo reale, non solo checklist statiche</p>
                </div>
                
                <div className="p-3 border-l-4 border-primary bg-primary/5 rounded-r">
                  <p className="font-semibold text-sm mb-1">4. Time-to-value ridotto</p>
                  <p className="text-xs text-muted-foreground">Implementazione in 1 settimana vs 3-6 mesi dei competitor tradizionali</p>
                </div>
                
                <div className="p-3 border-l-4 border-primary bg-primary/5 rounded-r">
                  <p className="font-semibold text-sm mb-1">5. Focus PMI</p>
                  <p className="text-xs text-muted-foreground">Interfaccia semplificata e intuitiva, nessun consulente esterno necessario</p>
                </div>
                
                <div className="p-3 border-l-4 border-primary bg-primary/5 rounded-r">
                  <p className="font-semibold text-sm mb-1">6. Aggiornamenti normativi automatici</p>
                  <p className="text-xs text-muted-foreground">Scraping automatico da EUR-Lex, EDPB, ACN per contenuti sempre aggiornati</p>
                </div>
                
                <div className="p-3 border-l-4 border-primary bg-primary/5 rounded-r">
                  <p className="font-semibold text-sm mb-1">7. White-label ready</p>
                  <p className="text-xs text-muted-foreground">Architettura predisposta per partnership con studi legali e consulenti</p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Business Plan dettagliato */}
        <Card className="mb-8">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5 text-primary" />
              Business plan dettagliato
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div>
              <h3 className="font-semibold mb-3">Revenue Model</h3>
              <div className="space-y-4">
                <div>
                  <p className="font-medium text-sm">Subscription SaaS (B2B):</p>
                  <ul className="ml-4 mt-2 space-y-1 text-sm text-muted-foreground">
                    <li>• Tier PMI: €5.000-10.000/anno (10-50 dipendenti)</li>
                    <li>• Tier Enterprise: €15.000-50.000/anno (50-500 dipendenti)</li>
                    <li>• Tier Corporate: €50.000-200.000/anno (500+ dipendenti)</li>
                  </ul>
                </div>
                <div>
                  <p className="font-medium text-sm">Professional Services (20-30% revenue):</p>
                  <ul className="ml-4 mt-2 space-y-1 text-sm text-muted-foreground">
                    <li>• Assessment iniziale: €3.000-10.000 one-time</li>
                    <li>• Consulenza implementazione: €150-200/ora</li>
                    <li>• Training on-site: €2.000-5.000/giornata</li>
                  </ul>
                </div>
                <div>
                  <p className="font-medium text-sm">White-label & Partnership (target 15% revenue anno 3):</p>
                  <ul className="ml-4 mt-2 space-y-1 text-sm text-muted-foreground">
                    <li>• Partnership studi legali: revenue share 30-40%</li>
                    <li>• Integration partner (consulting firms): referral fee 15-25%</li>
                  </ul>
                </div>
              </div>
            </div>

            <div className="border-t pt-4">
              <h3 className="font-semibold mb-3">Go-to-Market Strategy</h3>
              <div className="space-y-4">
                <div className="border-l-4 border-blue-500 pl-4">
                  <p className="font-medium">Anno 1 (Foundation - Budget €500k)</p>
                  <ul className="mt-2 space-y-1 text-sm text-muted-foreground">
                    <li>• Direct sales: LinkedIn outreach, eventi ACN/CLUSIT, webinar</li>
                    <li>• Content marketing: SEO su "conformità NIS2 Italia", guide gratuite</li>
                    <li>• Target: 50 clienti paganti (€250-500k ARR)</li>
                    <li>• Team: 2 sales, 2 customer success, 3 dev, 1 marketing</li>
                  </ul>
                </div>

                <div className="border-l-4 border-purple-500 pl-4">
                  <p className="font-medium">Anno 2 (Scale-up - Budget €1.2M)</p>
                  <ul className="mt-2 space-y-1 text-sm text-muted-foreground">
                    <li>• Channel partnerships: 5-10 studi legali, 3-5 consulting firms</li>
                    <li>• Inside sales team: 5 account executive</li>
                    <li>• Expansion europea: Germania, Francia (post-traduzione)</li>
                    <li>• Target: 200 clienti totali (€2-3M ARR)</li>
                  </ul>
                </div>

                <div className="border-l-4 border-green-500 pl-4">
                  <p className="font-medium">Anno 3 (Enterprise push - Budget €2M)</p>
                  <ul className="mt-2 space-y-1 text-sm text-muted-foreground">
                    <li>• Enterprise sales team: 3 senior AE per settore verticale</li>
                    <li>• Partnership strategiche: system integrator (Accenture, Deloitte)</li>
                    <li>• On-premise offering per PA e Banking</li>
                    <li>• Target: 400-600 clienti (€5-8M ARR)</li>
                  </ul>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Proiezioni finanziarie */}
        <Card className="mb-8 border-primary/50">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BarChart3 className="h-5 w-5 text-primary" />
              Proiezioni finanziarie (3 anni)
            </CardTitle>
            <p className="text-sm text-muted-foreground mt-2">
              Proiezioni basate su benchmark settore RegTech/GRC e crescita mercato 13.2% CAGR
            </p>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-2 font-semibold">Metrica</th>
                    <th className="text-right py-2 font-semibold">Anno 1</th>
                    <th className="text-right py-2 font-semibold">Anno 2</th>
                    <th className="text-right py-2 font-semibold">Anno 3</th>
                  </tr>
                </thead>
                <tbody className="text-muted-foreground">
                  <tr className="border-b">
                    <td className="py-2">Clienti totali</td>
                    <td className="text-right">50</td>
                    <td className="text-right">200</td>
                    <td className="text-right">500</td>
                  </tr>
                  <tr className="border-b">
                    <td className="py-2 font-medium">ARR</td>
                    <td className="text-right font-medium">€400k</td>
                    <td className="text-right font-medium">€2.5M</td>
                    <td className="text-right font-medium">€6.5M</td>
                  </tr>
                  <tr className="border-b">
                    <td className="py-2">MRR medio</td>
                    <td className="text-right">€33k</td>
                    <td className="text-right">€208k</td>
                    <td className="text-right">€542k</td>
                  </tr>
                  <tr className="border-b">
                    <td className="py-2">ARPU (€/anno)</td>
                    <td className="text-right">€8.000</td>
                    <td className="text-right">€12.500</td>
                    <td className="text-right">€13.000</td>
                  </tr>
                  <tr className="border-b">
                    <td className="py-2">Churn rate</td>
                    <td className="text-right">15%</td>
                    <td className="text-right">10%</td>
                    <td className="text-right">8%</td>
                  </tr>
                  <tr className="border-b">
                    <td className="py-2">CAC</td>
                    <td className="text-right">€5.000</td>
                    <td className="text-right">€3.500</td>
                    <td className="text-right">€2.500</td>
                  </tr>
                  <tr className="border-b">
                    <td className="py-2">LTV</td>
                    <td className="text-right">€53k</td>
                    <td className="text-right">€125k</td>
                    <td className="text-right">€162k</td>
                  </tr>
                  <tr className="border-b">
                    <td className="py-2 font-medium">LTV/CAC ratio</td>
                    <td className="text-right font-medium text-green-600">10.6x</td>
                    <td className="text-right font-medium text-green-600">35.7x</td>
                    <td className="text-right font-medium text-green-600">64.8x</td>
                  </tr>
                  <tr className="border-b">
                    <td className="py-2">Costi operativi</td>
                    <td className="text-right">€600k</td>
                    <td className="text-right">€1.5M</td>
                    <td className="text-right">€2.8M</td>
                  </tr>
                  <tr className="border-b">
                    <td className="py-2 font-medium">EBITDA</td>
                    <td className="text-right font-medium text-red-600">-€200k</td>
                    <td className="text-right font-medium text-green-600">+€1M</td>
                    <td className="text-right font-medium text-green-600">+€3.7M</td>
                  </tr>
                  <tr className="border-b">
                    <td className="py-2 font-medium">EBITDA margin</td>
                    <td className="text-right">Negativo</td>
                    <td className="text-right font-medium">40%</td>
                    <td className="text-right font-medium">57%</td>
                  </tr>
                  <tr>
                    <td className="py-2">Team size</td>
                    <td className="text-right">8</td>
                    <td className="text-right">18</td>
                    <td className="text-right">35</td>
                  </tr>
                </tbody>
              </table>
            </div>

            <div className="mt-6 border-t pt-4">
              <h3 className="font-semibold mb-3">Assunzioni chiave</h3>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li>• Tasso di conversione demo-to-paid: 12-15% (benchmark SaaS B2B)</li>
                <li>• Sales cycle medio: 45-90 giorni (PMI), 90-180 giorni (Enterprise)</li>
                <li>• Crescita mensile clienti: +15% mese-su-mese primi 18 mesi</li>
                <li>• Upsell/cross-sell: +25% ARR da clienti esistenti anno 2-3</li>
                <li>• Espansione europea: +40% TAM accessibile da anno 3</li>
                <li>• Costo infrastruttura: scala linearmente con utenti (+30% COGS su ARR)</li>
                <li>• Investimento R&D: 25% revenue reinvestito in prodotto</li>
              </ul>
              <p className="text-xs text-muted-foreground mt-4 italic">
                Nota: Queste proiezioni sono stime indicative basate su dati di mercato pubblici e benchmark settoriali.
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Business Case */}
        <Card className="mb-8">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <DollarSign className="h-5 w-5 text-primary" />
              Business case Cyber 4.0
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div>
              <h3 className="font-semibold mb-3">Costi totali stimati</h3>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left py-2 font-semibold">Fase</th>
                      <th className="text-left py-2 font-semibold">Componenti</th>
                      <th className="text-right py-2 font-semibold">Costo mensile</th>
                      <th className="text-right py-2 font-semibold">Costo annuale</th>
                    </tr>
                  </thead>
                  <tbody className="text-muted-foreground">
                    <tr className="border-b">
                      <td className="py-2">Fase 1 - MVP Proprietario</td>
                      <td className="py-2 text-xs">Database, Backend API, Storage, Frontend</td>
                      <td className="text-right py-2">€1.000-2.500/mese</td>
                      <td className="text-right py-2">€12.000-30.000/anno</td>
                    </tr>
                    <tr className="border-b">
                      <td className="py-2">Fase 2 - Scale-up</td>
                      <td className="py-2 text-xs">+ Monitoring, Security, Backup avanzati</td>
                      <td className="text-right py-2">€2.000-4.000/mese</td>
                      <td className="text-right py-2">€24.000-48.000/anno</td>
                    </tr>
                    <tr>
                      <td className="py-2">Fase 3 - Enterprise</td>
                      <td className="py-2 text-xs">+ Self-hosted LLM, Multi-region, HA</td>
                      <td className="text-right py-2">€5.000-10.000/mese</td>
                      <td className="text-right py-2">€60.000-120.000/anno</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>

            <div className="bg-gradient-to-r from-primary/10 to-blue-500/10 p-6 rounded-lg">
              <h3 className="font-bold text-lg mb-4">Investimento iniziale richiesto</h3>
              <p className="text-2xl font-bold mb-4 text-primary">Budget totale per migrazione completa: €150.000-250.000</p>
              <div className="space-y-2 text-sm">
                <p className="font-semibold mb-2">Breakdown:</p>
                <p className="text-muted-foreground">• Sviluppo infrastruttura: €80.000-120.000 (6-9 mesi, 2-3 developer)</p>
                <p className="text-muted-foreground">• Costi cloud primo anno: €30.000-50.000</p>
                <p className="text-muted-foreground">• Security audit & compliance: €20.000-40.000</p>
                <p className="text-muted-foreground">• AI infrastructure setup: €20.000-40.000</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* ROI */}
        <Card className="mb-8">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-primary" />
              ROI & Vantaggi competitivi
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid md:grid-cols-2 gap-4">
              <div className="p-4 border rounded-lg">
                <h4 className="font-semibold mb-2 text-sm">1. Riduzione costi a lungo termine</h4>
                <p className="text-sm text-muted-foreground">
                  Dopo 24-36 mesi, costi operativi inferiori del 40-60% rispetto a SaaS dipendenze.
                  Eliminazione di vendor lock-in su Lovable/Supabase.
                </p>
              </div>
              <div className="p-4 border rounded-lg">
                <h4 className="font-semibold mb-2 text-sm">2. Opportunità Enterprise</h4>
                <p className="text-sm text-muted-foreground">
                  Contratti on-premise per PA e settore bancario (€50k-200k/anno per cliente).
                  Certificazioni ISO 27001, SOC 2 possibili solo con infrastruttura proprietaria.
                  White-label per partner strategici (revenue stream aggiuntivo).
                </p>
              </div>
              <div className="p-4 border rounded-lg">
                <h4 className="font-semibold mb-2 text-sm">3. Valutazione aziendale</h4>
                <p className="text-sm text-muted-foreground">
                  Infrastruttura proprietaria aumenta valuation del 30-50% (IP tecnologico completo).
                  Exit strategy più attraente per M&A (no dipendenze critiche da terzi).
                </p>
              </div>
              <div className="p-4 border rounded-lg">
                <h4 className="font-semibold mb-2 text-sm">4. Scalabilità illimitata</h4>
                <p className="text-sm text-muted-foreground">
                  Supporto per 10.000+ utenti simultanei senza colli di bottiglia.
                  Multi-tenancy avanzato per clienti enterprise.
                  Edge computing per latenza {"<"}50ms globale.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Roadmap */}
        <Card className="mb-8">
          <CardHeader>
            <CardTitle>Roadmap di migrazione Cyber 4.0</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="border-l-4 border-primary pl-4">
              <h4 className="font-semibold mb-2">Fase 1 - Foundation (periodo stimato: 6 mesi, budget €80k)</h4>
              <ul className="space-y-1 text-sm text-muted-foreground">
                <li>• Setup infrastruttura cloud (AWS/GCP)</li>
                <li>• Migrazione database PostgreSQL</li>
                <li>• Conversione edge functions in API REST</li>
                <li>• Sistema auth proprietario</li>
                <li>• CI/CD pipeline</li>
              </ul>
            </div>

            <div className="border-l-4 border-blue-500 pl-4">
              <h4 className="font-semibold mb-2">Fase 2 - Optimization (periodo stimato: 6 mesi successivi, budget €70k)</h4>
              <ul className="space-y-1 text-sm text-muted-foreground">
                <li>• Self-hosted AI pipeline (Llama 3 + Mistral)</li>
                <li>• Monitoring & observability avanzati</li>
                <li>• Security hardening & penetration testing</li>
                <li>• ISO 27001 certification preparazione</li>
              </ul>
            </div>

            <div className="border-l-4 border-green-500 pl-4">
              <h4 className="font-semibold mb-2">Fase 3 - Enterprise Ready (periodo stimato: 6 mesi successivi, budget €100k)</h4>
              <ul className="space-y-1 text-sm text-muted-foreground">
                <li>• Multi-region deployment (EU + USA)</li>
                <li>• On-premise installation package per clienti enterprise</li>
                <li>• Advanced analytics & BI dashboard</li>
                <li>• Partner API per integrazioni</li>
              </ul>
            </div>
          </CardContent>
        </Card>

        {/* Conclusioni */}
        <Card className="bg-gradient-to-br from-primary/5 to-blue-500/5 border-primary/20">
          <CardHeader>
            <CardTitle>Conclusioni - Evoluzione Cyber 4.0</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <p className="font-semibold mb-2">RegBrain oggi:</p>
              <p className="text-sm text-muted-foreground">
                Solida piattaforma SaaS su infrastruttura condivisa, time-to-market rapido, costi contenuti.
              </p>
            </div>
            <div>
              <p className="font-semibold mb-2">RegBrain domani con migrazione proprietaria:</p>
              <ul className="space-y-1 text-sm text-muted-foreground">
                <li>✓ Piattaforma enterprise-grade competitiva con players come OneTrust, TrustArc</li>
                <li>✓ Controllo totale su IP e dati</li>
                <li>✓ Margini operativi superiori (60-70% vs 40-50% attuale)</li>
                <li>✓ Valutazione aziendale 2-3x superiore</li>
                <li>✓ Opportunità di mercato B2B enterprise e PA (€5M-20M ARR potenziale)</li>
              </ul>
            </div>
            <div className="bg-gradient-to-r from-primary to-blue-600 text-white p-6 rounded-lg space-y-2">
              <p className="text-xl font-bold">Investimento richiesto: €750k Seed Round</p>
              <p className="text-sm opacity-90">
                €250k per infrastruttura proprietaria completa + €500k per go-to-market enterprise
              </p>
              <p className="text-lg font-semibold mt-4">Expected ROI: 3-5x in 36-48 mesi</p>
              <p className="text-sm opacity-90">con acquisizione clienti enterprise</p>
            </div>
          </CardContent>
        </Card>

        {/* Download CTA */}
        <div className="text-center mt-8">
          <Button onClick={generatePDF} size="lg" className="gap-2">
            <Download className="h-5 w-5" />
            Scarica presentazione PDF
          </Button>
          <p className="text-sm text-muted-foreground mt-4">
            Presentazione completa con tutti i dettagli tecnici, tabelle, roadmap e proiezioni finanziarie
          </p>
        </div>
      </div>
    </div>
  );
}
