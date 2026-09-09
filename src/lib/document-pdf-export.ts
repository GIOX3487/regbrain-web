import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { format } from "date-fns";

// ── Helpers ──

const PAGE_WIDTH = 210;
const MARGIN_LEFT = 15;
const MARGIN_RIGHT = 15;
const MARGIN_TOP = 20;
const MARGIN_BOTTOM = 20;
const SAFE_WIDTH = PAGE_WIDTH - MARGIN_LEFT - MARGIN_RIGHT - 5;
const LINE_HEIGHT = 5;

function stripMarkdown(text: string): string {
  if (!text) return '';
  let cleaned = String(text);
  cleaned = cleaned.replace(/\r/g, '');
  cleaned = cleaned.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '$1');
  cleaned = cleaned.replace(/^#{1,6}\s+/gm, '');
  cleaned = cleaned.replace(/`{1,3}([^`]+)`{1,3}/g, '$1');
  cleaned = cleaned.replace(/__([^_]+)__/g, '$1');
  cleaned = cleaned.replace(/_([^_]+)_/g, '$1');
  // Rimuovi markdown bold
  cleaned = cleaned.replace(/\*\*([^*]+)\*\*/g, '$1');
  // Rimuovi markdown italic
  cleaned = cleaned.replace(/\*([^*]+)\*/g, '$1');
  // Rimuovi emoji comuni
  cleaned = cleaned.replace(/[\u{1F600}-\u{1F64F}]/gu, '');
  cleaned = cleaned.replace(/[\u{1F300}-\u{1F5FF}]/gu, '');
  cleaned = cleaned.replace(/[\u{1F680}-\u{1F6FF}]/gu, '');
  cleaned = cleaned.replace(/[\u{1F900}-\u{1F9FF}]/gu, '');
  cleaned = cleaned.replace(/[\u{2600}-\u{26FF}]/gu, '');
  cleaned = cleaned.replace(/[\u{2700}-\u{27BF}]/gu, '');
  cleaned = cleaned.replace(/[\u{FE00}-\u{FE0F}]/gu, '');
  cleaned = cleaned.replace(/[\u{200D}]/gu, '');
  // Sostituisci checkmark e warning con testo
  cleaned = cleaned.replace(/\u2705/g, '[OK]');
  cleaned = cleaned.replace(/\u26A0\uFE0F/g, '[!]');
  cleaned = cleaned.replace(/\u274C/g, '[X]');
  cleaned = cleaned.replace(/\u26A0/g, '[!]');
  // Rimuovi doppi spazi
  cleaned = cleaned.replace(/[ \t]{2,}/g, ' ');
  cleaned = cleaned.replace(/\n{3,}/g, '\n\n');
  return cleaned.trim();
}

function ensureSpace(doc: jsPDF, y: number, needed: number): number {
  const pageHeight = doc.internal.pageSize.getHeight();
  if (y + needed > pageHeight - MARGIN_BOTTOM) {
    doc.addPage();
    return MARGIN_TOP;
  }
  return y;
}

function writeWrapped(doc: jsPDF, text: string, x: number, y: number, maxWidth: number, lineHeight = LINE_HEIGHT): number {
  if (!text) return y;
  const lines = doc.splitTextToSize(String(text), maxWidth);
  for (const line of lines) {
    y = ensureSpace(doc, y, lineHeight + 2);
    doc.text(line, x, y);
    y += lineHeight;
  }
  return y;
}

function writeSectionTitle(doc: jsPDF, title: string, y: number): number {
  y = ensureSpace(doc, y, 14);
  doc.setFontSize(13);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(20, 60, 120);
  y = writeWrapped(doc, title, MARGIN_LEFT, y, SAFE_WIDTH, 6);
  doc.setTextColor(0, 0, 0);
  y += 2;
  return y;
}

function writeSubTitle(doc: jsPDF, title: string, y: number): number {
  y = ensureSpace(doc, y, 10);
  doc.setFontSize(10);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(40, 80, 140);
  y = writeWrapped(doc, title, MARGIN_LEFT + 2, y, SAFE_WIDTH - 4, 5);
  doc.setTextColor(0, 0, 0);
  y += 1;
  return y;
}

function writeLabel(doc: jsPDF, label: string, y: number, x = MARGIN_LEFT): number {
  y = ensureSpace(doc, y, 8);
  doc.setFontSize(9);
  doc.setFont("helvetica", "bold");
  doc.text(label, x, y);
  y += 4;
  return y;
}

function writeBody(doc: jsPDF, text: string, y: number, x = MARGIN_LEFT, indent = 0): number {
  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  return writeWrapped(doc, text, x + indent, y, SAFE_WIDTH - indent, LINE_HEIGHT);
}

function humanize(key: string): string {
  return key
    .replace(/_/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

// ── Recursive renderer ──

function renderAny(doc: jsPDF, value: any, y: number, depth = 0): number {
  if (value === null || value === undefined) return y;

  if (typeof value === "string") {
    y = writeBody(doc, value, y, MARGIN_LEFT, depth * 4);
    y += 2;
    return y;
  }

  if (typeof value === "number" || typeof value === "boolean") {
    y = writeBody(doc, String(value), y, MARGIN_LEFT, depth * 4);
    y += 2;
    return y;
  }

  if (Array.isArray(value)) {
    for (let i = 0; i < value.length; i++) {
      const item = value[i];
      if (typeof item === "string") {
        y = writeBody(doc, `• ${item}`, y, MARGIN_LEFT, depth * 4);
        y += 1;
      } else if (typeof item === "object" && item !== null) {
        // Check if it's a simple key-value table row
        const keys = Object.keys(item);
        if (keys.length <= 5 && keys.every((k) => typeof item[k] === "string" || typeof item[k] === "number")) {
          // Render as inline: "key: val | key: val"
          const parts = keys.map((k) => `${humanize(k)}: ${item[k]}`).join("  |  ");
          y = writeBody(doc, `• ${parts}`, y, MARGIN_LEFT, depth * 4);
          y += 1;
        } else {
          y = renderAny(doc, item, y, depth + 1);
        }
      }
    }
    y += 2;
    return y;
  }

  if (typeof value === "object") {
    const entries = Object.entries(value);
    for (const [key, val] of entries) {
      if (key === "title") continue; // already rendered as page title
      if (depth === 0) {
        y = writeSubTitle(doc, humanize(key), y);
      } else {
        y = writeLabel(doc, humanize(key) + ":", y, MARGIN_LEFT + depth * 4);
      }
      y = renderAny(doc, val, y, depth + 1);
      y += 1;
    }
    return y;
  }

  return y;
}

// ── DPIA PDF ──

function exportDPIA(doc: jsPDF, content: any) {
  let y = MARGIN_TOP;

  // Cover
  doc.setFontSize(18);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(20, 60, 120);
  const titleLines = doc.splitTextToSize(content.title || "DPIA", SAFE_WIDTH);
  for (const line of titleLines) {
    doc.text(line, PAGE_WIDTH / 2, y, { align: "center" });
    y += 8;
  }
  doc.setTextColor(0, 0, 0);
  y += 4;

  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  doc.text(`Generato il ${format(new Date(), "dd/MM/yyyy")}`, PAGE_WIDTH / 2, y, { align: "center" });
  y += 12;

  // Section 1
  if (content.section_1_introduzione) {
    y = writeSectionTitle(doc, "1. Introduzione", y);
    y = writeBody(doc, stripMarkdown(content.section_1_introduzione), y);
    y += 6;
  }

  // Section 2
  if (content.section_2_informazioni_essenziali) {
    y = writeSectionTitle(doc, "2. Informazioni Essenziali", y);
    const info = content.section_2_informazioni_essenziali;
    const infoRows = [
      ["Data Creazione Analisi", info.data_creazione_analisi || "—"],
      ["Data Generazione Documento", info.data_generazione_documento || "—"],
      ["Stato", info.stato || "In lavorazione"],
      ["Reporter", info.reporter || "[DA COMPLETARE]"],
      ["Versione", info.versione || "1.0"],
    ];
    y = ensureSpace(doc, y, 30);
    autoTable(doc, {
      startY: y,
      head: [["Campo", "Valore"]],
      body: infoRows,
      margin: { left: MARGIN_LEFT, right: MARGIN_RIGHT },
      styles: { fontSize: 9, cellPadding: 3 },
      headStyles: { fillColor: [20, 60, 120] },
      columnStyles: { 0: { fontStyle: "bold", cellWidth: 60 } },
    });
    y = (doc as any).lastAutoTable.finalY + 6;
  }

  // Section 3
  if (content.section_3_pre_assessment) {
    y = writeSectionTitle(doc, "3. Pre-Assessment e Stima del Rischio", y);
    const sec3 = content.section_3_pre_assessment;

    if (Array.isArray(sec3.pre_assessment_tipologie) && sec3.pre_assessment_tipologie.length > 0) {
      y = writeSubTitle(doc, "Pre-Assessment - Tipologie di Trattamento", y);
      y = ensureSpace(doc, y, 20);
      autoTable(doc, {
        startY: y,
        head: [["Tipologia", "Risposta", "Motivazione"]],
        body: sec3.pre_assessment_tipologie.map((t: any) => [
          t.tipologia || "",
          t.risposta || "",
          stripMarkdown(t.motivazione) || "",
        ]),
        margin: { left: MARGIN_LEFT, right: MARGIN_RIGHT },
        styles: { fontSize: 8, cellPadding: 2, overflow: "linebreak" },
        headStyles: { fillColor: [20, 60, 120] },
        columnStyles: { 0: { cellWidth: 65 }, 1: { cellWidth: 18 } },
      });
      y = (doc as any).lastAutoTable.finalY + 6;
    }

    if (Array.isArray(sec3.stima_rischio_wp29) && sec3.stima_rischio_wp29.length > 0) {
      y = writeSubTitle(doc, "Stima del Rischio - Criteri WP29", y);
      y = ensureSpace(doc, y, 20);
      autoTable(doc, {
        startY: y,
        head: [["Criterio", "Risposta", "Motivazione"]],
        body: sec3.stima_rischio_wp29.map((c: any) => [
          c.criterio || "",
          c.risposta || "",
          stripMarkdown(c.motivazione) || "",
        ]),
        margin: { left: MARGIN_LEFT, right: MARGIN_RIGHT },
        styles: { fontSize: 8, cellPadding: 2, overflow: "linebreak" },
        headStyles: { fillColor: [20, 60, 120] },
        columnStyles: { 0: { cellWidth: 65 }, 1: { cellWidth: 18 } },
      });
      y = (doc as any).lastAutoTable.finalY + 6;
    }
  }

  // Section 4
  if (content.section_4_informazioni_trattamento) {
    y = writeSectionTitle(doc, "4. Informazioni sul Trattamento", y);
    const sec4 = content.section_4_informazioni_trattamento;

    // Info base
    if (sec4.codice_identificativo || sec4.nome_trattamento) {
      const infoRows4: string[][] = [];
      if (sec4.codice_identificativo) infoRows4.push(['Codice Identificativo', sec4.codice_identificativo]);
      if (sec4.nome_trattamento) infoRows4.push(['Nome', sec4.nome_trattamento]);
      if (sec4.data_creazione) infoRows4.push(['Data Creazione', sec4.data_creazione]);
      if (sec4.data_ultima_modifica) infoRows4.push(['Data Ultima Modifica', sec4.data_ultima_modifica]);
      if (sec4.origine_dati) infoRows4.push(['Origine Dati', sec4.origine_dati]);
      if (sec4.modalita_trattamento) infoRows4.push(['Modalità Trattamento', sec4.modalita_trattamento]);
      y = ensureSpace(doc, y, 30);
      autoTable(doc, {
        startY: y,
        body: infoRows4,
        margin: { left: MARGIN_LEFT, right: MARGIN_RIGHT },
        styles: { fontSize: 9, cellPadding: 3 },
        columnStyles: { 0: { fontStyle: 'bold', cellWidth: 55 } },
      });
      y = (doc as any).lastAutoTable.finalY + 5;
    }

    // Descrizione
    if (sec4.descrizione) {
      y = writeSubTitle(doc, 'Descrizione del Trattamento', y);
      y = writeBody(doc, stripMarkdown(sec4.descrizione), y);
      y += 4;
    }

    // Finalità
    if (sec4.finalita_trattamento) {
      y = writeSubTitle(doc, 'Finalità del Trattamento', y);
      y = writeBody(doc, stripMarkdown(sec4.finalita_trattamento), y);
      y += 4;
    }

    // Basi giuridiche
    if (sec4.basi_giuridiche) {
      y = writeSubTitle(doc, 'Basi Giuridiche', y);
      if (typeof sec4.basi_giuridiche === 'object' && sec4.basi_giuridiche !== null && !Array.isArray(sec4.basi_giuridiche)) {
        const bg = sec4.basi_giuridiche;
        let rendered = false;
        if (bg.articolo_6) { y = writeLabel(doc, 'Art. 6 GDPR:', y); y = writeBody(doc, stripMarkdown(bg.articolo_6), y, MARGIN_LEFT, 4); y += 2; rendered = true; }
        if (bg.articolo_9) { y = writeLabel(doc, 'Art. 9 GDPR:', y); y = writeBody(doc, stripMarkdown(bg.articolo_9), y, MARGIN_LEFT, 4); y += 2; rendered = true; }
        if (bg.riferimenti_normativi) { y = writeLabel(doc, 'Riferimenti Normativi:', y); y = writeBody(doc, stripMarkdown(bg.riferimenti_normativi), y, MARGIN_LEFT, 4); y += 2; rendered = true; }
        if (!rendered) {
          for (const [key, val] of Object.entries(bg)) {
            if (val && typeof val === 'string') {
              y = writeLabel(doc, humanize(key) + ':', y);
              y = writeBody(doc, stripMarkdown(val), y, MARGIN_LEFT, 4);
              y += 2;
            }
          }
        }
      } else if (typeof sec4.basi_giuridiche === 'string') {
        y = writeBody(doc, stripMarkdown(sec4.basi_giuridiche), y);
      } else if (Array.isArray(sec4.basi_giuridiche)) {
        for (const bg of sec4.basi_giuridiche) {
          y = writeBody(doc, stripMarkdown(typeof bg === 'string' ? bg : JSON.stringify(bg)), y);
          y += 1;
        }
      }
      y += 3;
    }

    // Categorie dati
    if (sec4.categorie_dati) {
      y = writeSubTitle(doc, 'Categorie di Dati Trattati', y);
      if (Array.isArray(sec4.categorie_dati.dati_personali) && sec4.categorie_dati.dati_personali.length > 0) {
        y = writeLabel(doc, 'Dati Personali:', y);
        for (const d of sec4.categorie_dati.dati_personali) { y = writeBody(doc, '• ' + d, y, MARGIN_LEFT, 4); }
        y += 2;
      }
      if (Array.isArray(sec4.categorie_dati.categorie_particolari) && sec4.categorie_dati.categorie_particolari.length > 0) {
        y = writeLabel(doc, 'Categorie Particolari (Art. 9):', y);
        for (const d of sec4.categorie_dati.categorie_particolari) { y = writeBody(doc, '• ' + d, y, MARGIN_LEFT, 4); }
        y += 2;
      }
      y += 3;
    }

    // Titolare
    if (sec4.titolare) {
      y = writeSubTitle(doc, 'Titolare del Trattamento', y);
      if (typeof sec4.titolare === 'object' && sec4.titolare !== null) {
        const t = sec4.titolare;
        const rows: string[][] = [];
        if (t.ragione_sociale) rows.push(['Ragione Sociale', t.ragione_sociale]);
        if (t.indirizzo) rows.push(['Indirizzo', t.indirizzo]);
        if (t.pec) rows.push(['PEC', t.pec]);
        if (t.email) rows.push(['Email', t.email]);
        if (t.telefono) rows.push(['Telefono', t.telefono]);
        if (rows.length > 0) {
          y = ensureSpace(doc, y, 25);
          autoTable(doc, {
            startY: y, body: rows,
            margin: { left: MARGIN_LEFT, right: MARGIN_RIGHT },
            styles: { fontSize: 9, cellPadding: 3 },
            columnStyles: { 0: { fontStyle: 'bold', cellWidth: 45 } },
          });
          y = (doc as any).lastAutoTable.finalY + 5;
        } else {
          y = writeBody(doc, '[DA COMPLETARE - Dati Titolare del Trattamento]', y);
          y += 3;
        }
      } else {
        y = writeBody(doc, stripMarkdown(String(sec4.titolare)), y);
        y += 3;
      }
    }

    // DPO
    if (sec4.dpo) {
      y = writeSubTitle(doc, 'Responsabile della Protezione dei Dati (DPO)', y);
      if (typeof sec4.dpo === 'object' && sec4.dpo !== null) {
        const d = sec4.dpo;
        const rows: string[][] = [];
        if (d.nome) rows.push(['Nome', d.nome]);
        if (d.email) rows.push(['Email', d.email]);
        if (d.telefono) rows.push(['Telefono', d.telefono]);
        if (rows.length > 0) {
          y = ensureSpace(doc, y, 20);
          autoTable(doc, {
            startY: y, body: rows,
            margin: { left: MARGIN_LEFT, right: MARGIN_RIGHT },
            styles: { fontSize: 9, cellPadding: 3 },
            columnStyles: { 0: { fontStyle: 'bold', cellWidth: 45 } },
          });
          y = (doc as any).lastAutoTable.finalY + 5;
        } else {
          y = writeBody(doc, '[DA COMPLETARE - Dati DPO]', y);
          y += 3;
        }
      } else {
        y = writeBody(doc, stripMarkdown(String(sec4.dpo)), y);
        y += 3;
      }
    }

    // Sub-Responsabili
    if (sec4.sub_responsabili) {
      y = writeSubTitle(doc, 'Sub-Responsabili del Trattamento', y);
      if (Array.isArray(sec4.sub_responsabili) && sec4.sub_responsabili.length > 0) {
        y = ensureSpace(doc, y, 20);
        autoTable(doc, {
          startY: y,
          head: [['Ragione Sociale', 'Servizio', 'Contratto Art. 28']],
          body: sec4.sub_responsabili.map((sr: any) => [
            sr.ragione_sociale || '[DA COMPLETARE]',
            sr.servizio || '',
            stripMarkdown(sr.contratto_art28 || ''),
          ]),
          margin: { left: MARGIN_LEFT, right: MARGIN_RIGHT },
          styles: { fontSize: 8, cellPadding: 3, overflow: 'linebreak' },
          headStyles: { fillColor: [20, 60, 120] },
        });
        y = (doc as any).lastAutoTable.finalY + 5;
      } else if (typeof sec4.sub_responsabili === 'string') {
        y = writeBody(doc, stripMarkdown(sec4.sub_responsabili), y);
        y += 3;
      } else if (typeof sec4.sub_responsabili === 'object') {
        y = writeBody(doc, stripMarkdown(JSON.stringify(sec4.sub_responsabili)), y);
        y += 3;
      }
    }

    // Periodi di conservazione (differenziati per finalità)
    if (Array.isArray(sec4.periodi_conservazione) && sec4.periodi_conservazione.length > 0) {
      y = writeSubTitle(doc, 'Periodi di Conservazione', y);
      y = ensureSpace(doc, y, 20);
      autoTable(doc, {
        startY: y,
        head: [['Finalità', 'Periodo', 'Base Normativa']],
        body: sec4.periodi_conservazione.map((p: any) => [
          stripMarkdown(p.finalita || ''),
          stripMarkdown(p.periodo || ''),
          stripMarkdown(p.base_normativa || ''),
        ]),
        margin: { left: MARGIN_LEFT, right: MARGIN_RIGHT },
        styles: { fontSize: 8, cellPadding: 2, overflow: 'linebreak' },
        headStyles: { fillColor: [20, 60, 120] },
        columnStyles: { 0: { cellWidth: 50 }, 1: { cellWidth: 30 } },
      });
      y = (doc as any).lastAutoTable.finalY + 5;
    } else if (sec4.periodo_conservazione) {
      y = writeSubTitle(doc, 'Periodo di Conservazione', y);
      y = writeBody(doc, stripMarkdown(sec4.periodo_conservazione), y);
      y += 3;
    }

    // Applicativi
    if (sec4.applicativi) {
      y = writeSubTitle(doc, 'Applicativi Utilizzati', y);
      if (Array.isArray(sec4.applicativi) && sec4.applicativi.length > 0) {
        y = ensureSpace(doc, y, 20);
        autoTable(doc, {
          startY: y,
          head: [['Nome', 'Descrizione']],
          body: sec4.applicativi.map((app: any) => [
            app.nome || '',
            stripMarkdown(app.descrizione || ''),
          ]),
          margin: { left: MARGIN_LEFT, right: MARGIN_RIGHT },
          styles: { fontSize: 8, cellPadding: 3, overflow: 'linebreak' },
          headStyles: { fillColor: [20, 60, 120] },
          columnStyles: { 0: { cellWidth: 50 } },
        });
        y = (doc as any).lastAutoTable.finalY + 5;
      } else if (typeof sec4.applicativi === 'string') {
        y = writeBody(doc, stripMarkdown(sec4.applicativi), y);
        y += 3;
      }
    }

    // Componenti
    if (sec4.componenti_organizzative) { y = writeSubTitle(doc, 'Componenti Organizzative', y); y = writeBody(doc, stripMarkdown(sec4.componenti_organizzative), y); y += 3; }
    if (sec4.componenti_tecnologiche) {
      y = writeSubTitle(doc, 'Componenti Tecnologiche', y);
      const ct = sec4.componenti_tecnologiche;
      if (ct.soggetti_interni) { y = writeLabel(doc, 'Soggetti Interni:', y); y = writeBody(doc, stripMarkdown(ct.soggetti_interni), y, MARGIN_LEFT, 4); y += 2; }
      if (ct.soggetti_esterni) { y = writeLabel(doc, 'Soggetti Esterni:', y); y = writeBody(doc, stripMarkdown(ct.soggetti_esterni), y, MARGIN_LEFT, 4); y += 2; }
      if (ct.software_applicativi) { y = writeLabel(doc, 'Software/Applicativi:', y); y = writeBody(doc, stripMarkdown(ct.software_applicativi), y, MARGIN_LEFT, 4); y += 2; }
      if (ct.connessioni_rete) { y = writeLabel(doc, 'Connessioni di Rete:', y); y = writeBody(doc, stripMarkdown(ct.connessioni_rete), y, MARGIN_LEFT, 4); y += 2; }
      y += 3;
    }
    if (sec4.componenti_fisiche) { y = writeSubTitle(doc, 'Componenti Fisiche', y); y = writeBody(doc, stripMarkdown(sec4.componenti_fisiche), y); y += 3; }

    y += 4;
  }

  // Section 5
  if (content.section_5_proporzionalita) {
    y = writeSectionTitle(doc, "5. Valutazione della Proporzionalità", y);
    y = writeBody(doc, stripMarkdown(content.section_5_proporzionalita), y);
    y += 6;
  }

  // Section 6
  if (content.section_6_diritti_principi) {
    y = writeSectionTitle(doc, "6. Diritti e Principi Fondamentali", y);
    const sec6 = content.section_6_diritti_principi;
    if (sec6.diritti_interessato) {
      y = writeSubTitle(doc, "Diritti dell'Interessato", y);
      const dirittiMapping: Record<string, string> = {
        accesso_art15: 'Diritto di Accesso (Art. 15)',
        rettifica_art16: 'Diritto di Rettifica (Art. 16)',
        cancellazione_art17: 'Diritto alla Cancellazione (Art. 17)',
        portabilita_art20: 'Diritto alla Portabilità (Art. 20)',
        opposizione_art21: 'Diritto di Opposizione (Art. 21)',
        limitazione_art18: 'Diritto alla Limitazione (Art. 18)',
        revoca_consenso: 'Revoca del Consenso',
        decisioni_automatizzate_art22: 'Decisioni Automatizzate (Art. 22)',
      };
      const renderedDirittiKeys = new Set<string>();
      for (const [key, label] of Object.entries(dirittiMapping)) {
        const value = sec6.diritti_interessato[key];
        if (value) {
          y = writeLabel(doc, label + ':', y);
          y = writeBody(doc, stripMarkdown(value), y, MARGIN_LEFT, 4);
          y += 2;
          renderedDirittiKeys.add(key);
        }
      }
      for (const [key, value] of Object.entries(sec6.diritti_interessato)) {
        if (!renderedDirittiKeys.has(key) && value && typeof value === 'string') {
          y = writeLabel(doc, humanize(key) + ':', y);
          y = writeBody(doc, stripMarkdown(value), y, MARGIN_LEFT, 4);
          y += 2;
        }
      }
      y += 3;
    }
    if (sec6.principi) {
      y = writeSubTitle(doc, "Principi Fondamentali", y);
      const principi: Record<string, string> = {
        liceita_correttezza_trasparenza: 'Liceità, Correttezza e Trasparenza',
        limitazione_finalita: 'Limitazione della Finalità',
        minimizzazione_dati: 'Minimizzazione dei Dati',
        minimizzazione: 'Minimizzazione dei Dati',
        esattezza: 'Esattezza dei Dati',
        limitazione_conservazione: 'Limitazione della Conservazione',
        integrita_riservatezza: 'Integrità e Riservatezza',
      };
      const renderedPrincipiKeys = new Set<string>();
      for (const [key, label] of Object.entries(principi)) {
        const value = sec6.principi[key];
        if (value) {
          y = writeLabel(doc, label + ':', y);
          y = writeBody(doc, stripMarkdown(value), y, MARGIN_LEFT, 4);
          y += 2;
          renderedPrincipiKeys.add(key);
        }
      }
      for (const [key, value] of Object.entries(sec6.principi)) {
        if (!renderedPrincipiKeys.has(key) && value && typeof value === 'string') {
          y = writeLabel(doc, humanize(key) + ':', y);
          y = writeBody(doc, stripMarkdown(value), y, MARGIN_LEFT, 4);
          y += 2;
        }
      }
      y += 3;
    }
    y += 4;
  }

  // Section 7
  if (content.section_7_valutazione_rischio) {
    y = writeSectionTitle(doc, "7. Valutazione del Rischio", y);
    const sec7 = content.section_7_valutazione_rischio;

    if (Array.isArray(sec7.misure_sicurezza_trattamenti) && sec7.misure_sicurezza_trattamenti.length > 0) {
      y = writeSubTitle(doc, "Misure Trasversali Relative ai Trattamenti", y);
      y = ensureSpace(doc, y, 20);
      autoTable(doc, {
        startY: y,
        head: [["Categoria", "Misura", "Stato"]],
        body: sec7.misure_sicurezza_trattamenti.map((m: any) => [m.categoria || "", m.misura || "", m.stato || ""]),
        margin: { left: MARGIN_LEFT, right: MARGIN_RIGHT },
        styles: { fontSize: 8, cellPadding: 2, overflow: "linebreak" },
        headStyles: { fillColor: [20, 60, 120] },
        columnStyles: { 0: { cellWidth: 40 }, 2: { cellWidth: 28 } },
      });
      y = (doc as any).lastAutoTable.finalY + 6;
    }

    if (sec7.misure_sicurezza_asset) {
      y = writeSubTitle(doc, "Misure di Sicurezza Relative agli Asset", y);
      const assetCategories = ["credenziali", "protezione_dati", "cifratura", "backup", "hardware_fisico", "certificazioni_continuita"];
      for (const cat of assetCategories) {
        const items = sec7.misure_sicurezza_asset[cat];
        if (Array.isArray(items) && items.length > 0) {
          y = writeLabel(doc, humanize(cat) + ":", y);
          y = ensureSpace(doc, y, 15);
          autoTable(doc, {
            startY: y,
            head: [["Misura", "Stato"]],
            body: items.map((m: any) => [m.misura || "", m.stato || ""]),
            margin: { left: MARGIN_LEFT + 4, right: MARGIN_RIGHT },
            styles: { fontSize: 8, cellPadding: 2, overflow: "linebreak" },
            headStyles: { fillColor: [60, 100, 160] },
            columnStyles: { 1: { cellWidth: 28 } },
          });
          y = (doc as any).lastAutoTable.finalY + 4;
        }
      }
    }

    if (Array.isArray(sec7.valutazione_minacce) && sec7.valutazione_minacce.length > 0) {
      y = writeSubTitle(doc, "Valutazione delle Minacce", y);
      for (const minaccia of sec7.valutazione_minacce) {
        y = ensureSpace(doc, y, 40);
        y = writeLabel(doc, `Minaccia: ${minaccia.nome_minaccia || "—"}`, y);
        if (minaccia.aree_impatto) y = writeBody(doc, `Aree impatto: ${Array.isArray(minaccia.aree_impatto) ? minaccia.aree_impatto.join(", ") : minaccia.aree_impatto}`, y);
        if (minaccia.fonti_rischio) y = writeBody(doc, `Fonti rischio: ${Array.isArray(minaccia.fonti_rischio) ? minaccia.fonti_rischio.join(", ") : minaccia.fonti_rischio}`, y);

        if (minaccia.rischio_iniziale) {
          const ri = minaccia.rischio_iniziale;
          y = writeBody(doc, `Rischio Iniziale: Impatto(${ri.impatto_M}) x Probabilita(${ri.probabilita_p}) = ${ri.valore_R} -> ${ri.livello}`, y);
        }

        if (Array.isArray(minaccia.misure_mitigazione)) {
          y = writeBody(doc, `Misure: ${minaccia.misure_mitigazione.map((m: string) => stripMarkdown(m)).join("; ")}`, y);
        }

        // Indicatori di efficacia
        if (Array.isArray(minaccia.indicatori_efficacia) && minaccia.indicatori_efficacia.length > 0) {
          y = writeLabel(doc, "Indicatori di Efficacia:", y);
          for (const ind of minaccia.indicatori_efficacia) {
            y = writeBody(doc, `- ${stripMarkdown(ind)}`, y, MARGIN_LEFT, 4);
          }
          y += 2;
        }

        if (minaccia.rischio_residuo) {
          const rr = minaccia.rischio_residuo;
          y = writeBody(doc, `Rischio Residuo: Impatto(${rr.impatto_M}) x Probabilita(${rr.probabilita_p}) = ${rr.valore_R} -> ${rr.livello}`, y);
        }

        if (minaccia.motivazione_accettazione) {
          y = writeBody(doc, stripMarkdown(`Motivazione accettazione: ${minaccia.motivazione_accettazione}`), y);
        }

        // Piano d'azione correttivo per questa minaccia
        if (Array.isArray(minaccia.piano_azione_correttivo) && minaccia.piano_azione_correttivo.length > 0) {
          y = writeLabel(doc, "Piano d'Azione Correttivo:", y);
          y = ensureSpace(doc, y, 20);
          autoTable(doc, {
            startY: y,
            head: [["ID", "Descrizione", "Responsabile", "Scadenza", "Effort", "Priorita"]],
            body: minaccia.piano_azione_correttivo.map((a: any) => [
              a.id_misura || "",
              stripMarkdown(a.descrizione || ""),
              a.responsabile || "",
              a.scadenza_giorni ? `${a.scadenza_giorni} gg` : "",
              a.effort || "",
              a.priorita || "",
            ]),
            margin: { left: MARGIN_LEFT, right: MARGIN_RIGHT },
            styles: { fontSize: 7, cellPadding: 2, overflow: "linebreak" },
            headStyles: { fillColor: [20, 60, 120] },
            columnStyles: { 0: { cellWidth: 16 }, 2: { cellWidth: 24 }, 3: { cellWidth: 18 }, 4: { cellWidth: 16 }, 5: { cellWidth: 16 } },
          });
          y = (doc as any).lastAutoTable.finalY + 4;
        }

        y += 4;
      }
    }

    if (sec7.riepilogo) {
      y = writeSubTitle(doc, "Riepilogo Rischio", y);
      const riep = sec7.riepilogo;
      const riepRows: string[][] = [];
      if (riep.rischio_riservatezza) riepRows.push(['Riservatezza', riep.rischio_riservatezza]);
      if (riep.rischio_integrita) riepRows.push(['Integrita', riep.rischio_integrita]);
      if (riep.rischio_disponibilita) riepRows.push(['Disponibilita', riep.rischio_disponibilita]);
      if (riep.rischio_complessivo_residuo) riepRows.push(['Rischio Complessivo Residuo', riep.rischio_complessivo_residuo]);
      if (riepRows.length > 0) {
        y = ensureSpace(doc, y, 20);
        autoTable(doc, {
          startY: y,
          head: [['Area', 'Livello']],
          body: riepRows,
          margin: { left: MARGIN_LEFT, right: MARGIN_RIGHT },
          styles: { fontSize: 9, cellPadding: 3 },
          headStyles: { fillColor: [20, 60, 120] },
          columnStyles: { 0: { fontStyle: 'bold', cellWidth: 60 } },
        });
        y = (doc as any).lastAutoTable.finalY + 4;
      }
    }
    y += 4;
  }

  // Section 8
  if (content.section_8_coinvolgimento_parti) {
    y = writeSectionTitle(doc, "8. Coinvolgimento delle Parti Interessate", y);
    const sec8 = content.section_8_coinvolgimento_parti;
    if (sec8.opinioni_interessati_raccolte) {
      y = writeLabel(doc, 'Opinioni degli Interessati Raccolte:', y);
      y = writeBody(doc, stripMarkdown(sec8.opinioni_interessati_raccolte), y, MARGIN_LEFT, 4);
      y += 3;
    }
    if (sec8.piano_consultazione_interessati) {
      y = writeLabel(doc, 'Piano di Consultazione degli Interessati:', y);
      y = writeBody(doc, stripMarkdown(sec8.piano_consultazione_interessati), y, MARGIN_LEFT, 4);
      y += 3;
    }
    if (sec8.dpo_coinvolto) {
      y = writeLabel(doc, 'DPO Coinvolto:', y);
      y = writeBody(doc, stripMarkdown(sec8.dpo_coinvolto), y, MARGIN_LEFT, 4);
      y += 3;
    }
    if (sec8.parere_dpo) {
      y = writeLabel(doc, 'Parere Finale del DPO:', y);
      y = writeBody(doc, stripMarkdown(sec8.parere_dpo), y, MARGIN_LEFT, 4);
      y += 3;
    }
    y += 4;
  }

  // Section 9
  if (content.section_9_note_conclusioni) {
    y = writeSectionTitle(doc, "9. Note e Conclusioni", y);
    y = writeBody(doc, stripMarkdown(content.section_9_note_conclusioni), y);
    y += 6;
  }

  // Section 10
  if (content.section_10_decisione_finale) {
    y = writeSectionTitle(doc, "10. Decisione Finale", y);
    const sec10 = content.section_10_decisione_finale;
    if (sec10.decisione) {
      y = writeLabel(doc, "Decisione:", y);
      y = writeBody(doc, stripMarkdown(sec10.decisione), y, MARGIN_LEFT, 4);
      y += 2;
    }
    if (sec10.motivazione) {
      y = writeLabel(doc, "Motivazione:", y);
      y = writeBody(doc, stripMarkdown(sec10.motivazione), y, MARGIN_LEFT, 4);
      y += 2;
    }
    if (sec10.condizioni_vincoli) {
      y = writeLabel(doc, "Condizioni e Vincoli:", y);
      y = writeBody(doc, stripMarkdown(sec10.condizioni_vincoli), y, MARGIN_LEFT, 4);
      y += 2;
    }
    if (sec10.consultazione_preventiva) {
      y = writeLabel(doc, "Consultazione Preventiva (Art. 36):", y);
      y = writeBody(doc, stripMarkdown(sec10.consultazione_preventiva), y, MARGIN_LEFT, 4);
    }
    y += 6;
  }

  // Section 11
  if (content.section_11_piano_revisione) {
    y = writeSectionTitle(doc, "11. Piano di Revisione", y);
    const sec11 = content.section_11_piano_revisione;
    if (sec11.frequenza_revisione) {
      y = writeLabel(doc, "Frequenza di Revisione:", y);
      y = writeBody(doc, sec11.frequenza_revisione, y, MARGIN_LEFT, 4);
      y += 2;
    }
    if (Array.isArray(sec11.trigger_revisione_straordinaria) && sec11.trigger_revisione_straordinaria.length > 0) {
      y = writeLabel(doc, "Trigger Revisione Straordinaria:", y);
      for (const trigger of sec11.trigger_revisione_straordinaria) {
        y = writeBody(doc, `• ${trigger}`, y, MARGIN_LEFT, 4);
      }
      y += 2;
    }
    if (sec11.responsabile_revisione) {
      y = writeLabel(doc, "Responsabile Revisione:", y);
      y = writeBody(doc, sec11.responsabile_revisione, y, MARGIN_LEFT, 4);
      y += 2;
    }
    if (Array.isArray(sec11.log_versioni) && sec11.log_versioni.length > 0) {
      y = writeLabel(doc, "Log Versioni:", y);
      y = ensureSpace(doc, y, 20);
      autoTable(doc, {
        startY: y,
        head: [["Versione", "Data", "Autore", "Modifiche"]],
        body: sec11.log_versioni.map((v: any) => [v.versione || "", v.data || "", v.autore || "", v.modifiche || ""]),
        margin: { left: MARGIN_LEFT, right: MARGIN_RIGHT },
        styles: { fontSize: 8, cellPadding: 2, overflow: "linebreak" },
        headStyles: { fillColor: [20, 60, 120] },
      });
      y = (doc as any).lastAutoTable.finalY + 4;
    }
    if (sec11.prossima_revisione) {
      y = writeLabel(doc, "Prossima Revisione:", y);
      y = writeBody(doc, sec11.prossima_revisione, y, MARGIN_LEFT, 4);
    }
    y += 6;
  }

  // Checklist GDPR (extended with date/responsabile for "Da verificare")
  if (Array.isArray(content.checklist_gdpr) && content.checklist_gdpr.length > 0) {
    y = writeSectionTitle(doc, "Checklist Finale GDPR", y);
    y = ensureSpace(doc, y, 20);
    autoTable(doc, {
      startY: y,
      head: [["Elemento", "Stato", "Data Verifica", "Responsabile", "Note"]],
      body: content.checklist_gdpr.map((c: any) => [
        stripMarkdown(c.elemento) || "",
        stripMarkdown(c.stato) || "",
        c.data_verifica_prevista || "",
        c.responsabile_verifica || "",
        stripMarkdown(c.note) || "",
      ]),
      margin: { left: MARGIN_LEFT, right: MARGIN_RIGHT },
      styles: { fontSize: 7, cellPadding: 2, overflow: "linebreak" },
      headStyles: { fillColor: [20, 60, 120] },
      columnStyles: { 0: { cellWidth: 50 }, 1: { cellWidth: 22 }, 2: { cellWidth: 22 }, 3: { cellWidth: 22 } },
    });
    y = (doc as any).lastAutoTable.finalY + 6;
  }

  // Suggerimenti Privacy by Design
  if (Array.isArray(content.suggerimenti_privacy_by_design) && content.suggerimenti_privacy_by_design.length > 0) {
    y = writeSectionTitle(doc, "Suggerimenti Privacy by Design", y);
    y = ensureSpace(doc, y, 20);
    autoTable(doc, {
      startY: y,
      head: [["Area", "Suggerimento", "Priorità"]],
      body: content.suggerimenti_privacy_by_design.map((s: any) => [s.area || "", s.suggerimento || "", s.priorita || ""]),
      margin: { left: MARGIN_LEFT, right: MARGIN_RIGHT },
      styles: { fontSize: 8, cellPadding: 2, overflow: "linebreak" },
      headStyles: { fillColor: [20, 60, 120] },
      columnStyles: { 0: { cellWidth: 35 }, 2: { cellWidth: 22 } },
    });
    y = (doc as any).lastAutoTable.finalY + 6;
  }

  // ISO 27001 Mapping (audit mode)
  if (Array.isArray(content.iso27001_mapping) && content.iso27001_mapping.length > 0) {
    y = writeSectionTitle(doc, "Mappatura GDPR ↔ ISO 27001:2022", y);
    y = ensureSpace(doc, y, 20);
    autoTable(doc, {
      startY: y,
      head: [["Requisito GDPR", "Controllo ISO 27001", "Stato", "Note"]],
      body: content.iso27001_mapping.map((m: any) => [m.requisito_gdpr || "", m.controllo_iso27001 || "", m.stato_implementazione || "", m.note || ""]),
      margin: { left: MARGIN_LEFT, right: MARGIN_RIGHT },
      styles: { fontSize: 7, cellPadding: 2, overflow: "linebreak" },
      headStyles: { fillColor: [20, 60, 120] },
    });
    y = (doc as any).lastAutoTable.finalY + 6;
  }

  // Firma Finale
  if (content.firma_finale) {
    y = writeSectionTitle(doc, "Firma Finale", y);
    y = ensureSpace(doc, y, 60);
    const firma = content.firma_finale;
    y += 4;
    y = writeBody(doc, `Il Titolare del Trattamento: ${firma.titolare_nome || "[DA COMPLETARE]"}`, y);
    y += 4;
    y = writeBody(doc, "Firma: _________________________    Data: ___/___/______", y);
    y += 10;
    y = writeBody(doc, `Il DPO: ${firma.dpo_nome || "[DA COMPLETARE]"}`, y);
    y += 4;
    y = writeBody(doc, "Firma: _________________________    Data: ___/___/______", y);
    y += 10;
    y = writeBody(doc, `Approvato dal Management: ${firma.management_nome || "[DA COMPLETARE]"}`, y);
    y += 4;
    y = writeBody(doc, "Firma: _________________________    Data: ___/___/______", y);
    if (firma.luogo) {
      y += 6;
      y = writeBody(doc, `Luogo: ${firma.luogo}`, y);
    }
  }

  // Footer on all pages
  addFooters(doc, content.title || "DPIA");
}

// ── RoPA PDF ──

function exportRoPA(doc: jsPDF, content: any) {
  let y = MARGIN_TOP;

  // Cover
  doc.setFontSize(16);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(20, 60, 120);
  const titleLines = doc.splitTextToSize(content.title || "RoPA", SAFE_WIDTH);
  for (const line of titleLines) {
    doc.text(line, PAGE_WIDTH / 2, y, { align: "center" });
    y += 7;
  }
  doc.setTextColor(0, 0, 0);
  y += 4;

  // Header info
  if (content.intestazione) {
    const header = content.intestazione;
    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");
    if (header.nome_azienda) {
      doc.text(header.nome_azienda, PAGE_WIDTH / 2, y, { align: "center" });
      y += 5;
    }
    if (header.partita_iva) {
      doc.text(`P.IVA: ${header.partita_iva}`, PAGE_WIDTH / 2, y, { align: "center" });
      y += 5;
    }
    if (header.data_documento) {
      doc.text(`Data: ${header.data_documento}`, PAGE_WIDTH / 2, y, { align: "center" });
      y += 5;
    }
    y += 8;
  }

  // Activities
  if (Array.isArray(content.attivita_trattamento)) {
    for (let i = 0; i < content.attivita_trattamento.length; i++) {
      const att = content.attivita_trattamento[i];

      // Activity header
      y = ensureSpace(doc, y, 30);
      doc.setDrawColor(20, 60, 120);
      doc.setLineWidth(0.5);
      doc.line(MARGIN_LEFT, y, PAGE_WIDTH - MARGIN_RIGHT, y);
      y += 6;

      doc.setFontSize(12);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(20, 60, 120);
      const actTitle = `${att.codice || String(i + 1).padStart(3, "0")} - ${att.denominazione || `ATTIVITÀ ${i + 1}`}`;
      y = writeWrapped(doc, actTitle, MARGIN_LEFT, y, SAFE_WIDTH, 6);
      doc.setTextColor(0, 0, 0);
      y += 3;

      // Descrizione sintetica
      if (att.descrizione_sintetica) {
        y = writeLabel(doc, "Descrizione sintetica:", y);
        y = writeBody(doc, att.descrizione_sintetica, y, MARGIN_LEFT, 4);
        y += 2;
      }

      // Descrizione estesa
      if (att.descrizione_estesa) {
        y = writeLabel(doc, "Descrizione estesa:", y);
        y = writeBody(doc, att.descrizione_estesa, y, MARGIN_LEFT, 4);
        y += 2;
      }

      // Titolare
      if (att.titolare_trattamento && typeof att.titolare_trattamento === "object") {
        y = writeLabel(doc, "Titolare del Trattamento:", y);
        const t = att.titolare_trattamento;
        const parts = [t.ragione_sociale, t.indirizzo, t.telefono && `Tel: ${t.telefono}`, t.pec && `PEC: ${t.pec}`, t.email && `Email: ${t.email}`].filter(Boolean);
        y = writeBody(doc, parts.join(" | "), y, MARGIN_LEFT, 4);
        y += 2;
      }

      // Responsabile
      if (att.responsabile_trattamento && typeof att.responsabile_trattamento === "object") {
        y = writeLabel(doc, "Responsabile del Trattamento (Art. 28):", y);
        const r = att.responsabile_trattamento;
        const parts = [r.ragione_sociale, r.indirizzo, r.telefono && `Tel: ${r.telefono}`, r.email && `Email: ${r.email}`].filter(Boolean);
        y = writeBody(doc, parts.join(" | "), y, MARGIN_LEFT, 4);
        y += 2;
      }

      // DPO
      if (att.dpo && typeof att.dpo === "object") {
        y = writeLabel(doc, "DPO:", y);
        const d = att.dpo;
        const parts = [d.nome_cognome, d.indirizzo, d.telefono && `Tel: ${d.telefono}`, d.cellulare && `Cell: ${d.cellulare}`, d.pec && `PEC: ${d.pec}`, d.email && `Email: ${d.email}`].filter(Boolean);
        y = writeBody(doc, parts.join(" | "), y, MARGIN_LEFT, 4);
        y += 2;
      }

      // Categorie trattamento
      if (Array.isArray(att.categorie_trattamento) && att.categorie_trattamento.length > 0) {
        y = writeLabel(doc, "Categorie del Trattamento:", y);
        for (const cat of att.categorie_trattamento) {
          y = writeBody(doc, `• ${cat}`, y, MARGIN_LEFT, 4);
        }
        y += 2;
      }

      // Tempi conservazione
      if (att.tempi_conservazione && typeof att.tempi_conservazione === "object") {
        y = writeLabel(doc, "Tempi di Conservazione:", y);
        const tc = att.tempi_conservazione;
        if (tc.data_inizio) y = writeBody(doc, `Data inizio: ${tc.data_inizio}`, y, MARGIN_LEFT, 4);
        if (tc.conclusione) y = writeBody(doc, `Conclusione: ${tc.conclusione}`, y, MARGIN_LEFT, 4);
        y += 2;
      }

      // Misure sicurezza
      if (Array.isArray(att.misure_sicurezza) && att.misure_sicurezza.length > 0) {
        y = writeLabel(doc, "Misure di Sicurezza:", y);
        for (const m of att.misure_sicurezza) {
          y = writeBody(doc, `• ${m}`, y, MARGIN_LEFT, 4);
        }
        y += 2;
      }

      // Ulteriori informazioni
      if (att.ulteriori_informazioni && typeof att.ulteriori_informazioni === "object") {
        y = writeLabel(doc, "Ulteriori Informazioni:", y);
        const ui = att.ulteriori_informazioni;
        if (ui.riguarda_minori) y = writeBody(doc, `Riguarda minori: ${ui.riguarda_minori}`, y, MARGIN_LEFT, 4);
        if (ui.dati_raccolti_presso_interessato) y = writeBody(doc, `Dati raccolti presso interessato: ${ui.dati_raccolti_presso_interessato}`, y, MARGIN_LEFT, 4);
        if (ui.profilazione_processi_automatizzati) y = writeBody(doc, `Profilazione/processi automatizzati: ${ui.profilazione_processi_automatizzati}`, y, MARGIN_LEFT, 4);
        y += 2;
      }

      // Condizioni liceità
      if (att.condizioni_liceita) {
        y = writeLabel(doc, "Condizioni di Liceità:", y);
        y = writeBody(doc, att.condizioni_liceita, y, MARGIN_LEFT, 4);
        y += 2;
      }

      y += 6;
    }
  }

  addFooters(doc, content.title || "RoPA");
}

// ── LIA PDF ──

function sectionTitle(doc: jsPDF, y: number, text: string): number {
  y = ensureSpace(doc, y, 15);
  doc.setFontSize(13);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(30, 58, 95);
  doc.text(text, MARGIN_LEFT, y);
  y += 3;
  doc.setDrawColor(30, 58, 95);
  doc.setLineWidth(0.3);
  doc.line(MARGIN_LEFT, y, PAGE_WIDTH - MARGIN_RIGHT, y);
  y += 6;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.setTextColor(0, 0, 0);
  return y;
}

function fieldRow(doc: jsPDF, y: number, label: string, value: string | undefined | null): number {
  if (!value) return y;
  y = ensureSpace(doc, y, 8);
  doc.setFontSize(9);
  doc.setFont("helvetica", "bold");
  const labelText = `${label}: `;
  doc.text(labelText, MARGIN_LEFT, y);
  const labelWidth = doc.getTextWidth(labelText);
  doc.setFont("helvetica", "normal");
  const valueLines = doc.splitTextToSize(String(value), SAFE_WIDTH - labelWidth);
  doc.text(valueLines[0], MARGIN_LEFT + labelWidth, y);
  y += LINE_HEIGHT;
  for (let i = 1; i < valueLines.length; i++) {
    y = ensureSpace(doc, y, LINE_HEIGHT + 2);
    doc.text(valueLines[i], MARGIN_LEFT + 5, y);
    y += LINE_HEIGHT;
  }
  return y + 1;
}

function formatCurrency(value: unknown): string {
  const amount = Number(value || 0);
  return Number.isFinite(amount) ? amount.toLocaleString("it-IT") : "0";
}

function exportLIA(doc: jsPDF, content: any) {
  let y = MARGIN_TOP;

  // Title
  doc.setFontSize(18);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(30, 58, 95);
  const title = content.title || "Legitimate Interest Assessment (LIA)";
  const titleLines = doc.splitTextToSize(title, SAFE_WIDTH);
  for (const line of titleLines) {
    doc.text(line, PAGE_WIDTH / 2, y, { align: "center" });
    y += 8;
  }
  y += 5;
  doc.setDrawColor(30, 58, 95);
  doc.setLineWidth(0.5);
  doc.line(MARGIN_LEFT, y, PAGE_WIDTH - MARGIN_RIGHT, y);
  y += 10;

  // Section 1: Informazioni Generali
  y = sectionTitle(doc, y, "1. INFORMAZIONI GENERALI");
  if (content.informazioni_generali) {
    const info = content.informazioni_generali;
    y = fieldRow(doc, y, "Data", info.data);
    y = fieldRow(doc, y, "Versione", info.versione);
    y = fieldRow(doc, y, "Autore", info.autore);
    y = fieldRow(doc, y, "Organizzazione", info.organizzazione);
    y = fieldRow(doc, y, "Base giuridica", info.base_giuridica);
    y += 3;
    y = writeSubTitle(doc, "Descrizione del trattamento", y);
    y = writeWrapped(doc, info.descrizione_trattamento, MARGIN_LEFT, y, SAFE_WIDTH);
    y += 5;
  }

  // Section 2.1: Purpose Test
  y = sectionTitle(doc, y, "2.1 PURPOSE TEST — Test di Finalità");
  if (content.purpose_test) {
    const pt = content.purpose_test;
    y = fieldRow(doc, y, "Interesse legittimo", pt.interesse_legittimo);
    y = fieldRow(doc, y, "Interesse reale e attuale", pt.interesse_reale_attuale);
    y = fieldRow(doc, y, "Interesse lecito", pt.interesse_lecito);
    y += 2;
    y = writeSubTitle(doc, "Necessità del trattamento", y);
    y = writeWrapped(doc, pt.necessita_trattamento, MARGIN_LEFT, y, SAFE_WIDTH);
    y = fieldRow(doc, y + 3, "Esito", pt.esito);
    y += 5;
  }

  // Section 2.2: Necessity Test
  y = sectionTitle(doc, y, "2.2 NECESSITY TEST — Test di Necessità");
  if (content.necessity_test) {
    const nt = content.necessity_test;
    y = fieldRow(doc, y, "Stretta necessità", nt.stretta_necessita);
    y = fieldRow(doc, y, "Alternative meno intrusive", nt.alternative_meno_intrusive);
    y = fieldRow(doc, y, "Proporzionalità dati", nt.proporzionalita_dati);
    y = fieldRow(doc, y, "Durata conservazione", nt.durata_conservazione);
    y = fieldRow(doc, y, "Esito", nt.esito);
    y += 5;
  }

  // Section 2.3: Balancing Test
  y = sectionTitle(doc, y, "2.3 BALANCING TEST — Test di Bilanciamento");
  if (content.balancing_test) {
    const bt = content.balancing_test;
    y = fieldRow(doc, y, "Diritti interessati", bt.diritti_interessati);
    y = fieldRow(doc, y, "Impatto prevedibile", bt.impatto_prevedibile);
    y = fieldRow(doc, y, "Aspettativa ragionevole", bt.aspettativa_ragionevole);
    y = fieldRow(doc, y, "Categorie vulnerabili", bt.categorie_vulnerabili);
    y += 2;
    y = writeSubTitle(doc, "Misure di mitigazione", y);
    y = writeWrapped(doc, bt.misure_mitigazione, MARGIN_LEFT, y, SAFE_WIDTH);
    y = fieldRow(doc, y + 3, "Esito bilanciamento", bt.esito_bilanciamento);

    // Balancing table
    if (bt.tabella_bilanciamento?.length > 0) {
      y += 5;
      y = ensureSpace(doc, y, 40);
      autoTable(doc, {
        startY: y,
        head: [['Criterio', 'Interesse Titolare', 'Diritto Interessato', 'Valutazione']],
        body: bt.tabella_bilanciamento.map((r: any) => [r.criterio, r.interesse_titolare, r.diritto_interessato, r.valutazione]),
        styles: { fontSize: 8, cellPadding: 3 },
        headStyles: { fillColor: [30, 58, 95], textColor: 255 },
        margin: { left: MARGIN_LEFT, right: MARGIN_RIGHT },
      });
      y = (doc as any).lastAutoTable?.finalY + 8 || y + 40;
    }
    y += 5;
  }

  // Section 3: Misure di Salvaguardia
  y = sectionTitle(doc, y, "3. MISURE DI SALVAGUARDIA");
  if (content.misure_salvaguardia) {
    const ms = content.misure_salvaguardia;
    if (ms.misure_tecniche?.length > 0) {
      y = writeSubTitle(doc, "Misure tecniche", y);
      for (const m of ms.misure_tecniche) {
        y = writeWrapped(doc, `• ${m}`, MARGIN_LEFT + 3, y, SAFE_WIDTH - 3);
      }
      y += 3;
    }
    if (ms.misure_organizzative?.length > 0) {
      y = writeSubTitle(doc, "Misure organizzative", y);
      for (const m of ms.misure_organizzative) {
        y = writeWrapped(doc, `• ${m}`, MARGIN_LEFT + 3, y, SAFE_WIDTH - 3);
      }
      y += 3;
    }
    y = fieldRow(doc, y, "Diritto di opposizione", ms.diritto_opposizione);
    y = fieldRow(doc, y, "Informativa", ms.informativa);
    y = fieldRow(doc, y, "Revisione periodica", ms.revisione_periodica);
    y += 5;
  }

  // Section 4: Conclusione
  y = sectionTitle(doc, y, "4. CONCLUSIONE E DECISIONE");
  if (content.conclusione) {
    y = fieldRow(doc, y, "Esito", content.conclusione.esito);
    y = fieldRow(doc, y, "Condizioni", content.conclusione.condizioni);
    y = fieldRow(doc, y, "Obblighi residui", content.conclusione.obblighi_residui);
    y = fieldRow(doc, y, "Data revisione", content.conclusione.data_revisione);
    y += 5;
  }

  // Section 5: Firma
  y = sectionTitle(doc, y, "5. FIRMA E APPROVAZIONE");
  if (content.firma) {
    y = fieldRow(doc, y, "Titolare del trattamento", content.firma.titolare || '[DA COMPLETARE]');
    y = fieldRow(doc, y, "DPO", content.firma.dpo || '[DA COMPLETARE]');
    y = fieldRow(doc, y, "Data approvazione", content.firma.data_approvazione || '[DA COMPLETARE]');
  }
  y += 10;
  y = ensureSpace(doc, y, 20);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.text("Firma Titolare: _______________________", MARGIN_LEFT, y);
  doc.text("Firma DPO: _______________________", PAGE_WIDTH / 2, y);

  addFooters(doc, title);
}

// ── Gap Report PDF ──

function exportGapReport(doc: jsPDF, content: any) {
  let y = MARGIN_TOP;
  const riskRows = Array.isArray(content.matrice_rischi) ? content.matrice_rischi : [];
  const fineValue = (row: any, keys: string[]) => keys.map((key) => Number(row?.[key] || 0)).find((value) => value > 0) || 0;
  const totalRealistic = riskRows.reduce((sum: number, row: any) => sum + fineValue(row, ["sanzione_eur", "potential_fine_eur", "sanzione_realistica_eur"]), 0);
  const totalMax = riskRows.reduce((sum: number, row: any) => sum + (fineValue(row, ["sanzione_massima_teorica_eur", "potential_fine_max_eur", "massimo_teorico_eur"]) || fineValue(row, ["sanzione_eur", "potential_fine_eur", "sanzione_realistica_eur"])), 0);
  const formatCurrencyShort = (value: unknown): string => {
    const amount = Number(value || 0);
    if (!Number.isFinite(amount)) return "0";
    if (amount >= 1_000_000) return `${(amount / 1_000_000).toFixed(2).replace(".", ",")}M`;
    if (amount >= 1_000) return `${(amount / 1_000).toFixed(0)}K`;
    return formatCurrency(amount);
  };
  const totalInvestment = Number(content.analisi_finanziaria?.investimento_totale || 0);
  const totalHours = riskRows.reduce((sum: number, row: any) => sum + Number(row?.ore_stimate || row?.hours || 0), 0);
  const totalGaps = riskRows.length || content.risultati_per_normativa?.reduce((sum: number, reg: any) => sum + (reg.gap_identificati?.length || 0), 0) || 0;
  const critical = riskRows.filter((row: any) => String(row.rischio || row.risk_level || "").toLowerCase().includes("critical") || String(row.rischio || row.risk_level || "").toLowerCase().includes("critico")).length;
  const high = riskRows.filter((row: any) => String(row.rischio || row.risk_level || "").toLowerCase().includes("high") || String(row.rischio || row.risk_level || "").toLowerCase().includes("alto")).length;
  const regulation = content.ambito_analisi?.normative?.join(", ") || content.ambito_analisi?.normativa || "le normative selezionate";
  const compliance = content.compliance_percentuale || content.compliance_score || content.risultati_per_normativa?.[0]?.conformita_percentuale || "N/D";
  const complianceLabel = Number(compliance) >= 80 ? "buono" : Number(compliance) >= 60 ? "parziale" : "critico";
  const riskScore = content.risk_score || content.punteggio_rischio || "N/D";
  const summaryText = `L'analisi di conformità ha valutato ${regulation} identificando ${totalGaps} gap di conformità, di cui ${critical} critici e ${high} ad alto rischio. Il livello di compliance complessivo è del ${compliance}% (${complianceLabel}), con un punteggio di rischio di ${riskScore}/100. La stima realistica delle sanzioni potenziali è di €${formatCurrencyShort(totalRealistic)} (massimo teorico €${formatCurrencyShort(totalMax)} in scenario peggiore senza attenuanti). Il piano di remediation prevede un investimento di €${formatCurrency(totalInvestment)} e circa ${totalHours} ore di lavoro per colmare tutti i gap identificati.`;

  // Title
  doc.setFontSize(18);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(30, 58, 95);
  const title = content.title || "Gap Analysis Report";
  const titleLines = doc.splitTextToSize(title, SAFE_WIDTH);
  for (const line of titleLines) {
    doc.text(line, PAGE_WIDTH / 2, y, { align: "center" });
    y += 8;
  }
  y += 5;
  doc.setDrawColor(30, 58, 95);
  doc.setLineWidth(0.5);
  doc.line(MARGIN_LEFT, y, PAGE_WIDTH - MARGIN_RIGHT, y);
  y += 10;

  // Executive Summary
  y = sectionTitle(doc, y, "1. EXECUTIVE SUMMARY");
  y = writeWrapped(doc, summaryText, MARGIN_LEFT, y, SAFE_WIDTH);
  y += 3;
  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  y = ensureSpace(doc, y, 14);
  doc.text(`• Sanzioni potenziali (realistiche): €${formatCurrencyShort(totalRealistic)}`, MARGIN_LEFT, y);
  y += 5;
  doc.setTextColor(150, 30, 30);
  doc.text(`• Sanzioni massime teoriche: €${formatCurrencyShort(totalMax)}`, MARGIN_LEFT, y);
  doc.setTextColor(0, 0, 0);
  y += 5;
  y += 8;

  // Ambito
  if (content.ambito_analisi) {
    y = sectionTitle(doc, y, "2. AMBITO DELL'ANALISI");
    y = fieldRow(doc, y, "Normative", content.ambito_analisi.normative?.join(', '));
    y = fieldRow(doc, y, "Settore", content.ambito_analisi.settore);
    y = fieldRow(doc, y, "Giurisdizione", content.ambito_analisi.giurisdizione);
    y = fieldRow(doc, y, "Metodologia", content.ambito_analisi.metodologia);
    y += 8;
  }

  // Risultati per normativa
  if (content.risultati_per_normativa?.length > 0) {
    y = sectionTitle(doc, y, "3. RISULTATI PER NORMATIVA");
    for (const reg of content.risultati_per_normativa) {
      y = ensureSpace(doc, y, 20);
      y = writeSubTitle(doc, `${reg.normativa} — Conformità: ${reg.conformita_percentuale}%`, y);
      if (reg.gap_identificati?.length > 0) {
        autoTable(doc, {
          startY: y,
          head: [['Riferimento', 'Descrizione', 'Rischio', 'Ore', 'Costo €']],
          body: reg.gap_identificati.map((g: any) => [g.riferimento, g.descrizione?.substring(0, 60), g.rischio, g.ore_stimate, g.costo_eur?.toLocaleString()]),
          styles: { fontSize: 7, cellPadding: 2 },
          headStyles: { fillColor: [30, 58, 95], textColor: 255 },
          columnStyles: { 1: { cellWidth: 60 } },
          margin: { left: MARGIN_LEFT, right: MARGIN_RIGHT },
        });
        y = (doc as any).lastAutoTable?.finalY + 8 || y + 30;
      }
    }
  }

  // Matrice Rischi
  if (riskRows.length > 0) {
    y = sectionTitle(doc, y, "4. MATRICE DEI RISCHI");
    riskRows.forEach((gap: any, index: number) => {
      y = ensureSpace(doc, y, 42);
      doc.setFontSize(10);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(30, 58, 95);
      y = writeWrapped(doc, `${index + 1}. ${gap.gap || gap.descrizione || gap.requirement_reference || "Gap identificato"}`, MARGIN_LEFT, y, SAFE_WIDTH, 5);
      doc.setTextColor(0, 0, 0);
      doc.setFontSize(9);
      doc.setFont("helvetica", "normal");
      const detailY = y;
      doc.text(`Punteggio Rischio: ${gap.risk_score || gap.punteggio_rischio || "N/D"}/100`, MARGIN_LEFT + 3, y);
      const x2 = MARGIN_LEFT + 74;
      doc.setFont("helvetica", "bold");
      doc.text(`Sanzione attesa (realistica): €${formatCurrency(fineValue(gap, ["sanzione_eur", "potential_fine_eur", "sanzione_realistica_eur"]))}`, x2, y);
      doc.setFont("helvetica", "normal");
      y += 5;
      const maxFine = fineValue(gap, ["sanzione_massima_teorica_eur", "potential_fine_max_eur", "massimo_teorico_eur"]) || fineValue(gap, ["sanzione_eur", "potential_fine_eur", "sanzione_realistica_eur"]);
      doc.setTextColor(150, 30, 30);
      doc.text(`Massimo teorico: €${formatCurrency(maxFine)}`, x2, y);
      doc.setTextColor(0, 0, 0);
      y += 5;
      if (gap.fine_tier_basis || gap.base_normativa || gap.base_sanzionatoria) {
        doc.setFontSize(8);
        doc.setTextColor(100, 100, 100);
        doc.text(`Base: ${gap.fine_tier_basis || gap.base_normativa || gap.base_sanzionatoria}`, x2, y);
        doc.setFontSize(9);
        doc.setTextColor(0, 0, 0);
        y += 4;
      }
      y = Math.max(y, detailY + 5);
      doc.text(`Normativa: ${gap.normativa || "N/D"}`, MARGIN_LEFT + 3, y);
      doc.text(`Rischio: ${gap.rischio || gap.risk_level || "N/D"}`, MARGIN_LEFT + 74, y);
      doc.text(`Effort: ${gap.remediation_effort || gap.effort || "N/D"}`, MARGIN_LEFT + 124, y);
      y += 7;
    });
    y += 4;
  }

  // Piano Remediation
  if (content.piano_remediation) {
    y = sectionTitle(doc, y, "5. PIANO DI REMEDIATION");
    const pr = content.piano_remediation;
    if (pr.immediate?.length > 0) {
      y = writeSubTitle(doc, "Immediate (0-30 giorni)", y);
      for (const a of pr.immediate) {
        y = writeWrapped(doc, `• ${a}`, MARGIN_LEFT + 3, y, SAFE_WIDTH - 3);
      }
      y += 3;
    }
    if (pr.breve_termine?.length > 0) {
      y = writeSubTitle(doc, "Breve termine (1-3 mesi)", y);
      for (const a of pr.breve_termine) {
        y = writeWrapped(doc, `• ${a}`, MARGIN_LEFT + 3, y, SAFE_WIDTH - 3);
      }
      y += 3;
    }
    if (pr.medio_termine?.length > 0) {
      y = writeSubTitle(doc, "Medio termine (3-6 mesi)", y);
      for (const a of pr.medio_termine) {
        y = writeWrapped(doc, `• ${a}`, MARGIN_LEFT + 3, y, SAFE_WIDTH - 3);
      }
      y += 3;
    }
    y += 5;
  }

  // Analisi Finanziaria
  if (content.analisi_finanziaria) {
    y = sectionTitle(doc, y, "6. ANALISI FINANZIARIA");
    const af = content.analisi_finanziaria;
    const realisticTotal = totalRealistic || Number(af.sanzioni_realistiche || af.sanzioni_evitate || 0);
    const maxTotal = totalMax || Number(af.sanzioni_massime_teoriche || af.sanzioni_evitate || 0);
    y = ensureSpace(doc, y, 48);
    doc.setFont("helvetica", "bold");
    doc.text("Riepilogo Investimento", MARGIN_LEFT, y);
    doc.setFont("helvetica", "normal");
    y += 7;
    doc.text(`Ore totali stimate: ${totalHours} ore`, MARGIN_LEFT + 3, y);
    y += 5;
    doc.text(`Investimento totale stimato: €${formatCurrency(totalInvestment)}`, MARGIN_LEFT + 3, y);
    y += 5;
    doc.setFont("helvetica", "bold");
    doc.text(`Sanzioni evitate (stima realistica): €${formatCurrency(realisticTotal)}`, MARGIN_LEFT + 3, y);
    y += 5;
    doc.setFont("helvetica", "normal");
    doc.setTextColor(150, 30, 30);
    doc.text(`Sanzioni evitate (massimo teorico): €${formatCurrency(maxTotal)}`, MARGIN_LEFT + 3, y);
    doc.setTextColor(0, 0, 0);
    y += 5;
    const roiRealistic = totalInvestment > 0 ? (realisticTotal / totalInvestment).toFixed(1) : "0";
    const roiMax = totalInvestment > 0 ? (maxTotal / totalInvestment).toFixed(1) : "0";
    doc.text(`ROI realistico: ${roiRealistic}x`, MARGIN_LEFT + 3, y);
    y += 5;
    doc.text(`ROI massimo teorico: ${roiMax}x`, MARGIN_LEFT + 3, y);
    y += 5;
    doc.setFontSize(7);
    doc.setTextColor(100, 100, 100);
    doc.text("Nota: la stima realistica considera fattori attenuanti tipici (prima violazione, cooperazione,", MARGIN_LEFT + 3, y);
    y += 3;
    doc.text("piano remediation in corso, fattore PMI). Il massimo teorico rappresenta lo scenario peggiore", MARGIN_LEFT + 3, y);
    y += 3;
    doc.text("senza attenuanti, ai sensi delle fasce sanzionatorie applicabili.", MARGIN_LEFT + 3, y);
    doc.setFontSize(9);
    doc.setTextColor(0, 0, 0);
    y += 8;
  }

  // Conclusioni
  y = sectionTitle(doc, y, "7. CONCLUSIONI E RACCOMANDAZIONI");
  y = writeWrapped(doc, content.conclusioni, MARGIN_LEFT, y, SAFE_WIDTH);
  if (content.raccomandazioni_top3?.length > 0) {
    y += 5;
    y = writeSubTitle(doc, "Top 3 Priorità", y);
    content.raccomandazioni_top3.forEach((r: string, i: number) => {
      y = writeWrapped(doc, `${i + 1}. ${r}`, MARGIN_LEFT + 3, y, SAFE_WIDTH - 3);
    });
  }

  addFooters(doc, title);
}

// ── Risk Analysis Art. 24 GDPR ──

function exportRiskAnalysis(doc: jsPDF, content: any) {
  const title = stripMarkdown(content.title || "Analisi dei Rischi ex Art. 24 GDPR");
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const contentWidth = pageWidth - MARGIN_LEFT - MARGIN_RIGHT;
  let y = 20;

  const checkPageBreak = (needed: number) => {
    if (y + needed > pageHeight - 25) {
      doc.addPage();
      y = 20;
    }
  };

  const writeHeader = (text: string, fontSize = 14) => {
    checkPageBreak(20);
    doc.setFontSize(fontSize);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(20, 60, 120);
    const lines = doc.splitTextToSize(stripMarkdown(text), contentWidth);
    lines.forEach((line: string) => {
      checkPageBreak(8);
      doc.text(line, MARGIN_LEFT, y);
      y += fontSize * 0.5;
    });
    doc.setTextColor(0, 0, 0);
    y += 4;
  };

  const writeSubHeader = (text: string) => {
    checkPageBreak(15);
    doc.setFontSize(10);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(40, 80, 140);
    doc.text(stripMarkdown(text), MARGIN_LEFT, y);
    doc.setTextColor(0, 0, 0);
    y += 6;
  };

  const writeRiskBody = (text: string, indent = 0) => {
    if (!text) return;
    const cleaned = stripMarkdown(String(text));
    if (!cleaned) return;
    doc.setFontSize(9);
    doc.setFont("helvetica", "normal");
    const paragraphs = cleaned.split(/\n+/).filter(Boolean);
    paragraphs.forEach((paragraph) => {
      const lines = doc.splitTextToSize(paragraph, contentWidth - indent);
      lines.forEach((line: string) => {
        checkPageBreak(5);
        doc.text(line, MARGIN_LEFT + indent, y);
        y += 4.5;
      });
      y += 2;
    });
    y += 1;
  };

  const writeKeyValue = (key: string, value: string, indent = 0) => {
    const cleanedValue = stripMarkdown(String(value || ""));
    if (!cleanedValue) return;
    checkPageBreak(8);
    doc.setFontSize(9);
    doc.setFont("helvetica", "bold");
    const label = `${stripMarkdown(key)}:`;
    doc.text(label, MARGIN_LEFT + indent, y);
    doc.setFont("helvetica", "normal");
    const valueX = MARGIN_LEFT + indent + doc.getTextWidth(`${label} `) + 1;
    const maxWidth = pageWidth - valueX - MARGIN_RIGHT;
    const paragraphs = cleanedValue.split(/\n+/).filter(Boolean);
    paragraphs.forEach((paragraph, paragraphIndex) => {
      const lines = doc.splitTextToSize(paragraph, maxWidth);
      lines.forEach((line: string, lineIndex: number) => {
        if (paragraphIndex === 0 && lineIndex === 0) {
          doc.text(line, valueX, y);
        } else {
          y += 4.5;
          checkPageBreak(5);
          doc.text(line, MARGIN_LEFT + indent + 3, y);
        }
      });
    });
    y += 5;
  };

  const normalizeList = (items: unknown) => {
    if (!Array.isArray(items)) return "";
    return items
      .map((item) => `• ${stripMarkdown(String(item ?? ""))}`)
      .filter((item) => item !== "•")
      .join("\n");
  };

  const getRiskFillColor = (value: unknown): [number, number, number] | undefined => {
    const normalized = stripMarkdown(String(value || "")).toLowerCase();
    if (normalized.includes("altissimo")) return [180, 30, 30];
    if (normalized.includes("alto")) return [220, 80, 40];
    if (normalized.includes("medio")) return [255, 200, 50];
    if (normalized.includes("basso")) return [100, 180, 100];
    return undefined;
  };

  const hasStructuredSections = [
    content.section_1_premessa,
    content.section_2_metodologia,
    content.section_3_inventario_trattamenti,
    content.section_4_identificazione_minacce,
    content.section_5_rischio_inerente,
    content.section_6_misure_mitigazione,
    content.section_7_rischio_residuo,
    content.section_8_piano_trattamento,
    content.section_9_accettazione_rischio,
    content.section_10_monitoraggio,
  ].some(Boolean);

  doc.setFontSize(18);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(20, 60, 120);
  const titleLines = doc.splitTextToSize(title, contentWidth);
  titleLines.forEach((line: string) => {
    doc.text(line, pageWidth / 2, y, { align: "center" });
    y += 8;
  });
  doc.setTextColor(0, 0, 0);
  y += 5;

  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  doc.text(`Generato il ${format(new Date(), "dd/MM/yyyy")}`, pageWidth / 2, y, { align: "center" });
  y += 15;

  if (!hasStructuredSections) {
    writeHeader("1. Contenuto documento");
    const rawText = typeof content.raw_content === "string"
      ? content.raw_content
      : typeof content.content === "string"
        ? content.content
        : "";
    if (rawText) {
      writeRiskBody(rawText);
    } else {
      y = renderAny(doc, content, y);
    }
    addFooters(doc, title);
    return;
  }

  const sec1 = content.section_1_premessa;
  if (sec1) {
    writeHeader("1. Premessa e Ambito");
    if (sec1.ambito) writeRiskBody(sec1.ambito);
    if (sec1.riferimenti_normativi) writeKeyValue("Riferimenti normativi", sec1.riferimenti_normativi);
    if (sec1.data_analisi) writeKeyValue("Data analisi", sec1.data_analisi);
    if (sec1.versione) writeKeyValue("Versione", sec1.versione);
    if (sec1.redattore) writeKeyValue("Redattore", sec1.redattore);
    y += 5;
  }

  const sec2 = content.section_2_metodologia;
  if (sec2) {
    writeHeader("2. Metodologia");
    if (sec2.approccio) writeKeyValue("Approccio", sec2.approccio);
    if (sec2.scala_impatto) writeKeyValue("Scala Impatto", sec2.scala_impatto);
    if (sec2.scala_probabilita) writeKeyValue("Scala Probabilità", sec2.scala_probabilita);
    if (sec2.matrice_rischio) writeRiskBody(sec2.matrice_rischio);
    if (sec2.criteri_impatto) writeKeyValue("Criteri di impatto", sec2.criteri_impatto);
    y += 5;
  }

  const sec3 = content.section_3_inventario_trattamenti;
  if (Array.isArray(sec3) && sec3.length > 0) {
    writeHeader("3. Inventario dei Trattamenti");
    autoTable(doc, {
      startY: y,
      head: [["Cod.", "Denominazione", "Categorie Dati", "Interessati", "Base Giuridica"]],
      body: sec3.map((t: any) => [
        stripMarkdown(t.codice || ""),
        stripMarkdown(t.denominazione || ""),
        stripMarkdown(t.categorie_dati || ""),
        stripMarkdown(t.interessati || ""),
        stripMarkdown(t.base_giuridica || ""),
      ]),
      margin: { left: MARGIN_LEFT, right: MARGIN_RIGHT },
      styles: { fontSize: 7, cellPadding: 2, overflow: "linebreak" },
      headStyles: { fillColor: [20, 60, 120], textColor: 255, fontStyle: "bold" },
      alternateRowStyles: { fillColor: [245, 245, 250] },
      columnStyles: {
        0: { cellWidth: 15 },
        1: { cellWidth: 35 },
        2: { cellWidth: 40 },
        3: { cellWidth: 30 },
        4: { cellWidth: 40 },
      },
    });
    y = ((doc as any).lastAutoTable?.finalY || y) + 10;
  }

  const sec4 = content.section_4_identificazione_minacce;
  if (Array.isArray(sec4) && sec4.length > 0) {
    checkPageBreak(40);
    writeHeader("4. Identificazione delle Minacce");
    autoTable(doc, {
      startY: y,
      head: [["Area", "Minaccia", "Vulnerabilità", "Fonte Rischio", "Gap Correlato"]],
      body: sec4.map((m: any) => [
        stripMarkdown(m.area || ""),
        stripMarkdown(m.minaccia || ""),
        stripMarkdown(m.vulnerabilita || ""),
        stripMarkdown(m.fonte_rischio || ""),
        stripMarkdown(m.gap_correlato || ""),
      ]),
      margin: { left: MARGIN_LEFT, right: MARGIN_RIGHT },
      styles: { fontSize: 7, cellPadding: 2, overflow: "linebreak" },
      headStyles: { fillColor: [20, 60, 120], textColor: 255, fontStyle: "bold" },
      alternateRowStyles: { fillColor: [245, 245, 250] },
    });
    y = ((doc as any).lastAutoTable?.finalY || y) + 10;
  }

  const sec5 = content.section_5_rischio_inerente;
  if (Array.isArray(sec5) && sec5.length > 0) {
    checkPageBreak(40);
    writeHeader("5. Valutazione del Rischio Inerente");
    autoTable(doc, {
      startY: y,
      head: [["Minaccia", "Impatto", "Probabilità", "Livello", "Classificazione"]],
      body: sec5.map((r: any) => [
        stripMarkdown(r.minaccia || ""),
        String(r.impatto || ""),
        String(r.probabilita || ""),
        String(r.livello_rischio || ""),
        stripMarkdown(r.classificazione || ""),
      ]),
      margin: { left: MARGIN_LEFT, right: MARGIN_RIGHT },
      styles: { fontSize: 8, cellPadding: 3, overflow: "linebreak" },
      headStyles: { fillColor: [20, 60, 120], textColor: 255, fontStyle: "bold" },
      didParseCell: (data: any) => {
        if (data.section === "body" && data.column.index === 4) {
          const fillColor = getRiskFillColor(data.cell.raw);
          if (fillColor) {
            data.cell.styles.fillColor = fillColor;
            data.cell.styles.textColor = fillColor[0] === 255 ? [0, 0, 0] : [255, 255, 255];
          }
        }
      },
    });
    y = ((doc as any).lastAutoTable?.finalY || y) + 10;
  }

  const sec6 = content.section_6_misure_mitigazione;
  if (Array.isArray(sec6) && sec6.length > 0) {
    checkPageBreak(40);
    writeHeader("6. Misure di Mitigazione");
    autoTable(doc, {
      startY: y,
      head: [["Minaccia", "Misure Applicate", "Misure Da Applicare"]],
      body: sec6.map((m: any) => [
        stripMarkdown(m.minaccia || ""),
        normalizeList(m.misure_applicate),
        normalizeList(m.misure_da_applicare),
      ]),
      margin: { left: MARGIN_LEFT, right: MARGIN_RIGHT },
      styles: { fontSize: 7, cellPadding: 2, overflow: "linebreak", valign: "top" },
      headStyles: { fillColor: [20, 60, 120], textColor: 255, fontStyle: "bold" },
      alternateRowStyles: { fillColor: [245, 245, 250] },
      columnStyles: {
        0: { cellWidth: 40 },
        1: { cellWidth: 65 },
        2: { cellWidth: 65 },
      },
    });
    y = ((doc as any).lastAutoTable?.finalY || y) + 8;

    sec6.forEach((m: any, index: number) => {
      checkPageBreak(20);
      if (m.tipo || m.responsabile) {
        writeSubHeader(`${index + 1}. Dettagli attuativi`);
        if (m.minaccia) writeKeyValue("Minaccia", m.minaccia, 3);
        if (m.tipo) writeKeyValue("Tipo", m.tipo, 3);
        if (m.responsabile) writeKeyValue("Responsabile", m.responsabile, 3);
        y += 2;
      }
    });
    y += 5;
  }

  const sec7 = content.section_7_rischio_residuo;
  if (Array.isArray(sec7) && sec7.length > 0) {
    checkPageBreak(40);
    writeHeader("7. Valutazione del Rischio Residuo");
    autoTable(doc, {
      startY: y,
      head: [["Minaccia", "Impatto", "Probabilità", "Livello", "Classif.", "Motivazione Accettazione"]],
      body: sec7.map((r: any) => [
        stripMarkdown(r.minaccia || ""),
        String(r.impatto_residuo || ""),
        String(r.probabilita_residua || ""),
        String(r.livello_residuo || ""),
        stripMarkdown(r.classificazione_residua || ""),
        stripMarkdown(r.motivazione_accettazione || ""),
      ]),
      margin: { left: MARGIN_LEFT, right: MARGIN_RIGHT },
      styles: { fontSize: 7, cellPadding: 2, overflow: "linebreak" },
      headStyles: { fillColor: [20, 60, 120], textColor: 255, fontStyle: "bold" },
      columnStyles: { 5: { cellWidth: 50 } },
      didParseCell: (data: any) => {
        if (data.section === "body" && data.column.index === 4) {
          const fillColor = getRiskFillColor(data.cell.raw);
          if (fillColor) {
            data.cell.styles.fillColor = fillColor;
            data.cell.styles.textColor = fillColor[0] === 255 ? [0, 0, 0] : [255, 255, 255];
          }
        }
      },
    });
    y = ((doc as any).lastAutoTable?.finalY || y) + 10;
  }

  const sec8 = content.section_8_piano_trattamento;
  if (Array.isArray(sec8) && sec8.length > 0) {
    checkPageBreak(40);
    writeHeader("8. Piano di Trattamento del Rischio");
    autoTable(doc, {
      startY: y,
      head: [["Priorità", "Azione", "Responsabile", "Scadenza", "Costo"]],
      body: sec8.map((a: any) => [
        String(a.priorita || ""),
        stripMarkdown(a.azione || ""),
        stripMarkdown(a.responsabile || ""),
        stripMarkdown(a.scadenza || ""),
        stripMarkdown(a.costo_stimato || ""),
      ]),
      margin: { left: MARGIN_LEFT, right: MARGIN_RIGHT },
      styles: { fontSize: 7, cellPadding: 2, overflow: "linebreak" },
      headStyles: { fillColor: [20, 60, 120], textColor: 255, fontStyle: "bold" },
      columnStyles: {
        0: { cellWidth: 15 },
        1: { cellWidth: 75 },
        4: { cellWidth: 25 },
      },
    });
    y = ((doc as any).lastAutoTable?.finalY || y) + 10;

    const totalHours = sec8.reduce((sum: number, action: any) => sum + (Number(action.ore_stimate) || 0), 0);
    if (totalHours > 0) {
      checkPageBreak(20);
      doc.setDrawColor(20, 60, 120);
      doc.setLineWidth(0.5);
      doc.line(MARGIN_LEFT, y, pageWidth - MARGIN_RIGHT, y);
      y += 6;
      doc.setFontSize(10);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(20, 60, 120);
      doc.text("Riepilogo Investimento", MARGIN_LEFT, y);
      y += 6;
      doc.setTextColor(0, 0, 0);
      doc.setFontSize(9);
      doc.setFont("helvetica", "normal");
      doc.text(`Ore totali stimate: ${totalHours}`, MARGIN_LEFT + 3, y);
      y += 5;
      doc.text(`Investimento totale stimato: €${(totalHours * 85).toLocaleString("it-IT")}`, MARGIN_LEFT + 3, y);
      y += 5;
      doc.setFontSize(7);
      doc.setTextColor(120, 120, 120);
      doc.text("Nota: stime calcolate con tariffa di riferimento €85/h.", MARGIN_LEFT + 3, y);
      doc.setTextColor(0, 0, 0);
      y += 10;
    }
  }

  const sec9 = content.section_9_accettazione_rischio;
  if (sec9) {
    checkPageBreak(40);
    writeHeader("9. Accettazione del Rischio");
    if (sec9.dichiarazione) writeRiskBody(sec9.dichiarazione);
    if (sec9.rischi_accettati) writeKeyValue("Rischi accettati", sec9.rischi_accettati);
    if (sec9.soglie_intervento) writeKeyValue("Soglie di intervento", sec9.soglie_intervento);
    y += 10;
    checkPageBreak(20);
    doc.setFontSize(9);
    doc.setFont("helvetica", "normal");
    doc.text(`Il Titolare del Trattamento: ${stripMarkdown(sec9.firma_titolare || "[DA COMPLETARE]")}`, MARGIN_LEFT, y);
    y += 6;
    doc.text("Firma: _________________________", MARGIN_LEFT, y);
    y += 6;
    doc.text(`Data: ${stripMarkdown(sec9.data_firma || "___/___/______")}`, MARGIN_LEFT, y);
    y += 10;
  }

  const sec10 = content.section_10_monitoraggio;
  if (sec10) {
    checkPageBreak(40);
    writeHeader("10. Piano di Monitoraggio e Revisione");
    if (sec10.frequenza_revisione) writeKeyValue("Frequenza revisione", sec10.frequenza_revisione);
    if (sec10.responsabile) writeKeyValue("Responsabile", sec10.responsabile);
    if (sec10.prossima_revisione) writeKeyValue("Prossima revisione", sec10.prossima_revisione);

    if (Array.isArray(sec10.kpi) && sec10.kpi.length > 0) {
      writeSubHeader("KPI di Monitoraggio");
      sec10.kpi.forEach((kpi: string) => {
        checkPageBreak(5);
        doc.setFontSize(8);
        doc.setFont("helvetica", "normal");
        doc.text(`• ${stripMarkdown(kpi)}`, MARGIN_LEFT + 3, y);
        y += 4.5;
      });
      y += 3;
    }

    if (Array.isArray(sec10.trigger_revisione) && sec10.trigger_revisione.length > 0) {
      writeSubHeader("Trigger per Revisione Straordinaria");
      sec10.trigger_revisione.forEach((trigger: string) => {
        checkPageBreak(5);
        doc.setFontSize(8);
        doc.setFont("helvetica", "normal");
        doc.text(`• ${stripMarkdown(trigger)}`, MARGIN_LEFT + 3, y);
        y += 4.5;
      });
    }
  }

  addFooters(doc, title);
}

// ── Generic fallback ──

function exportGeneric(doc: jsPDF, content: any) {
  let y = MARGIN_TOP;
  doc.setFontSize(16);
  doc.setFont("helvetica", "bold");
  const titleLines = doc.splitTextToSize(content.title || "Documento", SAFE_WIDTH);
  for (const line of titleLines) {
    doc.text(line, PAGE_WIDTH / 2, y, { align: "center" });
    y += 7;
  }
  y += 8;
  y = renderAny(doc, content, y);
  addFooters(doc, content.title || "Documento");
}

// ── Footers ──

function addFooters(doc: jsPDF, title: string) {
  const totalPages = doc.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    const pageHeight = doc.internal.pageSize.getHeight();
    doc.setFontSize(7);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(140, 140, 140);
    doc.text(`${title} — Pagina ${i} di ${totalPages}`, PAGE_WIDTH / 2, pageHeight - 8, { align: "center" });
    doc.text(`Generato da RegBrain il ${format(new Date(), "dd/MM/yyyy HH:mm")}`, PAGE_WIDTH / 2, pageHeight - 4, { align: "center" });
    doc.setTextColor(0, 0, 0);
  }
}

// ── Main export ──

export function exportDocumentToPDF(document: any) {
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const content = document.content || {};
  const docType = document.document_type;

  if (docType === "dpia") {
    exportDPIA(doc, content);
  } else if (docType === "ropa") {
    exportRoPA(doc, content);
  } else if (docType === "lia") {
    exportLIA(doc, content);
  } else if (docType === "gap_report") {
    exportGapReport(doc, content);
  } else if (docType === "risk_analysis") {
    exportRiskAnalysis(doc, content);
  } else {
    exportGeneric(doc, content);
  }

  const filename = `${docType}_${format(new Date(document.created_at || new Date()), "yyyy-MM-dd")}.pdf`;
  doc.save(filename);
}
