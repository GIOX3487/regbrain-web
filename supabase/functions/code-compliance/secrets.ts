// Mascheratura dei segreti. Si applica a tutto ciò che esce dal browser o entra nel referto:
// righe citate negli esiti, estratti per il modello, righe aggiunte dal modello.
//
// È indipendente dal rilevamento: una password senza cifre non è un esito di SEC-01 (troppi
// falsi positivi), ma non deve comunque finire in chiaro in un estratto. Si maschera quindi
// qualunque valore assegnato a un nome da segreto, le credenziali dentro un URL, i token degli
// header di autenticazione e il corpo delle chiavi private. Del valore non resta nulla:
// nemmeno i primi caratteri.

const REDACTED = "[SEGRETO RIMOSSO]";

/** Formati noti di chiavi e token: si mascherano ovunque, anche senza un nome accanto. */
export const KNOWN_TOKEN_PATTERNS: RegExp[] = [
  /\bAKIA[0-9A-Z]{16}\b/g,
  /\bAIza[0-9A-Za-z_-]{35}\b/g,
  /\bsk_(?:live|test)_[0-9A-Za-z]{20,}\b/g,
  /\b(?:pk|rk)_live_[0-9A-Za-z]{20,}\b/g,
  /\bgh[pousr]_[A-Za-z0-9]{36,}\b/g,
  /\bgithub_pat_[A-Za-z0-9_]{60,}\b/g,
  /\bxox[baprs]-[A-Za-z0-9-]{10,}\b/g,
  /\bsk-(?:proj-|ant-)?[A-Za-z0-9_-]{32,}\b/g,
  /\beyJ[A-Za-z0-9_-]{15,}\.eyJ[A-Za-z0-9_-]{15,}\.[A-Za-z0-9_-]{10,}/g,
  /\bglpat-[A-Za-z0-9_-]{20,}\b/g,
  /\bSG\.[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{20,}\b/g,
  /\bsq0(?:atp|csp)-[A-Za-z0-9_-]{20,}\b/g,
  /\bhooks\.slack\.com\/services\/T[A-Za-z0-9]+\/B[A-Za-z0-9]+\/[A-Za-z0-9]+/g,
  /\bsb_(?:secret|publishable)_[A-Za-z0-9_-]{20,}\b/g,
  /\bsbp_[a-f0-9]{30,}\b/g,
];

/** Nomi che indicano un segreto, in qualunque convenzione di scrittura. */
const SECRET_NAME = String.raw`(?:pass(?:word|wd|phrase)\w*|\bpass\b|pwd\w*|secret\w*|api[_-]?key\w*|apikey\w*|(?:access|auth|refresh|session|api|secret|bearer|id|csrf|jwt)[_-]?token\w*|\btoken\b|private[_-]?key\w*|client[_-]?secret\w*|signing[_-]?key\w*|encryption[_-]?key\w*|master[_-]?key\w*|service[_-]?role(?:[_-]?key)?|connection[_-]?string\w*|credentials?\b)`;

/** Chiave e valore: `password = "x"`, `"apiKey": "x"`, `DB_PASSWORD=x`, `secret: x`. */
const QUOTED_ASSIGN = new RegExp(String.raw`(["']?[\w.-]*?${SECRET_NAME}["']?\s*[:=]\s*)(["'` + "`" + String.raw`])((?:(?!\2).){1,400})\2`, "gi");
const UNQUOTED_ASSIGN = new RegExp(String.raw`(^|[\s,{;])([\w.-]*?${SECRET_NAME}\s*[:=]\s*)([^\s"'` + "`" + String.raw`,;#]{4,})`, "gim");

/** Valori che sono riferimenti, non segreti: mascherarli renderebbe il codice illeggibile. */
const REFERENCE = /^(process\.env|os\.environ|os\.getenv|getenv\(|env\(|ENV\[|\$\{|\$\(|\{\{|<[^>]+>|\$[A-Z_]|secrets\.|config\.|settings\.|this\.|self\.|null|undefined|none|true|false|nil|\*{3,}|x{4,}|\.{3,})/i;
const CONFIG_FILE = /(^|\/)(\.env[\w.-]*|[\w.-]*\.(ya?ml|properties|ini|toml|conf|cfg|env|tfvars|xml|plist|txt))$|(^|\/)(Dockerfile|docker-compose[\w.-]*)$/i;

const URL_CREDENTIALS = /(\b[a-z][a-z0-9+.-]*:\/\/[^\s/:@"'`]+:)([^\s@"'`/]{1,200})@/gi;
const AUTH_HEADER = /((?:authorization|x-api-key|x-auth-token|x-access-token|proxy-authorization|cookie)["']?\s*[:=]\s*["']?(?:basic|bearer|token|digest|apikey)?\s*)([A-Za-z0-9._~+/=-]{8,})/gi;
const PRIVATE_KEY_BLOCK = /(-----BEGIN [A-Z ]*PRIVATE KEY-----)[\s\S]*?(-----END [A-Z ]*PRIVATE KEY-----)/g;
const PRIVATE_KEY_LINE = /^(\s*)[A-Za-z0-9+/=]{40,}\s*$/;

function redactValue(value: string): string {
  return REFERENCE.test(value.trim()) ? value : REDACTED;
}

/**
 * Maschera i segreti in un testo, anche su più righe. `file` serve a trattare i file di
 * configurazione, dove i valori non hanno virgolette.
 */
export function redactSecrets(text: string, file = ""): string {
  if (!text) return text;
  let out = text;
  for (const re of KNOWN_TOKEN_PATTERNS) out = out.replace(re, REDACTED);
  out = out.replace(PRIVATE_KEY_BLOCK, (_m, open, close) => `${open}\n${REDACTED}\n${close}`);
  out = out.replace(URL_CREDENTIALS, (_m, head) => `${head}${REDACTED}@`);
  out = out.replace(AUTH_HEADER, (_m, head, value) => `${head}${redactValue(value)}`);
  out = out.replace(QUOTED_ASSIGN, (_m, head, quote, value) => `${head}${quote}${redactValue(value)}${quote}`);
  if (CONFIG_FILE.test(file)) {
    out = out.replace(UNQUOTED_ASSIGN, (_m, before, head, value) => `${before}${head}${redactValue(value)}`);
  }
  return out;
}

/**
 * Maschera una riga sola. Una riga di solo base64 lunga è trattata come corpo di una chiave
 * privata o di un certificato: non c'è modo di distinguerla fuori dal contesto, e perderla
 * non toglie nulla alla lettura.
 */
export function redactLine(line: string, file = ""): string {
  if (PRIVATE_KEY_LINE.test(line)) return line.replace(/\S.*$/, REDACTED);
  return redactSecrets(line, file);
}

/** Vero se nel testo resta qualcosa che somiglia a un segreto: serve ai test e a un controllo finale. */
export function looksLikeSecret(text: string): boolean {
  for (const re of KNOWN_TOKEN_PATTERNS) { re.lastIndex = 0; if (re.test(text)) return true; }
  return PRIVATE_KEY_BLOCK.test(text) || URL_CREDENTIALS.test(text);
}

/**
 * Rilevamento per SEC-01 nei file di configurazione, dove `password: hunter2` non ha
 * virgolette. Restituisce il valore trovato, da mascherare, oppure null.
 */
export function configSecret(line: string, file: string): { name: string; value: string } | null {
  if (!CONFIG_FILE.test(file)) return null;
  const re = new RegExp(String.raw`(^|[\s,{;])([\w.-]*?${SECRET_NAME})\s*[:=]\s*([^\s"'` + "`" + String.raw`,;#]{8,})\s*(?:[#;].*)?$`, "i");
  const m = re.exec(line);
  if (!m) return null;
  const value = m[m.length - 1];
  if (REFERENCE.test(value) || /^[A-Z0-9_]+$/.test(value) || /(example|changeme|change_me|placeholder|dummy|sample|your[_-]|xxxx|\*\*\*)/i.test(value)) return null;
  return { name: m[2], value };
}
