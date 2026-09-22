// Deduce il contesto dell'applicazione dal codice, così l'utente non deve rispondere a domande
// a cui il codice risponde da solo: tipo di software, dati personali trattati, uso di servizi
// di IA, settore, destinatari. Ogni voce ha una prova (file e riga), e l'utente può correggere.
// Gira nel browser e nella funzione edge: nessuna dipendenza da Deno o dal DOM.

import type { InputFile } from "./scan.ts";
import { stripLiterals } from "./rules.ts";

export interface Evidence { file: string; line: number; text: string }
/** confidence "alta" = si può dare per buono (per esempio una dipendenza nel manifest); "media" = da confermare. */
export interface Detected<T extends string = string> { value: T; evidence: Evidence[]; confidence: "alta" | "media" }

export interface InferredContext {
  appTypes: Detected[];        // web, mobile, backend, desktop, libreria
  personalData: Detected[];    // campi con dati personali trovati (email, telefono, codice fiscale, ...)
  usesAI: Detected[];          // sdk o endpoint di IA
  sectors: Detected[];         // pa, sanita, finanza, nis2, cra (solo indizi forti)
  audiences: Detected[];       // consumatori, dipendenti, business, minori
  languages: Record<string, number>;   // estensione -> numero di file
  frameworks: string[];
  stats: { files: number; chars: number };
}

type Probe = { value: string; test: RegExp; files?: RegExp; label?: string };

const APP_TYPES: Probe[] = [
  { value: "web", test: /"(react|react-dom|vue|next|nuxt|svelte|@angular\/core|astro|remix|gatsby|solid-js)"\s*:/, files: /package\.json$/ },
  { value: "web", test: /<html\b|<!DOCTYPE html/i, files: /\.(html?|ejs|hbs|twig|erb|blade\.php|cshtml)$/ },
  { value: "mobile", test: /<manifest\b|<application\b/, files: /AndroidManifest\.xml$/ },
  { value: "mobile", test: /import (UIKit|SwiftUI)|@UIApplicationMain|UIApplicationDelegate/, files: /\.swift$/ },
  { value: "mobile", test: /"(react-native|expo|@capacitor\/core|@ionic\/(react|angular|vue))"\s*:/, files: /package\.json$/ },
  { value: "mobile", test: /^\s*flutter:\s*$|^\s*sdk:\s*flutter/m, files: /pubspec\.yaml$/ },
  { value: "mobile", test: /com\.android\.application|androidx\./, files: /build\.gradle(\.kts)?$/ },
  { value: "backend", test: /"(express|fastify|koa|@nestjs\/core|hapi|@hono\/node-server|hono)"\s*:/, files: /package\.json$/ },
  { value: "backend", test: /^(django|flask|fastapi|starlette|tornado|aiohttp)\b/im, files: /(requirements[\w.-]*\.txt|pyproject\.toml|Pipfile)$/ },
  { value: "backend", test: /spring-boot|quarkus|micronaut|jakarta\.ws\.rs/, files: /(pom\.xml|build\.gradle(\.kts)?)$/ },
  { value: "backend", test: /gin-gonic|labstack\/echo|gofiber|net\/http/, files: /go\.mod$|\.go$/ },
  { value: "backend", test: /laravel\/framework|symfony\/|slim\/slim/, files: /composer\.json$/ },
  { value: "backend", test: /Microsoft\.AspNetCore|WebApplication\.CreateBuilder/, files: /\.(csproj|cs)$/ },
  { value: "backend", test: /^(FROM|EXPOSE)\s/m, files: /Dockerfile$/ },
  { value: "backend", test: /Deno\.serve\s*\(|serve\(async \(req|export default async function handler\(|export (async )?function (GET|POST|PUT|DELETE)\b|createServer\(/, files: /\.(ts|js|mjs)$/ },
  { value: "backend", test: /\[functions\.|\[edge_runtime\]/, files: /supabase\/config\.toml$/ },
  { value: "desktop", test: /"(electron|@tauri-apps\/api)"\s*:/, files: /package\.json$/ },
  { value: "desktop", test: /import (Cocoa|AppKit)\b|WPF|System\.Windows\.Forms|PyQt\d|tkinter/, files: /\.(swift|cs|py|csproj)$/ },
  { value: "libreria", test: /"main"\s*:|"exports"\s*:|"types"\s*:/, files: /package\.json$/ },
];

const PERSONAL: Probe[] = [
  { value: "email", test: /\b(e_?mail|emailAddress|indirizzo_?email)\b/i },
  { value: "telefono", test: /\b(telefono|phone_?number|phoneNumber|cellulare|mobile_?phone)\b/i },
  { value: "codice fiscale", test: /\b(codice_?fiscale|codiceFiscale|fiscal_?code|tax_?code|partita_?iva|vat_?number)\b/i },
  { value: "indirizzo", test: /\b(indirizzo|street_?address|shipping_?address|billing_?address|cap\b|postal_?code)\b/i },
  { value: "data di nascita", test: /\b(data_?nascita|birth_?date|dateOfBirth|birthday)\b/i },
  { value: "IBAN o pagamenti", test: /\b(iban|card_?number|cardNumber|cvv|numero_?carta)\b/i },
  { value: "documento d'identità", test: /\b(passport|carta_?identit|documento_?identit|id_?document)\b/i },
  { value: "geolocalizzazione", test: /\b(latitude|longitude|geolocation|latitudine|longitudine)\b/i },
  { value: "categorie particolari", test: /\b\w*(diagnos[ie]s?|health_?(record|status|data)|patolog|terapia|religion|religione|ethnic|etnia|biometric|genetic|sindacat|trade_?union|orientamento_?sessuale|sexual_?orientation)\w*\b/i },
];
const SCHEMA_LINE = /(\w+\??\s*[:=]|CREATE TABLE|add column|Column\(|@Column|Field\(|interface\s+\w+|type\s+\w+\s*=|\bclass\b|varchar|models\.|z\.object|Schema\(|prop\b)/i;

const AI: Probe[] = [
  { value: "OpenAI", test: /api\.openai\.com|new OpenAI\s*\(|from ['"]openai['"]|import openai|"openai"\s*:/i },
  { value: "Anthropic", test: /anthropic\.com|new Anthropic\s*\(|@anthropic-ai/i },
  { value: "Google Gemini", test: /generativelanguage\.googleapis\.com|@google\/genai|@google\/generative-ai|google\.generativeai|GoogleGenerativeAI/i },
  { value: "Mistral", test: /api\.mistral\.ai|@mistralai/i },
  { value: "Hugging Face", test: /api-inference\.huggingface\.co|"transformers"\s*:|from transformers import/i },
  { value: "Azure OpenAI", test: /openai\.azure\.com/i },
  { value: "AWS Bedrock", test: /bedrock-runtime|@aws-sdk\/client-bedrock/i },
  { value: "Cohere", test: /api\.cohere\./i },
  { value: "modello locale (Ollama, llama.cpp)", test: /localhost:11434|ollama|llama_cpp|llama\.cpp/i },
];

const SECTORS: Probe[] = [
  { value: "pa", test: /\b(spid|cie\b|cieid|pagopa|io-app|app\s?io|anpr|pdnd|interop\.pagopa|gov\.it)\b/i },
  { value: "sanita", test: /\b(fascicolo sanitario|fse\b|hl7|fhir|dicom|ricetta|referto|cartella clinica|patient)\b/i },
  { value: "finanza", test: /\b(stripe|adyen|nexi|satispay|psd2|open banking|sepa|braintree|paypal|checkout\.session|payment_intent)\b/i },
  { value: "nis2", test: /\b(scada|modbus|opc-?ua|iec\s?61850|plc\b|telemetria|smart meter)\b/i },
  { value: "cra", test: /\b(firmware|ota update|bootloader|embedded|esp32|stm32|zephyr|freertos|mqtt)\b/i },
];

const AUDIENCES: Probe[] = [
  { value: "consumatori", test: /\b(signup|sign_up|register|registrazione|createAccount|newsletter|checkout|cart\b|carrello|consumer|customer)\b/i },
  { value: "dipendenti", test: /\b(ldap|active directory|saml|okta|azure ad|entra id|intranet|dipendent|employee|hr\b|timbratur|badge|payroll|busta paga)\b/i },
  { value: "business", test: /\b(tenant|organization_id|orgId|workspace|b2b|api_key|apiKey|partner_id|invoice|fattura)\b/i },
  { value: "minori", test: /\b(minori|minor\b|parental|genitor|età minima|age_gate|ageGate|under_?13|under_?14|coppa)\b/i },
];

const EXT_LANG: Record<string, string> = {
  ts: "TypeScript", tsx: "TypeScript", js: "JavaScript", jsx: "JavaScript", mjs: "JavaScript", cjs: "JavaScript", py: "Python", java: "Java", kt: "Kotlin",
  kts: "Kotlin", swift: "Swift", go: "Go", rb: "Ruby", php: "PHP", cs: "C#", c: "C", cc: "C++", cpp: "C++", h: "C/C++", hpp: "C++", rs: "Rust", scala: "Scala",
  dart: "Dart", html: "HTML", htm: "HTML", vue: "Vue", svelte: "Svelte", css: "CSS", scss: "CSS", sql: "SQL", sh: "Shell", yml: "YAML", yaml: "YAML", json: "JSON",
  xml: "XML", tf: "Terraform", md: "Markdown",
};

const FRAMEWORK_KEYS: Array<[RegExp, string]> = [
  [/"next"\s*:/, "Next.js"], [/"react"\s*:/, "React"], [/"vue"\s*:/, "Vue"], [/"@angular\/core"\s*:/, "Angular"], [/"svelte"\s*:/, "Svelte"],
  [/"express"\s*:/, "Express"], [/"fastify"\s*:/, "Fastify"], [/"@nestjs\/core"\s*:/, "NestJS"], [/"react-native"\s*:/, "React Native"], [/"expo"\s*:/, "Expo"],
  [/"electron"\s*:/, "Electron"], [/"@supabase\/supabase-js"\s*:/, "Supabase"], [/"firebase"\s*:/, "Firebase"], [/"prisma"\s*:|"@prisma\/client"\s*:/, "Prisma"],
  [/"stripe"\s*:/, "Stripe"], [/"@sentry\/\w+"\s*:/, "Sentry"],
];
const PY_FRAMEWORKS: Array<[RegExp, string]> = [[/^django\b/im, "Django"], [/^flask\b/im, "Flask"], [/^fastapi\b/im, "FastAPI"], [/^sqlalchemy\b/im, "SQLAlchemy"], [/^torch\b|^tensorflow\b/im, "PyTorch/TensorFlow"]];

function addHit(map: Map<string, Evidence[]>, value: string, file: string, line: number, text: string, cap = 6) {
  const list = map.get(value) || [];
  if (list.length < cap) list.push({ file, line, text: text.trim().slice(0, 160) });
  map.set(value, list);
}
const MANIFEST_FILE = /(package\.json|requirements[\w.-]*\.txt|pyproject\.toml|Pipfile|pom\.xml|build\.gradle(\.kts)?|composer\.json|pubspec\.yaml|go\.mod|Gemfile|Cargo\.toml|AndroidManifest\.xml|Info\.plist|Dockerfile|config\.toml)$/;
const distinctFiles = (v: Evidence[]) => new Set(v.map((e) => e.file)).size;
const toList = (map: Map<string, Evidence[]>, strong: (v: Evidence[]) => boolean = () => true): Detected[] =>
  [...map.entries()].map(([value, evidence]) => ({ value, evidence, confidence: strong(evidence) ? "alta" : "media" }));

export function inferContext(files: InputFile[]): InferredContext {
  const app = new Map<string, Evidence[]>(), pii = new Map<string, Evidence[]>(), ai = new Map<string, Evidence[]>();
  const sec = new Map<string, Evidence[]>(), aud = new Map<string, Evidence[]>();
  const languages: Record<string, number> = {};
  const frameworks = new Set<string>();
  let chars = 0;
  for (const f of files) {
    chars += f.content.length;
    const ext = (f.name.split(".").pop() || "").toLowerCase();
    const lang = EXT_LANG[ext];
    if (lang) languages[lang] = (languages[lang] || 0) + 1;
    const isManifest = /(^|\/)(package\.json|requirements[\w.-]*\.txt|pyproject\.toml|Pipfile|pom\.xml|build\.gradle(\.kts)?|go\.mod|composer\.json|pubspec\.yaml|Gemfile|Cargo\.toml|.*\.csproj|Dockerfile|AndroidManifest\.xml|Info\.plist)$/.test(f.name);
    const isTest = /(^|\/)(tests?|__tests__|spec|fixtures?|mocks?|examples?)\//.test(f.name) || /[._-](test|spec)\.[a-z]+$/.test(f.name);
    const isProse = /\.(md|txt|rst|adoc)$/i.test(f.name);
    if (/(^|\/)package\.json$/.test(f.name)) for (const [re, name] of FRAMEWORK_KEYS) if (re.test(f.content)) frameworks.add(name);
    if (/(requirements[\w.-]*\.txt|pyproject\.toml|Pipfile)$/.test(f.name)) for (const [re, name] of PY_FRAMEWORKS) if (re.test(f.content)) frameworks.add(name);
    const lines = f.content.split(/\r?\n/);
    // Nei manifest ogni indizio si cerca sul file intero (le dipendenze stanno su righe diverse),
    // con la prova sulla prima riga che lo contiene.
    if (isManifest) {
      for (const p of APP_TYPES) {
        if (p.files && !p.files.test(f.name)) continue;
        if (!p.test.test(f.content)) continue;
        const idx = lines.findIndex((l) => p.test.test(l));
        addHit(app, p.value, f.name, idx >= 0 ? idx + 1 : 1, idx >= 0 ? lines[idx] : lines[0] || "");
      }
    }
    // Per il codice si guarda riga per riga, con un tetto per file.
    const limit = Math.min(lines.length, 4000);
    for (let i = 0; i < limit; i++) {
      const line = lines[i];
      if (!line.trim()) continue;
      if (!isManifest) for (const p of APP_TYPES) if ((!p.files || p.files.test(f.name)) && p.test.test(line)) addHit(app, p.value, f.name, i + 1, line);
      if (!isTest && !isManifest && !isProse) {
        // Settore e destinatari si leggono dagli identificatori, non dai testi: una pagina che parla
        // di sanità non rende l'applicazione sanitaria. Nei manifest contano i nomi delle dipendenze.
        const code = stripLiterals(line);
        if (SCHEMA_LINE.test(code)) for (const p of PERSONAL) if (p.test.test(code)) addHit(pii, p.value, f.name, i + 1, line);
        for (const p of SECTORS) if (p.test.test(code)) addHit(sec, p.value, f.name, i + 1, line);
        for (const p of AUDIENCES) if (p.test.test(code)) addHit(aud, p.value, f.name, i + 1, line);
      }
      if (isManifest) {
        for (const p of SECTORS) if (p.test.test(line)) addHit(sec, p.value, f.name, i + 1, line);
      }
      for (const p of AI) if (p.test.test(line)) addHit(ai, p.value, f.name, i + 1, line);
    }
  }
  // Una libreria è tale solo se non è anche un'applicazione: package.json con "main" è comune ovunque.
  if (app.has("libreria") && (app.has("web") || app.has("backend") || app.has("mobile") || app.has("desktop"))) app.delete("libreria");
  // Settori e destinatari: servono almeno tre indizi in file diversi, o due se uno è un manifest.
  const solid = (v: Evidence[]) => new Set(v.map((e) => e.file)).size >= 3 || (v.length >= 2 && v.some((e) => /(package\.json|requirements|pom\.xml|build\.gradle|composer\.json|pubspec\.yaml|go\.mod|Gemfile|Cargo\.toml)$/.test(e.file)));
  for (const [k, v] of [...sec.entries()]) if (!solid(v)) sec.delete(k);
  for (const [k, v] of [...aud.entries()]) if (!solid(v)) aud.delete(k);
  return {
    appTypes: toList(app),
    personalData: toList(pii, (v) => distinctFiles(v) >= 2),
    usesAI: toList(ai),
    // Un settore è sicuro solo se lo dice una dipendenza; i destinatari solo se ricorrono in molti file.
    sectors: toList(sec, (v) => v.some((e) => MANIFEST_FILE.test(e.file))),
    audiences: toList(aud, (v) => distinctFiles(v) >= 5),
    languages, frameworks: [...frameworks], stats: { files: files.length, chars },
  };
}

/** Riassunto leggibile del contesto dedotto, per il prompt e per il referto. */
export function describeInferred(inf: InferredContext): string {
  const top = Object.entries(inf.languages).sort((a, b) => b[1] - a[1]).slice(0, 5).map(([l, n]) => `${l} (${n})`).join(", ");
  const rows = [
    `- File analizzati: ${inf.stats.files}, linguaggi principali: ${top || "non riconosciuti"}${inf.frameworks.length ? `, framework: ${inf.frameworks.join(", ")}` : ""}`,
    `- Tipo di software rilevato: ${inf.appTypes.map((a) => a.value).join(", ") || "non riconosciuto"}`,
    `- Dati personali nei modelli: ${inf.personalData.map((a) => a.value).join(", ") || "nessun campo riconosciuto"}`,
    `- Servizi di IA: ${inf.usesAI.map((a) => a.value).join(", ") || "nessuno"}`,
    inf.sectors.length ? `- Indizi di settore: ${inf.sectors.map((a) => a.value).join(", ")}` : "",
    inf.audiences.length ? `- Indizi sui destinatari: ${inf.audiences.map((a) => a.value).join(", ")}` : "",
  ].filter(Boolean);
  return rows.join("\n");
}
