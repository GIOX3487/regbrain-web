// Scansione deterministica: applica le regole riga per riga e raggruppa gli esiti per regola.
import { CONSENT_SIGNALS, isCommentLine, type Risk, RULES, SECRET_VALUE_MASKS, TEST_FILE } from "./rules.ts";

const MAX_OCCURRENCES = 8;

export const RISK_ORDER: Record<string, number> = { high: 3, medium: 2, low: 1, none: 0 };
export const RISK_LABEL: Record<string, string> = { high: "alto", medium: "medio", low: "basso" };

export interface InputFile { name: string; content: string }
export interface Occurrence { file: string; line: number; snippet: string; note?: string }
export interface Finding {
  id: string; ruleId: string | null; source: "regola" | "ai"; title: string; category: string; risk: Risk;
  why: string; action: string; occurrences: Occurrence[]; totalOccurrences: number;
  refs: string[]; status: "confermato" | "da_verificare" | "possibile_falso_positivo"; aiNote?: string;
}
export interface Source { id: string; citation: string; regulation: string; chunkKey: string; text: string }

export type Ctx = { appType?: string; personalData?: string; sector?: string; usesAI?: string; audience?: string; notes?: string; answers?: Array<{ q: string; a: string }> };

export function mask(line: string, extra?: RegExp): string {
  let out = line;
  for (const re of SECRET_VALUE_MASKS) out = out.replace(re, (m) => m.slice(0, 4) + "…[mascherato]");
  if (extra) out = out.replace(new RegExp(extra.source, extra.flags.includes("g") ? extra.flags : extra.flags + "g"), (m) => m.slice(0, 3) + "…[mascherato]");
  return out;
}

export function scan(files: InputFile[]): { findings: Finding[]; masks: RegExp[] } {
  const byRule = new Map<string, Finding>();
  const masks: RegExp[] = [];
  const allText = files.map((f) => f.content).join("\n");
  const consentPresent = CONSENT_SIGNALS.test(allText);
  const LOWER: Record<Risk, Risk> = { high: "medium", medium: "low", low: "low" };
  for (const f of files) {
    if (/(^|\/)(package-lock\.json|yarn\.lock|pnpm-lock\.yaml|composer\.lock|Gemfile\.lock|poetry\.lock|Cargo\.lock)$/i.test(f.name)) continue;
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
        if (hit.mask) masks.push(hit.mask);
        let finding = byRule.get(rule.id);
        if (!finding) {
          finding = {
            id: rule.id, ruleId: rule.id, source: "regola", title: rule.title, category: rule.category, risk: "low",
            why: rule.why, action: rule.action, occurrences: [], totalOccurrences: 0, refs: [...rule.refs], status: "confermato",
          };
          byRule.set(rule.id, finding);
        }
        finding.totalOccurrences++;
        // In un file di prova o di esempio il valore è quasi sempre finto: l'esito resta, con un
        // gradino di rischio in meno e la ragione scritta accanto.
        const risk: Risk = isTest ? LOWER[hit.risk ?? rule.risk] : (hit.risk ?? rule.risk);
        if (RISK_ORDER[risk] > RISK_ORDER[finding.risk]) finding.risk = risk;
        if (finding.occurrences.length < MAX_OCCURRENCES) {
          finding.occurrences.push({ file: f.name, line: idx + 1, snippet: mask(line.trim(), hit.mask).slice(0, 240), note: isTest ? `${hit.note ? hit.note + "; " : ""}file di prova o di esempio` : hit.note });
        }
      }
    });
  }
  // Tracciamento con un gestore del consenso presente: il problema resta da verificare
  // (lo script deve partire solo dopo il consenso), ma non è più certo.
  const trackers = byRule.get("PRIV-01");
  if (trackers && consentPresent) {
    trackers.risk = "medium";
    trackers.status = "da_verificare";
    trackers.why += " Nel codice c'è un gestore del consenso: va verificato che gli script partano solo dopo l'accettazione.";
  }
  const findings = [...byRule.values()].sort((a, b) => RISK_ORDER[b.risk] - RISK_ORDER[a.risk] || a.id.localeCompare(b.id));
  return { findings, masks };
}

