// Ingestione article-aware dei regolamenti EU da EUR-Lex (Formex XML via Cellar).
//
// Ogni unità citabile (articolo, paragrafo, considerando, parte di allegato)
// diventa una riga di structured_chunks con metadati completi
// (regulation, article_number, paragraph, section_hierarchy, citation_label,
// chunk_key, context_header) e una riga speculare in chunks, così che tutte le
// strategie di retrieval di rag-query lavorino sullo stesso testo pulito.
//
// Autenticazione: chiave di servizio Supabase (manutenzione) oppure utente admin.
// Invocazione: POST {regulation, lang?, dryRun?, offset?, limit?, reset?, includeRecitals?}

import { createClient } from "npm:@supabase/supabase-js@2.75.0";
import {
  configuredServiceKeys,
  EMBEDDING_MODEL,
  embedTexts,
  isServiceRequest,
} from "../_shared/embeddings.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Content-Type": "application/json",
  "Cache-Control": "no-store",
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: corsHeaders });

// ─────────────────────────────────────────────────────────────────────────────
// Catalogo atti. Il primo CELEX disponibile della lista viene usato per il
// testo vigente (articoli e allegati); i considerando vengono sempre letti
// dall'atto base perché le versioni consolidate non li includono.
// ─────────────────────────────────────────────────────────────────────────────

interface ActSpec {
  regulation: string;
  shortName: string;
  celexBase: string;
  celexCandidates: string[];
  validFrom: string;
  title: string;
}

const ACTS: Record<string, ActSpec> = {
  GDPR: {
    regulation: "GDPR",
    shortName: "GDPR",
    celexBase: "32016R0679",
    celexCandidates: ["02016R0679-20160504", "32016R0679"],
    validFrom: "2016-05-04",
    title: "GDPR - Regolamento (UE) 2016/679",
  },
  NIS2: {
    regulation: "NIS2",
    shortName: "NIS2",
    celexBase: "32022L2555",
    celexCandidates: ["02022L2555-20221227", "32022L2555"],
    validFrom: "2022-12-27",
    title: "NIS2 - Direttiva (UE) 2022/2555",
  },
  DORA: {
    regulation: "DORA",
    shortName: "DORA",
    celexBase: "32022R2554",
    celexCandidates: ["32022R2554"],
    validFrom: "2022-12-27",
    title: "DORA - Regolamento (UE) 2022/2554",
  },
  AI_ACT: {
    regulation: "AI_ACT",
    shortName: "AI Act",
    celexBase: "32024R1689",
    celexCandidates: ["02024R1689-20260727", "32024R1689"],
    validFrom: "2024-07-12",
    title: "AI Act - Regolamento (UE) 2024/1689",
  },
  CRA: {
    regulation: "CRA",
    shortName: "CRA",
    celexBase: "32024R2847",
    celexCandidates: ["02024R2847-20241120", "32024R2847"],
    validFrom: "2024-11-20",
    title: "CRA - Regolamento (UE) 2024/2847",
  },
  DATA_ACT: {
    regulation: "DATA_ACT",
    shortName: "Data Act",
    celexBase: "32023R2854",
    celexCandidates: ["32023R2854"],
    validFrom: "2024-01-11",
    title: "Data Act - Regolamento (UE) 2023/2854",
  },
  EPRIVACY: {
    regulation: "EPRIVACY",
    shortName: "ePrivacy",
    celexBase: "32002L0058",
    celexCandidates: ["02002L0058-20091219", "32002L0058"],
    validFrom: "2009-12-19",
    title: "ePrivacy - Direttiva 2002/58/CE (vita privata e comunicazioni elettroniche, cookie)",
  },
  DSA: {
    regulation: "DSA",
    shortName: "DSA",
    celexBase: "32022R2065",
    celexCandidates: ["02022R2065-20221027", "32022R2065"],
    validFrom: "2022-11-16",
    title: "DSA - Digital Services Act, Regolamento (UE) 2022/2065 (servizi digitali)",
  },
  NIS2_IR: {
    regulation: "NIS2_IR",
    shortName: "Reg. di esecuzione (UE) 2024/2690",
    celexBase: "32024R2690",
    celexCandidates: ["02024R2690-20241018", "32024R2690"],
    validFrom: "2024-11-07",
    title: "NIS2 - Regolamento di esecuzione (UE) 2024/2690 (misure tecniche per fornitori digitali)",
  },
  DORA_RTS_ICT: {
    regulation: "DORA_RTS_ICT",
    shortName: "Reg. delegato (UE) 2024/1774",
    celexBase: "32024R1774",
    celexCandidates: ["02024R1774-20240625", "32024R1774"],
    validFrom: "2024-07-15",
    title: "DORA - Regolamento delegato (UE) 2024/1774 (quadro di gestione dei rischi informatici)",
  },
  DORA_RTS_INC: {
    regulation: "DORA_RTS_INC",
    shortName: "Reg. delegato (UE) 2024/1772",
    celexBase: "32024R1772",
    celexCandidates: ["32024R1772"],
    validFrom: "2024-07-15",
    title: "DORA - Regolamento delegato (UE) 2024/1772 (classificazione degli incidenti informatici)",
  },
  DORA_ITS_REG: {
    regulation: "DORA_ITS_REG",
    shortName: "Reg. di esecuzione (UE) 2024/2956",
    celexBase: "32024R2956",
    celexCandidates: ["32024R2956"],
    validFrom: "2024-12-22",
    title: "DORA - Regolamento di esecuzione (UE) 2024/2956 (registro delle informazioni sui fornitori ICT)",
  },
  EAA: {
    regulation: "EAA",
    shortName: "European Accessibility Act",
    celexBase: "32019L0882",
    celexCandidates: ["02019L0882-20190607", "32019L0882"],
    validFrom: "2019-06-27",
    title: "European Accessibility Act - Direttiva (UE) 2019/882 (accessibilità di prodotti e servizi)",
  },
  WAD: {
    regulation: "WAD",
    shortName: "Dir. (UE) 2016/2102",
    celexBase: "32016L2102",
    celexCandidates: ["02016L2102-20161202", "32016L2102"],
    validFrom: "2016-12-22",
    title: "Accessibilità siti web PA - Direttiva (UE) 2016/2102",
  },
  PSD2: {
    regulation: "PSD2",
    shortName: "PSD2",
    celexBase: "32015L2366",
    celexCandidates: ["02015L2366-20250117", "32015L2366"],
    validFrom: "2016-01-12",
    title: "PSD2 - Direttiva (UE) 2015/2366 (servizi di pagamento)",
  },
  PSD2_SCA: {
    regulation: "PSD2_SCA",
    shortName: "Reg. delegato (UE) 2018/389",
    celexBase: "32018R0389",
    celexCandidates: ["02018R0389-20230912", "32018R0389"],
    validFrom: "2019-09-14",
    title: "PSD2 - Regolamento delegato (UE) 2018/389 (autenticazione forte del cliente, SCA)",
  },
  EIDAS: {
    regulation: "EIDAS",
    shortName: "eIDAS",
    celexBase: "32014R0910",
    celexCandidates: ["02014R0910-20241018", "32014R0910"],
    validFrom: "2014-09-17",
    title: "eIDAS - Regolamento (UE) 910/2014 come modificato dal Reg. (UE) 2024/1183 (identità digitale e firme elettroniche)",
  },
  PLD: {
    regulation: "PLD",
    shortName: "Dir. (UE) 2024/2853",
    celexBase: "32024L2853",
    celexCandidates: ["32024L2853"],
    validFrom: "2024-12-08",
    title: "Prodotti difettosi - Direttiva (UE) 2024/2853 (responsabilità per danno da prodotti difettosi, software)",
  },
  DCD: {
    regulation: "DCD",
    shortName: "Dir. (UE) 2019/770",
    celexBase: "32019L0770",
    celexCandidates: ["02019L0770-20190522", "32019L0770"],
    validFrom: "2019-06-11",
    title: "Contenuti digitali - Direttiva (UE) 2019/770 (contratti di fornitura di contenuti e servizi digitali)",
  },
  EHDS: {
    regulation: "EHDS",
    shortName: "EHDS",
    celexBase: "32025R0327",
    celexCandidates: ["02025R0327-20250305", "32025R0327"],
    validFrom: "2025-03-26",
    title: "EHDS - Regolamento (UE) 2025/327 (spazio europeo dei dati sanitari)",
  },
  MDR: {
    regulation: "MDR",
    shortName: "MDR",
    celexBase: "32017R0745",
    celexCandidates: ["02017R0745-20260719", "32017R0745"],
    validFrom: "2017-05-25",
    title: "MDR - Regolamento (UE) 2017/745 (dispositivi medici, software medicale)",
  },
  SW_DIR: {
    regulation: "SW_DIR",
    shortName: "Dir. 2009/24/CE",
    celexBase: "32009L0024",
    celexCandidates: ["32009L0024"],
    validFrom: "2009-05-25",
    title: "Diritto d'autore software - Direttiva 2009/24/CE (tutela dei programmi per elaboratore)",
  },
  DSM_COPYRIGHT: {
    regulation: "DSM_COPYRIGHT",
    shortName: "Dir. (UE) 2019/790",
    celexBase: "32019L0790",
    celexCandidates: ["02019L0790-20190517", "32019L0790"],
    validFrom: "2019-06-06",
    title: "Diritto d'autore - Direttiva (UE) 2019/790 (mercato unico digitale, text and data mining)",
  },
};

// ─────────────────────────────────────────────────────────────────────────────
// Download Formex (Cellar) e unzip minimale
// ─────────────────────────────────────────────────────────────────────────────

async function unzipEntries(data: Uint8Array): Promise<Array<[string, string]>> {
  const dv = new DataView(data.buffer, data.byteOffset, data.byteLength);
  const decoder = new TextDecoder("utf-8");
  const out: Array<[string, string]> = [];
  let i = 0;
  while (i < data.length - 4) {
    if (dv.getUint32(i, true) !== 0x04034b50) break;
    const method = dv.getUint16(i + 8, true);
    let compSize = dv.getUint32(i + 18, true);
    const nameLen = dv.getUint16(i + 26, true);
    const extraLen = dv.getUint16(i + 28, true);
    const name = decoder.decode(data.subarray(i + 30, i + 30 + nameLen));
    const start = i + 30 + nameLen + extraLen;
    if (compSize === 0) {
      let j = start;
      while (j < data.length - 4) {
        const s = dv.getUint32(j, true);
        if (s === 0x08074b50 || s === 0x04034b50 || s === 0x02014b50) break;
        j++;
      }
      compSize = j - start;
    }
    const slice = data.subarray(start, start + compSize);
    let text = "";
    if (method === 0) text = decoder.decode(slice);
    else {
      const ds = new DecompressionStream("deflate-raw");
      text = await new Response(new Blob([slice]).stream().pipeThrough(ds))
        .text();
    }
    out.push([name, text]);
    i = start + compSize;
    if (i < data.length - 4 && dv.getUint32(i, true) === 0x08074b50) i += 16;
  }
  return out;
}

async function fetchFormex(celex: string, lang: string): Promise<string> {
  const res = await fetch(
    `http://publications.europa.eu/resource/celex/${celex}`,
    {
      headers: {
        "Accept": "application/zip;mtype=fmx4",
        "Accept-Language": lang === "EN" ? "eng" : "ita",
        "User-Agent": "RegBrain-ingestion/2.0",
      },
      signal: AbortSignal.timeout(45000),
    },
  );
  if (!res.ok) throw new Error(`Cellar ${celex}: HTTP ${res.status}`);
  const files = await unzipEntries(new Uint8Array(await res.arrayBuffer()));
  let best = "";
  for (const [name, content] of files) {
    if (!name.toLowerCase().endsWith(".xml") || name.includes(".doc.xml")) {
      continue;
    }
    if (content.includes("<ARTICLE") && content.length > best.length) {
      best = content;
    }
  }
  if (!best) throw new Error(`Nessun XML Formex con articoli per ${celex}`);
  return best;
}

async function fetchFirstAvailable(
  candidates: string[],
  lang: string,
): Promise<{ celex: string; xml: string }> {
  let lastError: unknown = null;
  for (const celex of candidates) {
    try {
      return { celex, xml: await fetchFormex(celex, lang) };
    } catch (e) {
      lastError = e;
      console.warn(`[formex] ${celex} non disponibile: ${String(e)}`);
    }
  }
  throw new Error(`Nessuna versione disponibile: ${String(lastError)}`);
}

// ─────────────────────────────────────────────────────────────────────────────
// Formex → testo
// ─────────────────────────────────────────────────────────────────────────────

function decodeEntities(s: string): string {
  return s
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#x([0-9a-fA-F]+);/g, (_m, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_m, d) => String.fromCodePoint(parseInt(d, 10)))
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&");
}

/** Testo leggibile da un frammento Formex, preservando lettere, punti e righe di tabella. */
function xmlToText(fragment: string): string {
  let s = fragment;
  s = s.replace(/<NOTE\b[\s\S]*?<\/NOTE>/g, "");
  s = s.replace(/<\?[\s\S]*?\?>/g, "");
  s = s.replace(/<QUOT\.START\b[^>]*\/?>/g, "«");
  s = s.replace(/<QUOT\.END\b[^>]*\/?>/g, "»");
  s = s.replace(/<ITEM\b[^>]*>/g, "\n");
  s = s.replace(/<DLIST\.ITEM\b[^>]*>/g, "\n");
  s = s.replace(/<\/?P\b[^>]*>/g, "\n");
  s = s.replace(/<\/NO\.P>/g, " ");
  s = s.replace(/<\/PREFIX>/g, " ");
  s = s.replace(/<\/TERM>/g, ": ");
  s = s.replace(/<\/ROW>/g, "\n");
  s = s.replace(/<\/CELL>/g, " | ");
  s = s.replace(/<[^>]+>/g, "");
  s = decodeEntities(s);
  s = s.replace(/[ \t\u00a0]+/g, " ");
  s = s.split("\n").map((l) => l.trim()).filter(Boolean).join("\n");
  return s.trim();
}

async function sha256(text: string): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

interface Unit {
  chunk_key: string;
  citation_label: string;
  context_header: string;
  unit_type: string;
  article_number: number | null;
  article_reference: string | null;
  paragraph: string | null;
  letter: string | null;
  section_hierarchy: string | null;
  text: string;
  cross_references: string[];
  is_obligation: boolean;
}

const OBLIGATION_RE =
  /\b(deve|devono|è tenut|sono tenut|obbligo|obblighi|assicura|garantisc|provvede|adotta|shall|must|is required|are required)\b/i;

function extractCrossRefs(text: string): string[] {
  const refs = new Set<string>();
  const re = /(?:articolo|art\.)\s+(\d+)(?:\s*(bis|ter|quater))?(?:\s*,\s*(?:paragrafo|par\.)\s*(\d+))?/gi;
  let m;
  while ((m = re.exec(text)) !== null) {
    const art = `art${m[1]}${m[2] ? m[2].toLowerCase() : ""}`;
    refs.add(m[3] ? `${art}:par${m[3]}` : art);
  }
  return [...refs].slice(0, 20);
}

// Un paragrafo resta di norma un'unità sola, anche se lungo (es. l'elenco delle
// pratiche vietate dell'art. 5 AI Act): così il modello vede sempre l'elenco
// completo. Solo le unità che superano il limite dell'embedding (8000 caratteri
// con intestazione) vengono divise su confini di riga, mantenendo i metadati.
const MAX_UNIT_CHARS = 7000;
const TARGET_PART_CHARS = 5500;

function splitLongUnit(unit: Unit): Unit[] {
  if (unit.text.length <= MAX_UNIT_CHARS) return [unit];
  const lines = unit.text.split("\n");
  const parts: string[] = [];
  let buffer = "";
  for (const line of lines) {
    if (buffer && (buffer.length + line.length + 1) > TARGET_PART_CHARS) {
      parts.push(buffer);
      buffer = line;
    } else {
      buffer = buffer ? `${buffer}\n${line}` : line;
    }
  }
  if (buffer) parts.push(buffer);
  return parts.map((text, i) => ({
    ...unit,
    chunk_key: `${unit.chunk_key}:p${i + 1}`,
    citation_label: `${unit.citation_label} (parte ${i + 1}/${parts.length})`,
    context_header: unit.context_header.replace(/\]$/, `. Parte ${i + 1}/${parts.length}]`),
    text,
    cross_references: extractCrossRefs(text),
    is_obligation: OBLIGATION_RE.test(text),
  }));
}

interface ParseOptions {
  articles: boolean;
  annexes: boolean;
  recitals: boolean;
}

function parseFormex(xml: string, act: ActSpec, celex: string, lang: string, opts: ParseOptions): Unit[] {
  const units: Unit[] = [];
  const keyBase = `eu:${celex}:${lang.toLowerCase()}`;
  const headerBase = `${act.shortName}, ${celex}, vigente`;

  // Gerarchia TITOLO / CAPO / SEZIONE in base alla posizione nel documento
  const hierarchyAt: Array<{ pos: number; label: string; level: number }> = [];
  const titleRe = /<TITLE\b[^>]*>([\s\S]*?)<\/TITLE>/g;
  let tm;
  while ((tm = titleRe.exec(xml)) !== null) {
    const txt = xmlToText(tm[1]).replace(/\n+/g, " ").trim();
    if (!txt) continue;
    let level = -1;
    if (/^(titolo|title)\b/i.test(txt)) level = 0;
    else if (/^(capo|chapter)\b/i.test(txt)) level = 1;
    else if (/^(sezione|section)\b/i.test(txt)) level = 2;
    if (level >= 0) hierarchyAt.push({ pos: tm.index, label: txt.substring(0, 90), level });
  }
  const lastBefore = (level: number, pos: number) => {
    let found: { pos: number; label: string } | null = null;
    for (const h of hierarchyAt) if (h.level === level && h.pos < pos) found = h;
    return found;
  };
  const hierarchyFor = (pos: number): string | null => {
    const title = lastBefore(0, pos);
    const chapter = lastBefore(1, pos);
    let section = lastBefore(2, pos);
    // Un capo azzera il titolo precedente solo se lo segue; una sezione vale
    // solo se appartiene al capo corrente.
    if (section && chapter && section.pos < chapter.pos) section = null;
    const parts = [title, chapter, section].filter(Boolean).map((h) => h!.label);
    return parts.length ? parts.join(" > ") : null;
  };

  // ── Considerando ──
  if (opts.recitals) {
    const considRe = /<CONSID\b[^>]*>([\s\S]*?)<\/CONSID>/g;
    let cm;
    let considIndex = 0;
    while ((cm = considRe.exec(xml)) !== null) {
      considIndex++;
      const inner = cm[1];
      const noMatch = inner.match(/<NO\.P>\s*\(?(\d+)\)?\s*<\/NO\.P>/);
      const num = noMatch ? noMatch[1] : String(considIndex);
      const text = xmlToText(inner.replace(/<NO\.P>[\s\S]*?<\/NO\.P>/, ""));
      if (text.length < 20) continue;
      const label = `${act.shortName}, considerando ${num}`;
      units.push({
        chunk_key: `${keyBase}:rec${num}`,
        citation_label: label,
        context_header: `[${headerBase}. Preambolo. Considerando ${num}]`,
        unit_type: "considerando",
        article_number: null,
        article_reference: `Considerando ${num}`,
        paragraph: null,
        letter: null,
        section_hierarchy: "Preambolo",
        text,
        cross_references: extractCrossRefs(text),
        is_obligation: false,
      });
    }
  }

  // ── Articoli ──
  if (opts.articles) {
    const artRe = /<ARTICLE\b[^>]*>([\s\S]*?)<\/ARTICLE>/g;
    let am;
    while ((am = artRe.exec(xml)) !== null) {
      const inner = am[1];
      const tiMatch = inner.match(/<TI\.ART>([\s\S]*?)<\/TI\.ART>/);
      const stiMatch = inner.match(/<STI\.ART>([\s\S]*?)<\/STI\.ART>/);
      const tiText = tiMatch ? xmlToText(tiMatch[1]).replace(/\n+/g, " ") : "";
      const rubric = stiMatch ? xmlToText(stiMatch[1]).replace(/\n+/g, " ") : "";
      const numMatch = tiText.match(/(\d+)\s*(bis|ter|quater|quinquies|sexies)?/i);
      if (!numMatch) continue;
      const artNum = parseInt(numMatch[1], 10);
      const suffix = numMatch[2] ? ` ${numMatch[2].toLowerCase()}` : "";
      const hierarchy = hierarchyFor(am.index);
      const artRef = `Art. ${artNum}${suffix}`;
      const artHeader = `[${headerBase}.${hierarchy ? " " + hierarchy + "." : ""} Art. ${artNum}${suffix}${rubric ? ": " + rubric : ""}`;
      const keyArt = `${keyBase}:art${artNum}${suffix.trim()}`;

      const parags = [...inner.matchAll(/<PARAG\b[^>]*>([\s\S]*?)<\/PARAG>/g)];

      if (parags.length === 0) {
        const body = xmlToText(
          inner.replace(/<TI\.ART>[\s\S]*?<\/TI\.ART>/, "").replace(/<STI\.ART>[\s\S]*?<\/STI\.ART>/, ""),
        );
        if (body.length < 15) continue;
        units.push(...splitLongUnit({
          chunk_key: keyArt,
          citation_label: `${act.shortName}, art. ${artNum}${suffix}`,
          context_header: `${artHeader}]`,
          unit_type: "articolo",
          article_number: artNum,
          article_reference: artRef,
          paragraph: null,
          letter: null,
          section_hierarchy: hierarchy,
          text: `${tiText}${rubric ? ": " + rubric : ""}\n${body}`,
          cross_references: extractCrossRefs(body),
          is_obligation: OBLIGATION_RE.test(body),
        }));
        continue;
      }

      parags.forEach((pm, index) => {
        const pInner = pm[1];
        const noParag = pInner.match(/<NO\.PARAG>\s*([^<]*?)\s*<\/NO\.PARAG>/);
        const parNumRaw = noParag ? noParag[1].replace(/[.)]/g, "").trim() : "";
        const parNum = parNumRaw || String(index + 1);
        const body = xmlToText(pInner.replace(/<NO\.PARAG>[\s\S]*?<\/NO\.PARAG>/, ""));
        if (body.length < 15) return;
        units.push(...splitLongUnit({
          chunk_key: `${keyArt}:par${parNum.replace(/\s+/g, "")}`,
          citation_label: `${act.shortName}, art. ${artNum}${suffix}, par. ${parNum}`,
          context_header: `${artHeader}. Par. ${parNum}]`,
          unit_type: "paragrafo",
          article_number: artNum,
          article_reference: artRef,
          paragraph: parNum,
          letter: null,
          section_hierarchy: hierarchy,
          text: `${parNum}. ${body}`,
          cross_references: extractCrossRefs(body),
          is_obligation: OBLIGATION_RE.test(body),
        }));
      });
    }
  }

  // ── Allegati ──
  if (opts.annexes) {
    const annexRe = /<(?:CONS\.)?ANNEX\b[^>]*>([\s\S]*?)<\/(?:CONS\.)?ANNEX>/g;
    let anm;
    let annexIdx = 0;
    while ((anm = annexRe.exec(xml)) !== null) {
      annexIdx++;
      const inner = anm[1];
      const tiMatch = inner.match(/<TI>([\s\S]*?)<\/TI>/);
      const stiMatch = inner.match(/<STI>([\s\S]*?)<\/STI>/);
      const tiPart = tiMatch ? xmlToText(tiMatch[1]).replace(/\n+/g, " ") : "";
      const stiPart = stiMatch ? xmlToText(stiMatch[1]).replace(/\n+/g, " ") : "";
      const annexTitle = [tiPart || `Allegato ${annexIdx}`, stiPart].filter(Boolean).join(": ");
      const fullText = xmlToText(inner);
      const lines = fullText.split("\n");
      let buffer: string[] = [];
      let part = 0;
      const flush = () => {
        const text = buffer.join("\n").trim();
        buffer = [];
        if (text.length < 30) return;
        part++;
        units.push({
          chunk_key: `${keyBase}:annex${annexIdx}:p${part}`,
          citation_label: `${act.shortName}, ${annexTitle} (parte ${part})`,
          context_header: `[${headerBase}. ${annexTitle}. Parte ${part}]`,
          unit_type: "allegato",
          article_number: null,
          article_reference: annexTitle,
          paragraph: null,
          letter: null,
          section_hierarchy: annexTitle,
          text: `${annexTitle}\n${text}`,
          cross_references: extractCrossRefs(text),
          is_obligation: false,
        });
      };
      for (const line of lines) {
        buffer.push(line);
        if (buffer.join("\n").length > 1800) flush();
      }
      flush();
    }
  }

  return units;
}

// ─────────────────────────────────────────────────────────────────────────────
// Embedding a lotti (stesso modello e normalizzazione delle query di rag-query)
// ─────────────────────────────────────────────────────────────────────────────

async function embedBatch(key: string, inputs: string[]): Promise<Array<number[] | null>> {
  const texts = inputs.map((t) => t.substring(0, 8000));
  for (let attempt = 0; attempt < 4; attempt++) {
    try {
      return await embedTexts(key, texts, "RETRIEVAL_DOCUMENT");
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      console.warn(`[embed] tentativo ${attempt + 1} fallito: ${message}`);
      if (attempt < 3) await new Promise((r) => setTimeout(r, 3000 * (attempt + 1)));
    }
  }
  return texts.map(() => null);
}

// ─────────────────────────────────────────────────────────────────────────────

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "POST richiesto" }, 405);

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const admin = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });

  // Autorizzazione: chiave di servizio oppure utente con ruolo admin
  let authorized = await isServiceRequest(req, configuredServiceKeys((name) => Deno.env.get(name)));
  if (!authorized) {
    const bearer = req.headers.get("Authorization")?.replace(/^Bearer /, "") || "";
    const { data: { user } } = await admin.auth.getUser(bearer);
    if (user) {
      const { data: roleRow } = await admin.from("user_roles").select("role").eq("user_id", user.id).eq("role", "admin").maybeSingle();
      authorized = !!roleRow;
    }
  }
  if (!authorized) return json({ error: "Accesso riservato agli amministratori" }, 401);

  let body: any;
  try { body = await req.json(); } catch { return json({ error: "JSON non valido" }, 400); }
  if (!body || typeof body !== "object" || Array.isArray(body)) return json({ error: "Richiesta non valida" }, 400);

  const regulation = String(body.regulation ?? "").toUpperCase();
  const lang = String(body.lang ?? "IT").toUpperCase();
  const offset = Math.max(0, Number(body.offset ?? 0) | 0);
  const limit = Math.min(Math.max(1, Number(body.limit ?? 120) | 0), 200);
  const dryRun = body.dryRun === true;
  const reset = body.reset === true;
  const includeRecitals = body.includeRecitals !== false;

  const act = ACTS[regulation];
  if (!act) return json({ error: `Norma non in catalogo: ${regulation}`, available: Object.keys(ACTS) }, 400);

  try {
    const started = Date.now();
    const { celex, xml } = await fetchFirstAvailable(act.celexCandidates, lang);
    const units = parseFormex(xml, act, celex, lang, { articles: true, annexes: true, recitals: false });
    let recitalCount = 0;
    if (includeRecitals) {
      try {
        const baseXml = celex === act.celexBase ? xml : await fetchFormex(act.celexBase, lang);
        const recitals = parseFormex(baseXml, act, celex, lang, { articles: false, annexes: false, recitals: true });
        recitalCount = recitals.length;
        units.push(...recitals);
      } catch (e) {
        console.warn(`[formex] considerando non disponibili per ${act.celexBase}: ${String(e)}`);
      }
    }

    // Deduplica per chunk_key mantenendo la prima occorrenza
    const seen = new Set<string>();
    const deduped = units.filter((u) => (seen.has(u.chunk_key) ? false : (seen.add(u.chunk_key), true)));

    const stats = {
      regulation,
      celex,
      lang,
      totalUnits: deduped.length,
      articles: new Set(deduped.filter((u) => u.article_number !== null).map((u) => u.article_number)).size,
      articleUnits: deduped.filter((u) => u.unit_type === "articolo").length,
      paragraphUnits: deduped.filter((u) => u.unit_type === "paragrafo").length,
      annexUnits: deduped.filter((u) => u.unit_type === "allegato").length,
      recitalUnits: recitalCount,
      maxUnitChars: Math.max(0, ...deduped.map((u) => u.text.length)),
      avgUnitChars: deduped.length ? Math.round(deduped.reduce((s, u) => s + u.text.length, 0) / deduped.length) : 0,
    };

    if (dryRun) {
      const sampleKeys = body.sampleKeys as string[] | undefined;
      const sample = (sampleKeys?.length
        ? deduped.filter((u) => sampleKeys.some((k) => u.chunk_key.endsWith(k)))
        : deduped.slice(0, 4)).map((u) => ({
          chunk_key: u.chunk_key,
          citation_label: u.citation_label,
          context_header: u.context_header,
          chars: u.text.length,
          preview: u.text.substring(0, 500),
        }));
      return json({ success: true, dryRun: true, ...stats, sample });
    }

    const geminiKey = Deno.env.get("GEMINI_API_KEY");
    if (!geminiKey) return json({ error: "GEMINI_API_KEY mancante" }, 503);

    // Documento contenitore (uno per norma e versione)
    const docTitle = `${act.title} (EUR-Lex ${celex}, ${lang})`;
    let documentId: string;
    const { data: existingDoc } = await admin.from("documents").select("id").eq("title", docTitle).maybeSingle();
    if (existingDoc) documentId = existingDoc.id;
    else {
      const { data: newDoc, error: docErr } = await admin.from("documents").insert({
        title: docTitle,
        source_url: `https://eur-lex.europa.eu/legal-content/${lang}/TXT/?uri=CELEX:${celex}`,
        jurisdiction: "EU",
        sector: "All",
        language: lang.toLowerCase(),
        version: celex,
        is_public: true,
      }).select("id").single();
      if (docErr) throw docErr;
      documentId = newDoc.id;
    }

    if (reset && offset === 0) {
      const { error: e1 } = await admin.from("structured_chunks").delete().eq("document_id", documentId);
      if (e1) throw e1;
      const { error: e2 } = await admin.from("chunks").delete().eq("document_id", documentId);
      if (e2) throw e2;
    }

    // Posizioni cumulative: i chunk speculari restano "vicini" nell'ordine del testo
    const positions: Array<{ start: number; end: number }> = [];
    let cursor = 0;
    for (const u of deduped) {
      const len = u.context_header.length + 1 + u.text.length;
      positions.push({ start: cursor, end: cursor + len });
      cursor += len + 1;
    }

    const slice = deduped.slice(offset, offset + limit);
    const vectors: Array<number[] | null> = [];
    for (let i = 0; i < slice.length; i += 20) {
      const group = slice.slice(i, i + 20);
      vectors.push(...await embedBatch(geminiKey, group.map((u) => `${u.context_header}\n${u.text}`)));
    }

    const structuredRows: Record<string, unknown>[] = [];
    const mirrorRows: Record<string, unknown>[] = [];
    for (let i = 0; i < slice.length; i++) {
      const u = slice[i];
      const embedding = vectors[i] ? JSON.stringify(vectors[i]) : null;
      const embeddingModel = vectors[i] ? `${EMBEDDING_MODEL}:RETRIEVAL_DOCUMENT:768` : null;
      structuredRows.push({
        document_id: documentId,
        regulation: act.regulation,
        article_reference: u.article_reference,
        article_number: u.article_number,
        paragraph: u.paragraph,
        letter: u.letter,
        citation_label: u.citation_label,
        chunk_key: u.chunk_key,
        content_hash: `sha256:${await sha256(u.text)}`,
        context_header: u.context_header,
        unit_type: u.unit_type,
        celex,
        lang,
        valid_from: act.validFrom,
        valid_to: null,
        source_format: "formex",
        section_hierarchy: u.section_hierarchy,
        chunk_text: u.text,
        cross_references: u.cross_references,
        is_obligation: u.is_obligation,
        embedding,
        embedding_model: embeddingModel,
      });
      const pos = positions[offset + i];
      mirrorRows.push({
        document_id: documentId,
        content: `${u.context_header}\n${u.text}`,
        start_pos: pos.start,
        end_pos: pos.end,
        embedding,
        embedding_model: embeddingModel,
      });
    }

    let inserted = 0;
    if (structuredRows.length > 0) {
      const keys = structuredRows.map((r) => r.chunk_key as string);
      const { error: delErr } = await admin.from("structured_chunks").delete().in("chunk_key", keys);
      if (delErr) throw delErr;
      const { error: delMirrorErr } = await admin.from("chunks").delete().eq("document_id", documentId).in("start_pos", mirrorRows.map((r) => r.start_pos as number));
      if (delMirrorErr) throw delMirrorErr;
      for (let i = 0; i < structuredRows.length; i += 20) {
        const { error } = await admin.from("structured_chunks").insert(structuredRows.slice(i, i + 20));
        if (error) throw error;
        const { error: mirrorError } = await admin.from("chunks").insert(mirrorRows.slice(i, i + 20));
        if (mirrorError) throw mirrorError;
        inserted += Math.min(20, structuredRows.length - i);
      }
    }

    const nextOffset = offset + slice.length;
    const done = nextOffset >= deduped.length;
    // Dopo cancellazioni e reinserimenti massivi gli indici HNSW perdono
    // richiamo: a fine ingestione vengono ricostruiti.
    let indexesRebuilt = false;
    if (done) {
      const { error: reindexError } = await admin.rpc("rebuild_embedding_indexes");
      if (reindexError) console.warn("[formex] ricostruzione indici fallita:", reindexError.message);
      else indexesRebuilt = true;
    }
    return json({
      indexesRebuilt,
      success: true,
      ...stats,
      documentId,
      offset,
      processed: slice.length,
      inserted,
      embedded: vectors.filter(Boolean).length,
      nextOffset: done ? null : nextOffset,
      done,
      ms: Date.now() - started,
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    console.error("[formex] errore", message);
    return json({ error: message }, 500);
  }
});
