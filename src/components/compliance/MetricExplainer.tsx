import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { HelpCircle } from "lucide-react";

export type MetricKind = 'compliance' | 'risk' | 'requirements';
export type ExplainerLanguage = 'it' | 'en' | 'es' | 'fr' | 'de';

export interface MetricNumbers {
  covered: number;
  partial: number;
  missing: number;
  toVerify: number;
  notApplicable: number;
  evaluated: number;
  total: number;
  gaps: number;
  compliance: number | null;
  complianceLabel: string;
  risk: number | null;
  riskLabel: string;
  high: number;
  medium: number;
  low: number;
}

// I numeri della singola analisi vengono sostituiti dentro il testo: una spiegazione
// generica costringe il lettore a rifare il conto per capire se lo riguarda.
function fill(text: string, n: MetricNumbers): string {
  const vars: Record<string, string | number> = {
    covered: n.covered,
    partial: n.partial,
    missing: n.missing,
    toVerify: n.toVerify,
    notApplicable: n.notApplicable,
    evaluated: n.evaluated,
    total: n.total,
    gaps: n.gaps,
    compliance: n.compliance ?? 0,
    complianceLabel: n.complianceLabel,
    risk: n.risk ?? 0,
    riskLabel: n.riskLabel.toLowerCase(),
    high: n.high,
    medium: n.medium,
    low: n.low,
    maxWeight: n.evaluated * 3,
    halfPartial: n.partial % 2 === 0 ? String(n.partial / 2) : (n.partial / 2).toFixed(1).replace('.', ','),
  };
  return text.replace(/\{(\w+)\}/g, (_, k) => String(vars[k] ?? `{${k}}`));
}

const T: Record<ExplainerLanguage, Record<string, string>> = {
  it: {
    complianceTitle: 'Come si calcola questa percentuale',
    complianceFormula: '{covered} documentati + metà dei {partial} parziali ({halfPartial}) ÷ {evaluated} obblighi valutati = {compliance}%',
    complianceHalf: 'Un obbligo parziale vale mezzo punto: la documentazione esiste ma non copre tutto quello che la norma impone. Contarlo intero direbbe che è a posto, contarlo zero direbbe che non c\'è nulla.',
    complianceOut: 'Al denominatore entrano solo gli obblighi che è stato possibile valutare. Restano fuori {toVerify} da verificare e {notApplicable} non applicabili: contarli come mancanti gonfierebbe il problema, contarli come coperti lo nasconderebbe.',
    complianceScale: 'Eccellente da 90%, Buono da 75%, Sufficiente da 60%, Insufficiente da 40%, Critico sotto 40%. Questa analisi è al {compliance}%, quindi {complianceLabel}.',
    complianceCaveat: 'La percentuale dice quanto risulta dai documenti caricati, non se le misure sono davvero applicate.',

    riskTitle: 'Perché il profilo è {riskLabel}',
    riskRule: 'Il profilo prende il livello del gap più grave, non la media. Ci sono {high} gap alti: finché restano aperti il profilo resta alto, anche con molti gap lievi accanto.',
    riskNoAverage: 'Una media diluirebbe quei {high} dietro i {medium} medi e i {low} bassi, e il colore direbbe il contrario di quello che serve sapere a chi deve decidere da dove partire.',
    riskScore: 'Il punteggio interno di questa analisi è {risk} su 100: somma dei pesi dei gap (alto 3, medio 2, basso 1) divisa per il massimo teorico, cioè tutti gli {evaluated} obblighi valutati aperti al livello più alto ({evaluated} × 3 = {maxWeight}).',
    riskAction: 'Per far scendere il profilo vanno chiusi i gap alti. Chiudere quelli bassi migliora il punteggio ma non cambia il colore.',

    reqTitle: 'Verificato e da verificare: cosa vuol dire',
    reqBreakdown: 'Obblighi esaminati: {total}. Di questi {covered} risultano documentati, {gaps} presentano lacune, {toVerify} restano da verificare, {notApplicable} non si applicano all\'organizzazione.',
    reqVerified: 'Verificato vuol dire confrontato con i documenti caricati, non conforme: l\'esito del confronto può essere positivo o negativo. Il numero grande è quanto è stato esaminato, non quanto è a posto.',
    reqToVerify: 'Da verificare non vuol dire che manca un documento. Sono obblighi che valgono solo in certe situazioni, e dai documenti non risulta se quelle situazioni ricorrono: senza saperlo non si può dire né che sono rispettati né che mancano, e restano fuori dal calcolo.',
    reqHow: 'Per chiuderli ci sono due strade: rispondere al questionario di applicabilità quando si avvia l\'analisi, oppure caricare il documento che dice se la condizione ricorre (registro dei trattamenti, organigramma, contratti con fornitori esteri). Nell\'elenco "Da verificare" ogni obbligo dichiara quale condizione lo attiva.',
  },
  en: {
    complianceTitle: 'How this percentage is calculated',
    complianceFormula: '{covered} documented + half of the {partial} partial ones ({halfPartial}) ÷ {evaluated} assessed obligations = {compliance}%',
    complianceHalf: 'A partial obligation counts half: the documentation exists but does not cover everything the rule requires. Counting it in full would say it is fine, counting it zero would say nothing is there.',
    complianceOut: 'Only obligations that could be assessed go into the denominator. Left out: {toVerify} to verify and {notApplicable} not applicable. Counting them as missing would inflate the problem, counting them as covered would hide it.',
    complianceScale: 'Excellent from 90%, Good from 75%, Sufficient from 60%, Insufficient from 40%, Critical below 40%. This assessment is at {compliance}%, hence {complianceLabel}.',
    complianceCaveat: 'The percentage reflects what the uploaded documents show, not whether the measures are actually applied.',

    riskTitle: 'Why the profile is {riskLabel}',
    riskRule: 'The profile takes the level of the most serious gap, not the average. There are {high} high gaps: while they stay open the profile stays high, even alongside many minor ones.',
    riskNoAverage: 'An average would dilute those {high} behind the {medium} medium and {low} low ones, and the colour would say the opposite of what someone deciding where to start needs to know.',
    riskScore: 'The internal score of this assessment is {risk} out of 100: the sum of gap weights (high 3, medium 2, low 1) divided by the theoretical maximum, that is all {evaluated} assessed obligations open at the highest level ({evaluated} × 3 = {maxWeight}).',
    riskAction: 'To lower the profile, close the high gaps. Closing low ones improves the score but does not change the colour.',

    reqTitle: 'Checked and to verify: what they mean',
    reqBreakdown: 'Obligations examined: {total}. Of these {covered} are documented, {gaps} show gaps, {toVerify} remain to verify, {notApplicable} do not apply to the organisation.',
    reqVerified: 'Checked means compared against the uploaded documents, not compliant: the comparison can end either way. The large number is how much was examined, not how much is in order.',
    reqToVerify: 'To verify does not mean a document is missing. These are obligations that apply only in certain situations, and the documents do not show whether those situations occur: without knowing, they can be called neither met nor missing, and they stay out of the calculation.',
    reqHow: 'Two ways to close them: answer the applicability questionnaire when starting the analysis, or upload the document that states whether the condition occurs (record of processing activities, org chart, contracts with non-EU suppliers). In the "To verify" list each obligation states which condition triggers it.',
  },
  es: {
    complianceTitle: 'Cómo se calcula este porcentaje',
    complianceFormula: '{covered} documentados + la mitad de los {partial} parciales ({halfPartial}) ÷ {evaluated} obligaciones evaluadas = {compliance}%',
    complianceHalf: 'Una obligación parcial vale medio punto: la documentación existe pero no cubre todo lo que la norma exige.',
    complianceOut: 'En el denominador entran solo las obligaciones evaluables. Quedan fuera {toVerify} por verificar y {notApplicable} no aplicables: contarlas como ausentes exageraría el problema, contarlas como cubiertas lo ocultaría.',
    complianceScale: 'Excelente desde 90%, Bueno desde 75%, Suficiente desde 60%, Insuficiente desde 40%, Crítico por debajo de 40%. Este análisis está en {compliance}%, por tanto {complianceLabel}.',
    complianceCaveat: 'El porcentaje refleja lo que resulta de los documentos cargados, no si las medidas se aplican realmente.',

    riskTitle: 'Por qué el perfil es {riskLabel}',
    riskRule: 'El perfil toma el nivel de la brecha más grave, no el promedio. Hay {high} brechas altas: mientras sigan abiertas el perfil sigue siendo alto.',
    riskNoAverage: 'Un promedio diluiría esas {high} detrás de las {medium} medias y las {low} bajas, justo lo contrario de lo que necesita saber quien decide por dónde empezar.',
    riskScore: 'La puntuación interna es {risk} sobre 100: suma de los pesos de las brechas (alta 3, media 2, baja 1) dividida por el máximo teórico, es decir las {evaluated} obligaciones evaluadas abiertas al nivel más alto ({evaluated} × 3 = {maxWeight}).',
    riskAction: 'Para bajar el perfil hay que cerrar las brechas altas. Cerrar las bajas mejora la puntuación pero no cambia el color.',

    reqTitle: 'Verificado y por verificar: qué significan',
    reqBreakdown: 'Obligaciones examinadas: {total}. De ellas {covered} documentadas, {gaps} con carencias, {toVerify} por verificar, {notApplicable} no aplicables.',
    reqVerified: 'Verificado significa comparado con los documentos cargados, no conforme: el resultado puede ser positivo o negativo.',
    reqToVerify: 'Por verificar no significa que falte un documento. Son obligaciones que valen solo en ciertas situaciones y los documentos no dicen si esas situaciones se dan: quedan fuera del cálculo.',
    reqHow: 'Para cerrarlas: responder al cuestionario de aplicabilidad al iniciar el análisis, o cargar el documento que diga si la condición se da. En la lista "Por verificar" cada obligación indica qué condición la activa.',
  },
  fr: {
    complianceTitle: 'Comment ce pourcentage est calculé',
    complianceFormula: '{covered} documentées + la moitié des {partial} partielles ({halfPartial}) ÷ {evaluated} obligations évaluées = {compliance}%',
    complianceHalf: 'Une obligation partielle vaut un demi-point : la documentation existe mais ne couvre pas tout ce que la règle impose.',
    complianceOut: 'Seules les obligations évaluables entrent au dénominateur. Restent dehors {toVerify} à vérifier et {notApplicable} non applicables : les compter comme absentes gonflerait le problème, les compter comme couvertes le masquerait.',
    complianceScale: 'Excellent à partir de 90%, Bon à partir de 75%, Suffisant à partir de 60%, Insuffisant à partir de 40%, Critique en dessous de 40%. Cette analyse est à {compliance}%, donc {complianceLabel}.',
    complianceCaveat: 'Le pourcentage reflète ce que montrent les documents chargés, pas si les mesures sont réellement appliquées.',

    riskTitle: 'Pourquoi le profil est {riskLabel}',
    riskRule: 'Le profil prend le niveau de l\'écart le plus grave, pas la moyenne. Il y a {high} écarts élevés : tant qu\'ils restent ouverts le profil reste élevé.',
    riskNoAverage: 'Une moyenne diluerait ces {high} derrière les {medium} moyens et les {low} faibles, soit l\'inverse de ce qu\'il faut savoir pour décider par où commencer.',
    riskScore: 'Le score interne est {risk} sur 100 : somme des poids des écarts (élevé 3, moyen 2, faible 1) divisée par le maximum théorique, soit les {evaluated} obligations évaluées ouvertes au niveau le plus haut ({evaluated} × 3 = {maxWeight}).',
    riskAction: 'Pour faire baisser le profil, il faut fermer les écarts élevés. Fermer les faibles améliore le score mais ne change pas la couleur.',

    reqTitle: 'Vérifié et à vérifier : ce que cela signifie',
    reqBreakdown: 'Obligations examinées : {total}. Dont {covered} documentées, {gaps} avec des lacunes, {toVerify} à vérifier, {notApplicable} non applicables.',
    reqVerified: 'Vérifié signifie comparé aux documents chargés, pas conforme : la comparaison peut se terminer dans les deux sens.',
    reqToVerify: 'À vérifier ne veut pas dire qu\'un document manque. Ce sont des obligations qui ne valent que dans certaines situations, et les documents ne disent pas si elles se présentent : elles restent hors du calcul.',
    reqHow: 'Pour les fermer : répondre au questionnaire d\'applicabilité au lancement de l\'analyse, ou charger le document qui dit si la condition se présente. Dans la liste « À vérifier », chaque obligation indique la condition qui la déclenche.',
  },
  de: {
    complianceTitle: 'Wie dieser Prozentsatz berechnet wird',
    complianceFormula: '{covered} dokumentiert + die Hälfte der {partial} teilweisen ({halfPartial}) ÷ {evaluated} bewertete Pflichten = {compliance}%',
    complianceHalf: 'Eine teilweise erfüllte Pflicht zählt halb: die Dokumentation existiert, deckt aber nicht alles ab, was die Norm verlangt.',
    complianceOut: 'In den Nenner gehen nur bewertbare Pflichten ein. Draußen bleiben {toVerify} zu prüfen und {notApplicable} nicht anwendbar: als fehlend gezählt würde das Problem aufgebläht, als abgedeckt gezählt verdeckt.',
    complianceScale: 'Ausgezeichnet ab 90%, Gut ab 75%, Ausreichend ab 60%, Ungenügend ab 40%, Kritisch unter 40%. Diese Analyse liegt bei {compliance}%, also {complianceLabel}.',
    complianceCaveat: 'Der Prozentsatz zeigt, was aus den hochgeladenen Dokumenten hervorgeht, nicht ob die Maßnahmen tatsächlich angewendet werden.',

    riskTitle: 'Warum das Profil {riskLabel} ist',
    riskRule: 'Das Profil nimmt die Stufe der schwersten Lücke, nicht den Durchschnitt. Es gibt {high} hohe Lücken: solange sie offen sind, bleibt das Profil hoch.',
    riskNoAverage: 'Ein Durchschnitt würde diese {high} hinter den {medium} mittleren und {low} niedrigen verstecken, genau das Gegenteil dessen, was für die Priorisierung nötig ist.',
    riskScore: 'Der interne Wert ist {risk} von 100: Summe der Lückengewichte (hoch 3, mittel 2, niedrig 1) geteilt durch das theoretische Maximum, also alle {evaluated} bewerteten Pflichten auf höchster Stufe offen ({evaluated} × 3 = {maxWeight}).',
    riskAction: 'Um das Profil zu senken, müssen die hohen Lücken geschlossen werden. Niedrige zu schließen verbessert den Wert, ändert aber nicht die Farbe.',

    reqTitle: 'Geprüft und zu prüfen: was das heißt',
    reqBreakdown: 'Geprüfte Pflichten: {total}. Davon {covered} dokumentiert, {gaps} mit Lücken, {toVerify} zu prüfen, {notApplicable} nicht anwendbar.',
    reqVerified: 'Geprüft heißt mit den hochgeladenen Dokumenten abgeglichen, nicht konform: der Abgleich kann positiv oder negativ ausgehen.',
    reqToVerify: 'Zu prüfen heißt nicht, dass ein Dokument fehlt. Es sind Pflichten, die nur in bestimmten Situationen gelten, und die Dokumente zeigen nicht, ob diese vorliegen: sie bleiben außerhalb der Berechnung.',
    reqHow: 'Zwei Wege: den Anwendbarkeitsfragebogen beim Start der Analyse beantworten, oder das Dokument hochladen, das die Bedingung belegt. In der Liste "Zu prüfen" nennt jede Pflicht die auslösende Bedingung.',
  },
};

const KEYS: Record<MetricKind, { title: string; body: string[]; formula?: string }> = {
  compliance: {
    title: 'complianceTitle',
    formula: 'complianceFormula',
    body: ['complianceHalf', 'complianceOut', 'complianceScale', 'complianceCaveat'],
  },
  risk: {
    title: 'riskTitle',
    body: ['riskRule', 'riskNoAverage', 'riskScore', 'riskAction'],
  },
  requirements: {
    title: 'reqTitle',
    formula: 'reqBreakdown',
    body: ['reqVerified', 'reqToVerify', 'reqHow'],
  },
};

interface Props {
  kind: MetricKind;
  numbers: MetricNumbers;
  language?: ExplainerLanguage;
}

/**
 * Spiegazione di una metrica con i numeri di questa analisi al posto delle formule astratte.
 * Sta accanto al dato invece che in una pagina di aiuto: una spiegazione che costringe a
 * cambiare schermata non viene letta da nessuno.
 */
export function MetricExplainer({ kind, numbers, language = 'it' }: Props) {
  const t = T[language] || T.it;
  const spec = KEYS[kind];
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          className="text-muted-foreground hover:text-foreground transition-colors shrink-0"
          aria-label={fill(t[spec.title], numbers)}
        >
          <HelpCircle className="h-4 w-4" />
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-[22rem] max-w-[90vw] text-sm space-y-3">
        <p className="font-semibold leading-snug">{fill(t[spec.title], numbers)}</p>
        {spec.formula && (
          <p className="rounded-md bg-muted px-3 py-2 font-mono text-xs leading-relaxed">
            {fill(t[spec.formula], numbers)}
          </p>
        )}
        {spec.body.map((k) => (
          <p key={k} className="text-xs text-muted-foreground leading-relaxed">{fill(t[k], numbers)}</p>
        ))}
      </PopoverContent>
    </Popover>
  );
}
