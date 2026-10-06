import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

export type CodeRisk = "high" | "medium" | "low";

export interface CodeOccurrence { file: string; line: number; snippet: string; note?: string }
export interface CodeFinding {
  id: string;
  ruleId: string | null;
  source: "regola" | "ai";
  title: string;
  category: string;
  risk: CodeRisk;
  why: string;
  action: string;
  occurrences: CodeOccurrence[];
  totalOccurrences: number;
  refs: string[];
  status: "confermato" | "da_verificare" | "possibile_falso_positivo";
  aiNote?: string;
}
export interface CodeSource { id: string; citation: string; regulation: string; chunkKey: string; text: string }
export type ReqOutcome = "esiti" | "superato" | "nessun_esito" | "non_valutabile" | "non_applicabile";
export interface CodeRequirement {
  id: string; guideline: string; title: string; what: string; refs: string[]; method: "regole" | "strutturale" | "manuale";
  outcome: ReqOutcome; findings: string[]; evidence: Array<{ file: string; line: number; snippet: string; note?: string }>; note: string;
  aiObservation?: { text: string; file?: string; line?: number };
}
export interface CodeCoverage {
  rulesFiles: number; aiFiles: number; aiChars: number; aiBatches: number; aiBatchesFailed: number;
  filesNotReviewedByAi: number; filesNotReviewedByAiSample: string[];
}
export const OUTCOME_TEXT: Record<ReqOutcome, string> = {
  esiti: "Problemi trovati", superato: "Superato", nessun_esito: "Nessun esito dalle regole", non_valutabile: "Non valutabile dal codice", non_applicabile: "Non applicabile",
};
export interface CodeCheckResult {
  id: string | null;
  created_at: string;
  title: string;
  context: Record<string, unknown>;
  files: Array<{ name: string; lines: number; chars: number; sha256: string }>;
  findings: CodeFinding[];
  summary: {
    text: string; questions: string[]; sources: CodeSource[]; aiUsed: boolean; scanMode?: "funzione" | "browser"; excerptChars?: number;
    requirements?: CodeRequirement[]; requirementCounts?: Record<ReqOutcome, number>; coverage?: CodeCoverage;
  };
  overall_risk: CodeRisk | "none";
  counts: { high: number; medium: number; low: number; possibleFalsePositives: number; aiOnly: number };
  rules_version: string | null;
  model: string | null;
}

export const RISK_TEXT: Record<string, string> = { high: "Alto", medium: "Medio", low: "Basso", none: "Nessuno" };
export const STATUS_TEXT: Record<string, string> = {
  confermato: "Rilevato dalle regole",
  da_verificare: "Da verificare",
  possibile_falso_positivo: "Possibile falso positivo",
};
export const CATEGORY_TEXT: Record<string, string> = {
  sicurezza: "Sicurezza", privacy: "Protezione dei dati", cookie: "Cookie e tracciamento",
  accessibilita: "Accessibilità", ai: "Intelligenza artificiale", licenze: "Licenze open source",
};

const RISK_RGB: Record<string, [number, number, number]> = {
  high: [185, 28, 28], medium: [180, 83, 9], low: [21, 128, 61], none: [71, 85, 105],
};

// Helvetica di jsPDF copre il Latin-1: si sostituiscono i pochi caratteri tipografici esterni.
function pdfText(value: unknown): string {
  return String(value ?? "")
    .replace(/[‘’]/g, "'")
    .replace(/[“”«»]/g, '"')
    .replace(/[–—]/g, "-")
    .replace(/…/g, "...")
    .replace(/[^\x09\x0A\x0D\x20-\x7E -ÿ]/g, "");
}

export function exportCodeCheckPdf(result: CodeCheckResult) {
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const W = doc.internal.pageSize.getWidth();
  const H = doc.internal.pageSize.getHeight();
  const M = 15;
  const width = W - 2 * M;
  let y = 20;

  const space = (needed: number) => {
    if (y + needed > H - 18) { doc.addPage(); y = 20; }
  };
  const para = (text: string, size = 10, style: "normal" | "bold" | "italic" = "normal", color: [number, number, number] = [30, 30, 30], lh = 4.8, font: "helvetica" | "courier" = "helvetica") => {
    doc.setFont(font, style);
    doc.setFontSize(size);
    doc.setTextColor(...color);
    for (const line of doc.splitTextToSize(pdfText(text), width) as string[]) {
      space(lh + 1);
      doc.text(line, M, y);
      y += lh;
    }
  };
  const heading = (text: string) => {
    space(14);
    y += 3;
    para(text, 13, "bold", [20, 60, 120], 6);
    y += 1;
  };

  para("RegBrain - Revisione automatica del codice con riferimenti normativi", 16, "bold", [20, 60, 120], 7);
  para(result.title, 12, "bold");
  para(`Data: ${new Date(result.created_at).toLocaleString("it-IT")}  |  Regole: ${result.rules_version ?? "-"}${result.summary.scanMode === "browser" ? " eseguite nel browser sull'intera base di codice" : ""}  |  Revisione AI: ${result.summary.aiUsed ? result.model || "sì" : "non disponibile"}`, 9, "normal", [90, 90, 90]);
  y += 2;
  const rgb = RISK_RGB[result.overall_risk] || RISK_RGB.none;
  para(`Profilo di rischio complessivo: ${RISK_TEXT[result.overall_risk]}`, 13, "bold", rgb, 6);
  para(`Problemi: ${result.counts.high} a rischio alto, ${result.counts.medium} medio, ${result.counts.low} basso${result.counts.possibleFalsePositives ? `; ${result.counts.possibleFalsePositives} possibili falsi positivi` : ""}.`, 10);

  heading("Sintesi");
  para(result.summary.text);
  para("Questa è una revisione automatica: regole deterministiche, analisi strutturali fra i file e revisione del modello su estratti. Non è una certificazione di conformità. La tabella dei requisiti indica cosa è stato verificato, con quale esito, e cosa resta da valutare a video o sui documenti.", 9, "italic", [90, 90, 90]);

  const CTX_LABELS: Record<string, string> = {
    appType: "Tipo di applicazione", appTypes: "Tipo di applicazione", personalData: "Dati personali", sector: "Settore", sectors: "Settore",
    usesAI: "Usa l'IA", audience: "Utenti", audiences: "Utenti", notes: "Note",
  };
  const VALUE_LABELS: Record<string, string> = {
    web: "applicazione web", mobile: "app mobile", backend: "backend o API", desktop: "software desktop", libreria: "libreria", si: "sì", no: "no", non_so: "non so",
    generico: "nessun settore in particolare", pa: "pubblica amministrazione", sanita: "sanità", finanza: "finanza e pagamenti", nis2: "soggetto NIS2", cra: "prodotto con elementi digitali (CRA)",
    consumatori: "consumatori", dipendenti: "dipendenti", business: "clienti business", minori: "anche minori",
  };
  const ctxRows = Object.entries(result.context || {})
    .filter(([k, v]) => CTX_LABELS[k] && v && (Array.isArray(v) ? v.length > 0 : String(v).trim()))
    .map(([k, v]) => [CTX_LABELS[k], pdfText(Array.isArray(v) ? v.map((x) => VALUE_LABELS[String(x)] || String(x)).join(", ") : VALUE_LABELS[String(v)] || String(v))]);
  const inferred = (result.context as { inferred?: { appTypes?: Array<{ value: string }>; personalData?: Array<{ value: string }>; usesAI?: Array<{ value: string }>; frameworks?: string[]; languages?: Record<string, number> } })?.inferred;
  if (inferred) {
    const langs = Object.entries(inferred.languages || {}).sort((a, b) => b[1] - a[1]).slice(0, 5).map(([l, n]) => `${l} (${n})`).join(", ");
    if (langs) ctxRows.push(["Linguaggi (dal codice)", pdfText(langs)]);
    if (inferred.frameworks?.length) ctxRows.push(["Framework (dal codice)", pdfText(inferred.frameworks.join(", "))]);
    if (inferred.personalData?.length) ctxRows.push(["Dati personali nei modelli (dal codice)", pdfText(inferred.personalData.map((d) => d.value).join(", "))]);
    if (inferred.usesAI?.length) ctxRows.push(["Servizi di IA (dal codice)", pdfText(inferred.usesAI.map((d) => d.value).join(", "))]);
  }
  if (ctxRows.length) {
    heading("Contesto dichiarato");
    autoTable(doc, { startY: y, head: [["Voce", "Valore"]], body: ctxRows, margin: { left: M, right: M }, styles: { fontSize: 9 }, headStyles: { fillColor: [20, 60, 120] } });
    y = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 4;
  }

  heading(`File analizzati (${result.files.length})`);
  const MAX_ROWS = 150;
  if (result.files.length > MAX_ROWS) para(`Elenco limitato ai primi ${MAX_ROWS} file; l'inventario completo con le impronte resta nella verifica salvata.`, 8.5, "italic", [90, 90, 90]);
  autoTable(doc, {
    startY: y, head: [["File", "Righe", "SHA-256 (prime 16 cifre)"]],
    body: result.files.slice(0, MAX_ROWS).map((f) => [pdfText(f.name), String(f.lines), (f.sha256 || "").slice(0, 16)]),
    margin: { left: M, right: M }, styles: { fontSize: 8 }, headStyles: { fillColor: [20, 60, 120] },
  });
  y = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 4;

  if (result.summary.requirements?.length) {
    const reqs = result.summary.requirements;
    const c = result.summary.requirementCounts;
    const cov = result.summary.coverage;
    heading("Copertura dei requisiti");
    if (c) para(`${c.esiti} requisiti con problemi, ${c.superato} superati con prova positiva, ${c.nessun_esito} senza esiti dalle regole, ${c.non_valutabile} non valutabili dal codice, ${c.non_applicabile} non applicabili al contesto.`);
    if (cov) para(`Regole e analisi strutturali eseguite su ${cov.rulesFiles} file. Il modello ha letto ${cov.aiFiles} file (${cov.aiChars.toLocaleString("it-IT")} caratteri${cov.aiBatches > 1 ? `, ${cov.aiBatches} lotti` : ""})${cov.filesNotReviewedByAi > 0 ? `; ${cov.filesNotReviewedByAi} file sono stati letti solo dalle regole` : ""}.`, 9, "normal", [70, 70, 70]);
    const OUT_RGB: Record<string, [number, number, number]> = { esiti: [185, 28, 28], superato: [21, 128, 61], nessun_esito: [71, 85, 105], non_valutabile: [180, 83, 9], non_applicabile: [140, 140, 140] };
    for (const g of [...new Set(reqs.map((r) => r.guideline))]) {
      space(16);
      para(g, 10.5, "bold", [20, 60, 120], 5.5);
      autoTable(doc, {
        startY: y, head: [["Requisito", "Esito", "Metodo", "Note ed evidenze"]],
        body: reqs.filter((r) => r.guideline === g).map((r) => [
          pdfText(`${r.title} (${r.id})\n${r.what}`),
          OUTCOME_TEXT[r.outcome],
          r.method === "regole" ? "Regole" : r.method === "strutturale" ? "Analisi strutturale" : "Verifica manuale",
          pdfText([r.note, ...r.evidence.slice(0, 3).map((e) => `${e.file}:${e.line}${e.note ? " (" + e.note + ")" : ""}`), r.aiObservation ? `Osservazione del modello (da verificare): ${r.aiObservation.text}${r.aiObservation.file ? ` (${r.aiObservation.file}:${r.aiObservation.line})` : ""}` : ""].filter(Boolean).join("\n")),
        ]),
        margin: { left: M, right: M }, styles: { fontSize: 7.5, cellPadding: 1.6, valign: "top" }, headStyles: { fillColor: [20, 60, 120] },
        columnStyles: { 0: { cellWidth: 58 }, 1: { cellWidth: 26, fontStyle: "bold" }, 2: { cellWidth: 24 }, 3: { cellWidth: width - 108 } },
        didParseCell: (d) => { if (d.section === "body" && d.column.index === 1) { const r = reqs.filter((x) => x.guideline === g)[d.row.index]; if (r) d.cell.styles.textColor = OUT_RGB[r.outcome]; } },
      });
      y = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 4;
    }
  }

  heading("Riepilogo dei problemi");
  if (result.findings.length === 0) {
    para("Nessun problema rilevato dalle regole e dalle analisi strutturali. Questo non certifica la conformità del software.");
  } else {
    autoTable(doc, {
      startY: y, head: [["#", "Problema", "Area", "Rischio", "Esito"]],
      body: result.findings.map((f, i) => [String(i + 1), pdfText(f.title), CATEGORY_TEXT[f.category] || f.category, RISK_TEXT[f.risk], STATUS_TEXT[f.status]]),
      margin: { left: M, right: M }, styles: { fontSize: 8.5 }, headStyles: { fillColor: [20, 60, 120] },
      didParseCell: (data) => {
        if (data.section === "body" && data.column.index === 3) {
          const f = result.findings[data.row.index];
          data.cell.styles.textColor = RISK_RGB[f.risk];
          data.cell.styles.fontStyle = "bold";
        }
      },
    });
    y = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 4;
  }

  const sources = new Map(result.summary.sources.map((s) => [s.id, s]));
  result.findings.forEach((f, i) => {
    heading(`${i + 1}. ${f.title}`);
    para(`Rischio ${RISK_TEXT[f.risk].toLowerCase()}  |  ${CATEGORY_TEXT[f.category] || f.category}  |  ${STATUS_TEXT[f.status]}${f.ruleId ? `  |  Regola ${f.ruleId}` : ""}`, 9, "bold", RISK_RGB[f.risk]);
    para(`Perché conta: ${f.why}`);
    if (f.aiNote) para(`Nel tuo codice: ${f.aiNote}`);
    para(`Azione suggerita: ${f.action}`, 10, "bold");
    y += 1;
    para(`Dove (${f.totalOccurrences} ${f.totalOccurrences === 1 ? "occorrenza" : "occorrenze"}${f.totalOccurrences > f.occurrences.length ? `, mostrate ${f.occurrences.length}` : ""}):`, 9, "bold", [70, 70, 70]);
    for (const o of f.occurrences) {
      para(`${o.file}:${o.line}${o.note ? ` (${o.note})` : ""}`, 8.5, "bold", [70, 70, 70], 4.2);
      para(o.snippet, 8, "normal", [60, 60, 60], 4, "courier");
    }
    const cited = f.refs.map((r) => sources.get(r)).filter(Boolean) as CodeSource[];
    if (cited.length) {
      y += 1;
      para(`Fonti: ${[...new Set(cited.map((s) => s.citation))].join("; ")}`, 8.5, "italic", [60, 60, 60], 4.2);
    }
  });

  if (result.summary.questions.length) {
    heading("Domande per completare la revisione");
    result.summary.questions.forEach((q, i) => para(`${i + 1}. ${q}`));
  }

  if (result.summary.sources.length) {
    heading("Testi normativi citati");
    for (const s of result.summary.sources) {
      para(s.citation, 9.5, "bold");
      para(s.text.slice(0, 1400) + (s.text.length > 1400 ? " [...]" : ""), 8.5, "normal", [60, 60, 60], 4.2);
      y += 2;
    }
  }

  heading("Limiti della revisione");
  para("Le regole riconoscono schemi noti; le analisi strutturali seguono consenso e autorizzazioni fra le righe e fra i file per i framework più diffusi; il modello legge estratti, non l'intera base di codice, e il referto dichiara quali file ha letto. Nessuno dei tre vede la configurazione dei server, i flussi dei dati fuori dal codice, i contratti con i fornitori né le scelte organizzative. Gli esiti segnati \"Da verificare\" e le osservazioni del modello vanno controllati da una persona. Questo report aiuta a trovare e correggere problemi e documenta cosa è stato verificato; non è una certificazione di conformità e va firmato da chi ne è responsabile.", 9, "normal", [70, 70, 70]);

  const pages = doc.getNumberOfPages();
  for (let p = 1; p <= pages; p++) {
    doc.setPage(p);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(120, 120, 120);
    doc.text(`RegBrain - Revisione del codice - pagina ${p} di ${pages}`, M, H - 8);
  }
  const safe = result.title.replace(/[^\w.-]+/g, "_").slice(0, 60) || "codice";
  doc.save(`verifica-codice-${safe}-${new Date(result.created_at).toISOString().slice(0, 10)}.pdf`);
}
