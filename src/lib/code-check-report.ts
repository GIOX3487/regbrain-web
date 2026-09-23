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
export interface CodeCheckResult {
  id: string | null;
  created_at: string;
  title: string;
  context: Record<string, unknown>;
  files: Array<{ name: string; lines: number; chars: number; sha256: string }>;
  findings: CodeFinding[];
  summary: { text: string; questions: string[]; sources: CodeSource[]; aiUsed: boolean; scanMode?: "funzione" | "browser"; excerptChars?: number };
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

  para("RegBrain - Verifica di conformità del codice", 16, "bold", [20, 60, 120], 7);
  para(result.title, 12, "bold");
  para(`Data: ${new Date(result.created_at).toLocaleString("it-IT")}  |  Regole: ${result.rules_version ?? "-"}${result.summary.scanMode === "browser" ? " eseguite nel browser sull'intera base di codice" : ""}  |  Revisione AI: ${result.summary.aiUsed ? result.model || "sì" : "non disponibile"}`, 9, "normal", [90, 90, 90]);
  y += 2;
  const rgb = RISK_RGB[result.overall_risk] || RISK_RGB.none;
  para(`Profilo di rischio complessivo: ${RISK_TEXT[result.overall_risk]}`, 13, "bold", rgb, 6);
  para(`Problemi: ${result.counts.high} a rischio alto, ${result.counts.medium} medio, ${result.counts.low} basso${result.counts.possibleFalsePositives ? `; ${result.counts.possibleFalsePositives} possibili falsi positivi` : ""}.`, 10);

  heading("Sintesi");
  para(result.summary.text);

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

  heading("Riepilogo dei problemi");
  if (result.findings.length === 0) {
    para("Nessun problema rilevato dalle regole automatiche. Questo non certifica la conformità del software.");
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
    heading("Domande per completare la verifica");
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

  heading("Limiti della verifica");
  para("Le regole automatiche riconoscono schemi noti riga per riga: non vedono la configurazione dei server, i flussi dei dati fuori dal codice, i contratti con i fornitori né le scelte organizzative. Gli esiti segnati \"Da verificare\" sono proposte della revisione AI e vanno controllati da una persona. Questo report aiuta a trovare e correggere problemi; non è una certificazione di conformità e va firmato da chi ne è responsabile.", 9, "normal", [70, 70, 70]);

  const pages = doc.getNumberOfPages();
  for (let p = 1; p <= pages; p++) {
    doc.setPage(p);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(120, 120, 120);
    doc.text(`RegBrain - Verifica del codice - pagina ${p} di ${pages}`, M, H - 8);
  }
  const safe = result.title.replace(/[^\w.-]+/g, "_").slice(0, 60) || "codice";
  doc.save(`verifica-codice-${safe}-${new Date(result.created_at).toISOString().slice(0, 10)}.pdf`);
}
