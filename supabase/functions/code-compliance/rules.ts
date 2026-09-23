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
  // Aggiunte del 23 settembre: consenso, minori, decisioni automatizzate, pratiche vietate,
  // sicurezza (token, deserializzazione, file, TLS) e fonti di settore.
  GDPR7_2: { k: "eu:02016R0679-20160504:it:art7:par2" },
  GDPR8: { k: "eu:02016R0679-20160504:it:art8:par1" },
  GDPR22: { k: "eu:02016R0679-20160504:it:art22:par1" },
  GDPR28: { k: "eu:02016R0679-20160504:it:art28:par1" },
  GDPR35: { k: "eu:02016R0679-20160504:it:art35:par1" },
  CP2QUINQUIES: { k: "web:CODICE_PRIVACY:art2-quinquies:c1" },
  EDPB_DARK_DEFAULT: { k: "web:EDPB_3_2022:part0:pg24:s33" },
  EDPB_DARK_PRESEL: { k: "web:EDPB_3_2022:part0:pg26:s2" },
  AIACT5: { k: "eu:02024R1689-20260727:it:art5:par1" },
  AIACT6_2: { k: "eu:02024R1689-20260727:it:art6:par2" },
  AIACT_ANNEX3: { k: "eu:02024R1689-20260727:it:annex3:p1" },
  AIACT26: { k: "eu:02024R1689-20260727:it:art26:par1" },
  ASVS_TOKEN: { l: "OWASP ASVS 5.0, V9.1 Token source and integrity" },
  ASVS_DESER: { l: "OWASP ASVS 5.0, V1.5 Safe Deserialization" },
  ASVS_FILE_STORAGE: { l: "OWASP ASVS 5.0, V5.3 File Storage" },
  ASVS_FILE_DOWNLOAD: { l: "OWASP ASVS 5.0, V5.4 File Download" },
  ASVS_TLS_GENERAL: { l: "OWASP ASVS 5.0, V12.1 General TLS Security Guidance" },
  MDR_SW: { k: "eu:02017R0745-20260719:it:annex2:p15" },
  DORA9: { k: "eu:32022R2554:it:art9:par1" },
  PSD2_SCA4: { k: "eu:02018R0389-20230912:it:art4:par1" },
  DATA_ACT3: { k: "eu:32023R2854:it:art3:par1" },
  CAD64: { k: "web:CAD:art64:c2-bis" },
  PLD7: { k: "eu:32024L2853:it:art7:par1" },
  // Lotto 2: accessibilità con lettura dei tag, password, regole su più righe.
  WCAG_131: { l: "WCAG 2.2, Success Criterion 1.3.1 Info and Relationships" },
  WCAG_142: { l: "WCAG 2.2, Success Criterion 1.4.2 Audio Control" },
  WCAG_211: { l: "WCAG 2.2, Success Criterion 2.1.1 Keyboard" },
  WCAG_222: { l: "WCAG 2.2, Success Criterion 2.2.2 Pause, Stop, Hide" },
  WCAG_242: { l: "WCAG 2.2, Success Criterion 2.4.2 Page Titled" },
  WCAG_243: { l: "WCAG 2.2, Success Criterion 2.4.3 Focus Order" },
  WCAG_244: { l: "WCAG 2.2, Success Criterion 2.4.4 Link Purpose (In Context)" },
  WCAG_247: { l: "WCAG 2.2, Success Criterion 2.4.7 Focus Visible" },
  WCAG_332: { l: "WCAG 2.2, Success Criterion 3.3.2 Labels or Instructions" },
  WCAG_412: { l: "WCAG 2.2, Success Criterion 4.1.2 Name, Role, Value" },
  ASVS_PASSWORD: { l: "OWASP ASVS 5.0, V6.2 Password Security" },
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

const HTTP_OK = /(localhost|127\.0\.0\.1|0\.0\.0\.0|\[::1\]|example\.(com|org|net)|www\.w3\.org|schemas\.|xmlns|apache\.org\/licenses|opensource\.org|purl\.org|json-schema\.org|ns\.adobe\.com|schemas\.android\.com|\.local\b|\.test\b|\.internal\b|\.example\b|\.invalid\b)/i;

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
  // SDK per app mobili: raccolgono identificativi del dispositivo e eventi d'uso.
  [/firebase\/analytics|@react-native-firebase\/analytics|firebase-analytics|FirebaseAnalytics\b|firebase_analytics|getAnalytics\s*\(|logEvent\s*\(/, "Firebase Analytics"],
  [/appsflyer|AppsFlyerLib|react-native-appsflyer/i, "AppsFlyer"],
  [/com\.adjust\.sdk|AdjustConfig\b|react-native-adjust/i, "Adjust"],
  [/io\.branch\.|BranchSDK|react-native-branch/i, "Branch"],
  [/FBSDKCoreKit|facebook-android-sdk|com\.facebook\.android:facebook-core|react-native-fbsdk/i, "Facebook SDK"],
  [/singular-sdk|com\.singular\.sdk/i, "Singular"],
];
// Risorse esterne che inviano l'indirizzo IP dell'utente a un fornitore extra UE a ogni caricamento.
const EXTRA_EU_RESOURCES: Array<[RegExp, string]> = [
  [/fonts\.googleapis\.com|fonts\.gstatic\.com/i, "Google Fonts caricati dai server di Google"],
  [/ajax\.googleapis\.com/i, "libreria caricata dalla CDN di Google"],
  [/youtube\.com\/embed\//i, "video YouTube incorporato (cookie di Google prima del consenso)"],
  [/www\.google\.com\/recaptcha|recaptcha\/api\.js|hcaptcha\.com\/1\/api\.js/i, "reCAPTCHA o hCaptcha"],
  [/maps\.googleapis\.com\/maps\/api\/js|google\.com\/maps\/embed/i, "Google Maps incorporato"],
];
export const CONSENT_SIGNALS = /cookie.?consent|consent.?mode|gtag\s*\(\s*['"]consent|iubenda|cookiebot|onetrust|didomi|klaro|cookieyes|tarteaucitron|usercentrics|complianz|cookie-?law|consentmanager|cmp\.|__tcfapi|hasConsent|consentGiven|consent_given|acceptCookies|cookiesAccepted/i;

const AI_TEXT = /api\.openai\.com|new OpenAI\s*\(|from ['"]openai['"]|import openai|anthropic\.com|new Anthropic\s*\(|@anthropic-ai|generativelanguage\.googleapis\.com|@google\/genai|@google\/generative-ai|google\.generativeai|GoogleGenerativeAI|api\.mistral\.ai|@mistralai|api-inference\.huggingface\.co|api\.cohere\.|openai\.azure\.com|bedrock-runtime|chat\.completions\.create/i;
const AI_SYNTH = /images\.generate|dall-e|dall·e|\bimagen[-_]?\d|models\/imagen|imagegeneration@|stable-?diffusion|replicate\.com|api\.elevenlabs|text-to-speech|audio\.speech\.create|tts-1|gpt-image|\bsora\b|midjourney|\bflux-(pro|dev|schnell)/i;

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
const isConfig = /\.(conf|cfg|ini|toml|yml|yaml|json|properties|tf|env|env\.example|py|ts|js|go|rb|java|cs)$|nginx\.conf$|Caddyfile$|Dockerfile$/i;

const CONSENT_WORDS = /(consent|consens|privacy|newsletter|marketing|profilaz|profiling|terms|termini|gdpr|cookie|promo|comunicazioni commerciali|third.?part|terze parti)/i;
const DEVICE_ACCESS = /(getUserMedia\s*\(|new MediaRecorder\s*\(|navigator\.contacts|ContactsContract|CNContactStore|AVCaptureDevice|android\.permission\.(CAMERA|RECORD_AUDIO|READ_CONTACTS|READ_CALL_LOG|READ_SMS)|NS(Camera|Microphone|Contacts|PhotoLibrary)UsageDescription|expo-camera|expo-contacts|react-native-contacts|react-native-camera|react-native-vision-camera|image_picker|ImagePicker\.launchCamera|Permission\.(camera|microphone|contacts))/;
const EMOTION_BIOMETRIC = /\b(detectEmotions?|emotion_?(recognition|detection|analysis|classifier)|emotionRecognition|recognizeEmotion|analyzeEmotion|EmotionAnalysis|faceExpression|FaceExpressionNet|withFaceExpressions|face_?expression_?(recognition|detection)|Emotions\b[^\n]*Rekognition|Rekognition[^\n]*Emotions|DetectFaces[^\n]*Attributes[^\n]*ALL|(ethnicity|race|religion|sexual_?orientation)_?(detect|classif|predict|estimat)|(detect|classify|predict|estimate)_?(ethnicity|race)\b|emotion_?ai|affectiva|hume\.ai|api\.hume\.ai)/i;
const PERSON_DECISION = /\b\w*(applicant|resume|curricul|\bcv_|employee|dipendent|lavorator|worker|hiring|recruit|assunzion|job_?candidat|candidat[eio]s?_?(profile|cv|resume|screen)|credit_?(score|scoring|risk|worth)|creditScor|loan|mutuo|prestito|tenant_?(score|screen|risk)|inquilin|student_?(risk|dropout|admission)|studente|alunn|patient_?(risk|triage|priorit)|paziente|insurance_?claim|sinistr|welfare|benefit_?(eligib|claim)|migrant|asylum)\w*/i;
const DECISION_VERB = /\b\w*(score|scoring|rank|ranking|classif|predict|screen(ing)?|reject|deny|approve|eligib|shortlist|triage)\w*\s*[:=(]/i;
const JWT_UNSAFE = /(algorithms?\s*[:=]\s*\[?\s*['"]none['"]|['"]alg['"]\s*:\s*['"]none['"]|verify_signature['"]?\s*[:=]\s*False|verify\s*=\s*False[^\n]*jwt|jwt\.decode\([^)]*verify\s*=\s*False|ignoreExpiration\s*:\s*true|ignore_?exp(iration)?\s*[:=]\s*True|jwt\.decode\s*\([^)]*\)\s*(as\s+\w+)?[^\n]*\b(userId|user_id|role|isAdmin|is_admin|admin)\b|JWT_VERIFY\s*=\s*false|jwt\.verify\s*\([^,]+,\s*(['"]{2}|null|undefined)\s*[,)])/;
const UNSAFE_DESER = /(\bpickle\.loads?\s*\(|\bcPickle\.loads?\s*\(|jsonpickle\.decode\s*\(|\byaml\.load\s*\((?![^)]*(SafeLoader|safe_load|Loader\s*=\s*yaml\.(CSafeLoader|SafeLoader|BaseLoader)))(?=[^\n]*)|\byaml\.unsafe_load\s*\(|\bunserialize\s*\(|new ObjectInputStream\s*\(|\.readObject\s*\(|Marshal\.load\s*\(|YAML\.load\s*\((?![^)]*safe)|new BinaryFormatter\s*\(|BinaryFormatter\.Deserialize|node-serialize|serialize\.unserialize\s*\()/;
export const USER_INPUT = /(req\.(query|params|body|files?)\b|\bparams\.(file|filename|path|name|dir|folder|slug|key|template|page)\b|request\.(args|form|files|GET|POST|data|json|values)\b|\$_(GET|POST|REQUEST|FILES)\b|params\[|c\.Query\(|c\.Param\(|r\.URL\.Query|ctx\.(query|params)\b|event\.(queryStringParameters|pathParameters)|searchParams\.get\(|@RequestParam|@PathVariable|\bargs\.get\()/;
export const FILE_OP = /(readFile(Sync)?\s*\(|createReadStream\s*\(|writeFile(Sync)?\s*\(|sendFile\s*\(|res\.download\s*\(|fs\.(unlink|rm|stat|access|open|readdir)(Sync)?\s*\(|path\.(join|resolve)\s*\(|\bopen\s*\(\s*(os\.path\.join|f['"]|['"][^'"]*['"]\s*\+)|os\.path\.join\s*\(|send_file\s*\(|send_from_directory\s*\(|file_get_contents\s*\(|\b(include|require)(_once)?\s*\(?\s*(\$|[\"'][^\"']*[\"']\s*\.)|fopen\s*\(|new File\s*\(|Paths\.get\s*\(|File\.ReadAll\w*\s*\(|os\.Open\s*\(|ioutil\.ReadFile\s*\(|filepath\.Join\s*\()/;
export const PATH_GUARD = /(basename|sanitize|normalize|realpath|path\.resolve\([^)]*\)\.startsWith|startsWith\(|secure_filename|allowlist|whitelist|\bsafe|resolveWithin|isInside|\.\.\/|\\\.\\\.)/i;
const TLS_OLD = /(ssl_protocols[^;\n]*\bTLSv1(\.[01])?\b(?!\.\d)|\bSSLv[23]\b|PROTOCOL_(SSLv[23]|TLSv1(_[01])?)\b|(TLSv1|TLSv1_1|SSLv23|SSLv3)_(client_|server_)?method|minVersion\s*[:=]\s*['"]TLSv1(\.[01])?['"]|secureProtocol\s*:\s*['"](TLSv1|TLSv1_1|SSLv3)_method['"]|ssl-?protocols?\s*[=:]\s*['"]?[^\n]*\bTLSv1(\.[01])?\b(?![^\n]*1\.[23])|SslProtocols\.(Ssl[23]|Tls|Tls11)\b|TLS_VERSION\s*[:=]\s*['"]?1\.[01]\b|tls_min_version\s*[:=]\s*['"]?(1\.0|1\.1|TLSv1(\.[01])?)\b|MinVersion\s*:\s*tls\.VersionTLS1[01]\b|MinVersion\s*:\s*tls\.VersionSSL30)/i;

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
      if (/(etag|e_?tag|cache[_ ]?key|cachekey|checksum|integrit|dedup|fingerprint_?file|content_?hash|file_?hash|nome_?file|update\(\s*(content|buffer|fileContent|bytes|chunk)\s*\))/i.test(line)) return null;
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
      // Un'immagine o un font in chiaro non trasporta dati dell'utente: è un altro problema (contenuto misto), non questo.
      if (/\.(png|gif|jpe?g|svg|ico|webp|woff2?|ttf)(\?|$)/i.test(m[0])) return null;
      // Un collegamento che l'utente può cliccare non è una connessione dell'applicazione.
      if (/<a\b[^>]*href\s*=\s*["'][^"']*http:\/\//i.test(line) || /\[[^\]]*\]\(http:\/\//.test(line)) return null;
      // Molti http:// non sono connessioni ma identificatori (spazi dei nomi XML, URI di risorse).
      if (/(xmlns|namespace|\bns\b|\buri\b|rdf|owl:|@prefix|schema_?id|\/resource\/)/i.test(line)) return null;
      // Un indirizzo dentro un elenco di link non è una connessione: serve un contesto di chiamata
      // o di configurazione.
      // Un indirizzo da solo dentro un elenco di link non è una connessione; se invece è
      // argomento di una chiamata, valore di una variabile o attributo, lo è.
      const resto = line.replace(m[0], "").trim();
      if (/^[\s'"`,;\[\]()]*$/.test(resto)) return null;
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
      if (/(^|[^\w.])eval\s*\(|new Function\s*\(|child_process\.(exec|execSync)\s*\(|\bos\.system\s*\(|subprocess\.\w+\([^)]*shell\s*=\s*True|Runtime\.getRuntime\(\)\.exec|\bshell_exec\s*\(|\bpassthru\s*\(|dangerouslySetInnerHTML|\.innerHTML\s*\+?=(?!\s*['"`]\s*['"`])|\[innerHTML\]\s*=|\bv-html\s*=|\{@html\b|bypassSecurityTrust(Html|Script|Url|ResourceUrl|Style)\s*\(|\.insertAdjacentHTML\s*\(|\$\([^)]*\)\.html\s*\(\s*[^'"`)]/.test(line)) {
        return /innerHTML|v-html|@html|bypassSecurityTrust|insertAdjacentHTML|\.html\s*\(/.test(line) ? { risk: "medium", note: "HTML inserito senza sanificazione (rischio XSS)" } : {};
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
      if (/\b(iban|carta_?credito|card_?number|cardnumber|cvv|conto_?corrente)\b/i.test(code)) return { risk: "high", note: "dati bancari nel log" };
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
      if (!/(\w+\s*[:=]|CREATE TABLE|add column|Column\(|@Column|Field\(|interface|type\s+\w+\s*=|\bclass\b|varchar|\bjsonb?\b|^\s*"?\w+"?\s+(text|char|character|integer|int|bigint|smallint|boolean|bool|date|timestamp|numeric|decimal|uuid|blob|clob)\b|\{[^}]*\}\s*=\s*(req|request|body|params|query|payload|form)\b)/i.test(code)) return null;
      const m = SPECIAL.exec(code);
      if (!m) return null;
      // Deve essere un identificatore: parola composta o seguita da una dichiarazione.
      const around = new RegExp(`[\\w.]*${m[0].replace(/[.*+?^$\{\}()|\[\]\\]/g, "\\$&")}[\\w]*\\s*([:=(]|\\s+(text|char|character|integer|int|bigint|smallint|boolean|bool|date|timestamp|numeric|decimal|uuid|blob|clob|varchar)\\b|\\s*[,}]\\s*(\\w+\\s*[,}]\\s*)*=\\s*(req|request|body|params|query|payload|form)\\b)`, "i");
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
      const m = /(x-forwarded-for|\breq\.ip\b|request\.remote_addr|REMOTE_ADDR|getClientIp|client_?ip|ip_?address|indirizzo_?ip|RemoteIpAddress|getRemoteAddr)/i.exec(code);
      if (!m && !/x-forwarded-for/i.test(line)) return null;
      // Testo fra due tag (un'etichetta dell'interfaccia) non è una raccolta.
      if (m && new RegExp(`>[^<]*${m[0]}[^<]*<`, "i").test(line)) return null;
      return {};
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
    id: "SEC-11", title: "Token JWT accettato senza verificare la firma o la scadenza", category: "sicurezza", risk: "high",
    why: "Se il token non viene verificato, chiunque può fabbricarne uno e presentarsi come un altro utente o come amministratore.",
    action: "Verificare sempre firma e scadenza con la chiave o il certificato del server, rifiutare l'algoritmo none e non leggere identità o ruoli da un token solo decodificato.",
    refs: ["ASVS_TOKEN", "GDPR32", "CRA_ANNEX1"],
    test: (line) => {
      if (/\/\/|#|\*/.test(line.trim().slice(0, 2))) return null;
      const m = JWT_UNSAFE.exec(line);
      if (!m) return null;
      if (/ignoreExpiration|ignore_?exp/i.test(m[0])) return { risk: "medium", note: "scadenza del token ignorata" };
      if (/decode/.test(m[0]) && !/verify\s*=\s*False|verify_signature/.test(m[0])) return { note: "identità o ruolo letti da un token solo decodificato" };
      return { note: m[0].slice(0, 60) };
    },
  },
  {
    id: "SEC-12", title: "Deserializzazione di dati non fidati", category: "sicurezza", risk: "high",
    why: "pickle, yaml.load, unserialize e simili eseguono codice contenuto nei dati: un file o una richiesta manipolata diventa esecuzione di comandi sul server.",
    action: "Usare formati che non eseguono codice (JSON, yaml.safe_load, protobuf) o deserializzatori con elenco delle classi ammesse; non deserializzare mai dati che arrivano dall'utente o da terzi.",
    refs: ["ASVS_DESER", "ASVS_INJECTION", "CRA_ANNEX1"],
    test: (line, file) => {
      const m = UNSAFE_DESER.exec(line);
      if (!m) return null;
      // js-yaml (JavaScript) è sicuro per impostazione predefinita dalla versione 4: yaml.load conta solo in Python e Ruby.
      if (/^yaml\.load/.test(m[0]) && !/\.(py|rb)$/i.test(file)) return null;
      return /pickle|Marshal|ObjectInputStream|readObject|BinaryFormatter|node-serialize|unserialize/i.test(m[0]) ? { note: m[0].slice(0, 40).trim() } : { risk: "medium", note: m[0].slice(0, 40).trim() };
    },
  },
  {
    id: "SEC-13", title: "Percorso di file costruito con dati dell'utente (path traversal)", category: "sicurezza", risk: "high",
    why: "Se il nome del file arriva dalla richiesta senza controlli, con ../ si leggono o si scrivono file fuori dalla cartella prevista, comprese configurazioni e credenziali.",
    action: "Accettare solo nomi di file da un elenco o un identificativo, ricostruire il percorso sul server, normalizzarlo e verificare che resti dentro la cartella ammessa.",
    refs: ["ASVS_FILE_STORAGE", "ASVS_FILE_DOWNLOAD", "ASVS_SANITIZE", "CRA_ANNEX1"],
    test: (line) => {
      if (!FILE_OP.test(line) || !USER_INPUT.test(line)) return null;
      if (PATH_GUARD.test(line)) return null;
      return {};
    },
  },
  {
    id: "SEC-14", title: "Versione di TLS obsoleta consentita", category: "sicurezza", risk: "medium",
    why: "SSLv3, TLS 1.0 e TLS 1.1 hanno vulnerabilità note e non sono più accettati dagli standard: la cifratura del trasporto non è più garantita.",
    action: "Consentire solo TLS 1.2 e 1.3 nelle configurazioni dei server, dei client e delle librerie, e verificare i cifrari ammessi.",
    refs: ["ASVS_TLS_GENERAL", "AGID_PW_NET", "GDPR32", "CRA_ANNEX1"],
    files: isConfig,
    test: (line) => {
      const m = TLS_OLD.exec(line);
      if (!m) return null;
      // Una riga che elenca anche 1.2 o 1.3 accanto alle versioni vecchie le sta abilitando insieme: resta un esito.
      return { note: m[0].slice(0, 50).trim() };
    },
  },
  {
    id: "PRIV-09", title: "Consenso preselezionato", category: "privacy", risk: "high",
    why: "Una casella già spuntata non è un consenso: il GDPR richiede un'azione positiva e inequivocabile, e le linee guida sui modelli ingannevoli lo considerano una violazione.",
    action: "Lasciare la casella deselezionata, separare i consensi per finalità e registrare la scelta dell'utente con data e testo mostrato.",
    refs: ["GDPR7_2", "EDPB_DARK_PRESEL", "EDPB_DARK_DEFAULT", "GARANTE_COOKIE_DEFAULT"],
    files: isMarkup,
    test: (line) => {
      // Conta solo la preselezione scritta nel codice: checked senza valore, checked="true",
      // checked={true} o defaultChecked. Un valore dinamico (checked={stato}) è una scelta dell'utente.
      const m = /<(input|Checkbox|Switch|Toggle|FormControlLabel|Field)\b[^>]*\b(checked|defaultChecked|default-checked)(?!\s*=\s*(?!\{?\s*true\s*\}?|["'](true|checked)["'])\S)[^>]*>/i.exec(line);
      if (!m) return null;
      if (/type\s*=\s*['"](radio|hidden)['"]/i.test(m[0])) return null;
      if (!CONSENT_WORDS.test(line)) return null;
      if (/(required|necessari|essential|tecnici|technical|strettamente)/i.test(line) && !/(marketing|profilaz|newsletter|third|terze)/i.test(line)) return null;
      return {};
    },
  },
  {
    id: "PRIV-10", title: "Risorse caricate da server extra UE a ogni visita", category: "privacy", risk: "medium",
    why: "Caratteri, script, video o mappe caricati dai server del fornitore trasmettono l'indirizzo IP del visitatore fuori dall'UE prima di qualsiasi consenso; per Google Fonts esistono già condanne e provvedimenti.",
    action: "Servire caratteri e librerie dal proprio dominio; caricare video, mappe e captcha solo dopo il consenso o usare le versioni senza cookie (youtube-nocookie) e un fornitore europeo dove possibile.",
    refs: ["GDPR44", "GDPR13", "EPRIVACY53", "GARANTE_COOKIE"],
    test: (line) => {
      if (/youtube-nocookie|self-?hosted|@fontsource|localhost/i.test(line)) return null;
      // Una direttiva Content-Security-Policy che ammette un host non carica nulla.
      if (/(-src\b|content-security-policy|\bcsp\b)/i.test(line)) return null;
      for (const [re, what] of EXTRA_EU_RESOURCES) if (re.test(line)) return { note: what };
      return null;
    },
  },
  {
    id: "PRIV-11", title: "Accesso a fotocamera, microfono, contatti o foto", category: "privacy", risk: "medium",
    why: "Immagini, voce e rubrica sono dati personali dell'utente e spesso di terzi: l'accesso richiede una finalità precisa, il consenso sul dispositivo e un'informativa che lo spieghi.",
    action: "Chiedere il permesso solo al momento della funzione che lo richiede, spiegarne l'uso nell'informativa, non conservare più del necessario e non inviare i dati a terzi senza base giuridica.",
    refs: ["GDPR6", "GDPR13", "GDPR25", "EPRIVACY53"],
    test: (line) => {
      const m = DEVICE_ACCESS.exec(line);
      if (!m) return null;
      return /CONTACTS|contacts|CALL_LOG|READ_SMS|Contact/.test(m[0]) ? { risk: "high", note: "rubrica, chiamate o messaggi: dati di terzi" } : { note: m[0].slice(0, 40) };
    },
  },
  {
    id: "AI-03", title: "Riconoscimento delle emozioni o categorizzazione biometrica", category: "ai", risk: "high",
    why: "L'AI Act vieta il riconoscimento delle emozioni sul lavoro e a scuola e la categorizzazione biometrica per dedurre origine etnica, opinioni, orientamento sessuale o convinzioni; negli altri contesti è alto rischio.",
    action: "Verificare se l'uso rientra nelle pratiche vietate dall'art. 5; se ammesso, trattarlo come sistema ad alto rischio con valutazione d'impatto, informativa e sorveglianza umana.",
    refs: ["AIACT5", "AIACT6_2", "GDPR9", "GDPR35"],
    test: (line) => {
      if (/@emotion\b|emotion\/(react|styled|css)|emotion-js|framer|animation/i.test(line)) return null;
      const m = EMOTION_BIOMETRIC.exec(line);
      return m ? { note: m[0].slice(0, 50) } : null;
    },
  },
  {
    id: "AI-04", title: "Decisione automatizzata su persone (candidati, dipendenti, credito, studenti, pazienti)", category: "ai", risk: "high",
    why: "Punteggi, classifiche o esclusioni automatiche di persone in ambito lavoro, credito, istruzione, sanità o servizi essenziali sono sistemi ad alto rischio per l'AI Act e decisioni soggette all'art. 22 GDPR.",
    action: "Prevedere l'intervento umano prima della decisione, informare le persone, documentare il sistema (valutazione d'impatto, registro dei sistemi di IA) e verificare gli obblighi del deployer.",
    refs: ["GDPR22", "AIACT6_2", "AIACT_ANNEX3", "AIACT26", "GDPR35"],
    test: (line) => {
      const code = stripLiterals(line);
      if (!DECISION_VERB.test(code) || !PERSON_DECISION.test(code)) return null;
      // Serve un segnale di modello o di regola automatica sulla stessa riga: un semplice ordinamento non basta.
      if (!/(model|predict|classif|ml\b|ai\b|score|scoring|rank|reject|deny|approve|eligib|shortlist|threshold|probab)/i.test(code)) return null;
      if (/(test_?score|exam_?score|quiz|grade_?book|leaderboard|game|match_?score|z-?index|scoreboard|highscore|credit_?card|credits?\s*[:=]\s*\d)/i.test(code)) return null;
      return {};
    },
  },
  {
    id: "SEC-15", title: "Regola sulle password troppo debole", category: "sicurezza", risk: "medium",
    why: "Una lunghezza minima sotto gli 8 caratteri o un limite massimo basso rendono le password indovinabili; gli standard chiedono almeno 8 caratteri (12 senza secondo fattore) e nessun limite stretto verso l'alto.",
    action: "Richiedere almeno 8 caratteri, meglio 12, consentire almeno 64 caratteri e ogni tipo di carattere, confrontare con gli elenchi di password compromesse e preferire l'autenticazione a più fattori alle regole di composizione.",
    refs: ["ASVS_PASSWORD", "GDPR32", "AGID_PW_HASH"],
    test: (line, file) => {
      if (!/pass(word|wd)?|pwd/i.test(line)) return null;
      // In un modulo di accesso la lunghezza minima non è la regola sulle password: quella sta nella registrazione.
      if (/(^|\/)(login|signin|sign-in|accesso)[^/]*$/i.test(file)) return null;
      const m = /(min(imum)?_?length|minlength|min_?len)\s*[:=(]\s*["']?([1-7])\b(?![.\d])|\.length\s*(<|<=)\s*([1-7])\b(?![.\d])|\.length\s*(>=|>)\s*([0-6])\b(?![.\d])|min\(\s*([2-7])\s*[,)]|(max(imum)?_?length|maxlength|max_?len)\s*[:=(]\s*["']?([1-9]|[1-5]\d|6[0-3])\b(?![.\d])/i.exec(line);
      if (!m) return null;
      if (/pin\b|otp|code|codice|cvv|login|signin|sign_in|accesso/i.test(line)) return null;
      const n = m[3] || m[5] || m[7] || m[8] || m[11];
      return /max/i.test(m[0]) ? { risk: "low", note: `lunghezza massima ${n}` } : { note: `lunghezza minima ${n}` };
    },
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

/** Regole che leggono il file intero (tag su più righe, etichette altrove nel file, valori usati righe dopo). */
export interface FileRule {
  id: string; title: string; category: Category; risk: Risk; why: string; action: string; refs: string[];
  test: (content: string, file: string) => import("./markup.ts").FileHit[];
}

import { autoplayMedia, clickableWithoutRole, decodedTokenTrusted, focusRemoved, missingTitle, pathFromRequestAcrossLines, unlabeledFields, unnamedControls } from "./markup.ts";

export const FILE_RULES: FileRule[] = [
  {
    id: "ACC-03", title: "Campo di modulo senza etichetta", category: "accessibilita", risk: "medium",
    why: "Senza un'etichetta collegata, chi usa un lettore di schermo non sa cosa inserire nel campo; il segnaposto non basta perché sparisce scrivendo.",
    action: "Collegare un <label for> al campo (o avvolgerlo in <label>), oppure aggiungere aria-label o aria-labelledby.",
    refs: ["WCAG_332", "WCAG_131", "WCAG_412", "EAA4"],
    test: unlabeledFields,
  },
  {
    id: "ACC-04", title: "Pulsante o link senza nome accessibile", category: "accessibilita", risk: "medium",
    why: "Un pulsante o un link fatto solo di un'icona viene letto come \"pulsante\" senza dire cosa fa; un link senza href non si raggiunge da tastiera.",
    action: "Aggiungere un testo visibile o aria-label all'elemento (o alt all'icona), e usare <button> al posto di <a> senza destinazione.",
    refs: ["WCAG_412", "WCAG_244", "WCAG_211", "EAA4"],
    test: unnamedControls,
  },
  {
    id: "ACC-05", title: "Indicatore di focus rimosso", category: "accessibilita", risk: "medium",
    why: "Con outline: none chi naviga da tastiera non vede più dove si trova; è uno dei difetti più segnalati nelle verifiche di accessibilità.",
    action: "Togliere outline: none oppure sostituirlo con un indicatore visibile equivalente (outline personalizzato, box-shadow, focus:ring).",
    refs: ["WCAG_247", "EAA4"],
    test: focusRemoved,
  },
  {
    id: "ACC-06", title: "Pagina senza titolo", category: "accessibilita", risk: "low",
    why: "Il titolo della pagina è la prima cosa che un lettore di schermo annuncia e ciò che compare nelle schede del browser.",
    action: "Aggiungere un <title> descrittivo nell'head di ogni documento.",
    refs: ["WCAG_242", "EAA4"],
    test: missingTitle,
  },
  {
    id: "ACC-07", title: "Audio o video in riproduzione automatica", category: "accessibilita", risk: "medium",
    why: "Un contenuto che parte da solo disturba chi usa un lettore di schermo e chi ha difficoltà di attenzione: deve poter essere fermato o non avere audio.",
    action: "Togliere autoplay, oppure aggiungere i controlli (controls) e, se il video è decorativo, tenerlo muto con un modo per fermarlo.",
    refs: ["WCAG_142", "WCAG_222", "EAA4"],
    test: autoplayMedia,
  },
  {
    id: "ACC-08", title: "Elemento cliccabile senza ruolo né tastiera, o ordine di tabulazione forzato", category: "accessibilita", risk: "low",
    why: "Un div o uno span con onClick non è raggiungibile con Tab e non viene annunciato come pulsante; un tabindex positivo rompe l'ordine naturale di navigazione.",
    action: "Usare <button> o <a href>, oppure aggiungere role, tabindex=\"0\" e la gestione della tastiera; non usare tabindex maggiori di zero.",
    refs: ["WCAG_412", "WCAG_211", "WCAG_243", "EAA4"],
    test: clickableWithoutRole,
  },
  {
    id: "SEC-13", title: "Percorso di file costruito con dati dell'utente (path traversal)", category: "sicurezza", risk: "high",
    why: "Se il nome del file arriva dalla richiesta senza controlli, con ../ si leggono o si scrivono file fuori dalla cartella prevista, comprese configurazioni e credenziali.",
    action: "Accettare solo nomi di file da un elenco o un identificativo, ricostruire il percorso sul server, normalizzarlo e verificare che resti dentro la cartella ammessa.",
    refs: ["ASVS_FILE_STORAGE", "ASVS_FILE_DOWNLOAD", "ASVS_SANITIZE", "CRA_ANNEX1"],
    test: (content, file) => pathFromRequestAcrossLines(content, file, USER_INPUT, FILE_OP, PATH_GUARD),
  },
  {
    id: "SEC-11", title: "Token JWT accettato senza verificare la firma o la scadenza", category: "sicurezza", risk: "high",
    why: "Se il token non viene verificato, chiunque può fabbricarne uno e presentarsi come un altro utente o come amministratore.",
    action: "Verificare sempre firma e scadenza con la chiave o il certificato del server, rifiutare l'algoritmo none e non leggere identità o ruoli da un token solo decodificato.",
    refs: ["ASVS_TOKEN", "GDPR32", "CRA_ANNEX1"],
    test: decodedTokenTrusted,
  },
];

export const RULES_VERSION = "2026-09-23.3";

export function escapeRe(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** File di traduzioni e testi dell'interfaccia: parole, non codice. Si saltano del tutto. */
export const TEXT_FILE = /(^|\/)(i18n|locales?|lang|langs|languages|translations?|messages)\/|(^|\/)[a-z]{2}([-_][A-Za-z]{2,4})?\.(json|ya?ml)$|\.(po|pot|resx|strings|xlf|xliff)$|(^|\/)strings\.xml$/i;

/** File che contengono per mestiere valori finti: un segreto lì dentro pesa meno. */
export const TEST_FILE = /(^|\/)(tests?|__tests__|spec|specs|fixtures?|mocks?|examples?|samples?|seed|seeds|demo)\/|[._-](test|spec|mock|fixture|example|sample)\.[a-z]+$|\.(example|sample|template)$/i;

export function isCommentLine(line: string): boolean {
  const t = line.trim();
  return t.startsWith("//") || t.startsWith("#") || t.startsWith("*") || t.startsWith("/*") || t.startsWith("<!--") || t.startsWith("--") || t.startsWith("'''") || t.startsWith('"""');
}
