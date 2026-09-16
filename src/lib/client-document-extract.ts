import { pdfjsLib } from "@/lib/pdf-worker";
import mammoth from "mammoth";
import * as XLSX from "xlsx";

const MAX_CHARS = 120000;

/** Errore leggibile dall'utente: spiega perché il documento non può essere analizzato. */
export class DocumentExtractionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "DocumentExtractionError";
  }
}

async function extractPdfText(file: File): Promise<string> {
  const arrayBuffer = await file.arrayBuffer();
  let pdf;
  try {
    pdf = await pdfjsLib.getDocument({
      data: new Uint8Array(arrayBuffer),
      stopAtErrors: false,
      isEvalSupported: false,
    }).promise;
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    if (/password/i.test(message)) {
      throw new DocumentExtractionError("PDF protetto da password: rimuovere la protezione prima di caricarlo");
    }
    throw new DocumentExtractionError(`PDF non leggibile (${message.substring(0, 80)})`);
  }

  const pages: string[] = [];
  const maxPages = Math.min(pdf.numPages, 120);
  for (let i = 1; i <= maxPages; i++) {
    try {
      const page = await pdf.getPage(i);
      const textContent = await page.getTextContent();
      const pageText = (textContent.items as any[])
        .map((item) => item.str)
        .join(" ")
        .trim();
      if (pageText) pages.push(pageText);
    } catch (pageError) {
      console.warn(`Pagina PDF ${i} non leggibile:`, pageError);
    }
  }

  const joined = pages.join("\n").trim();
  if (joined.length < 20) {
    throw new DocumentExtractionError(
      "PDF senza testo estraibile: probabilmente è una scansione. Serve una versione con testo (OCR) o il file originale",
    );
  }
  return joined;
}

async function extractDocxText(file: File): Promise<string> {
  const arrayBuffer = await file.arrayBuffer();
  try {
    const result = await mammoth.extractRawText({ arrayBuffer });
    return result.value;
  } catch (err) {
    throw new DocumentExtractionError("File Word non leggibile: verificare che sia un .docx valido");
  }
}

async function extractSpreadsheetText(file: File): Promise<string> {
  const arrayBuffer = await file.arrayBuffer();
  let workbook;
  try {
    workbook = XLSX.read(arrayBuffer, { type: "array" });
  } catch {
    throw new DocumentExtractionError("Foglio di calcolo non leggibile");
  }
  const parts: string[] = [];
  for (const sheetName of workbook.SheetNames) {
    const sheet = workbook.Sheets[sheetName];
    const csv = XLSX.utils.sheet_to_csv(sheet, { blankrows: false });
    if (csv.trim()) parts.push(`--- ${sheetName} ---\n${csv}`);
  }
  return parts.join("\n\n");
}

/** Quota di parole "vere" nel testo: serve a riconoscere estrazioni fallite (rumore binario). */
export function readableRatio(text: string): number {
  if (!text) return 0;
  const sample = text.substring(0, 6000);
  const tokens = sample.split(/\s+/).filter(Boolean);
  if (tokens.length < 5) return 0;
  const wordRe = /^[("'«\[]?[a-zA-ZàèéìíòóùúÀÈÉÌÒÓÙçÇ]{2,25}[.,;:!?)»\]"']{0,2}$/;
  const good = tokens.filter((t) => wordRe.test(t)).length;
  const odd = (sample.match(/[\u00ff\u00fe\u00f0\u00d8\u00d0\u00cd\u00ce\u00d2\u00db\u00cb\u00e5\u0000-\u0008\u000e-\u001f\ufffd]/g) || []).length /
    Math.max(1, sample.length);
  return Math.max(0, good / tokens.length - odd * 3);
}

/**
 * Estrae il testo di un documento nel browser.
 * Lancia DocumentExtractionError con una spiegazione per l'utente quando il file
 * non può essere letto: non restituisce mai contenuto binario spacciato per testo.
 */
export async function extractDocumentText(file: File, maxChars: number = MAX_CHARS): Promise<string> {
  const name = file.name.toLowerCase();
  let text = "";

  if (name.endsWith(".pdf") || file.type === "application/pdf") {
    text = await extractPdfText(file);
  } else if (name.endsWith(".docx")) {
    text = await extractDocxText(file);
  } else if (name.endsWith(".doc")) {
    throw new DocumentExtractionError("Formato .doc (Word 97-2003) non supportato: salvare il file come .docx o PDF");
  } else if (name.endsWith(".xlsx") || name.endsWith(".xls") || name.endsWith(".csv")) {
    text = await extractSpreadsheetText(file);
  } else if (/\.(txt|md|json|xml|html|htm|rtf)$/.test(name) || file.type.startsWith("text/")) {
    text = await file.text();
  } else {
    throw new DocumentExtractionError("Formato non supportato: sono accettati PDF, DOCX, XLSX, CSV e file di testo");
  }

  const cleaned = text.replace(/\u0000/g, "").replace(/\s+/g, " ").trim();
  if (cleaned.length < 20) {
    throw new DocumentExtractionError("Il documento non contiene testo leggibile");
  }
  if (readableRatio(cleaned) < 0.35) {
    throw new DocumentExtractionError("Il contenuto estratto non è testo leggibile: il file potrebbe essere danneggiato o una scansione");
  }
  return cleaned.slice(0, maxChars);
}
