import { protect } from '../_shared/access.ts';
import { aiFetch as fetch, getAIKey, getAIModel } from '../_shared/ai.ts';
import { serve as denoServe } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2.75.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

// ============================================================
// REGULATORY REQUIREMENTS CATALOG
// Each entry is a concrete, verifiable requirement with keywords
// used for deterministic document matching. NO AI involved.
// ============================================================

interface RegulatoryRequirement {
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
}

const REQUIREMENTS_CATALOG: RegulatoryRequirement[] = [
  // ===== GDPR =====
  {
    id: 'gdpr_art5_principles',
    regulation: 'GDPR',
    reference: 'Articolo 5 GDPR - Principi relativi al trattamento dei dati personali',
    description_it: 'I dati personali devono essere trattati in modo lecito, corretto e trasparente, raccolti per finalità determinate e conservati per il tempo strettamente necessario.',
    description_en: 'Personal data must be processed lawfully, fairly and transparently, collected for specified purposes and stored only as long as necessary.',
    risk_level: 'critical',
    remediation_effort: 'high',
    coverage_keywords: ['principi trattamento', 'liceità', 'correttezza', 'trasparenza', 'minimizzazione', 'limitazione conservazione', 'finalità', 'lawfulness', 'fairness', 'data minimisation', 'purpose limitation', 'storage limitation'],
    rag_validation_keywords: ['articolo 5', 'art. 5', 'art 5'],
    gap_description_it: 'Non è stata individuata una documentazione formale che descriva i principi di trattamento dei dati personali applicati dall\'organizzazione secondo l\'Articolo 5 GDPR.',
    gap_description_en: 'No formal documentation describing the principles of personal data processing applied by the organization under Article 5 GDPR was found.',
    recommended_action_it: 'Redigere una policy di trattamento dati che formalizzi i principi di liceità, correttezza, trasparenza, minimizzazione e limitazione della conservazione.',
    recommended_action_en: 'Draft a data processing policy formalizing the principles of lawfulness, fairness, transparency, minimization and storage limitation.',
    action_hours: 40,
    action_cost_eur: 3400,
  },
  {
    id: 'gdpr_art6_lawfulness',
    regulation: 'GDPR',
    reference: 'Articolo 6 GDPR - Liceità del trattamento',
    description_it: 'Il trattamento è lecito solo se e nella misura in cui ricorre almeno una delle basi giuridiche previste: consenso, esecuzione contratto, obbligo legale, interesse vitale, interesse pubblico o interesse legittimo.',
    description_en: 'Processing is lawful only if at least one legal basis applies: consent, contract performance, legal obligation, vital interest, public interest or legitimate interest.',
    risk_level: 'critical',
    remediation_effort: 'high',
    coverage_keywords: ['base giuridica', 'basi giuridiche', 'consenso', 'interesse legittimo', 'obbligo legale', 'esecuzione contratto', 'legal basis', 'consent', 'legitimate interest', 'legal obligation'],
    rag_validation_keywords: ['articolo 6', 'art. 6', 'art 6'],
    gap_description_it: 'Manca una mappatura formale delle basi giuridiche utilizzate per ciascuna finalità di trattamento come richiesto dall\'Articolo 6 GDPR.',
    gap_description_en: 'A formal mapping of the legal bases used for each processing purpose as required by Article 6 GDPR is missing.',
    recommended_action_it: 'Creare un registro delle basi giuridiche per ogni trattamento effettuato, documentando consenso, interesse legittimo o altra base applicabile.',
    recommended_action_en: 'Create a register of legal bases for each processing activity, documenting consent, legitimate interest or other applicable basis.',
    action_hours: 32,
    action_cost_eur: 2720,
  },
  {
    id: 'gdpr_art13_14_information',
    regulation: 'GDPR',
    reference: 'Articoli 13-14 GDPR - Informazioni da fornire all\'interessato',
    description_it: 'L\'organizzazione deve fornire all\'interessato informazioni chiare e complete sul trattamento dei dati al momento della raccolta o entro un termine ragionevole.',
    description_en: 'The organization must provide clear and complete information to data subjects about data processing at the time of collection or within a reasonable period.',
    risk_level: 'high',
    remediation_effort: 'medium',
    coverage_keywords: ['informativa', 'privacy notice', 'privacy policy', 'informazioni interessato', 'trasparenza', 'data subject information', 'notice'],
    rag_validation_keywords: ['articolo 13', 'art. 13', 'art 13'],
    gap_description_it: 'Non sono state identificate informative privacy conformi agli Articoli 13 e 14 GDPR che descrivano finalità, basi giuridiche, diritti degli interessati e tempi di conservazione.',
    gap_description_en: 'No privacy notices compliant with Articles 13 and 14 GDPR were found describing purposes, legal bases, data subject rights and retention periods.',
    recommended_action_it: 'Redigere informative privacy complete per ogni punto di raccolta dati, includendo tutte le informazioni obbligatorie degli Articoli 13 e 14.',
    recommended_action_en: 'Draft complete privacy notices for each data collection point, including all mandatory information under Articles 13 and 14.',
    action_hours: 24,
    action_cost_eur: 2040,
  },
  {
    id: 'gdpr_art12_15_22_data_subject_rights',
    regulation: 'GDPR',
    reference: 'Articoli 12, 15-22 GDPR - Diritti dell\'interessato e modalità di esercizio',
    description_it: 'L\'organizzazione deve agevolare l\'esercizio dei diritti dell\'interessato (accesso, rettifica, cancellazione, limitazione, portabilità, opposizione) con procedure chiare, tempi di risposta entro 30 giorni e modalità accessibili.',
    description_en: 'The organization must facilitate the exercise of data subject rights (access, rectification, erasure, restriction, portability, objection) with clear procedures, response times within 30 days and accessible methods.',
    risk_level: 'high',
    remediation_effort: 'medium',
    coverage_keywords: [
      'diritti interessato', 'diritti degli interessati', 'esercizio dei diritti', 'esercizio diritti',
      'diritto di accesso', 'diritto accesso', 'diritto di rettifica', 'diritto rettifica',
      'diritto di cancellazione', 'diritto cancellazione', 'diritto oblio', 'diritto all\'oblio',
      'diritto di limitazione', 'diritto limitazione', 'diritto alla portabilità', 'portabilità dati',
      'diritto di opposizione', 'diritto opposizione',
      'procedura diritti', 'procedura esercizio diritti', 'gestione richieste interessati',
      'DSAR', 'data subject access request', 'data subject rights',
      'right of access', 'right to rectification', 'right to erasure', 'right to be forgotten',
      'right to restriction', 'right to data portability', 'right to object',
      'modulo richiesta', 'istanza interessato', 'richiesta accesso',
    ],
    rag_validation_keywords: ['articolo 12', 'art. 12', 'art 12', 'articolo 15', 'art. 15'],
    gap_description_it: 'Non è stata identificata una procedura documentata per la gestione delle richieste di esercizio dei diritti degli interessati (Artt. 15-22 GDPR) con tempi, modalità e responsabili definiti.',
    gap_description_en: 'No documented procedure for handling data subject rights requests (Arts. 15-22 GDPR) with defined timelines, methods and responsible parties was found.',
    recommended_action_it: 'Definire una procedura formale di gestione delle richieste DSAR che includa: canali di ricezione, tempi di risposta (max 30 gg), processo di verifica identità, moduli standardizzati e registro delle richieste.',
    recommended_action_en: 'Define a formal DSAR management procedure including: reception channels, response times (max 30 days), identity verification process, standardized forms and request register.',
    action_hours: 24,
    action_cost_eur: 2040,
    coverage_threshold: 0.05,
    min_keyword_matches: 1,
  },
  {
    id: 'gdpr_art25_privacy_by_design',
    regulation: 'GDPR',
    reference: 'Articolo 25 GDPR - Protezione dei dati fin dalla progettazione e per impostazione predefinita',
    description_it: 'L\'organizzazione deve implementare misure tecniche e organizzative adeguate sia al momento della determinazione dei mezzi che al momento del trattamento stesso.',
    description_en: 'The organization must implement appropriate technical and organizational measures both at the time of determining the means and at the time of processing.',
    risk_level: 'high',
    remediation_effort: 'high',
    coverage_keywords: ['privacy by design', 'privacy by default', 'protezione fin dalla progettazione', 'data protection by design', 'misure tecniche', 'pseudonimizzazione'],
    rag_validation_keywords: ['articolo 25', 'art. 25', 'art 25'],
    gap_description_it: 'Non è documentata una procedura di privacy by design e by default che integri la protezione dei dati nella progettazione dei sistemi e dei processi aziendali.',
    gap_description_en: 'No privacy by design and by default procedure documenting the integration of data protection into system and process design was found.',
    recommended_action_it: 'Definire e documentare una procedura di Privacy by Design che includa checklist per nuovi progetti, valutazione impatti e misure tecniche predefinite.',
    recommended_action_en: 'Define and document a Privacy by Design procedure including checklists for new projects, impact assessments and default technical measures.',
    action_hours: 48,
    action_cost_eur: 4080,
  },
  {
    id: 'gdpr_art28_processor',
    regulation: 'GDPR',
    reference: 'Articolo 28 GDPR - Responsabile del trattamento',
    description_it: 'L\'organizzazione deve formalizzare i rapporti con i responsabili del trattamento tramite contratti o altri atti giuridici che stabiliscano obblighi, garanzie e istruzioni.',
    description_en: 'The organization must formalize relationships with data processors through contracts or other legal acts establishing obligations, guarantees and instructions.',
    risk_level: 'high',
    remediation_effort: 'medium',
    coverage_keywords: ['responsabile trattamento', 'data processor', 'dpa', 'data processing agreement', 'sub-responsabile', 'sub-processor', 'contratto trattamento', 'nomina responsabile'],
    rag_validation_keywords: ['articolo 28', 'art. 28', 'art 28'],
    gap_description_it: 'Non sono stati identificati accordi formali di trattamento dati (DPA) con i responsabili del trattamento conformi all\'Articolo 28 GDPR.',
    gap_description_en: 'No formal data processing agreements (DPA) with data processors compliant with Article 28 GDPR were found.',
    recommended_action_it: 'Predisporre modelli di Data Processing Agreement (DPA) conformi all\'Art. 28 e verificare tutti i contratti con fornitori che trattano dati personali.',
    recommended_action_en: 'Prepare Data Processing Agreement (DPA) templates compliant with Art. 28 and review all contracts with suppliers processing personal data.',
    action_hours: 30,
    action_cost_eur: 2550,
  },
  {
    id: 'gdpr_art30_records',
    regulation: 'GDPR',
    reference: 'Articolo 30 GDPR - Registri delle attività di trattamento',
    description_it: 'L\'organizzazione deve tenere un registro delle attività di trattamento contenente informazioni dettagliate su finalità, categorie di dati, destinatari e misure di sicurezza.',
    description_en: 'The organization must maintain a record of processing activities containing detailed information on purposes, data categories, recipients and security measures.',
    risk_level: 'high',
    remediation_effort: 'medium',
    coverage_keywords: ['registro trattamenti', 'registro attività', 'record of processing', 'ropa', 'registro dei trattamenti', 'records of processing activities'],
    rag_validation_keywords: ['articolo 30', 'art. 30', 'art 30'],
    gap_description_it: 'Non è stato individuato un Registro delle Attività di Trattamento (ROPA) conforme all\'Articolo 30 GDPR con tutte le informazioni obbligatorie.',
    gap_description_en: 'No Record of Processing Activities (ROPA) compliant with Article 30 GDPR containing all mandatory information was found.',
    recommended_action_it: 'Creare e mantenere un Registro delle Attività di Trattamento completo con tutte le informazioni obbligatorie previste dall\'Articolo 30.',
    recommended_action_en: 'Create and maintain a complete Record of Processing Activities with all mandatory information required by Article 30.',
    action_hours: 24,
    action_cost_eur: 2040,
  },
  {
    id: 'gdpr_art32_security',
    regulation: 'GDPR',
    reference: 'Articolo 32 GDPR - Sicurezza del trattamento',
    description_it: 'L\'organizzazione deve implementare misure tecniche e organizzative adeguate per garantire un livello di sicurezza proporzionato al rischio, tra cui cifratura, pseudonimizzazione e test regolari.',
    description_en: 'The organization must implement appropriate technical and organizational measures to ensure a level of security proportionate to the risk, including encryption, pseudonymization and regular testing.',
    risk_level: 'critical',
    remediation_effort: 'high',
    coverage_keywords: ['sicurezza trattamento', 'cifratura', 'crittografia', 'pseudonimizzazione', 'encryption', 'security measures', 'misure di sicurezza', 'test sicurezza', 'penetration test', 'vulnerability assessment'],
    rag_validation_keywords: ['articolo 32', 'art. 32', 'art 32'],
    gap_description_it: 'Non è documentata una policy di sicurezza del trattamento conforme all\'Articolo 32 GDPR che includa misure tecniche come cifratura, pseudonimizzazione e test periodici.',
    gap_description_en: 'No processing security policy compliant with Article 32 GDPR documenting technical measures such as encryption, pseudonymization and regular testing was found.',
    recommended_action_it: 'Implementare e documentare misure di sicurezza conformi all\'Art. 32 GDPR includendo cifratura, controllo accessi, test periodici e procedure di ripristino.',
    recommended_action_en: 'Implement and document security measures compliant with Art. 32 GDPR including encryption, access control, regular testing and recovery procedures.',
    action_hours: 60,
    action_cost_eur: 5100,
  },
  {
    id: 'gdpr_art33_34_breach',
    regulation: 'GDPR',
    reference: 'Articoli 33-34 GDPR - Notifica e comunicazione di violazione dei dati',
    description_it: 'L\'organizzazione deve notificare le violazioni dei dati personali all\'autorità di controllo entro 72 ore e, in caso di rischio elevato, comunicarle agli interessati.',
    description_en: 'The organization must notify personal data breaches to the supervisory authority within 72 hours and, in case of high risk, communicate them to data subjects.',
    risk_level: 'critical',
    remediation_effort: 'medium',
    coverage_keywords: ['data breach', 'violazione dati', 'notifica violazione', 'breach notification', 'registro violazioni', '72 ore', 'incidente', 'incident response'],
    rag_validation_keywords: ['articolo 33', 'art. 33', 'art 33'],
    gap_description_it: 'Non è stata identificata una procedura formale di gestione e notifica delle violazioni dei dati personali conforme agli Articoli 33 e 34 GDPR con tempistiche di 72 ore.',
    gap_description_en: 'No formal data breach management and notification procedure compliant with Articles 33 and 34 GDPR with 72-hour timelines was found.',
    recommended_action_it: 'Definire una procedura di data breach management con: rilevamento, valutazione, notifica entro 72 ore al Garante e comunicazione agli interessati se necessario.',
    recommended_action_en: 'Define a data breach management procedure with: detection, assessment, notification within 72 hours to the DPA and communication to data subjects if necessary.',
    action_hours: 30,
    action_cost_eur: 2550,
  },
  {
    id: 'gdpr_art35_dpia',
    regulation: 'GDPR',
    reference: 'Articolo 35 GDPR - Valutazione d\'impatto sulla protezione dei dati',
    description_it: 'L\'organizzazione deve effettuare una DPIA quando un trattamento può comportare un rischio elevato per i diritti e le libertà delle persone fisiche.',
    description_en: 'The organization must carry out a DPIA when processing is likely to result in a high risk to the rights and freedoms of natural persons.',
    risk_level: 'high',
    remediation_effort: 'high',
    coverage_keywords: ['dpia', 'valutazione impatto', 'data protection impact assessment', 'impact assessment', 'valutazione rischio', 'risk assessment privacy'],
    rag_validation_keywords: ['articolo 35', 'art. 35', 'art 35'],
    gap_description_it: 'Non è documentata una procedura di DPIA (Valutazione d\'Impatto sulla Protezione dei Dati) conforme all\'Articolo 35 GDPR per i trattamenti ad alto rischio.',
    gap_description_en: 'No DPIA (Data Protection Impact Assessment) procedure compliant with Article 35 GDPR for high-risk processing was documented.',
    recommended_action_it: 'Implementare un framework DPIA con template, criteri per identificare trattamenti ad alto rischio e processo di consultazione preventiva con il DPO.',
    recommended_action_en: 'Implement a DPIA framework with templates, criteria for identifying high-risk processing and prior consultation process with the DPO.',
    action_hours: 40,
    action_cost_eur: 3400,
    conditional: true,
    applicability_note_it: 'La DPIA è obbligatoria solo per trattamenti ad alto rischio (art. 35, par. 3 e criteri EDPB); in ogni caso è attesa una valutazione documentata di necessità.',
  },
  {
    id: 'gdpr_art37_dpo',
    regulation: 'GDPR',
    reference: 'Articolo 37 GDPR - Designazione del responsabile della protezione dei dati',
    description_it: 'L\'organizzazione deve designare un DPO quando il trattamento è effettuato da un\'autorità pubblica, comporta un monitoraggio sistematico su larga scala o riguarda dati sensibili su larga scala.',
    description_en: 'The organization must designate a DPO when processing is carried out by a public authority, involves systematic large-scale monitoring or relates to sensitive data on a large scale.',
    risk_level: 'high',
    remediation_effort: 'low',
    coverage_keywords: ['dpo', 'data protection officer', 'responsabile protezione dati', 'rpd', 'designazione dpo'],
    rag_validation_keywords: ['articolo 37', 'art. 37', 'art 37'],
    gap_description_it: 'Non è documentata la designazione formale di un DPO (Responsabile della Protezione dei Dati) come richiesto dall\'Articolo 37 GDPR.',
    gap_description_en: 'No formal DPO (Data Protection Officer) designation as required by Article 37 GDPR was documented.',
    recommended_action_it: 'Nominare un DPO (interno o esterno), pubblicare i contatti e comunicarlo all\'Autorità Garante come previsto dall\'Articolo 37 GDPR.',
    recommended_action_en: 'Appoint a DPO (internal or external), publish contact details and notify the supervisory authority as required by Article 37 GDPR.',
    action_hours: 8,
    action_cost_eur: 680,
    conditional: true,
    applicability_note_it: 'La designazione è obbligatoria per autorità pubbliche, monitoraggio regolare e sistematico su larga scala o trattamento su larga scala di categorie particolari; negli altri casi è attesa una valutazione documentata.',
  },

  {
    id: 'gdpr_art7_consent',
    regulation: 'GDPR',
    reference: 'Articolo 7 GDPR - Condizioni per il consenso',
    description_it: 'Quando il trattamento si basa sul consenso, il titolare deve essere in grado di dimostrare che l\'interessato lo ha prestato; la richiesta deve essere chiaramente distinguibile, formulata in modo comprensibile e il consenso deve essere revocabile con la stessa facilità con cui è stato prestato.',
    description_en: 'Where processing is based on consent, the controller must be able to demonstrate that the data subject has consented; the request must be clearly distinguishable, intelligible, and consent must be as easy to withdraw as to give.',
    risk_level: 'high',
    remediation_effort: 'medium',
    coverage_keywords: ['consenso', 'revoca del consenso', 'revocare il consenso', 'prova del consenso', 'registro dei consensi', 'consent', 'withdraw consent', 'consent record', 'modulo di consenso', 'opt-in'],
    rag_validation_keywords: ['articolo 7', 'art. 7', 'art 7'],
    gap_description_it: 'Non risulta documentato come viene raccolto, registrato e reso revocabile il consenso per i trattamenti che si fondano su questa base giuridica (Art. 7 GDPR).',
    gap_description_en: 'There is no documentation of how consent is collected, recorded and made withdrawable for processing based on this legal basis (Art. 7 GDPR).',
    recommended_action_it: 'Predisporre moduli di consenso distinti per finalità, un registro che conservi la prova del consenso (chi, quando, per cosa, con quale testo) e un canale di revoca semplice quanto la prestazione.',
    recommended_action_en: 'Prepare purpose-specific consent forms, a register holding proof of consent (who, when, for what, with which wording) and a withdrawal channel as simple as the opt-in.',
    action_hours: 16,
    action_cost_eur: 1360,
    conditional: true,
    applicability_note_it: 'Applicabile solo se almeno un trattamento si fonda sul consenso (marketing, newsletter, cookie non tecnici, foto/video, dati facoltativi).',
  },
  {
    id: 'gdpr_art9_special_categories',
    regulation: 'GDPR',
    reference: 'Articolo 9 GDPR - Trattamento di categorie particolari di dati personali',
    description_it: 'Il trattamento di dati relativi a salute, orientamento sessuale, convinzioni religiose, appartenenza sindacale, dati genetici o biometrici è vietato salvo che ricorra una delle condizioni dell\'art. 9, par. 2; la condizione applicata deve essere individuata e documentata, con garanzie rafforzate.',
    description_en: 'Processing of data concerning health, sexual orientation, religious beliefs, trade union membership, genetic or biometric data is prohibited unless one of the conditions in Art. 9(2) applies; the condition relied upon must be identified and documented, with strengthened safeguards.',
    risk_level: 'critical',
    remediation_effort: 'medium',
    coverage_keywords: ['categorie particolari', 'dati particolari', 'dati sensibili', 'dati relativi alla salute', 'dati sanitari', 'dati biometrici', 'appartenenza sindacale', 'special categories', 'health data', 'biometric', 'articolo 9', 'art. 9'],
    rag_validation_keywords: ['articolo 9', 'art. 9', 'art 9'],
    gap_description_it: 'La documentazione non individua la condizione dell\'art. 9, par. 2 GDPR che legittima il trattamento delle categorie particolari di dati né le garanzie specifiche adottate.',
    gap_description_en: 'The documentation does not identify the Art. 9(2) GDPR condition legitimising the processing of special categories of data nor the specific safeguards adopted.',
    recommended_action_it: 'Censire i trattamenti di categorie particolari (es. dati sanitari del personale), indicare per ciascuno la condizione dell\'art. 9, par. 2 applicata e documentare le garanzie rafforzate (accessi limitati, cifratura, istruzioni specifiche agli autorizzati).',
    recommended_action_en: 'Inventory special-category processing (e.g. staff health data), state for each the Art. 9(2) condition relied upon and document the strengthened safeguards (restricted access, encryption, specific instructions to authorised staff).',
    action_hours: 16,
    action_cost_eur: 1360,
    conditional: true,
    applicability_note_it: 'Applicabile se l\'organizzazione tratta dati sanitari, biometrici, sindacali o altre categorie particolari (quasi sempre presenti nei rapporti di lavoro: certificati di malattia, idoneità, trattenute sindacali).',
  },
  {
    id: 'gdpr_art22_automated_decisions',
    regulation: 'GDPR',
    reference: 'Articolo 22 GDPR - Processo decisionale automatizzato e profilazione',
    description_it: 'L\'interessato ha diritto a non essere sottoposto a decisioni basate unicamente su un trattamento automatizzato, compresa la profilazione, che producano effetti giuridici o incidano significativamente su di lui, salvo le eccezioni previste e con garanzie adeguate (intervento umano, contestazione).',
    description_en: 'The data subject has the right not to be subject to decisions based solely on automated processing, including profiling, which produce legal or similarly significant effects, save for the exceptions provided and with suitable safeguards (human intervention, right to contest).',
    risk_level: 'high',
    remediation_effort: 'medium',
    coverage_keywords: ['processo decisionale automatizzato', 'decisione automatizzata', 'profilazione', 'intervento umano', 'automated decision', 'profiling', 'human intervention', 'algoritmo', 'scoring'],
    rag_validation_keywords: ['articolo 22', 'art. 22', 'art 22'],
    gap_description_it: 'Non è documentato se l\'organizzazione adotta decisioni unicamente automatizzate o profilazione e, in caso affermativo, quali garanzie (intervento umano, informativa specifica, diritto di contestazione) sono previste.',
    gap_description_en: 'It is not documented whether the organisation makes solely automated decisions or profiling and, if so, which safeguards (human intervention, specific notice, right to contest) are in place.',
    recommended_action_it: 'Verificare se esistono decisioni automatizzate con effetti significativi (selezione del personale, scoring, controllo accessi) e, se presenti, documentare logica, garanzie e modalità di richiesta dell\'intervento umano.',
    recommended_action_en: 'Verify whether automated decisions with significant effects exist (recruitment, scoring, access control) and, if so, document the logic, safeguards and how human intervention can be requested.',
    action_hours: 12,
    action_cost_eur: 1020,
    conditional: true,
    applicability_note_it: 'Applicabile solo se l\'organizzazione adotta decisioni unicamente automatizzate o attività di profilazione con effetti significativi sulle persone.',
  },
  {
    id: 'gdpr_art24_accountability',
    regulation: 'GDPR',
    reference: 'Articolo 24 GDPR - Responsabilità del titolare del trattamento',
    description_it: 'Il titolare deve mettere in atto misure tecniche e organizzative adeguate per garantire, ed essere in grado di dimostrare, che il trattamento è conforme al Regolamento, riesaminandole e aggiornandole; ciò include politiche interne in materia di protezione dei dati.',
    description_en: 'The controller must implement appropriate technical and organisational measures to ensure, and be able to demonstrate, that processing complies with the Regulation, reviewing and updating them; this includes internal data protection policies.',
    risk_level: 'high',
    remediation_effort: 'high',
    coverage_keywords: ['responsabilizzazione', 'accountability', 'politica privacy interna', 'regolamento interno privacy', 'modello organizzativo privacy', 'organigramma privacy', 'riesame', 'aggiornamento periodico', 'data protection policy', 'ruoli e responsabilità'],
    rag_validation_keywords: ['articolo 24', 'art. 24', 'art 24'],
    gap_description_it: 'Non risulta un modello organizzativo privacy (politiche interne, ruoli e responsabilità, riesame periodico) che permetta di dimostrare la conformità come richiesto dall\'Art. 24 GDPR.',
    gap_description_en: 'No privacy governance model (internal policies, roles and responsibilities, periodic review) enabling the organisation to demonstrate compliance under Art. 24 GDPR was found.',
    recommended_action_it: 'Adottare un regolamento interno privacy che definisca ruoli (titolare, referenti, autorizzati, DPO), politiche di protezione dei dati e un ciclo di riesame periodico documentato.',
    recommended_action_en: 'Adopt an internal privacy policy defining roles (controller, function owners, authorised staff, DPO), data protection policies and a documented periodic review cycle.',
    action_hours: 32,
    action_cost_eur: 2720,
  },
  {
    id: 'gdpr_art26_joint_controllers',
    regulation: 'GDPR',
    reference: 'Articolo 26 GDPR - Contitolari del trattamento',
    description_it: 'Quando due o più titolari determinano congiuntamente finalità e mezzi del trattamento, devono definire in modo trasparente, mediante accordo interno, le rispettive responsabilità, in particolare per l\'esercizio dei diritti degli interessati e le informative, rendendone disponibile il contenuto essenziale.',
    description_en: 'Where two or more controllers jointly determine the purposes and means of processing, they must transparently determine their respective responsibilities by means of an arrangement, in particular for data subject rights and notices, making its essence available to data subjects.',
    risk_level: 'medium',
    remediation_effort: 'medium',
    coverage_keywords: ['contitolari', 'contitolarità', 'accordo di contitolarità', 'joint controller', 'joint controllership', 'titolari congiunti'],
    rag_validation_keywords: ['articolo 26', 'art. 26', 'art 26'],
    gap_description_it: 'Non risultano accordi di contitolarità per i trattamenti gestiti insieme ad altri titolari, né una valutazione documentata sull\'assenza di situazioni di contitolarità.',
    gap_description_en: 'No joint controllership arrangements were found for processing managed together with other controllers, nor a documented assessment on the absence of joint controllership.',
    recommended_action_it: 'Individuare i trattamenti condivisi con altri titolari (gruppo, partner, capofila di progetto) e formalizzare per ciascuno un accordo ex art. 26 con ripartizione dei compiti e punto di contatto per gli interessati.',
    recommended_action_en: 'Identify processing shared with other controllers (group companies, partners, project leads) and formalise an Art. 26 arrangement for each, with allocation of duties and a contact point for data subjects.',
    action_hours: 12,
    action_cost_eur: 1020,
    conditional: true,
    applicability_note_it: 'Applicabile solo se esistono trattamenti le cui finalità e mezzi sono decisi insieme ad altri titolari.',
  },
  {
    id: 'gdpr_art29_staff_instructions',
    regulation: 'GDPR',
    reference: 'Articolo 29 e Articolo 32, paragrafo 4 GDPR - Trattamento sotto l\'autorità del titolare e istruzioni agli autorizzati',
    description_it: 'Chiunque agisca sotto l\'autorità del titolare o del responsabile e abbia accesso a dati personali può trattarli solo su istruzione del titolare; il titolare deve garantire che il personale autorizzato riceva istruzioni documentate e formazione adeguata.',
    description_en: 'Anyone acting under the authority of the controller or processor who has access to personal data may process them only on the controller\'s instructions; the controller must ensure authorised staff receive documented instructions and adequate training.',
    risk_level: 'medium',
    remediation_effort: 'low',
    coverage_keywords: ['istruzioni operative', 'lettera di incarico', 'autorizzati al trattamento', 'persone autorizzate', 'incaricati', 'designazione', 'formazione privacy', 'formazione del personale', 'training', 'articolo 29', 'art. 29'],
    rag_validation_keywords: ['articolo 29', 'art. 29', 'art 29'],
    gap_description_it: 'Non risultano istruzioni documentate e attività di formazione per il personale autorizzato al trattamento dei dati (Art. 29 e Art. 32, par. 4 GDPR).',
    gap_description_en: 'No documented instructions and training activities for staff authorised to process personal data were found (Art. 29 and Art. 32(4) GDPR).',
    recommended_action_it: 'Formalizzare lettere di autorizzazione con istruzioni operative per funzione, tenere un registro delle autorizzazioni e pianificare formazione periodica con evidenza di partecipazione.',
    recommended_action_en: 'Formalise authorisation letters with operating instructions per role, keep a register of authorisations and schedule periodic training with attendance records.',
    action_hours: 12,
    action_cost_eur: 1020,
  },
  {
    id: 'gdpr_art38_39_dpo_position',
    regulation: 'GDPR',
    reference: 'Articoli 38-39 GDPR - Posizione e compiti del responsabile della protezione dei dati',
    description_it: 'Il DPO deve essere coinvolto tempestivamente in tutte le questioni relative alla protezione dei dati, disporre delle risorse necessarie, non ricevere istruzioni sull\'esercizio dei compiti, riferire al vertice e svolgere i compiti di sorveglianza, consulenza e cooperazione con l\'autorità; i suoi dati di contatto vanno pubblicati e comunicati al Garante.',
    description_en: 'The DPO must be involved in a timely manner in all data protection matters, have the necessary resources, receive no instructions on the exercise of tasks, report to the highest management level and carry out monitoring, advisory and cooperation tasks; the DPO\'s contact details must be published and communicated to the supervisory authority.',
    risk_level: 'medium',
    remediation_effort: 'low',
    coverage_keywords: ['relazione del dpo', 'relazione annuale', 'compiti del dpo', 'rpd', 'responsabile della protezione dei dati', 'dpo', 'data protection officer', 'comunicazione al garante', 'contatti del dpo', 'sorveglianza', 'audit privacy'],
    rag_validation_keywords: ['articolo 38', 'art. 38', 'art 38', 'articolo 39', 'art. 39'],
    gap_description_it: 'Non risulta documentato come il DPO svolge i propri compiti (relazioni periodiche, coinvolgimento nelle decisioni, comunicazione dei contatti al Garante e pubblicazione).',
    gap_description_en: 'It is not documented how the DPO carries out the tasks (periodic reports, involvement in decisions, communication of contact details to the supervisory authority and publication).',
    recommended_action_it: 'Documentare il piano di attività del DPO, le relazioni periodiche al vertice, la comunicazione dei dati di contatto al Garante e la loro pubblicazione nelle informative.',
    recommended_action_en: 'Document the DPO activity plan, periodic reports to top management, the communication of contact details to the supervisory authority and their publication in privacy notices.',
    action_hours: 8,
    action_cost_eur: 680,
    conditional: true,
    applicability_note_it: 'Applicabile solo se è stato designato un DPO (obbligatorio o volontario).',
  },
  {
    id: 'gdpr_art44_49_transfers',
    regulation: 'GDPR',
    reference: 'Articoli 44-49 GDPR - Trasferimenti di dati personali verso paesi terzi',
    description_it: 'Il trasferimento di dati personali verso paesi terzi o organizzazioni internazionali è ammesso solo con decisione di adeguatezza, garanzie adeguate (clausole contrattuali tipo, norme vincolanti d\'impresa) o deroghe specifiche, con valutazione documentata del paese di destinazione.',
    description_en: 'Transfers of personal data to third countries or international organisations are permitted only under an adequacy decision, appropriate safeguards (standard contractual clauses, binding corporate rules) or specific derogations, with a documented assessment of the destination country.',
    risk_level: 'high',
    remediation_effort: 'medium',
    coverage_keywords: ['trasferimento extra ue', 'trasferimenti verso paesi terzi', 'paesi terzi', 'clausole contrattuali standard', 'clausole contrattuali tipo', 'standard contractual clauses', 'scc', 'decisione di adeguatezza', 'data privacy framework', 'transfer impact assessment', 'tia', 'third countries', 'stati uniti', 'extra ue'],
    rag_validation_keywords: ['articolo 44', 'art. 44', 'art 44', 'articolo 46', 'art. 46'],
    gap_description_it: 'Non è documentato se avvengono trasferimenti di dati verso paesi terzi (es. fornitori cloud o software con sedi extra UE) e su quale strumento di garanzia si fondano.',
    gap_description_en: 'It is not documented whether data transfers to third countries take place (e.g. cloud or software providers based outside the EU) and which safeguard instrument they rely on.',
    recommended_action_it: 'Mappare i fornitori con sedi o server extra UE, indicare per ciascuno lo strumento di trasferimento (adeguatezza, clausole standard con valutazione d\'impatto) e riportarlo nel registro e nelle informative.',
    recommended_action_en: 'Map suppliers with premises or servers outside the EU, state the transfer tool for each (adequacy, standard clauses with transfer impact assessment) and reflect it in the register and privacy notices.',
    action_hours: 16,
    action_cost_eur: 1360,
    conditional: true,
    applicability_note_it: 'Applicabile se dati personali sono trasferiti o accessibili da paesi fuori dallo Spazio economico europeo, anche tramite fornitori cloud.',
  },
  // ===== NIS2 =====
  {
    id: 'nis2_art20_governance',
    regulation: 'NIS2',
    reference: 'Art. 23 D.Lgs. 138/2024 (Art. 20 Dir. NIS2) - Obblighi degli organi di amministrazione e direttivi',
    description_it: 'Ai sensi dell\'Art. 23 del D.Lgs. 138/2024, gli organi di amministrazione e direttivi dei soggetti essenziali e importanti devono approvare le modalità di implementazione delle misure di gestione dei rischi, sovrintenderne l\'attuazione e possono essere ritenuti responsabili delle violazioni.',
    description_en: 'Under Art. 23 D.Lgs. 138/2024, management and executive bodies of essential and important entities must approve risk management measures implementation, oversee their execution and may be held liable for violations.',
    risk_level: 'critical',
    remediation_effort: 'high',
    coverage_keywords: ['governance cybersicurezza', 'cybersecurity governance', 'organi di gestione', 'organi di amministrazione', 'organi direttivi', 'management body', 'formazione cybersicurezza', 'formazione dirigenti', 'approvazione misure', 'board cybersecurity', 'responsabilità dirigenti', 'd.lgs. 138'],
    rag_validation_keywords: ['articolo 20', 'art. 20', 'articolo 23', 'art. 23', 'organi di amministrazione', 'organi direttivi'],
    gap_description_it: 'Non è documentato un framework di governance della cybersicurezza conforme all\'Articolo 20 NIS2 con approvazione degli organi di gestione e formazione obbligatoria.',
    gap_description_en: 'No cybersecurity governance framework compliant with Article 20 NIS2 with management body approval and mandatory training was documented.',
    recommended_action_it: 'Istituire un framework di governance cyber con approvazione formale del CdA, definire ruoli e responsabilità e pianificare formazione obbligatoria per i dirigenti.',
    recommended_action_en: 'Establish a cyber governance framework with formal board approval, define roles and responsibilities and plan mandatory training for managers.',
    action_hours: 60,
    action_cost_eur: 5100,
  },
  {
    id: 'nis2_art21_risk_measures',
    regulation: 'NIS2',
    reference: 'Art. 24 D.Lgs. 138/2024 (Art. 21 Dir. NIS2) - Misure di gestione dei rischi per la sicurezza informatica',
    description_it: 'Le entità devono adottare misure tecniche, operative e organizzative adeguate e proporzionate per gestire i rischi per la sicurezza dei sistemi informatici e di rete.',
    description_en: 'Entities must adopt appropriate and proportionate technical, operational and organizational measures to manage risks to the security of network and information systems.',
    risk_level: 'critical',
    remediation_effort: 'very_high',
    coverage_keywords: ['gestione rischi', 'risk management', 'misure sicurezza', 'security measures', 'analisi rischio', 'risk assessment', 'gestione incidenti', 'incident handling', 'continuità operativa', 'business continuity', 'supply chain', 'catena fornitura', 'crittografia', 'encryption'],
    rag_validation_keywords: ['articolo 21', 'art. 21', 'articolo 24', 'art. 24', 'misure gestione rischi'],
    gap_description_it: 'Non sono documentate misure complete di gestione dei rischi di cibersicurezza conformi all\'Articolo 21 NIS2 che coprano tutti e 10 i domini richiesti.',
    gap_description_en: 'No complete cybersecurity risk management measures compliant with Article 21 NIS2 covering all 10 required domains were documented.',
    recommended_action_it: 'Implementare un programma completo di gestione rischi cyber coprendo tutti i 10 domini dell\'Art. 21: risk assessment, incident handling, BCM, supply chain, etc.',
    recommended_action_en: 'Implement a comprehensive cyber risk management program covering all 10 domains of Art. 21: risk assessment, incident handling, BCM, supply chain, etc.',
    action_hours: 120,
    action_cost_eur: 10200,
  },
  {
    id: 'nis2_art23_incident_reporting',
    regulation: 'NIS2',
    reference: 'Art. 25 D.Lgs. 138/2024 (Art. 23 Dir. NIS2) - Obblighi di notifica di incidenti significativi',
    description_it: 'Le entità devono notificare gli incidenti significativi al CSIRT o all\'autorità competente entro 24 ore (preallarme), 72 ore (notifica completa) e un mese (relazione finale).',
    description_en: 'Entities must notify significant incidents to the CSIRT or competent authority within 24 hours (early warning), 72 hours (full notification) and one month (final report).',
    risk_level: 'critical',
    remediation_effort: 'high',
    coverage_keywords: ['segnalazione incidenti', 'incident reporting', 'notifica incidente', 'preallarme', 'early warning', '24 ore', 'csirt', 'acn', 'segnalazione significativa'],
    rag_validation_keywords: ['articolo 23', 'art. 23', 'articolo 25', 'art. 25', 'notifica incidenti', 'segnalazione incidenti'],
    gap_description_it: 'Non è documentata una procedura di segnalazione degli incidenti conforme all\'Articolo 23 NIS2 con le tempistiche obbligatorie di 24h/72h/1 mese.',
    gap_description_en: 'No incident reporting procedure compliant with Article 23 NIS2 with the mandatory 24h/72h/1 month timelines was documented.',
    recommended_action_it: 'Definire una procedura di incident reporting con le 3 fasi obbligatorie: preallarme entro 24h, notifica completa entro 72h e relazione finale entro 1 mese.',
    recommended_action_en: 'Define an incident reporting procedure with the 3 mandatory phases: early warning within 24h, full notification within 72h and final report within 1 month.',
    action_hours: 40,
    action_cost_eur: 3400,
  },

  // ===== DORA =====
  {
    id: 'dora_art5_ict_governance',
    regulation: 'DORA',
    reference: 'Articolo 5 DORA - Governance e organizzazione del rischio ICT',
    description_it: 'L\'organo di gestione deve definire e approvare il framework di gestione del rischio ICT e garantirne l\'attuazione efficace con risorse adeguate.',
    description_en: 'The management body must define and approve the ICT risk management framework and ensure its effective implementation with adequate resources.',
    risk_level: 'critical',
    remediation_effort: 'high',
    coverage_keywords: ['governance ict', 'ict governance', 'rischio ict', 'ict risk', 'framework ict', 'organo di gestione ict', 'digital operational resilience'],
    rag_validation_keywords: ['articolo 5', 'art. 5', 'art 5'],
    gap_description_it: 'Non è documentato un framework di governance e gestione del rischio ICT conforme all\'Articolo 5 DORA con approvazione dell\'organo di gestione.',
    gap_description_en: 'No ICT risk governance and management framework compliant with Article 5 DORA with management body approval was documented.',
    recommended_action_it: 'Definire un framework di governance ICT con ruoli, responsabilità, approvazione del board e risorse dedicate alla resilienza operativa digitale.',
    recommended_action_en: 'Define an ICT governance framework with roles, responsibilities, board approval and dedicated resources for digital operational resilience.',
    action_hours: 60,
    action_cost_eur: 5100,
  },
  {
    id: 'dora_art6_ict_risk_framework',
    regulation: 'DORA',
    reference: 'Articolo 6 DORA - Framework di gestione del rischio ICT',
    description_it: 'Le entità finanziarie devono disporre di un framework solido, completo e ben documentato per la gestione del rischio ICT che comprenda strategie, politiche e procedure.',
    description_en: 'Financial entities must have a sound, comprehensive and well-documented ICT risk management framework comprising strategies, policies and procedures.',
    risk_level: 'critical',
    remediation_effort: 'very_high',
    coverage_keywords: ['risk management ict', 'framework rischio', 'ict risk framework', 'politiche ict', 'strategie ict', 'procedure ict', 'resilienza operativa'],
    rag_validation_keywords: ['articolo 6', 'art. 6', 'art 6'],
    gap_description_it: 'Non è documentato un framework completo e strutturato di gestione del rischio ICT conforme all\'Articolo 6 DORA con strategie, politiche e procedure.',
    gap_description_en: 'No comprehensive and structured ICT risk management framework compliant with Article 6 DORA with strategies, policies and procedures was documented.',
    recommended_action_it: 'Sviluppare un framework completo di gestione del rischio ICT con strategie, politiche, procedure, identificazione asset e classificazione del rischio.',
    recommended_action_en: 'Develop a comprehensive ICT risk management framework with strategies, policies, procedures, asset identification and risk classification.',
    action_hours: 100,
    action_cost_eur: 8500,
  },
  {
    id: 'dora_art17_incident_management',
    regulation: 'DORA',
    reference: 'Articolo 17 DORA - Processo di gestione degli incidenti ICT',
    description_it: 'Le entità finanziarie devono definire e attuare un processo di gestione degli incidenti ICT per rilevare, gestire e notificare gli incidenti correlati alle TIC.',
    description_en: 'Financial entities must define and implement an ICT incident management process to detect, manage and report ICT-related incidents.',
    risk_level: 'high',
    remediation_effort: 'high',
    coverage_keywords: ['gestione incidenti ict', 'ict incident management', 'incidenti ict', 'rilevamento incidenti', 'incident detection', 'classificazione incidenti', 'incident classification'],
    rag_validation_keywords: ['articolo 17', 'art. 17', 'art 17'],
    gap_description_it: 'Non è documentato un processo formale di gestione degli incidenti ICT conforme all\'Articolo 17 DORA con procedure di rilevamento, classificazione e notifica.',
    gap_description_en: 'No formal ICT incident management process compliant with Article 17 DORA with detection, classification and notification procedures was documented.',
    recommended_action_it: 'Implementare un processo di incident management ICT con rilevamento automatico, classificazione per impatto, escalation e reportistica verso le autorità.',
    recommended_action_en: 'Implement an ICT incident management process with automated detection, impact-based classification, escalation and reporting to authorities.',
    action_hours: 60,
    action_cost_eur: 5100,
  },
  {
    id: 'dora_art28_tpp_risk',
    regulation: 'DORA',
    reference: 'Articolo 28 DORA - Gestione del rischio ICT di terze parti',
    description_it: 'Le entità finanziarie devono gestire il rischio ICT derivante dai fornitori terzi, con contratti adeguati, valutazione dei rischi e strategie di uscita.',
    description_en: 'Financial entities must manage ICT risk from third-party providers with adequate contracts, risk assessments and exit strategies.',
    risk_level: 'high',
    remediation_effort: 'high',
    coverage_keywords: ['rischio terze parti', 'third party risk', 'fornitori ict', 'ict providers', 'outsourcing', 'exit strategy', 'concentrazione rischio', 'vendor risk'],
    rag_validation_keywords: ['articolo 28', 'art. 28', 'art 28'],
    gap_description_it: 'Non è documentata una procedura di gestione del rischio ICT di terze parti conforme all\'Articolo 28 DORA con valutazione fornitori, contratti e exit strategy.',
    gap_description_en: 'No third-party ICT risk management procedure compliant with Article 28 DORA with vendor assessment, contracts and exit strategy was documented.',
    recommended_action_it: 'Definire una policy di gestione del rischio ICT di terze parti con due diligence fornitori, clausole contrattuali obbligatorie e piani di uscita.',
    recommended_action_en: 'Define a third-party ICT risk management policy with vendor due diligence, mandatory contractual clauses and exit plans.',
    action_hours: 48,
    action_cost_eur: 4080,
  },

  // ===== AI Act =====
  {
    id: 'aiact_art9_risk_management',
    regulation: 'AI Act',
    reference: 'Articolo 9 AI Act - Sistema di gestione dei rischi',
    description_it: 'Per i sistemi AI ad alto rischio deve essere istituito, attuato, documentato e mantenuto un sistema di gestione dei rischi lungo l\'intero ciclo di vita.',
    description_en: 'For high-risk AI systems, a risk management system must be established, implemented, documented and maintained throughout the entire lifecycle.',
    risk_level: 'critical',
    remediation_effort: 'very_high',
    coverage_keywords: ['gestione rischi ai', 'ai risk management', 'sistema gestione rischi', 'risk management system', 'ciclo vita ai', 'ai lifecycle', 'alto rischio', 'high risk ai'],
    rag_validation_keywords: ['articolo 9', 'art. 9', 'art 9'],
    gap_description_it: 'Non è documentato un sistema di gestione dei rischi per i sistemi AI ad alto rischio conforme all\'Articolo 9 dell\'AI Act lungo l\'intero ciclo di vita del sistema.',
    gap_description_en: 'No risk management system for high-risk AI systems compliant with Article 9 of the AI Act throughout the entire system lifecycle was documented.',
    recommended_action_it: 'Implementare un sistema di gestione dei rischi AI conforme all\'Art. 9 che copra identificazione, analisi, valutazione e trattamento dei rischi durante tutto il ciclo di vita.',
    recommended_action_en: 'Implement an AI risk management system compliant with Art. 9 covering risk identification, analysis, assessment and treatment throughout the entire lifecycle.',
    action_hours: 80,
    action_cost_eur: 6800,
  },
  {
    id: 'aiact_art11_technical_docs',
    regulation: 'AI Act',
    reference: 'Articolo 11 AI Act - Documentazione tecnica',
    description_it: 'La documentazione tecnica dei sistemi AI ad alto rischio deve essere redatta prima dell\'immissione sul mercato e mantenuta aggiornata.',
    description_en: 'Technical documentation for high-risk AI systems must be drawn up before placing on the market and kept up to date.',
    risk_level: 'high',
    remediation_effort: 'high',
    coverage_keywords: ['documentazione tecnica ai', 'ai technical documentation', 'scheda tecnica', 'specifiche sistema ai', 'ai system specifications'],
    rag_validation_keywords: ['articolo 11', 'art. 11', 'art 11'],
    gap_description_it: 'Non è presente documentazione tecnica dei sistemi AI conforme all\'Articolo 11 dell\'AI Act con le specifiche dettagliate richieste dall\'Allegato IV.',
    gap_description_en: 'No technical documentation of AI systems compliant with Article 11 of the AI Act with the detailed specifications required by Annex IV was found.',
    recommended_action_it: 'Redigere documentazione tecnica completa per ogni sistema AI ad alto rischio seguendo l\'Allegato IV dell\'AI Act con descrizione, architettura e metriche.',
    recommended_action_en: 'Draft complete technical documentation for each high-risk AI system following Annex IV of the AI Act with description, architecture and metrics.',
    action_hours: 60,
    action_cost_eur: 5100,
  },
  {
    id: 'aiact_art13_transparency',
    regulation: 'AI Act',
    reference: 'Articolo 13 AI Act - Trasparenza e fornitura di informazioni',
    description_it: 'I sistemi AI ad alto rischio devono essere progettati in modo sufficientemente trasparente da consentire ai deployer di interpretarne l\'output e utilizzarli in modo appropriato.',
    description_en: 'High-risk AI systems must be designed to be sufficiently transparent to enable deployers to interpret their output and use them appropriately.',
    risk_level: 'high',
    remediation_effort: 'medium',
    coverage_keywords: ['trasparenza ai', 'ai transparency', 'spiegabilità', 'explainability', 'interpretabilità', 'interpretability', 'istruzioni uso', 'instructions for use'],
    rag_validation_keywords: ['articolo 13', 'art. 13', 'art 13'],
    gap_description_it: 'Non è documentata una procedura di trasparenza dei sistemi AI conforme all\'Articolo 13 dell\'AI Act con istruzioni d\'uso chiare e comprensibili per i deployer.',
    gap_description_en: 'No AI system transparency procedure compliant with Article 13 of the AI Act with clear and understandable instructions for use for deployers was documented.',
    recommended_action_it: 'Documentare la trasparenza di ogni sistema AI con istruzioni d\'uso, limitazioni note, metriche di performance e informazioni sulla logica del sistema.',
    recommended_action_en: 'Document the transparency of each AI system with instructions for use, known limitations, performance metrics and system logic information.',
    action_hours: 32,
    action_cost_eur: 2720,
  },
  {
    id: 'aiact_art14_human_oversight',
    regulation: 'AI Act',
    reference: 'Articolo 14 AI Act - Sorveglianza umana',
    description_it: 'I sistemi AI ad alto rischio devono essere progettati in modo da poter essere efficacemente sorvegliati da persone fisiche durante il loro utilizzo.',
    description_en: 'High-risk AI systems must be designed so that they can be effectively overseen by natural persons during their use.',
    risk_level: 'high',
    remediation_effort: 'medium',
    coverage_keywords: ['sorveglianza umana', 'human oversight', 'supervisione umana', 'human in the loop', 'human on the loop', 'controllo umano', 'human control'],
    rag_validation_keywords: ['articolo 14', 'art. 14', 'art 14'],
    gap_description_it: 'Non è documentata una procedura di sorveglianza umana dei sistemi AI conforme all\'Articolo 14 dell\'AI Act con ruoli, capacità di intervento e formazione.',
    gap_description_en: 'No human oversight procedure for AI systems compliant with Article 14 of the AI Act with roles, intervention capabilities and training was documented.',
    recommended_action_it: 'Definire procedure di sorveglianza umana con ruoli chiari, capacità di intervento/override, formazione degli operatori e log delle decisioni.',
    recommended_action_en: 'Define human oversight procedures with clear roles, intervention/override capabilities, operator training and decision logs.',
    action_hours: 30,
    action_cost_eur: 2550,
  },
  {
    id: 'aiact_art5_prohibited_practices',
    regulation: 'AI Act',
    reference: 'Articolo 5 AI Act - Pratiche di IA vietate',
    description_it: 'Sono vietati i sistemi di scoring sociale, manipolazione subliminale, sfruttamento delle vulnerabilità di gruppi specifici e identificazione biometrica remota in tempo reale in spazi pubblici accessibili al pubblico.',
    description_en: 'Prohibited are social scoring systems, subliminal manipulation, exploitation of vulnerabilities of specific groups, and real-time remote biometric identification in publicly accessible spaces.',
    risk_level: 'critical',
    remediation_effort: 'high',
    coverage_keywords: ['pratiche vietate', 'prohibited practices', 'scoring sociale', 'social scoring', 'manipolazione', 'identificazione biometrica', 'biometric identification', 'sorveglianza', 'real-time remote'],
    rag_validation_keywords: ['articolo 5', 'art. 5', 'art 5'],
    gap_description_it: 'Non è stata individuata una valutazione formale delle pratiche di IA vietate dall\'Articolo 5 dell\'AI Act. È necessario verificare che nessun sistema AI utilizzato rientri nelle categorie proibite.',
    gap_description_en: 'No formal assessment of AI practices prohibited by Article 5 of the AI Act was found. It is necessary to verify that no AI system in use falls within prohibited categories.',
    recommended_action_it: 'Condurre un audit completo di tutti i sistemi AI in uso per verificare la conformità all\'Art. 5, documentando l\'assenza di pratiche vietate come scoring sociale o manipolazione subliminale.',
    recommended_action_en: 'Conduct a complete audit of all AI systems in use to verify compliance with Art. 5, documenting the absence of prohibited practices such as social scoring or subliminal manipulation.',
    action_hours: 40,
    action_cost_eur: 3400,
    coverage_threshold: 0.15,
    min_keyword_matches: 2,
  },
  {
    id: 'aiact_art6_classification',
    regulation: 'AI Act',
    reference: 'Articolo 6 AI Act - Regole di classificazione dei sistemi AI ad alto rischio',
    description_it: 'I sistemi AI usati come componenti di sicurezza di prodotti coperti dalla legislazione UE o elencati nell\'Allegato III sono classificati come ad alto rischio e soggetti a requisiti stringenti.',
    description_en: 'AI systems used as safety components of products covered by EU legislation or listed in Annex III are classified as high-risk and subject to stringent requirements.',
    risk_level: 'critical',
    remediation_effort: 'very_high',
    coverage_keywords: ['classificazione', 'alto rischio', 'high risk', 'allegato iii', 'annex iii', 'componente sicurezza', 'safety component', 'sistema ad alto rischio'],
    rag_validation_keywords: ['articolo 6', 'art. 6', 'art 6'],
    gap_description_it: 'Manca una classificazione formale dei sistemi AI secondo i criteri dell\'Articolo 6 dell\'AI Act per determinare se rientrano nella categoria ad alto rischio.',
    gap_description_en: 'A formal classification of AI systems according to Article 6 criteria of the AI Act to determine if they fall within the high-risk category is missing.',
    recommended_action_it: 'Mappare tutti i sistemi AI utilizzati e classificarli secondo l\'Art. 6 e l\'Allegato III, documentando la valutazione di rischio e le motivazioni della classificazione.',
    recommended_action_en: 'Map all AI systems in use and classify them according to Art. 6 and Annex III, documenting the risk assessment and classification rationale.',
    action_hours: 60,
    action_cost_eur: 5100,
    coverage_threshold: 0.15,
    min_keyword_matches: 2,
  },
  {
    id: 'aiact_art10_data_governance',
    regulation: 'AI Act',
    reference: 'Articolo 10 AI Act - Dati e governance dei dati',
    description_it: 'I set di dati di addestramento, convalida e prova per i sistemi AI ad alto rischio devono essere soggetti a pratiche di governance appropriate, inclusa la verifica di qualità, rappresentatività e assenza di bias.',
    description_en: 'Training, validation and testing datasets for high-risk AI systems must be subject to appropriate governance practices, including quality verification, representativeness and absence of bias.',
    risk_level: 'high',
    remediation_effort: 'very_high',
    coverage_keywords: ['governance dati', 'data governance', 'dati addestramento', 'training data', 'set di dati', 'dataset', 'qualità dati', 'data quality', 'bias', 'pregiudizio'],
    rag_validation_keywords: ['articolo 10', 'art. 10', 'art 10'],
    gap_description_it: 'Non è documentata una procedura di governance dei dati per i sistemi AI ad alto rischio come richiesto dall\'Articolo 10 dell\'AI Act.',
    gap_description_en: 'No data governance procedure for high-risk AI systems as required by Article 10 of the AI Act is documented.',
    recommended_action_it: 'Implementare un framework di data governance che includa processi di qualità, verifica bias, documentazione dei dataset e procedure di convalida per tutti i sistemi AI ad alto rischio.',
    recommended_action_en: 'Implement a data governance framework including quality processes, bias verification, dataset documentation and validation procedures for all high-risk AI systems.',
    action_hours: 80,
    action_cost_eur: 6800,
    coverage_threshold: 0.15,
    min_keyword_matches: 2,
  },
  {
    id: 'aiact_art15_accuracy_robustness',
    regulation: 'AI Act',
    reference: 'Articolo 15 AI Act - Accuratezza, robustezza e cibersicurezza',
    description_it: 'I sistemi AI ad alto rischio devono raggiungere livelli appropriati di accuratezza, robustezza e cibersicurezza e funzionare in modo coerente durante tutto il loro ciclo di vita.',
    description_en: 'High-risk AI systems must achieve appropriate levels of accuracy, robustness and cybersecurity and perform consistently throughout their lifecycle.',
    risk_level: 'high',
    remediation_effort: 'high',
    coverage_keywords: ['accuratezza', 'accuracy', 'robustezza', 'robustness', 'cibersicurezza ai', 'cybersecurity ai', 'resilienza', 'resilience', 'test adversarial'],
    rag_validation_keywords: ['articolo 15', 'art. 15', 'art 15'],
    gap_description_it: 'Non è documentata una valutazione dei livelli di accuratezza, robustezza e cibersicurezza dei sistemi AI ad alto rischio come richiesto dall\'Articolo 15 dell\'AI Act.',
    gap_description_en: 'No assessment of accuracy, robustness and cybersecurity levels of high-risk AI systems as required by Article 15 of the AI Act is documented.',
    recommended_action_it: 'Definire metriche di accuratezza e robustezza, condurre test adversarial, implementare misure di cibersicurezza specifiche per AI e documentare i risultati per ogni sistema ad alto rischio.',
    recommended_action_en: 'Define accuracy and robustness metrics, conduct adversarial testing, implement AI-specific cybersecurity measures and document results for each high-risk system.',
    action_hours: 60,
    action_cost_eur: 5100,
    coverage_threshold: 0.15,
    min_keyword_matches: 2,
  },
  {
    id: 'aiact_art26_deployer_obligations',
    regulation: 'AI Act',
    reference: 'Articolo 26 AI Act - Obblighi dei deployer di sistemi AI ad alto rischio',
    description_it: 'I deployer di sistemi AI ad alto rischio devono garantire sorveglianza umana, monitoraggio del funzionamento, conservazione dei log generati automaticamente, DPIA se necessaria e informazione ai lavoratori.',
    description_en: 'Deployers of high-risk AI systems must ensure human oversight, operation monitoring, automatic log retention, DPIA when necessary and worker information.',
    risk_level: 'high',
    remediation_effort: 'high',
    coverage_keywords: ['deployer', 'utilizzatore', 'sorveglianza umana deployer', 'log automatici', 'monitoraggio funzionamento', 'informazione lavoratori ai', 'dpia ai'],
    rag_validation_keywords: ['articolo 26', 'art. 26', 'art 26'],
    gap_description_it: 'Non sono documentati gli obblighi del deployer di sistemi AI ad alto rischio previsti dall\'Articolo 26 dell\'AI Act, inclusi sorveglianza umana e conservazione log.',
    gap_description_en: 'Deployer obligations for high-risk AI systems under Article 26 of the AI Act are not documented, including human oversight and log retention.',
    recommended_action_it: 'Implementare procedure di sorveglianza umana per i sistemi AI, attivare la conservazione dei log automatici, condurre DPIA quando necessario e informare i lavoratori interessati.',
    recommended_action_en: 'Implement human oversight procedures for AI systems, enable automatic log retention, conduct DPIA when necessary and inform affected workers.',
    action_hours: 48,
    action_cost_eur: 4080,
    coverage_threshold: 0.15,
    min_keyword_matches: 2,
  },
  {
    id: 'aiact_art50_transparency',
    regulation: 'AI Act',
    reference: 'Articolo 50 AI Act - Obblighi di trasparenza per sistemi AI specifici',
    description_it: 'I sistemi AI che interagiscono con persone, generano contenuti sintetici (deepfake), riconoscono emozioni o categorizzano persone biometricamente devono informare gli utenti della natura artificiale dell\'interazione.',
    description_en: 'AI systems that interact with persons, generate synthetic content (deepfakes), recognize emotions or biometrically categorize persons must inform users of the artificial nature of the interaction.',
    risk_level: 'high',
    remediation_effort: 'medium',
    coverage_keywords: ['trasparenza ai', 'deepfake', 'contenuti generati', 'generated content', 'riconoscimento emozioni', 'emotion recognition', 'categorizzazione biometrica', 'chatbot disclosure'],
    rag_validation_keywords: ['articolo 50', 'art. 50', 'art 50'],
    gap_description_it: 'Non sono implementati gli obblighi di trasparenza per sistemi AI specifici previsti dall\'Articolo 50, inclusa la dichiarazione di interazione con sistemi AI e la marcatura di contenuti generati.',
    gap_description_en: 'Transparency obligations for specific AI systems under Article 50 are not implemented, including AI interaction disclosure and synthetic content marking.',
    recommended_action_it: 'Implementare meccanismi di disclosure per chatbot e sistemi AI interattivi, marcatura di contenuti generati da AI (deepfake), e informative per sistemi di riconoscimento emozioni.',
    recommended_action_en: 'Implement disclosure mechanisms for chatbots and interactive AI systems, AI-generated content marking (deepfakes), and notices for emotion recognition systems.',
    action_hours: 24,
    action_cost_eur: 2040,
    coverage_threshold: 0.15,
    min_keyword_matches: 2,
  },
  {
    id: 'aiact_art53_sandbox',
    regulation: 'AI Act',
    reference: 'Articolo 53 AI Act - Spazi di sperimentazione normativa per l\'IA',
    description_it: 'Gli stati membri devono istituire sandbox regolamentari per lo sviluppo e il test di sistemi AI innovativi sotto la supervisione delle autorità competenti prima della loro immissione sul mercato.',
    description_en: 'Member states must establish regulatory sandboxes for the development and testing of innovative AI systems under the supervision of competent authorities before their placing on the market.',
    risk_level: 'medium',
    remediation_effort: 'medium',
    coverage_keywords: ['sandbox', 'spazio sperimentazione', 'regulatory sandbox', 'innovazione ai', 'ai innovation', 'supervisione autorità'],
    rag_validation_keywords: ['articolo 53', 'art. 53', 'art 53'],
    gap_description_it: 'Non è stata valutata l\'opportunità di partecipare a sandbox regolamentari per l\'IA come previsto dall\'Articolo 53 dell\'AI Act.',
    gap_description_en: 'The opportunity to participate in AI regulatory sandboxes as provided by Article 53 of the AI Act has not been assessed.',
    recommended_action_it: 'Valutare la partecipazione a sandbox regolamentari nazionali per sistemi AI innovativi, documentare i contatti con le autorità competenti e le condizioni di accesso.',
    recommended_action_en: 'Assess participation in national AI regulatory sandboxes for innovative AI systems, document contacts with competent authorities and access conditions.',
    action_hours: 20,
    action_cost_eur: 1700,
    coverage_threshold: 0.15,
    min_keyword_matches: 2,
  },

  // ===== CRA =====
  {
    id: 'cra_art13_essential_requirements',
    regulation: 'CRA',
    reference: 'Articolo 13 CRA - Obblighi dei fabbricanti (Requisiti essenziali di cybersecurity)',
    description_it: 'I fabbricanti devono garantire che i prodotti con elementi digitali siano progettati, sviluppati e prodotti in conformità ai requisiti essenziali di cybersecurity dell\'Allegato I.',
    description_en: 'Manufacturers must ensure that products with digital elements are designed, developed and produced in compliance with the essential cybersecurity requirements of Annex I.',
    risk_level: 'critical',
    remediation_effort: 'very_high',
    coverage_keywords: ['requisiti cybersecurity', 'cybersecurity requirements', 'secure by design', 'sicurezza prodotti', 'product security', 'vulnerabilità prodotto', 'product vulnerability', 'sbom', 'software bill of materials'],
    rag_validation_keywords: ['articolo 13', 'art. 13', 'art 13'],
    gap_description_it: 'Non è documentata la conformità dei prodotti con elementi digitali ai requisiti essenziali di cybersecurity dell\'Allegato I del Cyber Resilience Act (Articolo 13).',
    gap_description_en: 'Compliance of products with digital elements with the essential cybersecurity requirements of Annex I of the Cyber Resilience Act (Article 13) is not documented.',
    recommended_action_it: 'Condurre un assessment dei prodotti digitali rispetto ai requisiti dell\'Allegato I CRA, implementare secure by design e generare SBOM per ogni prodotto.',
    recommended_action_en: 'Conduct an assessment of digital products against Annex I CRA requirements, implement secure by design and generate SBOM for each product.',
    action_hours: 100,
    action_cost_eur: 8500,
  },
  {
    id: 'cra_art14_reporting',
    regulation: 'CRA',
    reference: 'Articolo 14 CRA - Obblighi di segnalazione dei fabbricanti',
    description_it: 'I fabbricanti devono notificare al CSIRT e ad ENISA le vulnerabilità attivamente sfruttate e gli incidenti di sicurezza gravi entro 24 ore.',
    description_en: 'Manufacturers must notify CSIRT and ENISA of actively exploited vulnerabilities and serious security incidents within 24 hours.',
    risk_level: 'high',
    remediation_effort: 'medium',
    coverage_keywords: ['segnalazione vulnerabilità', 'vulnerability reporting', 'enisa', 'csirt', 'notifica 24 ore', '24 hour notification', 'vulnerabilità sfruttate', 'actively exploited'],
    rag_validation_keywords: ['articolo 14', 'art. 14', 'art 14'],
    gap_description_it: 'Non è documentata una procedura di segnalazione delle vulnerabilità sfruttate e degli incidenti di sicurezza gravi conforme all\'Articolo 14 del CRA con notifica entro 24 ore.',
    gap_description_en: 'No procedure for reporting actively exploited vulnerabilities and serious security incidents compliant with Article 14 of the CRA with 24-hour notification was documented.',
    recommended_action_it: 'Definire una procedura di vulnerability disclosure e segnalazione incidenti con notifica al CSIRT ed ENISA entro 24 ore come richiesto dall\'Art. 14 CRA.',
    recommended_action_en: 'Define a vulnerability disclosure and incident reporting procedure with CSIRT and ENISA notification within 24 hours as required by Art. 14 CRA.',
    action_hours: 30,
    action_cost_eur: 2550,
  },

  // ===== Data Act =====
  {
    id: 'dataact_art3_data_access',
    regulation: 'Data Act',
    reference: 'Articolo 3 Data Act - Obbligo di rendere accessibili i dati dei prodotti connessi',
    description_it: 'I prodotti connessi devono essere progettati e fabbricati in modo che i dati generati dal loro utilizzo siano accessibili all\'utente in modo facile, sicuro e gratuito.',
    description_en: 'Connected products must be designed and manufactured so that data generated by their use is accessible to the user in an easy, secure and free manner.',
    risk_level: 'high',
    remediation_effort: 'high',
    coverage_keywords: ['accesso dati', 'data access', 'prodotti connessi', 'connected products', 'iot', 'dati utente', 'user data access', 'portabilità dati', 'data portability'],
    rag_validation_keywords: ['articolo 3', 'art. 3', 'art 3'],
    gap_description_it: 'Non è documentata una procedura per garantire l\'accesso ai dati generati dai prodotti connessi come richiesto dall\'Articolo 3 del Data Act.',
    gap_description_en: 'No procedure for ensuring access to data generated by connected products as required by Article 3 of the Data Act was documented.',
    recommended_action_it: 'Implementare meccanismi tecnici per rendere i dati dei prodotti connessi accessibili agli utenti in formato strutturato, sicuro e gratuito.',
    recommended_action_en: 'Implement technical mechanisms to make connected product data accessible to users in a structured, secure and free format.',
    action_hours: 60,
    action_cost_eur: 5100,
  },
  {
    id: 'dataact_art5_data_sharing',
    regulation: 'Data Act',
    reference: 'Articolo 5 Data Act - Diritto di condivisione dei dati con terze parti',
    description_it: 'L\'utente ha il diritto di condividere i dati generati dall\'utilizzo di un prodotto connesso con terze parti a condizioni eque, ragionevoli e non discriminatorie.',
    description_en: 'The user has the right to share data generated by the use of a connected product with third parties under fair, reasonable and non-discriminatory conditions.',
    risk_level: 'medium',
    remediation_effort: 'medium',
    coverage_keywords: ['condivisione dati', 'data sharing', 'terze parti', 'third party sharing', 'frand', 'condizioni eque', 'fair terms'],
    rag_validation_keywords: ['articolo 5', 'art. 5', 'art 5'],
    gap_description_it: 'Non è documentata una procedura per la condivisione dei dati con terze parti a condizioni FRAND come richiesto dall\'Articolo 5 del Data Act.',
    gap_description_en: 'No procedure for data sharing with third parties under FRAND terms as required by Article 5 of the Data Act was documented.',
    recommended_action_it: 'Definire policy e procedure per la condivisione dei dati con terze parti a condizioni eque, ragionevoli e non discriminatorie (FRAND).',
    recommended_action_en: 'Define policies and procedures for data sharing with third parties under fair, reasonable and non-discriminatory (FRAND) terms.',
    action_hours: 32,
    action_cost_eur: 2720,
  },

  // ===== ISO 27001 =====
  {
    id: 'iso27001_clause4_context',
    regulation: 'ISO 27001',
    reference: 'ISO 27001 Clausola 4 - Contesto dell\'organizzazione',
    description_it: 'L\'organizzazione deve determinare le questioni esterne e interne, le parti interessate e i requisiti pertinenti al sistema di gestione della sicurezza delle informazioni.',
    description_en: 'The organization must determine external and internal issues, interested parties and requirements relevant to the information security management system.',
    risk_level: 'high',
    remediation_effort: 'medium',
    coverage_keywords: ['contesto organizzazione', 'context of organization', 'parti interessate', 'interested parties', 'isms scope', 'ambito isms', 'questioni esterne', 'questioni interne'],
    rag_validation_keywords: ['clausola 4', 'clause 4', 'clausola 4'],
    gap_description_it: 'Non è documentata un\'analisi del contesto dell\'organizzazione conforme alla Clausola 4 ISO 27001 con identificazione di parti interessate, questioni esterne/interne e ambito ISMS.',
    gap_description_en: 'No organization context analysis compliant with ISO 27001 Clause 4 with identification of interested parties, external/internal issues and ISMS scope was documented.',
    recommended_action_it: 'Condurre un\'analisi del contesto organizzativo con identificazione delle parti interessate, delle questioni rilevanti e definizione dell\'ambito dell\'ISMS.',
    recommended_action_en: 'Conduct an organizational context analysis with identification of interested parties, relevant issues and ISMS scope definition.',
    action_hours: 24,
    action_cost_eur: 2040,
  },
  {
    id: 'iso27001_clause6_risk',
    regulation: 'ISO 27001',
    reference: 'ISO 27001 Clausola 6.1 - Azioni per affrontare rischi e opportunità',
    description_it: 'L\'organizzazione deve pianificare azioni per affrontare rischi e opportunità, inclusa la valutazione del rischio per la sicurezza delle informazioni e il piano di trattamento del rischio.',
    description_en: 'The organization must plan actions to address risks and opportunities, including information security risk assessment and risk treatment plan.',
    risk_level: 'critical',
    remediation_effort: 'high',
    coverage_keywords: ['risk assessment', 'valutazione rischio', 'risk treatment', 'trattamento rischio', 'piano trattamento', 'risk treatment plan', 'soa', 'statement of applicability', 'dichiarazione applicabilità'],
    rag_validation_keywords: ['clausola 6', 'clause 6', 'clausola 6.1'],
    gap_description_it: 'Non è documentata una procedura di risk assessment e risk treatment conforme alla Clausola 6.1 ISO 27001 con metodologia, criteri e piano di trattamento del rischio.',
    gap_description_en: 'No risk assessment and risk treatment procedure compliant with ISO 27001 Clause 6.1 with methodology, criteria and risk treatment plan was documented.',
    recommended_action_it: 'Implementare un processo strutturato di risk assessment ISO 27001 con metodologia definita, criteri di accettazione, piano di trattamento e Statement of Applicability.',
    recommended_action_en: 'Implement a structured ISO 27001 risk assessment process with defined methodology, acceptance criteria, treatment plan and Statement of Applicability.',
    action_hours: 60,
    action_cost_eur: 5100,
  },
  {
    id: 'iso27001_clause9_audit',
    regulation: 'ISO 27001',
    reference: 'ISO 27001 Clausola 9.2 - Audit interno',
    description_it: 'L\'organizzazione deve condurre audit interni a intervalli pianificati per verificare che l\'ISMS sia conforme ai requisiti dell\'organizzazione e dello standard ISO 27001.',
    description_en: 'The organization must conduct internal audits at planned intervals to verify that the ISMS conforms to the organization\'s and ISO 27001 requirements.',
    risk_level: 'high',
    remediation_effort: 'medium',
    coverage_keywords: ['audit interno', 'internal audit', 'programma audit', 'audit program', 'audit plan', 'piano audit', 'evidenze audit', 'audit evidence'],
    rag_validation_keywords: ['clausola 9', 'clause 9', 'clausola 9.2'],
    gap_description_it: 'Non è documentato un programma di audit interni conforme alla Clausola 9.2 ISO 27001 con pianificazione, criteri, ambito e reportistica degli audit.',
    gap_description_en: 'No internal audit program compliant with ISO 27001 Clause 9.2 with audit planning, criteria, scope and reporting was documented.',
    recommended_action_it: 'Definire un programma di audit interni ISO 27001 con pianificazione annuale, criteri di audit, competenze degli auditor e template di reportistica.',
    recommended_action_en: 'Define an ISO 27001 internal audit program with annual planning, audit criteria, auditor competencies and reporting templates.',
    action_hours: 32,
    action_cost_eur: 2720,
  },
  {
    id: 'iso27001_annexa_access_control',
    regulation: 'ISO 27001',
    reference: 'ISO 27001 Annex A A.8 - Controlli tecnologici (Accesso e crittografia)',
    description_it: 'L\'organizzazione deve implementare controlli tecnologici per la gestione degli accessi, la protezione contro malware, il backup, la crittografia e la gestione delle vulnerabilità.',
    description_en: 'The organization must implement technological controls for access management, malware protection, backup, encryption and vulnerability management.',
    risk_level: 'high',
    remediation_effort: 'high',
    coverage_keywords: ['controllo accessi', 'access control', 'crittografia', 'encryption', 'malware', 'antimalware', 'backup', 'vulnerability management', 'gestione vulnerabilità', 'patch management'],
    rag_validation_keywords: ['annex a', 'a.8', 'annex a a.8'],
    gap_description_it: 'Non è documentata l\'implementazione completa dei controlli tecnologici dell\'Annex A A.8 ISO 27001 per gestione accessi, crittografia, backup e gestione vulnerabilità.',
    gap_description_en: 'Full implementation of ISO 27001 Annex A A.8 technological controls for access management, encryption, backup and vulnerability management is not documented.',
    recommended_action_it: 'Implementare e documentare i controlli tecnologici A.8 ISO 27001: policy accesso, crittografia at-rest/in-transit, backup 3-2-1, patching regolare e VA/PT periodici.',
    recommended_action_en: 'Implement and document A.8 ISO 27001 technological controls: access policy, at-rest/in-transit encryption, 3-2-1 backup, regular patching and periodic VA/PT.',
    action_hours: 80,
    action_cost_eur: 6800,
  },
  {
    id: 'iso27001_clause5_leadership',
    regulation: 'ISO 27001',
    reference: 'ISO 27001 Clausola 5 - Leadership e impegno',
    description_it: 'L\'alta direzione deve dimostrare leadership e impegno rispetto al sistema di gestione per la sicurezza delle informazioni stabilendo politica e obiettivi, assicurando risorse e comunicando l\'importanza della sicurezza.',
    description_en: 'Top management must demonstrate leadership and commitment to the ISMS by establishing policy and objectives, ensuring resources and communicating the importance of security.',
    risk_level: 'high',
    remediation_effort: 'medium',
    coverage_keywords: ['leadership', 'alta direzione', 'top management', 'impegno direzione', 'politica sicurezza', 'security policy', 'obiettivi sicurezza', 'risorse sicurezza', 'commitment'],
    rag_validation_keywords: ['clausola 5', 'clause 5', 'leadership'],
    gap_description_it: 'Non è documentato l\'impegno dell\'alta direzione verso il SGSI con politica, obiettivi e risorse come richiesto dalla Clausola 5 ISO 27001.',
    gap_description_en: 'Top management commitment to the ISMS with policy, objectives and resources as required by ISO 27001 Clause 5 is not documented.',
    recommended_action_it: 'Definire e far approvare dalla direzione la politica di sicurezza delle informazioni, stabilire obiettivi misurabili e allocare risorse dedicate.',
    recommended_action_en: 'Define and get management approval for the information security policy, establish measurable objectives and allocate dedicated resources.',
    action_hours: 24,
    action_cost_eur: 2040,
  },
  {
    id: 'iso27001_clause7_support',
    regulation: 'ISO 27001',
    reference: 'ISO 27001 Clausola 7 - Supporto (Risorse, Competenza, Consapevolezza)',
    description_it: 'L\'organizzazione deve determinare e fornire le risorse necessarie, assicurare la competenza del personale, la consapevolezza sulla sicurezza e gestire le comunicazioni e le informazioni documentate.',
    description_en: 'The organization must determine and provide necessary resources, ensure personnel competence, security awareness and manage communications and documented information.',
    risk_level: 'high',
    remediation_effort: 'medium',
    coverage_keywords: ['competenza', 'competence', 'consapevolezza', 'awareness', 'formazione sicurezza', 'security training', 'risorse', 'resources', 'informazioni documentate', 'documented information', 'comunicazione'],
    rag_validation_keywords: ['clausola 7', 'clause 7', 'supporto'],
    gap_description_it: 'Non è documentato un programma di competenza, consapevolezza e formazione sulla sicurezza delle informazioni come richiesto dalla Clausola 7 ISO 27001.',
    gap_description_en: 'An information security competence, awareness and training program as required by ISO 27001 Clause 7 is not documented.',
    recommended_action_it: 'Implementare un programma di formazione e consapevolezza sulla sicurezza con valutazione delle competenze, sessioni periodiche e documentazione.',
    recommended_action_en: 'Implement a security training and awareness program with competence assessment, periodic sessions and documentation.',
    action_hours: 32,
    action_cost_eur: 2720,
  },
  {
    id: 'iso27001_clause8_operations',
    regulation: 'ISO 27001',
    reference: 'ISO 27001 Clausola 8 - Attività operative (Pianificazione e Controllo)',
    description_it: 'L\'organizzazione deve pianificare, attuare e controllare i processi necessari per soddisfare i requisiti di sicurezza, inclusa la valutazione dei rischi e il trattamento dei rischi.',
    description_en: 'The organization must plan, implement and control processes needed to meet security requirements, including risk assessment and risk treatment.',
    risk_level: 'high',
    remediation_effort: 'high',
    coverage_keywords: ['pianificazione operativa', 'operational planning', 'controllo operativo', 'operational control', 'trattamento rischi', 'risk treatment', 'piano trattamento', 'treatment plan', 'statement of applicability', 'dichiarazione applicabilità', 'SOA'],
    rag_validation_keywords: ['clausola 8', 'clause 8', 'attività operative'],
    gap_description_it: 'Non è documentata la pianificazione e il controllo operativo dei processi di sicurezza incluso il piano di trattamento dei rischi come richiesto dalla Clausola 8 ISO 27001.',
    gap_description_en: 'Operational planning and control of security processes including risk treatment plan as required by ISO 27001 Clause 8 is not documented.',
    recommended_action_it: 'Definire il piano di trattamento dei rischi con la Dichiarazione di Applicabilità (SOA), implementare i controlli selezionati e documentare i processi operativi.',
    recommended_action_en: 'Define the risk treatment plan with the Statement of Applicability (SOA), implement selected controls and document operational processes.',
    action_hours: 60,
    action_cost_eur: 5100,
  },
  {
    id: 'iso27001_clause10_improvement',
    regulation: 'ISO 27001',
    reference: 'ISO 27001 Clausola 10 - Miglioramento continuo',
    description_it: 'L\'organizzazione deve gestire le non conformità con azioni correttive e migliorare continuamente l\'idoneità, l\'adeguatezza e l\'efficacia del sistema di gestione per la sicurezza delle informazioni.',
    description_en: 'The organization must manage nonconformities with corrective actions and continually improve the suitability, adequacy and effectiveness of the ISMS.',
    risk_level: 'medium',
    remediation_effort: 'medium',
    coverage_keywords: ['miglioramento continuo', 'continual improvement', 'non conformità', 'nonconformity', 'azioni correttive', 'corrective actions', 'riesame direzione', 'management review', 'efficacia SGSI', 'ISMS effectiveness'],
    rag_validation_keywords: ['clausola 10', 'clause 10', 'miglioramento'],
    gap_description_it: 'Non è documentato un processo di miglioramento continuo del SGSI con gestione delle non conformità e azioni correttive come richiesto dalla Clausola 10 ISO 27001.',
    gap_description_en: 'A continual improvement process for the ISMS with nonconformity management and corrective actions as required by ISO 27001 Clause 10 is not documented.',
    recommended_action_it: 'Implementare un processo di gestione delle non conformità con azioni correttive, analisi delle cause radice e riesame periodico della direzione.',
    recommended_action_en: 'Implement a nonconformity management process with corrective actions, root cause analysis and periodic management review.',
    action_hours: 24,
    action_cost_eur: 2040,
  },
  {
    id: 'iso27001_annexa_hr_security',
    regulation: 'ISO 27001',
    reference: 'ISO 27001 Annex A A.6 - Controlli sulle persone',
    description_it: 'L\'organizzazione deve implementare controlli per la sicurezza delle risorse umane inclusi screening pre-assunzione, termini e condizioni di impiego, sensibilizzazione e formazione, processi disciplinari e responsabilità alla cessazione.',
    description_en: 'The organization must implement people controls including pre-employment screening, terms and conditions of employment, awareness and training, disciplinary process and responsibilities upon termination.',
    risk_level: 'high',
    remediation_effort: 'medium',
    coverage_keywords: ['screening pre-assunzione', 'pre-employment screening', 'condizioni impiego', 'employment terms', 'processo disciplinare', 'disciplinary process', 'cessazione rapporto', 'termination', 'NDA', 'riservatezza dipendenti', 'employee confidentiality'],
    rag_validation_keywords: ['annex a', 'a.6', 'controlli persone'],
    gap_description_it: 'Non sono documentati i controlli sulla sicurezza delle risorse umane (screening, NDA, formazione, cessazione) come richiesto dall\'Annex A A.6 ISO 27001.',
    gap_description_en: 'People security controls (screening, NDA, training, termination) as required by ISO 27001 Annex A A.6 are not documented.',
    recommended_action_it: 'Implementare procedure HR per la sicurezza: screening pre-assunzione, clausole NDA nei contratti, formazione obbligatoria sicurezza e checklist di cessazione.',
    recommended_action_en: 'Implement HR security procedures: pre-employment screening, NDA clauses in contracts, mandatory security training and termination checklist.',
    action_hours: 32,
    action_cost_eur: 2720,
  },
  {
    id: 'iso27001_annexa_physical_security',
    regulation: 'ISO 27001',
    reference: 'ISO 27001 Annex A A.7 - Controlli fisici',
    description_it: 'L\'organizzazione deve implementare controlli per la sicurezza fisica inclusi perimetro di sicurezza fisica, controllo accessi fisici, protezione uffici e aree, protezione contro minacce ambientali e lavoro in aree sicure.',
    description_en: 'The organization must implement physical controls including physical security perimeter, physical access controls, office and area protection, environmental threat protection and working in secure areas.',
    risk_level: 'high',
    remediation_effort: 'high',
    coverage_keywords: ['sicurezza fisica', 'physical security', 'controllo accessi fisici', 'physical access control', 'perimetro sicurezza', 'security perimeter', 'data center', 'protezione ambientale', 'environmental protection', 'badge', 'videosorveglianza', 'CCTV'],
    rag_validation_keywords: ['annex a', 'a.7', 'controlli fisici'],
    gap_description_it: 'Non sono documentati i controlli di sicurezza fisica (perimetro, accessi, protezione ambientale) come richiesto dall\'Annex A A.7 ISO 27001.',
    gap_description_en: 'Physical security controls (perimeter, access, environmental protection) as required by ISO 27001 Annex A A.7 are not documented.',
    recommended_action_it: 'Implementare controlli fisici: perimetro di sicurezza, sistema badge/accessi, videosorveglianza, protezione antincendio e climatizzazione server room.',
    recommended_action_en: 'Implement physical controls: security perimeter, badge/access system, CCTV, fire protection and server room climate control.',
    action_hours: 48,
    action_cost_eur: 4080,
  },
  {
    id: 'iso27001_annexa_asset_management',
    regulation: 'ISO 27001',
    reference: 'ISO 27001 Annex A A.5 - Controlli organizzativi (Gestione asset e classificazione)',
    description_it: 'L\'organizzazione deve identificare gli asset associati alle informazioni, definire responsabilità, classificare le informazioni ed etichettarle secondo il livello di riservatezza.',
    description_en: 'The organization must identify assets associated with information, define responsibilities, classify information and label it according to the confidentiality level.',
    risk_level: 'high',
    remediation_effort: 'medium',
    coverage_keywords: ['inventario asset', 'asset inventory', 'classificazione informazioni', 'information classification', 'etichettatura', 'labeling', 'proprietario asset', 'asset owner', 'gestione asset', 'asset management', 'riservatezza', 'confidential'],
    rag_validation_keywords: ['annex a', 'a.5', 'controlli organizzativi'],
    gap_description_it: 'Non è documentato un sistema di gestione e classificazione degli asset informativi con inventario, proprietari e livelli di riservatezza come richiesto dall\'Annex A A.5 ISO 27001.',
    gap_description_en: 'An information asset management and classification system with inventory, owners and confidentiality levels as required by ISO 27001 Annex A A.5 is not documented.',
    recommended_action_it: 'Creare l\'inventario degli asset informativi, assegnare proprietari, definire lo schema di classificazione (Pubblico/Interno/Riservato/Segreto) e implementare l\'etichettatura.',
    recommended_action_en: 'Create the information asset inventory, assign owners, define the classification scheme (Public/Internal/Confidential/Secret) and implement labeling.',
    action_hours: 32,
    action_cost_eur: 2720,
  },
  {
    id: 'iso27001_annexa_incident_management',
    regulation: 'ISO 27001',
    reference: 'ISO 27001 Annex A A.5.24-28 - Gestione degli incidenti di sicurezza delle informazioni',
    description_it: 'L\'organizzazione deve stabilire procedure per la gestione degli incidenti di sicurezza inclusa pianificazione, segnalazione, valutazione, risposta, apprendimento e raccolta prove.',
    description_en: 'The organization must establish information security incident management procedures including planning, reporting, assessment, response, learning and evidence collection.',
    risk_level: 'critical',
    remediation_effort: 'high',
    coverage_keywords: ['gestione incidenti', 'incident management', 'segnalazione incidenti', 'incident reporting', 'risposta incidenti', 'incident response', 'raccolta prove', 'evidence collection', 'lessons learned', 'CSIRT', 'SOC', 'playbook incidenti'],
    rag_validation_keywords: ['annex a', 'a.5.24', 'gestione incidenti'],
    gap_description_it: 'Non è documentata una procedura completa di gestione degli incidenti di sicurezza con segnalazione, risposta e lessons learned come richiesto dall\'Annex A A.5.24-28 ISO 27001.',
    gap_description_en: 'A complete security incident management procedure with reporting, response and lessons learned as required by ISO 27001 Annex A A.5.24-28 is not documented.',
    recommended_action_it: 'Implementare una procedura di incident management con: classificazione severità, canali di segnalazione, playbook di risposta, analisi post-incidente e registro incidenti.',
    recommended_action_en: 'Implement an incident management procedure with: severity classification, reporting channels, response playbooks, post-incident analysis and incident register.',
    action_hours: 48,
    action_cost_eur: 4080,
  },
  {
    id: 'iso27001_annexa_bcm',
    regulation: 'ISO 27001',
    reference: 'ISO 27001 Annex A A.5.29-30 - Continuità operativa e sicurezza delle informazioni',
    description_it: 'L\'organizzazione deve pianificare come mantenere la sicurezza delle informazioni durante le interruzioni e garantire la preparazione ICT per la continuità operativa con test e riesami periodici.',
    description_en: 'The organization must plan how to maintain information security during disruptions and ensure ICT readiness for business continuity with periodic testing and reviews.',
    risk_level: 'critical',
    remediation_effort: 'very_high',
    coverage_keywords: ['continuità operativa', 'business continuity', 'disaster recovery', 'BCP', 'DRP', 'RPO', 'RTO', 'backup', 'ripristino', 'recovery', 'test continuità', 'continuity testing', 'piano emergenza'],
    rag_validation_keywords: ['annex a', 'a.5.29', 'continuità operativa'],
    gap_description_it: 'Non è documentato un piano di continuità operativa e disaster recovery con RPO/RTO definiti e test periodici come richiesto dall\'Annex A A.5.29-30 ISO 27001.',
    gap_description_en: 'A business continuity and disaster recovery plan with defined RPO/RTO and periodic testing as required by ISO 27001 Annex A A.5.29-30 is not documented.',
    recommended_action_it: 'Definire il piano BCP/DRP con analisi impatto (BIA), definire RPO/RTO per ogni sistema critico, implementare procedure di backup e pianificare test semestrali.',
    recommended_action_en: 'Define the BCP/DRP plan with business impact analysis (BIA), define RPO/RTO for each critical system, implement backup procedures and plan semi-annual tests.',
    action_hours: 80,
    action_cost_eur: 6800,
  },
  {
    id: 'iso27001_annexa_supplier_security',
    regulation: 'ISO 27001',
    reference: 'ISO 27001 Annex A A.5.19-23 - Sicurezza delle informazioni nei rapporti con i fornitori',
    description_it: 'L\'organizzazione deve stabilire politiche e procedure per gestire i rischi di sicurezza associati ai fornitori, includere requisiti di sicurezza nei contratti e monitorare le prestazioni dei fornitori.',
    description_en: 'The organization must establish policies and procedures to manage security risks associated with suppliers, include security requirements in contracts and monitor supplier performance.',
    risk_level: 'high',
    remediation_effort: 'high',
    coverage_keywords: ['sicurezza fornitori', 'supplier security', 'gestione fornitori', 'vendor management', 'requisiti sicurezza contratti', 'security requirements contracts', 'valutazione fornitori', 'supplier assessment', 'terze parti', 'third party', 'supply chain security'],
    rag_validation_keywords: ['annex a', 'a.5.19', 'fornitori'],
    gap_description_it: 'Non è documentata una policy di sicurezza per la gestione dei fornitori con requisiti contrattuali e monitoraggio come richiesto dall\'Annex A A.5.19-23 ISO 27001.',
    gap_description_en: 'A supplier security management policy with contractual requirements and monitoring as required by ISO 27001 Annex A A.5.19-23 is not documented.',
    recommended_action_it: 'Definire una policy di gestione fornitori con: questionario di valutazione sicurezza, clausole contrattuali obbligatorie, audit periodici e registro fornitori critici.',
    recommended_action_en: 'Define a supplier management policy with: security assessment questionnaire, mandatory contractual clauses, periodic audits and critical supplier register.',
    action_hours: 40,
    action_cost_eur: 3400,
  },
  {
    id: 'iso27001_annexa_compliance',
    regulation: 'ISO 27001',
    reference: 'ISO 27001 Annex A A.5.31-36 - Conformità ai requisiti legali e contrattuali',
    description_it: 'L\'organizzazione deve identificare tutti i requisiti legislativi, regolamentari e contrattuali pertinenti alla sicurezza delle informazioni e garantire la conformità, inclusa la protezione della proprietà intellettuale e dei dati personali.',
    description_en: 'The organization must identify all legislative, regulatory and contractual requirements relevant to information security and ensure compliance, including protection of intellectual property and personal data.',
    risk_level: 'high',
    remediation_effort: 'medium',
    coverage_keywords: ['conformità legale', 'legal compliance', 'requisiti normativi', 'regulatory requirements', 'proprietà intellettuale', 'intellectual property', 'protezione dati', 'data protection', 'licenze software', 'software licenses', 'privacy', 'audit conformità'],
    rag_validation_keywords: ['annex a', 'a.5.31', 'conformità'],
    gap_description_it: 'Non è documentata una procedura per l\'identificazione e il monitoraggio dei requisiti legali e contrattuali sulla sicurezza delle informazioni come richiesto dall\'Annex A A.5.31-36 ISO 27001.',
    gap_description_en: 'A procedure for identifying and monitoring legal and contractual information security requirements as required by ISO 27001 Annex A A.5.31-36 is not documented.',
    recommended_action_it: 'Creare un registro dei requisiti legali e contrattuali applicabili, assegnare responsabilità di monitoraggio e pianificare verifiche periodiche di conformità.',
    recommended_action_en: 'Create a register of applicable legal and contractual requirements, assign monitoring responsibilities and plan periodic compliance checks.',
    action_hours: 24,
    action_cost_eur: 2040,
  },

  // ===== D.Lgs 81/08 - Testo Unico Sicurezza sul Lavoro =====
  {
    id: 'dlgs81_art17_obblighi_non_delegabili',
    regulation: 'D.Lgs 81/08',
    reference: 'Articolo 17 D.Lgs 81/08 - Obblighi del datore di lavoro non delegabili',
    description_it: 'Il datore di lavoro non può delegare la valutazione di tutti i rischi con la conseguente elaborazione del DVR e la designazione del RSPP.',
    description_en: 'The employer cannot delegate the assessment of all risks with the consequent preparation of the DVR and the appointment of the RSPP.',
    risk_level: 'critical',
    remediation_effort: 'high',
    coverage_keywords: ['valutazione rischi', 'dvr', 'documento valutazione rischi', 'rspp', 'responsabile servizio prevenzione', 'obblighi non delegabili', 'risk assessment workplace'],
    rag_validation_keywords: ['articolo 17', 'art. 17', 'art 17'],
    gap_description_it: 'Non è documentato il Documento di Valutazione dei Rischi (DVR) e/o la designazione del RSPP come richiesto dall\'Articolo 17 del D.Lgs 81/08.',
    gap_description_en: 'The Risk Assessment Document (DVR) and/or the RSPP appointment as required by Article 17 of D.Lgs 81/08 is not documented.',
    recommended_action_it: 'Redigere il DVR con valutazione di tutti i rischi presenti in azienda e designare formalmente il RSPP con documentazione delle competenze.',
    recommended_action_en: 'Draft the DVR with assessment of all risks present in the company and formally appoint the RSPP with documented competencies.',
    action_hours: 80,
    action_cost_eur: 6800,
  },
  {
    id: 'dlgs81_art18_obblighi_datore',
    regulation: 'D.Lgs 81/08',
    reference: 'Articolo 18 D.Lgs 81/08 - Obblighi del datore di lavoro e del dirigente',
    description_it: 'Il datore di lavoro e i dirigenti devono nominare il medico competente, designare i lavoratori addetti alla gestione emergenze, fornire DPI, informare e formare i lavoratori.',
    description_en: 'The employer and managers must appoint the occupational physician, designate emergency workers, provide PPE, inform and train workers.',
    risk_level: 'critical',
    remediation_effort: 'high',
    coverage_keywords: ['medico competente', 'gestione emergenze', 'dpi', 'dispositivi protezione individuale', 'formazione lavoratori', 'nomina medico', 'addetti emergenze', 'sorveglianza sanitaria', 'occupational physician'],
    rag_validation_keywords: ['articolo 18', 'art. 18', 'art 18'],
    gap_description_it: 'Non sono documentati gli adempimenti dell\'Articolo 18 D.Lgs 81/08: nomina medico competente, designazione addetti emergenze, fornitura DPI e formazione.',
    gap_description_en: 'The obligations under Article 18 D.Lgs 81/08 are not documented: appointment of occupational physician, emergency workers, PPE provision and training.',
    recommended_action_it: 'Verificare e documentare tutti gli adempimenti dell\'Art. 18: nomina medico competente, designazione addetti antincendio e primo soccorso, fornitura DPI adeguati.',
    recommended_action_en: 'Verify and document all Art. 18 obligations: occupational physician appointment, fire and first aid worker designation, adequate PPE provision.',
    action_hours: 60,
    action_cost_eur: 5100,
  },
  {
    id: 'dlgs81_art28_dvr',
    regulation: 'D.Lgs 81/08',
    reference: 'Articolo 28 D.Lgs 81/08 - Oggetto della valutazione dei rischi',
    description_it: 'La valutazione dei rischi deve riguardare tutti i rischi per la sicurezza e la salute dei lavoratori, compresi quelli collegati a stress lavoro-correlato, lavoratrici in gravidanza e differenze di genere/età.',
    description_en: 'Risk assessment must cover all risks to worker health and safety, including work-related stress, pregnant workers and gender/age differences.',
    risk_level: 'critical',
    remediation_effort: 'very_high',
    coverage_keywords: ['valutazione tutti i rischi', 'stress lavoro correlato', 'stress lavoro-correlato', 'rischio chimico', 'rischio biologico', 'rischio incendio', 'rischio rumore', 'rischio vibrazioni', 'movimentazione carichi', 'videoterminali', 'lavoratrici gestanti', 'rischio elettrico'],
    rag_validation_keywords: ['articolo 28', 'art. 28', 'art 28'],
    gap_description_it: 'La valutazione dei rischi non risulta comprensiva di tutti i rischi previsti dall\'Articolo 28 D.Lgs 81/08, inclusi stress lavoro-correlato e rischi specifici.',
    gap_description_en: 'The risk assessment does not appear comprehensive of all risks required by Article 28 D.Lgs 81/08, including work-related stress and specific risks.',
    recommended_action_it: 'Aggiornare il DVR includendo tutti i rischi: stress lavoro-correlato, chimico, biologico, incendio, elettrico, rumore, vibrazioni, MMC e videoterminali.',
    recommended_action_en: 'Update the DVR to include all risks: work-related stress, chemical, biological, fire, electrical, noise, vibration, manual handling and VDT.',
    action_hours: 100,
    action_cost_eur: 8500,
  },
  {
    id: 'dlgs81_art36_37_formazione',
    regulation: 'D.Lgs 81/08',
    reference: 'Articoli 36-37 D.Lgs 81/08 - Informazione e formazione dei lavoratori',
    description_it: 'Il datore di lavoro deve assicurare che ciascun lavoratore riceva una formazione sufficiente e adeguata in materia di salute e sicurezza, con riferimento ai rischi specifici.',
    description_en: 'The employer must ensure that each worker receives sufficient and adequate training on health and safety, with reference to specific risks.',
    risk_level: 'high',
    remediation_effort: 'high',
    coverage_keywords: ['formazione sicurezza', 'formazione lavoratori', 'informazione lavoratori', 'addestramento', 'training sicurezza', 'formazione rischi', 'attestati formazione', 'aggiornamento formazione', 'safety training'],
    rag_validation_keywords: ['articolo 36', 'art. 36', 'art 36'],
    gap_description_it: 'Non è documentato un piano di formazione e informazione dei lavoratori conforme agli Articoli 36 e 37 D.Lgs 81/08 con attestati e aggiornamenti periodici.',
    gap_description_en: 'No worker training and information plan compliant with Articles 36 and 37 D.Lgs 81/08 with certificates and periodic updates is documented.',
    recommended_action_it: 'Predisporre un piano formativo completo con formazione generale, specifica per mansione, addestramento pratico e registro attestati con scadenze aggiornamento.',
    recommended_action_en: 'Prepare a complete training plan with general training, job-specific training, practical instruction and certificate register with update deadlines.',
    action_hours: 48,
    action_cost_eur: 4080,
  },
  {
    id: 'dlgs81_art41_sorveglianza_sanitaria',
    regulation: 'D.Lgs 81/08',
    reference: 'Articolo 41 D.Lgs 81/08 - Sorveglianza sanitaria',
    description_it: 'La sorveglianza sanitaria è effettuata dal medico competente e comprende visite mediche preventive, periodiche, su richiesta del lavoratore e in occasione del cambio di mansione.',
    description_en: 'Health surveillance is carried out by the occupational physician and includes preventive, periodic, worker-requested and job-change medical examinations.',
    risk_level: 'high',
    remediation_effort: 'medium',
    coverage_keywords: ['sorveglianza sanitaria', 'visite mediche', 'medico competente', 'idoneità lavorativa', 'protocollo sanitario', 'cartella sanitaria', 'health surveillance', 'medical examination'],
    rag_validation_keywords: ['articolo 41', 'art. 41', 'art 41'],
    gap_description_it: 'Non è documentato un programma di sorveglianza sanitaria conforme all\'Articolo 41 D.Lgs 81/08 con protocollo sanitario e registro visite mediche.',
    gap_description_en: 'No health surveillance program compliant with Article 41 D.Lgs 81/08 with health protocol and medical examination register is documented.',
    recommended_action_it: 'Definire il protocollo di sorveglianza sanitaria con il medico competente, pianificare le visite mediche e istituire il registro delle cartelle sanitarie.',
    recommended_action_en: 'Define the health surveillance protocol with the occupational physician, plan medical examinations and establish the health records register.',
    action_hours: 32,
    action_cost_eur: 2720,
  },
  {
    id: 'dlgs81_art43_gestione_emergenze',
    regulation: 'D.Lgs 81/08',
    reference: 'Articoli 43-46 D.Lgs 81/08 - Gestione delle emergenze e prevenzione incendi',
    description_it: 'Il datore di lavoro deve organizzare i necessari rapporti con i servizi di emergenza, designare lavoratori addetti alla lotta antincendio, evacuazione e primo soccorso.',
    description_en: 'The employer must organize necessary relationships with emergency services, designate workers for firefighting, evacuation and first aid.',
    risk_level: 'high',
    remediation_effort: 'high',
    coverage_keywords: ['piano emergenza', 'piano evacuazione', 'antincendio', 'primo soccorso', 'gestione emergenze', 'addetti antincendio', 'addetti primo soccorso', 'prova evacuazione', 'cassetta pronto soccorso', 'emergency plan', 'fire prevention'],
    rag_validation_keywords: ['articolo 43', 'art. 43', 'art 43'],
    gap_description_it: 'Non è documentato un piano di gestione delle emergenze conforme agli Articoli 43-46 D.Lgs 81/08 con designazione addetti, prove di evacuazione e prevenzione incendi.',
    gap_description_en: 'No emergency management plan compliant with Articles 43-46 D.Lgs 81/08 with worker designation, evacuation drills and fire prevention is documented.',
    recommended_action_it: 'Redigere il piano di emergenza ed evacuazione, designare e formare gli addetti antincendio e primo soccorso, pianificare prove di evacuazione annuali.',
    recommended_action_en: 'Draft the emergency and evacuation plan, designate and train fire and first aid workers, plan annual evacuation drills.',
    action_hours: 48,
    action_cost_eur: 4080,
  },
  {
    id: 'dlgs81_art71_attrezzature',
    regulation: 'D.Lgs 81/08',
    reference: 'Articoli 69-73 D.Lgs 81/08 - Uso delle attrezzature di lavoro e DPI',
    description_it: 'Il datore di lavoro deve mettere a disposizione attrezzature conformi, sottoposte a verifiche periodiche, e fornire DPI adeguati ai rischi con addestramento all\'uso.',
    description_en: 'The employer must provide compliant equipment, subject to periodic inspections, and adequate PPE for risks with usage training.',
    risk_level: 'high',
    remediation_effort: 'medium',
    coverage_keywords: ['attrezzature lavoro', 'verifiche periodiche', 'manutenzione attrezzature', 'dpi', 'dispositivi protezione', 'registro attrezzature', 'conformità attrezzature', 'marcatura ce', 'work equipment', 'ppe'],
    rag_validation_keywords: ['articolo 71', 'art. 71', 'art 71'],
    gap_description_it: 'Non è documentata la conformità delle attrezzature di lavoro e dei DPI con verifiche periodiche e addestramento come richiesto dagli Articoli 69-73 D.Lgs 81/08.',
    gap_description_en: 'Equipment compliance and PPE with periodic inspections and training as required by Articles 69-73 D.Lgs 81/08 is not documented.',
    recommended_action_it: 'Censire tutte le attrezzature, verificare conformità CE, pianificare manutenzioni e verifiche periodiche, documentare consegna DPI e addestramento.',
    recommended_action_en: 'Inventory all equipment, verify CE compliance, plan maintenance and periodic inspections, document PPE delivery and training.',
    action_hours: 40,
    action_cost_eur: 3400,
  },
  {
    id: 'dlgs81_art26_appalti',
    regulation: 'D.Lgs 81/08',
    reference: 'Articolo 26 D.Lgs 81/08 - Obblighi connessi ai contratti d\'appalto',
    description_it: 'Il datore di lavoro committente deve verificare l\'idoneità tecnico-professionale degli appaltatori, fornire informazioni sui rischi specifici e elaborare il DUVRI.',
    description_en: 'The contracting employer must verify the technical-professional suitability of contractors, provide information on specific risks and prepare the DUVRI.',
    risk_level: 'high',
    remediation_effort: 'medium',
    coverage_keywords: ['duvri', 'appalti', 'contratti appalto', 'rischi interferenza', 'idoneità tecnico professionale', 'appaltatori', 'subappalto', 'coordinamento interferenze', 'contractor management'],
    rag_validation_keywords: ['articolo 26', 'art. 26', 'art 26'],
    gap_description_it: 'Non è documentata la gestione degli appalti conforme all\'Articolo 26 D.Lgs 81/08 con verifica idoneità, DUVRI e coordinamento delle interferenze.',
    gap_description_en: 'Contract management compliant with Article 26 D.Lgs 81/08 with suitability verification, DUVRI and interference coordination is not documented.',
    recommended_action_it: 'Implementare una procedura di gestione appalti con verifica idoneità appaltatori, redazione DUVRI e coordinamento dei rischi da interferenza.',
    recommended_action_en: 'Implement a contract management procedure with contractor suitability verification, DUVRI preparation and interference risk coordination.',
    action_hours: 32,
    action_cost_eur: 2720,
  },
  {
    id: 'dlgs81_art30_modelli_organizzativi',
    regulation: 'D.Lgs 81/08',
    reference: 'Articolo 30 D.Lgs 81/08 - Modelli di organizzazione e di gestione',
    description_it: 'Il modello di organizzazione e gestione deve prevedere un sistema aziendale per l\'adempimento degli obblighi giuridici in materia di salute e sicurezza (conforme BS OHSAS 18001/ISO 45001).',
    description_en: 'The organization and management model must include a corporate system for fulfilling legal obligations on health and safety (compliant with BS OHSAS 18001/ISO 45001).',
    risk_level: 'medium',
    remediation_effort: 'very_high',
    coverage_keywords: ['modello organizzativo', 'sgsl', 'sistema gestione sicurezza', 'iso 45001', 'ohsas 18001', 'modello 231', 'organismo vigilanza', 'management system safety'],
    rag_validation_keywords: ['articolo 30', 'art. 30', 'art 30'],
    gap_description_it: 'Non è documentato un Modello di Organizzazione e Gestione conforme all\'Articolo 30 D.Lgs 81/08 (SGSL) con valore esimente ai sensi del D.Lgs 231/2001.',
    gap_description_en: 'No Organization and Management Model compliant with Article 30 D.Lgs 81/08 (SGSL) with exempting value under D.Lgs 231/2001 is documented.',
    recommended_action_it: 'Valutare l\'adozione di un SGSL conforme all\'Art. 30 e alla ISO 45001, integrando un sistema di gestione con audit interni e riesame della direzione.',
    recommended_action_en: 'Evaluate adoption of a SGSL compliant with Art. 30 and ISO 45001, integrating a management system with internal audits and management review.',
    action_hours: 120,
    action_cost_eur: 10200,
  },
  {
    id: 'dlgs81_art80_rischio_elettrico',
    regulation: 'D.Lgs 81/08',
    reference: 'Articoli 80-86 D.Lgs 81/08 - Impianti e apparecchiature elettriche',
    description_it: 'Il datore di lavoro deve valutare il rischio elettrico, garantire la conformità degli impianti, effettuare verifiche periodiche e adottare misure contro contatti diretti e indiretti.',
    description_en: 'The employer must assess electrical risk, ensure plant compliance, carry out periodic inspections and adopt measures against direct and indirect contacts.',
    risk_level: 'high',
    remediation_effort: 'medium',
    coverage_keywords: ['rischio elettrico', 'impianti elettrici', 'verifica impianti', 'dichiarazione conformità', 'messa a terra', 'protezione fulmini', 'electrical risk', 'electrical safety'],
    rag_validation_keywords: ['articolo 80', 'art. 80', 'art 80'],
    gap_description_it: 'Non è documentata la valutazione del rischio elettrico e la conformità degli impianti come richiesto dagli Articoli 80-86 D.Lgs 81/08.',
    gap_description_en: 'Electrical risk assessment and plant compliance as required by Articles 80-86 D.Lgs 81/08 is not documented.',
    recommended_action_it: 'Effettuare la valutazione del rischio elettrico, verificare le dichiarazioni di conformità degli impianti e pianificare le verifiche periodiche obbligatorie.',
    recommended_action_en: 'Carry out electrical risk assessment, verify plant compliance declarations and plan mandatory periodic inspections.',
    action_hours: 24,
    action_cost_eur: 2040,
  },
  // ===== LEGGE 124/2024 ALBANIA (Protezione Dati Personali) =====
  {
    id: 'alb124_art6_principles',
    regulation: 'Legge 124/2024 Albania',
    reference: 'Articolo 6 Legge 124/2024 - Principi per il trattamento lecito dei dati personali',
    description_it: 'Il trattamento deve rispettare i principi di liceità, correttezza, trasparenza, minimizzazione, esattezza, limitazione della conservazione, integrità, riservatezza e responsabilizzazione.',
    description_en: 'Processing must comply with principles of lawfulness, fairness, transparency, minimization, accuracy, storage limitation, integrity, confidentiality and accountability.',
    risk_level: 'critical',
    remediation_effort: 'high',
    coverage_keywords: ['principi trattamento', 'liceità', 'correttezza', 'trasparenza', 'minimizzazione', 'responsabilizzazione', 'integrità', 'riservatezza', 'limitazione conservazione'],
    rag_validation_keywords: ['articolo 6', 'art. 6', 'art 6'],
    gap_description_it: 'Non è documentata una policy che formalizzi i principi di trattamento dei dati personali secondo l\'Articolo 6 della Legge 124/2024 Albania.',
    gap_description_en: 'No policy documenting personal data processing principles under Article 6 of Albanian Law 124/2024 was found.',
    recommended_action_it: 'Redigere una policy di trattamento dati conforme ai 7 principi dell\'Articolo 6 della Legge 124/2024.',
    recommended_action_en: 'Draft a data processing policy compliant with the 7 principles of Article 6 of Law 124/2024.',
    action_hours: 40,
    action_cost_eur: 3400,
  },
  {
    id: 'alb124_art7_legal_basis',
    regulation: 'Legge 124/2024 Albania',
    reference: 'Articolo 7 Legge 124/2024 - Criteri giuridici per il trattamento',
    description_it: 'Il trattamento è lecito solo sulla base di consenso, esecuzione contratto, obbligo legale, interesse vitale, interesse pubblico o interesse legittimo.',
    description_en: 'Processing is lawful only based on consent, contract performance, legal obligation, vital interest, public interest or legitimate interest.',
    risk_level: 'critical',
    remediation_effort: 'high',
    coverage_keywords: ['base giuridica', 'consenso', 'interesse legittimo', 'obbligo legale', 'esecuzione contratto', 'interesse vitale', 'interesse pubblico'],
    rag_validation_keywords: ['articolo 7', 'art. 7', 'art 7'],
    gap_description_it: 'Manca una mappatura delle basi giuridiche per ciascun trattamento come richiesto dall\'Articolo 7 della Legge 124/2024.',
    gap_description_en: 'A mapping of legal bases for each processing activity as required by Article 7 of Law 124/2024 is missing.',
    recommended_action_it: 'Creare un registro delle basi giuridiche applicabili a ogni trattamento effettuato.',
    recommended_action_en: 'Create a register of legal bases applicable to each processing activity.',
    action_hours: 32,
    action_cost_eur: 2720,
  },
  {
    id: 'alb124_art8_consent',
    regulation: 'Legge 124/2024 Albania',
    reference: 'Articolo 8 Legge 124/2024 - Criteri di validità del consenso',
    description_it: 'Il consenso deve essere libero, informato, inequivocabile e dimostrabile. Per i minori sotto i 16 anni serve il consenso dei genitori.',
    description_en: 'Consent must be freely given, informed, unambiguous and demonstrable. For minors under 16, parental consent is required.',
    risk_level: 'high',
    remediation_effort: 'medium',
    coverage_keywords: ['consenso', 'revoca consenso', 'consenso minori', 'consenso libero', 'consenso informato', 'modulo consenso'],
    rag_validation_keywords: ['articolo 8', 'art. 8', 'art 8'],
    gap_description_it: 'Non sono documentate procedure per la raccolta e gestione del consenso conformi all\'Articolo 8 della Legge 124/2024.',
    gap_description_en: 'No procedures for consent collection and management compliant with Article 8 of Law 124/2024 were found.',
    recommended_action_it: 'Implementare moduli di consenso conformi con meccanismo di revoca semplice e gestione specifica per minori.',
    recommended_action_en: 'Implement compliant consent forms with easy withdrawal mechanism and specific management for minors.',
    action_hours: 24,
    action_cost_eur: 2040,
  },
  {
    id: 'alb124_art9_sensitive_data',
    regulation: 'Legge 124/2024 Albania',
    reference: 'Articolo 9 Legge 124/2024 - Trattamento lecito dei dati sensibili',
    description_it: 'Il trattamento di dati sensibili è vietato salvo eccezioni specifiche: consenso esplicito, obblighi lavorativi, interessi vitali, interesse pubblico, sanità.',
    description_en: 'Processing of sensitive data is prohibited except in specific cases: explicit consent, employment obligations, vital interests, public interest, healthcare.',
    risk_level: 'critical',
    remediation_effort: 'high',
    coverage_keywords: ['dati sensibili', 'categorie particolari', 'dati biometrici', 'dati genetici', 'dati sanitari', 'origine razziale', 'opinioni politiche', 'convinzioni religiose'],
    rag_validation_keywords: ['articolo 9', 'art. 9', 'art 9'],
    gap_description_it: 'Non è documentata una procedura per il trattamento dei dati sensibili conforme all\'Articolo 9 della Legge 124/2024.',
    gap_description_en: 'No procedure for processing sensitive data compliant with Article 9 of Law 124/2024 was found.',
    recommended_action_it: 'Mappare tutti i trattamenti di dati sensibili, verificare le basi giuridiche applicabili e documentare le misure di protezione adeguate.',
    recommended_action_en: 'Map all sensitive data processing, verify applicable legal bases and document adequate protective measures.',
    action_hours: 36,
    action_cost_eur: 3060,
  },
  {
    id: 'alb124_art13_information',
    regulation: 'Legge 124/2024 Albania',
    reference: 'Articolo 13 Legge 124/2024 - Diritto all\'informazione',
    description_it: 'L\'interessato deve ricevere informazioni su identità del titolare, finalità, base giuridica, destinatari, trasferimenti e diritti esercitabili.',
    description_en: 'Data subjects must receive information about controller identity, purposes, legal basis, recipients, transfers and exercisable rights.',
    risk_level: 'high',
    remediation_effort: 'medium',
    coverage_keywords: ['informativa', 'privacy notice', 'diritto informazione', 'informazioni interessato', 'trasparenza'],
    rag_validation_keywords: ['articolo 13', 'art. 13', 'art 13'],
    gap_description_it: 'Non sono state individuate informative conformi all\'Articolo 13 della Legge 124/2024 che descrivano tutti gli elementi obbligatori.',
    gap_description_en: 'No privacy notices compliant with Article 13 of Law 124/2024 describing all mandatory elements were found.',
    recommended_action_it: 'Redigere informative complete per ogni punto di raccolta dati, conformi all\'Articolo 13.',
    recommended_action_en: 'Draft complete privacy notices for each data collection point, compliant with Article 13.',
    action_hours: 24,
    action_cost_eur: 2040,
  },
  {
    id: 'alb124_art14_15_rights',
    regulation: 'Legge 124/2024 Albania',
    reference: 'Articoli 14-20 Legge 124/2024 - Diritti dell\'interessato',
    description_it: 'L\'organizzazione deve garantire i diritti di accesso, rettifica, cancellazione, oblio, limitazione, portabilità e opposizione entro 30 giorni.',
    description_en: 'The organization must guarantee rights of access, rectification, erasure, right to be forgotten, restriction, portability and objection within 30 days.',
    risk_level: 'high',
    remediation_effort: 'high',
    coverage_keywords: ['diritto accesso', 'diritto rettifica', 'diritto cancellazione', 'diritto oblio', 'portabilità', 'opposizione', 'limitazione trattamento', 'diritti interessato'],
    rag_validation_keywords: ['articolo 14', 'art. 14', 'art 14'],
    gap_description_it: 'Non è documentata una procedura per la gestione delle richieste di esercizio dei diritti degli interessati (Artt. 14-20 Legge 124/2024).',
    gap_description_en: 'No procedure for managing data subject rights requests (Articles 14-20 of Law 124/2024) was found.',
    recommended_action_it: 'Implementare una procedura operativa per gestire le richieste degli interessati entro i termini previsti (30 giorni, prorogabili a 60).',
    recommended_action_en: 'Implement an operational procedure to manage data subject requests within the established deadlines (30 days, extendable to 60).',
    action_hours: 32,
    action_cost_eur: 2720,
  },
  {
    id: 'alb124_art22_23_controller',
    regulation: 'Legge 124/2024 Albania',
    reference: 'Articoli 22-23 Legge 124/2024 - Obblighi del titolare del trattamento',
    description_it: 'Il titolare deve adottare misure tecniche e organizzative adeguate e dimostrare la conformità, inclusa la tenuta di un registro delle attività di trattamento.',
    description_en: 'The controller must adopt appropriate technical and organizational measures and demonstrate compliance, including maintaining a record of processing activities.',
    risk_level: 'high',
    remediation_effort: 'high',
    coverage_keywords: ['misure tecniche', 'misure organizzative', 'registro trattamenti', 'registro attività', 'accountability', 'responsabilizzazione'],
    rag_validation_keywords: ['articolo 22', 'art. 22', 'art 22'],
    gap_description_it: 'Manca documentazione sulle misure organizzative e sul registro dei trattamenti previsti dagli Articoli 22-23 della Legge 124/2024.',
    gap_description_en: 'Documentation on organizational measures and processing records required by Articles 22-23 of Law 124/2024 is missing.',
    recommended_action_it: 'Implementare un registro delle attività di trattamento e documentare le misure tecniche e organizzative adottate.',
    recommended_action_en: 'Implement a record of processing activities and document the technical and organizational measures adopted.',
    action_hours: 40,
    action_cost_eur: 3400,
  },
  {
    id: 'alb124_art25_dpo',
    regulation: 'Legge 124/2024 Albania',
    reference: 'Articoli 25-27 Legge 124/2024 - Responsabile della protezione dei dati (DPO)',
    description_it: 'Deve essere designato un DPO nei casi previsti dalla legge. Il DPO deve avere indipendenza, risorse adeguate e accesso diretto ai vertici.',
    description_en: 'A DPO must be designated in cases required by law. The DPO must have independence, adequate resources and direct access to top management.',
    risk_level: 'high',
    remediation_effort: 'medium',
    coverage_keywords: ['DPO', 'responsabile protezione dati', 'data protection officer', 'designazione DPO', 'indipendenza DPO'],
    rag_validation_keywords: ['articolo 25', 'art. 25', 'art 25'],
    gap_description_it: 'Non è stata individuata la designazione formale di un DPO né la documentazione dei suoi compiti come previsto dagli Articoli 25-27.',
    gap_description_en: 'No formal DPO designation or documentation of DPO duties as required by Articles 25-27 was found.',
    recommended_action_it: 'Verificare l\'obbligo di nomina del DPO e, se applicabile, procedere alla designazione formale con documentazione dei compiti.',
    recommended_action_en: 'Verify DPO designation requirement and, if applicable, proceed with formal designation with documented duties.',
    action_hours: 16,
    action_cost_eur: 1360,
  },
  {
    id: 'alb124_art28_dpia',
    regulation: 'Legge 124/2024 Albania',
    reference: 'Articolo 28 Legge 124/2024 - Valutazione d\'impatto sulla protezione dei dati',
    description_it: 'Una valutazione d\'impatto è obbligatoria quando il trattamento comporta un rischio elevato per i diritti e le libertà delle persone, incluse profilazione sistematica e sorveglianza.',
    description_en: 'A data protection impact assessment is mandatory when processing is likely to result in high risk to rights and freedoms, including systematic profiling and surveillance.',
    risk_level: 'high',
    remediation_effort: 'high',
    coverage_keywords: ['valutazione impatto', 'DPIA', 'rischio elevato', 'profilazione sistematica', 'sorveglianza', 'data protection impact assessment'],
    rag_validation_keywords: ['articolo 28', 'art. 28', 'art 28'],
    gap_description_it: 'Non è stata individuata una procedura per la valutazione d\'impatto sulla protezione dei dati come richiesto dall\'Articolo 28.',
    gap_description_en: 'No data protection impact assessment procedure as required by Article 28 was found.',
    recommended_action_it: 'Definire una procedura DPIA e identificare i trattamenti che richiedono valutazione d\'impatto obbligatoria.',
    recommended_action_en: 'Define a DPIA procedure and identify processing activities requiring mandatory impact assessment.',
    action_hours: 32,
    action_cost_eur: 2720,
  },
  {
    id: 'alb124_art30_security',
    regulation: 'Legge 124/2024 Albania',
    reference: 'Articolo 30 Legge 124/2024 - Sicurezza del trattamento',
    description_it: 'Il titolare e il responsabile devono implementare misure tecniche e organizzative adeguate al rischio, incluse pseudonimizzazione, cifratura e capacità di ripristino.',
    description_en: 'The controller and processor must implement technical and organizational measures appropriate to the risk, including pseudonymization, encryption and recovery capabilities.',
    risk_level: 'critical',
    remediation_effort: 'high',
    coverage_keywords: ['sicurezza trattamento', 'misure sicurezza', 'cifratura', 'pseudonimizzazione', 'ripristino', 'resilienza', 'test sicurezza'],
    rag_validation_keywords: ['articolo 30', 'art. 30', 'art 30'],
    gap_description_it: 'Non sono documentate le misure di sicurezza tecniche e organizzative adeguate al rischio come richiesto dall\'Articolo 30.',
    gap_description_en: 'Technical and organizational security measures adequate to the risk as required by Article 30 are not documented.',
    recommended_action_it: 'Documentare le misure di sicurezza implementate (cifratura, pseudonimizzazione, backup, test periodici) e valutarne l\'adeguatezza.',
    recommended_action_en: 'Document implemented security measures (encryption, pseudonymization, backup, periodic testing) and assess their adequacy.',
    action_hours: 40,
    action_cost_eur: 3400,
  },
  {
    id: 'alb124_art31_32_breach',
    regulation: 'Legge 124/2024 Albania',
    reference: 'Articoli 31-32 Legge 124/2024 - Notifica violazione dei dati personali',
    description_it: 'Le violazioni devono essere notificate al Commissario entro 72 ore e, se a rischio elevato, anche all\'interessato senza ingiustificato ritardo.',
    description_en: 'Breaches must be notified to the Commissioner within 72 hours and, if high risk, also to data subjects without undue delay.',
    risk_level: 'critical',
    remediation_effort: 'high',
    coverage_keywords: ['violazione dati', 'data breach', 'notifica violazione', 'incidente dati', '72 ore', 'registro violazioni'],
    rag_validation_keywords: ['articolo 31', 'art. 31', 'art 31'],
    gap_description_it: 'Manca una procedura di gestione e notifica delle violazioni dei dati personali conforme agli Articoli 31-32 della Legge 124/2024.',
    gap_description_en: 'No data breach management and notification procedure compliant with Articles 31-32 of Law 124/2024 was found.',
    recommended_action_it: 'Implementare una procedura di gestione data breach con notifica al Commissario entro 72 ore e registro delle violazioni.',
    recommended_action_en: 'Implement a data breach management procedure with notification to the Commissioner within 72 hours and breach register.',
    action_hours: 32,
    action_cost_eur: 2720,
  },
  {
    id: 'alb124_art33_international_transfers',
    regulation: 'Legge 124/2024 Albania',
    reference: 'Articoli 33-39 Legge 124/2024 - Trasferimenti internazionali di dati',
    description_it: 'I trasferimenti internazionali sono ammessi solo verso paesi con adeguata protezione o sulla base di clausole standard, norme vincolanti d\'impresa o garanzie specifiche.',
    description_en: 'International transfers are only allowed to countries with adequate protection or based on standard clauses, binding corporate rules or specific safeguards.',
    risk_level: 'high',
    remediation_effort: 'high',
    coverage_keywords: ['trasferimento internazionale', 'trasferimento dati', 'clausole standard', 'norme vincolanti impresa', 'adeguatezza', 'paesi terzi', 'garanzie adeguate'],
    rag_validation_keywords: ['articolo 33', 'art. 33', 'art 33'],
    gap_description_it: 'Non è documentata una procedura per la gestione dei trasferimenti internazionali di dati conforme agli Articoli 33-39 della Legge 124/2024.',
    gap_description_en: 'No procedure for managing international data transfers compliant with Articles 33-39 of Law 124/2024 was found.',
    recommended_action_it: 'Mappare tutti i trasferimenti internazionali, verificare le basi giuridiche e implementare clausole standard o garanzie appropriate.',
    recommended_action_en: 'Map all international transfers, verify legal bases and implement standard clauses or appropriate safeguards.',
    action_hours: 36,
    action_cost_eur: 3060,
  },

  // ===== NIS2 — Requisiti aggiuntivi =====
  {
    id: 'nis2_art24_certifications',
    regulation: 'NIS2',
    reference: 'Art. 24 D.Lgs. 138/2024 (Art. 24 Dir. NIS2) - Uso di schemi europei di certificazione della cybersicurezza',
    description_it: 'Gli Stati membri possono imporre ai soggetti essenziali e importanti l\'uso di prodotti, servizi e processi ICT certificati nell\'ambito di schemi europei di certificazione della cybersicurezza.',
    description_en: 'Member States may require essential and important entities to use ICT products, services and processes certified under European cybersecurity certification schemes.',
    risk_level: 'medium',
    remediation_effort: 'high',
    coverage_keywords: ['certificazione cybersicurezza', 'cybersecurity certification', 'schema certificazione', 'certification scheme', 'enisa', 'prodotti certificati', 'servizi certificati', 'common criteria', 'eucc', 'eu cybersecurity act'],
    rag_validation_keywords: ['articolo 24', 'art. 24', 'art 24'],
    gap_description_it: 'Non è documentata una policy per l\'adozione di prodotti e servizi ICT certificati nell\'ambito di schemi europei di certificazione come previsto dall\'Articolo 24 NIS2.',
    gap_description_en: 'No policy for adopting ICT products and services certified under European certification schemes as required by Article 24 NIS2 was documented.',
    recommended_action_it: 'Definire criteri di procurement che privilegino prodotti e servizi ICT certificati secondo schemi europei (EUCC, CSA) e documentare le scelte effettuate.',
    recommended_action_en: 'Define procurement criteria favoring ICT products and services certified under European schemes (EUCC, CSA) and document the choices made.',
    action_hours: 24,
    action_cost_eur: 2040,
  },
  {
    id: 'nis2_art29_information_sharing',
    regulation: 'NIS2',
    reference: 'Art. 17 D.Lgs. 138/2024 (Art. 29 Dir. NIS2) - Accordi di condivisione delle informazioni sulla cybersicurezza',
    description_it: 'I soggetti essenziali e importanti possono scambiarsi su base volontaria informazioni pertinenti sulla cybersicurezza, inclusi indicatori di compromissione, tattiche e procedure degli attaccanti.',
    description_en: 'Essential and important entities may voluntarily exchange relevant cybersecurity information, including indicators of compromise, attacker tactics and procedures.',
    risk_level: 'medium',
    remediation_effort: 'medium',
    coverage_keywords: ['condivisione informazioni', 'information sharing', 'threat intelligence', 'indicatori compromissione', 'ioc', 'tattiche attaccanti', 'ttp', 'isac', 'cert', 'scambio informazioni cyber'],
    rag_validation_keywords: ['articolo 29', 'art. 29', 'art 29'],
    gap_description_it: 'Non è documentata una procedura per la condivisione di informazioni sulla cybersicurezza con altri soggetti come previsto dall\'Articolo 29 NIS2.',
    gap_description_en: 'No procedure for sharing cybersecurity information with other entities as provided by Article 29 NIS2 was documented.',
    recommended_action_it: 'Aderire a un ISAC o gruppo di condivisione settoriale, definire policy di condivisione threat intelligence e protezione delle informazioni scambiate.',
    recommended_action_en: 'Join an ISAC or sectoral sharing group, define threat intelligence sharing policy and protection of exchanged information.',
    action_hours: 20,
    action_cost_eur: 1700,
  },
  {
    id: 'nis2_art32_33_supervision',
    regulation: 'NIS2',
    reference: 'Artt. 31-37 D.Lgs. 138/2024 (Artt. 32-33 Dir. NIS2) - Vigilanza, esecuzione e sanzioni',
    description_it: 'Le autorità competenti dispongono di poteri di vigilanza tra cui audit, ispezioni, richieste di informazioni e accesso a dati e documenti per verificare la conformità dei soggetti.',
    description_en: 'Competent authorities have supervisory powers including audits, inspections, information requests and access to data and documents to verify entity compliance.',
    risk_level: 'high',
    remediation_effort: 'high',
    coverage_keywords: ['vigilanza', 'supervision', 'audit conformità', 'ispezioni', 'inspections', 'autorità competente', 'competent authority', 'poteri vigilanza', 'richiesta informazioni', 'verifica conformità', 'compliance audit'],
    rag_validation_keywords: ['articolo 32', 'art. 32', 'articolo 31', 'articolo 33', 'articolo 34', 'articolo 35', 'articolo 36', 'articolo 37'],
    gap_description_it: 'Non è documentata una procedura di preparazione alle attività di vigilanza delle autorità competenti come previsto dagli Articoli 32-33 NIS2.',
    gap_description_en: 'No procedure for preparing for supervisory activities by competent authorities as required by Articles 32-33 NIS2 was documented.',
    recommended_action_it: 'Predisporre un programma di audit readiness con documentazione aggiornata, evidenze di conformità e punti di contatto designati per le ispezioni.',
    recommended_action_en: 'Prepare an audit readiness program with up-to-date documentation, compliance evidence and designated contact points for inspections.',
    action_hours: 40,
    action_cost_eur: 3400,
  },
  {
    id: 'nis2_art34_36_sanctions',
    regulation: 'NIS2',
    reference: 'Artt. 34-37 D.Lgs. 138/2024 (Artt. 34-36 Dir. NIS2) - Sanzioni e misure esecutive',
    description_it: 'Le autorità possono imporre sanzioni amministrative fino a 10 milioni di euro o 2% del fatturato per i soggetti essenziali, e fino a 7 milioni o 1,4% per quelli importanti.',
    description_en: 'Authorities may impose administrative fines up to EUR 10 million or 2% of turnover for essential entities, and up to EUR 7 million or 1.4% for important entities.',
    risk_level: 'critical',
    remediation_effort: 'high',
    coverage_keywords: ['sanzioni', 'sanctions', 'misure esecutive', 'enforcement', 'sanzioni amministrative', 'administrative fines', 'responsabilità dirigenti', 'management liability', 'sospensione certificazione', 'divieto temporaneo'],
    rag_validation_keywords: ['articolo 34', 'art. 34', 'art 34'],
    gap_description_it: 'Non è documentata una valutazione dell\'esposizione sanzionatoria e delle misure esecutive applicabili ai sensi degli Articoli 34-36 NIS2.',
    gap_description_en: 'No assessment of sanctions exposure and enforcement measures applicable under Articles 34-36 NIS2 was documented.',
    recommended_action_it: 'Effettuare una valutazione dell\'esposizione sanzionatoria, definire un piano di compliance prioritizzato e documentare le responsabilità dei dirigenti.',
    recommended_action_en: 'Perform a sanctions exposure assessment, define a prioritized compliance plan and document management responsibilities.',
    action_hours: 24,
    action_cost_eur: 2040,
  },

  // ===== NIS2 — Requisiti specifici D.Lgs. 138/2024 =====
  {
    id: 'nis2_dlgs138_art7_registrazione',
    regulation: 'NIS2',
    reference: 'Art. 7 D.Lgs. 138/2024 - Registrazione sulla piattaforma ACN',
    description_it: 'I soggetti essenziali e importanti devono registrarsi sulla piattaforma digitale dell\'ACN, fornendo dati aggiornati e designando un punto di contatto. La registrazione iniziale doveva avvenire entro il 28 febbraio 2025.',
    description_en: 'Essential and important entities must register on the ACN digital platform, providing updated data and designating a point of contact.',
    risk_level: 'critical',
    remediation_effort: 'low',
    coverage_keywords: ['registrazione acn', 'piattaforma acn', 'punto di contatto', 'portale nis', 'registrazione nis', 'designazione punto contatto', 'sostituto punto contatto'],
    rag_validation_keywords: ['articolo 7', 'art. 7', 'registrazione', 'piattaforma'],
    gap_description_it: 'Non è documentata l\'avvenuta registrazione sulla piattaforma ACN e la designazione del punto di contatto come previsto dall\'Art. 7 D.Lgs. 138/2024.',
    gap_description_en: 'No documentation of registration on the ACN platform and designation of point of contact as required by Art. 7 D.Lgs. 138/2024.',
    recommended_action_it: 'Verificare l\'avvenuta registrazione sulla piattaforma ACN, designare punto di contatto e sostituto, e pianificare l\'aggiornamento annuale delle informazioni (15 aprile - 31 maggio).',
    recommended_action_en: 'Verify registration on ACN platform, designate point of contact and substitute, and plan annual information update.',
    action_hours: 8,
    action_cost_eur: 680,
  },
  {
    id: 'nis2_dlgs138_art24_10domains',
    regulation: 'NIS2',
    reference: 'Art. 24, comma 2 D.Lgs. 138/2024 - I 10 ambiti obbligatori delle misure di sicurezza',
    description_it: 'Le misure di gestione del rischio devono comprendere almeno: (a) politiche di analisi dei rischi e sicurezza dei sistemi informativi; (b) gestione degli incidenti; (c) continuità operativa e gestione delle crisi; (d) sicurezza della catena di approvvigionamento; (e) sicurezza nell\'acquisizione, sviluppo e manutenzione dei sistemi; (f) politiche di valutazione dell\'efficacia delle misure; (g) pratiche di igiene informatica e formazione; (h) crittografia e cifratura; (i) sicurezza delle risorse umane e controllo accessi; (j) autenticazione a più fattori e comunicazioni sicure.',
    description_en: 'Risk management measures must include at least 10 mandatory domains covering risk analysis, incident management, business continuity, supply chain security, etc.',
    risk_level: 'critical',
    remediation_effort: 'very_high',
    coverage_keywords: ['analisi rischi', 'gestione incidenti', 'continuità operativa', 'catena approvvigionamento', 'supply chain', 'igiene informatica', 'cyber hygiene', 'crittografia', 'cifratura', 'autenticazione multifattore', 'MFA', 'controllo accessi', 'risorse umane sicurezza', 'valutazione efficacia', 'sicurezza sviluppo'],
    rag_validation_keywords: ['articolo 24', 'art. 24', 'dieci ambiti', '10 ambiti', 'misure minime'],
    gap_description_it: 'Non è documentata la copertura completa dei 10 ambiti obbligatori delle misure di sicurezza previsti dall\'Art. 24, comma 2 del D.Lgs. 138/2024.',
    gap_description_en: 'Complete coverage of the 10 mandatory security measure domains required by Art. 24(2) D.Lgs. 138/2024 is not documented.',
    recommended_action_it: 'Effettuare una mappatura dei 10 ambiti obbligatori, identificare le lacune per ciascuno e implementare le misure mancanti con priorità alle aree critiche (gestione incidenti, BCM, supply chain).',
    recommended_action_en: 'Map all 10 mandatory domains, identify gaps for each and implement missing measures prioritizing critical areas.',
    action_hours: 160,
    action_cost_eur: 13600,
  },
  {
    id: 'nis2_dlgs138_art25_notifica_fasi',
    regulation: 'NIS2',
    reference: 'Art. 25 D.Lgs. 138/2024 - Notifica incidenti in 3 fasi obbligatorie',
    description_it: 'I soggetti devono notificare gli incidenti significativi al CSIRT Italia: pre-notifica entro 24 ore, notifica completa entro 72 ore e relazione finale entro un mese. L\'obbligo decorre 9 mesi dall\'inserimento nell\'elenco ACN.',
    description_en: 'Entities must notify significant incidents to CSIRT Italia: pre-notification within 24h, full notification within 72h and final report within 1 month.',
    risk_level: 'critical',
    remediation_effort: 'high',
    coverage_keywords: ['pre-notifica', 'preallarme', 'notifica 24 ore', 'notifica 72 ore', 'relazione finale', 'incidente significativo', 'csirt italia', 'notifica incidente', 'segnalazione incidente'],
    rag_validation_keywords: ['articolo 25', 'art. 25', 'pre-notifica', '24 ore', '72 ore'],
    gap_description_it: 'Non è documentata una procedura di notifica incidenti significativi conforme all\'Art. 25 D.Lgs. 138/2024 con le 3 fasi obbligatorie (pre-notifica 24h, notifica 72h, relazione finale 1 mese).',
    gap_description_en: 'No significant incident notification procedure with the 3 mandatory phases as required by Art. 25 D.Lgs. 138/2024.',
    recommended_action_it: 'Definire procedura di incident notification con le 3 fasi, designare il team di risposta, testare la procedura con simulazione e configurare l\'accesso al portale CSIRT Italia.',
    recommended_action_en: 'Define incident notification procedure with 3 phases, designate response team, test with simulation and configure CSIRT Italia portal access.',
    action_hours: 40,
    action_cost_eur: 3400,
  },
  {
    id: 'nis2_dlgs138_art26_supply_chain',
    regulation: 'NIS2',
    reference: 'Art. 26 D.Lgs. 138/2024 (Art. 22 Dir. NIS2) - Sicurezza della catena di approvvigionamento',
    description_it: 'I soggetti devono tenere conto delle vulnerabilità specifiche di ogni fornitore diretto e valutare la qualità complessiva dei prodotti e delle pratiche di cybersicurezza dei fornitori, incluse le loro procedure di sviluppo sicuro.',
    description_en: 'Entities must consider specific vulnerabilities of each direct supplier and assess overall quality of products and cybersecurity practices of suppliers.',
    risk_level: 'high',
    remediation_effort: 'high',
    coverage_keywords: ['catena approvvigionamento', 'supply chain', 'fornitori', 'fornitori ict', 'fornitori rilevanti', 'valutazione fornitori', 'rischio terze parti', 'third party risk', 'sviluppo sicuro fornitori', 'vendor assessment'],
    rag_validation_keywords: ['articolo 26', 'art. 26', 'catena approvvigionamento', 'supply chain'],
    gap_description_it: 'Non è documentata una procedura di valutazione e gestione del rischio della catena di approvvigionamento conforme all\'Art. 26 D.Lgs. 138/2024.',
    gap_description_en: 'No supply chain risk assessment and management procedure compliant with Art. 26 D.Lgs. 138/2024.',
    recommended_action_it: 'Mappare i fornitori ICT rilevanti, definire criteri di valutazione del rischio cyber dei fornitori, implementare clausole contrattuali di sicurezza e pianificare audit periodici.',
    recommended_action_en: 'Map relevant ICT suppliers, define supplier cyber risk assessment criteria, implement security contract clauses and plan periodic audits.',
    action_hours: 60,
    action_cost_eur: 5100,
  },
  {
    id: 'nis2_dlgs138_art24_proporzionalita',
    regulation: 'NIS2',
    reference: 'Art. 24, comma 1 D.Lgs. 138/2024 - Principio di proporzionalità delle misure',
    description_it: 'Le misure devono essere proporzionate al grado di esposizione al rischio, alle dimensioni del soggetto, alla probabilità e gravità degli incidenti e al loro impatto sociale ed economico. Devono seguire un approccio multi-rischio.',
    description_en: 'Measures must be proportionate to risk exposure, entity size, incident probability and severity, and their social/economic impact. Must follow a multi-risk approach.',
    risk_level: 'high',
    remediation_effort: 'medium',
    coverage_keywords: ['proporzionalità', 'approccio multi-rischio', 'multi-risk', 'analisi rischio proporzionata', 'dimensioni soggetto', 'esposizione rischio', 'impatto sociale', 'impatto economico'],
    rag_validation_keywords: ['articolo 24', 'art. 24', 'proporzionalità', 'multi-rischio'],
    gap_description_it: 'Non è documentata un\'analisi di proporzionalità delle misure di sicurezza rispetto al profilo di rischio dell\'organizzazione come previsto dall\'Art. 24, comma 1 D.Lgs. 138/2024.',
    gap_description_en: 'No proportionality analysis of security measures relative to the organization\'s risk profile as required by Art. 24(1) D.Lgs. 138/2024.',
    recommended_action_it: 'Condurre un\'analisi di proporzionalità formale che consideri dimensioni, settore, esposizione al rischio e impatto potenziale degli incidenti per calibrare le misure di sicurezza.',
    recommended_action_en: 'Conduct formal proportionality analysis considering size, sector, risk exposure and potential incident impact to calibrate security measures.',
    action_hours: 24,
    action_cost_eur: 2040,
  },
  {
    id: 'nis2_dlgs138_art23_formazione',
    regulation: 'NIS2',
    reference: 'Art. 23, comma 2 D.Lgs. 138/2024 - Formazione obbligatoria organi direttivi e dipendenti',
    description_it: 'Gli organi di amministrazione e direttivi devono seguire una formazione in materia di sicurezza informatica e promuovere l\'offerta di una formazione analoga ai dipendenti, al fine di acquisire conoscenze e competenze sufficienti per valutare i rischi.',
    description_en: 'Management bodies must undergo cybersecurity training and promote similar training for employees to acquire sufficient knowledge and skills to assess risks.',
    risk_level: 'high',
    remediation_effort: 'medium',
    coverage_keywords: ['formazione cybersicurezza', 'formazione sicurezza informatica', 'formazione dirigenti', 'formazione dipendenti', 'competenze sicurezza', 'awareness', 'security training', 'formazione obbligatoria'],
    rag_validation_keywords: ['articolo 23', 'art. 23', 'formazione', 'competenze'],
    gap_description_it: 'Non è documentato un piano di formazione obbligatoria in cybersicurezza per gli organi direttivi e i dipendenti conforme all\'Art. 23, comma 2 D.Lgs. 138/2024.',
    gap_description_en: 'No mandatory cybersecurity training plan for management bodies and employees as required by Art. 23(2) D.Lgs. 138/2024.',
    recommended_action_it: 'Definire un piano di formazione annuale sulla cybersicurezza differenziato per ruolo (dirigenti, IT, operativi), documentare le sessioni e verificare l\'acquisizione delle competenze.',
    recommended_action_en: 'Define annual cybersecurity training plan differentiated by role, document sessions and verify competence acquisition.',
    action_hours: 30,
    action_cost_eur: 2550,
  },
  {
    id: 'nis2_dlgs138_art24_igiene_cyber',
    regulation: 'NIS2',
    reference: 'Art. 24, comma 2, lett. g) D.Lgs. 138/2024 - Pratiche di igiene informatica di base',
    description_it: 'I soggetti devono adottare pratiche di base di igiene informatica: gestione password, aggiornamenti software, configurazione sicura dei dispositivi, segmentazione della rete, gestione degli accessi privilegiati.',
    description_en: 'Entities must adopt basic cyber hygiene practices: password management, software updates, secure device configuration, network segmentation, privileged access management.',
    risk_level: 'high',
    remediation_effort: 'medium',
    coverage_keywords: ['igiene informatica', 'cyber hygiene', 'gestione password', 'aggiornamento software', 'patch management', 'configurazione sicura', 'hardening', 'segmentazione rete', 'accessi privilegiati', 'privileged access'],
    rag_validation_keywords: ['igiene informatica', 'cyber hygiene', 'pratiche base'],
    gap_description_it: 'Non sono documentate politiche e pratiche di igiene informatica di base come previsto dall\'Art. 24, comma 2, lett. g) del D.Lgs. 138/2024.',
    gap_description_en: 'No basic cyber hygiene policies and practices as required by Art. 24(2)(g) D.Lgs. 138/2024.',
    recommended_action_it: 'Definire e documentare una policy di igiene informatica che copra: gestione password, patching, hardening, segmentazione rete e gestione accessi privilegiati.',
    recommended_action_en: 'Define and document a cyber hygiene policy covering: password management, patching, hardening, network segmentation and privileged access management.',
    action_hours: 30,
    action_cost_eur: 2550,
  },
  {
    id: 'nis2_dlgs138_art24_crittografia',
    regulation: 'NIS2',
    reference: 'Art. 24, comma 2, lett. h) D.Lgs. 138/2024 - Uso della crittografia e cifratura',
    description_it: 'I soggetti devono adottare politiche e procedure relative all\'uso della crittografia e della cifratura per proteggere la riservatezza, l\'integrità e la disponibilità dei dati.',
    description_en: 'Entities must adopt policies and procedures regarding the use of cryptography and encryption to protect data confidentiality, integrity and availability.',
    risk_level: 'high',
    remediation_effort: 'medium',
    coverage_keywords: ['crittografia', 'cifratura', 'encryption', 'criptografia', 'chiavi crittografiche', 'key management', 'tls', 'ssl', 'cifratura disco', 'cifratura dati', 'at rest', 'in transit'],
    rag_validation_keywords: ['crittografia', 'cifratura', 'encryption'],
    gap_description_it: 'Non è documentata una policy sull\'uso della crittografia e della cifratura conforme all\'Art. 24, comma 2, lett. h) del D.Lgs. 138/2024.',
    gap_description_en: 'No cryptography and encryption policy as required by Art. 24(2)(h) D.Lgs. 138/2024.',
    recommended_action_it: 'Definire una policy di crittografia che copra: cifratura dati at-rest e in-transit, gestione chiavi, standard minimi (TLS 1.2+, AES-256) e uso di certificati.',
    recommended_action_en: 'Define encryption policy covering: at-rest and in-transit encryption, key management, minimum standards and certificate use.',
    action_hours: 20,
    action_cost_eur: 1700,
  },
  {
    id: 'nis2_dlgs138_art24_mfa',
    regulation: 'NIS2',
    reference: 'Art. 24, comma 2, lett. j) D.Lgs. 138/2024 - Autenticazione a più fattori e comunicazioni sicure',
    description_it: 'I soggetti devono utilizzare soluzioni di autenticazione a più fattori o autenticazione continua, comunicazioni vocali, video e testuali protette e sistemi di comunicazione di emergenza protetti.',
    description_en: 'Entities must use multi-factor or continuous authentication solutions, secured voice/video/text communications and protected emergency communication systems.',
    risk_level: 'high',
    remediation_effort: 'medium',
    coverage_keywords: ['autenticazione multifattore', 'MFA', 'multi-factor authentication', '2FA', 'autenticazione continua', 'comunicazioni sicure', 'comunicazioni protette', 'comunicazione emergenza'],
    rag_validation_keywords: ['autenticazione', 'multifattore', 'MFA', 'multi-factor'],
    gap_description_it: 'Non è documentata l\'implementazione di autenticazione a più fattori e comunicazioni sicure come previsto dall\'Art. 24, comma 2, lett. j) del D.Lgs. 138/2024.',
    gap_description_en: 'No implementation of multi-factor authentication and secure communications as required by Art. 24(2)(j) D.Lgs. 138/2024.',
    recommended_action_it: 'Implementare MFA su tutti i sistemi critici, definire policy di comunicazione sicura per le emergenze e verificare la cifratura delle comunicazioni vocali e video aziendali.',
    recommended_action_en: 'Implement MFA on all critical systems, define secure emergency communication policy and verify encryption of corporate voice and video.',
    action_hours: 30,
    action_cost_eur: 2550,
  },
  {
    id: 'nis2_dlgs138_art24_bcm',
    regulation: 'NIS2',
    reference: 'Art. 24, comma 2, lett. c) D.Lgs. 138/2024 - Continuità operativa e gestione delle crisi',
    description_it: 'I soggetti devono predisporre piani di continuità operativa, gestione del disaster recovery e gestione delle crisi, inclusi backup, ripristino e gestione delle crisi.',
    description_en: 'Entities must prepare business continuity plans, disaster recovery management and crisis management, including backup, recovery and crisis management.',
    risk_level: 'critical',
    remediation_effort: 'high',
    coverage_keywords: ['continuità operativa', 'business continuity', 'disaster recovery', 'gestione crisi', 'crisis management', 'BCP', 'DRP', 'backup', 'ripristino', 'RTO', 'RPO', 'piano emergenza'],
    rag_validation_keywords: ['continuità operativa', 'business continuity', 'disaster recovery', 'gestione crisi'],
    gap_description_it: 'Non sono documentati piani di continuità operativa, disaster recovery e gestione delle crisi conformi all\'Art. 24, comma 2, lett. c) del D.Lgs. 138/2024.',
    gap_description_en: 'No business continuity, disaster recovery and crisis management plans as required by Art. 24(2)(c) D.Lgs. 138/2024.',
    recommended_action_it: 'Definire BCP e DRP con RTO/RPO per ogni sistema critico, designare il team di gestione crisi, testare annualmente i piani con esercitazioni.',
    recommended_action_en: 'Define BCP and DRP with RTO/RPO for each critical system, designate crisis management team, test plans annually with exercises.',
    action_hours: 60,
    action_cost_eur: 5100,
  },
  {
    id: 'nis2_dlgs138_art24_sicurezza_hr',
    regulation: 'NIS2',
    reference: 'Art. 24, comma 2, lett. i) D.Lgs. 138/2024 - Sicurezza risorse umane e controllo accessi',
    description_it: 'I soggetti devono adottare politiche di sicurezza delle risorse umane, strategie di controllo dell\'accesso e gestione degli attivi (asset management).',
    description_en: 'Entities must adopt human resources security policies, access control strategies and asset management.',
    risk_level: 'high',
    remediation_effort: 'medium',
    coverage_keywords: ['sicurezza risorse umane', 'human resources security', 'controllo accessi', 'access control', 'gestione attivi', 'asset management', 'RBAC', 'need to know', 'least privilege', 'onboarding sicurezza', 'offboarding'],
    rag_validation_keywords: ['sicurezza risorse umane', 'controllo accessi', 'access control', 'asset management'],
    gap_description_it: 'Non sono documentate politiche di sicurezza delle risorse umane e di controllo degli accessi conformi all\'Art. 24, comma 2, lett. i) del D.Lgs. 138/2024.',
    gap_description_en: 'No human resources security and access control policies as required by Art. 24(2)(i) D.Lgs. 138/2024.',
    recommended_action_it: 'Definire policy di sicurezza HR (screening, clausole contrattuali, procedure di onboarding/offboarding), implementare RBAC e inventariare tutti gli asset IT.',
    recommended_action_en: 'Define HR security policy, implement RBAC and inventory all IT assets.',
    action_hours: 30,
    action_cost_eur: 2550,
  },
  {
    id: 'nis2_dlgs138_fornitori_rilevanti',
    regulation: 'NIS2',
    reference: 'Determinazione ACN 127437/2026 - Comunicazione fornitori rilevanti NIS',
    description_it: 'I soggetti NIS devono comunicare all\'ACN l\'elenco dei fornitori rilevanti nell\'ambito dell\'aggiornamento annuale (15 aprile - 31 maggio), indicando fornitori ICT e fornitori di servizi di sicurezza.',
    description_en: 'NIS entities must communicate to ACN the list of relevant suppliers during the annual update, indicating ICT suppliers and security service providers.',
    risk_level: 'medium',
    remediation_effort: 'medium',
    coverage_keywords: ['fornitori rilevanti', 'fornitori nis', 'comunicazione fornitori', 'aggiornamento annuale', 'fornitura ict', 'fornitori sicurezza', 'vendor management'],
    rag_validation_keywords: ['fornitori rilevanti', 'determinazione acn', 'aggiornamento annuale'],
    gap_description_it: 'Non è documentata la mappatura dei fornitori rilevanti NIS e la procedura di comunicazione annuale all\'ACN come previsto dalla Determinazione ACN 127437/2026.',
    gap_description_en: 'No mapping of relevant NIS suppliers and annual ACN communication procedure as required by ACN Determination 127437/2026.',
    recommended_action_it: 'Mappare tutti i fornitori rilevanti (ICT e sicurezza), classificarli secondo i criteri ACN e pianificare la comunicazione annuale entro il 31 maggio.',
    recommended_action_en: 'Map all relevant suppliers (ICT and security), classify per ACN criteria and plan annual communication by May 31.',
    action_hours: 20,
    action_cost_eur: 1700,
  },

  // ===== DORA — Requisiti aggiuntivi =====
  {
    id: 'dora_art9_protection_prevention',
    regulation: 'DORA',
    reference: 'Articolo 9 DORA - Protezione e prevenzione',
    description_it: 'Le entità finanziarie devono implementare e mantenere aggiornati sistemi e strumenti ICT resilienti che riducano al minimo l\'impatto dei rischi ICT, inclusi politiche di sicurezza, controlli accesso e patch management.',
    description_en: 'Financial entities must implement and maintain up-to-date resilient ICT systems and tools that minimize the impact of ICT risks, including security policies, access controls and patch management.',
    risk_level: 'critical',
    remediation_effort: 'high',
    coverage_keywords: ['protezione ict', 'ict protection', 'prevenzione', 'prevention', 'politiche sicurezza', 'security policies', 'controllo accessi', 'access control', 'patch management', 'aggiornamenti sicurezza', 'network security', 'sicurezza rete'],
    rag_validation_keywords: ['articolo 9', 'art. 9', 'art 9'],
    gap_description_it: 'Non sono documentate misure di protezione e prevenzione ICT conformi all\'Articolo 9 DORA con politiche di sicurezza, controlli accesso e gestione patch.',
    gap_description_en: 'No ICT protection and prevention measures compliant with Article 9 DORA with security policies, access controls and patch management were documented.',
    recommended_action_it: 'Implementare politiche di sicurezza ICT complete con controllo accessi basato su ruoli, gestione patch automatizzata, segmentazione rete e hardening dei sistemi.',
    recommended_action_en: 'Implement comprehensive ICT security policies with role-based access control, automated patch management, network segmentation and system hardening.',
    action_hours: 60,
    action_cost_eur: 5100,
    coverage_threshold: 0.15,
    min_keyword_matches: 2,
  },
  {
    id: 'dora_art10_anomaly_detection',
    regulation: 'DORA',
    reference: 'Articolo 10 DORA - Rilevamento delle anomalie',
    description_it: 'Le entità finanziarie devono disporre di meccanismi per rilevare tempestivamente attività anomale, inclusi attacchi informatici e problemi di prestazione della rete e dei sistemi ICT.',
    description_en: 'Financial entities must have mechanisms to promptly detect anomalous activities, including cyber attacks and ICT network and system performance issues.',
    risk_level: 'high',
    remediation_effort: 'high',
    coverage_keywords: ['rilevamento anomalie', 'anomaly detection', 'monitoraggio sicurezza', 'security monitoring', 'siem', 'soc', 'ids', 'ips', 'intrusion detection', 'log monitoring', 'threat detection', 'alerting'],
    rag_validation_keywords: ['articolo 10', 'art. 10', 'art 10'],
    gap_description_it: 'Non sono documentati meccanismi di rilevamento delle anomalie e monitoraggio continuo della sicurezza ICT conformi all\'Articolo 10 DORA.',
    gap_description_en: 'No anomaly detection mechanisms and continuous ICT security monitoring compliant with Article 10 DORA were documented.',
    recommended_action_it: 'Implementare un sistema SIEM/SOC per il monitoraggio continuo, definire regole di rilevamento, soglie di alerting e procedure di escalation.',
    recommended_action_en: 'Implement a SIEM/SOC system for continuous monitoring, define detection rules, alerting thresholds and escalation procedures.',
    action_hours: 80,
    action_cost_eur: 6800,
    coverage_threshold: 0.15,
    min_keyword_matches: 2,
  },
  {
    id: 'dora_art11_response_recovery',
    regulation: 'DORA',
    reference: 'Articolo 11 DORA - Risposta e recupero',
    description_it: 'Le entità finanziarie devono definire e attuare una politica di continuità operativa ICT e piani di risposta e recupero che garantiscano la continuità delle funzioni critiche.',
    description_en: 'Financial entities must define and implement an ICT business continuity policy and response and recovery plans ensuring continuity of critical functions.',
    risk_level: 'critical',
    remediation_effort: 'very_high',
    coverage_keywords: ['risposta incidenti', 'incident response', 'recupero', 'recovery', 'continuità operativa', 'business continuity', 'disaster recovery', 'piano recupero', 'rto', 'rpo', 'backup', 'funzioni critiche', 'ripristino'],
    rag_validation_keywords: ['articolo 11', 'art. 11', 'art 11'],
    gap_description_it: 'Non è documentata una politica di continuità operativa ICT e piani di risposta e recupero conformi all\'Articolo 11 DORA con RTO/RPO definiti.',
    gap_description_en: 'No ICT business continuity policy and response and recovery plans compliant with Article 11 DORA with defined RTO/RPO were documented.',
    recommended_action_it: 'Definire politica BCP/DR ICT con identificazione funzioni critiche, definizione RTO/RPO, piani di recupero, test periodici e comunicazione di crisi.',
    recommended_action_en: 'Define ICT BCP/DR policy with critical function identification, RTO/RPO definition, recovery plans, periodic testing and crisis communication.',
    action_hours: 80,
    action_cost_eur: 6800,
    coverage_threshold: 0.15,
    min_keyword_matches: 2,
  },
  {
    id: 'dora_art24_25_resilience_testing',
    regulation: 'DORA',
    reference: 'Articoli 24-25 DORA - Test di resilienza operativa digitale',
    description_it: 'Le entità finanziarie devono attuare un programma di test di resilienza operativa digitale proporzionato ai rischi, inclusi vulnerability assessment, test di penetrazione, analisi open source e scenari di test.',
    description_en: 'Financial entities must implement a digital operational resilience testing program proportionate to risks, including vulnerability assessments, penetration tests, open source analysis and test scenarios.',
    risk_level: 'high',
    remediation_effort: 'high',
    coverage_keywords: ['test resilienza', 'resilience testing', 'vulnerability assessment', 'penetration test', 'pen test', 'test sicurezza', 'security testing', 'scenario testing', 'red team', 'analisi vulnerabilità', 'programma test'],
    rag_validation_keywords: ['articolo 24', 'art. 24', 'art 24'],
    gap_description_it: 'Non è documentato un programma di test di resilienza operativa digitale conforme agli Articoli 24-25 DORA con vulnerability assessment e penetration test periodici.',
    gap_description_en: 'No digital operational resilience testing program compliant with Articles 24-25 DORA with periodic vulnerability assessments and penetration tests was documented.',
    recommended_action_it: 'Definire un programma annuale di test di resilienza con VA/PT periodici, test di scenario, analisi open source e reportistica verso il management.',
    recommended_action_en: 'Define an annual resilience testing program with periodic VA/PT, scenario testing, open source analysis and management reporting.',
    action_hours: 48,
    action_cost_eur: 4080,
    coverage_threshold: 0.15,
    min_keyword_matches: 2,
  },
  {
    id: 'dora_art26_27_tlpt',
    regulation: 'DORA',
    reference: 'Articoli 26-27 DORA - TLPT (Threat-Led Penetration Testing)',
    description_it: 'Le entità finanziarie identificate devono effettuare test di penetrazione basati su minacce (TLPT) almeno ogni 3 anni utilizzando tester esterni qualificati e coprendo funzioni critiche.',
    description_en: 'Identified financial entities must carry out threat-led penetration testing (TLPT) at least every 3 years using qualified external testers and covering critical functions.',
    risk_level: 'critical',
    remediation_effort: 'very_high',
    coverage_keywords: ['tlpt', 'threat-led penetration testing', 'test basato minacce', 'threat intelligence', 'red teaming', 'purple team', 'tester esterni', 'external testers', 'tiber', 'funzioni critiche', 'simulazione attacco'],
    rag_validation_keywords: ['articolo 26', 'art. 26', 'art 26'],
    gap_description_it: 'Non è documentato un programma TLPT (Threat-Led Penetration Testing) conforme agli Articoli 26-27 DORA con tester esterni qualificati e copertura delle funzioni critiche.',
    gap_description_en: 'No TLPT (Threat-Led Penetration Testing) program compliant with Articles 26-27 DORA with qualified external testers and critical function coverage was documented.',
    recommended_action_it: 'Pianificare e condurre test TLPT triennali con provider qualificati, definire scope basato su threat intelligence, coinvolgere le funzioni critiche e reportare alle autorità.',
    recommended_action_en: 'Plan and conduct triennial TLPT tests with qualified providers, define scope based on threat intelligence, involve critical functions and report to authorities.',
    action_hours: 120,
    action_cost_eur: 10200,
    coverage_threshold: 0.15,
    min_keyword_matches: 2,
  },

  // ===== CRA (Cyber Resilience Act) — Nuova normativa =====
  {
    id: 'cra_art6_annex1_essential_requirements',
    regulation: 'CRA',
    reference: 'Articolo 6 + Allegato I CRA - Requisiti essenziali di cybersecurity',
    description_it: 'I prodotti con elementi digitali devono soddisfare i requisiti essenziali di cybersecurity dell\'Allegato I, tra cui protezione da accessi non autorizzati, integrità dei dati, disponibilità, minimizzazione delle superfici di attacco e sicurezza by design.',
    description_en: 'Products with digital elements must meet the essential cybersecurity requirements of Annex I, including protection against unauthorized access, data integrity, availability, attack surface minimization and security by design.',
    risk_level: 'critical',
    remediation_effort: 'very_high',
    coverage_keywords: ['requisiti essenziali', 'essential requirements', 'sicurezza by design', 'security by design', 'superficie attacco', 'attack surface', 'integrità dati', 'data integrity', 'accesso non autorizzato', 'unauthorized access', 'allegato I', 'annex I', 'elementi digitali'],
    rag_validation_keywords: ['articolo 6', 'art. 6', 'art 6'],
    gap_description_it: 'Non è documentata la conformità ai requisiti essenziali di cybersecurity dell\'Allegato I del CRA per i prodotti con elementi digitali.',
    gap_description_en: 'Compliance with Annex I essential cybersecurity requirements of the CRA for products with digital elements is not documented.',
    recommended_action_it: 'Effettuare una gap analysis dei prodotti rispetto ai requisiti dell\'Allegato I CRA, implementare sicurezza by design, minimizzazione superfici di attacco e protezione dati.',
    recommended_action_en: 'Perform a product gap analysis against CRA Annex I requirements, implement security by design, attack surface minimization and data protection.',
    action_hours: 120,
    action_cost_eur: 10200,
  },
  {
    id: 'cra_art10_manufacturer_obligations',
    regulation: 'CRA',
    reference: 'Articolo 10 CRA - Obblighi dei fabbricanti',
    description_it: 'I fabbricanti devono garantire che i prodotti siano progettati e sviluppati conformemente ai requisiti essenziali, effettuare valutazioni di conformità, redigere documentazione tecnica e applicare la marcatura CE.',
    description_en: 'Manufacturers must ensure products are designed and developed in compliance with essential requirements, carry out conformity assessments, draw up technical documentation and affix CE marking.',
    risk_level: 'critical',
    remediation_effort: 'very_high',
    coverage_keywords: ['obblighi fabbricanti', 'manufacturer obligations', 'valutazione conformità', 'conformity assessment', 'documentazione tecnica', 'technical documentation', 'marcatura ce', 'ce marking', 'dichiarazione conformità', 'declaration of conformity', 'ciclo vita prodotto'],
    rag_validation_keywords: ['articolo 10', 'art. 10', 'art 10'],
    gap_description_it: 'Non sono documentati gli obblighi del fabbricante ai sensi dell\'Articolo 10 CRA: valutazione conformità, documentazione tecnica, marcatura CE e supporto sicurezza.',
    gap_description_en: 'Manufacturer obligations under Article 10 CRA are not documented: conformity assessment, technical documentation, CE marking and security support.',
    recommended_action_it: 'Implementare un processo di conformità CRA per fabbricanti: valutazione rischi prodotto, documentazione tecnica, procedura di marcatura CE e piano di supporto sicurezza.',
    recommended_action_en: 'Implement a CRA compliance process for manufacturers: product risk assessment, technical documentation, CE marking procedure and security support plan.',
    action_hours: 100,
    action_cost_eur: 8500,
  },
  {
    id: 'cra_art11_vulnerability_reporting',
    regulation: 'CRA',
    reference: 'Articolo 11 CRA - Segnalazione delle vulnerabilità',
    description_it: 'I fabbricanti devono notificare all\'ENISA le vulnerabilità attivamente sfruttate entro 24 ore dalla conoscenza e pubblicare advisory di sicurezza senza indebito ritardo.',
    description_en: 'Manufacturers must notify ENISA of actively exploited vulnerabilities within 24 hours of awareness and publish security advisories without undue delay.',
    risk_level: 'critical',
    remediation_effort: 'high',
    coverage_keywords: ['segnalazione vulnerabilità', 'vulnerability reporting', 'vulnerabilità sfruttate', 'exploited vulnerabilities', 'enisa', 'notifica vulnerabilità', 'advisory sicurezza', 'security advisory', '24 ore', 'coordinated disclosure', 'responsible disclosure'],
    rag_validation_keywords: ['articolo 11', 'art. 11', 'art 11'],
    gap_description_it: 'Non è documentata una procedura di segnalazione delle vulnerabilità all\'ENISA conforme all\'Articolo 11 CRA con tempistica di 24 ore e pubblicazione advisory.',
    gap_description_en: 'No vulnerability reporting procedure to ENISA compliant with Article 11 CRA with 24-hour timeline and advisory publication was documented.',
    recommended_action_it: 'Definire una procedura di vulnerability disclosure con notifica ENISA entro 24h, processo di triage, pubblicazione advisory e coordinamento con i clienti.',
    recommended_action_en: 'Define a vulnerability disclosure procedure with ENISA notification within 24h, triage process, advisory publication and customer coordination.',
    action_hours: 36,
    action_cost_eur: 3060,
  },
  {
    id: 'cra_art13_importer_obligations',
    regulation: 'CRA',
    reference: 'Articolo 13 CRA - Obblighi degli importatori',
    description_it: 'Gli importatori devono immettere sul mercato solo prodotti conformi ai requisiti essenziali, verificare che il fabbricante abbia effettuato la valutazione di conformità e che la documentazione tecnica sia disponibile.',
    description_en: 'Importers must place on the market only products meeting essential requirements, verify that the manufacturer has carried out the conformity assessment and that technical documentation is available.',
    risk_level: 'high',
    remediation_effort: 'medium',
    coverage_keywords: ['obblighi importatori', 'importer obligations', 'verifica conformità', 'compliance verification', 'immissione mercato', 'market placement', 'documentazione importatore', 'dichiarazione conformità ue', 'etichettatura', 'labeling'],
    rag_validation_keywords: ['articolo 13', 'art. 13', 'art 13'],
    gap_description_it: 'Non è documentata una procedura per gli obblighi degli importatori ai sensi dell\'Articolo 13 CRA con verifica conformità e documentazione tecnica.',
    gap_description_en: 'No procedure for importer obligations under Article 13 CRA with compliance verification and technical documentation was documented.',
    recommended_action_it: 'Definire checklist di verifica per importatori: controllo marcatura CE, dichiarazione di conformità UE, documentazione tecnica e informazioni di contatto fabbricante.',
    recommended_action_en: 'Define verification checklist for importers: CE marking check, EU declaration of conformity, technical documentation and manufacturer contact information.',
    action_hours: 20,
    action_cost_eur: 1700,
  },
  {
    id: 'cra_art14_distributor_obligations',
    regulation: 'CRA',
    reference: 'Articolo 14 CRA - Obblighi dei distributori',
    description_it: 'I distributori devono verificare che il prodotto rechi la marcatura CE e sia accompagnato dalla documentazione richiesta, e non immettere sul mercato prodotti che ritengano non conformi.',
    description_en: 'Distributors must verify that the product bears CE marking and is accompanied by required documentation, and must not place on the market products they believe to be non-compliant.',
    risk_level: 'medium',
    remediation_effort: 'low',
    coverage_keywords: ['obblighi distributori', 'distributor obligations', 'marcatura ce', 'ce marking', 'documentazione accompagnamento', 'condizioni stoccaggio', 'storage conditions', 'trasporto', 'non conformità', 'ritiro mercato', 'market withdrawal'],
    rag_validation_keywords: ['articolo 14', 'art. 14', 'art 14'],
    gap_description_it: 'Non è documentata una procedura per gli obblighi dei distributori ai sensi dell\'Articolo 14 CRA con verifica marcatura CE e gestione non conformità.',
    gap_description_en: 'No procedure for distributor obligations under Article 14 CRA with CE marking verification and non-compliance management was documented.',
    recommended_action_it: 'Implementare checklist di verifica per distributori: controllo marcatura CE, documentazione, condizioni di stoccaggio e procedura di segnalazione non conformità.',
    recommended_action_en: 'Implement verification checklist for distributors: CE marking check, documentation, storage conditions and non-compliance reporting procedure.',
    action_hours: 12,
    action_cost_eur: 1020,
  },
];
// ============================================================

// ============================================================
// RISK PROFILE
// Il profilo di rischio di un gap nasce da due elementi:
//  - la gravità dell'obbligo violato (severity, dal catalogo: dipende da
//    natura dell'obbligo e fascia sanzionatoria della normativa)
//  - lo stato della documentazione (missing = nessuna evidenza,
//    partial = documentazione presente ma incompleta)
// Il risultato è un livello a tre colori: high (rosso), medium (arancione), low (giallo).
// I requisiti coperti restano fuori dai gap (verde).
// ============================================================

type CheckStatus = 'covered' | 'partial' | 'missing' | 'to_verify' | 'not_applicable';
type RiskProfile = 'high' | 'medium' | 'low';

interface RequirementCheck {
  requirement_id: string;
  regulation: string;
  reference: string;
  description: string;
  severity: string;
  remediation_effort: string;
  conditional: boolean;
  status: CheckStatus;
  risk_level: RiskProfile | null;
  assessment: string;
  evidence: Array<{ document: string; quote: string }>;
  missing_elements: string[];
  recommended_actions: string[];
  confidence: number | null;
  method: 'llm_evidence' | 'keyword' | 'semantic';
  keyword_coverage: number;
}

const CHECKS_VERSION = 'gap-analysis-v19-evidence-checks';
const SEVERITY_RANK: Record<string, number> = { critical: 3, high: 2, medium: 1, low: 0 };
const RISK_SCORE_MAP: Record<string, number> = { high: 74, medium: 52, low: 28 };

function riskProfileFor(severity: string, status: CheckStatus): RiskProfile | null {
  if (status !== 'missing' && status !== 'partial') return null;
  const base = SEVERITY_RANK[severity] ?? 1;
  const rank = status === 'partial' ? Math.max(0, base - 1) : base;
  return rank >= 2 ? 'high' : rank === 1 ? 'medium' : 'low';
}

const PRIORITY_MATRIX: Record<string, Record<string, number>> = {
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

function evidenceExpectedFor(req: RegulatoryRequirement): string {
  return EVIDENCE_EXPECTED_IT[req.id] || req.description_it;
}

// Normalizzazione per la verifica delle citazioni
function normalizeQuote(text: string): string {
  return (text || '')
    .toLowerCase()
    .replace(/[‘’“”'"«»]/g, '')
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

// Una citazione è verificata se compare nei documenti (intera, oppure una finestra di 6 parole consecutive)
function quoteIsVerified(quote: string, corpusNormalized: string): boolean {
  const q = normalizeQuote(quote);
  if (q.length < 12) return false;
  if (corpusNormalized.includes(q)) return true;
  const words = q.split(' ').filter(Boolean);
  if (words.length < 6) return false;
  for (let i = 0; i + 6 <= words.length; i++) {
    if (corpusNormalized.includes(words.slice(i, i + 6).join(' '))) return true;
  }
  return false;
}

// Stima se un testo è leggibile (documenti PDF/DOC non estratti correttamente producono rumore binario).
// Restituisce la quota di parole "vere" (solo lettere) penalizzata dai caratteri tipici del rumore binario.
// Testo italiano/inglese: 0.65-0.97; fogli di calcolo: ~0.45; PDF o DOC non estratti: < 0.05.
const READABLE_THRESHOLD = 0.35;
function readableRatio(text: string): number {
  if (!text) return 0;
  const sample = text.substring(0, 6000);
  const tokens = sample.split(/\s+/).filter(Boolean);
  if (tokens.length < 5) return 0;
  const wordRe = /^[("'«\[]?[a-zA-ZàèéìíòóùúÀÈÉÌÒÓÙçÇ]{2,25}[.,;:!?)»\]"']{0,2}$/;
  const good = tokens.filter(t => wordRe.test(t)).length;
  const ratio = good / tokens.length;
  const odd = (sample.match(/[\u00ff\u00fe\u00f0\u00d8\u00d0\u00cd\u00ce\u00d2\u00db\u00cb\u00e5\u0000-\u0008\u000e-\u001f\ufffd]/g) || []).length / Math.max(1, sample.length);
  return Math.max(0, ratio - odd * 3);
}

function extractJsonObjectFromText(text: string): any | null {
  if (!text) return null;
  const cleaned = text.replace(/```json|```/gi, '').trim();
  try { return JSON.parse(cleaned); } catch { /* continue */ }
  const start = cleaned.indexOf('{');
  const end = cleaned.lastIndexOf('}');
  if (start >= 0 && end > start) {
    try { return JSON.parse(cleaned.substring(start, end + 1)); } catch { return null; }
  }
  return null;
}

interface EvidenceSection { text: string; norm: string; docName: string; embedding: number[] | null }

// Seleziona gli estratti più pertinenti per un requisito: similarità semantica + presenza di parole chiave
function selectEvidenceForRequirement(
  req: RegulatoryRequirement,
  reqEmbedding: number[] | null,
  sections: EvidenceSection[],
  maxChars: number,
): Array<{ docName: string; text: string; score: number }> {
  const normKeywords = Array.from(new Set(req.coverage_keywords.map(k => normalizeForMatch(k)).filter(k => k.length >= 3)));
  const scored = sections.map((s) => {
    const kwHits = normKeywords.filter(k => s.norm.includes(k)).length;
    const sim = reqEmbedding && s.embedding ? cosineSimilarity(reqEmbedding, s.embedding) : 0;
    return { docName: s.docName, text: s.text, score: sim + Math.min(0.3, kwHits * 0.08), sim, kwHits };
  });
  scored.sort((a, b) => b.score - a.score);
  const picked: Array<{ docName: string; text: string; score: number }> = [];
  let used = 0;
  for (const s of scored) {
    if (picked.length >= 10) break;
    if (s.sim < 0.25 && s.kwHits === 0) continue;
    if (used + s.text.length > maxChars) continue;
    picked.push({ docName: s.docName, text: s.text, score: s.score });
    used += s.text.length;
  }
  return picked;
}

// Valutazione documentale di un gruppo di requisiti tramite LLM (temperatura 0, JSON).
async function assessRequirementBatchWithLLM(
  apiKey: string,
  batch: Array<{ req: RegulatoryRequirement; evidence: Array<{ docName: string; text: string }> }>,
  language: string,
  profile: any,
  documentNames: string[],
): Promise<Map<string, any>> {
  const isIt = language === 'it';
  const systemPrompt = `Sei un auditor di protezione dei dati e conformità normativa. Valuti se la documentazione di un'organizzazione soddisfa requisiti normativi specifici basandoti ESCLUSIVAMENTE sugli estratti forniti.
Settore dell'organizzazione: ${profile?.sector || 'non indicato'}. Giurisdizione: ${profile?.jurisdiction || 'IT'}.

Rispondi SOLO con un oggetto JSON valido con questa forma:
{"checks":[{"requirement_id":"...","status":"covered|partial|missing|not_applicable","assessment":"...","evidence":[{"document":"nome del file","quote":"citazione testuale"}],"missing_elements":["..."],"recommended_actions":["..."],"confidence":0.0}]}

Criteri per status:
- "covered": gli estratti dimostrano che il requisito è soddisfatto nella sostanza: esiste il documento atteso e contiene gli elementi obbligatori indicati.
- "partial": esiste documentazione pertinente ma mancano elementi obbligatori, oppure è generica, o copre solo una parte del requisito. Elenca in missing_elements cosa manca, in modo specifico.
- "missing": nessun estratto pertinente al requisito.
- "not_applicable": SOLO per requisiti marcati come condizionali e SOLO se gli estratti dichiarano esplicitamente che la condizione non ricorre (es. "non si effettuano trasferimenti extra UE"). L'assenza di informazioni NON rende un requisito non applicabile: in quel caso usa "missing".

Regole sulle prove:
- Ogni citazione in evidence deve essere copiata parola per parola da un estratto (massimo 200 caratteri) e attribuita al file corretto.
- Il nome di un file non è una prova del suo contenuto. Testo illeggibile, codice binario o metadati di file non sono evidenze.
- Uno status "covered" richiede almeno una citazione pertinente.

Regole sul testo:
- "assessment": 2 o 3 frasi in ${isIt ? 'italiano' : 'inglese'}, in terza persona, che dicono cosa risulta documentato (citando il nome del documento) e cosa manca. Niente frasi generiche, niente riferimenti ad articoli diversi da quello del requisito.
- "recommended_actions": da 1 a 3 azioni concrete e specifiche per colmare esattamente ciò che manca (es. "Integrare il registro con i termini di conservazione per ciascun trattamento"). Nessuna stima di ore o costi. Se lo status è "covered", al massimo un'azione di mantenimento o nessuna.
- "confidence": da 0 a 1, quanto sei sicuro del giudizio dati gli estratti.
Non inventare contenuti assenti dagli estratti. Restituisci un elemento per ogni requisito ricevuto, nello stesso ordine.`;

  const userParts = batch.map(({ req, evidence }, idx) => {
    const evidenceText = evidence.length > 0
      ? evidence.map((e, i) => `[Estratto ${i + 1} | file: ${e.docName}]\n${e.text}`).join('\n\n')
      : '(nessun estratto pertinente trovato nei documenti caricati)';
    return `### Requisito ${idx + 1}
requirement_id: ${req.id}
Riferimento: ${req.reference}
Obbligo: ${req.description_it}
Cosa deve risultare dalla documentazione: ${evidenceExpectedFor(req)}
${req.conditional ? `Requisito CONDIZIONALE. ${req.applicability_note_it || ''}` : 'Requisito applicabile a tutte le organizzazioni.'}

Estratti dai documenti dell'organizzazione:
${evidenceText}`;
  });

  const userMessage = `Documenti caricati dall'organizzazione (${documentNames.length}): ${documentNames.join(' | ')}

${userParts.join('\n\n==========\n\n')}`;

  const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: 'google/gemini-3-pro-preview',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userMessage },
      ],
      temperature: 0,
      max_tokens: 8000,
      reasoning_effort: 'low',
      response_format: { type: 'json_object' },
    }),
  });

  if (!response.ok) {
    const errText = await response.text().catch(() => '');
    throw new Error(`LLM assessment API error ${response.status}: ${errText.substring(0, 300)}`);
  }
  const data = await response.json();
  const content = data.choices?.[0]?.message?.content || '';
  const parsed = extractJsonObjectFromText(typeof content === 'string' ? content : JSON.stringify(content));
  const list: any[] = Array.isArray(parsed?.checks) ? parsed.checks : Array.isArray(parsed) ? parsed : [];
  const map = new Map<string, any>();
  for (const item of list) {
    if (item && typeof item.requirement_id === 'string') map.set(item.requirement_id, item);
  }
  // Fallback positional matching when the model omits ids
  if (map.size === 0 && list.length === batch.length) {
    list.forEach((item, i) => map.set(batch[i].req.id, item));
  }
  return map;
}

async function runWithConcurrency<T>(tasks: Array<() => Promise<T>>, limit: number): Promise<T[]> {
  const results: T[] = new Array(tasks.length);
  let next = 0;
  async function worker() {
    while (next < tasks.length) {
      const idx = next++;
      results[idx] = await tasks[idx]();
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, tasks.length) }, () => worker()));
  return results;
}

// ============================================================
// MAIN HANDLER
// ============================================================

denoServe(protect(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) throw new Error('Missing authorization header');

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: userError } = await supabase.auth.getUser(token);
    if (userError || !user) throw new Error('Unauthorized');

    const body = await req.json();
    const { assessmentId, userDocuments, regulations, language = 'it' } = body;

    // --- Input validation ---
    if (!assessmentId || typeof assessmentId !== 'string') {
      return errorResponse(400, 'Invalid or missing assessmentId');
    }
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(assessmentId)) {
      return errorResponse(400, 'Invalid assessmentId format');
    }
    if (!Array.isArray(userDocuments) || userDocuments.length === 0) {
      return errorResponse(400, 'userDocuments must be a non-empty array');
    }
    if (userDocuments.length > 50) {
      return errorResponse(400, 'Too many documents (max 50)');
    }
    if (!Array.isArray(regulations) || regulations.length === 0) {
      return errorResponse(400, 'regulations must be a non-empty array');
    }

    console.log('Starting evidence-based gap analysis for assessment:', assessmentId);

    // --- Canonicalize inputs ---
    const normalizedLanguage = canonicalizeString(language || 'it').toLowerCase() || 'it';
    const normalizedRegulations = [...new Set(regulations.map((r: string) => canonicalizeString(r)))]
      .filter(Boolean).sort((a, b) => a.localeCompare(b));
    const normalizedDocuments = normalizeUserDocuments(userDocuments);

    if (normalizedRegulations.length === 0) return errorResponse(400, 'No valid regulations after normalization');
    if (normalizedDocuments.length === 0) return errorResponse(400, 'No valid user documents after normalization');

    // --- Assessment context ---
    const { data: assessment } = await supabase
      .from('compliance_assessments')
      .select('id, annual_revenue_eur')
      .eq('id', assessmentId).eq('user_id', user.id).maybeSingle();

    const { data: profile } = await supabase
      .from('profiles').select('*').eq('id', user.id).maybeSingle();

    // --- Deterministic cache layer ---
    const cacheFingerprint = await generateCacheFingerprint(
      normalizedRegulations, normalizedDocuments, normalizedLanguage, profile, assessment?.annual_revenue_eur
    );
    console.log('Cache fingerprint:', cacheFingerprint);

    const { data: cachedResult } = await supabase
      .from('gap_analysis_cache').select('result_payload')
      .eq('user_id', user.id).eq('cache_key', cacheFingerprint).maybeSingle();

    // Requirements scope (strictly limited to selected regulations)
    const applicableRequirements: RegulatoryRequirement[] = REQUIREMENTS_CATALOG.filter(req =>
      normalizedRegulations.some(reg => reg.toLowerCase() === req.regulation.toLowerCase())
    );

    // Merge dynamic requirements from database (active only)
    try {
      const { data: dbRequirements } = await supabase
        .from('regulatory_requirements')
        .select('*')
        .eq('active', true);

      if (dbRequirements && dbRequirements.length > 0) {
        const existingKeys = new Set(applicableRequirements.map(r => `${r.regulation.toLowerCase()}:${r.reference.toLowerCase()}`));
        let added = 0;

        for (const dbReq of dbRequirements) {
          // Only include if regulation matches AND not already in hardcoded catalog
          if (!normalizedRegulations.some(reg => reg.toLowerCase() === dbReq.regulation.toLowerCase())) continue;
          const key = `${dbReq.regulation.toLowerCase()}:${dbReq.reference.toLowerCase()}`;
          if (existingKeys.has(key)) continue;

          applicableRequirements.push({
            id: dbReq.requirement_id,
            regulation: dbReq.regulation,
            reference: dbReq.reference,
            description_it: dbReq.description_it,
            description_en: dbReq.description_en,
            risk_level: dbReq.risk_level as any,
            remediation_effort: dbReq.remediation_effort as any,
            coverage_keywords: dbReq.coverage_keywords || [],
            rag_validation_keywords: dbReq.rag_validation_keywords || [],
            gap_description_it: dbReq.gap_description_it,
            gap_description_en: dbReq.gap_description_en,
            recommended_action_it: dbReq.recommended_action_it,
            recommended_action_en: dbReq.recommended_action_en,
            action_hours: dbReq.action_hours,
            action_cost_eur: dbReq.action_cost_eur,
            coverage_threshold: dbReq.coverage_threshold || 0.10,
            min_keyword_matches: dbReq.min_keyword_matches || 1,
          });
          existingKeys.add(key);
          added++;
        }
        if (added > 0) {
          console.log(`📊 Added ${added} dynamic requirements from database`);
        }
      }
    } catch (dbErr) {
      console.warn('Could not fetch dynamic requirements:', dbErr);
    }

    console.log(`Applicable requirements: ${applicableRequirements.length} for regulations: ${normalizedRegulations.join(', ')}`);

    // ============================================================
    // REQUIREMENT CHECKS
    // Ogni requisito applicabile riceve un giudizio documentale:
    // covered / partial / missing / to_verify / not_applicable.
    // Il giudizio è prodotto da un auditor AI che legge SOLO gli estratti
    // dei documenti caricati (con citazioni verificate a posteriori);
    // in caso di indisponibilità dell'AI si applica la regola a parole chiave.
    // ============================================================
    const isIt = normalizedLanguage === 'it';
    const readableDocuments = normalizedDocuments.filter(d => readableRatio(d.content) >= READABLE_THRESHOLD);
    const unreadableDocuments = normalizedDocuments.filter(d => readableRatio(d.content) < READABLE_THRESHOLD).map(d => d.name);
    if (unreadableDocuments.length > 0) {
      console.warn(`⚠️ ${unreadableDocuments.length} documents look unreadable (binary noise) and are excluded from evidence: ${unreadableDocuments.join(', ')}`);
    }

    let checks: RequirementCheck[];
    const cachedChecks = cachedResult?.result_payload?.version === CHECKS_VERSION && Array.isArray(cachedResult?.result_payload?.checks)
      ? cachedResult.result_payload.checks as RequirementCheck[]
      : null;

    if (cachedChecks) {
      console.log('✅ CACHE HIT - returning cached requirement checks');
      checks = cachedChecks;
    } else {
      console.log('❌ CACHE MISS - running evidence-based requirement checks...');

      // 1) Corpus dei documenti leggibili (per parole chiave e verifica citazioni)
      const userCorpus = readableDocuments.map(d => `${d.name} ${d.content}`.toLowerCase()).join(' \n ');
      const corpusNormalized = normalizeQuote(readableDocuments.map(d => d.content).join(' \n '));

      // 2) Il requisito deve esistere nella knowledge base normativa della sua normativa
      const ragValidationCache = await buildRagValidationCache(supabase, normalizedRegulations);
      console.log(`RAG validation cache: ${Array.from(ragValidationCache.values()).reduce((s, set) => s + set.size, 0)} entries across ${ragValidationCache.size} regulations`);
      const validatedRequirements = applicableRequirements.filter(req => {
        const regCache = ragValidationCache.get(req.regulation.toLowerCase());
        const ok = regCache && req.rag_validation_keywords.some(kw => regCache.has(kw.toLowerCase()));
        if (!ok) console.log(`Skipping ${req.id}: not found in RAG knowledge base for regulation ${req.regulation}`);
        return ok;
      });

      // 3) Sezioni granulari dei documenti + embedding (cache su user_document_embeddings)
      const geminiKey = Deno.env.get('GEMINI_API_KEY');
      const sections: EvidenceSection[] = [];
      for (const doc of readableDocuments) {
        for (const s of splitIntoSections(`${doc.name}: ${doc.content}`, 600)) {
          if (s.trim().length >= 50) sections.push({ text: s, norm: normalizeForMatch(s), docName: doc.name, embedding: null });
        }
      }
      console.log(`📐 ${readableDocuments.length} readable documents split into ${sections.length} sections`);

      if (geminiKey && sections.length > 0) {
        try {
          const { data: cached } = await supabase
            .from('user_document_embeddings')
            .select('section_text, embedding, section_index')
            .eq('assessment_id', assessmentId)
            .order('section_index', { ascending: true });
          const cachedByText = new Map<string, number[]>();
          for (const row of cached || []) {
            let emb: any = row.embedding;
            if (typeof emb === 'string') { try { emb = JSON.parse(emb); } catch { emb = null; } }
            if (Array.isArray(emb) && emb.length === GAP_EMBEDDING_DIMENSIONS) cachedByText.set(row.section_text, emb);
          }
          const missing = sections.filter(s => !cachedByText.has(s.text));
          if (missing.length > 0) {
            console.log(`📐 Generating ${missing.length} section embeddings (${sections.length - missing.length} cached)`);
            const fresh = await generateBatchEmbeddingsForGap(geminiKey, missing.map(s => s.text));
            missing.forEach((s, i) => { s.embedding = fresh[i] || null; });
            // Persist for future runs of the same assessment
            await supabase.from('user_document_embeddings').delete().eq('assessment_id', assessmentId);
            const rows = sections.map((s, idx) => ({
              user_id: user.id,
              assessment_id: assessmentId,
              document_name: s.docName,
              section_text: s.text,
              section_index: idx,
              embedding: JSON.stringify(s.embedding || cachedByText.get(s.text) || []),
            })).filter(r => r.embedding.length > 2);
            for (let b = 0; b < rows.length; b += 20) {
              await supabase.from('user_document_embeddings').insert(rows.slice(b, b + 20));
            }
          }
          for (const s of sections) if (!s.embedding) s.embedding = cachedByText.get(s.text) || null;
          console.log(`📐 Section embeddings ready: ${sections.filter(s => s.embedding).length}/${sections.length}`);
        } catch (e) {
          console.error('Section embeddings unavailable, evidence selection will use keywords only:', e);
        }
      }

      // 4) Embedding dei requisiti (per selezionare gli estratti pertinenti)
      let reqEmbeddings: Array<number[] | null> = validatedRequirements.map(() => null);
      if (geminiKey && sections.some(s => s.embedding)) {
        try {
          const reqTexts = validatedRequirements.map(r => `${r.reference}. ${r.description_it} ${evidenceExpectedFor(r)}`.substring(0, 4000));
          reqEmbeddings = await generateBatchEmbeddingsForGap(geminiKey, reqTexts);
        } catch (e) {
          console.error('Requirement embeddings failed:', e);
        }
      }

      // 5) Analisi a parole chiave (sempre disponibile: serve come fallback e come segnale)
      const keywordInfo = new Map<string, { covered: string[]; ratio: number }>();
      for (const req of validatedRequirements) {
        const covered = getCoveredKeywords(userCorpus, req.coverage_keywords);
        const unique = Math.max(1, getUniqueKeywordCount(req.coverage_keywords));
        keywordInfo.set(req.id, { covered, ratio: covered.length / unique });
      }

      // 6) Valutazione documentale AI a lotti
      const aiKey = getAIKey();
      const llmResults = new Map<string, any>();
      if (aiKey && validatedRequirements.length > 0) {
        const batches: Array<Array<{ req: RegulatoryRequirement; evidence: Array<{ docName: string; text: string }> }>> = [];
        const BATCH_SIZE = 5;
        for (let i = 0; i < validatedRequirements.length; i += BATCH_SIZE) {
          const slice = validatedRequirements.slice(i, i + BATCH_SIZE);
          batches.push(slice.map((req) => {
            const idx = validatedRequirements.indexOf(req);
            const evidence = selectEvidenceForRequirement(req, reqEmbeddings[idx], sections, 6000)
              .map(e => ({ docName: e.docName, text: e.text }));
            return { req, evidence };
          }));
        }
        const documentNames = readableDocuments.map(d => d.name);
        const results = await runWithConcurrency(batches.map((batch) => async () => {
          for (let attempt = 1; attempt <= 2; attempt++) {
            try {
              const map = await assessRequirementBatchWithLLM(aiKey, batch, normalizedLanguage, profile, documentNames);
              if (map.size > 0) return map;
              console.warn(`LLM batch returned no checks (attempt ${attempt})`);
            } catch (e) {
              console.error(`LLM batch failed (attempt ${attempt}):`, e instanceof Error ? e.message : e);
            }
          }
          return new Map<string, any>();
        }), 3);
        for (const map of results) for (const [k, v] of map) llmResults.set(k, v);
        console.log(`🤖 LLM assessed ${llmResults.size}/${validatedRequirements.length} requirements`);
      } else if (!aiKey) {
        console.log('⚠️ AI key not available, using keyword rules only');
      }

      // 7) Consolidamento dei giudizi
      const allowedStatuses = new Set(['covered', 'partial', 'missing', 'not_applicable']);
      checks = validatedRequirements.map((req) => {
        const kw = keywordInfo.get(req.id) || { covered: [], ratio: 0 };
        const llm = llmResults.get(req.id);
        const base = {
          requirement_id: req.id,
          regulation: req.regulation,
          reference: req.reference,
          description: isIt ? req.description_it : req.description_en,
          severity: req.risk_level,
          remediation_effort: req.remediation_effort,
          conditional: !!req.conditional,
          keyword_coverage: Math.round(kw.ratio * 100) / 100,
        };

        if (llm && allowedStatuses.has(String(llm.status))) {
          let status = String(llm.status) as CheckStatus;
          const rawEvidence: any[] = Array.isArray(llm.evidence) ? llm.evidence : [];
          const evidence = rawEvidence
            .filter(e => e && typeof e.quote === 'string')
            .map(e => ({ document: String(e.document || '').substring(0, 200), quote: String(e.quote).substring(0, 300) }))
            .filter(e => quoteIsVerified(e.quote, corpusNormalized))
            .slice(0, 5);
          const missingElements: string[] = (Array.isArray(llm.missing_elements) ? llm.missing_elements : [])
            .filter((m: any) => typeof m === 'string' && m.trim()).map((m: string) => m.trim().substring(0, 300)).slice(0, 8);
          let actions: string[] = (Array.isArray(llm.recommended_actions) ? llm.recommended_actions : [])
            .filter((a: any) => typeof a === 'string' && a.trim()).map((a: string) => a.trim().substring(0, 500)).slice(0, 3);
          let assessment = typeof llm.assessment === 'string' ? llm.assessment.trim().substring(0, 1200) : '';

          // Grounding: "covered" senza citazioni verificate diventa "partial"
          if (status === 'covered' && evidence.length === 0) {
            status = 'partial';
            missingElements.unshift(isIt
              ? 'Le evidenze indicate non sono state ritrovate testualmente nei documenti: verificare che il contenuto sia effettivamente presente.'
              : 'The cited evidence could not be found verbatim in the documents: verify that the content is actually present.');
          }
          // not_applicable ammesso solo per requisiti condizionali
          if (status === 'not_applicable' && !req.conditional) status = 'missing';
          // Requisito condizionale senza alcuna evidenza: non è un gap certo, va verificato
          if (req.conditional && status === 'missing' && evidence.length === 0) status = 'to_verify';

          if (actions.length === 0 && (status === 'missing' || status === 'partial')) {
            actions = [isIt ? req.recommended_action_it : req.recommended_action_en];
          }
          if (!assessment) {
            assessment = status === 'missing'
              ? (isIt ? 'Nessuna documentazione pertinente individuata nei documenti caricati.' : 'No relevant documentation found in the uploaded documents.')
              : status === 'to_verify'
              ? (isIt ? 'Dalla documentazione non risulta se il requisito si applica all\'organizzazione.' : 'The documentation does not show whether the requirement applies to the organisation.')
              : '';
          }

          return {
            ...base,
            status,
            risk_level: riskProfileFor(req.risk_level, status),
            assessment,
            evidence,
            missing_elements: missingElements,
            recommended_actions: actions,
            confidence: typeof llm.confidence === 'number' ? Math.max(0, Math.min(1, llm.confidence)) : null,
            method: 'llm_evidence' as const,
          };
        }

        // Fallback deterministico a parole chiave
        const threshold = req.coverage_threshold || 0.10;
        const minMatches = req.min_keyword_matches || 1;
        const covered = kw.covered.length >= minMatches && kw.ratio >= threshold;
        let status: CheckStatus = covered ? 'covered' : 'missing';
        if (!covered && req.conditional && kw.covered.length === 0) status = 'to_verify';
        return {
          ...base,
          status,
          risk_level: riskProfileFor(req.risk_level, status),
          assessment: covered
            ? (isIt
              ? `Nei documenti caricati compaiono riferimenti al tema (${kw.covered.slice(0, 5).join(', ')}). Verifica basata su parole chiave: controllare che il contenuto sia completo.`
              : `The uploaded documents refer to the topic (${kw.covered.slice(0, 5).join(', ')}). Keyword-based check: verify that the content is complete.`)
            : kw.covered.length > 0
            ? (isIt
              ? `Documentazione parziale: compaiono solo alcuni riferimenti (${kw.covered.join(', ')}).`
              : `Partial documentation: only some references appear (${kw.covered.join(', ')}).`)
            : (isIt ? 'Nessuna documentazione pertinente individuata nei documenti caricati.' : 'No relevant documentation found in the uploaded documents.'),
          evidence: [],
          missing_elements: covered ? [] : [isIt ? req.gap_description_it : req.gap_description_en],
          recommended_actions: covered ? [] : [isIt ? req.recommended_action_it : req.recommended_action_en],
          confidence: null,
          method: 'keyword' as const,
        };
      });

      // Ordine deterministico
      checks.sort((a, b) => `${a.regulation}|${a.reference}`.localeCompare(`${b.regulation}|${b.reference}`));

      await supabase.from('gap_analysis_cache').upsert({
        user_id: user.id,
        cache_key: cacheFingerprint,
        input_fingerprint: cacheFingerprint,
        regulations: normalizedRegulations,
        language: normalizedLanguage,
        documents_count: normalizedDocuments.length,
        result_payload: { version: CHECKS_VERSION, checks, unreadable_documents: unreadableDocuments },
      }, { onConflict: 'user_id,cache_key' });
      console.log(`✅ Requirement checks cached (${checks.length} requirements)`);
    }

    const gapChecks = checks.filter(c => c.status === 'missing' || c.status === 'partial');
    const coveredCount = checks.filter(c => c.status === 'covered').length;
    const partialCount = checks.filter(c => c.status === 'partial').length;
    const missingCount = checks.filter(c => c.status === 'missing').length;
    const toVerifyCount = checks.filter(c => c.status === 'to_verify').length;
    const notApplicableCount = checks.filter(c => c.status === 'not_applicable').length;
    console.log(`Checks: ${coveredCount} covered, ${partialCount} partial, ${missingCount} missing, ${toVerifyCount} to verify, ${notApplicableCount} not applicable`);

    // --- Fonte normativa per tracciabilità ---
    let sourceChunks: Array<{ id: string; content: string; document_id: string }> = [];
    try {
      sourceChunks = await getRelevantRagChunkObjects(supabase, normalizedRegulations, 100);
    } catch (e) {
      console.error('Failed to fetch source chunks for traceability:', e);
    }

    function findSourceChunk(requirementRef: string): { chunk_id: string | null; excerpt: string | null } {
      if (!requirementRef || sourceChunks.length === 0) return { chunk_id: null, excerpt: null };
      const refLower = requirementRef.toLowerCase();
      const artMatch = refLower.match(/(?:articolo|articoli|art\.?|article)\s+(\d+)/i);
      if (artMatch) {
        const artNum = artMatch[1];
        const patterns = [`articolo ${artNum}`, `art. ${artNum}`, `art ${artNum}`, `article ${artNum}`];
        for (const chunk of sourceChunks) {
          const contentLower = (chunk.content || '').toLowerCase();
          if (patterns.some(p => contentLower.includes(p))) {
            return { chunk_id: chunk.id, excerpt: chunk.content.substring(0, 300) };
          }
        }
      }
      return { chunk_id: null, excerpt: null };
    }

    // --- Persistenza gap ---
    const gapsToInsert = gapChecks.map((c) => {
      const rl = c.risk_level || 'medium';
      const re = (c.remediation_effort || 'medium').toLowerCase();
      const sourceInfo = findSourceChunk(c.reference);
      const gapDescription = c.missing_elements.length > 0
        ? (isIt ? `Elementi mancanti: ${c.missing_elements.join('; ')}` : `Missing elements: ${c.missing_elements.join('; ')}`)
        : (isIt ? 'Nessuna documentazione pertinente individuata nei documenti caricati.' : 'No relevant documentation found in the uploaded documents.');
      return {
        assessment_id: assessmentId,
        requirement_reference: c.reference,
        requirement_description: c.description,
        current_state: c.assessment || null,
        gap_description: gapDescription,
        risk_level: rl,
        risk_score: RISK_SCORE_MAP[rl] ?? 52,
        potential_fine_eur: null,
        potential_fine_max_eur: null,
        fine_tier_basis: null,
        priority: PRIORITY_MATRIX[rl]?.[re] || 2,
        remediation_effort: re,
        recommended_actions: c.recommended_actions.map(a => ({ action: a })),
        source_chunk_id: sourceInfo.chunk_id,
        article_text_excerpt: sourceInfo.excerpt,
        detection_method: c.method,
        semantic_similarity: null,
        evidence: c.evidence,
        coverage_status: c.status,
        severity: c.severity,
      };
    });

    await supabase.from('action_plans').delete().eq('assessment_id', assessmentId);
    await supabase.from('identified_gaps').delete().eq('assessment_id', assessmentId);

    let insertedGaps: any[] = [];
    if (gapsToInsert.length > 0) {
      const { data, error: gapsError } = await supabase
        .from('identified_gaps').insert(gapsToInsert).select();
      if (gapsError) throw gapsError;
      insertedGaps = data || [];
    }

    // --- Punteggi complessivi ---
    const applicableCount = coveredCount + partialCount + missingCount;
    const overallCompliance = applicableCount === 0
      ? 100
      : Math.max(0, Math.min(100, Math.round(((coveredCount + 0.5 * partialCount) / applicableCount) * 100)));
    const highCount = gapsToInsert.filter(g => g.risk_level === 'high').length;
    const mediumCount = gapsToInsert.filter(g => g.risk_level === 'medium').length;
    const lowCount = gapsToInsert.filter(g => g.risk_level === 'low').length;
    const overallRisk = highCount > 0
      ? Math.min(95, 70 + highCount * 5)
      : mediumCount > 0
      ? Math.min(65, 40 + mediumCount * 4)
      : lowCount > 0
      ? Math.min(35, 15 + lowCount * 3)
      : 0;

    await supabase.from('compliance_assessments').update({
      overall_risk_score: overallRisk,
      overall_compliance_percentage: overallCompliance,
      requirement_checks: {
        version: CHECKS_VERSION,
        generated_at: new Date().toISOString(),
        unreadable_documents: unreadableDocuments,
        documents_analyzed: readableDocuments.map(d => d.name),
        counts: { covered: coveredCount, partial: partialCount, missing: missingCount, to_verify: toVerifyCount, not_applicable: notApplicableCount },
        checks,
      },
      status: 'completed',
      completed_at: new Date().toISOString(),
    }).eq('id', assessmentId);

    // --- Piano d'azione: un'azione per riga, senza stime economiche ---
    const actionPlans = insertedGaps
      .filter((g: any) => g.priority <= 3)
      .flatMap((gap: any) => {
        const actions = Array.isArray(gap.recommended_actions) ? gap.recommended_actions : [];
        return actions.slice(0, 3).map((action: any) => ({
          assessment_id: assessmentId,
          gap_id: gap.id,
          title: gap.requirement_reference || '',
          description: action?.action || gap.gap_description,
          priority: gap.priority,
          estimated_cost_eur: null,
          estimated_hours: null,
          status: 'pending',
        }));
      });
    if (actionPlans.length > 0) {
      await supabase.from('action_plans').insert(actionPlans);
    }

    console.log(`Gap analysis completed: ${insertedGaps.length} gaps (${highCount} high, ${mediumCount} medium, ${lowCount} low), risk=${overallRisk}, compliance=${overallCompliance}%`);

    return new Response(JSON.stringify({
      success: true,
      gaps: insertedGaps,
      checks,
      unreadable_documents: unreadableDocuments,
      overall_risk_score: overallRisk,
      overall_compliance_percentage: overallCompliance,
      coverage_scope: {
        requirements_analyzed: checks.length,
        covered: coveredCount,
        partial: partialCount,
        missing: missingCount,
        to_verify: toVerifyCount,
        not_applicable: notApplicableCount,
        regulations_breakdown: normalizedRegulations.map(reg => ({
          regulation: reg,
          analyzed: checks.filter(c => c.regulation.toLowerCase() === reg.toLowerCase()).length,
        })),
      },
      method: 'evidence_checks_with_keyword_fallback',
    }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

  } catch (error) {
    console.error('Error in gap-analysis function:', error);
    return errorResponse(500, error instanceof Error ? error.message : 'Unknown error occurred');
  }
}, false, false));

// ============================================================
// HELPER FUNCTIONS
// ============================================================

function errorResponse(status: number, message: string) {
  return new Response(JSON.stringify({ error: message }), {
    status, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

// ============================================================
// DEDUPLICATION HELPERS
// ============================================================

const REGULATION_PATTERNS: Record<string, RegExp> = {
  'GDPR': /\bgdpr\b|2016\/679/i,
  'NIS2': /\bnis\s*2\b|2022\/2555/i,
  'DORA': /\bdora\b|2022\/2554/i,
  'AI Act': /\bai\s*act\b|2024\/1689/i,
  'CRA': /\bcra\b|cyber\s*resilience\s*act|2024\/2847/i,
  'D.Lgs 81/08': /\bd\.?\s*lgs\.?\s*81|81\/08|testo\s*unico\s*sicurezza/i,
  'Data Act': /\bdata\s*act\b|2023\/2854/i,
};

function inferRegulationFromRef(ref: string): string {
  for (const [reg, pattern] of Object.entries(REGULATION_PATTERNS)) {
    if (pattern.test(ref)) return reg;
  }
  return '';
}

function extractArticleRegKey(ref: string, regulation: string): string | null {
  const artMatch = ref.match(/(?:articol[oi]|art\.?|article)\s+(\d+)/i);
  if (!artMatch) return null;
  const artNum = artMatch[1];
  const reg = regulation || inferRegulationFromRef(ref);
  if (!reg) return null;
  return `${reg.toLowerCase()}:${artNum}`;
}

function jaccardSimilarity(a: string, b: string): number {
  const tokenize = (s: string) => new Set(
    s.replace(/[^\w\sàèéìòùç]/g, ' ').split(/\s+/).filter(w => w.length > 2)
  );
  const setA = tokenize(a);
  const setB = tokenize(b);
  if (setA.size === 0 && setB.size === 0) return 1;
  if (setA.size === 0 || setB.size === 0) return 0;
  let intersection = 0;
  for (const token of setA) {
    if (setB.has(token)) intersection++;
  }
  return intersection / (setA.size + setB.size - intersection);
}

function canonicalizeString(value: unknown): string {
  return String(value ?? '')
    .normalize('NFKC')
    .replace(/\u0000/g, '')
    .replace(/\r\n/g, '\n').replace(/\r/g, '\n')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function normalizeForMatch(value: string): string {
  return canonicalizeString(value)
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function getUniqueKeywordCount(keywords: string[]): number {
  return new Set(keywords.map(k => normalizeForMatch(k)).filter(Boolean)).size;
}

// Italian stop words that commonly appear between keyword terms
// e.g. "diritti dell'interessato" → keyword "diritti interessato" should still match
const IT_STOP_WORDS = new Set([
  'di', 'del', 'della', 'delle', 'dello', 'dei', 'degli', 'dell',
  'a', 'al', 'alla', 'alle', 'allo', 'ai', 'agli',
  'da', 'dal', 'dalla', 'dalle', 'dallo', 'dai', 'dagli',
  'in', 'nel', 'nella', 'nelle', 'nello', 'nei', 'negli',
  'su', 'sul', 'sulla', 'sulle', 'sullo', 'sui', 'sugli',
  'con', 'per', 'tra', 'fra', 'e', 'ed', 'o', 'od',
  'il', 'lo', 'la', 'i', 'gli', 'le', 'l', 'un', 'uno', 'una',
  'che', 'the', 'of', 'and', 'for', 'to', 'in', 'on', 'by',
]);

function keywordMatchesWithStopWords(corpus: string, keyword: string): boolean {
  // First try exact substring match
  if (corpus.includes(` ${keyword} `) || corpus.includes(keyword)) {
    return true;
  }

  // Then try flexible match: allow 1-2 Italian stop words between keyword terms
  const parts = keyword.split(/\s+/);
  if (parts.length < 2) return false;

  // Build regex: each keyword term separated by optional stop words
  // e.g. "diritti interessato" → /diritti\s+(?:di|del|della|dell|...)\s+interessato/
  // Also allow direct adjacency (no stop word in between)
  const stopPattern = `(?:\\s+(?:${Array.from(IT_STOP_WORDS).join('|')}))*\\s+`;
  const regexStr = parts.map(p => p.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join(stopPattern);
  try {
    const regex = new RegExp(regexStr, 'i');
    return regex.test(corpus);
  } catch {
    return false;
  }
}

function getCoveredKeywords(corpusRaw: string, keywords: string[]): string[] {
  const corpus = ` ${normalizeForMatch(corpusRaw)} `;
  const matched = new Set<string>();

  for (const keyword of keywords) {
    const normalizedKeyword = normalizeForMatch(keyword);
    if (!normalizedKeyword) continue;
    if (keywordMatchesWithStopWords(corpus, normalizedKeyword)) {
      matched.add(normalizedKeyword);
    }
  }

  return Array.from(matched).sort((a, b) => a.localeCompare(b));
}

function stableHashHex(input: string): string {
  let hash = 2166136261;
  for (let i = 0; i < input.length; i++) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(16).padStart(8, '0');
}

function normalizeUserDocuments(userDocuments: any[]): Array<{ name: string; type: string; content: string; content_hash: string; content_length: number }> {
  return [...userDocuments]
    .map((doc) => {
      const name = canonicalizeString(doc?.name || doc?.title || '');
      const type = canonicalizeString(doc?.type || 'application/octet-stream').toLowerCase();
      const content = canonicalizeString(doc?.content || '');
      return { name, type, content, content_hash: stableHashHex(content), content_length: content.length };
    })
    .filter((doc) => doc.name.length > 0 && doc.content.length > 0)
    .sort((a, b) => {
      const aKey = `${a.name.toLowerCase()}|${a.type}|${a.content_hash}|${a.content_length}`;
      const bKey = `${b.name.toLowerCase()}|${b.type}|${b.content_hash}|${b.content_length}`;
      return aKey.localeCompare(bKey) || a.content.localeCompare(b.content);
    });
}

async function generateCacheFingerprint(
  regulations: string[],
  userDocuments: Array<{ name: string; type: string; content: string }>,
  language: string,
  profile: any,
  annualRevenue: number | null | undefined
): Promise<string> {
  const canonicalInput = JSON.stringify({
    v: 'gap-analysis-v18-realistic-fines',
    r: [...regulations].map(canonicalizeString).filter(Boolean).sort((a, b) => a.localeCompare(b)),
    l: canonicalizeString(language).toLowerCase() || 'it',
    p: {
      j: canonicalizeString(profile?.jurisdiction || 'EU'),
      s: canonicalizeString(profile?.sector || 'Technology'),
      c: canonicalizeString(profile?.compliance_role || 'DPO'),
    },
    rev: Math.max(0, Number(annualRevenue || 5000000)),
    d: userDocuments.map(d => ({ n: d.name, t: d.type, c: d.content })),
  });
  const data = new TextEncoder().encode(canonicalInput);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(hashBuffer)).map(b => b.toString(16).padStart(2, '0')).join('');
}

// Build a set of lowercased keywords found in RAG chunks for the selected regulations
async function buildRagValidationCache(supabase: any, regulations: string[]): Promise<Map<string, Set<string>>> {
  const cache = new Map<string, Set<string>>();

  const regulationDocPatterns: Record<string, string[]> = {
    'GDPR': ['GDPR', 'General Data Protection', '2016/679'],
    // NIS2 family: include Direttiva UE + recepimento italiano (D.Lgs. 138/2024) + Determinazioni ACN
    'NIS2': ['NIS2', 'NIS 2', '2022/2555', 'D.Lgs. 138', '138/2024', 'Determinazione ACN', 'Piattaforma NIS', 'Decreto NIS'],
    'DORA': ['DORA', 'Digital Operational Resilience', '2022/2554'],
    'AI Act': ['AI Act', 'Artificial Intelligence', '2024/1689'],
    'CRA': ['Cyber Resilience Act', 'CRA', '2024/2847'],
    'Data Act': ['Data Act', '2023/2854'],
    'ISO 27001': ['ISO 27001', 'ISO/IEC 27001', 'ISMS'],
    'D.Lgs 81/08': ['81/08', 'sicurezza lavoro', 'D.Lgs 81'],
    'Legge 124/2024 Albania': ['124/2024', 'protezione dati albania'],
  };

  for (const reg of regulations) {
    const regSet = new Set<string>();
    const patterns = regulationDocPatterns[reg] || [reg];
    for (const pattern of patterns) {
      const { data: docs } = await supabase
        .from('documents').select('id, title')
        .ilike('title', `%${pattern}%`).limit(10);
      if (!docs || docs.length === 0) continue;

      const docIds = docs.map((d: any) => d.id);
      const { data: chunks } = await supabase
        .from('chunks').select('content')
        .in('document_id', docIds).limit(500);
      if (!chunks) continue;

      for (const chunk of chunks) {
        const content = (chunk.content || '').toLowerCase();
        const patterns_to_find = [
          /(?:articolo|art\.?|article)\s+\d+/gi,
          /clausola\s+\d+/gi,
          /clause\s+\d+/gi,
          /annex\s+a/gi,
          /a\.\d+/gi,
        ];
        for (const pat of patterns_to_find) {
          const matches = content.match(pat);
          if (matches) {
            for (const m of matches) {
              regSet.add(m.toLowerCase().trim());
            }
          }
        }
      }
    }
    cache.set(reg.toLowerCase(), regSet);
    console.log(`RAG cache for ${reg}: ${regSet.size} entries`);
  }

  return cache;
}

// ============================================================
// REGULATORY SOURCE CHUNKS (traceability)
// ============================================================

async function getRelevantRagChunkObjects(supabase: any, regulations: string[], limit: number): Promise<Array<{ id: string; content: string; document_id: string }>> {
  const regulationDocPatterns: Record<string, string[]> = {
    'GDPR': ['GDPR', '2016/679'],
    // NIS2 family: include Direttiva UE + recepimento italiano (D.Lgs. 138/2024) + Determinazioni ACN
    'NIS2': ['NIS2', '2022/2555', 'D.Lgs. 138', '138/2024', 'Determinazione ACN', 'Piattaforma NIS'],
    'DORA': ['DORA', '2022/2554'],
    'AI Act': ['AI Act', '2024/1689'],
    'CRA': ['Cyber Resilience Act', 'CRA'],
    'Data Act': ['Data Act', '2023/2854'],
    'ISO 27001': ['ISO 27001'],
    'D.Lgs 81/08': ['81/08', 'sicurezza lavoro'],
  };

  const allChunks: Array<{ id: string; content: string; document_id: string }> = [];
  for (const reg of regulations) {
    const patterns = regulationDocPatterns[reg] || [reg];
    for (const pattern of patterns) {
      const { data: docs } = await supabase
        .from('documents').select('id, title')
        .ilike('title', `%${pattern}%`).limit(5);
      if (!docs?.length) continue;

      const { data: chunks } = await supabase
        .from('chunks').select('id, content, document_id')
        .in('document_id', docs.map((d: any) => d.id))
        .limit(Math.ceil(limit / regulations.length));
      if (chunks) {
        allChunks.push(...chunks.map((c: any) => ({ id: c.id, content: c.content, document_id: c.document_id })));
      }
    }
  }
  return allChunks.slice(0, limit);
}

// ============================================================
// SEMANTIC EMBEDDING HELPERS FOR GAP ANALYSIS
// ============================================================

function splitIntoSections(text: string, maxChars: number): string[] {
  const sections: string[] = [];
  const paragraphs = text.split(/\n\s*\n/);
  let currentSection = '';

  for (const para of paragraphs) {
    if (currentSection.length + para.length > maxChars && currentSection.length > 0) {
      sections.push(currentSection.trim());
      currentSection = para;
    } else {
      currentSection += (currentSection ? '\n\n' : '') + para;
    }
  }
  if (currentSection.trim().length > 0) {
    sections.push(currentSection.trim());
  }

  // Split overly long sections by sentences
  const finalSections: string[] = [];
  for (const section of sections) {
    if (section.length <= maxChars * 1.5) {
      finalSections.push(section);
    } else {
      const sentences = section.split(/(?<=[.!?])\s+/);
      let chunk = '';
      for (const sentence of sentences) {
        if (chunk.length + sentence.length > maxChars && chunk.length > 0) {
          finalSections.push(chunk.trim());
          chunk = sentence;
        } else {
          chunk += (chunk ? ' ' : '') + sentence;
        }
      }
      if (chunk.trim()) finalSections.push(chunk.trim());
    }
  }

  return finalSections;
}

const GAP_EMBEDDING_DIMENSIONS = 768;

function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length) return 0;
  let dotProduct = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < a.length; i++) {
    dotProduct += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  const denominator = Math.sqrt(normA) * Math.sqrt(normB);
  return denominator === 0 ? 0 : dotProduct / denominator;
}

async function generateBatchEmbeddingsForGap(apiKey: string, texts: string[]): Promise<number[][]> {
  const cleaned = texts.map(t => t.replace(/\n+/g, ' ').trim().substring(0, 8000));
  const batchSize = 20;
  const allEmbeddings: number[][] = [];

  for (let i = 0; i < cleaned.length; i += batchSize) {
    const batch = cleaned.slice(i, i + batchSize);

    const requests = batch.map(text => ({
      model: 'models/gemini-embedding-001',
      content: { parts: [{ text }] },
      outputDimensionality: GAP_EMBEDDING_DIMENSIONS,
    }));

    let retries = 0;
    let success = false;
    while (retries < 3 && !success) {
      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-embedding-001:batchEmbedContents?key=${apiKey}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ requests }),
        }
      );

      if (response.ok) {
        const data = await response.json();
        for (const emb of data.embeddings) {
          allEmbeddings.push(emb.values);
        }
        success = true;
      } else if (response.status === 429) {
        retries++;
        const waitSec = 5 * retries;
        console.log(`⏳ Embedding rate limited, waiting ${waitSec}s (retry ${retries}/3)...`);
        await response.text();
        await new Promise(r => setTimeout(r, waitSec * 1000));
      } else {
        const err = await response.text();
        throw new Error(`Gemini Embedding API error ${response.status}: ${err}`);
      }
    }
    if (!success) throw new Error('Max retries exceeded for gap analysis embedding');

    // Small delay between batches
    if (i + batchSize < cleaned.length) {
      await new Promise(r => setTimeout(r, 500));
    }
  }

  return allEmbeddings;
}
