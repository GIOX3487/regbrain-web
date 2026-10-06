// Copertura dei requisiti. Il referto non dice solo "cosa è scattato": per ogni linea guida
// elenca i requisiti applicabili al contesto, dice con quale metodo ciascuno è stato
// verificato e con quale esito, e dichiara quelli che il codice da solo non permette di
// valutare. È la differenza fra "ho trovato un problema" e "ho verificato questo requisito".
//
// Esiti possibili per ogni requisito:
// - esiti: i controlli hanno trovato problemi (gli esiti sono elencati nel referto);
// - superato: c'è una prova positiva (per esempio tutti i tracker partono dopo un controllo
//   del consenso, tutte le rotte hanno un controllo di autorizzazione);
// - nessun_esito: le regole hanno letto tutti i file e non hanno trovato i pattern che
//   conoscono. Non è una prova di conformità: è l'assenza dei difetti noti;
// - non_valutabile: richiede una verifica a video, dinamica o documentale, indicata;
// - non_applicabile: fuori dal contesto dichiarato o dedotto.

import type { Ctx } from "./scan.ts";
import { ctxList } from "./scan.ts";
import type { Route } from "./routes.ts";
import type { Evidence as Proof } from "./consent.ts";

export type ReqOutcome = "esiti" | "superato" | "nessun_esito" | "non_valutabile" | "non_applicabile";
export type ReqMethod = "regole" | "strutturale" | "manuale";

/** Prove raccolte dall'analisi strutturale, oltre agli esiti delle regole. */
export interface ScanEvidence {
  trackers: { total: number; gated: Proof[]; ungated: number };
  consentManager: Proof[];
  routes: { total: number; protected: number; publicByNature: number; unprotected: Route[]; frameworks: string[]; globalGuards: Array<{ file: string; line: number; snippet: string; scope: string }> };
}

export interface Requirement {
  id: string;
  guideline: string;
  title: string;
  /** L'obbligo in una frase, per chi non programma. */
  what: string;
  refs: string[];
  method: ReqMethod;
  rules?: string[];
  /** Cosa deve verificare una persona quando il codice non basta. */
  manual?: string;
  /** Gli esiti delle regole collegate sono una presenza da verificare, non un problema (es. AI-01). */
  hitsArePresence?: boolean;
  /** Vero se si applica; una stringa è il motivo per cui non si applica. */
  applies?: (ctx: Ctx, fileNames: string[]) => true | string;
  structural?: (ev: ScanEvidence) => { outcome: ReqOutcome; note: string; evidence?: Proof[] } | null;
}

export interface RequirementResult {
  id: string; guideline: string; title: string; what: string; refs: string[]; method: ReqMethod;
  outcome: ReqOutcome;
  /** Esiti delle regole collegati (id), prove strutturali, oppure cosa resta da verificare. */
  findings: string[];
  evidence: Proof[];
  note: string;
  /** Osservazione del modello sugli estratti, quando il requisito non è valutabile dalle regole. */
  aiObservation?: { text: string; file?: string; line?: number };
}

const MARKUP = /\.(html?|jsx|tsx|vue|svelte|astro|php|erb|hbs|ejs|twig|cshtml|razor)$/i;
const SERVER = /\.(js|mjs|cjs|ts|mts|py|java|kt|go|php|cs|rb)$/i;

const isWeb = (ctx: Ctx) => ctxList(ctx, "appTypes").some((t) => ["web", "mobile"].includes(t));
const hasMarkup = (names: string[]) => names.some((n) => MARKUP.test(n));
const hasServer = (names: string[]) => names.some((n) => SERVER.test(n));
const personal = (ctx: Ctx) => ctx.personalData === "si";
const usesAI = (ctx: Ctx) => ctx.usesAI === "si";
const has = (ctx: Ctx, key: "sectors" | "audiences", v: string) => ctxList(ctx, key).includes(v);

const G = {
  gdpr: "GDPR e Codice privacy",
  cookie: "ePrivacy e linee guida cookie del Garante",
  sec: "Sicurezza del software (CRA, OWASP ASVS, AgID)",
  nis2: "NIS2 e D.Lgs. 138/2024",
  ai: "AI Act e L. 132/2025",
  acc: "Accessibilità (EAA, WCAG 2.2)",
  lic: "Licenze open source",
  sector: "Fonti di settore",
};

export const REQUIREMENTS: Requirement[] = [
  // GDPR
  { id: "R-GDPR-01", guideline: G.gdpr, title: "Credenziali e chiavi fuori dal codice", what: "Le misure di sicurezza (art. 32) includono la custodia delle credenziali: nel codice distribuito non devono esserci chiavi, password o token.", refs: ["GDPR32", "ASVS_SECRETS", "AGID_KEYS"], method: "regole", rules: ["SEC-01"] },
  { id: "R-GDPR-02", guideline: G.gdpr, title: "Cifratura e protocolli aggiornati", what: "I dati personali viaggiano cifrati con protocolli attuali e gli algoritmi usati per password e firme non sono superati.", refs: ["GDPR32", "ASVS_TLS_GENERAL", "ASVS_HASH"], method: "regole", rules: ["SEC-02", "SEC-03", "SEC-04", "SEC-14", "SEC-10"] },
  {
    id: "R-GDPR-03", guideline: G.gdpr, title: "Controllo degli accessi sulle API", what: "Ogni endpoint che legge o modifica dati personali verifica chi è l'utente e cosa può fare (art. 32 e art. 25).", refs: ["GDPR32", "GDPR25"], method: "strutturale",
    applies: (_c, names) => hasServer(names) || "nessun file di backend fra quelli analizzati",
    structural: routesOutcome,
  },
  { id: "R-GDPR-04", guideline: G.gdpr, title: "Autenticazione e sessioni protette", what: "I token sono verificati, i cookie di sessione protetti, le password robuste e non conservate dove uno script le legge.", refs: ["GDPR32", "ASVS_TOKEN", "ASVS_COOKIE", "ASVS_PASSWORD"], method: "regole", rules: ["SEC-11", "SEC-07", "PRIV-06", "SEC-15"] },
  { id: "R-GDPR-05", guideline: G.gdpr, title: "Protezione da iniezioni e input non fidato", what: "Query, comandi, percorsi di file e dati deserializzati non vengono costruiti con input dell'utente senza controlli.", refs: ["GDPR32", "ASVS_INJECTION", "ASVS_SANITIZE"], method: "regole", rules: ["SEC-05", "SEC-06", "SEC-12", "SEC-13"] },
  { id: "R-GDPR-06", guideline: G.gdpr, title: "Minimizzazione: niente dati personali nei log", what: "I log non registrano dati personali, segreti o indirizzi IP oltre il necessario (art. 5 par. 1 lett. c).", refs: ["GDPR5", "ASVS_LOGGING"], method: "regole", rules: ["PRIV-02", "PRIV-08"] },
  {
    id: "R-GDPR-07", guideline: G.gdpr, title: "Categorie particolari di dati", what: "Salute, biometria, religione, orientamento e simili richiedono una base giuridica dell'art. 9 e, di regola, una DPIA.", refs: ["GDPR9", "GDPR35"], method: "regole", rules: ["PRIV-05"],
    applies: (c) => personal(c) || "l'applicazione non tratta dati personali",
    manual: "Se il codice tratta categorie particolari, verificare base giuridica (art. 9 par. 2) e DPIA.",
  },
  { id: "R-GDPR-08", guideline: G.gdpr, title: "Trasferimenti fuori dall'Unione", what: "Dati inviati o ospitati fuori dall'UE richiedono una base per il trasferimento (capo V).", refs: ["GDPR44"], method: "regole", rules: ["PRIV-07", "PRIV-10"], applies: (c) => personal(c) || "l'applicazione non tratta dati personali" },
  { id: "R-GDPR-09", guideline: G.gdpr, title: "Consenso libero, senza caselle preselezionate", what: "Il consenso è valido solo se è un'azione positiva dell'utente: niente caselle già spuntate.", refs: ["GDPR7_2", "EDPB_DARK_PRESEL"], method: "regole", rules: ["PRIV-09"], applies: (_c, names) => hasMarkup(names) || "nessun file di interfaccia fra quelli analizzati" },
  { id: "R-GDPR-10", guideline: G.gdpr, title: "Privacy by design: posizione, fotocamera, contatti, impronta del dispositivo", what: "Gli accessi al dispositivo e il tracciamento dell'utente devono essere necessari allo scopo e dichiarati (art. 25 e art. 5).", refs: ["GDPR25", "GDPR5"], method: "regole", rules: ["PRIV-03", "PRIV-04", "PRIV-11"] },
  { id: "R-GDPR-11", guideline: G.gdpr, title: "Informativa agli interessati", what: "L'informativa (art. 13) esiste, è raggiungibile e descrive i trattamenti che il codice esegue davvero.", refs: ["GDPR13"], method: "manuale", manual: "Confrontare l'informativa pubblicata con i trattamenti censiti nel referto (tracker, servizi esterni, dati raccolti).", applies: (c) => personal(c) || "l'applicazione non tratta dati personali" },
  { id: "R-GDPR-12", guideline: G.gdpr, title: "Esercizio dei diritti: accesso, cancellazione, portabilità", what: "Esistono funzioni o procedure per esportare e cancellare i dati di una persona.", refs: ["GDPR13", "GDPR5"], method: "manuale", manual: "Verificare la presenza di cancellazione dell'account ed esportazione dei dati, o di una procedura equivalente.", applies: (c) => personal(c) || "l'applicazione non tratta dati personali" },
  { id: "R-GDPR-13", guideline: G.gdpr, title: "Conservazione limitata nel tempo", what: "I dati hanno una scadenza e vengono cancellati o anonimizzati quando non servono più (art. 5 par. 1 lett. e).", refs: ["GDPR5"], method: "manuale", manual: "Cercare politiche di scadenza (TTL, job di pulizia, retention) nelle tabelle che contengono dati personali.", applies: (c) => personal(c) || "l'applicazione non tratta dati personali" },
  { id: "R-GDPR-14", guideline: G.gdpr, title: "Fornitori e responsabili del trattamento", what: "Ogni servizio esterno che riceve dati personali è un responsabile con un contratto ex art. 28.", refs: ["GDPR28"], method: "manuale", manual: "Per i servizi esterni censiti nel referto (analytics, cloud, IA) verificare l'esistenza del contratto art. 28 e dell'elenco dei sub-responsabili.", applies: (c) => personal(c) || "l'applicazione non tratta dati personali" },
  { id: "R-GDPR-15", guideline: G.gdpr, title: "Minori: età e consenso dei genitori", what: "Sotto i 14 anni il consenso è dei genitori; serve una verifica dell'età proporzionata.", refs: ["GDPR8", "CP2QUINQUIES"], method: "manuale", manual: "Verificare il meccanismo di verifica dell'età e del consenso del genitore.", applies: (c) => has(c, "audiences", "minori") || "l'applicazione non è rivolta a minori" },
  { id: "R-GDPR-16", guideline: G.gdpr, title: "Decisioni automatizzate su persone", what: "Una decisione presa solo da un algoritmo con effetti su una persona richiede intervento umano, informazione e possibilità di contestare (art. 22).", refs: ["GDPR22"], method: "regole", rules: ["AI-04"] },

  // ePrivacy e cookie
  {
    id: "R-COOKIE-01", guideline: G.cookie, title: "Tracciamento di terze parti solo dopo il consenso", what: "Analytics, pixel e SDK di profilazione partono solo dopo il consenso, non al caricamento della pagina.", refs: ["EPRIVACY53", "CP122", "GARANTE_COOKIE"], method: "strutturale", rules: ["PRIV-01"],
    applies: (c) => isWeb(c) || "non è un'applicazione web o mobile",
    structural: (ev) => {
      if (ev.trackers.total === 0) return { outcome: "nessun_esito", note: "Nessuno strumento di tracciamento di terze parti riconosciuto nel codice." };
      if (ev.trackers.ungated === 0) return { outcome: "superato", note: `${ev.trackers.total} punti di tracciamento, tutti protetti da un controllo del consenso riconoscibile.`, evidence: ev.trackers.gated.slice(0, 6) };
      return { outcome: "esiti", note: `${ev.trackers.ungated} punti di tracciamento su ${ev.trackers.total} partono senza un controllo del consenso riconoscibile${ev.trackers.gated.length ? `; ${ev.trackers.gated.length} sono protetti` : ""}.`, evidence: ev.trackers.gated.slice(0, 4) };
    },
  },
  {
    id: "R-COOKIE-02", guideline: G.cookie, title: "Gestore del consenso nel codice", what: "Esiste un banner o una libreria che raccoglie, registra e fa rispettare il consenso ai cookie.", refs: ["GARANTE_COOKIE", "GARANTE_COOKIE_DEFAULT"], method: "strutturale",
    applies: (c, names) => (isWeb(c) && hasMarkup(names)) || "nessuna interfaccia web fra i file analizzati",
    structural: (ev) => {
      if (ev.consentManager.length) return { outcome: "superato", note: "Gestore del consenso presente in righe di codice (commenti e TODO non contano).", evidence: ev.consentManager.slice(0, 4) };
      if (ev.trackers.total === 0) return { outcome: "non_valutabile", note: "Nessun gestore del consenso e nessun tracker riconosciuti: se la pagina usa solo cookie tecnici il banner non serve; va confermato." };
      return { outcome: "esiti", note: "Strumenti di tracciamento presenti e nessun gestore del consenso in alcuna riga di codice." };
    },
  },
  { id: "R-COOKIE-03", guideline: G.cookie, title: "Rifiuto facile quanto l'accettazione, niente preselezioni", what: "Il banner offre un rifiuto con la stessa evidenza dell'accettazione e nessuna scelta è preselezionata.", refs: ["GARANTE_COOKIE_DEFAULT", "EDPB_DARK_DEFAULT"], method: "manuale", rules: ["PRIV-09"], manual: "Le regole trovano le caselle preselezionate; il pulsante di rifiuto e la pari evidenza vanno verificati a video.", applies: (c, names) => (isWeb(c) && hasMarkup(names)) || "nessuna interfaccia web fra i file analizzati" },

  // Sicurezza del software
  { id: "R-SEC-01", guideline: G.sec, title: "Nessuna vulnerabilità nota sfruttabile", what: "Iniezioni, deserializzazione di dati non fidati, esecuzione dinamica e path traversal sono le vulnerabilità che il CRA chiede di escludere dal prodotto.", refs: ["CRA_ANNEX1", "ASVS_INJECTION", "ASVS_DESER", "ASVS_FILE_STORAGE"], method: "regole", rules: ["SEC-05", "SEC-06", "SEC-12", "SEC-13"] },
  { id: "R-SEC-02", guideline: G.sec, title: "Configurazione sicura di default", what: "Niente modalità di debug in produzione, CORS aperto a tutti o cookie senza attributi di sicurezza.", refs: ["CRA_ANNEX1", "ASVS_HEADERS", "ASVS_COOKIE"], method: "regole", rules: ["SEC-07", "SEC-08", "SEC-09"] },
  { id: "R-SEC-03", guideline: G.sec, title: "Riservatezza in transito", what: "Connessioni cifrate con certificato verificato e versioni di TLS attuali.", refs: ["CRA_ANNEX1", "ASVS_TLS_EXT", "ASVS_TLS_GENERAL"], method: "regole", rules: ["SEC-03", "SEC-04", "SEC-14"] },
  { id: "R-SEC-04", guideline: G.sec, title: "Autenticazione robusta", what: "Password con requisiti adeguati e hash moderni, token verificati in firma e scadenza, numeri casuali sicuri.", refs: ["ASVS_PASSWORD", "ASVS_TOKEN", "AGID_PW_HASH", "ASVS_RANDOM"], method: "regole", rules: ["SEC-15", "SEC-11", "SEC-02", "SEC-10"] },
  {
    id: "R-SEC-05", guideline: G.sec, title: "Controllo di autorizzazione su ogni endpoint", what: "Ogni rotta che modifica dati ha un controllo di autenticazione e autorizzazione riconoscibile.", refs: ["CRA_ANNEX1", "GDPR32"], method: "strutturale",
    applies: (_c, names) => hasServer(names) || "nessun file di backend fra quelli analizzati",
    structural: routesOutcome,
  },
  { id: "R-SEC-06", guideline: G.sec, title: "Gestione delle vulnerabilità e delle dipendenze", what: "Il CRA richiede un inventario dei componenti (SBOM) e un processo di aggiornamento delle dipendenze vulnerabili.", refs: ["CRA_ANNEX1B"], method: "manuale", manual: "Verificare l'inventario delle dipendenze, la scansione delle vulnerabilità note e la politica di aggiornamento." },
  { id: "R-SEC-07", guideline: G.sec, title: "Registrazione degli eventi di sicurezza", what: "Accessi e operazioni sensibili sono registrati, senza scrivere nei log dati personali o segreti.", refs: ["ASVS_LOGGING"], method: "manuale", rules: ["PRIV-02"], manual: "Le regole trovano i dati sensibili nei log; che gli eventi di sicurezza siano registrati va verificato sulla configurazione del logging." },

  // NIS2
  { id: "R-NIS2-01", guideline: G.nis2, title: "Misure di gestione dei rischi: accessi, crittografia, vulnerabilità", what: "L'art. 24 del D.Lgs. 138/2024 richiede controllo degli accessi, crittografia e gestione delle vulnerabilità proporzionate al rischio.", refs: ["NIS2_IT_24"], method: "regole", rules: ["SEC-01", "SEC-02", "SEC-03", "SEC-04", "SEC-05", "SEC-11", "SEC-12", "SEC-13", "SEC-14"], applies: (c) => has(c, "sectors", "nis2") || "l'organizzazione non è un soggetto NIS2" },

  // AI Act
  { id: "R-AI-01", guideline: G.ai, title: "Trasparenza: l'utente sa di interagire con un'IA", what: "Chi interagisce con un sistema di IA deve essere informato (art. 50 par. 1), con avviso leggibile anche dai minori (L. 132/2025).", refs: ["AIACT50_1", "LEGGE_IA_4"], method: "manuale", rules: ["AI-01"], hitsArePresence: true, manual: "Dove il codice chiama un servizio di IA verso l'utente, verificare che l'interfaccia lo dichiari.", applies: (c) => usesAI(c) || "l'applicazione non usa servizi di IA" },
  { id: "R-AI-02", guideline: G.ai, title: "Contenuti sintetici marcati", what: "Immagini, audio e video generati dall'IA devono essere riconoscibili come tali (art. 50 par. 2).", refs: ["AIACT50_2"], method: "manuale", rules: ["AI-02"], hitsArePresence: true, manual: "Verificare che i contenuti generati portino una marcatura leggibile dalle macchine.", applies: (c) => usesAI(c) || "l'applicazione non usa servizi di IA" },
  { id: "R-AI-03", guideline: G.ai, title: "Pratiche vietate: emozioni e categorizzazione biometrica", what: "Riconoscere emozioni sul lavoro o a scuola e dedurre categorie protette dai dati biometrici è vietato (art. 5).", refs: ["AIACT5"], method: "regole", rules: ["AI-03"] },
  { id: "R-AI-04", guideline: G.ai, title: "Sistemi ad alto rischio: decisioni su persone", what: "Selezione del personale, credito, istruzione e sanità sono casi dell'allegato III: obblighi di gestione del rischio e sorveglianza umana.", refs: ["AIACT6_2", "AIACT_ANNEX3", "GDPR22"], method: "regole", rules: ["AI-04"] },
  { id: "R-AI-05", guideline: G.ai, title: "IA sui lavoratori: informazione preventiva", what: "I lavoratori e le loro rappresentanze vanno informati prima dell'uso di sistemi di IA che li riguardano (art. 26 par. 7; L. 132/2025 art. 11).", refs: ["AIACT26", "LEGGE_IA_11"], method: "manuale", manual: "Verificare l'informativa ai lavoratori e, dove serve, l'accordo sindacale.", applies: (c) => (usesAI(c) && has(c, "audiences", "dipendenti")) || "l'IA non è usata su dipendenti" },

  // Accessibilità
  { id: "R-ACC-01", guideline: G.acc, title: "Alternative testuali per le immagini", what: "Ogni immagine informativa ha un testo alternativo.", refs: ["WCAG_111", "EAA4"], method: "regole", rules: ["ACC-01"], applies: accApplies },
  { id: "R-ACC-02", guideline: G.acc, title: "Lingua della pagina dichiarata", what: "Il documento dichiara la lingua, così i lettori di schermo la pronunciano correttamente.", refs: ["WCAG_311", "EAA4"], method: "regole", rules: ["ACC-02"], applies: accApplies },
  { id: "R-ACC-03", guideline: G.acc, title: "Etichette dei campi", what: "Ogni campo di modulo ha un'etichetta collegata.", refs: ["WCAG_332", "WCAG_131", "EAA4"], method: "regole", rules: ["ACC-03"], applies: accApplies },
  { id: "R-ACC-04", guideline: G.acc, title: "Nome accessibile di pulsanti e link", what: "Pulsanti e link hanno un nome che un lettore di schermo può annunciare.", refs: ["WCAG_412", "WCAG_244", "EAA4"], method: "regole", rules: ["ACC-04"], applies: accApplies },
  { id: "R-ACC-05", guideline: G.acc, title: "Focus visibile", what: "Chi naviga da tastiera vede sempre dove si trova.", refs: ["WCAG_247", "EAA4"], method: "regole", rules: ["ACC-05"], applies: accApplies },
  { id: "R-ACC-06", guideline: G.acc, title: "Titolo della pagina", what: "Ogni pagina ha un titolo descrittivo.", refs: ["WCAG_242", "EAA4"], method: "regole", rules: ["ACC-06"], applies: accApplies },
  { id: "R-ACC-07", guideline: G.acc, title: "Contenuti in movimento controllabili", what: "Audio e video non partono da soli, o si possono fermare.", refs: ["WCAG_142", "WCAG_222", "EAA4"], method: "regole", rules: ["ACC-07"], applies: accApplies },
  { id: "R-ACC-08", guideline: G.acc, title: "Operabilità da tastiera", what: "Tutto ciò che si clicca si raggiunge e si attiva da tastiera, nell'ordine naturale.", refs: ["WCAG_211", "WCAG_243", "EAA4"], method: "regole", rules: ["ACC-08"], applies: accApplies },
  { id: "R-ACC-09", guideline: G.acc, title: "Contrasto dei colori e ridimensionamento del testo", what: "Il contrasto fra testo e sfondo e la leggibilità a 200% si valutano a video.", refs: ["EAA4"], method: "manuale", manual: "Verificare contrasto e zoom con uno strumento di valutazione sulla pagina resa.", applies: accApplies },

  // Licenze
  { id: "R-LIC-01", guideline: G.lic, title: "Compatibilità delle licenze open source", what: "Componenti copyleft (GPL, AGPL, LGPL) impongono condizioni alla distribuzione del software che li include.", refs: ["LIC_GPL3", "LIC_AGPL3"], method: "regole", rules: ["LIC-01"] },

  // Settore
  { id: "R-SAN-01", guideline: G.sector, title: "Software medicale: qualificazione MDR", what: "Un software con finalità diagnostica o terapeutica è un dispositivo medico e segue il regolamento 2017/745.", refs: ["MDR_SW"], method: "manuale", manual: "Stabilire se il software rientra nella definizione di dispositivo medico e in quale classe.", applies: (c) => has(c, "sectors", "sanita") || "settore sanitario non dichiarato" },
  { id: "R-FIN-01", guideline: G.sector, title: "Autenticazione forte del cliente e resilienza ICT", what: "Pagamenti e accesso ai conti richiedono autenticazione forte (PSD2); i soggetti finanziari seguono DORA sulla gestione dei rischi ICT.", refs: ["PSD2_SCA4", "DORA9"], method: "manuale", manual: "Verificare i flussi di pagamento e accesso ai conti e il quadro DORA dell'organizzazione.", applies: (c) => has(c, "sectors", "finanza") || "settore finanziario non dichiarato" },
  { id: "R-PA-01", guideline: G.sector, title: "Pubblica amministrazione: identità digitale e accessibilità", what: "I servizi della PA usano SPID o CIE per l'accesso e rispettano gli obblighi di accessibilità della L. 4/2004.", refs: ["CAD64", "EAA4"], method: "manuale", manual: "Verificare l'accesso con SPID o CIE e la dichiarazione di accessibilità.", applies: (c) => has(c, "sectors", "pa") || "pubblica amministrazione non dichiarata" },
  { id: "R-CONS-01", guideline: G.sector, title: "Prodotti per consumatori: responsabilità e consenso", what: "Il software per consumatori risponde dei danni da difetto (direttiva 2024/2853) e il consenso richiesto deve essere libero.", refs: ["PLD7", "GDPR7_2"], method: "manuale", manual: "Verificare le condizioni d'uso e la gestione degli aggiornamenti di sicurezza verso i consumatori.", applies: (c) => has(c, "audiences", "consumatori") || "l'applicazione non è rivolta ai consumatori" },
];

function accApplies(c: Ctx, names: string[]): true | string {
  if (!isWeb(c)) return "non è un'applicazione web o mobile";
  if (!hasMarkup(names)) return "nessun file di interfaccia fra quelli analizzati";
  return true;
}

function routesOutcome(ev: ScanEvidence): { outcome: ReqOutcome; note: string; evidence?: Proof[] } {
  const r = ev.routes;
  if (r.total === 0) return { outcome: "non_valutabile", note: "Nessuna rotta HTTP riconosciuta: il framework non è fra quelli censiti (Express, Fastify, NestJS, Flask, FastAPI, Django, Spring, ASP.NET, Go, Laravel) o le rotte sono definite in modo non riconoscibile." };
  const bad = r.unprotected.length;
  const mutating = r.unprotected.filter((x) => x.mutating).length;
  if (bad === 0) return { outcome: "superato", note: `${r.total} rotte censite (${r.frameworks.join(", ")}): ${r.protected} con controllo riconoscibile, ${r.publicByNature} pubbliche per natura${r.globalGuards.length ? `, ${r.globalGuards.length} controlli globali` : ""}.`, evidence: r.globalGuards.slice(0, 3).map((g) => ({ file: g.file, line: g.line, snippet: g.snippet })) };
  return { outcome: "esiti", note: `${bad} rotte su ${r.total} senza controllo di autorizzazione riconoscibile, di cui ${mutating} in scrittura. Le altre: ${r.protected} con controllo, ${r.publicByNature} pubbliche per natura.` };
}

/** Valuta ogni requisito nel contesto, con gli esiti delle regole e le prove strutturali. */
export function assessRequirements(
  ctx: Ctx,
  findings: Array<{ id: string; ruleId: string | null; status: string }>,
  evidence: ScanEvidence,
  fileNames: string[],
): RequirementResult[] {
  const active = new Map<string, string[]>();
  for (const f of findings) {
    if (!f.ruleId || f.status === "possibile_falso_positivo") continue;
    active.set(f.ruleId, [...(active.get(f.ruleId) || []), f.id]);
  }
  return REQUIREMENTS.map((r) => {
    const base = { id: r.id, guideline: r.guideline, title: r.title, what: r.what, refs: r.refs, method: r.method };
    const app = r.applies ? r.applies(ctx, fileNames) : true;
    if (app !== true) return { ...base, outcome: "non_applicabile" as const, findings: [], evidence: [], note: app };
    const hits = (r.rules || []).flatMap((id) => active.get(id) || []);
    if (r.structural) {
      const s = r.structural(evidence);
      if (s) return { ...base, outcome: s.outcome, findings: hits, evidence: s.evidence || [], note: s.note };
    }
    if (hits.length && r.hitsArePresence) return { ...base, outcome: "non_valutabile" as const, findings: hits, evidence: [], note: `Rilevato nel codice (${[...new Set(hits)].join(", ")}). ${r.manual || ""}`.trim() };
    if (hits.length) return { ...base, outcome: "esiti" as const, findings: hits, evidence: [], note: `Esiti collegati: ${[...new Set(hits)].join(", ")}.${r.manual ? " " + r.manual : ""}` };
    if (r.method === "manuale") return { ...base, outcome: "non_valutabile" as const, findings: [], evidence: [], note: r.manual || "Richiede una verifica a video o documentale." };
    return { ...base, outcome: "nessun_esito" as const, findings: [], evidence: [], note: `Le regole ${(r.rules || []).join(", ")} hanno letto tutti i file senza trovare i pattern noti.` };
  });
}

export function summarizeRequirements(list: RequirementResult[]): Record<ReqOutcome, number> {
  const out: Record<ReqOutcome, number> = { esiti: 0, superato: 0, nessun_esito: 0, non_valutabile: 0, non_applicabile: 0 };
  for (const r of list) out[r.outcome]++;
  return out;
}

export const OUTCOME_LABEL: Record<ReqOutcome, string> = {
  esiti: "Verificato: problemi trovati",
  superato: "Verificato: superato",
  nessun_esito: "Verificato dalle regole: nessun esito",
  non_valutabile: "Non valutabile dal codice",
  non_applicabile: "Non applicabile",
};
