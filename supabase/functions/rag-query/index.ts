import { embedTexts } from '../_shared/embeddings.ts';
import { protect } from '../_shared/access.ts';
import { aiFetch as fetch, getAIKey, getAIModel } from '../_shared/ai.ts';
import { serve as denoServe } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2.75.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

// ── Helpers ──────────────────────────────────────────────────────────────

function scoreChunkRelevance(
  chunkContent: string,
  questionKeywords: string[],
  questionArticles: string[],
  topicKeywords: string[],
): number {
  const lower = chunkContent.toLowerCase();
  let score = 0;
  for (const kw of questionKeywords) {
    if (lower.includes(kw)) score += 1;
  }
  for (const kw of topicKeywords) {
    if (lower.includes(kw.toLowerCase())) score += 2;
  }
  for (const art of questionArticles) {
    const patterns = [
      `articolo ${art}`,
      `art. ${art}`,
      `art ${art}`,
      `article ${art}`,
    ];
    for (const p of patterns) {
      if (lower.includes(p)) {
        score += 5;
        break;
      }
    }
  }
  return score;
}

function extractKeywords(question: string): string[] {
  const stopWords = new Set([
    "quali",
    "cosa",
    "come",
    "devo",
    "sono",
    "deve",
    "degli",
    "delle",
    "nella",
    "della",
    "questo",
    "questa",
    "quanto",
    "quando",
    "quale",
    "secondo",
    // NOTE: "stati", "membri", "entro" intentionally NOT stopwords
    // — essential to retrieve transposition / recepimento clauses
    // (e.g. "Stati membri adottano", "entro il 17 ottobre 2024").
    "specifici",
    "requisiti",
    "essere",
    "fare",
    "dire",
    "anche",
    "solo",
    "tutto",
    "ogni",
    "nella",
    "nello",
    "nelle",
    "negli",
    "dalla",
    "dallo",
    "dalle",
    "dagli",
    "alla",
    "allo",
    "alle",
    "agli",
    "sulla",
    "sullo",
    "sulle",
    "sugli",
    "with",
    "what",
    "which",
    "that",
    "this",
    "have",
    "from",
    "they",
    "been",
    "about",
    "would",
    "there",
    "their",
    "will",
    "each",
    "make",
    "like",
    "long",
    "very",
    "after",
    "just",
    "where",
    "most",
    "know",
    "than",
    "first",
    "well",
    "only",
    "come",
    "made",
    "find",
    "here",
    "thing",
    "many",
    "some",
    "could",
    "them",
    "more",
    "other",
    "into",
    "then",
    "over",
    "such",
    "look",
    "under",
    "also",
    "prevede",
    "prevedono",
    "previsti",
    "previsto",
    "prevista",
    "riguarda",
    "riguardano",
    "relative",
    "relativo",
    "relativa",
    "rispetto",
    "possono",
    "devono",
    "possibile",
  ]);
  return question.toLowerCase().replace(/[^\\w\\sàèéìòùç]/g, " ").split(/\s+/)
    .filter((w) => w.length > 3 && !stopWords.has(w));
}

function extractArticleNumbers(text: string): string[] {
  const matches =
    text.match(/(?:articolo|art\.?|article)\s+(\d+(?:\.\d+)?)/gi) || [];
  return matches.map((m) => {
    const num = m.match(/\d+(?:\.\d+)?/);
    return num ? num[0] : "";
  }).filter(Boolean);
}

function extractChunkReferences(content: string): string[] {
  const refs: string[] = [];
  for (
    const m of content.matchAll(
      /(?:articolo|art\.?|article)\s+(\d+(?:\.\d+)?(?:\s*,\s*(?:comma|paragrafo|paragraph|lettera)\s+\d+(?:\s*[a-z]\))?)?)/gi,
    )
  ) {
    refs.push(m[0].trim());
  }
  for (
    const m of content.matchAll(
      /(?:sezione|section|capo|chapter|titolo|title)\s+(\d+|[IVX]+)/gi,
    )
  ) {
    refs.push(m[0].trim());
  }
  for (const m of content.matchAll(/(?:considerando|recital)\s+(\d+)/gi)) {
    refs.push(m[0].trim());
  }
  return [...new Set(refs)];
}

// ── Citation relevance verification (Fix 5) ──────────────────────────────

const STOP_WORDS_RELEVANCE = new Set([
  "il",
  "lo",
  "la",
  "le",
  "gli",
  "un",
  "uno",
  "una",
  "di",
  "del",
  "dello",
  "della",
  "dei",
  "degli",
  "delle",
  "da",
  "dal",
  "dallo",
  "dalla",
  "dai",
  "dagli",
  "dalle",
  "in",
  "nel",
  "nello",
  "nella",
  "nei",
  "negli",
  "nelle",
  "con",
  "su",
  "sul",
  "sullo",
  "sulla",
  "sui",
  "sugli",
  "sulle",
  "per",
  "tra",
  "fra",
  "che",
  "chi",
  "cui",
  "non",
  "più",
  "anche",
  "come",
  "dove",
  "quando",
  "sono",
  "essere",
  "avere",
  "fare",
  "questo",
  "questa",
  "questi",
  "queste",
  "quello",
  "quella",
  "quelli",
  "quelle",
  "ogni",
  "tutto",
  "tutti",
  "tutta",
  "tutte",
  "altro",
  "altri",
  "altra",
  "altre",
  "deve",
  "devono",
  "può",
  "possono",
  "suoi",
  "sue",
  "proprio",
  "propri",
  "the",
  "and",
  "for",
  "with",
  "that",
  "this",
  "from",
  "have",
  "been",
  "which",
  "obbligo",
  "prevede",
  "previsto",
  "secondo",
  "caso",
  "articolo",
  "art",
]);

function verifyCitationRelevance(
  sentence: string,
  chunkContent: string,
): boolean {
  const words = sentence.toLowerCase().replace(/[^a-zà-ÿ0-9\s]/g, " ").split(
    /\s+/,
  )
    .filter((w) => w.length > 3 && !STOP_WORDS_RELEVANCE.has(w));
  if (words.length === 0) return true;
  const chunkLower = chunkContent.toLowerCase();
  let matchCount = 0;
  for (const w of words) {
    if (chunkLower.includes(w)) matchCount++;
  }
  // For short sentences (< 6 content words), require at least 50% match
  // For medium sentences (6-12 words), require at least 35%
  // For long sentences (> 12 words), require at least 30%
  let minRequired: number;
  if (words.length <= 5) {
    // Short list items ("- Gestione degli incidenti [14];") paraphrase the source: two shared terms are enough.
    minRequired = Math.max(2, Math.ceil(words.length * 0.5));
  } else if (words.length <= 12) {
    minRequired = Math.max(3, Math.ceil(words.length * 0.35));
  } else {
    minRequired = Math.max(4, Math.ceil(words.length * 0.3));
  }
  return matchCount >= minRequired;
}

function isDlgs138Question(text: string): boolean {
  return /d\.?lgs\.?\s*138|138\s*\/?\s*2024|decreto\s+italiano|recepimento\s+della?\s+direttiva\s+nis|decreto\s+legislativo\s+138|recepimento\s+nis2?\s+in\s+italia/i
    .test(text);
}

function isAcnDeterminationQuestion(text: string): boolean {
  // Trigger su Determine ACN: piattaforma NIS, registrazione, notifica incidenti,
  // misure di sicurezza di base, punto di contatto, fornitori rilevanti.
  // Include anche menzioni generiche di "ACN" + (NIS|registr|notif|piattaforma).
  const t = text.toLowerCase();
  if (/determinazione\s+acn|determine\s+acn|piattaforma\s+nis|decreto\s+nis|soggetti\s+nis|notifica\s+(degli\s+)?incidenti|misure\s+di\s+sicurezza\s+di\s+base|punto\s+di\s+contatto|fornitori\s+rilevanti|registrazione\s+(sulla|alla|presso)\s+(piattaforma|acn)|piattaforma\s+(dell['’]?\s*)?acn/i.test(t)) {
    return true;
  }
  // Co-occorrenza ACN + (NIS2|registr|notific|piattaforma|art\.?\s*7|art\.?\s*23|art\.?\s*24|art\.?\s*25)
  if (/\bacn\b/i.test(t) && /(nis\s*2|registr|notific|piattaforma|art\.?\s*(7|23|24|25|29|32))/i.test(t)) {
    return true;
  }
  return false;
}

function isDlgs138DocumentTitle(title: string): boolean {
  const lower = title.toLowerCase();
  return /d\.?lgs\.?\s*138|138\/2024|recepimento\s+direttiva\s+nis2/.test(
    lower,
  ) &&
    !/determinazione\s+acn|piattaforma\s+nis|fornitori\s+rilevanti|punto\s+di\s+contatto/
      .test(lower);
}

function isAcnDeterminationDocumentTitle(title: string): boolean {
  const lower = title.toLowerCase();
  return /determinazione\s+acn|piattaforma\s+nis|obblighi\s+art\.?\s*23|notifica\s+incidenti\s+nis2|fornitori\s+rilevanti|punto\s+di\s+contatto/
    .test(lower);
}

// ── Extract regulation name mentioned by LLM near a citation [N] ──────
function extractCitedRegulationForNumber(
  answer: string,
  citationNum: number,
): string | null {
  // Canonical regulation labels the LLM can mention (covers many variants)
  // Confini di parola obbligatori: senza, "cra" combacia dentro "scraping" e
  // "dora" dentro "adorare", e la citazione viene scartata come normativa errata.
  const REG =
    `\\b(D\\.?Lgs\\.?\\s*138\\/?2024|D\\.?Lgs\\.?\\s*138|GDPR|Regolamento\\s*\\(?UE\\)?\\s*2016\\/679|Reg\\.?\\s*UE\\s*2016\\/679|NIS\\s*2|NIS2|Direttiva\\s*(?:\\(?UE\\)?\\s*)?2022\\/2555|DORA|Regolamento\\s*\\(?UE\\)?\\s*2022\\/2554|AI\\s*Act|Regolamento\\s*\\(?UE\\)?\\s*2024\\/1689|CRA|Cyber\\s*Resilience\\s*Act|Data\\s*Act|Regolamento\\s*\\(?UE\\)?\\s*2023\\/2854|D\\.?Lgs\\.?\\s*81\\/0?8|Testo\\s*Unico\\s*Sicurezza|ISO\\s*\\/?\\s*IEC\\s*27001|ISO\\s*27001|Codice\\s*(?:della\\s*)?Cybersicurezza|Legge\\s*124\\/2024)\\b`;
  const patterns = [
    new RegExp(
      `(?:Articolo|Art\\.?)\\s+\\d+(?:\\.\\d+)?(?:\\s*,\\s*(?:comma|paragrafo|lettera)\\s+\\d+[a-z]?\\)?)?\\s+${REG}\\s*\\[${citationNum}\\]`,
      "gi",
    ),
    new RegExp(
      `(?:Articolo|Art\\.?)\\s+\\d+(?:\\.\\d+)?\\s+(?:del|della|dello)\\s+${REG}\\s*\\[${citationNum}\\]`,
      "gi",
    ),
    new RegExp(
      `${REG}[,:]?\\s*(?:Articolo|Art\\.?)\\s+\\d+[^.\\n]{0,40}\\[${citationNum}\\]`,
      "gi",
    ),
    new RegExp(`${REG}[^.\\n]{0,80}\\[${citationNum}\\]`, "gi"),
  ];
  for (const p of patterns) {
    const m = p.exec(answer);
    if (m && m[1]) return m[1].trim();
  }
  return null;
}

// ── Check if a document title belongs to a specific regulation ──────
function documentBelongsToRegulation(
  docTitle: string,
  regulation: string,
): boolean {
  const lower = docTitle.toLowerCase();

  // Doc-side patterns to match each canonical regulation
  const regulationDocPatterns: Record<string, string[]> = {
    "determinazione acn": [
      "determinazione acn",
      "piattaforma nis",
      "fornitori rilevanti",
      "punto di contatto",
      "decreto nis",
    ],
    "d.lgs. 138/2024": ["d.lgs. 138", "138/2024", "recepimento direttiva nis2"],
    "d.lgs. 138": ["d.lgs. 138", "138/2024", "recepimento direttiva nis2"],
    "gdpr": [
      "gdpr",
      "2016/679",
      "protezione dati personali",
      "general data protection",
    ],
    "nis2": ["nis2", "nis 2", "2022/2555", "decreto nis"],
    "dora": ["dora", "2022/2554", "resilienza operativa digitale"],
    "ai act": ["ai act", "2024/1689", "intelligenza artificiale"],
    "cra": ["cyber resilience", "cra", "elementi digitali"],
    "cyber resilience act": ["cyber resilience", "cra", "elementi digitali"],
    "data act": ["data act", "2023/2854"],
    "d.lgs 81/08": [
      "81/08",
      "81/2008",
      "sicurezza lavoro",
      "testo unico sicurezza",
    ],
    "d.lgs. 81/08": [
      "81/08",
      "81/2008",
      "sicurezza lavoro",
      "testo unico sicurezza",
    ],
    "testo unico sicurezza": [
      "81/08",
      "81/2008",
      "sicurezza lavoro",
      "testo unico sicurezza",
    ],
    "iso 27001": ["iso 27001", "iso/iec 27001", "sgsi", "isms"],
    "codice della cybersicurezza": ["codice", "cybersicurezza"],
    "codice cybersicurezza": ["codice", "cybersicurezza"],
    "legge 124/2024": ["124/2024", "albania", "mbrojtjen e"],
  };

  // Normalize the regulation reference cited by the LLM into a canonical key
  let normalizedReg = regulation.toLowerCase().replace(/\s+/g, " ").trim();
  // Map common variants (e.g. "regolamento ue 2016/679" → "gdpr")
  if (
    /2016\/679|regolamento.*2016\/679|reg\.?\s*ue\s*2016\/679/.test(
      normalizedReg,
    )
  ) normalizedReg = "gdpr";
  else if (/2022\/2555|direttiva.*2022\/2555|nis\s*2/.test(normalizedReg)) {
    normalizedReg = "nis2";
  } else if (/2022\/2554|regolamento.*2022\/2554/.test(normalizedReg)) {
    normalizedReg = "dora";
  } else if (/2024\/1689|regolamento.*2024\/1689/.test(normalizedReg)) {
    normalizedReg = "ai act";
  } else if (/2023\/2854|regolamento.*2023\/2854/.test(normalizedReg)) {
    normalizedReg = "data act";
  } else if (/cyber\s*resilience/.test(normalizedReg)) normalizedReg = "cra";
  else if (
    /determinazione\s+acn|piattaforma\s+nis|fornitori\s+rilevanti|punto\s+di\s+contatto|decreto\s+nis/
      .test(normalizedReg)
  ) normalizedReg = "determinazione acn";
  else if (/138\/?2024|d\.?lgs\.?\s*138/.test(normalizedReg)) {
    normalizedReg = "d.lgs. 138";
  } else if (/81\/0?8|testo\s*unico/.test(normalizedReg)) {
    normalizedReg = "d.lgs. 81/08";
  } else if (/iso\s*\/?\s*iec\s*27001|iso\s*27001/.test(normalizedReg)) {
    normalizedReg = "iso 27001";
  } else if (/codice.*cybersicurezza/.test(normalizedReg)) {
    normalizedReg = "codice della cybersicurezza";
  }

  // ── Regulation FAMILIES: documents that are part of the same legal corpus ──
  // NIS2 family: Direttiva UE 2022/2555 + D.Lgs. 138/2024 (recepimento IT)
  // + Determinazioni ACN (atti attuativi). Citing "NIS2" must accept all three.
  const NIS2_FAMILY_KEYS = new Set(["nis2", "d.lgs. 138", "d.lgs. 138/2024", "determinazione acn"]);
  if (NIS2_FAMILY_KEYS.has(normalizedReg)) {
    const familyPatterns = [
      "nis2", "nis 2", "2022/2555",
      "d.lgs. 138", "138/2024", "recepimento direttiva nis2",
      "determinazione acn", "piattaforma nis", "fornitori rilevanti",
      "punto di contatto", "decreto nis",
    ];
    if (familyPatterns.some((p) => lower.includes(p))) return true;
  }

  let patterns: string[] = [];
  for (const [key, pats] of Object.entries(regulationDocPatterns)) {
    if (normalizedReg.includes(key) || key.includes(normalizedReg)) {
      patterns = pats;
      break;
    }
  }

  if (patterns.length === 0) {
    return lower.includes(normalizedReg);
  }

  return patterns.some((p) => lower.includes(p));
}

// ── Extract article intended for a citation [N] from LLM answer (Fix 1) ──

function extractCitedArticleForNumber(
  answer: string,
  citationNum: number,
): string | null {
  // Look for patterns like "Articolo 15 [N]", "Art. 32 [N]", "art 5, comma 1 [N]"
  // Search in a window around [N]
  const patterns = [
    new RegExp(
      `(?:Articolo|Art\\.?)\\s+(\\d+(?:\\.\\d+)?(?:\\s*,\\s*(?:comma|paragrafo|lettera)\\s+\\d+[a-z]?\\)?)?)\\s*\\[${citationNum}\\]`,
      "gi",
    ),
    new RegExp(
      `\\[${citationNum}\\]\\s*\\((?:Articolo|Art\\.?)\\s+(\\d+(?:\\.\\d+)?)\\)`,
      "gi",
    ),
    // Also check "Articolo X ... [N]" within same sentence
    new RegExp(
      `(?:Articolo|Art\\.?)\\s+(\\d+(?:\\.\\d+)?)[^.\\n]{0,60}\\[${citationNum}\\]`,
      "gi",
    ),
  ];
  for (const p of patterns) {
    const m = p.exec(answer);
    if (m && m[1]) return m[1];
  }
  return null;
}

// Legal Italian text is full of abbreviations with a period ("Art. 21", "par. 2", "D.Lgs. 138/2024").
// Naive sentence splitting on "." cut "Art. 21, paragrafo 2 [14]" into a meaningless fragment and
// made the grounding checks drop correct citations. We mask those periods before splitting.
const ABBREV_MASK = "․"; // one-dot leader, never present in model output
function maskAbbreviations(text: string): string {
  return text
    .replace(/\b(Artt?|artt?|Par|par|Parr|Lett|lett|Cfr|cfr|Es|es|Co|co|Cd|cd|Pag|pag|Reg|reg|Dir|dir|Dec|dec|N|n|Nn|nn|All|all|Sez|sez|Tit|tit|Cap|cap|D|Lgs|lgs|L|Ue|UE|Cost|cost|Ss|ss|Segg|segg|Vs|vs)\./g, `$1${ABBREV_MASK}`)
    .replace(/(\d)\.(\d)/g, `$1${ABBREV_MASK}$2`);
}
function unmaskAbbreviations(text: string): string {
  return text.split(ABBREV_MASK).join(".");
}
// Returns the sentences (as they appear in `text`) that contain the marker [num].
function sentencesWithMarker(text: string, num: number): string[] {
  const masked = maskAbbreviations(text);
  const pattern = new RegExp(`[^.!?\\n]*\\[${num}\\][^.!?\\n]*[.!?]?`, "g");
  const out: string[] = [];
  for (const m of masked.matchAll(pattern)) {
    const original = unmaskAbbreviations(m[0]);
    if (original.trim()) out.push(original);
  }
  return out;
}
// A sentence that names an article which the chunk really contains is verified by that fact alone:
// the term-overlap heuristics must not override it.
function sentenceNamesArticleInChunk(sentence: string, chunkContent: string): boolean {
  for (const m of sentence.matchAll(/(?:Articolo|Artt?\.?|Article)\s+(\d+)(?:\s*-?\s*(bis|ter|quater))?/gi)) {
    if (articleExistsInChunk(chunkContent, m[1])) return true;
  }
  return false;
}
// Canonical reference of a chunk from its context header, e.g. "Art. 35, par. 3", "Considerando 83", "Allegato I".
function chunkOwnReference(content: string): string | null {
  const header = content.match(/^\s*\[([^\]]{10,400})\]/);
  const head = header ? header[1] : content.substring(0, 300);
  const art = head.match(/\bArt\.\s*(\d+\s*(?:bis|ter|quater|quinquies)?)\b/i);
  const par = head.match(/\bPar\.\s*(\d+[a-z]?)\b/i);
  if (art) {
    const artLabel = `Art. ${art[1].replace(/\s+/g, " ").trim()}`;
    return par ? `${artLabel}, par. ${par[1]}` : artLabel;
  }
  const cons = head.match(/\bConsiderando\s+(\d+)\b/i);
  if (cons) return `Considerando ${cons[1]}`;
  const annex = head.match(/\bAllegato\s+([IVXLC]+|\d+)\b/i);
  if (annex) return `Allegato ${annex[1]}`;
  return null;
}
// Removing a marker must not leave " ,." or "( )" behind.
function tidyAfterMarkerRemoval(text: string): string {
  return text
    .replace(/\s+([,.;:])/g, "$1")
    .replace(/,\s*([.;:])/g, "$1")
    .replace(/\(\s*\)/g, "")
    .replace(/,\s*,/g, ",")
    .replace(/[ \t]{2,}/g, " ")
    .trim();
}

function extractStructuralContext(content: string): string | null {
  const patterns = [
    /(?:CAPO|Capo)\s+([IVX]+(?:\s*[-–—]\s*[IVX]+)?)\s*[-–—:.\n]\s*([^\n]{3,80})/g,
    /(?:TITOLO|Titolo)\s+([IVX]+(?:\s*[-–—]\s*[IVX]+)?)\s*[-–—:.\n]\s*([^\n]{3,80})/g,
    /(?:SEZIONE|Sezione)\s+(\d+|[IVX]+)\s*[-–—:.\n]\s*([^\n]{3,80})/g,
    /(?:CHAPTER|Chapter)\s+(\d+|[IVX]+)\s*[-–—:.\n]\s*([^\n]{3,80})/g,
  ];
  const found: string[] = [];
  for (const p of patterns) {
    for (const m of content.matchAll(p)) {
      found.push(m[0].trim());
    }
  }
  for (const m of content.matchAll(/(?:CAPO|Capo)\s+([IVX]+)/g)) {
    if (!found.some((f) => f.includes(m[0]))) found.push(m[0].trim());
  }
  for (const m of content.matchAll(/(?:TITOLO|Titolo)\s+([IVX]+)/g)) {
    if (!found.some((f) => f.includes(m[0]))) found.push(m[0].trim());
  }
  return found.length > 0 ? found.join(" > ") : null;
}

// ── Verify specific paragraph/comma exists in chunk (best effort) ──────
function verifyCommaInChunk(
  chunkContent: string,
  artNum: string,
  comma: string,
): boolean {
  const commaNum = comma.replace(/[^0-9a-z]/g, "").trim();
  if (!commaNum) return true;

  const commaPatterns = [
    new RegExp(
      `(?:articolo|art\\.?)\\s+${artNum}(?!\\d)[^.]{0,100}(?:comma|paragrafo|paragraph|par\\.)\\s*${commaNum}(?!\\d)`,
      "i",
    ),
    new RegExp(
      `(?:comma|paragrafo|paragraph|par\\.)\\s*${commaNum}(?!\\d)[^.]{0,100}(?:articolo|art\\.?)\\s+${artNum}(?!\\d)`,
      "i",
    ),
    new RegExp(`(?:comma|paragrafo)\\s+${commaNum}(?!\\d)`, "i"),
    new RegExp(`^\\s*${commaNum}[.)\\s]`, "im"),
  ];

  return commaPatterns.some((p) => p.test(chunkContent.toLowerCase()));
}

function articleExistsInChunk(chunkContent: string, artNum: string): boolean {
  const lower = chunkContent.toLowerCase();
  const escapedNum = artNum.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  // Word boundary: article number must be followed by a non-digit character (or end of string)
  // This prevents "articolo 5" from matching "articolo 50"
  const patterns = [
    new RegExp(`articolo\\s+${escapedNum}(?!\\d)`, "i"),
    new RegExp(`art\\.\\s*${escapedNum}(?!\\d)`, "i"),
    new RegExp(`art\\s+${escapedNum}(?!\\d)`, "i"),
    new RegExp(`article\\s+${escapedNum}(?!\\d)`, "i"),
  ];
  return patterns.some((p) => p.test(lower));
}

function verifyArticleInChunk(
  chunkContent: string,
  articleRef: string,
): boolean {
  // Handle ranges: "artt. 33-34", "articoli 10-15"
  const rangeMatch = articleRef.match(
    /(?:artt\.?|articoli|articles)\s+(\d+)\s*[-–—]\s*(\d+)/i,
  );
  if (rangeMatch) {
    const start = parseInt(rangeMatch[1]);
    const end = parseInt(rangeMatch[2]);
    for (let n = start; n <= end; n++) {
      if (articleExistsInChunk(chunkContent, String(n))) return true;
    }
    return false;
  }

  // Handle lists: "articoli 5, 6 e 7", "artt. 12, 13, 14"
  const listMatch = articleRef.match(
    /(?:artt\.?|articoli|articles)\s+([\d,\s]+(?:e\s+\d+)?)/i,
  );
  if (listMatch) {
    const nums = listMatch[1].replace(/\s*e\s+/g, ",").split(/\s*,\s*/).map(
      (s) => s.trim(),
    ).filter(Boolean);
    for (const num of nums) {
      if (articleExistsInChunk(chunkContent, num)) return true;
    }
    return false;
  }

  // Handle single article reference
  const numMatch = articleRef.match(
    /(?:articolo|art\.?|article)\s+(\d+(?:\.\d+)?)/i,
  );
  if (!numMatch) return true;
  return articleExistsInChunk(chunkContent, numMatch[1]);
}

// ── Regulation patterns + key topics ─────────────────────────────────────

interface RegulationConfig {
  pattern: RegExp;
  searchTerms: string[];
  keyArticles: string[];
  keyTopics: string[];
  // Codici di structured_chunks da interrogare quando la configurazione scatta
  // (fonti caricate con ingest-eurlex-formex o ingest-web-source).
  codes?: string[];
}

const regulationConfigs: RegulationConfig[] = [
  {
    pattern:
      /ai\s*act|regolamento\s*(?:ue\s*)?2024\/1689|intelligenza\s*artificiale/i,
    searchTerms: ["AI Act", "2024/1689", "intelligenza artificiale"],
    keyArticles: [
      "5",
      "6",
      "9",
      "10",
      "13",
      "14",
      "15",
      "16",
      "17",
      "26",
      "27",
      "49",
      "50",
      "51",
      "52",
      "53",
      "55",
      "71",
      "72",
      "85",
      "99",
    ],
    keyTopics: [
      "trasparenza",
      "alto rischio",
      "pratiche vietate",
      "obblighi fornitori",
      "obblighi deployer",
      "sistema di gestione della qualità",
      "valutazione della conformità",
      "marcatura CE",
      "sorveglianza del mercato",
      "governance",
      "sandbox regolamentare",
      "general-purpose",
      "uso generale",
      "rischio sistemico",
      "fondamentale",
      "deepfake",
      "emozioni",
    ],
  },
  {
    pattern:
      /gdpr|regolamento\s*(?:ue\s*)?2016\/679|protezione\s*dati\s*personali/i,
    searchTerms: ["GDPR", "2016/679", "protezione dati"],
    keyArticles: [
      "5",
      "6",
      "7",
      "9",
      "12",
      "13",
      "14",
      "15",
      "17",
      "20",
      "22",
      "25",
      "28",
      "30",
      "32",
      "33",
      "34",
      "35",
      "37",
      "44",
      "45",
      "46",
      "58",
      "77",
      "83",
    ],
    keyTopics: [
      "principi",
      "liceità",
      "consenso",
      "trasparenza",
      "minimizzazione",
      "portabilità",
      "diritto cancellazione",
      "oblio",
      "profilazione",
      "privacy by design",
      "registro trattamenti",
      "responsabile trattamento",
      "titolare",
      "trasferimento dati",
      "violazione dati",
      "valutazione impatto",
      "DPO",
      "autorità controllo",
      "sanzioni",
    ],
  },
  {
    pattern:
      /determinazione\s+acn|piattaforma\s+nis|decreto\s+nis|soggetti\s+nis|misure\s+di\s+sicurezza\s+di\s+base|fornitori\s+rilevanti|punto\s+di\s+contatto/i,
    searchTerms: [
      "Determinazione ACN",
      "Piattaforma NIS",
      "decreto NIS",
      "ACN",
    ],
    keyArticles: ["7", "23", "24", "25", "29", "31", "32", "40", "42"],
    keyTopics: [
      "misure di sicurezza di base",
      "specifiche di base",
      "notifica incidenti significativi",
      "piattaforma digitale",
      "registrazione",
      "punto di contatto",
      "fornitori rilevanti",
      "aggiornamento annuale",
      "organi di amministrazione",
      "soggetti essenziali",
      "soggetti importanti",
    ],
  },
  {
    pattern:
      /nis\s*2|nis2|direttiva\s*(?:ue\s*)?2022\/2555|d\.?lgs\.?\s*138\s*\/?\s*2024|138\/2024/i,
    searchTerms: [
      "NIS2",
      "2022/2555",
      "D.Lgs. 138/2024",
      "D.Lgs. 138",
      "138/2024",
      "decreto NIS",
    ],
    keyArticles: [
      "7",
      "14",
      "20",
      "21",
      "23",
      "24",
      "25",
      "26",
      "28",
      "29",
      "30",
      "31",
      "32",
      "33",
      "34",
      "35",
      "36",
      "37",
    ],
    keyTopics: [
      "misure gestione rischi",
      "notifica incidenti",
      "catena approvvigionamento",
      "supply chain",
      "organi di gestione",
      "formazione cybersicurezza",
      "CSIRT",
      "soggetti essenziali",
      "soggetti importanti",
      "vigilanza",
      "sanzioni",
      "cooperazione",
      "registro domini",
      "misure di sicurezza di base",
    ],
  },
  {
    pattern:
      /dora|regolamento\s*(?:ue\s*)?2022\/2554|resilienza\s*operativa\s*digitale/i,
    searchTerms: ["DORA", "2022/2554", "resilienza operativa digitale"],
    keyArticles: [
      "5",
      "6",
      "7",
      "8",
      "9",
      "10",
      "11",
      "12",
      "13",
      "14",
      "15",
      "16",
      "17",
      "19",
      "23",
      "24",
      "25",
      "26",
      "27",
      "28",
      "29",
      "30",
    ],
    keyTopics: [
      "gestione rischio ICT",
      "segnalazione incidenti",
      "test resilienza",
      "TLPT",
      "fornitori terze parti ICT",
      "rischio terze parti",
      "accordi contrattuali",
      "continuità operativa",
      "disaster recovery",
      "governance ICT",
      "condivisione informazioni",
      "registro informazioni",
      "sorveglianza fornitori critici",
    ],
  },
  {
    pattern: /cyber\s*resilience\s*act|cra|regolamento.*elementi\s*digitali/i,
    searchTerms: ["Cyber Resilience Act", "CRA", "elementi digitali"],
    keyArticles: [
      "5",
      "6",
      "7",
      "10",
      "11",
      "13",
      "14",
      "15",
      "16",
      "17",
      "18",
      "20",
      "21",
      "22",
      "23",
      "24",
      "25",
    ],
    keyTopics: [
      "requisiti essenziali",
      "elementi digitali",
      "vulnerabilità",
      "aggiornamenti sicurezza",
      "SBOM",
      "valutazione conformità",
      "marcatura CE",
      "sorveglianza mercato",
      "obblighi fabbricanti",
      "obblighi importatori",
      "obblighi distributori",
      "segnalazione vulnerabilità",
      "supporto sicurezza",
    ],
  },
  {
    pattern: /data\s*act|regolamento\s*(?:ue\s*)?2023\/2854/i,
    searchTerms: ["Data Act", "2023/2854"],
    keyArticles: [
      "3",
      "4",
      "5",
      "6",
      "8",
      "9",
      "14",
      "15",
      "23",
      "25",
      "30",
      "31",
      "33",
      "34",
      "35",
    ],
    keyTopics: [
      "accesso dati",
      "condivisione dati",
      "portabilità",
      "switching",
      "clausole contrattuali abusive",
      "interoperabilità",
      "cloud switching",
      "obblighi titolari dati",
      "settore pubblico",
      "trasferimento internazionale",
    ],
  },
  {
    pattern: /codice\s*(della\s*)?cybersicurezza/i,
    searchTerms: ["Codice della Cybersicurezza", "cybersicurezza"],
    keyArticles: [],
    keyTopics: [
      "perimetro sicurezza nazionale",
      "ACN",
      "incidenti",
      "notifica",
      "approvvigionamento",
      "certificazione",
    ],
  },
  {
    pattern:
      /d\.?lgs\.?\s*81\s*\/?\s*0?8|testo\s*unico\s*sicurezza\s*lavoro|sicurezza\s*sul\s*lavoro/i,
    searchTerms: ["81/08", "sicurezza lavoro", "D.Lgs. 81"],
    keyArticles: [
      "17",
      "18",
      "20",
      "28",
      "29",
      "30",
      "31",
      "32",
      "33",
      "34",
      "36",
      "37",
      "41",
      "43",
      "46",
      "62",
      "63",
      "64",
      "66",
      "71",
      "73",
    ],
    keyTopics: [
      "DVR",
      "valutazione rischi",
      "RSPP",
      "medico competente",
      "formazione lavoratori",
      "sorveglianza sanitaria",
      "DPI",
      "obblighi datore lavoro",
      "obblighi lavoratori",
      "prevenzione incendi",
      "primo soccorso",
      "cantieri",
    ],
  },
  {
    pattern: /iso\s*27001|sgsi|isms/i,
    searchTerms: ["ISO 27001", "SGSI", "ISMS"],
    keyArticles: [],
    keyTopics: [
      "sistema gestione sicurezza",
      "controlli",
      "politica sicurezza",
      "valutazione rischio",
      "dichiarazione applicabilità",
      "audit interno",
      "miglioramento continuo",
    ],
  },
  {
    pattern: /agid/i,
    searchTerms: ["AgID", "AGID"],
    keyArticles: [],
    keyTopics: [
      "linee guida",
      "cloud PA",
      "sviluppo software sicuro",
      "intelligenza artificiale PA",
    ],
  },
  {
    pattern: /acn|agenzia\s*(per\s*la\s*)?cybersicurezza/i,
    searchTerms: ["ACN", "Cybersicurezza"],
    keyArticles: [],
    keyTopics: [
      "agenzia",
      "cybersicurezza nazionale",
      "perimetro",
      "incidenti",
    ],
  },
  {
    pattern:
      /legge\s*124\s*\/?\s*2024|protezione\s*dati.*albania|albanese|republika\s*e\s*shqiperise/i,
    searchTerms: ["Legge 124/2024", "protezione dati Albania", "124/2024"],
    keyArticles: [
      "6",
      "7",
      "8",
      "9",
      "10",
      "12",
      "13",
      "14",
      "15",
      "16",
      "17",
      "18",
      "19",
      "20",
      "21",
      "22",
      "23",
      "24",
      "25",
      "26",
      "27",
      "28",
      "29",
      "30",
      "31",
      "32",
      "33",
      "34",
      "35",
      "36",
      "37",
      "38",
      "39",
      "40",
      "41",
      "42",
      "43",
      "44",
      "45",
      "46",
      "80",
      "83",
      "99",
      "100",
    ],
    keyTopics: [
      "principi trattamento",
      "consenso",
      "dati sensibili",
      "diritto accesso",
      "diritto rettifica",
      "diritto cancellazione",
      "diritto oblio",
      "portabilità",
      "opposizione",
      "decisione automatizzata",
      "titolare trattamento",
      "responsabile trattamento",
      "responsabile protezione dati",
      "DPO",
      "valutazione impatto",
      "trasferimento internazionale",
      "commissario",
      "violazione dati",
      "codice condotta",
      "certificazione",
      "sanzioni",
      "Albania",
      "norme vincolanti impresa",
    ],
  },
  // ── Fonti per la conformità del software (caricate il 22 settembre 2026) ──
  {
    pattern: /e-?privacy|2002\/58|cookie|tracciament|tracker|pixel\s+di\s+tracciamento|fingerprint/i,
    searchTerms: ["ePrivacy", "Linee guida cookie", "Linee guida 2/2023", "Codice privacy"],
    keyArticles: ["5", "6", "9", "13"],
    keyTopics: ["cookie", "consenso", "strumenti di tracciamento", "terminale", "banner"],
    codes: ["EPRIVACY", "GARANTE_COOKIE", "EDPB_2_2023", "CODICE_PRIVACY"],
  },
  {
    pattern: /codice\s+(della\s+)?privacy|d\.?\s*lgs\.?\s*196\s*\/\s*2003|196\/2003|comunicazioni\s+indesiderate|telemarketing/i,
    searchTerms: ["Codice privacy", "196/2003"],
    keyArticles: ["122", "130", "113", "114"],
    keyTopics: ["cookie", "comunicazioni indesiderate", "controllo a distanza"],
    codes: ["CODICE_PRIVACY"],
  },
  {
    pattern: /amministrator[ei]\s+di\s+sistema|accessi\s+privilegiat|log\s+(degli\s+)?accessi|access\s+log/i,
    searchTerms: ["Amministratori di sistema"],
    keyArticles: [],
    keyTopics: ["log degli accessi", "amministratori di sistema", "verifica annuale"],
    codes: ["GARANTE_ADS"],
  },
  {
    pattern: /metadati|posta\s+elettronica|e-?mail\s+(aziendal|dei\s+(dipendenti|lavoratori))|navigazione\s+internet|monitoraggio\s+(dei\s+)?(dipendenti|lavoratori)|controllo\s+a\s+distanza|statuto\s+dei\s+lavoratori|300\/1970/i,
    searchTerms: ["metadati", "posta elettronica e internet", "Statuto dei lavoratori", "Codice privacy"],
    keyArticles: ["4"],
    keyTopics: ["controllo a distanza", "metadati", "posta elettronica", "strumenti di lavoro"],
    codes: ["GARANTE_METADATI", "GARANTE_EMAIL_INTERNET", "STATUTO_LAVORATORI", "CODICE_PRIVACY"],
  },
  {
    pattern: /dossier\s+sanitario|fascicolo\s+sanitario|cartella\s+clinica|ehds|2025\/327|dati\s+sanitari/i,
    searchTerms: ["dossier sanitario", "EHDS", "GDPR"],
    keyArticles: [],
    keyTopics: ["oscuramento", "accessi", "sanitario"],
    codes: ["GARANTE_DOSSIER", "EHDS", "GDPR"],
  },
  {
    pattern: /privacy\s+by\s+(design|default)|by\s+design|by\s+default|fin\s+dalla\s+progettazione|impostazione\s+predefinita/i,
    searchTerms: ["Linee guida 4/2019", "GDPR"],
    keyArticles: ["25"],
    keyTopics: ["protezione dei dati fin dalla progettazione", "impostazione predefinita"],
    codes: ["EDPB_4_2019", "GDPR"],
  },
  {
    pattern: /dark\s+pattern|ingannevol|deceptive|interfacce?\s+(utente\s+)?manipolat/i,
    searchTerms: ["Linee guida 3/2022", "DSA", "GDPR"],
    keyArticles: ["25"],
    keyTopics: ["interfacce ingannevoli", "modelli di progettazione"],
    codes: ["EDPB_3_2022", "DSA", "GDPR"],
  },
  {
    pattern: /\bconsenso\b|\bconsent\b/i,
    searchTerms: ["Linee guida 05/2020", "GDPR"],
    keyArticles: ["7"],
    keyTopics: ["consenso", "revoca"],
    codes: ["EDPB_5_2020", "GDPR"],
  },
  {
    pattern: /diritto\s+di\s+accesso|right\s+of\s+access|richiesta\s+di\s+accesso/i,
    searchTerms: ["Guidelines 01/2022", "GDPR"],
    keyArticles: ["15"],
    keyTopics: ["diritto di accesso", "copia dei dati"],
    codes: ["EDPB_1_2022", "GDPR"],
  },
  {
    pattern: /data\s*breach|violazion[ei]\s+(dei\s+)?dati|notifica\s+(della\s+)?violazione/i,
    searchTerms: ["Guidelines 9/2022", "GDPR"],
    keyArticles: ["33", "34"],
    keyTopics: ["violazione", "notifica", "72 ore"],
    codes: ["EDPB_9_2022", "GDPR"],
  },
  {
    pattern: /digital\s+services\s+act|\bdsa\b|2022\/2065|piattaform[ae]\s+online|marketplace/i,
    searchTerms: ["DSA"],
    keyArticles: ["14", "16", "25", "26", "27", "28", "39"],
    keyTopics: ["interfacce ingannevoli", "pubblicità", "minori", "termini e condizioni"],
    codes: ["DSA"],
  },
  {
    pattern: /2024\/2690|regolamento\s+di\s+esecuzione\s+(nis|2024\/2690)|fornitor[ei]\s+di\s+servizi\s+(cloud|dns|di\s+data\s*center)|misure\s+tecniche\s+nis/i,
    searchTerms: ["2024/2690"],
    keyArticles: ["1", "2", "3"],
    keyTopics: ["misure tecniche", "gestione del rischio", "controllo degli accessi", "crittografia"],
    codes: ["NIS2_IR"],
  },
  {
    pattern: /specifiche\s+di\s+base|obblighi\s+di\s+base|misure\s+di\s+(sicurezza\s+di\s+)?base\s+nis|determinazione\s+acn/i,
    searchTerms: ["Specifiche di base NIS", "Determinazione obblighi di base"],
    keyArticles: [],
    keyTopics: ["misure di sicurezza di base", "incidenti significativi"],
    codes: ["ACN_NIS_BASE", "DLGS_138_2024"],
  },
  {
    pattern: /2024\/1774|2024\/1772|2024\/2956|rts\s+dora|norme\s+tecniche\s+(di\s+regolamentazione\s+)?dora|registro\s+(delle\s+)?informazioni.*fornitor/i,
    searchTerms: ["2024/1774", "2024/1772", "2024/2956"],
    keyArticles: [],
    keyTopics: ["gestione dei rischi informatici", "classificazione degli incidenti", "registro delle informazioni"],
    codes: ["DORA_RTS_ICT", "DORA_RTS_INC", "DORA_ITS_REG"],
  },
  {
    pattern: /accessibilit|european\s+accessibility|2019\/882|82\/2022|wcag|legge\s+stanca|4\/2004|2016\/2102|screen\s*reader|wai-aria|\baria\b/i,
    searchTerms: ["European Accessibility Act", "D.Lgs. 82/2022", "Legge Stanca", "accessibilità", "WCAG"],
    keyArticles: ["4", "13", "14"],
    keyTopics: ["requisiti di accessibilità", "servizi digitali", "dichiarazione di accessibilità"],
    codes: ["EAA", "WAD", "DLGS_82_2022", "LEGGE_STANCA", "AGID_ACC_SERVIZI", "AGID_ACC_PA", "WCAG22"],
  },
  {
    pattern: /psd2|2015\/2366|218\/2017|autenticazione\s+forte|strong\s+customer|\bsca\b|servizi\s+di\s+pagamento|collegamento\s+dinamico/i,
    searchTerms: ["PSD2", "D.Lgs. 218/2017"],
    keyArticles: ["97", "98", "4", "5"],
    keyTopics: ["autenticazione forte del cliente", "collegamento dinamico", "esenzioni"],
    codes: ["PSD2", "PSD2_SCA", "DLGS_218_2017"],
  },
  {
    pattern: /eidas|910\/2014|2024\/1183|firma\s+(elettronica|digitale)|identità\s+digitale|wallet|portafoglio\s+europeo|spid|\bcie\b/i,
    searchTerms: ["eIDAS", "CAD"],
    keyArticles: ["5a", "25", "26", "64"],
    keyTopics: ["firma elettronica qualificata", "identità digitale", "portafoglio europeo"],
    codes: ["EIDAS", "CAD"],
  },
  {
    pattern: /prodott[io]\s+difettos|2024\/2853|responsabilità\s+(del\s+)?produttore|danno\s+da\s+prodott/i,
    searchTerms: ["Prodotti difettosi"],
    keyArticles: ["4", "6", "7", "8", "10", "11"],
    keyTopics: ["difetto", "software", "aggiornamenti", "onere della prova"],
    codes: ["PLD"],
  },
  {
    pattern: /contenuti\s+digitali|2019\/770|conformità\s+(dei\s+)?servizi\s+digitali|aggiornamenti\s+(di\s+sicurezza|del\s+software)|codice\s+del\s+consumo|206\/2005/i,
    searchTerms: ["Contenuti digitali", "Codice del consumo"],
    keyArticles: ["7", "8", "14"],
    keyTopics: ["aggiornamenti", "conformità", "rimedi"],
    codes: ["DCD", "CODICE_CONSUMO"],
  },
  {
    pattern: /dispositiv[io]\s+medic|2017\/745|\bmdr\b|software\s+(come\s+)?(dispositivo\s+)?medic/i,
    searchTerms: ["MDR"],
    keyArticles: ["2", "10", "51"],
    keyTopics: ["software", "classificazione", "requisiti generali di sicurezza"],
    codes: ["MDR"],
  },
  {
    pattern: /diritto\s+d.?autore|copyright|programm[ai]\s+per\s+elaboratore|2009\/24|2019\/790|text\s+and\s+data\s+mining|\btdm\b|633\/1941/i,
    searchTerms: ["Diritto d'autore", "L. 633/1941"],
    keyArticles: ["4", "5", "6"],
    keyTopics: ["programmi per elaboratore", "estrazione di testo e di dati", "decompilazione"],
    codes: ["SW_DIR", "DSM_COPYRIGHT", "LEGGE_AUTORE"],
  },
  {
    pattern: /owasp|asvs|sicurezza\s+(del\s+)?(codice|applicazion|software)|sviluppo\s+sicuro|secure\s+coding|injection|xss|csrf|crittografi|cifratura|hash(ing)?\s+(delle\s+)?password|vulnerabilit/i,
    searchTerms: ["OWASP ASVS", "sviluppo del software sicuro", "Misure minime", "GDPR", "Cyber Resilience Act"],
    keyArticles: [],
    keyTopics: ["validazione dell'input", "autenticazione", "gestione della sessione", "crittografia", "logging"],
    codes: ["OWASP_ASVS", "AGID_SW_SICURO", "AGID_MISURE_MINIME", "GDPR", "CRA"],
  },
  {
    pattern: /licenz[ae]\s+(open\s*source|software)|\bgpl\b|agpl|lgpl|copyleft|open\s*source|apache\s*2|\bmpl\b|eupl/i,
    searchTerms: ["Licenze open source"],
    keyArticles: [],
    keyTopics: ["copyleft", "attribuzione", "distribuzione", "codice sorgente"],
    codes: ["OSS_LICENSES"],
  },
  {
    pattern: /legge\s+(sull.?)?intelligenza\s+artificiale|132\/2025|160\/2026|legge\s+italiana\s+(sull.?)?ia|responsabilità\s+(civile|penale).*(ia|intelligenza\s+artificiale)/i,
    searchTerms: ["L. 132/2025", "D.Lgs. 160/2026", "intelligenza artificiale"],
    keyArticles: ["11", "12", "13", "14"],
    keyTopics: ["lavoro", "professioni intellettuali", "informazione"],
    codes: ["LEGGE_IA", "DLGS_160_2026"],
  },
  {
    pattern: /perimetro\s+(di\s+)?sicurezza\s+nazionale|105\/2019|90\/2024|whistleblowing|24\/2023|segnalazion[ei]\s+di\s+illeciti/i,
    searchTerms: ["Perimetro di sicurezza nazionale", "Legge 90/2024", "Whistleblowing"],
    keyArticles: [],
    keyTopics: ["perimetro", "canali di segnalazione", "riservatezza"],
    codes: ["PERIMETRO_CYBER", "LEGGE_90_2024", "WHISTLEBLOWING"],
  },
];

// ── Gemini Embedding ─────────────────────────────────────────────────────

async function generateQueryEmbedding(geminiKey: string, text: string): Promise<number[] | null> {
  try {
    const [vector] = await embedTexts(geminiKey, [text.substring(0, 8000)], 'RETRIEVAL_QUERY');
    return vector;
  } catch (error) {
    console.warn('Semantic query unavailable:', error instanceof Error ? error.message : 'provider error');
    return null;
  }
}

// ── Re-ranking with Gemini Flash ─────────────────────────────────────────

async function rerankChunks(
  lovableApiKey: string,
  question: string,
  chunks: Array<{ id: string; content: string; document_id: string }>,
  maxResults: number,
): Promise<string[]> {
  if (chunks.length <= maxResults) return chunks.map((c) => c.id);

  // Prepare chunk summaries for re-ranking (500 chars + extracted references for better context)
  const chunkSummaries = chunks.slice(0, 60).map((c, i) => {
    const refs = extractChunkReferences(c.content);
    const refsStr = refs.length > 0
      ? ` | Refs: ${refs.slice(0, 5).join(", ")}`
      : "";
    return `[${i}] ${c.content.substring(0, 500)}${refsStr}`;
  }).join("\n\n");

  try {
    const response = await fetch(
      "https://ai.gateway.lovable.dev/v1/chat/completions",
      {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${lovableApiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "google/gemini-3-pro-preview",
          messages: [
            {
              role: "system",
              content:
                `You are a document relevance ranker for legal texts. Given a question and numbered passages, pick the ${maxResults} passages most useful to answer the question, prefer articles over recitals when both cover the same point, and return them sorted from most to least relevant. Respond with a JSON object only, no explanation, in this exact shape: {"ranking":[5,2,12,0,8]}. The array must contain exactly ${maxResults} distinct integer indices taken from the passage numbers.`,
            },
            {
              role: "user",
              content: `Question: ${question}\n\nPassages:\n${chunkSummaries}`,
            },
          ],
          temperature: 0,
          // Gemini 3.x spends "thinking" tokens inside max_tokens: keep the budget large and the
          // reasoning effort low, otherwise the ranking gets cut off after a few indices.
          max_tokens: 4000,
          reasoning_effort: "low",
          response_format: { type: "json_object" },
        }),
      },
    );

    if (!response.ok) {
      console.warn("Re-ranking failed, using score-based ranking");
      return chunks.slice(0, maxResults).map((c) => c.id);
    }

    const data = await response.json();
    const rankText: string = data.choices?.[0]?.message?.content || "";

    // Preferred: JSON object {"ranking":[...]} (JSON mode). Fallback: the longest bare array in
    // the output. Then dedupe and top up with the best score-ranked candidates so a terse or
    // truncated ranker never starves the answer of context.
    let indices: number[] = [];
    const parsedObj = extractJsonObject(rankText);
    if (parsedObj) {
      const arr = Array.isArray(parsedObj.ranking)
        ? parsedObj.ranking
        : Object.values(parsedObj).find((v) => Array.isArray(v));
      if (Array.isArray(arr)) indices = arr.map((v: unknown) => Number(v));
    }
    if (indices.length === 0) {
      const arrays = [...rankText.matchAll(/\[[\d,\s]+\]/g)].map((m) => m[0]);
      if (arrays.length > 0) {
        const longest = arrays.reduce((a, b) => (b.length > a.length ? b : a));
        try { indices = JSON.parse(longest); } catch { indices = []; }
      }
    }
    if (indices.length < 5) {
      console.warn(`Re-ranking: weak ranker output (${indices.length} indices, finish=${data.choices?.[0]?.finish_reason}): ${rankText.substring(0, 300).replace(/\n/g, " ")}`);
    }
    if (indices.length > 0) {
      const seen = new Set<number>();
      const validIndices = indices.filter((i) =>
        Number.isInteger(i) && i >= 0 && i < chunks.length && !seen.has(i) && seen.add(i)
      );
      const minWanted = Math.min(maxResults, 12);
      if (validIndices.length < minWanted) {
        for (let i = 0; i < chunks.length && validIndices.length < minWanted; i++) {
          if (!seen.has(i)) { seen.add(i); validIndices.push(i); }
        }
      }
      const rerankedIds = validIndices.slice(0, maxResults).map((i) => chunks[i].id);
      console.log(
        `Re-ranking: selected ${rerankedIds.length} chunks from ${chunks.length} candidates (ranker returned ${indices.length})`,
      );
      return rerankedIds;
    }
  } catch (e) {
    console.warn("Re-ranking error:", e);
  }

  return chunks.slice(0, maxResults).map((c) => c.id);
}

// ── Answer formatting helpers ─────────────────────────────────────────────

function isLikelySectionTitle(text: string): boolean {
  const trimmed = text.trim();
  if (trimmed.length < 6 || trimmed.length > 90) return false;
  if (!/[A-Za-zÀ-ÿ]/.test(trimmed)) return false;
  if (/^[a-zà-ÿ]/.test(trimmed)) return false;
  if (/[.!?]$/.test(trimmed)) return false;
  return true;
}

function formatBoldTitlesOnOwnLine(text: string | null | undefined): string {
  if (typeof text !== "string" || !text.trim()) return "";
  const lines = text.replace(/\r\n/g, "\n").split("\n");
  const output: string[] = [];

  for (const rawLine of lines) {
    const line = rawLine.trimEnd();
    if (!line.trim()) {
      output.push("");
      continue;
    }

    // Keep list items like "- **Obbligo** ..." untouched
    if (/^\s*(?:[-*]|\d+\.)\s+\*\*[^*]+\*\*/.test(line)) {
      output.push(line);
      continue;
    }

    const matches = [...line.matchAll(/\*\*([^*\n]{2,120})\*\*/g)];
    if (matches.length === 0) {
      output.push(line);
      continue;
    }

    let cursor = 0;
    let changed = false;

    for (const match of matches) {
      const full = match[0];
      const titleText = (match[1] ?? "").trim();
      const index = match.index ?? -1;

      if (index < 0 || !isLikelySectionTitle(titleText)) continue;
      // Only a bold segment that IS the whole line is a section title. Inline bold inside a
      // sentence ("un massimo di **7.000.000 EUR** o...") must never be broken onto its own line.
      const beforeText = line.slice(0, index).trim();
      const afterText = line.slice(index + full.length).trim();
      if (beforeText || (afterText && afterText !== ":")) continue;

      const before = line.slice(cursor, index).trim();
      if (before) output.push(before);
      output.push(`**${titleText}**`);

      cursor = index + full.length;
      changed = true;
    }

    const tail = line.slice(cursor).trim();
    if (changed) {
      // Force the bold title to be a standalone markdown block.
      // We add blank lines both before and after the following content
      // so markdown won't collapse title + text on the same visual line.
      output.push("");
      if (tail) output.push(tail);
      output.push("");
    } else {
      output.push(line);
    }
  }

  return output.join("\n").replace(/\n{3,}/g, "\n\n").trim();
}

function isMissingInformationAnswer(answer: string): boolean {
  const lower = (answer || "").toLowerCase();
  return lower.includes("non contiene informazioni specifiche") ||
    lower.includes("non ho trovato informazioni specifiche") ||
    lower.includes("documentazione normativa attualmente disponibile");
}

function extractOrderedArticleLetters(
  content: string,
): Array<{ letter: string; text: string }> {
  const normalized = content.replace(/\r/g, "");
  const matches = [
    ...normalized.matchAll(
      /(?:^|\n)\s*([a-z])\)\s+([^\n]+(?:\n(?!\s*[a-z]\)\s).+)*)/gim,
    ),
  ];
  const items = matches.map((match) => ({
    letter: match[1].toLowerCase(),
    text: match[2].replace(/\n+/g, " ").replace(/\s+/g, " ").trim(),
  })).filter((item) => item.text.length > 10);

  const seen = new Set<string>();
  return items.filter((item) => {
    const key = `${item.letter}:${item.text}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

// ── Grounding Verification ───────────────────────────────────────────────

interface GroundingResult {
  verifiedAnswer: string;
  removedClaims: string[];
  verifiedCitationNums: Set<number>;
}

function groundingVerification(
  answer: string,
  selectedChunks: Array<{ id: string; content: string; document_id: string }>,
  docMap: Map<string, any>,
): GroundingResult {
  const removedClaims: string[] = [];
  let verifiedAnswer = answer;

  // 1. Verify all [N] citation references point to valid chunks
  const citedNumbers = new Set<number>();
  for (const m of answer.matchAll(/\[(\d+)\]/g)) {
    citedNumbers.add(parseInt(m[1]));
  }

  const validCitationNums = new Set<number>();

  for (const num of citedNumbers) {
    const idx = num - 1;
    if (idx < 0 || idx >= selectedChunks.length) {
      // Invalid citation number - remove it
      verifiedAnswer = verifiedAnswer.replaceAll(`[${num}]`, "");
      removedClaims.push(`[${num}] - citation out of range`);
      continue;
    }

    const chunk = selectedChunks[idx];
    const doc = docMap.get(chunk.document_id);
    if (!doc) {
      verifiedAnswer = verifiedAnswer.replaceAll(`[${num}]`, "");
      removedClaims.push(`[${num}] - document not found`);
      continue;
    }

    // 2a. Cross-regulation check: verify the chunk belongs to the regulation the LLM is citing
    const citedRegulation = extractCitedRegulationForNumber(answer, num);
    if (citedRegulation && doc.title) {
      if (!documentBelongsToRegulation(doc.title, citedRegulation)) {
        verifiedAnswer = verifiedAnswer.replaceAll(`[${num}]`, "");
        removedClaims.push(
          `[${num}] - regulation mismatch: LLM cited ${citedRegulation} but chunk belongs to "${doc.title}"`,
        );
        continue;
      }
    }

    // 2. Verify article references cited alongside [N] exist in the chunk
    // Find patterns like "Articolo X [N]" or "Art. X [N]"
    const articleCitationPattern = new RegExp(
      `(?:Articolo|Art\\.?|Article)\\s+(\\d+(?:\\.\\d+)?)\\s*(?:,\\s*(?:comma|paragrafo|lettera)\\s+\\d+[a-z]?\\)?)?\\s*\\[${num}\\]`,
      "gi",
    );

    let hasValidRef = false;
    let hasInvalidRef = false;

    for (const match of answer.matchAll(articleCitationPattern)) {
      const artNum = match[1];
      const commaMatch = match[0].match(
        /(?:comma|paragrafo|lettera)\s+(\d+[a-z]?\)?)/i,
      );
      const found = articleExistsInChunk(chunk.content, artNum);

      if (found) {
        if (commaMatch && commaMatch[1]) {
          const commaVerified = verifyCommaInChunk(
            chunk.content,
            artNum,
            commaMatch[1],
          );
          if (!commaVerified) {
            console.log(
              `Warning: Art. ${artNum} comma ${
                commaMatch[1]
              } [${num}] - article found but comma not verified in chunk`,
            );
          }
        }
        hasValidRef = true;
      } else {
        hasInvalidRef = true;
        // Replace the specific invalid article reference but keep the citation
        const fullMatch = match[0];
        const genericReplacement = `[${num}]`;
        verifiedAnswer = verifiedAnswer.replace(fullMatch, genericReplacement);
        removedClaims.push(
          `Art. ${artNum} [${num}] - not found in source chunk`,
        );
      }
    }

    // 2b. Thematic coherence check: verify the claim's key terms appear in the chunk
    // This catches cases where the article number matches but the content doesn't
    const sentencesWithCitation = sentencesWithMarker(answer, num);
    for (const sentence of sentencesWithCitation) {
      // The article named in the sentence exists in the chunk: that is the verification, skip the heuristic.
      if (sentenceNamesArticleInChunk(sentence, chunk.content)) continue;
      // Extract key technical terms from the sentence (words > 5 chars, not stop words)
      const technicalTerms = sentence.toLowerCase()
        .replace(/\[[\d]+\]/g, "") // remove citation markers
        .replace(/[^a-zà-ÿ0-9\s]/g, " ")
        .split(/\s+/)
        .filter((w) => w.length > 5 && !STOP_WORDS_RELEVANCE.has(w));

      if (technicalTerms.length >= 2) {
        const chunkLower = chunk.content.toLowerCase();
        const termsFoundInChunk = technicalTerms.filter((t) =>
          chunkLower.includes(t)
        );
        const termCoverage = termsFoundInChunk.length / technicalTerms.length;

        if (termCoverage < 0.25 && technicalTerms.length >= 3) {
          // Less than 25% of technical terms found in chunk — likely wrong citation
          console.log(
            `Thematic mismatch: [${num}] sentence has terms [${
              technicalTerms.join(",")
            }] but chunk only matches [${termsFoundInChunk.join(",")}]`,
          );
          // Solo la frase incriminata perde il marker: le altre affermazioni
          // che citano [N] restano verificabili singolarmente.
          const cleanedSentence = sentence.replace(
            new RegExp(`\\s*\\[${num}\\]`, "g"),
            "",
          );
          verifiedAnswer = verifiedAnswer.replace(sentence, cleanedSentence);
          removedClaims.push(
            `[${num}] - thematic mismatch in one sentence: key terms not in chunk`,
          );
        }
      }
    }

    // If citation has at least some valid context, keep it
    if (!hasInvalidRef || hasValidRef) {
      validCitationNums.add(num);
    } else if (hasInvalidRef && !hasValidRef) {
      // All article refs were invalid - check if chunk content is still broadly relevant
      const refs = extractChunkReferences(chunk.content);
      const verifiedRefs = refs.filter((ref) =>
        verifyArticleInChunk(chunk.content, ref)
      );
      if (verifiedRefs.length > 0) {
        validCitationNums.add(num);
      } else {
        verifiedAnswer = verifiedAnswer.replaceAll(`[${num}]`, "");
        removedClaims.push(`[${num}] - no verifiable references in source`);
      }
    }
  }

  // 3. Clean up artifacts from removed citations
  verifiedAnswer = tidyAfterMarkerRemoval(verifiedAnswer);

  return {
    verifiedAnswer,
    removedClaims,
    verifiedCitationNums: validCitationNums,
  };
}

// ── Chunk Enrichment ─────────────────────────────────────────────────────

// ── Infer regulation label from document title ──────────────────────
function inferRegulationLabel(docTitle: string): string {
  const t = (docTitle || "").toLowerCase();
  if (
    /determinazione\s+acn|piattaforma\s+nis|fornitori\s+rilevanti|punto\s+di\s+contatto|notifica\s+incidenti\s+nis2/
      .test(t)
  ) return "Determinazione ACN (attuazione NIS2 Italia)";
  if (/d\.?lgs\.?\s*138|138\/2024|recepimento\s+direttiva\s+nis2/.test(t)) {
    return "D.Lgs. 138/2024 (recepimento italiano NIS2)";
  }
  if (/nis\s*2|2022\/2555/.test(t)) return "NIS2 (Direttiva UE 2022/2555)";
  if (/gdpr|2016\/679/.test(t)) return "GDPR (Regolamento UE 2016/679)";
  if (/dora|2022\/2554/.test(t)) return "DORA (Regolamento UE 2022/2554)";
  if (/ai\s*act|2024\/1689/.test(t)) return "AI Act (Regolamento UE 2024/1689)";
  if (/cyber\s*resilience|cra|2024\/2847/.test(t)) {
    return "Cyber Resilience Act";
  }
  if (/data\s*act|2023\/2854/.test(t)) {
    return "Data Act (Regolamento UE 2023/2854)";
  }
  if (/codice.*cybersicurezza/.test(t)) return "Codice della Cybersicurezza";
  if (/81\/0?8|sicurezza\s+(?:sul\s+)?lavoro|testo\s+unico/.test(t)) {
    return "D.Lgs. 81/08 (Testo Unico Sicurezza Lavoro)";
  }
  if (/iso\s*\/?\s*iec\s*27001|iso\s*27001/.test(t)) return "ISO/IEC 27001";
  if (/agid/.test(t)) return "AgID (linee guida)";
  if (/acn/.test(t)) return "ACN";
  if (/124\/2024|albania|mbrojtjen/.test(t)) return "Legge 124/2024 (Albania)";
  return docTitle;
}

function enrichChunkContent(
  chunk: {
    content: string;
    document_id: string;
    start_pos?: number;
    end_pos?: number;
  },
  doc: any,
  allChunks: Array<
    { content: string; document_id: string; start_pos?: number }
  >,
): string {
  const parts: string[] = [];

  // ⚠️ EXPLICIT regulation label — prevents the LLM from confusing sources
  const regulationLabel = inferRegulationLabel(doc.title || "");
  parts.push(`NORMATIVA: ${regulationLabel}`);
  parts.push(`DOCUMENTO: ${doc.title}`);
  parts.push(
    `Versione: ${doc.version} | Giurisdizione: ${doc.jurisdiction} | Lingua: ${doc.language}`,
  );

  // Find structural context from this chunk or nearby chunks
  let structural = extractStructuralContext(chunk.content);
  if (!structural) {
    // Search neighboring chunks
    const neighbors = allChunks.filter(
      (c) =>
        c.document_id === chunk.document_id &&
        Math.abs((c.start_pos || 0) - (chunk.start_pos || 0)) < 5000,
    );
    for (const n of neighbors) {
      structural = extractStructuralContext(n.content);
      if (structural) break;
    }
  }
  if (structural) {
    parts.push(`Posizione: ${structural}`);
  }

  // Extract article references present in this chunk
  const refs = extractChunkReferences(chunk.content);
  if (refs.length > 0) {
    parts.push(`Riferimenti: ${refs.slice(0, 10).join(", ")}`);
  }

  parts.push("---");
  parts.push(chunk.content);

  return parts.join("\n");
}

// ── Intake: decide whether to ask the user before answering ──────────────

interface IntakeQuestion {
  text: string;
  why?: string;
  options?: string[];
}
interface IntakeResult {
  mode: "answer" | "clarify";
  goal: string | null;
  questions: IntakeQuestion[];
}
interface CaseFact {
  question: string;
  answer: string;
}

const CLARIFICATION_PREFIX = "**Prima di rispondere ho bisogno di qualche informazione**";

function describeCompanySize(code: string | null | undefined): string | null {
  const map: Record<string, string> = {
    micro: "micro impresa (meno di 10 addetti)",
    small: "piccola impresa (10-49 addetti)",
    medium: "media impresa (50-249 addetti)",
    large: "grande impresa (250 addetti o più)",
  };
  if (!code || code === "unknown") return null;
  return map[code] || code;
}

function describeDataRole(code: string | null | undefined): string | null {
  const map: Record<string, string> = {
    controller: "titolare del trattamento",
    processor: "responsabile del trattamento",
    both: "sia titolare sia responsabile, a seconda del servizio",
  };
  if (!code || code === "unknown") return null;
  return map[code] || code;
}

// Machine-readable next action the model may append as the very last line of the answer.
const NEXT_ACTION_PATTERN = /\s*\[\[AZIONE:(dpia|ropa)\]\]\s*$/i;
const NEXT_ACTION_LABELS: Record<string, string> = {
  dpia: "Genera la DPIA nel Document Generator",
  ropa: "Genera il RoPA nel Document Generator",
};

// Questions that describe the user's own situation or ask for a deliverable
// are the ones where missing facts change the legal answer.
const SITUATIONAL_PATTERN =
  /\b(mia|mio|miei|mie|nostra|nostro|nostri|nostre|siamo|abbiamo|dobbiamo|devo|dovrei|dovremmo|posso|possiamo|vorrei|vogliamo|voglio|come faccio|come facciamo|aiutami|aiutaci|redig\w*|prepar\w*|scriv\w*|predispon\w*|valut\w*|verific\w*|analizz\w*|controll\w*|conform\w*|adegu\w*|rientr\w*|obbligat\w*|applic\w*|impatt\w*)\b/i;
const SKIP_INTAKE_PATTERN =
  /\b(rispondi comunque|non lo so|non so|vai avanti|procedi|senza altre domande|rispondi e basta|non chiedere)\b/i;
const LOOKUP_PATTERN =
  /^\s*(cosa (dice|prevede|stabilisce)|qual[ei] (è|sono) (la definizione|le definizioni)|definizione di|elenca|riassumi|spiega(mi)? (l')?art)/i;

function extractJsonObject(text: string): any | null {
  const cleaned = text.replace(/```json|```/gi, "").trim();
  const start = cleaned.indexOf("{");
  const end = cleaned.lastIndexOf("}");
  if (start < 0 || end <= start) return null;
  try {
    return JSON.parse(cleaned.slice(start, end + 1));
  } catch {
    return null;
  }
}

async function runIntake(params: {
  question: string;
  history: Array<{ role: string; content: string }>;
  caseContext: CaseFact[];
  goal: string | null;
  userProfile: any;
  fileNames: string[];
  apiKey: string;
}): Promise<IntakeResult> {
  const { question, history, caseContext, goal, userProfile, fileNames, apiKey } = params;
  const none: IntakeResult = { mode: "answer", goal, questions: [] };

  const lastAssistant = [...history].reverse().find((m) => m.role === "assistant");
  const previousTurnWasClarification = !!lastAssistant &&
    lastAssistant.content.startsWith(CLARIFICATION_PREFIX);
  // Never chain two rounds of questions: after one round we answer with explicit assumptions.
  if (previousTurnWasClarification) return none;
  if (SKIP_INTAKE_PATTERN.test(question)) return none;
  const situational = SITUATIONAL_PATTERN.test(question) || fileNames.length > 0 ||
    caseContext.length > 0 || history.length > 0;
  if (!situational || LOOKUP_PATTERN.test(question)) return none;

  const profileLines = [
    userProfile?.compliance_role ? `Ruolo: ${userProfile.compliance_role}` : null,
    userProfile?.sector ? `Settore: ${userProfile.sector}` : null,
    userProfile?.jurisdiction ? `Giurisdizione: ${userProfile.jurisdiction}` : null,
    userProfile?.company_size ? `Dimensione azienda: ${describeCompanySize(userProfile.company_size)}` : null,
    userProfile?.data_role ? `Ruolo nel trattamento: ${describeDataRole(userProfile.data_role)}` : null,
  ].filter(Boolean).join("\n") || "Nessun dato di profilo.";
  const knownFacts = caseContext.length > 0
    ? caseContext.map((f) => `- ${f.question} → ${f.answer}`).join("\n")
    : "Nessuna.";
  const recent = history.slice(-6).map((m) =>
    `${m.role === "assistant" ? "ASSISTENTE" : "UTENTE"}: ${m.content.substring(0, 600)}`
  ).join("\n") || "Nessuno.";

  const systemPrompt = `Sei la fase di intake di un assistente esperto di compliance privacy e cyber (GDPR, NIS2, DORA, AI Act, CRA).
Devi decidere se rispondere subito oppure fermarti e fare all'utente le domande indispensabili prima di procedere, come farebbe un consulente serio che non vuole rispondere a caso.

Rispondi SOLO con un oggetto JSON con questa forma:
{"mode":"answer"|"clarify","goal":"obiettivo dell'utente in una frase","questions":[{"text":"domanda","why":"perché cambia la risposta","options":["scelta breve","scelta breve"]}]}

Regole:
- "clarify" SOLO se mancano fatti che cambiano davvero la risposta giuridica o il lavoro da fare (es. ruolo di titolare o responsabile, perimetro e dimensione dell'organizzazione per NIS2 o DORA, tipo di dati o di trattamento, quale documento vuole ottenere, se esiste già una policy o una DPIA, quale settore o Stato). In caso di dubbio scegli "answer".
- Massimo 3 domande, dalla più decisiva alla meno decisiva. Ogni domanda deve essere concreta, in italiano semplice, con "why" di una riga. Aggiungi "options" (2-4 scelte brevi) solo quando le risposte possibili sono poche e note.
- Non chiedere MAI cose già note dal profilo, dalle informazioni fornite, dai messaggi precedenti o dai documenti allegati.
- Non fare domande su una lettura o definizione della norma: quelle si rispondono direttamente.
- "goal" descrive l'obiettivo finale della conversazione (es. "Capire se l'azienda rientra nella NIS2 e cosa deve fare"), non la singola domanda.`;

  const userPrompt = `PROFILO UTENTE:
${profileLines}

OBIETTIVO GIÀ NOTO: ${goal || "non ancora definito"}

INFORMAZIONI GIÀ FORNITE DALL'UTENTE:
${knownFacts}

DOCUMENTI ALLEGATI: ${fileNames.length > 0 ? fileNames.join(", ") : "nessuno"}

MESSAGGI PRECEDENTI:
${recent}

NUOVO MESSAGGIO DELL'UTENTE:
${question}`;

  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 12000);
    const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { "Authorization": `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "google/gemini-3-pro-preview",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        temperature: 0,
        max_tokens: 3000,
        reasoning_effort: "low",
        response_format: { type: "json_object" },
      }),
      signal: controller.signal,
    });
    clearTimeout(timer);
    if (!res.ok) {
      console.warn(`Intake call failed with status ${res.status}; answering directly`);
      return none;
    }
    const data = await res.json();
    const parsed = extractJsonObject(data?.choices?.[0]?.message?.content || "");
    if (!parsed) return none;
    const nextGoal = typeof parsed.goal === "string" && parsed.goal.trim()
      ? parsed.goal.trim().substring(0, 300)
      : goal;
    if (parsed.mode !== "clarify" || !Array.isArray(parsed.questions)) {
      return { mode: "answer", goal: nextGoal, questions: [] };
    }
    const questions: IntakeQuestion[] = parsed.questions
      .filter((q: any) => q && typeof q.text === "string" && q.text.trim())
      .slice(0, 3)
      .map((q: any) => ({
        text: q.text.trim().substring(0, 300),
        why: typeof q.why === "string" ? q.why.trim().substring(0, 200) : undefined,
        options: Array.isArray(q.options)
          ? q.options.filter((o: any) => typeof o === "string" && o.trim()).slice(0, 4).map((o: string) => o.trim().substring(0, 80))
          : undefined,
      }));
    if (questions.length === 0) return { mode: "answer", goal: nextGoal, questions: [] };
    return { mode: "clarify", goal: nextGoal, questions };
  } catch (error) {
    console.warn("Intake skipped:", error instanceof Error ? error.message : String(error));
    return none;
  }
}

function renderClarification(goal: string | null, questions: IntakeQuestion[]): string {
  const lines = [CLARIFICATION_PREFIX, ""];
  if (goal) lines.push(`Obiettivo: ${goal}`, "");
  lines.push("Per darti una risposta corretta sulla tua situazione, e non una risposta generica, mi servono questi dettagli:", "");
  questions.forEach((q, i) => {
    lines.push(`${i + 1}. ${q.text}`);
    if (q.why) lines.push(`   _(${q.why})_`);
    lines.push("");
  });
  lines.push("Rispondi anche solo a quelle che conosci: se preferisci, scrivi \"rispondi comunque\" e procedo con le ipotesi più prudenti, dichiarandole.");
  return lines.join("\n");
}

// ── Main handler ────────────────────────────────────────────────────────

denoServe(protect(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const requestBody = await req.json();
    const { question, userProfile, files, conversationHistory } = requestBody;
    const caseContext: CaseFact[] = Array.isArray(requestBody.caseContext)
      ? requestBody.caseContext
        .filter((f: any) => f && typeof f.question === "string" && typeof f.answer === "string")
        .slice(-12)
        .map((f: any) => ({
          question: f.question.substring(0, 300),
          answer: f.answer.substring(0, 500),
        }))
      : [];
    const conversationGoal: string | null =
      typeof requestBody.goal === "string" && requestBody.goal.trim()
        ? requestBody.goal.trim().substring(0, 300)
        : null;

    if (
      !question || typeof question !== "string" || question.trim().length === 0
    ) {
      return new Response(
        JSON.stringify({ error: "Invalid or empty question" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }
    if (question.length > 2000) {
      return new Response(
        JSON.stringify({
          error: "Question exceeds maximum length of 2000 characters",
        }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    console.log("RAG Query:", question);

    const asksAboutDLgs138 = isDlgs138Question(question);
    const asksAboutAcnDetermination = isAcnDeterminationQuestion(question);
    console.log(`[NIS2-DETECT v2] asksAboutDLgs138=${asksAboutDLgs138} asksAboutAcnDetermination=${asksAboutAcnDetermination} for question: "${question}"`);

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const lovableApiKey = getAIKey()!;
    const geminiKey = Deno.env.get("GEMINI_API_KEY");
    // One provider request per question, shared by all retrieval strategies.
    // Keep this promise inside the request so no user's question is cached globally.
    let queryEmbeddingPromise: Promise<number[] | null> | undefined;
    const getQueryEmbedding = () => queryEmbeddingPromise ??= geminiKey
      ? generateQueryEmbedding(geminiKey, question)
      : Promise.resolve(null);
    const supabase = createClient(supabaseUrl, supabaseKey, { global: { headers: { Authorization: req.headers.get("Authorization")! } } });

    // ── Step 0.5: Extract context from conversation history ───────────
    const history: Array<{ role: string; content: string }> =
      Array.isArray(conversationHistory) ? conversationHistory.slice(-4) : [];

    // ── Step 0.7: Intake — stop and ask when facts that change the answer are missing ──
    const attachedFileNames: string[] = Array.isArray(files)
      ? files.map((f: any) => String(f?.name || "documento")).slice(0, 10)
      : [];
    const intake = await runIntake({
      question,
      history,
      caseContext,
      goal: conversationGoal,
      userProfile,
      fileNames: attachedFileNames,
      apiKey: lovableApiKey,
    });
    const activeGoal = intake.goal || conversationGoal;
    if (intake.mode === "clarify") {
      const clarificationText = renderClarification(activeGoal, intake.questions);
      console.log(`Intake: asking ${intake.questions.length} clarifying question(s)`);
      const { data: intakeUser } = await supabase.auth.getUser(
        req.headers.get("Authorization")?.replace("Bearer ", "") || "",
      );
      if (intakeUser?.user?.email && (intakeUser.user as any)?.is_anonymous !== true) {
        const { error: logError } = await supabase.from("query_log").insert({
          user_id: intakeUser.user.id,
          question,
          answer: clarificationText,
          model: getAIModel(),
          latency_ms: 0,
          citations: [],
        });
        if (logError) console.error("query_log insert failed:", logError.message);
      }
      return new Response(
        JSON.stringify({
          type: "clarification",
          goal: activeGoal,
          questions: intake.questions,
          answer: clarificationText,
          citations: [],
          allContextChunks: [],
          relevantChunks: 0,
          confidence: { level: "high", score: 100, explanation: "Richiesta di chiarimenti" },
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Extract keywords and regulations from previous messages to enrich search
    let historyKeywords: string[] = [];
    let historyConfigs: RegulationConfig[] = [];
    if (history.length > 0) {
      const historyText = history.map((m) => m.content).join(" ");
      for (const config of regulationConfigs) {
        if (config.pattern.test(historyText)) {
          historyConfigs.push(config);
        }
      }
      historyKeywords = extractKeywords(historyText).slice(0, 15);
      console.log(
        `Conversation history: ${history.length} messages, detected ${historyConfigs.length} regulations, ${historyKeywords.length} keywords`,
      );
    }

    // ── Step 1: Detect regulations & extract keywords ─────────────────
    const detectedConfigs: RegulationConfig[] = [];
    for (const config of regulationConfigs) {
      if (config.pattern.test(question)) {
        detectedConfigs.push(config);
        console.log(`Detected regulation: ${config.searchTerms[0]}`);
      }
    }

    // If no regulation detected in current question, inherit from conversation history
    if (detectedConfigs.length === 0 && historyConfigs.length > 0) {
      detectedConfigs.push(...historyConfigs);
      console.log(
        `Inherited ${historyConfigs.length} regulations from conversation history: ${
          historyConfigs.map((c) => c.searchTerms[0]).join(", ")
        }`,
      );
    }

    const keywords = extractKeywords(question);
    const questionArticles = extractArticleNumbers(question);

    // Merge history keywords with current keywords (deduplicated, current takes priority)
    const allKeywords = [...new Set([...keywords, ...historyKeywords])];

    const topicKeywords: string[] = [];
    const explicitArticleMode = questionArticles.length > 0;
    const expandedArticles: string[] = [...questionArticles];
    for (const config of detectedConfigs) {
      topicKeywords.push(...config.keyTopics);
      if (!explicitArticleMode) {
        for (const art of config.keyArticles) {
          if (!expandedArticles.includes(art)) expandedArticles.push(art);
        }
      }
    }

    console.log("Keywords:", allKeywords.slice(0, 15));
    console.log("Expanded articles:", expandedArticles.slice(0, 15));

    // ── Step 2: Fetch relevant documents ──────────────────────────────
    let targetDocIds: string[] = [];
    const dlgs138DocIds = new Set<string>();
    const acnDeterminationDocIds = new Set<string>();
    // Documents of each regulation named in the question (used to guarantee coverage in comparisons)
    const docIdsByRegulation = new Map<string, Set<string>>();

    if (detectedConfigs.length > 0) {
      for (const config of detectedConfigs) {
        for (const term of config.searchTerms) {
          const { data: docs } = await supabase
            .from("documents")
            .select("id, title")
            .ilike("title", `%${term}%`)
            .limit(10);
          if (docs) {
            const regKey = config.searchTerms[0];
            if (!docIdsByRegulation.has(regKey)) docIdsByRegulation.set(regKey, new Set());
            docs.forEach((d) => docIdsByRegulation.get(regKey)!.add(d.id));
            targetDocIds.push(...docs.map((d) => d.id));
            if (docs.length > 0) {
              console.log(
                `Found docs for "${term}": ${
                  docs.map((d) => d.title).join(", ")
                }`,
              );
            }
          }
        }
      }
      targetDocIds = [...new Set(targetDocIds)];
      console.log(`Total target document IDs: ${targetDocIds.length}`);
    }

    if (asksAboutDLgs138) {
      const { data: dlgs138Docs } = await supabase
        .from("documents")
        .select("id, title")
        .or(
          "title.ilike.%138/2024%,title.ilike.%D.Lgs. 138%,title.ilike.%Recepimento Direttiva NIS2%",
        )
        .limit(10);

      dlgs138Docs?.forEach((doc) => {
        if (isDlgs138DocumentTitle(doc.title || "")) {
          dlgs138DocIds.add(doc.id);
        }
      });

      if (dlgs138DocIds.size > 0) {
        targetDocIds = targetDocIds.length > 0
          ? targetDocIds.filter((id) => dlgs138DocIds.has(id))
          : [...dlgs138DocIds];
        console.log(
          `Strict D.Lgs. 138 mode: restricted target documents to ${targetDocIds.length} Italian decree document(s)`,
        );
      }
    }

    if (asksAboutAcnDetermination) {
      const { data: acnDocs } = await supabase
        .from("documents")
        .select("id, title")
        .or(
          "title.ilike.%Determinazione ACN%,title.ilike.%Piattaforma NIS%,title.ilike.%Obblighi Art. 23%,title.ilike.%Fornitori Rilevanti%,title.ilike.%Punto di Contatto%",
        )
        .limit(20);

      acnDocs?.forEach((doc) => {
        if (isAcnDeterminationDocumentTitle(doc.title || "")) {
          acnDeterminationDocIds.add(doc.id);
        }
      });

      if (acnDeterminationDocIds.size > 0) {
        targetDocIds = targetDocIds.length > 0
          ? targetDocIds.filter((id) => acnDeterminationDocIds.has(id))
          : [...acnDeterminationDocIds];
        console.log(
          `Strict ACN determination mode: restricted target documents to ${targetDocIds.length} determination document(s)`,
        );
      }
    }

    // ── Step 3: Fetch chunks with multiple strategies ─────────────────
    let allCandidateChunks: Array<
      {
        id: string;
        document_id: string;
        content: string;
        start_pos?: number;
        end_pos?: number;
        source: string;
      }
    > = [];
    const seenChunkIds = new Set<string>();

    const addChunks = (chunks: any[], source: string) => {
      for (const c of chunks) {
        if (!seenChunkIds.has(c.id)) {
          seenChunkIds.add(c.id);
          allCandidateChunks.push({ ...c, source });
        }
      }
    };

    // ── Strategy 0 (Priority): Structured chunks search ──────────────
    let structuredChunksFound = 0;
    const detectedRegulationCodes: string[] = [];
    for (const config of detectedConfigs) {
      if (config.codes && config.codes.length > 0) {
        detectedRegulationCodes.push(...config.codes);
        continue;
      }
      // Map config search terms to regulation codes
      const term = config.searchTerms[0]?.toLowerCase() || "";
      if (term.includes("gdpr") || term.includes("2016/679")) {
        detectedRegulationCodes.push("GDPR");
      } else if (
        term.includes("nis2") || term.includes("nis 2") ||
        term.includes("2022/2555")
      ) detectedRegulationCodes.push("NIS2");
      else if (term.includes("dora") || term.includes("2022/2554")) {
        detectedRegulationCodes.push("DORA");
      } else if (term.includes("ai act") || term.includes("2024/1689")) {
        detectedRegulationCodes.push("AI_ACT");
      } else if (term.includes("cyber resilience") || term.includes("cra")) {
        detectedRegulationCodes.push("CRA");
      } else if (term.includes("data act") || term.includes("2023/2854")) {
        detectedRegulationCodes.push("DATA_ACT");
      } else if (term.includes("codice cyber")) {
        detectedRegulationCodes.push("CODICE_CYBER");
      } else if (term.includes("81/08") || term.includes("sicurezza lavoro")) {
        detectedRegulationCodes.push("DLGS_81_08");
      }
    }

    // Search by regulation + article number in structured_chunks
    // Prepend the contextual header (norma, capo, articolo, rubrica, comma) so
    // the model can cite at paragraph level instead of guessing the article.
    const withCitationHeader = (sc: any): string => {
      const header = sc.context_header ||
        (sc.citation_label ? `[${sc.citation_label}]` : null);
      return header ? `${header}\n${sc.chunk_text}` : sc.chunk_text;
    };

    // Posizione logica di un'unità strutturata (articolo, paragrafo, parte):
    // serve a ordinare il contesto finale nell'ordine di lettura della norma.
    const structuredPosition = (sc: any): number => {
      const art = Number(sc.article_number) || 0;
      const par = parseInt(String(sc.paragraph || "0"), 10) || 0;
      const partMatch = /:p(\d+)$/.exec(String(sc.chunk_key || ""));
      const part = partMatch ? parseInt(partMatch[1], 10) : 0;
      const recital = /:rec(\d+)$/.exec(String(sc.chunk_key || ""));
      if (recital) return parseInt(recital[1], 10);
      if (!art) return 5_000_000;
      return 1_000_000 + art * 1000 + par * 10 + part;
    };

    const today = new Date().toISOString().slice(0, 10);

    for (const regCode of [...new Set(detectedRegulationCodes)]) {
      for (const artNum of expandedArticles) {
        const artInt = parseInt(artNum);
        if (isNaN(artInt)) continue;
        let structuredQuery = supabase
          .from("structured_chunks")
          .select(
            "id, document_id, chunk_text, article_reference, article_number, paragraph, chunk_key, citation_label, context_header, section_hierarchy, cross_references, is_obligation, valid_from, valid_to",
          )
          .eq("regulation", regCode)
          .eq("article_number", artInt)
          .or(`valid_to.is.null,valid_to.gt.${today}`)
          .order("chunk_key", { ascending: true });

        if (targetDocIds.length > 0) {
          structuredQuery = structuredQuery.in("document_id", targetDocIds);
        }

        const { data: structuredMatches } = await structuredQuery.limit(20);
        if (structuredMatches && structuredMatches.length > 0) {
          addChunks(
            structuredMatches.map((sc: any) => ({
              id: sc.id,
              document_id: sc.document_id,
              content: withCitationHeader(sc),
              start_pos: structuredPosition(sc),
              end_pos: structuredPosition(sc),
            })),
            `structured_${regCode}_art${artInt}`,
          );
          structuredChunksFound += structuredMatches.length;
        }
      }
      // Also do vector search on structured_chunks if we have an embedding
      if (geminiKey) {
        const queryEmbedding = await getQueryEmbedding();
        if (queryEmbedding) {
          // v2: filtro di validità applicato nella query + metadati di citazione
          let vectorStructured: any[] | null = null;
          const { data: v2Data, error: v2Err } = await supabase.rpc(
            "match_structured_chunks_v2",
            {
              query_embedding: queryEmbedding,
              filter_regulation: regCode,
              filter_article_number: null,
              match_threshold: 0.5,
              match_count: 20,
            },
          );
          if (!v2Err && v2Data) {
            vectorStructured = v2Data as any[];
          } else {
            const { data: legacy } = await supabase.rpc(
              "match_structured_chunks",
              {
                query_embedding: queryEmbedding,
                filter_regulation: regCode,
                match_threshold: 0.55,
                match_count: 15,
              },
            );
            vectorStructured = (legacy as any[]) || [];
          }
          const filteredStructured = targetDocIds.length > 0
            ? (vectorStructured || []).filter((sc: any) =>
              targetDocIds.includes(sc.document_id)
            )
            : (vectorStructured || []);
          if (filteredStructured.length > 0) {
            addChunks(
              filteredStructured.map((sc: any) => ({
                id: sc.id,
                document_id: sc.document_id,
                content: withCitationHeader(sc),
                start_pos: structuredPosition(sc),
                end_pos: structuredPosition(sc),
              })),
              `structured_vector_${regCode}`,
            );
            structuredChunksFound += filteredStructured.length;
          }
        }
      }
    }
    console.log(`Structured chunks found: ${structuredChunksFound}`);

    // If structured search yielded enough results, skip some fallback strategies
    const skipLegacyStrategies = structuredChunksFound >= 15;

    // Strategy A: Key articles search (with OCR-tolerant patterns)
    if (
      !skipLegacyStrategies && expandedArticles.length > 0 &&
      targetDocIds.length > 0
    ) {
      const batchSize = 8;
      for (let i = 0; i < expandedArticles.length; i += batchSize) {
        const batch = expandedArticles.slice(i, i + batchSize);
        const orParts: string[] = [];
        for (const artNum of batch) {
          // Original patterns (with trailing space)
          orParts.push(`content.ilike.%articolo ${artNum} %`);
          orParts.push(`content.ilike.%art. ${artNum} %`);
          orParts.push(`content.ilike.%article ${artNum} %`);
          // OCR-tolerant patterns: handle line breaks, no trailing space, dot variations
          orParts.push(`content.ilike.%articolo ${artNum}.%`);
          orParts.push(`content.ilike.%articolo ${artNum}%`);
          orParts.push(`content.ilike.%art. ${artNum}.%`);
          orParts.push(`content.ilike.%art. ${artNum}%`);
          orParts.push(`content.ilike.%art.${artNum} %`);
          orParts.push(`content.ilike.%Art. ${artNum}.%`);
          orParts.push(`content.ilike.%Art. ${artNum}%`);
        }
        const { data } = await supabase
          .from("chunks")
          .select("id, document_id, content, start_pos, end_pos")
          .in("document_id", targetDocIds)
          .or(orParts.join(","))
          .limit(80);
        if (data) {
          addChunks(data, `key_articles_batch`);
          console.log(
            `Key articles batch ${i}-${i + batch.length}: found ${data.length} chunks`,
          );
        }
      }
    }

    // Strategy A1b: Direct article hydration for D.Lgs. 138/2024 ───────
    // The decree was ingested from a 2-column PDF and some old chunks split
    // article bodies awkwardly. For explicit article questions we aggressively
    // rehydrate a contiguous article window from raw chunk positions so the LLM
    // can see the full article text even if no single stored chunk contains it.
    if (
      !skipLegacyStrategies && asksAboutDLgs138 && explicitArticleMode &&
      targetDocIds.length > 0
    ) {
      const directWindowChunks: Array<{
        id: string;
        document_id: string;
        content: string;
        start_pos?: number;
        end_pos?: number;
      }> = [];

      for (const docId of targetDocIds) {
        for (const artNum of questionArticles) {
          const directPatterns = [
            `content.ilike.%Art. ${artNum}%`,
            `content.ilike.%art. ${artNum}%`,
            `content.ilike.%Articolo ${artNum}%`,
            `content.ilike.%articolo ${artNum}%`,
          ];

          const { data: directAnchors } = await supabase
            .from("chunks")
            .select("id, document_id, content, start_pos, end_pos")
            .eq("document_id", docId)
            .or(directPatterns.join(","))
            .order("start_pos", { ascending: true })
            .limit(4);

          if (!directAnchors || directAnchors.length === 0) continue;

          addChunks(directAnchors, `dlgs138_direct_anchor_art${artNum}`);

          for (const anchor of directAnchors.slice(0, 2)) {
            if (anchor.start_pos === undefined || anchor.start_pos === null) {
              continue;
            }

            const { data: hydratedWindow } = await supabase
              .from("chunks")
              .select("id, document_id, content, start_pos, end_pos")
              .eq("document_id", docId)
              .gte("start_pos", Math.max(0, anchor.start_pos - 200))
              .lte("start_pos", anchor.start_pos + 9000)
              .order("start_pos", { ascending: true })
              .limit(8);

            if (!hydratedWindow || hydratedWindow.length === 0) continue;

            addChunks(hydratedWindow, `dlgs138_direct_window_art${artNum}`);

            const mergedWindow = hydratedWindow
              .sort((a, b) => (a.start_pos || 0) - (b.start_pos || 0))
              .map((chunk) => chunk.content.trim())
              .join("\n\n");

            if (mergedWindow.length <= anchor.content.length + 300) continue;

            directWindowChunks.push({
              id: `dlgs138_window_${docId}_${artNum}_${anchor.start_pos}`,
              document_id: docId,
              content: mergedWindow,
              start_pos: hydratedWindow[0]?.start_pos ?? anchor.start_pos,
              end_pos: hydratedWindow[hydratedWindow.length - 1]?.end_pos ??
                anchor.end_pos,
            });
          }
        }
      }

      if (directWindowChunks.length > 0) {
        addChunks(directWindowChunks, "dlgs138_direct_article_window");
        console.log(
          `Direct D.Lgs. 138 hydration added ${directWindowChunks.length} merged article window chunk(s)`,
        );
      }
    }

    // Strategy A2: Adjacent chunks expansion ─────────────────────────
    // When a specific article is asked about, fetch chunks adjacent (by start_pos)
    // to anchor chunks. This is critical for two-column PDF layouts (D.Lgs. 138/2024)
    // where article body (e.g. lists a/b/c…l) lives in chunks that don't repeat
    // the "Art. N" header and are missed by Strategy A.
    if (
      !skipLegacyStrategies && expandedArticles.length > 0 &&
      targetDocIds.length > 0 && allCandidateChunks.length > 0
    ) {
      const anchorsByDoc = new Map<string, number[]>();
      for (const chunk of allCandidateChunks) {
        if (chunk.start_pos === undefined || chunk.start_pos === null) continue;
        if (!targetDocIds.includes(chunk.document_id)) continue;
        if (
          explicitArticleMode &&
          !questionArticles.some((article) =>
            articleExistsInChunk(chunk.content, article)
          )
        ) {
          continue;
        }
        if (!anchorsByDoc.has(chunk.document_id)) {
          anchorsByDoc.set(chunk.document_id, []);
        }
        anchorsByDoc.get(chunk.document_id)!.push(chunk.start_pos);
      }

      for (const [docId, positions] of anchorsByDoc) {
        const uniquePositions = [...new Set(positions)].sort((a, b) => a - b);
        for (const startPos of uniquePositions.slice(0, 5)) {
          const { data: nextChunks } = await supabase
            .from("chunks")
            .select("id, document_id, content, start_pos, end_pos")
            .eq("document_id", docId)
            .gt("start_pos", startPos)
            .order("start_pos", { ascending: true })
            .limit(3);
          if (nextChunks && nextChunks.length > 0) {
            addChunks(nextChunks, "adjacent_after_anchor");
          }

          const { data: prevChunks } = await supabase
            .from("chunks")
            .select("id, document_id, content, start_pos, end_pos")
            .eq("document_id", docId)
            .lt("start_pos", startPos)
            .order("start_pos", { ascending: false })
            .limit(1);
          if (prevChunks && prevChunks.length > 0) {
            addChunks(prevChunks, "adjacent_before_anchor");
          }
        }
      }
      console.log(
        `After adjacent expansion: ${allCandidateChunks.length} chunks`,
      );
    }

    if (
      !skipLegacyStrategies && explicitArticleMode && targetDocIds.length > 0 &&
      allCandidateChunks.length > 0
    ) {
      const syntheticChunks: Array<{
        id: string;
        document_id: string;
        content: string;
        start_pos?: number;
        end_pos?: number;
      }> = [];

      for (const docId of targetDocIds) {
        const docChunks = allCandidateChunks
          .filter((chunk) =>
            chunk.document_id === docId && chunk.start_pos !== undefined &&
            chunk.start_pos !== null
          )
          .sort((a, b) => (a.start_pos || 0) - (b.start_pos || 0));

        for (const article of questionArticles) {
          const anchorChunks = docChunks.filter((chunk) =>
            articleExistsInChunk(chunk.content, article)
          ).slice(0, 3);

          for (const anchor of anchorChunks) {
            const windowChunks = docChunks.filter((chunk) => {
              const start = chunk.start_pos || 0;
              const anchorStart = anchor.start_pos || 0;
              return start >= anchorStart - 200 && start <= anchorStart + 6000;
            });

            if (windowChunks.length < 2) continue;

            const mergedContent = windowChunks
              .sort((a, b) => (a.start_pos || 0) - (b.start_pos || 0))
              .map((chunk) => chunk.content.trim())
              .join("\n\n");

            if (mergedContent.length <= anchor.content.length + 200) continue;

            syntheticChunks.push({
              id: `synthetic_${docId}_${article}_${anchor.start_pos || 0}`,
              document_id: docId,
              content: mergedContent,
              start_pos: anchor.start_pos,
              end_pos: windowChunks[windowChunks.length - 1]?.end_pos ||
                anchor.end_pos,
            });
          }
        }
      }

      if (syntheticChunks.length > 0) {
        addChunks(syntheticChunks, "synthetic_article_window");
        console.log(
          `Added ${syntheticChunks.length} synthetic article window chunk(s)`,
        );
      }
    }

    // Strategy B: Topic-based keyword search
    if (
      !skipLegacyStrategies && topicKeywords.length > 0 &&
      targetDocIds.length > 0
    ) {
      const topTopics = topicKeywords.slice(0, 10);
      for (const topic of topTopics) {
        const { data } = await supabase
          .from("chunks")
          .select("id, document_id, content, start_pos, end_pos")
          .in("document_id", targetDocIds)
          .ilike("content", `%${topic}%`)
          .limit(10);
        if (data) addChunks(data, `topic_${topic}`);
      }
      console.log(`After topic search: ${allCandidateChunks.length} chunks`);
    }

    // Strategy C: Broad document coverage — ONLY if A+B yielded < 5 chunks
    if (
      !skipLegacyStrategies && targetDocIds.length > 0 &&
      allCandidateChunks.length < 10
    ) {
      console.log(
        `Strategy C activated: only ${allCandidateChunks.length} chunks from A+B (< 10), loading broad coverage`,
      );
      for (const docId of targetDocIds) {
        const { count } = await supabase
          .from("chunks")
          .select("id", { count: "exact", head: true })
          .eq("document_id", docId);

        const totalChunks = count || 0;

        if (totalChunks <= 40) {
          const { data } = await supabase
            .from("chunks")
            .select("id, document_id, content, start_pos, end_pos")
            .eq("document_id", docId)
            .order("start_pos", { ascending: true })
            .limit(40);
          if (data) addChunks(data, "full_doc");
        } else {
          const { data: first } = await supabase
            .from("chunks")
            .select("id, document_id, content, start_pos, end_pos")
            .eq("document_id", docId)
            .order("start_pos", { ascending: true })
            .limit(20);
          if (first) addChunks(first, "doc_first");

          const { data: last } = await supabase
            .from("chunks")
            .select("id, document_id, content, start_pos, end_pos")
            .eq("document_id", docId)
            .order("start_pos", { ascending: false })
            .limit(20);
          if (last) addChunks(last, "doc_last");
        }
      }
      console.log(
        `After broad doc coverage: ${allCandidateChunks.length} chunks`,
      );
    } else if (targetDocIds.length > 0) {
      console.log(
        `Strategy C skipped: ${allCandidateChunks.length} chunks already from A+B`,
      );
    }

    // Strategy C2: Structural element search (Allegati / Recepimento / Trasposizione)
    // The question may reference structural parts of a regulation (e.g. "Allegato I",
    // "data di recepimento", "transposition deadline") whose corresponding chunks
    // do NOT contain article numbers. Without this targeted retrieval, the LLM
    // would have to admit "il contesto non riporta…" even though the KB does.
    // C2 runs even when skipLegacyStrategies=true: structured_chunks DO NOT
    // contain annex tables or transposition deadlines, so we must always
    // fall back to raw chunks for these structural elements.
    if (targetDocIds.length > 0) {
      const structuralPatterns: Array<{ label: string; pattern: string }> = [];
      const q = question.toLowerCase();

      const annexMatch = q.match(/allegat[oi]\s+(i{1,3}|iv|v|1|2|3|4|5)\b|annex\s+(i{1,3}|iv|v|1|2|3|4|5)\b/);
      if (annexMatch) {
        const raw = (annexMatch[1] || annexMatch[2] || "").toUpperCase();
        const roman = raw.replace(/1/g, "I").replace(/2/g, "II").replace(/3/g, "III").replace(/4/g, "IV").replace(/5/g, "V");
        structuralPatterns.push({ label: `allegato_${roman}`, pattern: `%ALLEGATO ${roman}%` });
        structuralPatterns.push({ label: `annex_${roman}`, pattern: `%ANNEX ${roman}%` });
        if (roman === "I") {
          structuralPatterns.push({ label: "settori_alta_criticita", pattern: "%SETTORI AD ALTA CRITICITÀ%" });
          structuralPatterns.push({ label: "highly_critical_sectors", pattern: "%HIGHLY CRITICAL SECTORS%" });
        }
        if (roman === "II") {
          structuralPatterns.push({ label: "altri_settori_critici", pattern: "%ALTRI SETTORI CRITICI%" });
          structuralPatterns.push({ label: "other_critical_sectors", pattern: "%OTHER CRITICAL SECTORS%" });
        }
      }

      if (/\b(recepi|recepire|recepimento|traspos|transpos|stati\s+membri.*entro|deadline.*member\s+states)/i.test(question)) {
        structuralPatterns.push({ label: "recepimento_header", pattern: "%Recepimento%" });
        structuralPatterns.push({ label: "trasposizione_header", pattern: "%Trasposizione%" });
        structuralPatterns.push({ label: "transposition_header", pattern: "%Transposition%" });
        structuralPatterns.push({ label: "stati_membri_entro", pattern: "%Stati membri adottano%" });
        structuralPatterns.push({ label: "data_17_ottobre_2024", pattern: "%17 ottobre 2024%gli Stati membri adottano%" });
      }

      if (/\b(entrat[ao]\s+in\s+vigore|entry\s+into\s+force|applicabilit[àa])/i.test(question)) {
        structuralPatterns.push({ label: "entrata_in_vigore", pattern: "%Entrata in vigore%" });
        structuralPatterns.push({ label: "entry_into_force", pattern: "%Entry into force%" });
      }

      if (structuralPatterns.length > 0) {
        console.log(`Strategy C2 (structural): ${structuralPatterns.length} pattern(s) for question`);
        for (const sp of structuralPatterns) {
          const { data } = await supabase
            .from("chunks")
            .select("id, document_id, content, start_pos, end_pos")
            .in("document_id", targetDocIds)
            .ilike("content", sp.pattern)
            .limit(8);
          if (data && data.length > 0) {
            addChunks(data, `structural_${sp.label}`);
            console.log(`  → ${sp.label}: ${data.length} chunk(s)`);
            for (const anchor of data.slice(0, 3)) {
              if (anchor.start_pos === undefined || anchor.start_pos === null) continue;
              const { data: nextChunks } = await supabase
                .from("chunks")
                .select("id, document_id, content, start_pos, end_pos")
                .eq("document_id", anchor.document_id)
                .gt("start_pos", anchor.start_pos)
                .order("start_pos", { ascending: true })
                .limit(5);
              if (nextChunks && nextChunks.length > 0) {
                addChunks(nextChunks, `structural_${sp.label}_after`);
              }
            }
          }
        }
        console.log(`After structural search: ${allCandidateChunks.length} chunks`);
      }
    }

    // Strategy D: Keyword content search (fallback)
    if (
      !skipLegacyStrategies && allCandidateChunks.length < 10 &&
      keywords.length > 0
    ) {
      for (const kw of keywords.slice(0, 5)) {
        const { data } = await supabase
          .from("chunks")
          .select("id, document_id, content, start_pos, end_pos")
          .ilike("content", `%${kw}%`)
          .limit(10);
        if (data) addChunks(data, `keyword_${kw}`);
      }
      console.log(
        `After keyword fallback: ${allCandidateChunks.length} chunks`,
      );
    }

    // Strategy E: Semantic vector search using Gemini embeddings
    if (geminiKey) {
      const queryEmbedding = await getQueryEmbedding();
      if (queryEmbedding) {
        const { data: vectorMatches } = await supabase.rpc("match_chunks", {
          query_embedding: queryEmbedding,
          match_threshold: 0.55,
          match_count: 20,
        });
        if (vectorMatches) {
          const filtered = targetDocIds.length > 0
            ? vectorMatches.filter((c: any) =>
              targetDocIds.includes(c.document_id)
            )
            : vectorMatches;
          addChunks(filtered, "vector_gemini");
          console.log(
            `Vector search (Gemini): found ${filtered.length} chunks`,
          );
        }
      }
    }

    console.log(`Total candidate chunks: ${allCandidateChunks.length}`);

    if (asksAboutDLgs138 && dlgs138DocIds.size > 0) {
      const beforeFilterCount = allCandidateChunks.length;
      allCandidateChunks = allCandidateChunks.filter((chunk) =>
        dlgs138DocIds.has(chunk.document_id)
      );
      console.log(
        `Strict D.Lgs. 138 mode: kept ${allCandidateChunks.length}/${beforeFilterCount} candidate chunks from the Italian decree`,
      );
    }

    // ── Step 4: Score and pre-filter chunks ───────────────────────────
    if (asksAboutDLgs138 && dlgs138DocIds.size > 0) {
      console.log(
        `User asks about D.Lgs. 138/2024 → boosting ${dlgs138DocIds.size} Italian decree document(s)`,
      );
    }

    const scoredChunks = allCandidateChunks.map((chunk) => {
      const explicitArticleBoost =
        explicitArticleMode && questionArticles.some((article) =>
            articleExistsInChunk(chunk.content, article)
          )
          ? 30
          : 0;
      const articleContinuationBoost =
        explicitArticleMode && topicKeywords.some((keyword) =>
            chunk.content.toLowerCase().includes(keyword.toLowerCase())
          )
          ? 8
          : 0;

      return {
        ...chunk,
        relevanceScore: scoreChunkRelevance(
          chunk.content,
          allKeywords,
          questionArticles,
          topicKeywords,
        ) +
          (chunk.source?.startsWith("structured_") ? 10 : 0) +
          (chunk.source === "synthetic_article_window" ? 20 : 0) +
          (chunk.source === "dlgs138_direct_article_window" ? 35 : 0) +
          (chunk.source?.startsWith("dlgs138_direct_") ? 20 : 0) +
          (chunk.source?.startsWith("structural_") ? 25 : 0) +
          (dlgs138DocIds.has(chunk.document_id) ? 15 : 0) +
          explicitArticleBoost +
          articleContinuationBoost,
      };
    });

    scoredChunks.sort((a, b) => b.relevanceScore - a.relevanceScore);

    // Pre-filter: i risultati della ricerca semantica passano sempre (sono al
    // massimo 40 e sono i più pertinenti per significato), il resto del budget
    // di 60 va ai candidati con il punteggio lessicale più alto.
    const semanticHits = scoredChunks.filter((c) =>
      c.source === "vector_gemini" || c.source?.startsWith("structured_vector_")
    );
    const semanticIds = new Set(semanticHits.map((c) => c.id));
    const preFiltered = [
      ...semanticHits.slice(0, 40),
      ...scoredChunks.filter((c) => !semanticIds.has(c.id)),
    ].slice(0, 60);

    // ── Step 5: Re-rank with Gemini Flash ─────────────────────────────
    // Adaptive chunk count based on question specificity
    // Specific article questions need fewer, more focused chunks
    const MAX_CHUNKS = questionArticles.length > 0 ? 15 : 25;
    let selectedIds: string[];

    if (preFiltered.length > MAX_CHUNKS) {
      console.log(
        `Re-ranking ${preFiltered.length} chunks with Gemini Flash...`,
      );
      selectedIds = await rerankChunks(
        lovableApiKey,
        question,
        preFiltered,
        MAX_CHUNKS,
      );
    } else {
      selectedIds = preFiltered.map((c) => c.id);
    }

    // Build final selection preserving re-ranked order, then diversify by document
    const selectedIdSet = new Set(selectedIds);
    let selected = preFiltered.filter((c) => selectedIdSet.has(c.id));

    // Ensure document diversity: if one doc dominates, rebalance
    const byDoc = new Map<string, typeof selected>();
    for (const chunk of selected) {
      if (!byDoc.has(chunk.document_id)) byDoc.set(chunk.document_id, []);
      byDoc.get(chunk.document_id)!.push(chunk);
    }

    if (byDoc.size > 1) {
      const maxPerDoc = Math.max(Math.ceil(MAX_CHUNKS / byDoc.size), 8);
      const balanced: typeof selected = [];
      let round = 0;
      while (balanced.length < MAX_CHUNKS) {
        let addedAny = false;
        for (const [, docChunks] of byDoc) {
          if (
            round < docChunks.length && round < maxPerDoc &&
            balanced.length < MAX_CHUNKS
          ) {
            balanced.push(docChunks[round]);
            addedAny = true;
          }
        }
        if (!addedAny) break;
        round++;
      }
      selected = balanced;
    }

    // Comparison questions name two or more regulations: make sure each one keeps enough
    // material in the context, otherwise the reranker lets the dominant one crowd the other out
    // and the answer falls back to recitals for the second regulation.
    if (docIdsByRegulation.size >= 2) {
      const MIN_PER_REGULATION = 6;
      const selectedIdsNow = new Set(selected.map((c) => c.id));
      const countFor = (ids: Set<string>) => selected.filter((c) => ids.has(c.document_id)).length;
      for (const [regKey, ids] of docIdsByRegulation) {
        let have = countFor(ids);
        if (have >= MIN_PER_REGULATION) continue;
        const candidates = preFiltered.filter((c) => ids.has(c.document_id) && !selectedIdsNow.has(c.id));
        for (const c of candidates) {
          if (have >= MIN_PER_REGULATION) break;
          selected.push(c);
          selectedIdsNow.add(c.id);
          have++;
        }
        console.log(`Coverage: ${regKey} now has ${have} chunk(s) in context`);
      }
      if (selected.length > MAX_CHUNKS) {
        // Drop the weakest chunks of the most represented regulation until we are back within budget
        while (selected.length > MAX_CHUNKS) {
          let dominant: Set<string> | null = null;
          let dominantCount = 0;
          for (const ids of docIdsByRegulation.values()) {
            const n = countFor(ids);
            if (n > dominantCount) { dominant = ids; dominantCount = n; }
          }
          if (!dominant || dominantCount <= MIN_PER_REGULATION) break;
          let dropIdx = -1;
          for (let i = selected.length - 1; i >= 0; i--) {
            if (dominant.has(selected[i].document_id)) { dropIdx = i; break; }
          }
          if (dropIdx < 0) break;
          selected.splice(dropIdx, 1);
        }
      }
    }

    // Le unità lunghe (es. elenchi di un paragrafo) sono divise in parti
    // "Parte i/n": se il re-ranking ne ha scelta una, includi le altre così il
    // modello vede l'elenco completo e non dichiara "testo non presente".
    const partPrefix = (content: string): string | null => {
      const firstLine = content.split("\n")[0] || "";
      const m = /^(\[.*)\. Parte \d+\/\d+\]$/.exec(firstLine);
      return m ? m[1] : null;
    };
    const selectedIdsNow = new Set(selected.map((c) => c.id));
    const wantedPrefixes = new Set(
      selected.map((c) => partPrefix(c.content)).filter((v): v is string => !!v),
    );
    if (wantedPrefixes.size > 0) {
      const siblings = allCandidateChunks.filter((c) => {
        if (selectedIdsNow.has(c.id)) return false;
        const prefix = partPrefix(c.content);
        return !!prefix && wantedPrefixes.has(prefix);
      });
      const room = Math.max(0, MAX_CHUNKS + 10 - selected.length);
      if (siblings.length > 0) {
        console.log(`Part completion: adding ${Math.min(siblings.length, room)} sibling part(s)`);
        selected.push(...siblings.slice(0, room).map((c) => ({ ...c, relevanceScore: 0 })));
      }
    }

    // Sort by document + position for logical reading order
    selected.sort((a, b) => {
      if (a.document_id !== b.document_id) {
        return a.document_id.localeCompare(b.document_id);
      }
      return (a.start_pos || 0) - (b.start_pos || 0);
    });

    console.log(`Selected ${selected.length} chunks after re-ranking`);

    // ── Step 6: Enrich chunks with metadata (Chunk Enrichment) ───────
    const documentIds = [...new Set(selected.map((c) => c.document_id))];
    const { data: documents } = await supabase.from("documents").select("*").in(
      "id",
      documentIds,
    );
    const docMap = new Map(documents?.map((d) => [d.id, d]) || []);

    const contextWithCitations = selected.map((chunk, idx) => {
      const doc = docMap.get(chunk.document_id);
      if (!doc) {
        return `[${idx + 1}] Documento sconosciuto\n${chunk.content}`;
      }
      return `[${idx + 1}] ${enrichChunkContent(chunk, doc, selected)}`;
    }).join("\n\n---\n\n");

    // ── Step 6b: Detect regulations mentioned but not covered ──────
    const missingRegulationWarnings: string[] = [];
    const regulationLabels: Record<number, string> = {};
    regulationConfigs.forEach((cfg, idx) => {
      regulationLabels[idx] = cfg.searchTerms[0]; // e.g. "GDPR", "NIS2"
    });

    for (let i = 0; i < detectedConfigs.length; i++) {
      const cfg = detectedConfigs[i];
      const regLabel = cfg.searchTerms[0];
      // Check if any selected chunk belongs to a document matching this regulation
      const hasChunksForReg = selected.some((chunk) => {
        const doc = docMap.get(chunk.document_id);
        if (!doc) return false;
        const docTitle = (doc.title || "").toLowerCase();
        // Match regulation search terms against document title
        return cfg.searchTerms.some((term) =>
          docTitle.includes(term.toLowerCase())
        );
      });

      if (!hasChunksForReg) {
        console.warn(
          `WARNING: User asked about ${regLabel} but 0 chunks found for it`,
        );
        missingRegulationWarnings.push(
          `ATTENZIONE: Non sono stati trovati documenti per ${regLabel} nel knowledge base. NON rispondere su questa normativa — indica all'utente che la documentazione non è disponibile.`,
        );
      }
    }

    // ── Step 7: Build system prompt ──────────────────────────────────
    const roleContext: Record<string, string> = {
      "DPO":
        "Data Protection Officer con focus su adempimenti GDPR, registri dei trattamenti, DPIA e notifiche al Garante",
      "CISO":
        "Chief Information Security Officer con focus su misure tecniche, gestione rischi ICT, incident response e cybersecurity",
      "Compliance Officer":
        "responsabile conformità con focus su procedure organizzative, audit interni e reporting",
      "Legal Counsel":
        "consulente legale con focus su interpretazione normativa, rischi legali e contrattualistica",
      "IT Manager":
        "responsabile IT con focus su implementazione tecnica, sistemi e infrastrutture",
    };
    const roleDescription = roleContext[userProfile?.compliance_role] ||
      "professionista della compliance";

    // completenessReminders removed (Fix 2) - LLM must speak only about chunks it has

    const sectorContext = userProfile?.sector
      ? `Il tuo interlocutore opera nel settore "${userProfile.sector}".`
      : "";
    const jurisdictionContext = userProfile?.jurisdiction
      ? `Giurisdizione di riferimento: ${userProfile.jurisdiction}.`
      : "Giurisdizione di riferimento: EU.";
    const rolePersonalization = userProfile?.compliance_role
      ? `Adatta il livello di dettaglio, il linguaggio e le priorita al ruolo di ${roleDescription}. Evidenzia gli obblighi e le responsabilita che ricadono specificamente su questo ruolo professionale.`
      : "";
    const sectorPersonalization = userProfile?.sector
      ? `Quando possibile, contestualizza la risposta al settore "${userProfile.sector}", indicando obblighi specifici, scadenze o esenzioni settoriali, e best practice di settore.`
      : "";

    const systemPrompt =
      `[REGOLE TASSATIVE DI INGAGGIO E FORMATTAZIONE - OVERRIDE]

Il tuo obiettivo è comportarti come un consulente esperto e diretto. Non sei un generatore di report formali.

CONTESTO UTENTE:
- Ruolo: ${roleDescription}
- Settore: ${userProfile?.sector || "Non specificato"}
- Giurisdizione: ${userProfile?.jurisdiction || "Non specificata"}
- Dimensione dell'organizzazione: ${describeCompanySize(userProfile?.company_size) || "Non specificata"}
- Ruolo nel trattamento dei dati: ${describeDataRole(userProfile?.data_role) || "Non specificato"}
${activeGoal ? `- Obiettivo della conversazione: ${activeGoal}` : ""}
${
        caseContext.length > 0
          ? `
INFORMAZIONI FORNITE DALL'UTENTE SULLA SUA SITUAZIONE (usale come fatti accertati, non chiederle di nuovo):
${caseContext.map((f) => `- ${f.question} → ${f.answer}`).join("\n")}
`
          : ""
      }
STILE DI RISPOSTA E DIVIETI:

1. DIVIETO DI PREAMBOLI: Inizia a rispondere immediatamente alla domanda. Niente saluti formali, niente giri di parole e MAI iniziare con frasi come "In qualità di professionista...", "Di seguito l'analisi..." o "Ecco i dettagli".

2. DIVIETO DI SCARICABARILE: Se l'utente chiede "La mia organizzazione deve fare X?" o "Devo adempiere a questo obbligo?", NON dirgli mai di "redigere un documento", "fare un assessment interno" o "consultare un legale". Sei TU che devi guidarlo, passo dopo passo, verso il suo obiettivo, usando le informazioni che ti ha già dato.

2-bis. NIENTE DOMANDE DI ROUTINE: le domande di chiarimento vengono poste in una fase separata, prima della risposta. Qui devi RISPONDERE. Non chiudere mai la risposta con un elenco di domande all'utente.

3. ZERO ASSUNZIONI: Usa il settore e il ruolo dell'utente solo per contestualizzare, ma NON dare per scontato che bastino per determinare un obbligo di legge (es. un'azienda "Tech" non ha in automatico gli stessi obblighi di un'altra). Se il contesto utente dice "Non specificato", trattalo come sconosciuto.

STRUTTURA OBBLIGATORIA DELLA RISPOSTA (REGOLE DI IMPAGINAZIONE):

Devi formattare il testo in modo arioso e leggibile. Usa SEMPRE un doppio ritorno a capo (riga vuota) per separare i paragrafi e le sezioni.

Dividi la risposta esattamente in queste tre sezioni:

**1. Regola Generale**

Fornisci una sintesi secca e chiara dell'obbligo o requisito normativo. Usa le fonti [N] per giustificarla punto per punto. Se ci sono più scenari o requisiti, NON scriverli di seguito ma usa SEMPRE un elenco puntato, andando a capo per ogni punto.

**2. Applicazione al tuo contesto**

Se conosci il settore o il ruolo dell'utente, fai esempi pertinenti di come la regola si applica generalmente a quel mondo (es. per il settore Tech: tracciamento online, profilazione). Usa paragrafi brevi e separati da una riga vuota. Se non lo conosci, salta questa parte.

**3. Prossimo passo**

Questa sezione è FACOLTATIVA e serve a portare l'utente verso il suo obiettivo, non a fargli domande di routine. Includila SOLO se esiste un passo concreto e utile (es. "il prossimo passo è mappare i trattamenti X", "posso prepararti la bozza di Y"). Se l'utente ha risposto a domande di chiarimento, usa le sue risposte e concludi con una valutazione netta, dichiarando le eventuali ipotesi che hai dovuto fare. Puoi porre AL MASSIMO UNA domanda, e solo se senza quella risposta non puoi procedere: MAI elenchi di domande, MAI domande generiche o retoriche. Se non c'è nulla di utile da aggiungere, ometti del tutto la sezione.

AZIONE SUCCESSIVA (tag per l'interfaccia): se il prossimo passo concreto per l'utente è produrre un documento che RegBrain genera in automatico, aggiungi come ULTIMISSIMA riga della risposta, da sola, esattamente uno di questi tag: [[AZIONE:dpia]] se serve una valutazione d'impatto (DPIA, art. 35 GDPR), [[AZIONE:ropa]] se serve il registro dei trattamenti (RoPA, art. 30 GDPR). In tutti gli altri casi non aggiungere nessun tag. Il tag non sostituisce la sezione "Prossimo passo": spiega comunque a parole perché quel documento serve.

REGOLE DI FORMATTAZIONE TASSATIVE:

- DIVIETO di "Muri di testo" (Wall of text): non scrivere mai più di 3-4 righe senza andare a capo.
- Usa i ritorni a capo prima e dopo ogni titolo in grassetto.
- Usa gli elenchi puntati (- o *) per rendere la lettura più fluida quando elenchi regole o sanzioni.
- NON usare intestazioni con # o ### — usa SOLO titoli in grassetto con **Titolo** su riga isolata.
- Niente emoji. Usa il **grassetto** per enfatizzare i concetti chiave.

REGOLE ANTI-ALLUCINAZIONE:

- Rispondi SOLO con informazioni presenti nella documentazione normativa fornita.
- ⚠️ CITAZIONI [N] OBBLIGATORIE — REGOLA INVIOLABILE: Ogni singola affermazione normativa, articolo, obbligo, scadenza, sanzione o requisito DEVE essere seguito IMMEDIATAMENTE dal marker [N] della fonte. Esempi corretti: "L'Art. 7 prevede la registrazione [3]", "I soggetti devono notificare entro 24 ore [5]", "Le sanzioni arrivano fino a 10 milioni di euro [2]". Esempi VIETATI (no marker): "L'Art. 7 prevede la registrazione (D.Lgs. 138/2024)", "I soggetti devono notificare entro 24 ore.". Se non puoi citare con [N], NON fare quell'affermazione.
- POSIZIONAMENTO DEL MARKER: Metti SEMPRE [N] subito dopo il numero dell'articolo o l'affermazione, MAI dopo il nome della normativa fra parentesi. Scrivi "Art. 24 [3] del D.Lgs. 138/2024" e NON "Art. 24 del D.Lgs. 138/2024 [3]" quando possibile (perché il verificatore controlla che [N] sia adiacente all'articolo citato).
- DIVIETO DI CITAZIONI TESTUALI SOSTITUTIVE: NON usare riferimenti testuali come "(secondo il D.Lgs. 138/2024)" o "(art. 7 D.Lgs. 138/2024)" SENZA [N]. Devi SEMPRE accompagnarli con il marker numerico [N] della fonte effettiva nel contesto.
- Se NON trovi informazioni nel contesto fornito, dillo esplicitamente: "Non ho trovato informazioni specifiche su questo tema nella documentazione disponibile."
- MAI inventare articoli, numeri o riferimenti non presenti nelle fonti.
- Usa la terminologia ESATTA presente nei documenti citati.
- CITA SOLO fonti DIRETTAMENTE pertinenti alla domanda specifica — NON citare fonti su normative o argomenti diversi.
- DIVIETO DI MESCOLARE NORMATIVE: Se l'utente chiede specificamente di UNA normativa (es. 'Quali sono gli obblighi GDPR per...'), rispondi SOLO con fonti di quella normativa. NON citare fonti di altre normative (es. NIS2, DORA) nella risposta, anche se sono presenti nel contesto. Se vuoi fare un collegamento con un'altra normativa, dichiaralo esplicitamente come nota a parte (es. 'Nota: un obbligo simile è previsto anche dall'Art. X della NIS2'). Puoi citare più normative SOLO se l'utente chiede esplicitamente un confronto o menziona più normative nella domanda.
- FAMIGLIA NORMATIVA NIS2: La Direttiva UE 2022/2555 (NIS2), il D.Lgs. 138/2024 (recepimento italiano) e le Determinazioni ACN (atti attuativi) appartengono alla STESSA famiglia normativa. Se l'utente chiede di "NIS2" puoi e DEVI citare TUTTI e tre come fonti, perché sono il corpus completo della NIS2 in Italia. NON dichiararli "normative diverse".
- ETICHETTA NORMATIVA TASSATIVA: Ogni fonte nel contesto ha un'etichetta "NORMATIVA: <nome>" all'inizio. Quando citi [N], NOMINA SEMPRE la normativa esatta indicata in quell'etichetta (es. "Art. 32 del GDPR [3]", "Art. 24 del D.Lgs. 138/2024 [5]").
- REGOLA CITAZIONE PRECISA: Quando citi [N], assicurati che il chunk [N] contenga EFFETTIVAMENTE l'articolo o l'informazione che stai attribuendo a quella fonte. NON citare [N] per un articolo se quel chunk parla di un articolo diverso. Se devi menzionare un articolo che non è presente in nessun chunk fornito, dichiaralo esplicitamente: "(non presente nella documentazione caricata)" invece di associarlo a una fonte sbagliata.
- REGOLA CITAZIONE STRETTA: Cita [N] SOLO se stai riportando un'informazione che hai letto ESATTAMENTE nel chunk [N]. NON citare [N] solo perché il chunk è "dello stesso argomento" o "della stessa normativa". Se scrivi "L'Art. 24 prevede 10 ambiti obbligatori [3]", il chunk [3] DEVE contenere il testo che parla dei 10 ambiti. Se invece il chunk [3] parla dell'Art. 24 ma di un altro aspetto (es. le sanzioni), NON usare [3] per quell'affermazione.
- REGOLA UNA FONTE PER AFFERMAZIONE: Per ogni frase che contiene un'affermazione normativa, cita al massimo 2 fonti [N]. NON accumulare citazioni come "secondo [1][3][5][7]" — scegli la fonte PIÙ pertinente.
- REGOLA NESSUNA PARAFRASI INVENTATA: Se il chunk dice "misure tecniche e organizzative adeguate", riporta ESATTAMENTE "misure tecniche e organizzative adeguate", non parafrasare in "misure di sicurezza appropriate" perché potresti alterare il significato giuridico.
- Usa un tono professionale ma diretto, come un collega esperto che va al punto.
- Sii conciso ma completo (max 3-4 paragrafi per la risposta principale).
${
        files && files.length > 0
          ? `
DOCUMENTI ALLEGATI DALL'UTENTE (REGOLA PRIORITARIA):

- L'utente ha allegato uno o più documenti aziendali (es. DPIA, RoPA, LIA, policy, procedure). Il loro contenuto è riportato nel messaggio utente ed è una FONTE VALIDA a tutti gli effetti.
- DEVI analizzare il documento allegato e rispondere nel merito. È VIETATO rispondere "non ho informazioni su questo documento" o "il documento non è disponibile" quando il contenuto è presente nel messaggio utente.
- I documenti allegati NON fanno parte della base di conoscenza normativa: non assegnare loro marker [N]. Riferisciti a essi per nome (es. "nella DPIA allegata"). I marker [N] servono solo per le fonti normative.
- Struttura tipica della risposta su un documento allegato: cosa contiene, cosa manca rispetto ai requisiti normativi applicabili (citando [N] per i requisiti), e le domande necessarie per completarlo.
- Se il testo estratto risulta parziale o illeggibile, dillo indicando quali sezioni non sei riuscito a leggere, ma analizza comunque quello che hai.
`
          : ""
      }

${
        missingRegulationWarnings.length > 0
          ? missingRegulationWarnings.join("\n") + "\n"
          : ""
      }DOCUMENTAZIONE NORMATIVA (BASE DI CONOSCENZA — CITA SEMPRE [N]):

${
        contextWithCitations ||
        "Nessuna documentazione normativa trovata per questa domanda."
      }

CHECKLIST INTERNA (Assicurati di rispettare questi punti prima di generare l'output):
□ Ho risposto direttamente senza preamboli inutili?
□ Ho inserito le citazioni [N] dove necessario?
□ Ho evitato di dire all'utente di "farsi un assessment interno"?
□ Ho evitato elenchi di domande all'utente (al massimo una, solo se bloccante)?
□ Se l'utente ha già fornito informazioni sulla sua situazione, le ho usate per dare una valutazione netta?
□ La risposta è basata SOLO sulle fonti fornite?

REGOLA CRITICA FINALE — RISPOSTE PARZIALI VS MANCANTI:

1. SE il contesto contiene ANCHE SOLO PARZIALMENTE informazioni pertinenti alla domanda → RISPONDI usando quello che hai trovato, citando [N]. NON dire "non ho informazioni" se hai trovato chunks rilevanti, anche se non coprono il 100% della domanda. In questo caso:
   - Inizia direttamente con la sezione "**1. Regola Generale**" usando le informazioni disponibili.
   - Se mancano aspetti specifici (es. una data precisa, un allegato), segnalalo SOLO alla fine come nota: "Nota: il contesto non riporta [aspetto specifico mancante]."
   - NON anteporre disclaimer generici tipo "la documentazione non contiene informazioni" se hai materiale parziale da citare.

2. SOLO SE il contesto è COMPLETAMENTE VUOTO o totalmente irrilevante alla domanda E l'utente NON ha allegato documenti → rispondi con: "La documentazione normativa attualmente disponibile nel sistema non contiene informazioni specifiche su questo tema. Ti consiglio di verificare direttamente il testo ufficiale della normativa o consultare un esperto legale." Se invece l'utente ha allegato un documento, analizza SEMPRE il documento allegato: non usare mai questo disclaimer.

3. MAI inventare contenuti, articoli o numeri non presenti nelle fonti. Una risposta parziale ma fondata è SEMPRE migliore di un disclaimer generico quando ci sono fonti pertinenti da citare.`;

    // ── Step 8: Call AI ──────────────────────────────────────────────
    console.log(
      "Calling AI with",
      selected.length,
      "enriched context chunks...",
    );
    const startTime = Date.now();

    // ── Helper: extract text from base64-encoded documents ──
    function extractTextFromBase64(
      base64Data: string,
      fileName: string,
      mimeType: string,
    ): string | null {
      try {
        // Strip data URI prefix if present
        const raw = base64Data.includes(",")
          ? base64Data.split(",")[1]
          : base64Data;
        const bytes = Uint8Array.from(atob(raw), (c) => c.charCodeAt(0));

        // PDF: extract text between stream markers and text operators
        if (
          mimeType === "application/pdf" ||
          fileName.toLowerCase().endsWith(".pdf")
        ) {
          const text = new TextDecoder("utf-8", { fatal: false }).decode(bytes);
          // Extract readable text segments (between BT/ET operators and parenthesized strings)
          const textSegments: string[] = [];
          // Method 1: Extract parenthesized text from PDF streams
          const parenRegex = /\(([^)]{2,})\)/g;
          let m;
          while ((m = parenRegex.exec(text)) !== null) {
            const seg = m[1].replace(/\\n/g, "\n").replace(/\\r/g, "").replace(
              /\\\\/g,
              "\\",
            ).replace(/\\([()])/g, "$1");
            if (seg.trim().length > 1 && !/^[\x00-\x1f]+$/.test(seg)) {
              textSegments.push(seg.trim());
            }
          }
          // Method 2: Also grab any plain-text lines (useful for text-based PDFs)
          const lines = text.split("\n");
          for (const line of lines) {
            const clean = line.replace(
              /[^\x20-\x7E\xA0-\xFF\u0100-\uFFFF]/g,
              "",
            ).trim();
            if (
              clean.length > 20 && !clean.includes("obj") &&
              !clean.includes("endobj") && !clean.includes("stream")
            ) {
              textSegments.push(clean);
            }
          }
          if (textSegments.length > 0) {
            // Deduplicate and limit
            const unique = [...new Set(textSegments)];
            return unique.join("\n").substring(0, 80000);
          }
          return null;
        }

        // DOCX: extract text from XML within the ZIP
        if (
          mimeType ===
            "application/vnd.openxmlformats-officedocument.wordprocessingml.document" ||
          fileName.toLowerCase().endsWith(".docx")
        ) {
          const text = new TextDecoder("utf-8", { fatal: false }).decode(bytes);
          // DOCX is a ZIP; look for XML text content patterns
          const textSegments: string[] = [];
          // Extract content between <w:t> tags
          const wtRegex = /<w:t[^>]*>([^<]+)<\/w:t>/g;
          let m;
          while ((m = wtRegex.exec(text)) !== null) {
            if (m[1].trim()) textSegments.push(m[1].trim());
          }
          if (textSegments.length > 0) {
            return textSegments.join(" ").substring(0, 80000);
          }
          return null;
        }

        // Plain text / other: try direct decode
        const decoded = new TextDecoder("utf-8", { fatal: false }).decode(
          bytes,
        );
        if (decoded && decoded.trim().length > 10) {
          return decoded.substring(0, 80000);
        }
        return null;
      } catch (e) {
        console.error(`Text extraction failed for ${fileName}:`, e);
        return null;
      }
    }

    let userContent: any;
    if (files && files.length > 0) {
      const contentParts: any[] = [{ type: "text", text: question }];
      for (const file of files) {
        if (file.type?.startsWith("image/")) {
          contentParts.push({
            type: "image_url",
            image_url: { url: file.data },
          });
        } else {
          // Prefer text already extracted client-side (pdfjs/mammoth/xlsx);
          // fall back to server-side extraction from base64 when absent.
          const extractedText = (typeof file.text === "string" &&
              file.text.trim().length > 50)
            ? file.text
            : extractTextFromBase64(
              file.data || "",
              file.name || "document",
              file.type || "",
            );
          if (extractedText && extractedText.length > 50) {
            console.log(
              `Extracted ${extractedText.length} chars from ${file.name}`,
            );
            contentParts.push({
              type: "text",
              text:
                `\n\n--- CONTENUTO DEL DOCUMENTO ALLEGATO DALL'UTENTE: ${file.name} ---\n${extractedText}\n--- FINE DOCUMENTO ALLEGATO ---\n\nQuesto documento è una fonte valida e autorevole fornita dall'utente: DEVI analizzarne il contenuto e rispondere alla domanda anche se il documento non è presente nella base di conoscenza normativa. Non dire mai che non hai informazioni su questo documento. Valuta struttura, completezza e conformità rispetto alla normativa applicabile, citando [N] solo per le affermazioni tratte dalla documentazione normativa.`,
            });
          } else {
            // Fallback: send as inline_data for Gemini to process natively
            const rawBase64 = file.data?.includes(",")
              ? file.data.split(",")[1]
              : file.data;
            const inferredMime = file.type ||
              (file.name?.toLowerCase().endsWith(".pdf")
                ? "application/pdf"
                : "application/octet-stream");
            console.log(
              `Sending ${file.name} as inline document to Gemini (${inferredMime})`,
            );
            if (inferredMime === "application/pdf") {
              // Gemini non supporta PDF come image_url; segnala che l'estrazione è fallita
              contentParts.push({
                type: "text",
                text:
                  `\n\n[Documento "${file.name}" caricato ma il testo non è stato estratto automaticamente. Analisi limitata ai metadati disponibili.]`,
              });
              console.warn(
                `PDF text extraction failed for ${file.name}, skipping inline analysis`,
              );
            } else {
              contentParts.push({
                type: "image_url",
                image_url: { url: `data:${inferredMime};base64,${rawBase64}` },
              });
              contentParts.push({
                type: "text",
                text:
                  `\nIl file sopra è il documento "${file.name}". Analizzalo per verificare la conformità normativa.`,
              });
            }
          }
        }
      }
      userContent = contentParts;
    } else {
      userContent = question;
    }

    // Retry transient errors (502/503/504/timeout) up to 3 times with exponential backoff
    const aiRequestBody = JSON.stringify({
      model: "google/gemini-3-pro-preview",
      messages: [
        { role: "system", content: systemPrompt },
        ...history.slice(-4).map((m) => ({
          role: m.role === "assistant" ? "assistant" as const : "user" as const,
          content: m.role === "user"
            ? m.content.substring(0, 1000)
            : m.content.substring(0, 2500),
        })),
        { role: "user", content: userContent },
      ],
      temperature: 0,
      max_tokens: 8000,
    });

    let aiResponse: Response | null = null;
    let lastErrorText = "";
    let lastStatus = 0;
    const maxAttempts = 3;
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        aiResponse = await fetch(
          "https://ai.gateway.lovable.dev/v1/chat/completions",
          {
            method: "POST",
            headers: {
              "Authorization": `Bearer ${lovableApiKey}`,
              "Content-Type": "application/json",
            },
            body: aiRequestBody,
          },
        );

        if (aiResponse.ok) break;

        lastStatus = aiResponse.status;

        // Non-retryable errors: return immediately with friendly message
        if (aiResponse.status === 429) {
          return new Response(
            JSON.stringify({
              answer:
                "⚠️ Il servizio AI ha raggiunto un limite di utilizzo. Potrebbe essere un limite temporaneo o la quota dell’account: se il problema continua, occorre verificare la quota del provider AI configurato.",
              citations: [],
              next_steps: [],
              risk_level: "low",
              confidence: {
                score: 0,
                level: "low",
                explanation: "Rate limit",
                factors: {
                  citationsCount: 0,
                  retrievedChunks: 0,
                  semanticSimilarity: 0,
                  hasCitations: false,
                  hasOfficialSources: false,
                },
              },
              latencyMs: Date.now() - startTime,
            }),
            {
              status: 200,
              headers: { ...corsHeaders, "Content-Type": "application/json" },
            },
          );
        }
        if (aiResponse.status === 402) {
          return new Response(
            JSON.stringify({
              answer:
                "⚠️ Il servizio AI richiede un aggiornamento del piano. Contatta il supporto.",
              citations: [],
              next_steps: [],
              risk_level: "low",
              confidence: {
                score: 0,
                level: "low",
                explanation: "Payment required",
                factors: {
                  citationsCount: 0,
                  retrievedChunks: 0,
                  semanticSimilarity: 0,
                  hasCitations: false,
                  hasOfficialSources: false,
                },
              },
              latencyMs: Date.now() - startTime,
            }),
            {
              status: 200,
              headers: { ...corsHeaders, "Content-Type": "application/json" },
            },
          );
        }

        // Retryable: 502/503/504 or 5xx
        lastErrorText = await aiResponse.text();
        console.warn(
          `AI gateway attempt ${attempt}/${maxAttempts} failed with ${aiResponse.status}`,
        );
        if (aiResponse.status >= 500 && attempt < maxAttempts) {
          await new Promise((r) => setTimeout(r, 1000 * attempt)); // 1s, 2s
          continue;
        }
        // Non-retryable client error or final attempt
        break;
      } catch (fetchErr) {
        console.warn(
          `AI gateway attempt ${attempt}/${maxAttempts} threw:`,
          fetchErr,
        );
        lastErrorText = String(fetchErr);
        if (attempt < maxAttempts) {
          await new Promise((r) => setTimeout(r, 1000 * attempt));
          continue;
        }
      }
    }

    if (!aiResponse || !aiResponse.ok) {
      console.error(
        "AI error after retries:",
        lastStatus,
        lastErrorText.substring(0, 500),
      );
      // Return a graceful, user-friendly response (200) so the UI shows a message instead of red error
      return new Response(
        JSON.stringify({
          answer:
            "⚠️ **Servizio AI temporaneamente non disponibile**\n\nIl gateway AI ha restituito un errore temporaneo. Questo è un problema infrastrutturale, non legato alla tua domanda.\n\n**Cosa fare:**\n- Riprova tra 30 secondi\n- Se il problema persiste, riformula la domanda\n\n*La tua conversazione è stata salvata.*",
          citations: [],
          next_steps: [
            "Attendi 30 secondi e riprova",
            "Riformula la domanda in modo più sintetico",
          ],
          risk_level: "low",
          confidence: {
            score: 0,
            level: "low",
            explanation: "AI gateway temporarily unavailable",
            factors: {
              citationsCount: 0,
              retrievedChunks: 0,
              semanticSimilarity: 0,
              hasCitations: false,
              hasOfficialSources: false,
            },
          },
          latencyMs: Date.now() - startTime,
        }),
        {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    const aiData = await aiResponse.json();
    const rawAnswer = typeof aiData?.choices?.[0]?.message?.content === "string"
      ? aiData.choices[0].message.content
      : "";
    const nextActionMatch = rawAnswer.match(NEXT_ACTION_PATTERN);
    const nextAction = nextActionMatch
      ? {
        type: "generate_document",
        documentType: nextActionMatch[1].toLowerCase(),
        label: NEXT_ACTION_LABELS[nextActionMatch[1].toLowerCase()],
      }
      : null;
    const answer = rawAnswer.replace(NEXT_ACTION_PATTERN, "").trim();
    if (nextAction) console.log(`Next action suggested: ${nextAction.documentType}`);
    const latencyMs = Date.now() - startTime;
    console.log("Answer generated in", latencyMs, "ms");

    if (!answer.trim()) {
      console.error(
        "AI returned empty or null content:",
        JSON.stringify(aiData).slice(0, 500),
      );
      return new Response(
        JSON.stringify({
          answer:
            "⚠️ **Risposta temporaneamente non disponibile**\n\nIl motore AI non ha restituito un contenuto valido per questa richiesta. Riprova tra qualche secondo oppure riformula la domanda.",
          citations: [],
          next_steps: [
            "Riprova tra qualche secondo",
            "Riformula la domanda in modo più specifico",
          ],
          risk_level: "low",
          confidence: {
            score: 0,
            level: "low",
            explanation: "Empty AI response",
            factors: {
              citationsCount: 0,
              retrievedChunks: selected.length,
              semanticSimilarity: 0,
              hasCitations: false,
              hasOfficialSources: false,
            },
          },
          latencyMs,
        }),
        {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    // ── Step 8.5: force bold section titles onto dedicated lines ─────
    let formattedAnswer = formatBoldTitlesOnOwnLine(answer);

    if (isMissingInformationAnswer(formattedAnswer) && explicitArticleMode) {
      const fallbackChunk = selected.find((chunk) =>
        questionArticles.some((article) =>
          articleExistsInChunk(chunk.content, article)
        )
      );
      const mergedArticleContent = selected
        .filter((chunk) => chunk.document_id === fallbackChunk?.document_id)
        .sort((a, b) => (a.start_pos || 0) - (b.start_pos || 0))
        .map((chunk) => chunk.content)
        .join("\n\n");
      const letterItems = extractOrderedArticleLetters(mergedArticleContent)
        .filter((item) => item.letter >= "a" && item.letter <= "l");

      if (fallbackChunk && letterItems.length >= 6) {
        formattedAnswer = [
          "**1. Regola Generale**",
          "",
          `L'Art. ${
            questionArticles[0]
          } del D.Lgs. 138/2024 prevede che le misure di gestione dei rischi per la sicurezza informatica comprendano almeno i seguenti ambiti [1].`,
          "",
          ...letterItems.slice(0, 12).map((item) =>
            `- ${item.letter}) ${item.text} [1]`
          ),
        ].join("\n");
        console.log(
          `Fallback article synthesis activated for Art. ${
            questionArticles[0]
          } with ${letterItems.length} lettered items`,
        );
      }
    }

    // ── Step 9: Grounding Verification (post-response) ──────────────
    console.log("Running grounding verification...");
    const grounding = groundingVerification(formattedAnswer, selected, docMap);
    const finalAnswer = grounding.verifiedAnswer;

    if (grounding.removedClaims.length > 0) {
      console.log(
        `Grounding: removed ${grounding.removedClaims.length} unverified claims:`,
        grounding.removedClaims,
      );
    }

    // ── Step 9.5: Post-grounding orphan citation removal (Fix 5) ───
    let postGroundedAnswer = finalAnswer;
    const postCitedNums = new Set<number>();
    for (const m of finalAnswer.matchAll(/\[(\d+)\]/g)) {
      postCitedNums.add(parseInt(m[1]));
    }

    for (const num of postCitedNums) {
      const idx = num - 1;
      if (idx < 0 || idx >= selected.length) continue;
      const chunk = selected[idx];

      // Find the sentences containing [N] (abbreviation-safe: "Art. 21" is not a sentence end)
      for (const sentence of sentencesWithMarker(postGroundedAnswer, num)) {
        const meaningfulLen = sentence.replace(/\[\d+\]/g, "").replace(/[^a-zà-ÿ0-9]/gi, "").length;
        if (meaningfulLen < 30) continue;
        if (sentenceNamesArticleInChunk(sentence, chunk.content)) continue;
        if (!verifyCitationRelevance(sentence, chunk.content)) {
          console.log(
            `Orphan citation removed: [${num}] not relevant to sentence "${
              sentence.substring(0, 80)
            }..."`,
          );
          // Only this sentence loses the marker: the same [N] may be correct elsewhere.
          const cleaned = sentence.replace(new RegExp(`\\s*\\[${num}\\]`, "g"), "");
          postGroundedAnswer = postGroundedAnswer.replace(sentence, cleaned);
        }
      }
    }

    // Clean up artifacts
    postGroundedAnswer = tidyAfterMarkerRemoval(postGroundedAnswer);

    // ── Step 10: Build verified citations ────────────────────────────
    const citedNumbers = new Set<number>();
    for (const m of postGroundedAnswer.matchAll(/\[(\d+)\]/g)) {
      citedNumbers.add(parseInt(m[1]));
    }

    const citations: any[] = [];
    for (const num of citedNumbers) {
      const idx = num - 1;
      if (idx < 0 || idx >= selected.length) continue;
      const chunk = selected[idx];
      const doc = docMap.get(chunk.document_id);
      if (!doc) continue;

      const refs = extractChunkReferences(chunk.content);
      const verifiedRefs = refs.filter((ref) =>
        verifyArticleInChunk(chunk.content, ref)
      );

      // Fix 1: Match the article the LLM intended for this [N]
      const intendedArticle = extractCitedArticleForNumber(
        postGroundedAnswer,
        num,
      );
      let articleReference: string | null = null;
      let citedForArticle: string | null = null;

      const ownReference = chunkOwnReference(chunk.content);
      if (intendedArticle) {
        // Check if the intended article actually exists in the chunk
        if (articleExistsInChunk(chunk.content, intendedArticle)) {
          articleReference = ownReference || `Articolo ${intendedArticle}`;
          citedForArticle = `Articolo ${intendedArticle}`;
        } else {
          // Intended article not in chunk — fallback to the chunk's own reference
          articleReference = ownReference || (verifiedRefs.length > 0 ? verifiedRefs[0] : null);
          citedForArticle =
            `Articolo ${intendedArticle} (non verificato nel chunk)`;
        }
      } else {
        articleReference = ownReference || (verifiedRefs.length > 0 ? verifiedRefs[0] : null);
        citedForArticle = null;
      }

      let structuralContext = extractStructuralContext(chunk.content);
      if (!structuralContext) {
        const neighborChunks = selected.filter(
          (c) =>
            c.document_id === chunk.document_id &&
            c.id !== chunk.id &&
            Math.abs((c.start_pos || 0) - (chunk.start_pos || 0)) < 5000,
        );
        for (const neighbor of neighborChunks) {
          structuralContext = extractStructuralContext(neighbor.content);
          if (structuralContext) break;
        }
      }

      citations.push({
        citation_number: num,
        document_id: chunk.document_id,
        document_title: doc.title,
        document_version: doc.version,
        source_url: doc.source_url,
        chunk_content: chunk.content,
        article_reference: articleReference,
        cited_for_article: citedForArticle,
        all_references: verifiedRefs.slice(0, 8),
        structural_context: structuralContext,
        start_pos: chunk.start_pos || 0,
        end_pos: chunk.end_pos || 0,
      });
    }
    citations.sort((a, b) => a.citation_number - b.citation_number);

    console.log(
      `Final: ${citations.length} verified citations, ${grounding.removedClaims.length} claims removed`,
    );

    // ── Step 10.5: Confidence Scoring ────────────────────────────────
    const relevantChunkCount = selected.length;
    const verifiedCitationCount = citations.length;
    const removedClaimsCount = grounding.removedClaims.length;

    // Score components (0-100)
    const chunkScore = Math.min(relevantChunkCount / 10, 1) * 40; // up to 40 pts for 10+ chunks
    const citationScore = Math.min(verifiedCitationCount / 5, 1) * 35; // up to 35 pts for 5+ citations
    const groundingPenalty = Math.min(removedClaimsCount * 10, 25); // lose up to 25 pts for removed claims

    const confidenceScore = Math.round(
      Math.max(
        0,
        Math.min(100, chunkScore + citationScore + (25 - groundingPenalty)),
      ),
    );
    const confidenceLevel = confidenceScore >= 65
      ? "high"
      : confidenceScore >= 35
      ? "medium"
      : "low";

    let confidenceExplanation = "";
    if (confidenceLevel === "high") {
      confidenceExplanation =
        `Risposta basata su ${relevantChunkCount} fonti pertinenti con ${verifiedCitationCount} citazioni verificate.`;
    } else if (confidenceLevel === "medium") {
      confidenceExplanation =
        `Documentazione parziale: ${relevantChunkCount} fonti trovate, ${verifiedCitationCount} citazioni verificate.`;
      if (removedClaimsCount > 0) {
        confidenceExplanation +=
          ` ${removedClaimsCount} affermazioni non verificabili rimosse.`;
      }
    } else {
      confidenceExplanation =
        `Documentazione limitata: solo ${relevantChunkCount} fonti trovate, ${verifiedCitationCount} citazioni verificate.`;
      if (removedClaimsCount > 0) {
        confidenceExplanation += ` ${removedClaimsCount} affermazioni rimosse.`;
      }
    }

    // Append low-confidence warning to answer
    let outputAnswer = postGroundedAnswer;
    if (confidenceLevel === "low") {
      outputAnswer +=
        "\n\n⚠️ **Attenzione**: la documentazione disponibile su questo tema è limitata. Si consiglia di verificare con le fonti ufficiali.";
    }

    console.log(
      `Confidence: ${confidenceLevel} (${confidenceScore}/100) - ${confidenceExplanation}`,
    );

    // ── Step 11: Log query ───────────────────────────────────────────
    const { data: authUser } = await supabase.auth.getUser(
      req.headers.get("Authorization")?.replace("Bearer ", "") || "",
    );
    const isAnonymous = (authUser?.user as any)?.is_anonymous === true ||
      !authUser?.user?.email;
    // Conserva le chat nell'audit log per ogni utente autenticato, demo comprese:
    // le righe delle demo vengono eliminate a cascata quando scade l'utente demo.
    let queryLogId: string | null = null;
    if (authUser?.user && !isAnonymous) {
      const { data: logRow, error: logError } = await supabase.from("query_log").insert({
        user_id: authUser.user.id,
        question,
        answer: outputAnswer,
        model: getAIModel(),
        latency_ms: latencyMs,
        citations,
      }).select("id").single();
      if (logError) {
        console.error("query_log insert failed:", logError.message);
      } else {
        queryLogId = logRow?.id ?? null;
      }
    } else {
      console.warn("query_log skipped: no authenticated user on request");
    }

    // ── Step 12: Build allContextChunks from ALL selected chunks ───
    const citedChunkIndices = new Set(
      citations.map((c: any) => c.citation_number - 1),
    );
    const allContextChunks = selected.map((chunk, idx) => {
      const doc = docMap.get(chunk.document_id);
      const refs = extractChunkReferences(chunk.content);
      const verifiedRefs = refs.filter((ref) =>
        verifyArticleInChunk(chunk.content, ref)
      );
      let structuralContext = extractStructuralContext(chunk.content);
      if (!structuralContext) {
        const neighborChunks = selected.filter(
          (c) =>
            c.document_id === chunk.document_id && c.id !== chunk.id &&
            Math.abs((c.start_pos || 0) - (chunk.start_pos || 0)) < 5000,
        );
        for (const neighbor of neighborChunks) {
          structuralContext = extractStructuralContext(neighbor.content);
          if (structuralContext) break;
        }
      }

      // Find the matching citation to get cited_for_article
      const matchingCitation = citations.find((c: any) =>
        c.citation_number === idx + 1
      );

      return {
        citation_number: idx + 1,
        document_id: chunk.document_id,
        document_title: doc?.title || "Documento sconosciuto",
        document_version: doc?.version || "",
        source_url: doc?.source_url || null,
        chunk_content: chunk.content,
        article_reference: matchingCitation?.article_reference ||
          chunkOwnReference(chunk.content) ||
          (verifiedRefs.length > 0 ? verifiedRefs[0] : null),
        cited_for_article: matchingCitation?.cited_for_article || null,
        all_references: verifiedRefs.slice(0, 8),
        structural_context: structuralContext,
        start_pos: chunk.start_pos || 0,
        end_pos: chunk.end_pos || 0,
        explicitly_cited: citedChunkIndices.has(idx),
      };
    });

    // Keep the source list honest: cited sections, plus a few uncited sections of the same
    // documents (never other regulations), and only a handful when nothing was cited.
    const citedDocIds = new Set(citations.map((c: any) => c.document_id));
    const MAX_UNCITED_CONTEXT = 6;
    let uncitedKept = 0;
    const trimmedContextChunks = allContextChunks.filter((c: any) => {
      if (c.explicitly_cited) return true;
      if (citedDocIds.size > 0 && !citedDocIds.has(c.document_id)) return false;
      if (uncitedKept >= MAX_UNCITED_CONTEXT) return false;
      uncitedKept++;
      return true;
    });

    // ── Step 13: Return response ────────────────────────────────────
    return new Response(
      JSON.stringify({
        answer: outputAnswer,
        queryLogId,
        goal: activeGoal,
        nextAction,
        citations,
        allContextChunks: trimmedContextChunks,
        relevantChunks: selected.length,
        groundingReport: {
          removedClaims: grounding.removedClaims.length,
          verifiedCitations: citations.length,
        },
        confidence: {
          level: confidenceLevel,
          score: confidenceScore,
          explanation: confidenceExplanation,
        },
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (error) {
    console.error("RAG query error:", error);
    const errorMessage =
      error instanceof Error && error.message.includes("Invalid")
        ? error.message
        : "An error occurred processing your request. Please try again.";
    return new Response(
      JSON.stringify({
        answer: `⚠️ **Errore temporaneo del RAG**\n\n${errorMessage}`,
        citations: [],
        error: errorMessage,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  }
}, false, true));
