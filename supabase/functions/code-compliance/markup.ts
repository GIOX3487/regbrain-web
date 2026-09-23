// Regole che leggono un file intero invece di una riga: servono quando un tag HTML o JSX
// occupa più righe, quando un'etichetta sta altrove nel file, o quando un valore preso dalla
// richiesta viene usato qualche riga più in basso. Il lettore di tag è volutamente semplice:
// riconosce i tag di apertura con gli attributi (anche con espressioni JSX tra graffe) e il
// testo che segue fino alla chiusura. Non è un parser completo e non pretende di esserlo:
// dove non è sicuro, tace.

export interface FileHit { line: number; note?: string; risk?: "high" | "medium" | "low" }

export interface Tag {
  name: string;
  /** Attributi con valore grezzo (senza virgolette); un attributo booleano vale "". */
  attrs: Record<string, string>;
  start: number;
  end: number;
  selfClosing: boolean;
  line: number;
}

const VOID = new Set(["img", "input", "br", "hr", "meta", "link", "source", "track", "area", "base", "col", "embed", "param", "wbr"]);

/** Riga (1-based) in cui cade un offset. */
export function lineAt(content: string, offset: number, lineStarts?: number[]): number {
  const starts = lineStarts || lineStartsOf(content);
  let lo = 0, hi = starts.length - 1;
  while (lo < hi) {
    const mid = (lo + hi + 1) >> 1;
    if (starts[mid] <= offset) lo = mid; else hi = mid - 1;
  }
  return lo + 1;
}

export function lineStartsOf(content: string): number[] {
  const starts = [0];
  for (let i = 0; i < content.length; i++) if (content.charCodeAt(i) === 10) starts.push(i + 1);
  return starts;
}

const tagCache = new Map<string, Tag[]>();

/** Tag di apertura del file, nell'ordine in cui compaiono. I commenti HTML e JSX vengono saltati. */
export function readTags(content: string): Tag[] {
  const cached = tagCache.get(content);
  if (cached) return cached;
  if (tagCache.size > 64) tagCache.clear();
  const tags = readTagsUncached(content);
  tagCache.set(content, tags);
  return tags;
}

function readTagsUncached(content: string): Tag[] {
  const tags: Tag[] = [];
  const starts = lineStartsOf(content);
  const n = content.length;
  let i = 0;
  while (i < n) {
    const lt = content.indexOf("<", i);
    if (lt < 0) break;
    // Commento HTML.
    if (content.startsWith("<!--", lt)) {
      const close = content.indexOf("-->", lt + 4);
      i = close < 0 ? n : close + 3;
      continue;
    }
    const m = /^<([A-Za-z][\w.:-]*)/.exec(content.slice(lt, lt + 80));
    if (!m) { i = lt + 1; continue; }
    const name = m[1];
    let j = lt + 1 + name.length;
    // Attributi: si avanza fino a ">" fuori da virgolette e graffe.
    let depth = 0, quote = "";
    const attrStart = j;
    while (j < n) {
      const c = content[j];
      if (quote) { if (c === quote && content[j - 1] !== "\\") quote = ""; j++; continue; }
      if (c === '"' || c === "'") { quote = c; j++; continue; }
      if (c === "`" ) { quote = c; j++; continue; }
      if (c === "{") { depth++; j++; continue; }
      if (c === "}") { if (depth > 0) depth--; j++; continue; }
      if (c === ">" && depth === 0) break;
      if (c === "<" && depth === 0 && /[A-Za-z/!]/.test(content[j + 1] || "")) break; // tag rotto: si riparte da qui
      j++;
    }
    if (j >= n || content[j] !== ">") { i = lt + 1; continue; }
    if (j - lt > 4000) { i = j + 1; continue; }
    const raw = content.slice(attrStart, j);
    const selfClosing = /\/\s*$/.test(raw) || VOID.has(name.toLowerCase());
    tags.push({ name, attrs: parseAttrs(raw.replace(/\/\s*$/, "")), start: lt, end: j + 1, selfClosing, line: lineAt(content, lt, starts) });
    i = j + 1;
  }
  return tags;
}

function parseAttrs(raw: string): Record<string, string> {
  const attrs: Record<string, string> = {};
  const re = /([@:#.\w-]+)(?:\s*=\s*("([^"]*)"|'([^']*)'|\{((?:[^{}]|\{[^{}]*\})*)\}|([^\s"'{}>]+)))?/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(raw))) {
    const key = m[1].toLowerCase();
    if (key === "/" ) continue;
    attrs[key] = m[3] ?? m[4] ?? m[5] ?? m[6] ?? "";
  }
  return attrs;
}

/** Testo (senza tag) tra la fine di un tag di apertura e la sua chiusura, con un limite di lunghezza. */
export function innerText(content: string, tag: Tag): { text: string; html: string } {
  if (tag.selfClosing) return { text: "", html: "" };
  const close = new RegExp(`</${tag.name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\s*>`, "i");
  const rest = content.slice(tag.end, tag.end + 1500);
  const m = close.exec(rest);
  const html = m ? rest.slice(0, m.index) : rest.slice(0, 400);
  const text = html.replace(/<[^>]*>/g, " ").replace(/\{[^}]*\}/g, (e) => (/['"`][^'"`]{2,}['"`]/.test(e) || /\bt\(|i18n|translate|intl|formatMessage/.test(e) ? " testo " : " ")).replace(/&\w+;|&#\d+;/g, " ").replace(/\s+/g, " ").trim();
  return { text, html };
}

const hasAny = (attrs: Record<string, string>, keys: string[]) => keys.some((k) => k in attrs);
const ARIA_NAME = ["aria-label", "aria-labelledby", "title", ":aria-label", "v-bind:aria-label", "[attr.aria-label]", "arialabel"];
const isMarkupFile = (f: string) => /\.(html?|jsx|tsx|vue|svelte|astro|php|erb|hbs|ejs|twig|cshtml|razor)$/i.test(f);
const isFullDocument = (content: string) => /<html\b/i.test(content) && /<head\b/i.test(content);
const isTemplateComponent = (name: string) => /^[A-Z]/.test(name);

/** ACC-03: campo di modulo senza etichetta accessibile. */
export function unlabeledFields(content: string, file: string): FileHit[] {
  if (!isMarkupFile(file)) return [];
  const tags = readTags(content);
  const labelFor = new Set<string>();
  for (const t of tags) if (t.name === "label" && (t.attrs["for"] || t.attrs["htmlfor"])) labelFor.add((t.attrs["for"] || t.attrs["htmlfor"]).replace(/[{}'"]/g, ""));
  const hits: FileHit[] = [];
  let labelOpen = 0;
  // Si scorre in ordine per sapere se il campo sta dentro un <label>.
  const closes = [...content.matchAll(/<\/label\s*>/gi)].map((m) => m.index!);
  let ci = 0;
  for (const t of tags) {
    while (ci < closes.length && closes[ci] < t.start) { if (labelOpen > 0) labelOpen--; ci++; }
    const name = t.name;
    if (name === "label") { if (!t.selfClosing) labelOpen++; continue; }
    if (!["input", "select", "textarea"].includes(name)) continue; // solo elementi nativi, non componenti
    const type = (t.attrs["type"] || "text").toLowerCase();
    if (["hidden", "submit", "button", "reset", "image"].includes(type)) continue;
    if (labelOpen > 0) continue;
    if (hasAny(t.attrs, ARIA_NAME)) continue;
    // Angular Material: l'etichetta è <mat-label> dentro <mat-form-field>.
    if (("matinput" in t.attrs || "matnativecontrol" in t.attrs) && /<mat-label\b/i.test(content)) continue;
    const id = (t.attrs["id"] || "").replace(/[{}'"]/g, "");
    if (id && (labelFor.has(id) || /[{$]/.test(t.attrs["id"] || ""))) continue; // id dinamico: non si può sapere
    if (/\{\.\.\./.test(Object.keys(t.attrs).join(" "))) continue; // {...props}: l'etichetta può arrivare da fuori
    if (Object.keys(t.attrs).some((k) => k.startsWith("{"))) continue;
    hits.push({ line: t.line, note: `<${name}${t.attrs["name"] ? ` name="${t.attrs["name"].slice(0, 30)}"` : ""}> senza etichetta` });
  }
  return hits;
}

/** ACC-04: pulsanti e link senza nome accessibile, link senza destinazione. */
export function unnamedControls(content: string, file: string): FileHit[] {
  if (!isMarkupFile(file)) return [];
  const hits: FileHit[] = [];
  for (const t of readTags(content)) {
    const name = t.name;
    if (name !== "button" && name !== "a") continue; // solo elementi nativi
    if (hasAny(t.attrs, ARIA_NAME)) continue;
    if (Object.keys(t.attrs).some((k) => k.startsWith("{"))) continue;
    if (name === "a" && !("href" in t.attrs) && !("[href]" in t.attrs) && !(":href" in t.attrs) && !("routerlink" in t.attrs) && !("to" in t.attrs) && !("xlink:href" in t.attrs)) {
      if ("onclick" in t.attrs || "@click" in t.attrs || "(click)" in t.attrs || "v-on:click" in t.attrs) hits.push({ line: t.line, note: "<a> senza href usato come pulsante: non raggiungibile da tastiera" });
      continue;
    }
    const { text, html } = innerText(content, t);
    if (text.length > 0) continue;
    // Contenuto solo grafico: icona, svg o immagine senza testo alternativo.
    const inner = readTags(html);
    const named = inner.some((c) => hasAny(c.attrs, ARIA_NAME) || (c.name.toLowerCase() === "img" && (c.attrs["alt"] || "").trim().length > 0) || ("children" in c.attrs));
    if (named) continue;
    if (/\{[^}]*\}/.test(html) && !/<(svg|i|span|img|[A-Z]\w*Icon|Icon)\b/.test(html)) continue; // contenuto dinamico non leggibile
    if (html.trim() === "" && t.selfClosing) continue;
    hits.push({ line: t.line, note: `<${name}> senza testo né aria-label` });
  }
  return hits;
}

/** ACC-05: focus visivo rimosso (outline: none su :focus) senza un'alternativa. */
export function focusRemoved(content: string, file: string): FileHit[] {
  const hits: FileHit[] = [];
  // Fogli di stile di terze parti: non sono codice dell'applicazione.
  if (/(^|\/)(vendor|vendors|lib|libs|assets\/vendor|node_modules)\/|bootstrap|normalize|reset\.css|foundation|bulma|\.min\.css$/i.test(file)) return [];
  const starts = lineStartsOf(content);
  if (/\.(css|scss|sass|less|styl)$/i.test(file) || /<style\b/i.test(content)) {
    // Scansione lineare dei blocchi { }: il selettore è il testo tra la chiusura precedente e la graffa.
    let pos = 0;
    while (pos < content.length) {
      const open = content.indexOf("{", pos);
      if (open < 0) break;
      const close = content.indexOf("}", open + 1);
      if (close < 0) break;
      const selectorStart = Math.max(content.lastIndexOf("}", open), content.lastIndexOf(";", open) < content.lastIndexOf("}", open) ? -1 : content.lastIndexOf("}", open)) + 1;
      const selector = content.slice(selectorStart, open).split(/[}]/).pop() || "";
      const body = content.slice(open + 1, close);
      pos = close + 1;
      if (!/:focus(-visible|-within)?\b/.test(selector) || selector.length > 400) continue;
      if (!/outline\s*:\s*(none|0)(px)?\s*(!important)?\s*;?/i.test(body)) continue;
      if (/(box-shadow|border(-color)?|background|ring|outline\s*:\s*[1-9])/i.test(body)) continue;
      hits.push({ line: lineAt(content, open, starts), note: `${selector.trim().replace(/\s+/g, " ").slice(0, 40)} { outline: none }` });
    }
  }
  if (/\.(jsx|tsx|html?|vue|svelte|astro)$/i.test(file)) {
    const re = /class(Name)?\s*=\s*["'`{][^"'`}]*\bfocus(-visible)?:outline-none\b[^"'`}]*["'`}]/g;
    let m: RegExpExecArray | null;
    while ((m = re.exec(content))) {
      if (/focus(-visible)?:(ring|border|shadow|bg|outline-[1-9]|outline-\w+-\d)/.test(m[0])) continue;
      hits.push({ line: lineAt(content, m.index, starts), note: "focus:outline-none senza focus:ring o simile" });
    }
  }
  return hits;
}

/** ACC-06: documento HTML senza <title>. */
export function missingTitle(content: string, file: string): FileHit[] {
  if (!/\.(html?|php|erb|ejs|hbs|twig|cshtml)$/i.test(file) || !isFullDocument(content)) return [];
  if (/<title\b/i.test(content) || /<%|\{\{|@yield|@section|\{%/.test(content.slice(0, 4000))) return []; // template: il titolo può arrivare dal layout
  const m = /<head\b/i.exec(content);
  return [{ line: lineAt(content, m ? m.index : 0), note: "manca <title>" }];
}

/** ACC-07: audio o video in riproduzione automatica senza controlli. */
export function autoplayMedia(content: string, file: string): FileHit[] {
  if (!isMarkupFile(file)) return [];
  const hits: FileHit[] = [];
  for (const t of readTags(content)) {
    const name = t.name;
    if (name !== "video" && name !== "audio") continue;
    if (!("autoplay" in t.attrs)) continue;
    if ("controls" in t.attrs) continue;
    const muted = "muted" in t.attrs;
    hits.push({ line: t.line, risk: muted ? "low" : "medium", note: muted ? `<${name}> autoplay senza controlli (muto: resta il movimento da poter fermare)` : `<${name}> autoplay con audio e senza controlli` });
  }
  return hits;
}

/** ACC-08: elementi non nativi resi cliccabili senza ruolo né tastiera; tabindex positivo. */
export function clickableWithoutRole(content: string, file: string): FileHit[] {
  if (!isMarkupFile(file)) return [];
  const hits: FileHit[] = [];
  for (const t of readTags(content)) {
    const name = t.name;
    const tab = t.attrs["tabindex"];
    if (tab !== undefined && /^\d+$/.test(tab) && Number(tab) > 0) hits.push({ line: t.line, risk: "low", note: `tabindex="${tab}": ordine di tabulazione forzato` });
    if (!["div", "span", "li", "td", "tr", "p", "img", "svg", "section"].includes(name)) continue;
    const clickable = ["onclick", "@click", "(click)", "v-on:click", "on:click"].some((k) => k in t.attrs);
    if (!clickable) continue;
    if ("role" in t.attrs || "tabindex" in t.attrs || hasAny(t.attrs, ["onkeydown", "onkeyup", "onkeypress", "@keydown", "(keydown)"])) continue;
    hits.push({ line: t.line, risk: "low", note: `<${name}> con click ma senza ruolo né tastiera` });
  }
  return hits;
}

/**
 * SEC-13 su più righe: un valore preso dalla richiesta assegnato a una variabile e usato in un
 * percorso di file entro poche righe, senza normalizzazione.
 */
export function pathFromRequestAcrossLines(content: string, file: string, userInput: RegExp, fileOp: RegExp, guard: RegExp): FileHit[] {
  if (!/\.(js|jsx|ts|tsx|mjs|cjs|py|php|rb|go|java|cs)$/i.test(file)) return [];
  const lines = content.split(/\r?\n/);
  const hits: FileHit[] = [];
  const assign = /(?:const|let|var|\$)?\s*([A-Za-z_$][\w$]*)\s*(?::\s*\w+)?\s*=\s*([^=\n][^\n]*)/;
  for (let i = 0; i < lines.length; i++) {
    const a = assign.exec(lines[i]);
    if (!a || !userInput.test(a[2])) continue;
    if (guard.test(a[2]) || /(basename|sanitize|normalize|realpath|secure_filename|\.replace\(|parseInt|Number\(|\|\s*0|toLowerCase\(\)\.replace)/i.test(a[2])) continue;
    const v = a[1];
    if (v.length < 2 || /^(req|res|request|response|ctx|body|params|query)$/.test(v)) continue;
    const use = new RegExp(`(^|[^\\w$.])${v.replace(/\$/g, "\\$")}([^\\w$]|$)`);
    for (let j = i + 1; j <= Math.min(i + 10, lines.length - 1); j++) {
      const l = lines[j];
      if (!use.test(l)) continue;
      if (guard.test(l) || /(basename|sanitize|normalize|realpath|secure_filename|\.replace\(|\.match\(|test\(|includes\(['"]\.\.|allow|whitelist|indexOf\(['"]\.\.)/i.test(l)) break;
      if (fileOp.test(l)) { hits.push({ line: j + 1, note: `"${v}" arriva dalla richiesta (riga ${i + 1}) e finisce in un percorso di file` }); break; }
    }
  }
  return hits;
}

/**
 * SEC-11 su più righe: un token solo decodificato (jwt.decode) assegnato a una variabile da cui
 * entro poche righe si leggono identità o ruolo, senza che nel mezzo compaia una verifica.
 */
export function decodedTokenTrusted(content: string, file: string): FileHit[] {
  if (!/\.(js|jsx|ts|tsx|mjs|cjs|py|php|rb|go|java|cs)$/i.test(file)) return [];
  const lines = content.split(/\r?\n/);
  const hits: FileHit[] = [];
  const assign = /(?:const|let|var|\$)?\s*([A-Za-z_$][\w$]*)\s*(?::\s*\w+)?\s*=\s*(?:await\s+)?(?:jwt|jsonwebtoken|jose|this\.jwt|jwtDecode)\.?(?:decode|decodeJwt)\s*\(/;
  for (let i = 0; i < lines.length; i++) {
    const a = assign.exec(lines[i]);
    if (!a) continue;
    if (/verify|complete\s*:\s*true/.test(lines[i])) continue; // header letto per scegliere la chiave: uso legittimo
    const v = a[1];
    const use = new RegExp(`(^|[^\\w$.])${v.replace(/\$/g, "\\$")}(\\??\\.|\\[)\\s*['"]?(userId|user_id|uid|sub|id|role|roles|ruolo|ruoli|isAdmin|is_admin|admin|permissions|permessi|email|tenant|org|scope)\\b`);
    for (let j = i; j <= Math.min(i + 6, lines.length - 1); j++) {
      if (j > i && /verify|verifica|jwtVerify|checkSignature/.test(lines[j])) break;
      if (use.test(lines[j])) { hits.push({ line: j + 1, note: `"${v}" è un token solo decodificato (riga ${i + 1}): identità o ruolo letti senza verifica della firma` }); break; }
    }
  }
  return hits;
}

