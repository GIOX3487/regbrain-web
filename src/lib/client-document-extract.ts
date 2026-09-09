import * as pdfjsLib from "pdfjs-dist";
import mammoth from "mammoth";
import * as XLSX from "xlsx";

pdfjsLib.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs";

const MAX_CHARS = 120000;

async function extractPdfText(file: File): Promise<string> {
  const arrayBuffer = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({
    data: arrayBuffer,
    stopAtErrors: false,
    isEvalSupported: false,
  }).promise;

  const pages: string[] = [];
  const maxPages = Math.min(pdf.numPages, 80);
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
  if (!joined) throw new Error("Nessun testo estraibile dal PDF");
  return joined;
}

async function extractDocxText(file: File): Promise<string> {
  const arrayBuffer = await file.arrayBuffer();
  const result = await mammoth.extractRawText({ arrayBuffer });
  return result.value;
}

async function extractSpreadsheetText(file: File): Promise<string> {
  const arrayBuffer = await file.arrayBuffer();
  const workbook = XLSX.read(arrayBuffer, { type: "array" });
  const parts: string[] = [];
  for (const sheetName of workbook.SheetNames) {
    const sheet = workbook.Sheets[sheetName];
    const csv = XLSX.utils.sheet_to_csv(sheet);
    if (csv.trim()) parts.push(`--- ${sheetName} ---\n${csv}`);
  }
  return parts.join("\n\n");
}

async function extractBinaryFallback(file: File): Promise<string> {
  const buffer = await file.arrayBuffer();
  const decoders = [
    new TextDecoder("utf-8", { fatal: false }),
    new TextDecoder("windows-1252", { fatal: false }),
    new TextDecoder("iso-8859-1", { fatal: false }),
  ];
  let best = "";
  for (const decoder of decoders) {
    const candidate = decoder
      .decode(buffer)
      .replace(/\u0000/g, " ")
      .match(/[A-Za-zÀ-ÿ0-9][A-Za-zÀ-ÿ0-9\s.,;:()\-_/]{20,}/g)
      ?.join(" ") || "";
    if (candidate.length > best.length) best = candidate;
  }
  return best;
}

/** Extract plain text from a user-attached document, in the browser. */
export async function extractDocumentText(file: File): Promise<string> {
  const name = file.name.toLowerCase();
  let text = "";

  try {
    if (name.endsWith(".pdf") || file.type === "application/pdf") {
      text = await extractPdfText(file);
    } else if (name.endsWith(".docx") || name.endsWith(".doc")) {
      text = await extractDocxText(file);
    } else if (
      name.endsWith(".xlsx") || name.endsWith(".xls") || name.endsWith(".csv")
    ) {
      text = await extractSpreadsheetText(file);
    } else {
      text = await file.text();
    }
  } catch (err) {
    console.warn("Estrazione standard fallita, uso fallback:", file.name, err);
    text = await extractBinaryFallback(file);
  }

  if (!text || text.trim().length < 20) {
    text = await extractBinaryFallback(file);
  }

  return text.replace(/\u0000/g, "").replace(/[ \t]+/g, " ").trim().slice(
    0,
    MAX_CHARS,
  );
}
