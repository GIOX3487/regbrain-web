// Scansione deterministica: applica le regole riga per riga e raggruppa gli esiti per regola.
import { type Confidence, FILE_RULES, isCommentLine, type Risk, RULES, TEST_FILE, TEXT_FILE } from "./rules.ts";
import { redactLine } from "./secrets.ts";
import { consentManagerEvidence, type Evidence } from "./consent.ts";
import { analyzeRoutes, unprotectedRoutes } from "./routes.ts";
import type { ScanEvidence } from "./requirements.ts";

const MAX_OCCURRENCES = 8;

export const RISK_ORDER: Record<string, number> = { high: 3, medium: 2, low: 1, none: 0 };
export const RISK_LABEL: Record<string, string> = { high: "alto", medium: "medio", low: "basso" };

export interface InputFile { name: string; content: string }
export interface Occurrence { file: string; line: number; snippet: string; note?: string }
export interface Finding {
  id: string; ruleId: string | null; source: "regola" | "ai"; title: string; category: string; risk: Risk;
  why: string; action: string; occurrences: Occurrence[]; totalOccurrences: number;
  refs: string[]; status: "confermato" | "da_verificare" | "possibile_falso_positivo"; aiNote?: string;
  /**
   * Affidabilità del riconoscimento: alta (pattern preciso), media (euristica), bassa (indizio).
   * Scende di un gradino quando tutte le occorrenze stanno in file di prova o di esempio.
   */
  confidence: Confidence;
  /** Rettifica applicata in base alle risposte dell'utente, con la motivazione (questions.ts). */
  adjustment?: string;
}

export const CONFIDENCE_ORDER: Record<Confidence, number> = { alta: 3, media: 2, bassa: 1 };
export const CONFIDENCE_LABEL: Record<Confidence, string> = { alta: "alta", media: "media", bassa: "bassa" };
const LOWER_CONFIDENCE: Record<Confidence, Confidence> = { alta: "media", media: "bassa", bassa: "bassa" };

/** Più alta fra due affidabilità: l'esito vale quanto la sua occorrenza più sicura. */
function raise(a: Confidence, b: Confidence): Confidence {
  return CONFIDENCE_ORDER[b] > CONFIDENCE_ORDER[a] ? b : a;
}
export interface Source { id: string; citation: string; regulation: string; chunkKey: string; text: string }

/**
 * Contesto dell'applicazione. Le voci a scelta multipla sono elenchi; i campi singolari
 * (appType, sector, audience) restano per le verifiche salvate prima del 23 settembre 2026.
 */
export type Ctx = {
  appTypes?: string[]; sectors?: string[]; audiences?: string[];
  appType?: string; sector?: string; audience?: string;
  personalData?: string; usesAI?: string; notes?: string;
  /** Risposte alle domande mirate (questions.ts); l'id lega la risposta ai suoi effetti. */
  answers?: Array<{ id?: string; q: string; a: string }>;
  /** Cosa il codice dice da solo, con le prove: riempito dal browser o dalla funzione. */
  inferred?: unknown;
};

/** Le voci a scelta multipla, unendo i campi vecchi a valore singolo. */
export function ctxList(ctx: Ctx, key: "appTypes" | "sectors" | "audiences"): string[] {
  const single = { appTypes: ctx.appType, sectors: ctx.sector, audiences: ctx.audience }[key];
  const list = Array.isArray(ctx[key]) ? ctx[key]!.map(String) : [];
  if (single && !list.includes(single)) list.push(single);
  return list.filter((v) => v && v !== "non_so");
}

/** Maschera i segreti in una riga citata nel referto: del valore non resta nulla. */
export function mask(line: string, extra?: RegExp, file = ""): string {
  let out = redactLine(line, file);
  if (extra) out = out.replace(new RegExp(extra.source, extra.flags.includes("g") ? extra.flags : extra.flags + "g"), "[SEGRETO RIMOSSO]");
  return out;
}

export const EMPTY_EVIDENCE: ScanEvidence = {
  trackers: { total: 0, gated: [], ungated: 0 },
  consentManager: [],
  routes: { total: 0, protected: 0, publicByNature: 0, unprotected: [], frameworks: [], globalGuards: [] },
};

export function scan(files: InputFile[]): { findings: Finding[]; masks: RegExp[]; evidence: ScanEvidence } {
  const byRule = new Map<string, Finding>();
  const masks: RegExp[] = [];
  const consentManager = consentManagerEvidence(files);
  const consentPresent = consentManager.length > 0;
  const gated: Evidence[] = [];
  let trackersTotal = 0;
  const LOWER: Record<Risk, Risk> = { high: "medium", medium: "low", low: "low" };
  for (const f of files) {
    if (/(^|\/)(package-lock\.json|yarn\.lock|pnpm-lock\.yaml|composer\.lock|Gemfile\.lock|poetry\.lock|Cargo\.lock)$/i.test(f.name)) continue;
    if (TEXT_FILE.test(f.name)) continue;
    const isTest = TEST_FILE.test(f.name);
    const lines = f.content.split(/\r?\n/);
    lines.forEach((raw, idx) => {
      const line = raw.length > 2000 ? raw.slice(0, 2000) : raw;
      if (!line.trim()) return;
      const comment = isCommentLine(line);
      for (const rule of RULES) {
        if (rule.files && !rule.files.test(f.name)) continue;
        if (comment && !rule.scanComments) continue;
        const hit = rule.test(line, f.name);
        if (!hit) continue;
        if (rule.id === "PRIV-01") trackersTotal++;
        // Analisi strutturale: un'occorrenza protetta (per esempio un tracker che parte solo
        // dopo il consenso) è una verifica superata, non un esito.
        if (rule.gate) {
          const reason = rule.gate(lines, idx, f.name);
          if (reason) {
            if (gated.length < 40) gated.push({ file: f.name, line: idx + 1, snippet: mask(line.trim(), undefined, f.name).slice(0, 160), note: `${hit.note ? hit.note + ": " : ""}${reason}` });
            continue;
          }
        }
        if (hit.mask) masks.push(hit.mask);
        let finding = byRule.get(rule.id);
        if (!finding) {
          finding = {
            id: rule.id, ruleId: rule.id, source: "regola", title: rule.title, category: rule.category, risk: "low",
            why: rule.why, action: rule.action, occurrences: [], totalOccurrences: 0, refs: [...rule.refs], status: "confermato", confidence: "bassa",
          };
          byRule.set(rule.id, finding);
        }
        finding.totalOccurrences++;
        // In un file di prova o di esempio il valore è quasi sempre finto: l'esito resta, con un
        // gradino di rischio e di affidabilità in meno e la ragione scritta accanto.
        const risk: Risk = isTest ? LOWER[hit.risk ?? rule.risk] : (hit.risk ?? rule.risk);
        if (RISK_ORDER[risk] > RISK_ORDER[finding.risk]) finding.risk = risk;
        const conf = hit.confidence ?? rule.confidence ?? "alta";
        finding.confidence = raise(finding.confidence, isTest ? LOWER_CONFIDENCE[conf] : conf);
        if (finding.occurrences.length < MAX_OCCURRENCES) {
          finding.occurrences.push({ file: f.name, line: idx + 1, snippet: mask(line.trim(), hit.mask, f.name).slice(0, 240), note: isTest ? `${hit.note ? hit.note + "; " : ""}file di prova o di esempio` : hit.note });
        }
      }
    });
  }
  // Regole sul file intero: tag su più righe, etichette altrove nel file, valori usati righe dopo.
  for (const f of files) {
    if (/(^|\/)(package-lock\.json|yarn\.lock|pnpm-lock\.yaml)$/i.test(f.name) || f.content.length > 400_000 || TEXT_FILE.test(f.name)) continue;
    const isTest = TEST_FILE.test(f.name);
    const lines = f.content.split(/\r?\n/);
    for (const rule of FILE_RULES) {
      let hits: Array<{ line: number; note?: string; risk?: Risk }>;
      try { hits = rule.test(f.content, f.name); } catch { hits = []; }
      for (const hit of hits) {
        let finding = byRule.get(rule.id);
        if (!finding) {
          finding = {
            id: rule.id, ruleId: rule.id, source: "regola", title: rule.title, category: rule.category, risk: "low",
            why: rule.why, action: rule.action, occurrences: [], totalOccurrences: 0, refs: [...rule.refs], status: "confermato", confidence: "bassa",
          };
          byRule.set(rule.id, finding);
        }
        // Lo stesso punto trovato anche dalla regola per riga non si conta due volte.
        if (finding.occurrences.some((o) => o.file === f.name && o.line === hit.line)) continue;
        finding.totalOccurrences++;
        const risk: Risk = isTest ? LOWER[hit.risk ?? rule.risk] : (hit.risk ?? rule.risk);
        if (RISK_ORDER[risk] > RISK_ORDER[finding.risk]) finding.risk = risk;
        const conf = rule.confidence ?? "alta";
        finding.confidence = raise(finding.confidence, isTest ? LOWER_CONFIDENCE[conf] : conf);
        if (finding.occurrences.length < MAX_OCCURRENCES) {
          const raw = lines[hit.line - 1] || "";
          finding.occurrences.push({ file: f.name, line: hit.line, snippet: mask(raw.trim(), undefined, f.name).slice(0, 240), note: isTest ? `${hit.note ? hit.note + "; " : ""}file di prova o di esempio` : hit.note });
        }
      }
    }
  }
  // Tracciamento: le occorrenze protette da un controllo del consenso sono già uscite dagli
  // esiti (gate). Quelle rimaste partono senza un controllo riconoscibile.
  const trackers = byRule.get("PRIV-01");
  if (trackers && !consentPresent) {
    trackers.why += " In nessuna riga di codice c'è un gestore del consenso (commenti e TODO non contano): gli script partono senza consenso.";
  }
  if (trackers && consentPresent) {
    trackers.risk = "medium";
    trackers.status = "da_verificare";
    trackers.why += ` Nel codice c'è un gestore del consenso (${consentManager[0].file}:${consentManager[0].line}), ma in questi punti lo script parte senza un controllo del consenso riconoscibile nelle righe precedenti${gated.length ? `; in altri ${gated.length} punti il controllo c'è` : ""}.`;
  }

  // Rotte HTTP e controlli di autorizzazione, seguendo middleware e decoratori fra i file.
  const routeAnalysis = analyzeRoutes(files);
  const unprotected = unprotectedRoutes(routeAnalysis);
  const evidence: ScanEvidence = {
    trackers: { total: trackersTotal, gated, ungated: trackers ? trackers.totalOccurrences : 0 },
    consentManager,
    routes: {
      total: routeAnalysis.routes.length,
      protected: routeAnalysis.routes.filter((r) => r.auth).length,
      publicByNature: routeAnalysis.routes.filter((r) => !r.auth && r.publicByNature).length,
      unprotected, frameworks: routeAnalysis.frameworks, globalGuards: routeAnalysis.globalGuards,
    },
  };
  const sec16 = routeFinding(evidence);
  if (sec16) byRule.set(sec16.id, sec16);
  const findings = [...byRule.values()].sort(compareFindings);
  return { findings, masks, evidence };
}

/** Ordine del referto: prima il rischio, poi l'affidabilità, poi l'identificativo. */
export function compareFindings(a: Pick<Finding, "risk" | "confidence" | "id">, b: Pick<Finding, "risk" | "confidence" | "id">): number {
  return RISK_ORDER[b.risk] - RISK_ORDER[a.risk] || CONFIDENCE_ORDER[b.confidence] - CONFIDENCE_ORDER[a.confidence] || a.id.localeCompare(b.id);
}

/**
 * L'esito SEC-16 nasce dall'analisi delle rotte, non da una regola per riga: si ricostruisce
 * dalle prove, nel browser come nella funzione, così il server non si fida del testo del client.
 */
export function routeFinding(evidence: ScanEvidence): Finding | null {
  const r = evidence.routes;
  const unprotected = r.unprotected;
  if (!unprotected.length) return null;
  const mutating = unprotected.filter((x) => x.mutating);
  const anyAuth = r.protected > 0 || r.globalGuards.length > 0;
  const shown = [...mutating, ...unprotected.filter((x) => !x.mutating)].slice(0, MAX_OCCURRENCES);
  return {
    id: "SEC-16", ruleId: "SEC-16", source: "regola",
    title: "Endpoint senza controllo di autorizzazione riconoscibile", category: "sicurezza",
    risk: mutating.length ? "high" : "medium",
    why: `${unprotected.length} rotte su ${r.total} (${r.frameworks.join(", ") || "framework non riconosciuto"}) non mostrano un controllo di autenticazione o autorizzazione: non sulla rotta, non nei decoratori, non nel corpo della funzione, non in un middleware globale prima della rotta. ${mutating.length} di queste scrivono o modificano dati.${anyAuth ? " Altre rotte della stessa base di codice hanno un controllo: è probabile una dimenticanza o un controllo fatto altrove." : " In tutta la base di codice non è stato riconosciuto alcun controllo di accesso."}`,
    action: "Per ogni rotta elencata confermare chi può chiamarla; se non deve essere pubblica, applicare il middleware o il decoratore di autenticazione e verificare i permessi sull'oggetto richiesto.",
    occurrences: shown.map((x) => ({ file: x.file, line: x.line, snippet: `${x.method} ${x.path}`, note: x.mutating ? "scrive o modifica dati" : "lettura" })),
    totalOccurrences: unprotected.length, refs: ["CRA_ANNEX1", "GDPR32", "GDPR25"], status: "da_verificare",
    // Il censimento delle rotte riconosce i framework più diffusi: un controllo fatto in modo
    // non riconoscibile (un gateway, un middleware con un nome insolito) sfugge.
    confidence: "media",
  };
}

