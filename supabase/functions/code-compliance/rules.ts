// Regole deterministiche della verifica del codice. Sono loro a decidere se un problema c'è:
// ogni esito ha file, riga e testo che lo prova, e rigirando la verifica sullo stesso codice
// si ottiene lo stesso risultato. Il modello linguistico arriva dopo, per spiegare, graduare
// il contesto e suggerire interventi, ma non può cancellare un esito delle regole.
//
// Ogni regola indica le fonti normative che la giustificano (chiavi in structured_chunks),
// così il testo citato nel report è quello caricato nel RAG, non una parafrasi.

export type Risk = "high" | "medium" | "low";
export type Category = "sicurezza" | "privacy" | "cookie" | "accessibilita" | "ai" | "licenze";

/** Riferimento a una fonte del RAG: chiave esatta, prefisso di chiave o etichetta di citazione. */
export interface Ref { k?: string; p?: string; l?: string }

export const REFS: Record<string, Ref> = {
  GDPR5: { k: "eu:02016R0679-20160504:it:art5:par1" },
  GDPR6: { k: "eu:02016R0679-20160504:it:art6:par1" },
  GDPR9: { k: "eu:02016R0679-20160504:it:art9:par1" },
  GDPR13: { k: "eu:02016R0679-20160504:it:art13:par1" },
  GDPR25: { k: "eu:02016R0679-20160504:it:art25:par1" },
  GDPR32: { k: "eu:02016R0679-20160504:it:art32:par1" },
  GDPR44: { k: "eu:02016R0679-20160504:it:art44" },
  EPRIVACY53: { k: "eu:02002L0058-20091219:it:art5:par3" },
  CP122: { k: "web:CODICE_PRIVACY:art122:c1" },
  GARANTE_COOKIE: { k: "web:GARANTE_COOKIE:part0:s27" },
  GARANTE_COOKIE_DEFAULT: { k: "web:GARANTE_COOKIE:part0:s33" },
  CRA_ANNEX1: { k: "eu:02024R2847-20241120:it:annex1:p1" },
  CRA_ANNEX1B: { k: "eu:02024R2847-20241120:it:annex1:p2" },
  AIACT50_1: { k: "eu:02024R1689-20260727:it:art50:par1" },
  AIACT50_2: { k: "eu:02024R1689-20260727:it:art50:par2" },
  LEGGE_IA_4: { p: "web:LEGGE_IA:art4:c3" },
  LEGGE_IA_11: { p: "web:LEGGE_IA:art11:c2" },
  NIS2_IT_24: { k: "web:DLGS_138_2024:art24:c2" },
  EAA4: { k: "eu:32019L0882:it:art4:par1" },
  WCAG_111: { l: "WCAG 2.2, Success Criterion 1.1.1 Non-text Content" },
  WCAG_311: { l: "WCAG 2.2, Success Criterion 3.1.1 Language of Page" },
  ASVS_INJECTION: { l: "OWASP ASVS 5.0, V1.2 Injection Prevention" },
  ASVS_SANITIZE: { l: "OWASP ASVS 5.0, V1.3 Sanitization" },
  ASVS_COOKIE: { l: "OWASP ASVS 5.0, V3.3 Cookie Setup" },
  ASVS_HEADERS: { l: "OWASP ASVS 5.0, V3.4 Browser Security Mechanism Headers" },
  ASVS_HASH: { l: "OWASP ASVS 5.0, V11.4 Hashing and Hash-based Functions" },
  ASVS_RANDOM: { l: "OWASP ASVS 5.0, V11.5 Random Values" },
  ASVS_TLS_EXT: { l: "OWASP ASVS 5.0, V12.2 HTTPS Communication with External Facing Services" },
  ASVS_TLS_INT: { l: "OWASP ASVS 5.0, V12.3 General Service to Service Communication Security" },
  ASVS_SECRETS: { l: "OWASP ASVS 5.0, V13.3 Secret Management" },
  ASVS_LEAK: { l: "OWASP ASVS 5.0, V13.4 Unintended Information Leakage" },
  ASVS_DATA: { l: "OWASP ASVS 5.0, V14.2 General Data Protection" },
  ASVS_CLIENT_DATA: { l: "OWASP ASVS 5.0, V14.3 Client-side Data Protection" },
  ASVS_LOGGING: { l: "OWASP ASVS 5.0, V16.2 General Logging" },
  AGID_SQL: { k: "web:AGID_SW_SICURO:part1:pg102:s15" },
  AGID_KEYS: { k: "web:AGID_SW_SICURO:part1:pg155:s29" },
  AGID_PW_HASH: { k: "web:AGID_SW_SICURO:part1:pg21:s56" },
  AGID_PW_NET: { k: "web:AGID_SW_SICURO:part1:pg21:s55" },
  LIC_GPL3: { l: "Licenza, GPL-3.0-only, GPL-3.0-only" },
  LIC_AGPL3: { l: "Licenza, AGPL-3.0-only, AGPL-3.0-only" },
};

export interface LineHit { risk?: Risk; note?: string; mask?: RegExp }

export interface Rule {
  id: string;
  title: string;
  category: Category;
  risk: Risk;
  /** Perché conta, in una frase comprensibile anche a chi non scrive codice. */
  why: string;
  action: string;
  refs: string[];
  /** File a cui si applica (sul nome). Assente: tutti. */
  files?: RegExp;
  /** Anche nei commenti (licenze). */
  scanComments?: boolean;
  test: (line: string, file: string) => LineHit | null;
}

const PLACEHOLDER = /(example|esempio|changeme|change_me|your[_-]?|<[^>]+>|\$\{|\{\{|process\.env|os\.environ|getenv|env\(|xxxx|\*\*\*|dummy|placeholder|redacted|test123|password123|secret123|sample)/i;
const SECRET_PATTERNS: Array<[RegExp, string]> = [
  [/\bAKIA[0-9A-Z]{16}\b/, "chiave di accesso AWS"],
  [/-----BEGIN (?:RSA |EC |DSA |OPENSSH |ENCRYPTED )?PRIVATE KEY-----/, "chiave privata"],
  [/\bAIza[0-9A-Za-z_-]{35}\b/, "chiave API Google"],
  [/\bsk_live_[0-9A-Za-z]{20,}\b/, "chiave Stripe di produzione"],
  [/\bgh[pousr]_[A-Za-z0-9]{36,}\b/, "token GitHub"],
  [/\bxox[baprs]-[A-Za-z0-9-]{10,}\b/, "token Slack"],
  [/\bsk-(?:proj-|ant-)?[A-Za-z0-9_-]{32,}\b/, "chiave API di un servizio di intelligenza artificiale"],
  [/\beyJ[A-Za-z0-9_-]{15,}\.eyJ[A-Za-z0-9_-]{15,}\.[A-Za-z0-9_-]{10,}/, "token JWT"],
];
const GENERIC_SECRET = /\b[\w.-]*?(pass(?:word|wd)?|pwd|secret|api[_-]?key|apikey|access[_-]?token|auth[_-]?token|private[_-]?key)\w*["']?\s*[:=]\s*["'`]([^"'`\s]{8,})["'`]/i;

export const SECRET_VALUE_MASKS: RegExp[] = [
  ...SECRET_PATTERNS.map(([re]) => new RegExp(re.source, "g")),
];

const HTTP_OK = /(localhost|127\.0\.0\.1|0\.0\.0\.0|\[::1\]|example\.(com|org|net)|www\.w3\.org|schemas\.|xmlns|apache\.org\/licenses|opensource\.org|purl\.org|json-schema\.org|ns\.adobe\.com|schemas\.android\.com|\.local\b|\.test\b|\.internal\b)/i;

const TRACKERS: Array<[RegExp, string]> = [
  [/googletagmanager\.com|google-analytics\.com|\bgtag\s*\(|\bga\s*\(\s*['"]create|ReactGA|react-ga4?|@next\/third-parties\/google|vue-gtag/i, "Google Analytics / Tag Manager"],
  [/connect\.facebook\.net|\bfbq\s*\(|react-facebook-pixel/i, "Meta Pixel"],
  [/static\.hotjar\.com|\bhj\s*\(\s*['"]|@hotjar/i, "Hotjar"],
  [/clarity\.ms|\bclarity\s*\(\s*['"]/i, "Microsoft Clarity"],
  [/cdn\.mxpnl\.com|mixpanel\.(init|track)|mixpanel-browser/i, "Mixpanel"],
  [/cdn\.segment\.com|analytics\.load\s*\(|@segment\/analytics/i, "Segment"],
  [/analytics\.tiktok\.com|\bttq\.(load|track)/i, "TikTok Pixel"],
  [/snap\.licdn\.com|_linkedin_partner_id/i, "LinkedIn Insight Tag"],
  [/posthog\.(init|capture)|posthog-js/i, "PostHog"],
  [/amplitude\.(init|getInstance)|@amplitude\/analytics/i, "Amplitude"],
];
export const CONSENT_SIGNALS = /cookie.?consent|consent.?mode|gtag\s*\(\s*['"]consent|iubenda|cookiebot|onetrust|didomi|klaro|cookieyes|tarteaucitron|usercentrics|complianz|cookie-?law|consentmanager|cmp\.|__tcfapi|hasConsent|consentGiven|consent_given|acceptCookies|cookiesAccepted/i;

const AI_TEXT = /api\.openai\.com|new OpenAI\s*\(|from ['"]openai['"]|import openai|anthropic\.com|new Anthropic\s*\(|@anthropic-ai|generativelanguage\.googleapis\.com|@google\/genai|@google\/generative-ai|google\.generativeai|GoogleGenerativeAI|api\.mistral\.ai|@mistralai|api-inference\.huggingface\.co|api\.cohere\.|openai\.azure\.com|bedrock-runtime|chat\.completions\.create/i;
const AI_SYNTH = /images\.generate|dall-e|dall·e|\bimagen\b|stable-?diffusion|replicate\.com|api\.elevenlabs|text-to-speech|audio\.speech\.create|tts-1|gpt-image|\bsora\b|midjourney|\bflux-(pro|dev|schnell)/i;

/** Toglie il contenuto delle stringhe: "email inviata" non è un dato personale, user.email sì. */
export function stripLiterals(line: string): string {
  return line
    .replace(/"(?:[^"\\]|\\.)*"/g, '""')
    .replace(/'(?:[^'\\]|\\.)*'/g, "''")
    // Nei template si tiene solo ciò che sta dentro ${...}: è codice, il resto è testo.
    .replace(/`(?:[^`\\]|\\.)*`/g, (m) => "`" + [...m.matchAll(/\$\{([^}]*)\}/g)].map((x) => x[1]).join(" ") + "`");
}

const LOG_CALL = /\b(console\.(log|info|debug|warn|error)|logger\.(info|debug|warn|warning|error|trace)|log\.(Print\w*|Info\w*|Debug\w*|info|debug)|logging\.(info|debug|warning|error)|print\s*\(|System\.out\.print|fmt\.Print|Log\.[dive]\s*\(|error_log\s*\(|var_dump\s*\()/;
const PII_WORDS = /\b(e-?mail|codice_?fiscale|codiceFiscale|fiscal_?code|tax_?code|iban|telefono|phone(_?number)?|indirizzo|address|birth_?date|data_?nascita|ssn|passport|carta_?identit|nome_?utente|cognome|surname|full_?name)/i;
const SECRET_WORDS = /\b(password|passwd|pwd|secret|token|api_?key|authorization|bearer|cvv|cvc|card_?number|cardNumber)\b/i;

const SPECIAL = /\b\w*(diagnos[ie]s?|health_?(record|status|data)|salute|malattia|patolog|terapia|farmac|religion|religione|sexual_?orientation|orientamento_?sessuale|ethnic(ity)?|etnia|biometric|biometric[io]|genetic|genetic[oa]|political_?(opinion|party)|opinioni_?politiche|trade_?union|sindacat)\w*\b/i;

const isMarkup = /\.(html?|jsx|tsx|vue|svelte|astro|php|erb|hbs|ejs|twig|cshtml|razor)$/i;

export const RULES: Rule[] = [
  {
    id: "SEC-01", title: "Credenziali o chiavi scritte nel codice", category: "sicurezza", risk: "high",
    why: "Chi legge il codice (repository, pacchetto distribuito, log di build) ottiene l'accesso ai sistemi o ai dati protetti da quella chiave.",
    action: "Togliere il valore dal codice, spostarlo in un gestore di segreti o in una variabile d'ambiente, ruotare subito la chiave esposta e controllare la cronologia del repository.",
    refs: ["GDPR32", "ASVS_SECRETS", "AGID_KEYS", "CRA_ANNEX1"],
    test: (line) => {
      for (const [re, what] of SECRET_PATTERNS) if (re.test(line)) return { note: what, mask: re };
      const g = GENERIC_SECRET.exec(line);
      if (g && !PLACEHOLDER.test(g[2]) && /\d/.test(g[2]) && /[A-Za-z]/.test(g[2]) && !/^[A-Z0-9_]+$/.test(g[2])) return { note: `valore assegnato a "${g[1]}"`, mask: new RegExp(escapeRe(g[2])) };
      return null;
    },
  },
  {
    id: "SEC-02", title: "Algoritmo di hash debole (MD5 o SHA-1)", category: "sicurezza", risk: "medium",
    why: "MD5 e SHA-1 non sono più considerati sicuri: se proteggono password o firme, un attaccante può ricostruirle o falsificarle.",
    action: "Per le password usare Argon2id, scrypt o bcrypt con sale; per l'integrità SHA-256 o superiore. Pianificare la migrazione degli hash già salvati.",
    refs: ["GDPR32", "ASVS_HASH", "AGID_PW_HASH", "CRA_ANNEX1"],
    test: (line) => {
      if (/(etag|e_?tag|cache[_ ]?key|cachekey|checksum|integrit|dedup|fingerprint_?file|content_?hash|file_?hash|nome_?file)/i.test(line)) return null;
      if (!/(createHash\s*\(\s*['"](md5|sha1)['"]|hashlib\.(md5|sha1)\s*\(|MessageDigest\.getInstance\s*\(\s*"(MD5|SHA-?1)"|\bmd5\s*\(|\bsha1\s*\(|DigestUtils\.(md5|sha1)|crypto\.subtle\.digest\s*\(\s*['"]SHA-1['"]|Md5\.|SHA1Managed|MD5\.Create)/i.test(line)) return null;
      return /pass|pwd|pin\b|credential/i.test(line) ? { risk: "high", note: "usato su una password" } : {};
    },
  },
  {
    id: "SEC-03", title: "Comunicazione in chiaro (http://)", category: "sicurezza", risk: "medium",
    why: "I dati inviati senza TLS possono essere letti o modificati durante il trasporto.",
    action: "Usare https:// per tutti gli indirizzi esterni e rifiutare le connessioni non cifrate; per i servizi interni valutare TLS reciproco.",
    refs: ["GDPR32", "ASVS_TLS_EXT", "AGID_PW_NET"],
    test: (line) => {
      const m = /http:\/\/[^\s'"`)<>]+/i.exec(line);
      if (!m || HTTP_OK.test(m[0])) return null;
      // Molti http:// non sono connessioni ma identificatori (spazi dei nomi XML, URI di risorse).
      if (/(xmlns|namespace|\bns\b|\buri\b|rdf|owl:|@prefix|schema_?id|\/resource\/)/i.test(line)) return null;
      // Un indirizzo dentro un elenco di link non è una connessione: serve un contesto di chiamata
      // o di configurazione.
      const contesto = line.replace(/https?:\/\/\S*/gi, "");
      if (!/(fetch|axios|\brequest\b|http\.(get|post|request)|urlopen|curl|client|endpoint|\burl\b|\buri\b|host|base_?url|\bapi\b|webhook|proxy|origin|src\s*=|href\s*=|action\s*=|connect|websocket|\bws\b)/i.test(contesto)) return null;
      return /pass|token|login|auth|api/i.test(m[0] + line) ? { risk: "high", note: m[0].slice(0, 80) } : { note: m[0].slice(0, 80) };
    },
  },
  {
    id: "SEC-04", title: "Verifica del certificato TLS disattivata", category: "sicurezza", risk: "high",
    why: "Senza verifica del certificato chiunque si metta in mezzo alla connessione può intercettare i dati, anche se l'indirizzo è https.",
    action: "Riattivare la verifica; se serve un certificato interno, aggiungere la sua autorità di certificazione all'elenco di quelle fidate invece di disattivare il controllo.",
    refs: ["GDPR32", "ASVS_TLS_INT", "CRA_ANNEX1"],
    test: (line) => /(verify\s*=\s*False|rejectUnauthorized\s*:\s*false|NODE_TLS_REJECT_UNAUTHORIZED\s*=?\s*['"]?0|InsecureSkipVerify\s*:\s*true|CURLOPT_SSL_VERIFYPEER\s*,\s*(false|0)|_create_unverified_context|ServerCertificateValidationCallback\s*=.*true|TrustAllCerts|ALLOW_ALL_HOSTNAME_VERIFIER|setHostnameVerifier\s*\(\s*\(.*\)\s*->\s*true)/i.test(line) ? {} : null,
  },
  {
    id: "SEC-05", title: "Query SQL costruita concatenando testo", category: "sicurezza", risk: "high",
    why: "Se una parte della query arriva dall'utente, può essere usata per leggere, modificare o cancellare dati (SQL injection).",
    action: "Usare query parametriche o un ORM con parametri legati; non inserire mai variabili nella stringa SQL.",
    refs: ["ASVS_INJECTION", "AGID_SQL", "GDPR32", "CRA_ANNEX1"],
    test: (line) => {
      if (!/\b(SELECT|INSERT|UPDATE|DELETE)\b[\s\S]*\b(FROM|INTO|SET|WHERE)\b/i.test(line)) return null;
      const concat = /(["'`][^"'`]*\b(SELECT|INSERT|UPDATE|DELETE)\b[^"'`]*["'`]\s*(\+|\.\s*\$|%\s*[\w(])|\+\s*\w+\s*\+\s*["'`]|\bf["'][^"']*\b(SELECT|INSERT|UPDATE|DELETE)\b[^"']*\{|`[^`]*\b(SELECT|INSERT|UPDATE|DELETE)\b[^`]*\$\{|\.format\s*\(|String\.format\s*\(|sprintf\s*\(|"\s*\.\s*\$\w+)/i;
      return concat.test(line) ? {} : null;
    },
  },
  {
    id: "SEC-06", title: "Esecuzione dinamica di codice o comandi", category: "sicurezza", risk: "medium",
    why: "eval, exec o comandi di sistema con dati esterni permettono a un attaccante di eseguire istruzioni proprie sul server o nel browser.",
    action: "Eliminare eval e simili; per i comandi di sistema passare gli argomenti come elenco, senza shell, e validare i valori ammessi.",
    refs: ["ASVS_INJECTION", "ASVS_SANITIZE", "CRA_ANNEX1"],
    test: (line) => {
      if (/(^|[^\w.])eval\s*\(|new Function\s*\(|child_process\.(exec|execSync)\s*\(|\bos\.system\s*\(|subprocess\.\w+\([^)]*shell\s*=\s*True|Runtime\.getRuntime\(\)\.exec|\bshell_exec\s*\(|\bpassthru\s*\(|dangerouslySetInnerHTML|\.innerHTML\s*=(?!\s*['"`]\s*['"`])/.test(line)) {
        return /dangerouslySetInnerHTML|innerHTML/.test(line) ? { risk: "medium", note: "HTML inserito senza sanificazione (rischio XSS)" } : {};
      }
      return null;
    },
  },
  {
    id: "PRIV-01", title: "Strumenti di tracciamento di terze parti", category: "cookie", risk: "high",
    why: "Cookie e strumenti di profilazione o analisi di terze parti possono essere attivati solo dopo il consenso dell'utente; alcuni trasferiscono dati fuori dall'UE.",
    action: "Caricare lo script solo dopo il consenso raccolto con un banner conforme (rifiuto facile quanto l'accettazione, nessuna casella preselezionata), registrare il consenso e verificare il trasferimento extra UE.",
    refs: ["EPRIVACY53", "CP122", "GARANTE_COOKIE", "GARANTE_COOKIE_DEFAULT", "GDPR44"],
    test: (line) => {
      for (const [re, what] of TRACKERS) if (re.test(line)) return { note: what };
      return null;
    },
  },
  {
    id: "PRIV-02", title: "Dati personali o segreti scritti nei log", category: "privacy", risk: "medium",
    why: "I log vengono conservati a lungo e letti da più persone: dati personali o credenziali non devono finirci.",
    action: "Togliere il campo dal log o mascherarlo; definire quali dati sono ammessi nei log e per quanto tempo si conservano.",
    refs: ["GDPR5", "GDPR32", "ASVS_LOGGING"],
    test: (line) => {
      if (!LOG_CALL.test(line)) return null;
      // Conta solo ciò che è fuori dalle stringhe: un messaggio che parla di email non è un dato
      // personale, mentre user.email lo è.
      const code = stripLiterals(line);
      if (SECRET_WORDS.test(code)) return { risk: "high", note: "credenziali o dati di pagamento nel log" };
      if (PII_WORDS.test(code)) return { note: "dati personali nel log" };
      return null;
    },
  },
  {
    id: "PRIV-03", title: "Geolocalizzazione dell'utente", category: "privacy", risk: "medium",
    why: "La posizione è un dato personale delicato: serve una base giuridica chiara, un'informativa specifica e, per l'accesso al dispositivo, il consenso.",
    action: "Chiedere la posizione solo quando serve alla funzione richiesta dall'utente, spiegarlo nell'informativa, ridurre la precisione e i tempi di conservazione al minimo.",
    refs: ["GDPR6", "GDPR13", "GDPR25", "EPRIVACY53"],
    test: (line) => /(navigator\.geolocation|getCurrentPosition|watchPosition|CLLocationManager|requestWhenInUseAuthorization|requestAlwaysAuthorization|FusedLocationProviderClient|ACCESS_FINE_LOCATION|ACCESS_BACKGROUND_LOCATION|expo-location|react-native-geolocation|Geolocator\.)/.test(line)
      ? (/BACKGROUND|Always/.test(line) ? { risk: "high", note: "posizione anche in background" } : {}) : null,
  },
  {
    id: "PRIV-04", title: "Impronta del dispositivo (fingerprinting)", category: "privacy", risk: "high",
    why: "Leggere caratteristiche del dispositivo per riconoscere l'utente equivale a un cookie di tracciamento: serve il consenso.",
    action: "Eliminare il fingerprinting o attivarlo solo dopo il consenso, per finalità dichiarate nell'informativa.",
    refs: ["EPRIVACY53", "CP122", "GARANTE_COOKIE"],
    test: (line) => /(fingerprintjs|@fingerprintjs|clientjs|canvas\.toDataURL\s*\(\s*\).*hash|getFingerprint\s*\(|deviceFingerprint|browserFingerprint|AudioContext\(\).*fingerprint)/i.test(line) ? {} : null,
  },
  {
    id: "PRIV-05", title: "Categorie particolari di dati (salute, religione, biometria...)", category: "privacy", risk: "medium",
    why: "Questi dati sono vietati salvo le eccezioni dell'art. 9 GDPR e richiedono misure di protezione più forti.",
    action: "Verificare la base giuridica prevista dall'art. 9, cifrare i campi, limitare gli accessi e valutare una valutazione d'impatto (DPIA).",
    refs: ["GDPR9", "GDPR32", "GDPR25"],
    test: (line) => {
      // Solo nomi di campi o colonne: le stesse parole dentro un testo dell'interfaccia o di un
      // prompt non sono un trattamento.
      const code = stripLiterals(line);
      if (!/(\w+\s*[:=]|CREATE TABLE|add column|Column\(|@Column|Field\(|interface|type\s+\w+\s*=|\bclass\b|varchar|\bjsonb?\b)/i.test(code)) return null;
      const m = SPECIAL.exec(code);
      if (!m) return null;
      // Deve essere un identificatore: parola composta o seguita da una dichiarazione.
      const around = new RegExp(`[\\w.]*${m[0].replace(/[.*+?^$\{\}()|\[\]\\]/g, "\\$&")}[\\w]*\\s*[:=(]`, "i");
      return around.test(code) ? { note: `campo "${m[0].slice(0, 40)}"` } : null;
    },
  },
  {
    id: "PRIV-06", title: "Token di sessione nel localStorage", category: "privacy", risk: "medium",
    why: "Il localStorage è leggibile da qualsiasi script della pagina: un attacco XSS può rubare la sessione.",
    action: "Tenere i token di sessione in cookie HttpOnly, Secure e SameSite, oppure ridurne durata e privilegi.",
    refs: ["ASVS_CLIENT_DATA", "GDPR32"],
    test: (line) => {
      const m = /(localStorage|sessionStorage)\.setItem\s*\(\s*['"`]([^'"`]*)['"`]/i.exec(line);
      if (!m) return null;
      const chiave = m[2];
      if (/(redirect|return|next|callback|state|locale|lang|theme|tema|consent|onboarding|step)/i.test(chiave)) return null;
      return /(token|jwt|credential|password|secret|api_?key|session_?id|refresh|bearer)/i.test(chiave) ? { note: `chiave "${chiave.slice(0, 40)}"` } : null;
    },
  },
  {
    id: "SEC-07", title: "Cookie senza attributi di sicurezza", category: "sicurezza", risk: "medium",
    why: "Senza Secure, HttpOnly e SameSite un cookie di sessione può viaggiare in chiaro o essere letto da script malevoli.",
    action: "Impostare Secure, HttpOnly e SameSite=Lax o Strict sui cookie di sessione e di autenticazione.",
    refs: ["ASVS_COOKIE", "GDPR32"],
    test: (line) => {
      if (/document\.cookie\s*=/.test(line)) return /session|token|auth|jwt/i.test(line) ? { note: "cookie di sessione scritto da JavaScript, non può essere HttpOnly" } : null;
      if (/secure/i.test(line) || /httponly/i.test(line)) return null;
      // Serve un cookie con un nome scritto nel codice: le righe che passano una variabile sono
      // quasi sempre codice di libreria, non la configurazione di un cookie.
      const m = /(?:res|response|ctx|reply)\.cookie\s*\(\s*['"`]([\w.-]+)['"`]|set_?cookie\s*\(\s*['"`]([\w.-]+)['"`]|cookies\.set\s*\(\s*['"`]([\w.-]+)['"`]|['"`]Set-Cookie['"`]\s*[,:]\s*['"`]([\w.-]+)=/i.exec(line);
      if (!m) return null;
      const nome = m[1] || m[2] || m[3] || m[4] || "";
      return { note: `cookie "${nome}" senza Secure e HttpOnly su questa riga` };
    },
  },
  {
    id: "SEC-08", title: "CORS aperto a qualsiasi origine", category: "sicurezza", risk: "low",
    why: "Consentire ogni origine permette a siti terzi di chiamare le API. Con autenticazione a token e senza credenziali di sessione il rischio è contenuto, ma va deciso e documentato; con i cookie di sessione diventa una falla.",
    action: "Elencare le origini ammesse dove è possibile; non combinare mai origine * con l'invio di credenziali di sessione.",
    refs: ["ASVS_HEADERS", "GDPR32"],
    test: (line) => /(Access-Control-Allow-Origin['"]?\s*[:,=]\s*['"]\*['"]|origin\s*:\s*['"]\*['"]|AllowAnyOrigin\s*\(|CORS_ORIGIN_ALLOW_ALL\s*=\s*True|allow_origins\s*=\s*\[\s*['"]\*['"]\s*\])/i.test(line)
      ? (/credentials\s*[:=]\s*true|allow_credentials\s*=\s*True|AllowCredentials/i.test(line) ? { risk: "high", note: "origine * insieme alle credenziali" } : {}) : null,
  },
  {
    id: "SEC-09", title: "Modalità di debug attiva", category: "sicurezza", risk: "low",
    why: "In produzione il debug mostra errori dettagliati, percorsi e a volte variabili: informazioni utili a un attaccante.",
    action: "Disattivare il debug negli ambienti di produzione e mostrare all'utente messaggi di errore generici.",
    refs: ["ASVS_LEAK", "CRA_ANNEX1"],
    test: (line) => /(^\s*DEBUG\s*=\s*True\b|app\.run\([^)]*debug\s*=\s*True|app\.debug\s*=\s*true|display_errors\s*=\s*(On|1)|APP_DEBUG\s*=\s*true|^\s*"?debug"?\s*:\s*true|UseDeveloperExceptionPage\s*\()/i.test(line) ? {} : null,
  },
  {
    id: "SEC-10", title: "Numeri casuali non sicuri per token o codici", category: "sicurezza", risk: "medium",
    why: "Math.random e simili sono prevedibili: token, codici OTP o password generati così possono essere indovinati.",
    action: "Usare un generatore crittografico (crypto.getRandomValues, crypto.randomBytes, secrets, SecureRandom).",
    refs: ["ASVS_RANDOM", "CRA_ANNEX1"],
    test: (line) => /(Math\.random\s*\(|\brandom\.(random|randint|choice|choices)\s*\(|new Random\s*\(|\bmt_rand\s*\(|\brand\s*\()/.test(line) && /(token|password|passwd|otp|secret|session|nonce|salt|codice|code|pin|reset)/i.test(line) ? {} : null,
  },
  {
    id: "PRIV-07", title: "Dati ospitati o inviati fuori dall'Unione europea", category: "privacy", risk: "medium",
    why: "Trasferire dati personali fuori dall'UE richiede una base per il trasferimento (decisione di adeguatezza, clausole contrattuali standard) e una valutazione del paese di destinazione.",
    action: "Spostare la regione su un data center europeo quando possibile; altrimenti documentare la base del trasferimento, le clausole contrattuali e la valutazione del paese, e indicarlo nell'informativa.",
    refs: ["GDPR44", "GDPR13"],
    test: (line) => {
      const m = /(["'`])(us-(east|west|central)-\d|ap-(south|northeast|southeast)-\d\w*|sa-east-\d|af-south-\d|me-south-\d|iad1|sfo1|pdx1|cle1|hnd1|syd1|gru1|us-central\d?|northamerica-\w+|asia-\w+\d)\1|(region|location|zone)\s*[:=]\s*["'`](us|ap|sa|af|me)[-_]/i.exec(line);
      if (!m) return null;
      if (/eu-|europe|frankfurt|milan|paris|dublin|fra1|cdg1|arn1|zrh1/i.test(line)) return null;
      return { note: `regione ${m[0].slice(0, 40)}` };
    },
  },
  {
    id: "PRIV-08", title: "Raccolta o registrazione dell'indirizzo IP", category: "privacy", risk: "low",
    why: "L'indirizzo IP è un dato personale: va raccolto solo se serve, dichiarato nell'informativa e conservato per un tempo definito.",
    action: "Verificare la finalità (sicurezza, antifrode, statistiche), fissare un tempo di conservazione, valutare l'anonimizzazione o il troncamento dell'ultimo ottetto e citarlo nell'informativa.",
    refs: ["GDPR5", "GDPR13", "ASVS_LOGGING"],
    test: (line) => {
      const code = stripLiterals(line);
      return /(x-forwarded-for|\breq\.ip\b|request\.remote_addr|REMOTE_ADDR|getClientIp|client_?ip|ip_?address|indirizzo_?ip|RemoteIpAddress|getRemoteAddr)/i.test(code) || /x-forwarded-for/i.test(line) ? {} : null;
    },
  },
  {
    id: "AI-01", title: "Uso di un servizio di intelligenza artificiale", category: "ai", risk: "medium",
    why: "Se l'utente interagisce con un sistema di IA deve saperlo; i dati inviati al fornitore sono un trattamento, spesso con trasferimento fuori dall'UE.",
    action: "Informare in modo chiaro che si interagisce con un'IA, indicare il fornitore nell'informativa, non inviare dati personali non necessari e verificare il contratto (DPA) e il trasferimento extra UE.",
    refs: ["AIACT50_1", "LEGGE_IA_4", "GDPR13", "GDPR44"],
    test: (line) => AI_TEXT.test(line) ? {} : null,
  },
  {
    id: "AI-02", title: "Contenuti sintetici generati dall'IA (immagini, audio, video)", category: "ai", risk: "medium",
    why: "Chi fornisce sistemi che generano immagini, audio o video sintetici deve marcarli in modo che siano riconoscibili come artificiali.",
    action: "Aggiungere una marcatura leggibile da macchina (metadati o filigrana, per esempio C2PA) e un'indicazione visibile dove serve.",
    refs: ["AIACT50_2"],
    test: (line) => AI_SYNTH.test(line) ? {} : null,
  },
  {
    id: "ACC-01", title: "Immagini senza testo alternativo", category: "accessibilita", risk: "low",
    why: "Chi usa un lettore di schermo non riceve alcuna informazione dall'immagine.",
    action: "Aggiungere alt descrittivo alle immagini informative e alt=\"\" a quelle decorative.",
    refs: ["WCAG_111", "EAA4"],
    files: isMarkup,
    test: (line) => /<img\b(?![^>]*\balt\s*=)[^>]*>/i.test(line) || /<Image\b(?![^>]*\balt\s*=)[^>]*\/?>/.test(line) ? {} : null,
  },
  {
    id: "ACC-02", title: "Lingua della pagina non dichiarata", category: "accessibilita", risk: "low",
    why: "Senza l'attributo lang i lettori di schermo pronunciano il testo con la lingua sbagliata.",
    action: "Aggiungere lang=\"it\" (o la lingua corretta) al tag html.",
    refs: ["WCAG_311", "EAA4"],
    files: /\.(html?|php|erb|hbs|ejs|twig|cshtml|astro)$/i,
    test: (line) => /<html\b(?![^>]*\blang\s*=)[^>]*>/i.test(line) ? {} : null,
  },
  {
    id: "LIC-01", title: "Codice sotto licenza copyleft (GPL, AGPL, LGPL)", category: "licenze", risk: "medium",
    why: "Le licenze copyleft impongono di distribuire il codice sorgente delle opere derivate alle stesse condizioni; l'AGPL anche quando il software è offerto in rete.",
    action: "Verificare se il componente è distribuito o offerto come servizio, se il modello di licenza del prodotto è compatibile e tenere un inventario delle licenze (SBOM).",
    refs: ["LIC_GPL3", "LIC_AGPL3"],
    scanComments: true,
    test: (line) => {
      const m = /(SPDX-License-Identifier:\s*(A?GPL|LGPL)[\w.+-]*|GNU (Affero |Lesser )?General Public License|"license"\s*:\s*"(A?GPL|LGPL)[^"]*")/i.exec(line);
      if (!m) return null;
      return /affero|agpl/i.test(m[0]) ? { risk: "high", note: "AGPL" } : { note: m[0].slice(0, 60) };
    },
  },
];

export const RULES_VERSION = "2026-09-22.2";

export function escapeRe(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** File che contengono per mestiere valori finti: un segreto lì dentro pesa meno. */
export const TEST_FILE = /(^|\/)(tests?|__tests__|spec|specs|fixtures?|mocks?|examples?|samples?|seed|seeds|demo)\/|[._-](test|spec|mock|fixture|example|sample)\.[a-z]+$|\.(example|sample|template)$/i;

export function isCommentLine(line: string): boolean {
  const t = line.trim();
  return t.startsWith("//") || t.startsWith("#") || t.startsWith("*") || t.startsWith("/*") || t.startsWith("<!--") || t.startsWith("--") || t.startsWith("'''") || t.startsWith('"""');
}
