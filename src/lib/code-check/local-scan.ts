// Scansione nel browser di un'intera base di codice. Le regole sono le stesse della funzione
// edge (importate dallo stesso file): il codice resta sul computer dell'utente e al servizio
// arrivano solo esiti, inventario, contesto dedotto ed estratti mascherati.
import JSZip from "jszip";
import { scan, type Finding, type InputFile } from "../../../supabase/functions/code-compliance/scan.ts";
import { inferContext, type InferredContext } from "../../../supabase/functions/code-compliance/infer.ts";
import { buildExcerpts, type Excerpt } from "../../../supabase/functions/code-compliance/excerpts.ts";
import { RULES_VERSION } from "../../../supabase/functions/code-compliance/rules.ts";

export const CODE_EXTENSIONS = [
  ".js", ".jsx", ".ts", ".tsx", ".mjs", ".cjs", ".py", ".java", ".kt", ".kts", ".swift", ".go", ".rb", ".php", ".cs",
  ".c", ".cc", ".cpp", ".h", ".hpp", ".rs", ".scala", ".dart", ".html", ".htm", ".vue", ".svelte", ".astro", ".css", ".scss",
  ".sql", ".sh", ".bash", ".ps1", ".yml", ".yaml", ".json", ".xml", ".gradle", ".properties", ".toml", ".ini", ".cfg", ".conf",
  ".tf", ".txt", ".md", ".erb", ".ejs", ".hbs", ".twig", ".cshtml", ".plist", ".env.example", ".graphql", ".prisma", ".proto",
];
export const CODE_NAMES = ["Dockerfile", "Makefile", "Procfile", "Gemfile", ".htaccess", "nginx.conf", "Caddyfile", "LICENSE", "LICENCE", "COPYING"];
const IGNORED_DIRS = new Set([
  "node_modules", ".git", ".svn", ".hg", "dist", "build", "out", ".next", ".nuxt", ".output", ".svelte-kit", "vendor", "target", "bin", "obj",
  "coverage", "__pycache__", ".venv", "venv", "env", ".env", "Pods", "DerivedData", ".gradle", ".idea", ".vscode", ".terraform", ".cache",
  "storybook-static", ".turbo", ".parcel-cache", "bower_components", "jspm_packages", ".yarn", ".pnpm-store", "tmp", "temp", "logs",
]);
const IGNORED_FILES = /(\.min\.(js|css)|\.map|\.lock|-lock\.json|\.snap|\.d\.ts)$/i;

export const MAX_FILE_CHARS = 300_000;
export const MAX_FILES = 5000;

export interface CollectResult {
  /** Nome della cartella radice, quando c'è. */
  root?: string;
  files: InputFile[];
  skipped: { ignoredDirs: number; binary: number; tooLarge: number; notCode: number };
  chars: number;
}

export const isCodeFile = (name: string) => {
  const base = name.split("/").pop() || name;
  if (CODE_NAMES.includes(base)) return true;
  if (IGNORED_FILES.test(base)) return false;
  const lower = base.toLowerCase();
  return CODE_EXTENSIONS.some((ext) => lower.endsWith(ext));
};

const inIgnoredDir = (path: string) => path.split("/").slice(0, -1).some((seg) => IGNORED_DIRS.has(seg));

/** Legge una lista di File (input con webkitdirectory, o file singoli) e tiene solo il codice. */
export async function collectFiles(list: Iterable<File>, onProgress?: (done: number) => void): Promise<CollectResult> {
  const out: CollectResult = { files: [], skipped: { ignoredDirs: 0, binary: 0, tooLarge: 0, notCode: 0 }, chars: 0 };
  let done = 0;
  for (const file of list) {
    done++;
    if (onProgress && done % 50 === 0) onProgress(done);
    const rel = ((file as File & { webkitRelativePath?: string }).webkitRelativePath || file.name).replace(/^\/+/, "");
    const parts = rel.split("/");
    if (parts.length > 1 && !out.root) out.root = parts[0];
    const path = parts.length > 1 ? parts.slice(1).join("/") : rel; // togli la cartella radice
    if (inIgnoredDir(path)) { out.skipped.ignoredDirs++; continue; }
    if (!isCodeFile(path)) { out.skipped.notCode++; continue; }
    if (file.size > MAX_FILE_CHARS * 2) { out.skipped.tooLarge++; continue; }
    const text = await file.text();
    if (text.includes("\u0000")) { out.skipped.binary++; continue; }
    if (text.length > MAX_FILE_CHARS) { out.skipped.tooLarge++; continue; }
    if (!text.trim()) continue;
    out.files.push({ name: path, content: text });
    out.chars += text.length;
    if (out.files.length >= MAX_FILES) break;
  }
  return out;
}

/** Estrae un archivio zip (per esempio l'esportazione di GitHub) e tiene solo il codice. */
export async function collectZip(file: File, onProgress?: (done: number) => void): Promise<CollectResult> {
  const zip = await JSZip.loadAsync(file);
  const out: CollectResult = { files: [], skipped: { ignoredDirs: 0, binary: 0, tooLarge: 0, notCode: 0 }, chars: 0 };
  const entries = Object.values(zip.files).filter((e) => !e.dir);
  // GitHub mette tutto sotto una cartella "repo-main/": si toglie il primo segmento se è comune a tutti.
  const first = entries[0]?.name.split("/")[0];
  const common = first && entries.every((e) => e.name.startsWith(first + "/"));
  if (common) out.root = first;
  let done = 0;
  for (const e of entries) {
    done++;
    if (onProgress && done % 50 === 0) onProgress(done);
    const path = common ? e.name.slice(first!.length + 1) : e.name;
    if (inIgnoredDir(path)) { out.skipped.ignoredDirs++; continue; }
    if (!isCodeFile(path)) { out.skipped.notCode++; continue; }
    const text = await e.async("string");
    if (text.includes("\u0000")) { out.skipped.binary++; continue; }
    if (text.length > MAX_FILE_CHARS) { out.skipped.tooLarge++; continue; }
    if (!text.trim()) continue;
    out.files.push({ name: path, content: text });
    out.chars += text.length;
    if (out.files.length >= MAX_FILES) break;
  }
  return out;
}

/** Cartelle trascinate nella pagina: si attraversano con l'API delle entry del browser. */
export async function collectDropped(items: DataTransferItemList): Promise<File[]> {
  const files: File[] = [];
  const walk = async (entry: FileSystemEntry, prefix: string): Promise<void> => {
    if (entry.isFile) {
      const f = await new Promise<File>((res, rej) => (entry as FileSystemFileEntry).file(res, rej));
      Object.defineProperty(f, "webkitRelativePath", { value: prefix + f.name });
      files.push(f);
    } else if (entry.isDirectory) {
      if (IGNORED_DIRS.has(entry.name)) return;
      const reader = (entry as FileSystemDirectoryEntry).createReader();
      for (;;) {
        const batch = await new Promise<FileSystemEntry[]>((res, rej) => reader.readEntries(res, rej));
        if (batch.length === 0) break;
        for (const child of batch) await walk(child, prefix + entry.name + "/");
      }
    }
  };
  const entries: FileSystemEntry[] = [];
  for (let i = 0; i < items.length; i++) {
    const entry = items[i].webkitGetAsEntry?.();
    if (entry) entries.push(entry);
  }
  for (const e of entries) await walk(e, "");
  return files;
}

export interface LocalScan {
  rulesVersion: string;
  findings: Finding[];
  inferred: InferredContext;
  excerpts: Excerpt[];
  inventory: Array<{ name: string; lines: number; chars: number; sha256: string }>;
  stats: { files: number; chars: number };
}

async function sha256(text: string): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

/** Regole, contesto dedotto, estratti e inventario, tutto nel browser. */
export async function runLocalScan(files: InputFile[], onProgress?: (step: string) => void): Promise<LocalScan> {
  onProgress?.("regole");
  const { findings, masks } = scan(files);
  onProgress?.("contesto");
  const inferred = inferContext(files);
  onProgress?.("estratti");
  const excerpts = buildExcerpts(files, findings, masks);
  onProgress?.("impronte");
  const inventory: LocalScan["inventory"] = [];
  for (const f of files) inventory.push({ name: f.name, lines: f.content.split(/\r?\n/).length, chars: f.content.length, sha256: await sha256(f.content) });
  return { rulesVersion: RULES_VERSION, findings, inferred, excerpts, inventory, stats: { files: files.length, chars: files.reduce((n, f) => n + f.content.length, 0) } };
}
