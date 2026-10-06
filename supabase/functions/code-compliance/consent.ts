// Consenso e tracciamento: analisi strutturale, non solo lessicale.
//
// Un gestore del consenso "c'è" solo se compare in una riga di codice: un commento, un TODO o
// un testo di interfaccia non contano. E uno strumento di tracciamento è "dopo il consenso"
// solo se il punto in cui parte è protetto da un controllo riconoscibile: un tag script
// disattivato dal CMP, un callback del consenso, un controllo esplicito nelle righe precedenti,
// oppure la Consent Mode di Google impostata a "denied" prima dello script.

import { isCommentLine, TEST_FILE, TEXT_FILE } from "./rules.ts";

export interface Evidence { file: string; line: number; snippet: string; note?: string }

/** Librerie e API di gestione del consenso: la presenza in una riga di codice è una prova. */
export const CONSENT_MANAGER = /cookieconsent|cookie-consent|cookie_consent|CookieConsent|consent-?manager|consentmanager|cookiebot|onetrust|optanon|iubenda|didomi|klaro|cookieyes|cky-consent|tarteaucitron|usercentrics|complianz|cookie-?law|cookiefirst|axeptio|quantcast|__tcfapi|__cmp\b|gtag\s*\(\s*['"]consent['"]|consentMode|consent_mode|hasConsent\s*\(|consentGiven|consent_given|acceptCookies|cookiesAccepted|useConsent\s*\(|ConsentContext|ConsentProvider|CookieBanner|cookie-?banner/i;

const TODO = /\b(todo|fixme|xxx|tbd|hack|wip)\b/i;

/** Prove della presenza di un gestore del consenso, solo in righe di codice. */
export function consentManagerEvidence(files: Array<{ name: string; content: string }>): Evidence[] {
  const out: Evidence[] = [];
  for (const f of files) {
    if (TEXT_FILE.test(f.name) || TEST_FILE.test(f.name) || /\.(md|txt|rst)$/i.test(f.name)) continue;
    const lines = f.content.split(/\r?\n/);
    for (let i = 0; i < lines.length && out.length < 20; i++) {
      const line = lines[i];
      if (!CONSENT_MANAGER.test(line) || isCommentLine(line) || TODO.test(line)) continue;
      // Il codice vero sta prima di un eventuale commento in coda: se la parola è solo lì, non vale.
      const code = line.replace(/(?<!:)\/\/.*$|(^|\s)#.*$|\/\*.*?\*\//g, "");
      if (!CONSENT_MANAGER.test(code)) continue;
      out.push({ file: f.name, line: i + 1, snippet: line.trim().slice(0, 160) });
    }
  }
  return out;
}

/** Il tag script è disattivato finché il CMP non lo abilita. */
const BLOCKED_SCRIPT = /type\s*=\s*["']text\/plain["']|data-(?:cookiecategory|cookieconsent|cookie-consent|cmp-vendor|cmp-src|usercentrics|iub-purposes?|consent|cookiefirst-category|category)\s*=|class\s*=\s*["'][^"']*(?:cmplazyload|_iub_cs_activate|optanon-category|cky-)|data-cookie-?category|data-cookieconsent/i;
/** Un controllo del consenso che protegge le righe che seguono. */
const CONSENT_GATE = /hasConsent\s*\(|consentGiven|consent_given|cookiesAccepted|acceptCookies|\bconsent(ed)?\s*(===?|!==?)\s*(true|false|['"])|Cookiebot\.consent\.|\.consent\.(statistics|marketing|analytics|advertising)|__tcfapi\s*\(|onConsent|OnetrustActiveGroups|OptanonWrapper|OptanonActiveGroups|didomi\.(getUserConsentStatus|on\s*\(|shouldConsentBeCollected)|klaro\.getManager|_iub\.csConfiguration|onConsentGiven|cookieconsent\.(on|run|initialise)|CookieConsent\.(acceptedCategory|acceptedService|validConsent|run)|cc\.acceptedCategory|useConsent\s*\(|ConsentContext|isConsent\w*\s*\(|checkConsent\s*\(|getConsent\w*\s*\(|consent\.(analytics|marketing|statistics|advertising)|window\.cookieconsent|cky\.|ccm\.|tarteaucitron\.(user|job)|usercentrics|UC_UI\.|gtag\s*\(\s*['"]consent['"]\s*,\s*['"]update['"]/i;
/** Consent Mode di Google impostata a negato prima di caricare lo script: il tag non traccia finché non c'è il consenso. */
const CONSENT_MODE_DEFAULT_DENIED = /gtag\s*\(\s*['"]consent['"]\s*,\s*['"]default['"][\s\S]{0,300}?denied/i;

/**
 * Perché il tracker alla riga `idx` (0-based) parte solo dopo il consenso, oppure null.
 * Guarda il tag che lo contiene, le 30 righe precedenti e, per Google, la Consent Mode nel file.
 */
export function trackerGate(lines: string[], idx: number, file: string): string | null {
  const line = lines[idx] || "";
  // Tag script disattivato dal CMP: sulla stessa riga o nell'apertura del tag poco sopra.
  for (let i = idx; i >= Math.max(0, idx - 4); i--) {
    if (BLOCKED_SCRIPT.test(lines[i] || "")) return `script disattivato dal gestore del consenso (${file}:${i + 1})`;
    if (i < idx && /<script\b/i.test(lines[i] || "") ) break;
  }
  if (BLOCKED_SCRIPT.test(line)) return `script disattivato dal gestore del consenso (${file}:${idx + 1})`;
  // Controllo esplicito del consenso nelle righe precedenti dello stesso file.
  for (let i = idx; i >= Math.max(0, idx - 30); i--) {
    const l = lines[i] || "";
    if (isCommentLine(l) || TODO.test(l)) continue;
    if (CONSENT_GATE.test(l)) return `caricato dopo un controllo del consenso (${file}:${i + 1})`;
  }
  // Consent Mode di Google impostata a negato prima dello script, nello stesso file.
  if (/googletagmanager|gtag|google-analytics|ReactGA|react-ga|vue-gtag|@next\/third-parties/i.test(line)) {
    const before = lines.slice(Math.max(0, idx - 200), idx + 1).join("\n");
    if (CONSENT_MODE_DEFAULT_DENIED.test(before)) return `Consent Mode impostata a "denied" prima dello script (${file})`;
  }
  return null;
}
