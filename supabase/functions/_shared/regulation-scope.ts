// Ambito soggettivo delle normative settoriali.
//
// Il GDPR riguarda chiunque tratti dati personali. Le altre cinque normative del catalogo no:
// DORA riguarda le entita' finanziarie e i loro fornitori TIC, NIS2 i soggetti essenziali e
// importanti, il CRA chi immette sul mercato prodotti con elementi digitali, l'AI Act chi
// sviluppa, usa o distribuisce sistemi di IA, il Data Act chi detiene dati di prodotti
// connessi o fornisce servizi di trattamento dati. Nessun documento aziendale dice a quale di
// queste categorie appartiene l'organizzazione: lo dice solo la risposta al questionario.
//
// Da qui la regola a tre stati, che vale per l'intera normativa:
//   - almeno una qualifica dichiarata "si"          -> la normativa si applica e viene valutata;
//   - tutte le qualifiche dichiarate "no"           -> la normativa non si applica;
//   - qualunque altro caso (risposta assente, "non lo so", risposta incompleta)
//                                                   -> ambito non determinato: nessun obbligo
//                                                      di quella normativa puo' diventare un gap.
//
// Prima di questa regola il caso "risposta assente" veniva trattato come "si applica": su
// un'azienda manifatturiera, lasciando in bianco la domanda su DORA, l'analisi produceva 29
// gap su 52 obblighi pensati per banche e assicurazioni.
//
// Il modulo non dipende da Deno ne' dal database, cosi' la regola e' coperta da test
// (deployment/regulation-scope.test.mjs) ed e' la stessa ovunque venga usata.

export type ScopeAnswer = 'si' | 'no' | 'non_so';

export interface RegulationGate {
  regulation: string;
  /** Qualifiche che fanno rientrare l'organizzazione nell'ambito della normativa. */
  keys: string[];
  /** Chi ricade nella normativa, per le motivazioni mostrate all'utente. */
  subject_it: string;
  subject_en: string;
}

export const REGULATION_GATES: RegulationGate[] = [
  {
    regulation: 'AI Act',
    keys: ['ai_provider', 'ai_deployer', 'ai_importer_distributor'],
    subject_it: 'fornitore, deployer, importatore o distributore di sistemi di intelligenza artificiale',
    subject_en: 'provider, deployer, importer or distributor of AI systems',
  },
  {
    regulation: 'CRA',
    keys: ['cra_manufacturer', 'cra_importer_distributor', 'cra_open_source'],
    subject_it: 'fabbricante, importatore o distributore di prodotti con elementi digitali, o gestore di software open source',
    subject_en: 'manufacturer, importer or distributor of products with digital elements, or open-source software steward',
  },
  {
    regulation: 'Data Act',
    keys: ['da_data_holder', 'da_cloud_provider', 'da_recipient'],
    subject_it: 'titolare dei dati di prodotti connessi, fornitore di servizi di trattamento dati o destinatario di dati',
    subject_en: 'data holder for connected products, data processing service provider or data recipient',
  },
  {
    regulation: 'DORA',
    keys: ['dora_financial_entity', 'dora_ctpp'],
    subject_it: 'entità finanziaria o fornitore di servizi TIC per entità finanziarie',
    subject_en: 'financial entity or ICT service provider to financial entities',
  },
  {
    regulation: 'NIS2',
    keys: ['nis2_entity', 'nis2_digital_provider'],
    subject_it: 'soggetto essenziale o importante ai fini NIS2',
    subject_en: 'essential or important entity under NIS2',
  },
];

export type ScopeStatus = 'universal' | 'in_scope' | 'out_of_scope' | 'undetermined';

export interface RegulationScope {
  status: ScopeStatus;
  reason_it: string;
  reason_en: string;
}

export function gateFor(regulation: string): RegulationGate | null {
  const wanted = String(regulation || '').trim().toLowerCase();
  return REGULATION_GATES.find(g => g.regulation.toLowerCase() === wanted) || null;
}

export function regulationScope(
  regulation: string,
  answers: Record<string, string> | null | undefined,
): RegulationScope {
  const gate = gateFor(regulation);
  if (!gate) {
    return { status: 'universal', reason_it: '', reason_en: '' };
  }
  const given = answers || {};
  const values = gate.keys.map(k => given[k]);

  if (values.some(v => v === 'si')) {
    return {
      status: 'in_scope',
      reason_it: `Normativa applicabile: l'organizzazione ha dichiarato di essere ${gate.subject_it}.`,
      reason_en: `Regulation applicable: the organisation declared it is a ${gate.subject_en}.`,
    };
  }
  if (values.length > 0 && values.every(v => v === 'no')) {
    return {
      status: 'out_of_scope',
      reason_it: `L'intera normativa non si applica: l'organizzazione ha dichiarato di non essere ${gate.subject_it}.`,
      reason_en: `The whole regulation does not apply: the organisation declared it is not a ${gate.subject_en}.`,
    };
  }
  const saidUnknown = values.some(v => v === 'non_so');
  return {
    status: 'undetermined',
    reason_it: saidUnknown
      ? `${gate.regulation} non valutata: all'avvio dell'analisi è stato risposto "non lo so" alla domanda se l'organizzazione sia ${gate.subject_it}. Finché non è stabilito, nessun obbligo di questa normativa viene trattato come carenza.`
      : `${gate.regulation} non valutata: all'avvio dell'analisi non è stato indicato se l'organizzazione sia ${gate.subject_it}. Finché non è stabilito, nessun obbligo di questa normativa viene trattato come carenza.`,
    reason_en: saidUnknown
      ? `${gate.regulation} not assessed: the answer to whether the organisation is a ${gate.subject_en} was "don't know". Until this is established, no obligation of this regulation is treated as a gap.`
      : `${gate.regulation} not assessed: it was not stated whether the organisation is a ${gate.subject_en}. Until this is established, no obligation of this regulation is treated as a gap.`,
  };
}
