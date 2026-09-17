export interface RegulatoryRequirement {
  id: string;
  regulation: string;
  reference: string;
  description_it: string;
  description_en: string;
  risk_level: 'critical' | 'high' | 'medium' | 'low';
  remediation_effort: 'very_high' | 'high' | 'medium' | 'low';
  // Keywords that, if found in user docs, indicate coverage
  coverage_keywords: string[];
  // Keywords in RAG chunks that confirm this requirement exists
  rag_validation_keywords: string[];
  gap_description_it: string;
  gap_description_en: string;
  recommended_action_it: string;
  recommended_action_en: string;
  action_hours: number;
  action_cost_eur: number;
  // Per-requirement coverage thresholds (optional, defaults: 0.40 / 3)
  coverage_threshold?: number;   // 0.0-1.0, default 0.40
  min_keyword_matches?: number;  // default 3
  // Requisito condizionale: si applica solo se ricorre una situazione (es. trasferimenti extra UE)
  conditional?: boolean;
  applicability_note_it?: string;
  // Cosa deve risultare dalla documentazione (catalogo in database)
  evidence_expected_it?: string;
}

export type CheckStatus = 'covered' | 'partial' | 'missing' | 'to_verify' | 'not_applicable';
export type RiskProfile = 'high' | 'medium' | 'low';

export interface RequirementCheck {
  requirement_id: string;
  regulation: string;
  reference: string;
  description: string;
  severity: string;
  remediation_effort: string;
  conditional: boolean;
  applicability_note: string | null;
  status: CheckStatus;
  risk_level: RiskProfile | null;
  assessment: string;
  evidence: Array<{ document: string; quote: string }>;
  missing_elements: string[];
  recommended_actions: string[];
  confidence: number | null;
  applicability?: string | null;
  method: 'llm_evidence' | 'keyword' | 'semantic';
  keyword_coverage: number;
}

export const CHECKS_VERSION = 'gap-analysis-v21-verified-evidence';
const SEVERITY_RANK: Record<string, number> = { critical: 3, high: 2, medium: 1, low: 0 };
export const RISK_SCORE_MAP: Record<string, number> = { high: 74, medium: 52, low: 28 };

export function riskProfileFor(severity: string, status: CheckStatus): RiskProfile | null {
  if (status !== 'missing' && status !== 'partial') return null;
  const base = SEVERITY_RANK[severity] ?? 1;
  const rank = status === 'partial' ? Math.max(0, base - 1) : base;
  return rank >= 2 ? 'high' : rank === 1 ? 'medium' : 'low';
}

export const PRIORITY_MATRIX: Record<string, Record<string, number>> = {
  high: { very_high: 1, high: 1, medium: 2, low: 2 },
  medium: { very_high: 2, high: 2, medium: 3, low: 3 },
  low: { very_high: 3, high: 3, medium: 4, low: 4 },
};

// Cosa deve risultare dalla documentazione per considerare soddisfatto il requisito.
// Guida l'auditor AI: elementi obbligatori del documento atteso.
const EVIDENCE_EXPECTED_IT: Record<string, string> = {
  gdpr_art5_principles: 'Una policy o regolamento interno che enunci i principi applicati (liceità, correttezza, trasparenza, limitazione della finalità, minimizzazione, esattezza, limitazione della conservazione, integrità) e come vengono attuati; termini di conservazione definiti.',
  gdpr_art6_lawfulness: 'Per ciascuna finalità di trattamento la base giuridica indicata (registro, informative o mappatura dedicata); per l\'interesse legittimo, un test di bilanciamento.',
  gdpr_art13_14_information: 'Informative complete: identità e contatti del titolare e del DPO, finalità e basi giuridiche, destinatari, trasferimenti extra UE, periodo di conservazione, diritti, reclamo al Garante, obbligatorietà del conferimento; una per ogni categoria di interessati (dipendenti, clienti, fornitori, candidati, utenti del sito).',
  gdpr_art12_15_22_data_subject_rights: 'Una procedura scritta per ricevere e gestire le richieste degli interessati: canali, verifica dell\'identità, termine di un mese, registro delle richieste, responsabili, moduli.',
  gdpr_art25_privacy_by_design: 'Evidenza che la protezione dei dati è considerata nella progettazione di nuovi trattamenti o sistemi: checklist privacy by design, impostazioni predefinite restrittive, valutazioni preliminari, procedure di change management con verifica privacy.',
  gdpr_art28_processor: 'Contratti o nomine dei responsabili del trattamento con i contenuti dell\'art. 28, par. 3 (istruzioni, riservatezza, misure di sicurezza, sub-responsabili, assistenza, cancellazione o restituzione, audit); elenco dei fornitori nominati; verifica dei fornitori.',
  gdpr_art30_records: 'Registro delle attività di trattamento con, per ogni trattamento: finalità, categorie di interessati e di dati, destinatari, eventuali trasferimenti extra UE, termini di conservazione, descrizione delle misure di sicurezza; se l\'organizzazione agisce anche come responsabile, il registro del responsabile.',
  gdpr_art32_security: 'Descrizione delle misure tecniche e organizzative: controllo degli accessi, autenticazione, cifratura, backup e ripristino, gestione delle vulnerabilità, log, disciplinare per l\'uso degli strumenti, test periodici; una valutazione dei rischi che le giustifica.',
  gdpr_art33_34_breach: 'Procedura di gestione delle violazioni: rilevazione, valutazione del rischio, notifica al Garante entro 72 ore, comunicazione agli interessati, registro delle violazioni, ruoli e contatti.',
  gdpr_art35_dpia: 'Valutazioni d\'impatto svolte per i trattamenti ad alto rischio oppure una valutazione documentata di non necessità della DPIA con i criteri applicati.',
  gdpr_art37_dpo: 'Atto di designazione del DPO con compiti e contatti, comunicazione al Garante, oppure valutazione documentata che spiega perché la designazione non è obbligatoria.',
  gdpr_art7_consent: 'Moduli o flussi di raccolta del consenso distinti per finalità, modalità di registrazione della prova e di revoca.',
  gdpr_art9_special_categories: 'Individuazione dei trattamenti di categorie particolari, condizione dell\'art. 9, par. 2 applicata e garanzie specifiche adottate.',
  gdpr_art22_automated_decisions: 'Dichiarazione sull\'esistenza o meno di decisioni unicamente automatizzate o profilazione; se presenti, logica, garanzie e intervento umano.',
  gdpr_art24_accountability: 'Regolamento o modello organizzativo privacy con ruoli e responsabilità, politiche di protezione dei dati e riesame periodico documentato.',
  gdpr_art26_joint_controllers: 'Accordi di contitolarità con ripartizione delle responsabilità oppure dichiarazione motivata di assenza di contitolarità.',
  gdpr_art29_staff_instructions: 'Lettere di autorizzazione o istruzioni operative per il personale, elenco degli autorizzati, evidenza di formazione (programma, date, partecipanti).',
  gdpr_art38_39_dpo_position: 'Relazioni periodiche del DPO, evidenza del suo coinvolgimento, comunicazione dei contatti al Garante e pubblicazione nelle informative.',
  gdpr_art44_49_transfers: 'Elenco dei trasferimenti extra UE (fornitori, cloud) con lo strumento di garanzia adottato per ciascuno, oppure dichiarazione che non avvengono trasferimenti.',
};

export function evidenceExpectedFor(req: RegulatoryRequirement): string {
  return req.evidence_expected_it || EVIDENCE_EXPECTED_IT[req.id] || req.description_it;
}

// Normalizzazione per la verifica delle citazioni
export function normalizeQuote(text: string): string {
  return (text || '')
    .toLowerCase()
    .replace(/[‘’“”'"«»]/g, '')
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

// Una citazione è verificata solo se ogni suo tratto compare alla lettera nei documenti.
// Le omissioni segnalate con [...] sono ammesse: ogni segmento viene controllato per intero,
// così nessuna parte della frase mostrata all'utente può essere inventata.
export function quoteIsVerified(quote: string, corpusNormalized: string): boolean {
  const segments = String(quote || '').split(/\[\s*(?:\.{3}|…)\s*\]|\.{3}|…/)
    .map(normalizeQuote).filter(Boolean);
  if (segments.length === 0 || segments.join(' ').split(' ').length < 6) return false;
  // Every segment, including short ones, must occur in order in this one document.
  let cursor = 0;
  for (const segment of segments) {
    let at = corpusNormalized.indexOf(segment, cursor);
    while (at >= 0 && ((at > 0 && corpusNormalized[at - 1] !== ' ')
      || (at + segment.length < corpusNormalized.length && corpusNormalized[at + segment.length] !== ' '))) {
      at = corpusNormalized.indexOf(segment, at + 1);
    }
    if (at < 0) return false;
    cursor = at + segment.length;
  }
  return true;
}

export function verifyEvidence(raw: unknown, documents: Array<{name: string; content: string}>) {
  if (!Array.isArray(raw)) return [];
  return raw.filter(e => e && typeof e.document === 'string' && typeof e.quote === 'string')
    .filter(e => e.quote.length <= 300 && e.document.length <= 200)
    .filter(e => {
      const matches = documents.filter(d => d.name === e.document);
      return matches.length === 1 && quoteIsVerified(e.quote, normalizeQuote(matches[0].content))
        && quoteIsSubstantive(e.quote);
    }).slice(0, 5).map(e => ({document: e.document, quote: e.quote}));
}

// ------------------------------------------------------------
// Profilo di applicabilità dichiarato dall'organizzazione all'avvio dell'analisi.
// Serve per gli obblighi che dipendono da chi è l'organizzazione (fornitore di IA,
// fabbricante, entità finanziaria) e non da cosa c'è scritto nei suoi documenti:
// nessun documento aziendale dichiara queste cose, quindi senza risposta il requisito
// resterebbe per sempre "da verificare".
export type ApplicabilityAnswer = 'si' | 'no' | 'non_so';
export interface ApplicabilityProfile {
  answers?: Record<string, ApplicabilityAnswer>;
  size?: string;
  declared_at?: string;
}

// Ogni voce lega una condizione del catalogo a una chiave del profilo. Le chiavi della
// stessa dimensione sono alternative fra loro (basta che una ricorra); dimensioni diverse
// devono ricorrere tutte.
const APPLICABILITY_RULES: Array<{ regulation: string; dimension: string; key: string; pattern: RegExp; label_it: string }> = [
  { regulation: 'AI Act', dimension: 'ai_role', key: 'ai_provider', pattern: /fornitor/, label_it: 'fornitore di sistemi di IA' },
  { regulation: 'AI Act', dimension: 'ai_role', key: 'ai_deployer', pattern: /deployer/, label_it: 'deployer di sistemi di IA' },
  { regulation: 'AI Act', dimension: 'ai_role', key: 'ai_importer_distributor', pattern: /importator|distributor|rappresentante autorizzato/, label_it: 'importatore o distributore di sistemi di IA' },
  { regulation: 'AI Act', dimension: 'ai_feature', key: 'ai_high_risk', pattern: /alto rischio/, label_it: 'sistemi di IA ad alto rischio' },
  { regulation: 'AI Act', dimension: 'ai_feature', key: 'ai_gpai', pattern: /gpai|finalità generali/, label_it: 'modelli di IA per finalità generali' },
  { regulation: 'AI Act', dimension: 'ai_feature', key: 'ai_transparency', pattern: /sintetic|interagire direttamente|riconoscimento delle emozioni|categorizzazione biometrica/, label_it: 'sistemi che interagiscono con le persone o generano contenuti sintetici' },
  { regulation: 'CRA', dimension: 'cra_role', key: 'cra_manufacturer', pattern: /fabbricant/, label_it: 'fabbricante di prodotti con elementi digitali' },
  { regulation: 'CRA', dimension: 'cra_role', key: 'cra_importer_distributor', pattern: /importator|distribu/, label_it: 'importatore o distributore di prodotti con elementi digitali' },
  { regulation: 'CRA', dimension: 'cra_role', key: 'cra_open_source', pattern: /open source/, label_it: 'gestore di software open source' },
  { regulation: 'Data Act', dimension: 'da_role', key: 'da_data_holder', pattern: /titolar[ei] d[ei]i? dati|prodott[oi] conness|servizi correlati|fabbricant/, label_it: 'titolare dei dati o fabbricante di prodotti connessi' },
  { regulation: 'Data Act', dimension: 'da_role', key: 'da_cloud_provider', pattern: /servizi di trattamento d(ei )?dati|cloud|edge|saas|paas|iaas/, label_it: 'fornitore di servizi cloud o edge' },
  { regulation: 'Data Act', dimension: 'da_role', key: 'da_recipient', pattern: /destinatari d?e?i? ?dati|utenti di prodotti|data recipients/, label_it: 'utente o destinatario di dati' },
  { regulation: 'DORA', dimension: 'dora_subject', key: 'dora_financial_entity', pattern: /entità finanziar/, label_it: 'entità finanziaria' },
  { regulation: 'DORA', dimension: 'dora_subject', key: 'dora_ctpp', pattern: /ctpp|fornitor[ei] terz[oi] critic/, label_it: 'fornitore terzo critico di servizi TIC' },
  { regulation: 'DORA', dimension: 'dora_size', key: 'dora_not_micro', pattern: /microimpres/, label_it: 'entità finanziaria diversa dalle microimprese' },
  { regulation: 'NIS2', dimension: 'nis2_subject', key: 'nis2_entity', pattern: /soggett[oi] essenzial|soggett[oi] important/, label_it: 'soggetto essenziale o importante' },
  { regulation: 'NIS2', dimension: 'nis2_subject', key: 'nis2_digital_provider', pattern: /dns|tld|nomi di dominio|cloud|data center|cdn|msp|mssp|marketplace/, label_it: 'fornitore di servizi digitali o infrastrutture digitali' },
  { regulation: 'GDPR', dimension: 'gdpr_transfers', key: 'gdpr_transfers', pattern: /paes[ei] terz|trasferiment|organizzazioni internazionali/, label_it: 'trasferimenti di dati fuori dall\'Unione europea' },
  { regulation: 'GDPR', dimension: 'gdpr_special', key: 'gdpr_special_categories', pattern: /categorie particolari|condanne penali/, label_it: 'trattamento di categorie particolari di dati o di dati giudiziari' },
  { regulation: 'GDPR', dimension: 'gdpr_profiling', key: 'gdpr_profiling', pattern: /profilazion|decision[ei] automatizzat/, label_it: 'profilazione o decisioni automatizzate' },
  { regulation: 'GDPR', dimension: 'org_religious', key: 'org_religious', pattern: /chiese|comunità religios|associazioni religios/, label_it: 'chiesa, associazione o comunità religiosa' },
  { regulation: 'GDPR', dimension: 'org_outside_eu', key: 'org_outside_eu', pattern: /stabilit[ei] fuori dall|fuori dall'unione|non stabilit[ei] nell'unione/, label_it: 'organizzazione stabilita fuori dall\'Unione europea' },
];

// Alcune normative si rivolgono per intero a una categoria di soggetti: se l'organizzazione
// dichiara di non rientrarvi, non ha senso cercare gap nei loro obblighi, nemmeno in quelli
// che il catalogo non marca come condizionali. Il GDPR non ha una porta d'ingresso di questo
// tipo: riguarda chiunque tratti dati personali.
const REGULATION_GATES: Array<{ regulation: string; keys: string[]; label_it: string }> = [
  { regulation: 'AI Act', keys: ['ai_provider', 'ai_deployer', 'ai_importer_distributor'], label_it: 'alcun ruolo rispetto ai sistemi di intelligenza artificiale (né fornitore, né deployer, né importatore o distributore)' },
  { regulation: 'CRA', keys: ['cra_manufacturer', 'cra_importer_distributor', 'cra_open_source'], label_it: 'alcun ruolo rispetto ai prodotti con elementi digitali (né fabbricante, né importatore o distributore, né gestore di software open source)' },
  { regulation: 'Data Act', keys: ['da_data_holder', 'da_cloud_provider', 'da_recipient'], label_it: 'alcun ruolo rispetto ai dati generati da prodotti connessi e servizi di trattamento dati' },
  { regulation: 'DORA', keys: ['dora_financial_entity', 'dora_ctpp'], label_it: 'la qualifica di entità finanziaria né quella di fornitore di servizi TIC per entità finanziarie' },
  { regulation: 'NIS2', keys: ['nis2_entity', 'nis2_digital_provider'], label_it: 'la qualifica di soggetto essenziale o importante ai fini NIS2' },
];

export function regulationGateExcludes(regulation: string, profile: ApplicabilityProfile | null): string | null {
  if (!profile?.answers) return null;
  const gate = REGULATION_GATES.find(g => g.regulation.toLowerCase() === regulation.toLowerCase());
  if (!gate) return null;
  if (!gate.keys.every(k => profile.answers![k] === 'no')) return null;
  return `L'intero regolamento non si applica in base a quanto dichiarato all'avvio dell'analisi: l'organizzazione ha dichiarato di non avere ${gate.label_it}.`;
}

export interface ApplicabilityVerdict {
  status: 'applicable' | 'not_applicable' | 'unknown';
  reason_it: string;
}

export function applicabilityVerdict(req: RegulatoryRequirement, profile: ApplicabilityProfile | null): ApplicabilityVerdict | null {
  if (!profile?.answers) return null;
  const gateReason = regulationGateExcludes(req.regulation, profile);
  if (gateReason) return { status: 'not_applicable', reason_it: gateReason };
  if (!req.conditional) return null;
  const haystack = `${req.applicability_note_it || ''} § ${req.description_it || ''}`.toLowerCase();
  const byDimension = new Map<string, Array<{ key: string; label_it: string }>>();
  for (const rule of APPLICABILITY_RULES) {
    if (rule.regulation.toLowerCase() !== req.regulation.toLowerCase()) continue;
    if (!rule.pattern.test(haystack)) continue;
    const list = byDimension.get(rule.dimension) || [];
    list.push({ key: rule.key, label_it: rule.label_it });
    byDimension.set(rule.dimension, list);
  }
  if (byDimension.size === 0) return null;

  const escluse: string[] = [];
  let incerta = false;
  for (const [, keys] of byDimension) {
    const values = keys.map(k => profile.answers![k.key] || 'non_so');
    if (values.some(v => v === 'si')) continue;
    if (values.every(v => v === 'no')) {
      escluse.push(keys.map(k => k.label_it).join(' o '));
      continue;
    }
    incerta = true;
  }
  if (escluse.length > 0) {
    return {
      status: 'not_applicable',
      reason_it: `Requisito non applicabile in base a quanto dichiarato all'avvio dell'analisi: l'organizzazione non rientra fra ${escluse.join('; ')}.`,
    };
  }
  if (incerta) {
    return {
      status: 'unknown',
      reason_it: 'All\'avvio dell\'analisi non è stato dichiarato se questa condizione ricorre: il requisito resta da verificare.',
    };
  }
  return {
    status: 'applicable',
    reason_it: 'Condizione di applicabilità dichiarata come ricorrente all\'avvio dell\'analisi.',
  };
}

export function profileFactsForPrompt(profile: ApplicabilityProfile | null): string {
  if (!profile?.answers) return '';
  const labelByKey = new Map(APPLICABILITY_RULES.map(r => [r.key, r.label_it]));
  const si: string[] = [];
  const no: string[] = [];
  for (const [key, value] of Object.entries(profile.answers)) {
    const label = labelByKey.get(key);
    if (!label) continue;
    if (value === 'si' && !si.includes(label)) si.push(label);
    if (value === 'no' && !no.includes(label)) no.push(label);
  }
  const righe: string[] = [];
  if (profile.size) righe.push(`Dimensione dichiarata: ${profile.size}.`);
  if (si.length > 0) righe.push(`L'organizzazione ha dichiarato di rientrare fra: ${si.join('; ')}.`);
  if (no.length > 0) righe.push(`L'organizzazione ha dichiarato di NON rientrare fra: ${no.join('; ')}.`);
  if (righe.length === 0) return '';
  return `Dichiarazioni rese dall'organizzazione all'avvio dell'analisi (valgono come i fatti scritti nei documenti, ma riguardano solo l'applicabilità degli obblighi, mai la loro attuazione):\n${righe.join('\n')}`;
}

// Frasi che non provano nulla: autodichiarazioni di conformità e impegni per il futuro.
// Una citazione di questo tipo non può sostenere uno status diverso da "missing".
const NON_EVIDENCE_PATTERNS: RegExp[] = [
  /pienamente conform/i,
  /(e|è|e')\s+conforme\s+(al|alla|ai|alle)\b/i,
  /sono\s+conformi\s+(al|alla|ai|alle)\b/i,
  /(adotta|adottiamo|applica|applichiamo)\s+tutte\s+le\s+misure/i,
  /rispett(a|iamo)\s+tutti\s+gli\s+obblighi/i,
  /in\s+corso\s+di\s+(redazione|definizione|adozione|implementazione|predisposizione|aggiornamento)/i,
  /in\s+fase\s+di\s+(redazione|definizione|adozione|implementazione|predisposizione)/i,
  /sar(a|à|a')\s+(completat|redatt|predispost|adottat|implementat|definit|aggiornat)/i,
  /verr(a|à|a')\s+(completat|redatt|predispost|adottat|implementat|definit)/i,
  /(prevediamo|intendiamo|ci\s+impegniamo)\s+(di|a)\b/i,
  /non\s+ancora\s+(redatt|predispost|adottat|implementat|completat|formalizzat)/i,
];

export function quoteIsSubstantive(quote: string): boolean {
  return !NON_EVIDENCE_PATTERNS.some(p => p.test(quote));
}

export function normalizeModelCheck(
  req: RegulatoryRequirement, llm: any, applicabilityProfile: ApplicabilityProfile | null,
  documents: Array<{name: string; content: string}>, isIt: boolean,
  base: Pick<RequirementCheck, 'requirement_id' | 'regulation' | 'reference' | 'description' | 'severity' | 'remediation_effort' | 'conditional' | 'applicability_note' | 'keyword_coverage'>,
): RequirementCheck | null {
  const allowedStatuses = new Set(['covered', 'partial', 'missing', 'not_applicable']);
  if (llm && allowedStatuses.has(String(llm.status))) {
    let status = String(llm.status) as CheckStatus;
    const rawEvidence: any[] = Array.isArray(llm.evidence) ? llm.evidence : [];
    const evidence = verifyEvidence(rawEvidence, documents);
    // Una condizione dichiarata all'avvio vale più della deduzione del modello:
    // se l'organizzazione ha detto che ricorre, il requisito è applicabile e la sua
    // assenza è un gap vero, non una cosa da verificare.
    const verdict = applicabilityVerdict(req, applicabilityProfile);
    const applicability = verdict?.status === 'applicable'
      ? 'si'
      : verdict?.status === 'unknown'
      ? 'non_determinabile'
      : typeof llm.applicability === 'string' ? llm.applicability.toLowerCase() : '';
    const missingElements: string[] = (Array.isArray(llm.missing_elements) ? llm.missing_elements : [])
      .filter((m: any) => typeof m === 'string' && m.trim()).map((m: string) => m.trim().substring(0, 300)).slice(0, 8);
    let actions: string[] = (Array.isArray(llm.recommended_actions) ? llm.recommended_actions : [])
      .filter((a: any) => typeof a === 'string' && a.trim()).map((a: string) => a.trim().substring(0, 500)).slice(0, 3);
    let assessmentText = typeof llm.assessment === 'string' ? llm.assessment.trim().substring(0, 1200) : '';

    // An unsupported positive result is a failed verification, not proof of a gap.
    if ((status === 'covered' || status === 'partial') && evidence.length === 0) {
      status = 'to_verify';
      assessmentText = isIt
        ? 'La valutazione proposta non è sostenuta da citazioni verificate: rivalutare questo requisito.'
        : 'The proposed assessment lacks verified citations: reassess this requirement.';
    }
    if (status === 'not_applicable') {
      // A model may not override declared applicability or exclude without evidence.
      if (!req.conditional || applicability === 'si') status = 'to_verify';
      else if (applicability !== 'no' || evidence.length === 0 || verdict?.status === 'unknown') status = 'to_verify';
      if (status !== 'not_applicable') {
        assessmentText = isIt
          ? 'Esclusione proposta dal modello non confermata: verificare applicabilità e documentazione.'
          : 'The proposed exclusion was not confirmed: verify applicability and documentation.';
      }
    }
    // Un obbligo condizionale diventa un gap solo se risulta che la condizione ricorre davvero:
    // altrimenti finisce tra i requisiti da verificare, non tra quelli mancanti.
    if (req.conditional && (status === 'missing' || status === 'partial') && applicability !== 'si') {
      if (evidence.length === 0 || applicability === 'non_determinabile') status = 'to_verify';
    }
    // Su un gap l'utente deve poter vedere perché l'obbligo lo riguarda.
    if (verdict?.status === 'applicable' && (status === 'missing' || status === 'partial')
        && !assessmentText.includes('all\'avvio')) {
      assessmentText = `${assessmentText} ${verdict.reason_it}`.trim().substring(0, 1200);
    }

    if (status === 'to_verify') {
      missingElements.length = 0;
      actions = [];
    }
    if (actions.length === 0 && (status === 'missing' || status === 'partial')) {
      actions = [isIt ? req.recommended_action_it : req.recommended_action_en].filter(Boolean);
    }
    if (!assessmentText) {
      assessmentText = status === 'missing'
        ? (isIt ? 'Nessuna documentazione pertinente individuata nei documenti caricati.' : 'No relevant documentation found in the uploaded documents.')
        : status === 'to_verify'
        ? (isIt ? 'Dalla documentazione non risulta se il requisito si applica all\'organizzazione.' : 'The documentation does not show whether the requirement applies to the organisation.')
        : '';
    }
    return {
      ...base,
      status,
      risk_level: riskProfileFor(req.risk_level, status),
      assessment: assessmentText,
      evidence,
      missing_elements: missingElements,
      recommended_actions: actions,
      confidence: typeof llm.confidence === 'number' ? Math.max(0, Math.min(1, llm.confidence)) : null,
      applicability: applicability || null,
      method: 'llm_evidence' as const,
    };
  }

  return null;
}
