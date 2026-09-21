// Domande di applicabilita poste prima della gap analysis.
//
// Riguardano solo chi e' l'organizzazione, mai se un obbligo e' stato attuato: servono
// per i requisiti condizionali, quelli che si applicano a certi soggetti e non ad altri
// (fornitore di sistemi di IA, fabbricante, entita' finanziaria, titolare dei dati).
// Nessun documento aziendale contiene queste informazioni, quindi senza risposta il
// requisito resta per sempre fra quelli "da verificare".
//
// Le chiavi qui sotto devono restare identiche a quelle di APPLICABILITY_RULES
// in supabase/functions/gap-analysis/index.ts.

export type ApplicabilityAnswer = "si" | "no" | "non_so";

export interface ApplicabilityChoice {
  /** Chiavi impostate a "si" quando questa opzione e' selezionata. */
  keys: string[];
  label: string;
  /** Opzione "nessuna delle precedenti": azzera tutte le chiavi del gruppo. */
  none?: boolean;
  /** Opzione "non lo so": porta tutte le chiavi del gruppo a "non_so". */
  unknown?: boolean;
}

export interface ApplicabilityQuestion {
  id: string;
  /** null quando la domanda va posta sempre, altrimenti nome della normativa. */
  regulation: string | null;
  question: string;
  help?: string;
  kind: "single" | "multi";
  /** Tutte le chiavi toccate da questa domanda. */
  keys: string[];
  choices: ApplicabilityChoice[];
  /**
   * Domanda di ambito: decide se l'intera normativa riguarda l'organizzazione. E' obbligatoria,
   * perche' senza risposta la normativa non puo' essere valutata (il motore la segna come non
   * valutata invece di presumere che si applichi). "Non lo so" e' una risposta ammessa.
   * Le chiavi devono coprire quelle di REGULATION_GATES in
   * supabase/functions/_shared/regulation-scope.ts: lo verifica deployment/regulation-scope.test.mjs.
   */
  scope?: boolean;
}

export const ORG_SIZES = [
  "Microimpresa (meno di 10 persone)",
  "Piccola impresa (meno di 50 persone)",
  "Media impresa (meno di 250 persone)",
  "Grande impresa (250 persone o più)",
] as const;

export const APPLICABILITY_QUESTIONS: ApplicabilityQuestion[] = [
  {
    id: "org_nature",
    regulation: null,
    question: "Che tipo di organizzazione siete e dove siete stabiliti?",
    help: "Determina alcuni obblighi che riguardano solo enti pubblici, enti religiosi o soggetti non stabiliti nell'Unione europea.",
    kind: "single",
    keys: ["org_religious", "org_outside_eu"],
    choices: [
      { keys: [], label: "Impresa privata stabilita nell'Unione europea" },
      { keys: [], label: "Ente pubblico stabilito nell'Unione europea" },
      { keys: ["org_religious"], label: "Associazione, chiesa o comunità religiosa" },
      { keys: ["org_outside_eu"], label: "Soggetto stabilito fuori dall'Unione europea che offre beni o servizi nell'Unione" },
    ],
  },
  {
    id: "gdpr_transfers",
    regulation: "GDPR",
    question: "Trasferite dati personali fuori dall'Unione europea?",
    help: "Contano anche i fornitori, le sedi del gruppo e i server situati in paesi terzi.",
    kind: "single",
    keys: ["gdpr_transfers"],
    choices: [
      { keys: ["gdpr_transfers"], label: "Sì" },
      { keys: [], label: "No, tutto resta nell'Unione europea" },
      { keys: [], label: "Non lo so", unknown: true },
    ],
  },
  {
    id: "gdpr_special",
    regulation: "GDPR",
    question: "Trattate categorie particolari di dati o dati relativi a condanne e reati?",
    help: "Categorie particolari: salute, dati biometrici o genetici, convinzioni religiose o filosofiche, opinioni politiche, appartenenza sindacale, vita sessuale o orientamento sessuale, origine razziale o etnica.",
    kind: "single",
    keys: ["gdpr_special_categories"],
    choices: [
      { keys: ["gdpr_special_categories"], label: "Sì" },
      { keys: [], label: "No" },
      { keys: [], label: "Non lo so", unknown: true },
    ],
  },
  {
    id: "gdpr_profiling",
    regulation: "GDPR",
    question: "Effettuate profilazione o decisioni automatizzate che producono effetti sulle persone?",
    help: "Per esempio valutazione automatica del merito creditizio, selezione automatica di candidati, punteggi comportamentali.",
    kind: "single",
    keys: ["gdpr_profiling"],
    choices: [
      { keys: ["gdpr_profiling"], label: "Sì" },
      { keys: [], label: "No, ogni valutazione è svolta da una persona" },
      { keys: [], label: "Non lo so", unknown: true },
    ],
  },
  {
    id: "ai_role",
    scope: true,
    regulation: "AI Act",
    question: "Che ruolo avete rispetto ai sistemi di intelligenza artificiale?",
    help: "Fornitore: sviluppate un sistema o lo immettete sul mercato con il vostro nome. Deployer: usate un sistema sviluppato da altri nella vostra attività.",
    kind: "multi",
    keys: ["ai_provider", "ai_deployer", "ai_importer_distributor"],
    choices: [
      { keys: ["ai_provider"], label: "Fornitore: sviluppiamo o immettiamo sul mercato sistemi di IA" },
      { keys: ["ai_deployer"], label: "Deployer: usiamo sistemi di IA sviluppati da altri" },
      { keys: ["ai_importer_distributor"], label: "Importatore o distributore di sistemi di IA" },
      { keys: [], label: "Nessuno di questi", none: true },
      { keys: [], label: "Non lo so", unknown: true },
    ],
  },
  {
    id: "ai_feature",
    regulation: "AI Act",
    question: "Che caratteristiche hanno i sistemi di IA che riguardano la vostra organizzazione?",
    help: "Ad alto rischio: sistemi elencati negli Allegati I e III del regolamento, per esempio selezione del personale, accesso al credito, componenti di sicurezza di prodotti.",
    kind: "multi",
    keys: ["ai_high_risk", "ai_gpai", "ai_transparency"],
    choices: [
      { keys: ["ai_high_risk"], label: "Sistemi ad alto rischio (Allegato I o Allegato III)" },
      { keys: ["ai_gpai"], label: "Modelli per finalità generali (GPAI)" },
      { keys: ["ai_transparency"], label: "Sistemi che interagiscono con le persone o generano contenuti sintetici" },
      { keys: [], label: "Nessuna di queste", none: true },
      { keys: [], label: "Non lo so", unknown: true },
    ],
  },
  {
    id: "cra_role",
    scope: true,
    regulation: "CRA",
    question: "Che ruolo avete rispetto ai prodotti con elementi digitali?",
    help: "Prodotti con elementi digitali: software e hardware connessi immessi sul mercato dell'Unione, compresi i componenti venduti separatamente.",
    kind: "multi",
    keys: ["cra_manufacturer", "cra_importer_distributor", "cra_open_source"],
    choices: [
      { keys: ["cra_manufacturer"], label: "Fabbricante: produciamo o immettiamo sul mercato prodotti con elementi digitali" },
      { keys: ["cra_importer_distributor"], label: "Importatore o distributore di prodotti con elementi digitali" },
      { keys: ["cra_open_source"], label: "Gestore di software open source" },
      { keys: [], label: "Nessuno di questi", none: true },
      { keys: [], label: "Non lo so", unknown: true },
    ],
  },
  {
    id: "da_role",
    scope: true,
    regulation: "Data Act",
    question: "Che ruolo avete rispetto ai dati generati da prodotti e servizi?",
    help: "Titolare dei dati: mettete a disposizione dati generati dall'uso di un prodotto connesso o di un servizio correlato.",
    kind: "multi",
    keys: ["da_data_holder", "da_cloud_provider", "da_recipient"],
    choices: [
      { keys: ["da_data_holder"], label: "Fabbricante di prodotti connessi, fornitore di servizi correlati o titolare dei dati" },
      { keys: ["da_cloud_provider"], label: "Fornitore di servizi di trattamento dati (cloud, edge, SaaS, PaaS, IaaS)" },
      { keys: ["da_recipient"], label: "Utente o destinatario di dati messi a disposizione da altri" },
      { keys: [], label: "Nessuno di questi", none: true },
      { keys: [], label: "Non lo so", unknown: true },
    ],
  },
  {
    id: "dora_subject",
    scope: true,
    regulation: "DORA",
    question: "La vostra organizzazione è un'entità finanziaria ai sensi di DORA?",
    help: "Entità finanziarie: banche, assicurazioni, SIM, SGR, istituti di pagamento, di moneta elettronica, gestori di cripto-attività e altri soggetti elencati all'articolo 2 del regolamento.",
    kind: "single",
    keys: ["dora_financial_entity", "dora_not_micro", "dora_ctpp"],
    choices: [
      { keys: ["dora_financial_entity", "dora_not_micro"], label: "Sì, e non siamo una microimpresa" },
      { keys: ["dora_financial_entity"], label: "Sì, e siamo una microimpresa" },
      { keys: ["dora_ctpp"], label: "No, siamo un fornitore di servizi TIC per entità finanziarie" },
      { keys: [], label: "No, nessuna delle due cose", none: true },
      { keys: [], label: "Non lo so", unknown: true },
    ],
  },
  {
    id: "nis2_subject",
    scope: true,
    regulation: "NIS2",
    question: "Come siete classificati ai fini NIS2?",
    help: "La classificazione dipende dal settore e dalla dimensione, ed è quella risultante dalla registrazione presso l'ACN.",
    kind: "single",
    keys: ["nis2_entity", "nis2_digital_provider"],
    choices: [
      { keys: ["nis2_entity"], label: "Soggetto essenziale" },
      { keys: ["nis2_entity"], label: "Soggetto importante" },
      { keys: ["nis2_entity", "nis2_digital_provider"], label: "Fornitore di servizi digitali o infrastrutture digitali (DNS, TLD, cloud, data center, CDN, MSP)" },
      { keys: [], label: "Non rientriamo nell'ambito NIS2", none: true },
      { keys: [], label: "Non lo so", unknown: true },
    ],
  },
];

export function questionsForRegulations(regulations: string[]): ApplicabilityQuestion[] {
  const selected = new Set(regulations.map(r => r.trim().toLowerCase()));
  return APPLICABILITY_QUESTIONS.filter(
    q => q.regulation === null || selected.has(q.regulation.toLowerCase()),
  );
}

/**
 * Converte le scelte fatte nell'interfaccia nella mappa di risposte attesa dalla funzione
 * di analisi. Una chiave non selezionata dentro una domanda a cui si e' risposto vale "no":
 * e' quello che permette di escludere un obbligo. Le domande senza risposta restano fuori,
 * così l'analisi si comporta come se il questionario fosse stato saltato.
 */
export function buildAnswers(
  questions: ApplicabilityQuestion[],
  selections: Record<string, number[]>,
): Record<string, ApplicabilityAnswer> {
  const answers: Record<string, ApplicabilityAnswer> = {};
  for (const question of questions) {
    const picked = selections[question.id];
    if (!picked || picked.length === 0) continue;
    const chosen = picked.map(i => question.choices[i]).filter(Boolean);
    if (chosen.some(c => c.unknown)) {
      for (const key of question.keys) answers[key] = "non_so";
      continue;
    }
    const affermative = new Set(chosen.flatMap(c => c.keys));
    for (const key of question.keys) answers[key] = affermative.has(key) ? "si" : "no";
  }
  return answers;
}

export function countAnswered(
  questions: ApplicabilityQuestion[],
  selections: Record<string, number[]>,
): number {
  return questions.filter(q => (selections[q.id] || []).length > 0).length;
}

/**
 * Domande di ambito ancora senza risposta: finche' ce n'e' una, l'analisi non parte.
 * "Non lo so" conta come risposta.
 */
export function unansweredScopeQuestions(
  questions: ApplicabilityQuestion[],
  selections: Record<string, number[]>,
): ApplicabilityQuestion[] {
  return questions.filter(q => q.scope && (selections[q.id] || []).length === 0);
}
