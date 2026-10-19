// Domande mirate. Il codice da solo non dice se un banner blocca davvero gli script, se le API
// stanno dietro un gateway, se una chiave trovata è reale o di prova, dove sono ospitati i dati.
// Ogni domanda nasce da una prova precisa (un esito, una prova strutturale, il contesto) e ogni
// risposta ha un effetto dichiarato e tracciabile: ricalibra il rischio di un esito oppure dà
// un esito "dichiarato dall'utente" a un requisito che le regole non possono valutare. Le
// risposte non cancellano mai un esito: lo spostano, con la motivazione scritta nel referto.
//
// Lo stesso modulo gira nel browser (le domande compaiono prima della verifica) e nella funzione
// (che applica le risposte e propone le domande rimaste). Niente dipendenze a runtime oltre a
// scan.ts, per poterlo importare da entrambe le parti.

import type { Ctx } from "./scan.ts";
import { ctxList } from "./scan.ts";
import type { ScanEvidence } from "./requirements.ts";
import type { InferredContext } from "./infer.ts";

export type QuestionKind = "single" | "multi" | "text";
export type Risk = "high" | "medium" | "low";
export type FindingStatus = "confermato" | "da_verificare" | "possibile_falso_positivo";

export interface CodeQuestion {
  id: string;
  text: string;
  /** Perché la risposta conta: cosa cambia nel referto. */
  why: string;
  kind: QuestionKind;
  options: string[];
  /** Esiti (id regola) e requisiti (id) su cui la risposta incide. */
  affects: string[];
  /** La prova nel codice che ha fatto scattare la domanda. */
  trigger: string;
  /** 1 = decide un esito a rischio alto; 2 = decide un requisito; 3 = contesto utile. */
  priority: 1 | 2 | 3;
  source: "regole" | "ai";
}

/** Una risposta: l'id lega la risposta ai suoi effetti; q e a restano leggibili nel referto. */
export interface Answer { id?: string; q: string; a: string }

export interface FindingLike {
  id: string;
  ruleId: string | null;
  risk: Risk;
  status: FindingStatus;
  totalOccurrences: number;
  occurrences: Array<{ file: string; line: number; note?: string }>;
  /** Rettifica applicata in base a una risposta, scritta nel referto. */
  adjustment?: string;
  action?: string;
}

export interface QuestionInput {
  ctx: Ctx;
  findings: FindingLike[];
  evidence: ScanEvidence;
  inferred: InferredContext | null;
  fileNames: string[];
}

export type DeclaredOutcome = "dichiarato" | "esiti" | "non_valutabile";

interface FindingEffect { ruleId: string; risk?: Risk; status?: FindingStatus; note: string }
interface RequirementEffect { id: string; outcome: DeclaredOutcome; note: string; /** Vale anche quando il codice ha dato "esiti": la dichiarazione sposta la prova fuori dal codice. */ override?: boolean }
export interface Effect { finding?: FindingEffect; requirement?: RequirementEffect }

interface QuestionDef extends Omit<CodeQuestion, "trigger" | "source"> {
  /** Vero (con la prova) se la domanda va posta in questo contesto. */
  when: (i: QuestionInput) => string | null;
  /** Effetti di una risposta data per opzione; il testo libero non produce effetti automatici. */
  effects?: (picked: (option: string) => boolean, i?: QuestionInput) => Effect[];
}

export const MAX_PRE_QUESTIONS = 10;
export const MAX_POST_QUESTIONS = 6;
export const NON_SO = "Non so";

const MARKUP = /\.(html?|jsx|tsx|vue|svelte|astro|php|erb|hbs|ejs|twig|cshtml|razor)$/i;
const SERVER = /\.(js|mjs|cjs|ts|mts|py|java|kt|go|php|cs|rb)$/i;
const MANIFEST = /(^|\/)(package\.json|requirements[\w.-]*\.txt|pyproject\.toml|Pipfile|pom\.xml|build\.gradle(\.kts)?|go\.mod|composer\.json|Gemfile|Cargo\.toml|[^/]*\.csproj)$/;

const has = (i: QuestionInput, ruleId: string) => i.findings.find((f) => f.ruleId === ruleId && f.status !== "possibile_falso_positivo") || null;
const personal = (i: QuestionInput) => i.ctx.personalData === "si" || ((i.inferred?.personalData?.length ?? 0) > 0 && i.ctx.personalData !== "no");
const usesAI = (i: QuestionInput) => i.ctx.usesAI === "si" || !!has(i, "AI-01") || ((i.inferred?.usesAI?.length ?? 0) > 0 && i.ctx.usesAI !== "no");
const isWeb = (i: QuestionInput) => ctxList(i.ctx, "appTypes").some((t) => t === "web" || t === "mobile");
const sector = (i: QuestionInput, s: string) => ctxList(i.ctx, "sectors").includes(s);
const audience = (i: QuestionInput, a: string) => ctxList(i.ctx, "audiences").includes(a);
const where = (f: FindingLike | null, n = 2) => f ? f.occurrences.slice(0, n).map((o) => `${o.file}:${o.line}`).join(", ") : "";
const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

/** Fornitori esterni riconosciuti nel codice: tracker, servizi di IA, risorse caricate da terzi. */
function externalProviders(i: QuestionInput): string[] {
  const out = new Set<string>();
  for (const f of i.findings) {
    if ((f.ruleId === "PRIV-01" || f.ruleId === "PRIV-10") && f.status !== "possibile_falso_positivo") {
      for (const o of f.occurrences) if (o.note) out.add(o.note.replace(/:.*$/, "").slice(0, 40));
    }
  }
  for (const a of i.inferred?.usesAI || []) out.add(a.value);
  return [...out].slice(0, 6);
}

const QUESTIONS: QuestionDef[] = [
  {
    id: "cmp", priority: 1, kind: "single",
    text: "Nel sito c'è un banner dei cookie (gestore del consenso) che tiene bloccati gli script di tracciamento finché la persona non acconsente?",
    why: "Decide se gli strumenti di tracciamento trovati sono un problema e come valutare i requisiti sul consenso.",
    options: ["Sì, blocca gli script fino al consenso", "Sì, ma gli script partono comunque al caricamento", "No, non c'è un banner", NON_SO],
    affects: ["PRIV-01", "R-COOKIE-01", "R-COOKIE-02"],
    when: (i) => { const f = has(i, "PRIV-01"); return f ? `${plural(f.totalOccurrences, "punto di tracciamento", "punti di tracciamento")} senza un controllo del consenso riconoscibile nel codice (${where(f)})` : null; },
    effects: (p) => p("Sì, blocca gli script fino al consenso") ? [
      { finding: { ruleId: "PRIV-01", risk: "medium", status: "da_verificare", note: "L'utente dichiara un gestore del consenso che blocca gli script fino al consenso. Nel codice non c'è un controllo riconoscibile in questi punti: va verificato a video, con il browser, che il blocco valga per ogni script elencato." } },
      { requirement: { id: "R-COOKIE-01", outcome: "dichiarato", override: true, note: "L'utente dichiara che gli script partono solo dopo il consenso tramite il gestore; il codice non lo mostra. Verificare a video: prima del consenso non devono partire richieste verso i domini dei tracker." } },
      { requirement: { id: "R-COOKIE-02", outcome: "dichiarato", note: "Gestore del consenso dichiarato dall'utente, non riconosciuto nelle righe di codice (potrebbe essere caricato da un tag manager). Indicare nel referto quale prodotto è e dove è configurato." } },
    ] : p("Sì, ma gli script partono comunque al caricamento") ? [
      { finding: { ruleId: "PRIV-01", note: "L'utente conferma che gli script partono al caricamento, prima del consenso: il banner non è efficace." } },
      { requirement: { id: "R-COOKIE-01", outcome: "esiti", note: "L'utente conferma che il tracciamento parte prima del consenso: il banner c'è ma non blocca gli script." } },
      { requirement: { id: "R-COOKIE-02", outcome: "esiti", note: "Banner presente ma inefficace, per dichiarazione dell'utente: va configurato in modo che blocchi gli script fino al consenso." } },
    ] : p("No, non c'è un banner") ? [
      { finding: { ruleId: "PRIV-01", note: "L'utente conferma che non c'è alcun gestore del consenso: gli script partono senza consenso." } },
      { requirement: { id: "R-COOKIE-02", outcome: "esiti", note: "Nessun gestore del consenso, per dichiarazione dell'utente." } },
    ] : [],
  },
  {
    id: "gateway", priority: 1, kind: "single",
    text: "Le rotte API trovate senza un controllo di autorizzazione sono raggiungibili direttamente da internet?",
    why: "Un gateway o un proxy che autentica ogni chiamata non è visibile nel codice: cambia il peso delle rotte scoperte.",
    options: ["No, stanno dietro un gateway o un proxy che autentica ogni chiamata", "No, sono raggiungibili solo dalla rete interna", "Sì, sono esposte direttamente", NON_SO],
    affects: ["SEC-16", "R-GDPR-03", "R-SEC-05"],
    when: (i) => { const f = has(i, "SEC-16"); return f ? `${plural(f.totalOccurrences, "rotta", "rotte")} senza controllo riconoscibile (${where(f)})` : null; },
    effects: (p) => p("No, stanno dietro un gateway o un proxy che autentica ogni chiamata") ? [
      { finding: { ruleId: "SEC-16", risk: "medium", status: "da_verificare", note: "L'utente dichiara un gateway che autentica ogni chiamata. Il controllo sta fuori dal codice: va documentata la configurazione del gateway e va verificato che valga per tutte le rotte elencate, comprese quelle in scrittura." } },
      { requirement: { id: "R-GDPR-03", outcome: "dichiarato", override: true, note: "Controllo degli accessi dichiarato a livello di gateway, non visibile nel codice: allegare la configurazione e una prova (chiamata senza token rifiutata)." } },
      { requirement: { id: "R-SEC-05", outcome: "dichiarato", override: true, note: "Autorizzazione dichiarata a livello di gateway, non verificabile dal codice." } },
    ] : p("No, sono raggiungibili solo dalla rete interna") ? [
      { finding: { ruleId: "SEC-16", risk: "medium", status: "da_verificare", note: "L'utente dichiara che le rotte sono raggiungibili solo dalla rete interna. Il rischio scende ma non sparisce: chiunque entri nella rete può chiamarle, quindi resta consigliato un controllo per rotta." } },
      { requirement: { id: "R-GDPR-03", outcome: "dichiarato", override: true, note: "Rotte dichiarate interne alla rete: documentare la segregazione di rete e valutare comunque un controllo per rotta." } },
      { requirement: { id: "R-SEC-05", outcome: "dichiarato", override: true, note: "Esposizione limitata alla rete interna, per dichiarazione dell'utente." } },
    ] : p("Sì, sono esposte direttamente") ? [
      { finding: { ruleId: "SEC-16", note: "L'utente conferma che le rotte sono esposte direttamente: il controllo di autorizzazione manca davvero." } },
      { requirement: { id: "R-GDPR-03", outcome: "esiti", note: "Rotte senza controllo esposte su internet, per dichiarazione dell'utente." } },
      { requirement: { id: "R-SEC-05", outcome: "esiti", note: "Rotte senza controllo esposte su internet, per dichiarazione dell'utente." } },
    ] : [],
  },
  {
    id: "secrets", priority: 1, kind: "single",
    text: "I valori trovati nel codice che somigliano a credenziali (chiavi, password, token) sono credenziali reali?",
    why: "Una chiave reale nel codice va ruotata subito; un valore di prova resta un difetto, ma di peso diverso.",
    options: ["Sì, almeno uno è reale e in uso", "Sono reali ma già revocati", "No, sono valori di prova o di esempio", NON_SO],
    affects: ["SEC-01", "R-GDPR-01"],
    when: (i) => { const f = has(i, "SEC-01"); return f ? `${plural(f.totalOccurrences, "valore", "valori")} con l'aspetto di una credenziale (${where(f)})` : null; },
    effects: (p) => p("Sì, almeno uno è reale e in uso") ? [
      { finding: { ruleId: "SEC-01", risk: "high", note: "L'utente conferma che almeno una credenziale è reale e in uso: ruotarla subito e ripulire la cronologia del repository." } },
      { requirement: { id: "R-GDPR-01", outcome: "esiti", note: "Credenziali reali nel codice, confermate dall'utente." } },
    ] : p("Sono reali ma già revocati") ? [
      { finding: { ruleId: "SEC-01", risk: "medium", status: "da_verificare", note: "L'utente dichiara che le credenziali sono già revocate. Restano nel codice e nella cronologia: vanno rimosse e va evitato che ricompaiano." } },
    ] : p("No, sono valori di prova o di esempio") ? [
      { finding: { ruleId: "SEC-01", risk: "low", status: "da_verificare", note: "L'utente dichiara che sono valori di prova o di esempio. Meglio sostituirli con segnaposto evidenti (per esempio <INSERIRE_CHIAVE>) così nessuno li scambia per chiavi vere." } },
      { requirement: { id: "R-GDPR-01", outcome: "dichiarato", override: true, note: "Valori di prova, per dichiarazione dell'utente: nessuna credenziale reale nel codice." } },
    ] : [],
  },
  {
    id: "http", priority: 2, kind: "single",
    text: "Gli indirizzi http:// senza cifratura trovati nel codice riguardano servizi esposti su internet?",
    why: "Un collegamento in chiaro verso un servizio interno o di sviluppo pesa meno di uno verso un servizio esposto.",
    options: ["No, solo servizi interni o ambienti di sviluppo", "Sì, almeno uno è un servizio esposto", NON_SO],
    affects: ["SEC-03", "R-SEC-03"],
    when: (i) => { const f = has(i, "SEC-03"); return f ? `${plural(f.totalOccurrences, "indirizzo", "indirizzi")} http:// (${where(f)})` : null; },
    effects: (p) => p("No, solo servizi interni o ambienti di sviluppo") ? [
      { finding: { ruleId: "SEC-03", risk: "low", status: "da_verificare", note: "L'utente dichiara che gli indirizzi in chiaro sono interni o di sviluppo. Verificare che in produzione non siano raggiunti; per i servizi interni valutare comunque TLS." } },
    ] : p("Sì, almeno uno è un servizio esposto") ? [
      { finding: { ruleId: "SEC-03", risk: "high", note: "L'utente conferma che almeno un collegamento in chiaro raggiunge un servizio esposto." } },
    ] : [],
  },
  {
    id: "xss", priority: 2, kind: "single",
    text: "Il contenuto HTML inserito dinamicamente nelle pagine (innerHTML, v-html e simili) può contenere testo scritto da utenti o preso da fonti esterne?",
    why: "L'inserimento di HTML è pericoloso solo se il contenuto non è controllato dall'applicazione.",
    options: ["No, solo testi fissi dell'applicazione", "Sì, può contenere contenuti di utenti o esterni", NON_SO],
    affects: ["SEC-06"],
    when: (i) => { const f = has(i, "SEC-06"); return f && f.occurrences.some((o) => /HTML inserito/i.test(o.note || "")) ? `HTML inserito senza sanificazione (${where(f)})` : null; },
    effects: (p) => p("No, solo testi fissi dell'applicazione") ? [
      { finding: { ruleId: "SEC-06", risk: "low", status: "da_verificare", note: "L'utente dichiara che l'HTML inserito è solo testo fisso dell'applicazione. Resta consigliato usare le API che non interpretano HTML, così la garanzia non dipende da chi modifica quei testi." } },
    ] : p("Sì, può contenere contenuti di utenti o esterni") ? [
      { finding: { ruleId: "SEC-06", risk: "high", note: "L'utente conferma che l'HTML inserito può contenere contenuti di utenti o esterni: rischio di XSS confermato." } },
    ] : [],
  },
  {
    id: "hash", priority: 2, kind: "single",
    text: "MD5 o SHA-1 vengono usati per proteggere password o firme, oppure solo per checksum, cache e nomi di file?",
    why: "Per un checksum sono accettabili; per password e firme no.",
    options: ["Solo checksum, cache o nomi di file", "Anche per password o firme", NON_SO],
    affects: ["SEC-02", "R-GDPR-02", "R-SEC-04"],
    when: (i) => { const f = has(i, "SEC-02"); return f && !f.occurrences.some((o) => /password/i.test(o.note || "")) ? `MD5 o SHA-1 in ${where(f)}` : null; },
    effects: (p) => p("Solo checksum, cache o nomi di file") ? [
      { finding: { ruleId: "SEC-02", risk: "low", status: "da_verificare", note: "L'utente dichiara un uso limitato a checksum, cache o nomi di file: accettabile, purché nessun confronto di sicurezza dipenda da quell'hash." } },
    ] : p("Anche per password o firme") ? [
      { finding: { ruleId: "SEC-02", risk: "high", note: "L'utente conferma l'uso per password o firme: migrare ad Argon2id, scrypt o bcrypt per le password e a SHA-256 o superiore per le firme." } },
    ] : [],
  },
  {
    id: "ai_data", priority: 2, kind: "multi",
    text: "Quali dati vengono inviati ai servizi di intelligenza artificiale usati dall'applicazione?",
    why: "Decide quali obblighi si applicano: contratto con il fornitore, trasferimenti, categorie particolari, minori.",
    options: ["Nessun dato personale", "Dati personali comuni (nome, email, testi scritti dagli utenti)", "Categorie particolari (salute, biometria, opinioni)", "Dati di minori", NON_SO],
    affects: ["AI-01", "R-GDPR-07", "R-GDPR-14"],
    when: (i) => { if (!usesAI(i)) return null; const list = (i.inferred?.usesAI || []).map((a) => a.value).join(", ") || where(has(i, "AI-01")); return list ? `servizi di IA nel codice (${list})` : "uso di servizi di IA dichiarato"; },
    effects: (p) => {
      const out: Effect[] = [];
      if (p("Nessun dato personale")) out.push({ finding: { ruleId: "AI-01", note: "L'utente dichiara che al fornitore di IA non arrivano dati personali: resta l'obbligo di trasparenza verso chi interagisce con l'IA." } });
      if (p("Dati personali comuni (nome, email, testi scritti dagli utenti)")) out.push({ finding: { ruleId: "AI-01", note: "L'utente dichiara che al fornitore di IA arrivano dati personali comuni: serve il contratto ex art. 28, l'informativa deve citare il fornitore e va verificato il trasferimento extra UE." } });
      if (p("Categorie particolari (salute, biometria, opinioni)")) out.push(
        { finding: { ruleId: "AI-01", risk: "high", note: "L'utente dichiara che al fornitore di IA arrivano categorie particolari di dati: serve una base giuridica dell'art. 9, di regola una DPIA, e vanno ridotti i dati inviati al minimo." } },
        { requirement: { id: "R-GDPR-07", outcome: "esiti", note: "Categorie particolari di dati inviate a un servizio di IA, per dichiarazione dell'utente: verificare base giuridica (art. 9 par. 2) e DPIA." } },
      );
      if (p("Dati di minori")) out.push({ finding: { ruleId: "AI-01", risk: "high", note: "L'utente dichiara che al fornitore di IA arrivano dati di minori: valutare la necessità, il consenso dei genitori e l'avviso comprensibile anche da un minore (L. 132/2025)." } });
      return out;
    },
  },
  {
    id: "ai_notice", priority: 2, kind: "single",
    text: "Chi usa l'applicazione viene avvisato in modo visibile che sta interagendo con un sistema di intelligenza artificiale?",
    why: "È l'obbligo di trasparenza dell'art. 50 dell'AI Act e della legge 132/2025.",
    options: ["Sì, con un avviso visibile", "No", "L'IA lavora solo in back office, senza interazione con le persone", NON_SO],
    affects: ["R-AI-01"],
    when: (i) => usesAI(i) ? (has(i, "AI-01") || i.inferred?.usesAI?.length ? "servizi di IA nel codice" : "uso di servizi di IA dichiarato") : null,
    effects: (p) => p("Sì, con un avviso visibile") ? [
      { requirement: { id: "R-AI-01", outcome: "dichiarato", note: "Avviso di interazione con un'IA dichiarato dall'utente: conservare una schermata come prova." } },
    ] : p("No") ? [
      { requirement: { id: "R-AI-01", outcome: "esiti", note: "Nessun avviso di interazione con un'IA, per dichiarazione dell'utente: va aggiunto (art. 50 par. 1 AI Act)." } },
    ] : p("L'IA lavora solo in back office, senza interazione con le persone") ? [
      { requirement: { id: "R-AI-01", outcome: "dichiarato", note: "L'utente dichiara che l'IA non interagisce con le persone: l'obbligo di avviso non scatta, restano quelli su dati e fornitore." } },
    ] : [],
  },
  {
    id: "hosting", priority: 2, kind: "single",
    text: "Dove sono ospitati i dati personali, compresi i backup?",
    why: "I trasferimenti fuori dall'Unione richiedono una base (capo V del GDPR) e vanno dichiarati nell'informativa.",
    options: ["Nell'Unione europea", "Fuori dall'UE con clausole contrattuali standard o decisione di adeguatezza", "Fuori dall'UE senza garanzie", NON_SO],
    affects: ["PRIV-07", "R-GDPR-08"],
    when: (i) => personal(i) ? "trattamento di dati personali" : null,
    effects: (p) => p("Nell'Unione europea") ? [
      { finding: { ruleId: "PRIV-07", risk: "low", status: "da_verificare", note: "L'utente dichiara hosting nell'Unione europea: la regione trovata nel codice va riconciliata con questa dichiarazione." } },
      { requirement: { id: "R-GDPR-08", outcome: "dichiarato", note: "Hosting nell'Unione europea, per dichiarazione dell'utente. Restano da verificare i fornitori esterni censiti nel referto (tracker, IA, risorse di terzi)." } },
    ] : p("Fuori dall'UE con clausole contrattuali standard o decisione di adeguatezza") ? [
      { requirement: { id: "R-GDPR-08", outcome: "dichiarato", note: "Trasferimento extra UE con garanzie (clausole standard o adeguatezza), per dichiarazione dell'utente: allegare le clausole e la valutazione del paese." } },
    ] : p("Fuori dall'UE senza garanzie") ? [
      { requirement: { id: "R-GDPR-08", outcome: "esiti", note: "Trasferimento extra UE senza garanzie, per dichiarazione dell'utente: va regolarizzato (clausole standard, valutazione del paese) o va spostato l'hosting." } },
    ] : [],
  },
  {
    id: "retention", priority: 2, kind: "single",
    text: "Esiste una regola di cancellazione o anonimizzazione dei dati personali quando non servono più?",
    why: "È il principio di conservazione limitata (art. 5 par. 1 lett. e): le regole non lo vedono dal codice.",
    options: ["Sì, automatica (scadenze o processi programmati)", "Sì, manuale su richiesta", "No", NON_SO],
    affects: ["R-GDPR-13"],
    when: (i) => personal(i) ? "trattamento di dati personali" : null,
    effects: (p) => p("Sì, automatica (scadenze o processi programmati)") ? [
      { requirement: { id: "R-GDPR-13", outcome: "dichiarato", note: "Cancellazione automatica dichiarata dall'utente: indicare nel registro i tempi per ciascuna categoria di dati." } },
    ] : p("Sì, manuale su richiesta") ? [
      { requirement: { id: "R-GDPR-13", outcome: "dichiarato", note: "Cancellazione solo manuale, per dichiarazione dell'utente: definire comunque tempi di conservazione e un controllo periodico." } },
    ] : p("No") ? [
      { requirement: { id: "R-GDPR-13", outcome: "esiti", note: "Nessuna regola di cancellazione, per dichiarazione dell'utente: definire i tempi di conservazione e un processo di cancellazione." } },
    ] : [],
  },
  {
    id: "rights", priority: 2, kind: "single",
    text: "Esiste una funzione o una procedura per esportare e cancellare i dati di una persona che lo chiede?",
    why: "Diritti di accesso, portabilità e cancellazione: il codice spesso non li mostra.",
    options: ["Sì, una funzione nell'applicazione", "Sì, una procedura manuale", "No", NON_SO],
    affects: ["R-GDPR-12"],
    when: (i) => personal(i) ? "trattamento di dati personali" : null,
    effects: (p) => p("Sì, una funzione nell'applicazione") || p("Sì, una procedura manuale") ? [
      { requirement: { id: "R-GDPR-12", outcome: "dichiarato", note: "Esercizio dei diritti gestito, per dichiarazione dell'utente: documentare la procedura e i tempi di risposta (un mese)." } },
    ] : p("No") ? [
      { requirement: { id: "R-GDPR-12", outcome: "esiti", note: "Nessuna funzione o procedura per i diritti degli interessati, per dichiarazione dell'utente." } },
    ] : [],
  },
  {
    id: "dpa", priority: 2, kind: "single",
    text: "Con i fornitori esterni rilevati nel codice esiste un contratto per il trattamento dei dati (art. 28 GDPR)?",
    why: "Ogni servizio esterno che riceve dati personali è un responsabile del trattamento e serve il contratto.",
    options: ["Sì, con tutti", "Solo con alcuni", "No", NON_SO],
    affects: ["R-GDPR-14"],
    when: (i) => { const list = externalProviders(i); return personal(i) && list.length ? `fornitori rilevati: ${list.join(", ")}` : null; },
    effects: (p) => p("Sì, con tutti") ? [
      { requirement: { id: "R-GDPR-14", outcome: "dichiarato", note: "Contratti ex art. 28 con tutti i fornitori, per dichiarazione dell'utente: conservarli e tenere l'elenco dei sub-responsabili." } },
    ] : p("Solo con alcuni") || p("No") ? [
      { requirement: { id: "R-GDPR-14", outcome: "esiti", note: "Contratti ex art. 28 mancanti per uno o più fornitori, per dichiarazione dell'utente." } },
    ] : [],
  },
  {
    id: "notice", priority: 2, kind: "single",
    text: "L'informativa privacy pubblicata descrive i trattamenti che il codice esegue davvero (strumenti di analisi, servizi di IA, dati raccolti)?",
    why: "L'informativa va confrontata con ciò che il codice fa: il referto elenca tracker, servizi e dati trovati.",
    options: ["Sì, è aggiornata", "Esiste ma non è aggiornata", "Non esiste", NON_SO],
    affects: ["R-GDPR-11"],
    when: (i) => personal(i) && isWeb(i) ? "applicazione web o mobile che tratta dati personali" : null,
    effects: (p) => p("Sì, è aggiornata") ? [
      { requirement: { id: "R-GDPR-11", outcome: "dichiarato", note: "Informativa aggiornata, per dichiarazione dell'utente: confrontarla con i fornitori e i dati censiti nel referto." } },
    ] : p("Esiste ma non è aggiornata") || p("Non esiste") ? [
      { requirement: { id: "R-GDPR-11", outcome: "esiti", note: "Informativa assente o non aggiornata, per dichiarazione dell'utente: va redatta o aggiornata con i trattamenti censiti nel referto." } },
    ] : [],
  },
  {
    id: "minors", priority: 2, kind: "single",
    text: "Come viene verificata l'età degli utenti e raccolto il consenso dei genitori per i minori di 14 anni?",
    why: "Sotto i 14 anni il consenso è dei genitori (art. 2-quinquies del Codice privacy).",
    options: ["Verifica dell'età con consenso del genitore", "Solo una dichiarazione dell'età", "Nessuna verifica", NON_SO],
    affects: ["R-GDPR-15"],
    when: (i) => audience(i, "minori") ? "utenti anche minori" : null,
    effects: (p) => p("Verifica dell'età con consenso del genitore") ? [
      { requirement: { id: "R-GDPR-15", outcome: "dichiarato", note: "Verifica dell'età e consenso del genitore dichiarati dall'utente: documentare il meccanismo." } },
    ] : p("Solo una dichiarazione dell'età") || p("Nessuna verifica") ? [
      { requirement: { id: "R-GDPR-15", outcome: "esiti", note: "Verifica dell'età assente o insufficiente, per dichiarazione dell'utente." } },
    ] : [],
  },
  {
    id: "acc_review", priority: 3, kind: "single",
    text: "È stata fatta una verifica di accessibilità a video (contrasto dei colori, zoom al 200%, navigazione da tastiera)?",
    why: "Contrasto e ridimensionamento non si leggono dal codice.",
    options: ["Sì, con esito positivo", "Sì, con problemi ancora aperti", "No", NON_SO],
    affects: ["R-ACC-09"],
    when: (i) => isWeb(i) && i.fileNames.some((n) => MARKUP.test(n)) ? "interfaccia web con file di presentazione" : null,
    effects: (p) => p("Sì, con esito positivo") ? [
      { requirement: { id: "R-ACC-09", outcome: "dichiarato", note: "Verifica a video con esito positivo, per dichiarazione dell'utente: conservare il rapporto." } },
    ] : p("Sì, con problemi ancora aperti") || p("No") ? [
      { requirement: { id: "R-ACC-09", outcome: "esiti", note: "Verifica a video mancante o con problemi aperti, per dichiarazione dell'utente." } },
    ] : [],
  },
  {
    id: "license_dist", priority: 2, kind: "single",
    text: "Il software che include componenti con licenza copyleft viene distribuito a terzi o offerto come servizio in rete?",
    why: "Gli obblighi di GPL e AGPL scattano con la distribuzione; l'AGPL anche con il servizio in rete.",
    options: ["Solo uso interno", "Distribuito a terzi", "Offerto come servizio online", NON_SO],
    affects: ["LIC-01", "R-LIC-01"],
    when: (i) => { const f = has(i, "LIC-01"); return f ? `componenti copyleft (${where(f)})` : null; },
    effects: (p) => p("Solo uso interno") ? [
      { finding: { ruleId: "LIC-01", risk: "low", status: "da_verificare", note: "L'utente dichiara solo uso interno: gli obblighi di redistribuzione non scattano finché il software non viene distribuito né offerto in rete. Tenere comunque l'inventario delle licenze." } },
    ] : p("Distribuito a terzi") || p("Offerto come servizio online") ? [
      { finding: { ruleId: "LIC-01", risk: "high", note: "L'utente conferma distribuzione o servizio in rete: gli obblighi della licenza si applicano (per l'AGPL anche al servizio online)." } },
    ] : [],
  },
  {
    id: "logs", priority: 3, kind: "text",
    text: "I log che contengono dati personali: per quanto tempo vengono conservati e chi può leggerli?",
    why: "Serve a valutare la minimizzazione nei log e a scrivere la misura nel registro.",
    options: [],
    affects: ["PRIV-02", "R-GDPR-06"],
    when: (i) => { const f = has(i, "PRIV-02"); return f ? `dati personali o segreti nei log (${where(f)})` : null; },
  },
  {
    id: "sec_events", priority: 3, kind: "single",
    text: "Gli accessi e le operazioni sensibili (login, modifiche ai dati, errori di autorizzazione) vengono registrati in un log di sicurezza?",
    why: "La registrazione degli eventi non si vede dalle regole, ma è un requisito dell'ASVS e del CRA.",
    options: ["Sì", "No", NON_SO],
    affects: ["R-SEC-07"],
    when: (i) => i.fileNames.some((n) => SERVER.test(n)) ? "codice di backend" : null,
    effects: (p) => p("Sì") ? [
      { requirement: { id: "R-SEC-07", outcome: "dichiarato", note: "Log di sicurezza dichiarato dall'utente: indicare cosa registra, dove e per quanto tempo." } },
    ] : p("No") ? [
      { requirement: { id: "R-SEC-07", outcome: "esiti", note: "Nessun log degli eventi di sicurezza, per dichiarazione dell'utente." } },
    ] : [],
  },
  {
    id: "deps", priority: 3, kind: "single",
    text: "Le dipendenze vengono controllate per vulnerabilità note (per esempio npm audit, Dependabot, pip-audit) e aggiornate?",
    why: "L'inventario e l'aggiornamento delle componenti sono richiesti dal Cyber Resilience Act.",
    options: ["Sì, in automatico", "Sì, a mano ogni tanto", "No", NON_SO],
    affects: ["R-SEC-06"],
    when: (i) => i.fileNames.some((n) => MANIFEST.test(n)) ? "file delle dipendenze presente" : null,
    effects: (p) => p("Sì, in automatico") || p("Sì, a mano ogni tanto") ? [
      { requirement: { id: "R-SEC-06", outcome: "dichiarato", note: "Controllo delle vulnerabilità delle dipendenze dichiarato dall'utente: conservare l'ultimo rapporto e l'inventario (SBOM)." } },
    ] : p("No") ? [
      { requirement: { id: "R-SEC-06", outcome: "esiti", note: "Nessun controllo delle vulnerabilità delle dipendenze, per dichiarazione dell'utente." } },
    ] : [],
  },
  {
    id: "mdr", priority: 2, kind: "single",
    text: "Il software suggerisce diagnosi, terapie o dosaggi, oppure elabora dati clinici per decisioni sul paziente?",
    why: "Se sì, è probabilmente un dispositivo medico (regolamento 2017/745) con obblighi di qualificazione.",
    options: ["No", "Sì", NON_SO],
    affects: ["R-SAN-01"],
    when: (i) => sector(i, "sanita") ? "settore sanitario" : null,
    effects: (p) => p("No") ? [
      { requirement: { id: "R-SAN-01", outcome: "dichiarato", note: "Nessuna finalità diagnostica o terapeutica, per dichiarazione dell'utente: documentare la qualificazione come software non dispositivo." } },
    ] : p("Sì") ? [
      { requirement: { id: "R-SAN-01", outcome: "esiti", note: "Finalità diagnostica o terapeutica dichiarata dall'utente: verificare la qualificazione come dispositivo medico e la classe." } },
    ] : [],
  },
  {
    id: "sca", priority: 2, kind: "single",
    text: "I pagamenti e l'accesso ai conti usano l'autenticazione forte del cliente (due fattori)?",
    why: "È richiesta dalla PSD2 per pagamenti e accesso ai conti.",
    options: ["Sì", "No", NON_SO],
    affects: ["R-FIN-01"],
    when: (i) => sector(i, "finanza") ? "settore finanziario" : null,
    effects: (p) => p("Sì") ? [
      { requirement: { id: "R-FIN-01", outcome: "dichiarato", note: "Autenticazione forte dichiarata dall'utente: documentare i fattori usati e le esenzioni applicate." } },
    ] : p("No") ? [
      { requirement: { id: "R-FIN-01", outcome: "esiti", note: "Autenticazione forte assente, per dichiarazione dell'utente." } },
    ] : [],
  },
  {
    id: "spid", priority: 2, kind: "single",
    text: "L'accesso ai servizi per i cittadini avviene con SPID o CIE?",
    why: "Per i servizi della pubblica amministrazione è richiesto dal Codice dell'amministrazione digitale.",
    options: ["Sì", "No", "Il servizio non ha accesso per i cittadini", NON_SO],
    affects: ["R-PA-01"],
    when: (i) => sector(i, "pa") ? "pubblica amministrazione" : null,
    effects: (p) => p("Sì") || p("Il servizio non ha accesso per i cittadini") ? [
      { requirement: { id: "R-PA-01", outcome: "dichiarato", note: "Accesso con SPID o CIE, o servizio senza accesso per i cittadini, per dichiarazione dell'utente; resta la dichiarazione di accessibilità." } },
    ] : p("No") ? [
      { requirement: { id: "R-PA-01", outcome: "esiti", note: "Accesso senza SPID o CIE, per dichiarazione dell'utente." } },
    ] : [],
  },
];

const byId = new Map(QUESTIONS.map((q) => [q.id, q]));

/** Le domande da porre in questo contesto, in ordine di peso. Nessun limite: chi chiama taglia. */
export function buildQuestions(input: QuestionInput): CodeQuestion[] {
  const out: CodeQuestion[] = [];
  for (const q of QUESTIONS) {
    const trigger = q.when(input);
    if (!trigger) continue;
    out.push({ id: q.id, text: q.text, why: q.why, kind: q.kind, options: q.options, affects: q.affects, trigger, priority: q.priority, source: "regole" });
  }
  return out.sort((a, b) => a.priority - b.priority);
}

/** La risposta contiene l'opzione? Le risposte multiple arrivano separate da "; ". */
function pickedIn(answer: string, option: string): boolean {
  return answer.split(/\s*;\s*/).some((part) => part.trim().toLowerCase() === option.toLowerCase());
}

function answerFor(answers: Answer[], q: CodeQuestion | QuestionDef): Answer | undefined {
  return answers.find((a) => (a.id && a.id === q.id) || (!a.id && a.q.trim() === q.text));
}

/** Le domande non ancora risposte, per riproporle dopo la verifica. */
export function openQuestions(all: CodeQuestion[], answers: Answer[]): CodeQuestion[] {
  return all.filter((q) => { const a = answerFor(answers, q); return !a || !a.a.trim(); });
}

/** Gli effetti di tutte le risposte date, in ordine di domanda. */
export function effectsOf(answers: Answer[]): Array<Effect & { question: CodeQuestion["id"]; answer: string }> {
  const out: Array<Effect & { question: string; answer: string }> = [];
  for (const a of answers) {
    if (!a?.id || !a.a?.trim()) continue;
    const q = byId.get(a.id);
    if (!q?.effects) continue;
    const picked = (option: string) => pickedIn(a.a, option);
    for (const e of q.effects(picked)) out.push({ ...e, question: q.id, answer: a.a });
  }
  return out;
}

/**
 * Applica le risposte agli esiti: rischio e stato cambiano solo con una motivazione scritta
 * nell'esito stesso. Restituisce il numero di esiti toccati.
 */
export function applyAnswersToFindings<T extends FindingLike>(findings: T[], answers: Answer[]): number {
  let touched = 0;
  for (const e of effectsOf(answers)) {
    if (!e.finding) continue;
    for (const f of findings) {
      if (f.ruleId !== e.finding.ruleId || f.status === "possibile_falso_positivo") continue;
      if (e.finding.risk) f.risk = e.finding.risk;
      if (e.finding.status) f.status = e.finding.status;
      f.adjustment = [f.adjustment, e.finding.note].filter(Boolean).join(" ");
      touched++;
    }
  }
  return touched;
}

/** Esiti dichiarati per i requisiti: la copertura li usa dove il codice non decide. */
export function declaredOutcomes(answers: Answer[]): Map<string, { outcome: DeclaredOutcome; note: string; override: boolean }> {
  const out = new Map<string, { outcome: DeclaredOutcome; note: string; override: boolean }>();
  for (const e of effectsOf(answers)) {
    if (!e.requirement) continue;
    const prev = out.get(e.requirement.id);
    // Un "esiti" dichiarato pesa più di un "dichiarato" conforme sullo stesso requisito.
    if (prev && prev.outcome === "esiti" && e.requirement.outcome !== "esiti") continue;
    out.set(e.requirement.id, { outcome: e.requirement.outcome, note: e.requirement.note, override: !!e.requirement.override });
  }
  return out;
}

/** Risposte lette da una richiesta: solo i campi attesi, con limiti di lunghezza. */
export function parseAnswers(raw: unknown): Answer[] {
  if (!Array.isArray(raw)) return [];
  return raw.slice(0, 40)
    .filter((a: Record<string, unknown>) => a && typeof a.q === "string" && typeof a.a === "string" && a.a.trim())
    .map((a: Record<string, unknown>) => ({ id: typeof a.id === "string" && byId.has(a.id) ? a.id : undefined, q: String(a.q).slice(0, 300), a: String(a.a).slice(0, 800) }));
}
