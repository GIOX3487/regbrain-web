import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

// ─────────────────────────────────────────────────────────────────────────────
// Catalogo atti EU (CELEX consolidati verificati)
// ─────────────────────────────────────────────────────────────────────────────

interface ActSpec {
  regulation: string;
  shortName: string;
  celexBase: string;
  celexConsolidated: string;
  validFrom: string;
  validTo: string | null;
  title: string;
}

const ACTS: Record<string, ActSpec> = {
  GDPR: {
    regulation: "GDPR",
    shortName: "GDPR",
    celexBase: "32016R0679",
    celexConsolidated: "02016R0679-20160504",
    validFrom: "2016-05-04",
    validTo: null,
    title: "GDPR - Regolamento UE 2016/679",
  },
  NIS2: {
    regulation: "NIS2",
    shortName: "NIS2",
    celexBase: "32022L2555",
    celexConsolidated: "02022L2555-20221227",
    validFrom: "2022-12-27",
    validTo: null,
    title: "NIS2 - Direttiva UE 2022/2555",
  },
  DORA: {
    regulation: "DORA",
    shortName: "DORA",
    celexBase: "32022R2554",
    celexConsolidated: "32022R2554",
    validFrom: "2022-12-27",
    validTo: null,
    title: "DORA - Regolamento UE 2022/2554",
  },
  AI_ACT: {
    regulation: "AI_ACT",
    shortName: "AI Act",
    celexBase: "32024R1689",
    celexConsolidated: "02024R1689-20260727",
    validFrom: "2024-07-12",
    validTo: null,
    title: "AI Act - Regolamento UE 2024/1689",
  },
  CRA: {
    regulation: "CRA",
    shortName: "CRA",
    celexBase: "32024R2847",
    celexConsolidated: "02024R2847-20241120",
    validFrom: "2024-11-20",
    validTo: null,
    title: "CRA - Regolamento UE 2024/2847",
  },
};

// ─────────────────────────────────────────────────────────────────────────────
// Download Formex (Cellar API)
// ─────────────────────────────────────────────────────────────────────────────

async function unzipEntriesAsync(
  data: Uint8Array,
): Promise<Array<[string, string]>> {
  const dv = new DataView(data.buffer, data.byteOffset, data.byteLength);
  const decoder = new TextDecoder("utf-8");
  const out: Array<[string, string]> = [];
  let i = 0;
  while (i < data.length - 4) {
    const sig = dv.getUint32(i, true);
    if (sig !== 0x04034b50) break;
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
    if (method === 0) {
      text = decoder.decode(slice);
    } else {
      const ds = new DecompressionStream("deflate-raw");
      const stream = new Blob([slice]).stream().pipeThrough(ds);
      text = await new Response(stream).text();
    }
    out.push([name, text]);
    i = start + compSize;
    if (i < data.length - 4 && dv.getUint32(i, true) === 0x08074b50) i += 16;
  }
  return out;
}

async function fetchFormex(celex: string, lang: string): Promise<string> {
  const acceptLang = lang === "EN" ? "eng" : "ita";
  const res = await fetch(
    `http://publications.europa.eu/resource/celex/${celex}`,
    {
      headers: {
        "Accept": "application/zip;mtype=fmx4",
        "Accept-Language": acceptLang,
        "User-Agent": "RegBrain-ingestion/1.0",
      },
    },
  );
  if (!res.ok) throw new Error(`Cellar ${celex} → HTTP ${res.status}`);
  const buf = new Uint8Array(await res.arrayBuffer());
  const files = await unzipEntriesAsync(buf);
  let best = "";
  for (const [name, content] of files) {
    if (!name.toLowerCase().endsWith(".xml")) continue;
    if (name.includes(".doc.xml")) continue;
    if (content.includes("<ARTICLE") && content.length > best.length) {
      best = content;
    }
  }
  if (!best) {
    for (const [name, content] of files) {
      if (name.toLowerCase().endsWith(".xml") && content.length > best.length) {
        best = content;
      }
    }
  }
  if (!best) throw new Error(`Nessun XML Formex trovato per ${celex}`);
  return best;
}

// ─────────────────────────────────────────────────────────────────────────────
// Parsing Formex → unità citabili
// ─────────────────────────────────────────────────────────────────────────────

function decodeEntities(s: string): string {
  return s
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#x([0-9a-fA-F]+);/g, (_m, h) =>
      String.fromCodePoint(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_m, d) => String.fromCodePoint(parseInt(d, 10)))
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&");
}

/** Estrae testo leggibile da un frammento Formex preservando le lettere a), b), c). */
function xmlToText(fragment: string): string {
  let s = fragment;
  // Elementi di lista: nuova riga prima di ogni voce
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
  const buf = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(text),
  );
  return Array.from(new Uint8Array(buf)).map((b) =>
    b.toString(16).padStart(2, "0")
  ).join("");
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
  const re =
    /(?:articolo|art\.)\s+(\d+)(?:\s*,\s*(?:paragrafo|par\.)\s*(\d+))?/gi;
  let m;
  while ((m = re.exec(text)) !== null) {
    refs.add(m[2] ? `art${m[1]}:par${m[2]}` : `art${m[1]}`);
  }
  return [...refs].slice(0, 20);
}

function parseFormex(xml: string, act: ActSpec, lang: string): Unit[] {
  const units: Unit[] = [];
  const vers = act.celexConsolidated;
  const keyBase = `eu:${vers}:${lang.toLowerCase()}`;

  // Gerarchia: traccia TITOLO / CAPO / SEZIONE incontrati prima di ogni articolo
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
    if (level >= 0) {
      hierarchyAt.push({ pos: tm.index, label: txt.substring(0, 90), level });
    }
  }
  const hierarchyFor = (pos: number): string | null => {
    const parts: string[] = [];
    for (const level of [0, 1, 2]) {
      const found = [...hierarchyAt].filter((h) =>
        h.level === level && h.pos < pos
      ).pop();
      if (found) parts.push(found.label);
    }
    return parts.length ? parts.join(" > ") : null;
  };

  // ── Considerando ──
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
      context_header: `[${label}]`,
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

  // ── Articoli ──
  const artRe = /<ARTICLE\b[^>]*>([\s\S]*?)<\/ARTICLE>/g;
  let am;
  while ((am = artRe.exec(xml)) !== null) {
    const inner = am[1];
    const tiMatch = inner.match(/<TI\.ART>([\s\S]*?)<\/TI\.ART>/);
    const stiMatch = inner.match(/<STI\.ART>([\s\S]*?)<\/STI\.ART>/);
    const tiText = tiMatch ? xmlToText(tiMatch[1]) : "";
    const rubric = stiMatch ? xmlToText(stiMatch[1]).replace(/\n+/g, " ") : "";
    const numMatch = tiText.match(/(\d+)\s*(bis|ter|quater)?/i);
    if (!numMatch) continue;
    const artNum = parseInt(numMatch[1], 10);
    const suffix = numMatch[2] ? ` ${numMatch[2].toLowerCase()}` : "";
    const hierarchy = hierarchyFor(am.index);
    const artRef = `Art. ${artNum}${suffix}`;

    const parags = [
      ...inner.matchAll(/<PARAG\b[^>]*>([\s\S]*?)<\/PARAG>/g),
    ];

    if (parags.length === 0) {
      const body = xmlToText(
        inner
          .replace(/<TI\.ART>[\s\S]*?<\/TI\.ART>/, "")
          .replace(/<STI\.ART>[\s\S]*?<\/STI\.ART>/, ""),
      );
      if (body.length < 15) continue;
      const label = `${act.shortName}, art. ${artNum}${suffix}`;
      units.push({
        chunk_key: `${keyBase}:art${artNum}${suffix.trim()}`,
        citation_label: label,
        context_header: `[${act.shortName}, ${vers}, vigente.${
          hierarchy ? " " + hierarchy + "." : ""
        } Art. ${artNum}${suffix}${rubric ? ": " + rubric : ""}]`,
        unit_type: "articolo",
        article_number: artNum,
        article_reference: artRef,
        paragraph: null,
        letter: null,
        section_hierarchy: hierarchy,
        text: `${tiText}${rubric ? " — " + rubric : ""}\n${body}`,
        cross_references: extractCrossRefs(body),
        is_obligation: OBLIGATION_RE.test(body),
      });
      continue;
    }

    for (const pm of parags) {
      const pInner = pm[1];
      const noParag = pInner.match(/<NO\.PARAG>\s*([^<]*?)\s*<\/NO\.PARAG>/);
      const parNumRaw = noParag ? noParag[1].replace(/[.)]/g, "").trim() : "";
      const parNum = parNumRaw || String(parags.indexOf(pm) + 1);
      const body = xmlToText(
        pInner.replace(/<NO\.PARAG>[\s\S]*?<\/NO\.PARAG>/, ""),
      );
      if (body.length < 15) continue;
      const label = `${act.shortName}, art. ${artNum}${suffix}, par. ${parNum}`;
      units.push({
        chunk_key: `${keyBase}:art${artNum}${suffix.trim()}:par${parNum}`,
        citation_label: label,
        context_header: `[${act.shortName}, ${vers}, vigente.${
          hierarchy ? " " + hierarchy + "." : ""
        } Art. ${artNum}${suffix}${
          rubric ? ": " + rubric : ""
        }. Par. ${parNum}]`,
        unit_type: "paragrafo",
        article_number: artNum,
        article_reference: artRef,
        paragraph: parNum,
        letter: null,
        section_hierarchy: hierarchy,
        text: body,
        cross_references: extractCrossRefs(body),
        is_obligation: OBLIGATION_RE.test(body),
      });
    }
  }

  // ── Allegati ──
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
    const annexTitle = [tiPart || `Allegato ${annexIdx}`, stiPart]
      .filter(Boolean).join(" — ");
    const fullText = xmlToText(inner);
    // Chunking per voce/riga per gli allegati tabellari (settori e soglie)
    const lines = fullText.split("\n");
    let buffer: string[] = [];
    let part = 0;
    const flush = () => {
      const text = buffer.join("\n").trim();
      buffer = [];
      if (text.length < 30) return;
      part++;
      const label = `${act.shortName}, ${annexTitle} (parte ${part})`;
      units.push({
        chunk_key: `${keyBase}:annex${annexIdx}:p${part}`,
        citation_label: label,
        context_header: `[${act.shortName}, ${vers}, vigente. ${annexTitle}]`,
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
      if (buffer.join("\n").length > 1400) flush();
    }
    flush();
  }

  return units;
}

// ─────────────────────────────────────────────────────────────────────────────
// Embedding
// ─────────────────────────────────────────────────────────────────────────────

async function embedDocument(
  geminiKey: string,
  text: string,
): Promise<number[] | null> {
  // Il gateway della piattaforma è la via primaria (quota più stabile)
  const gw = await embedViaGateway(text);
  if (gw) return gw;
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-embedding-001:embedContent?key=${geminiKey}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            model: "models/gemini-embedding-001",
            content: { parts: [{ text: text.substring(0, 8000) }] },
            taskType: "RETRIEVAL_DOCUMENT",
            outputDimensionality: 768,
          }),
        },
      );
      if (res.status === 429 || res.status >= 500) {
        console.warn(`[embed] retry status=${res.status} attempt=${attempt}`);
        await new Promise((r) => setTimeout(r, 2000 * (attempt + 1)));
        continue;
      }
      if (!res.ok) {
        console.error(
          `[embed] fail status=${res.status} ${(await res.text()).slice(0, 300)}`,
        );
        return null;
      }
      const data = await res.json();
      return data.embedding?.values ?? null;
    } catch (e) {
      console.warn(`[embed] error ${e instanceof Error ? e.message : e}`);
      await new Promise((r) => setTimeout(r, 1000 * (attempt + 1)));
    }
  }
  return null;
}

// Fallback: Lovable AI Gateway (stesso modello, 768 dimensioni)
async function embedViaGateway(text: string): Promise<number[] | null> {
  const key = Deno.env.get("LOVABLE_API_KEY");
  if (!key) return null;
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const res = await fetch("https://ai.gateway.lovable.dev/v1/embeddings", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${key}`,
        },
        body: JSON.stringify({
          model: "google/gemini-embedding-001",
          input: text.substring(0, 8000),
          dimensions: 768,
        }),
      });
      if (res.status === 429 || res.status >= 500) {
        await new Promise((r) => setTimeout(r, 2000 * (attempt + 1)));
        continue;
      }
      if (!res.ok) {
        console.error(
          `[embed-gw] fail status=${res.status} ${
            (await res.text()).slice(0, 300)
          }`,
        );
        return null;
      }
      const data = await res.json();
      const vec = data?.data?.[0]?.embedding;
      return Array.isArray(vec) ? vec : null;
    } catch (e) {
      console.warn(`[embed-gw] error ${e instanceof Error ? e.message : e}`);
      await new Promise((r) => setTimeout(r, 1000 * (attempt + 1)));
    }
  }
  return null;
}

// ─────────────────────────────────────────────────────────────────────────────

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Non autorizzato" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: userErr } = await userClient.auth.getUser();
    if (userErr || !user) {
      return new Response(JSON.stringify({ error: "Non autorizzato" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(supabaseUrl, serviceKey);
    const { data: isAdmin } = await supabase.rpc("has_role", {
      _user_id: user.id,
      _role: "admin",
    });
    // has_role è valutato rispetto ad auth.uid(); verifica diretta in tabella
    const { data: roleRow } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .eq("role", "admin")
      .maybeSingle();
    if (!roleRow && !isAdmin) {
      return new Response(
        JSON.stringify({ error: "Accesso riservato agli amministratori" }),
        {
          status: 403,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    const body = await req.json().catch(() => ({}));
    const regulation: string = (body.regulation ?? "GDPR").toUpperCase();
    const lang: string = (body.lang ?? "IT").toUpperCase();
    const offset: number = Number(body.offset ?? 0);
    const limit: number = Math.min(Number(body.limit ?? 80), 150);
    const dryRun: boolean = Boolean(body.dryRun);
    const repairEmbeddings: boolean = Boolean(body.repairEmbeddings);

    if (repairEmbeddings) {
      const svc = createClient(supabaseUrl, serviceKey);
      const { data: broken } = await svc
        .from("structured_chunks")
        .select("id, context_header, chunk_text")
        .eq("source_format", "formex")
        .is("embedding", null)
        .limit(40);
      let fixed = 0;
      for (const row of broken ?? []) {
        const vec = await embedDocument(
          Deno.env.get("GEMINI_API_KEY") ?? "",
          `${row.context_header ?? ""}\n${row.chunk_text}`,
        );
        if (!vec) continue;
        const { error } = await svc
          .from("structured_chunks")
          .update({ embedding: JSON.stringify(vec) })
          .eq("id", row.id);
        if (!error) fixed++;
      }
      return new Response(
        JSON.stringify({
          success: true,
          repairEmbeddings: true,
          candidates: broken?.length ?? 0,
          fixed,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const act = ACTS[regulation];
    if (!act) {
      return new Response(
        JSON.stringify({
          error: `Norma non in catalogo: ${regulation}`,
          available: Object.keys(ACTS),
        }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    const geminiKey = Deno.env.get("GEMINI_API_KEY");

    console.log(`[formex] ${regulation} ${lang} offset=${offset}`);
    let xml: string;
    try {
      xml = await fetchFormex(act.celexConsolidated, lang);
    } catch (e) {
      console.warn(
        `[formex] consolidata non disponibile (${act.celexConsolidated}), uso il testo base ${act.celexBase}`,
        e,
      );
      xml = await fetchFormex(act.celexBase, lang);
    }
    const units = parseFormex(xml, act, lang);
    console.log(`[formex] ${units.length} unità citabili estratte`);

    if (dryRun) {
      const withPar = units.filter((u) => u.paragraph).length;
      return new Response(
        JSON.stringify({
          success: true,
          dryRun: true,
          regulation,
          celex: act.celexConsolidated,
          totalUnits: units.length,
          paragraphUnits: withPar,
          articles: [...new Set(units.map((u) => u.article_number))].filter((
            n,
          ) => n !== null).length,
          annexUnits: units.filter((u) => u.unit_type === "allegato").length,
          recitalUnits: units.filter((u) => u.unit_type === "considerando")
            .length,
          sample: units.slice(0, 5).map((u) => ({
            chunk_key: u.chunk_key,
            citation_label: u.citation_label,
            context_header: u.context_header,
            preview: u.text.substring(0, 220),
          })),
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Documento contenitore
    const docTitle = `${act.title} (Formex ${act.celexConsolidated}, ${lang})`;
    let documentId: string;
    const { data: existingDoc } = await supabase
      .from("documents")
      .select("id")
      .eq("title", docTitle)
      .maybeSingle();
    if (existingDoc) {
      documentId = existingDoc.id;
    } else {
      const { data: newDoc, error: docErr } = await supabase
        .from("documents")
        .insert({
          title: docTitle,
          source_url:
            `https://eur-lex.europa.eu/legal-content/${lang}/TXT/?uri=CELEX:${act.celexConsolidated}`,
          jurisdiction: "EU",
          sector: "All",
          language: lang.toLowerCase(),
          version: act.celexConsolidated,
        })
        .select("id")
        .single();
      if (docErr) throw docErr;
      documentId = newDoc.id;
    }

    const slice = units.slice(offset, offset + limit);
    let inserted = 0;
    let embedded = 0;
    const rows: Record<string, unknown>[] = [];

    const CONCURRENCY = 6;
    for (let i = 0; i < slice.length; i += CONCURRENCY) {
      const group = slice.slice(i, i + CONCURRENCY);
      const built = await Promise.all(group.map(async (u) => {
        const embedInput = `${u.context_header}\n${u.text}`;
        const embedding = geminiKey
          ? await embedDocument(geminiKey, embedInput)
          : null;
        if (embedding) embedded++;
        return {
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
          celex: act.celexConsolidated,
          lang,
          valid_from: act.validFrom,
          valid_to: act.validTo,
          source_format: "formex",
          section_hierarchy: u.section_hierarchy,
          chunk_text: u.text,
          cross_references: u.cross_references,
          is_obligation: u.is_obligation,
          embedding: embedding ? JSON.stringify(embedding) : null,
        } as Record<string, unknown>;
      }));
      rows.push(...built);
    }

    // Deduplica per chunk_key (alcune unità Formex ripetono lo stesso riferimento)
    const seen = new Set<string>();
    for (let i = rows.length - 1; i >= 0; i--) {
      const k = rows[i].chunk_key as string;
      if (seen.has(k)) rows.splice(i, 1);
      else seen.add(k);
    }

    if (rows.length > 0) {
      const keys = rows.map((r) => r.chunk_key as string);
      await supabase.from("structured_chunks").delete().in("chunk_key", keys);
      for (let i = 0; i < rows.length; i += 20) {
        const batch = rows.slice(i, i + 20);
        const { error: insErr } = await supabase
          .from("structured_chunks")
          .insert(batch);
        if (insErr) {
          console.error("[formex] insert error", insErr);
          throw insErr;
        }
        inserted += batch.length;
      }
    }

    const nextOffset = offset + slice.length;
    const done = nextOffset >= units.length;

    return new Response(
      JSON.stringify({
        success: true,
        regulation,
        lang,
        celex: act.celexConsolidated,
        documentId,
        totalUnits: units.length,
        processed: slice.length,
        inserted,
        embedded,
        offset,
        nextOffset: done ? null : nextOffset,
        done,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e) {
    console.error("[formex] fatal", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : String(e) }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  }
});
