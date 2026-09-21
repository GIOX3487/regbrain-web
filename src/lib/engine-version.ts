// Versione del motore di gap analysis attualmente distribuita.
//
// Deve restare identica a CHECKS_VERSION in supabase/functions/gap-analysis/index.ts: il
// controllo e' automatico (deployment/engine-version.test.mjs), perche' l'interfaccia la usa
// per dire se un'analisi e' stata prodotta da un motore precedente. Un'analisi vecchia non
// viene mai rifatta da sola: si segnala e basta, cosi' gli esiti gia' consegnati restano
// quelli fino a quando non e' l'utente a chiedere il rifacimento.
export const GAP_ANALYSIS_ENGINE_VERSION = 'gap-analysis-v27-ambito-normative-settoriali';

// Etichetta breve leggibile: "v26" da "gap-analysis-v26-prove-da-tutti-i-documenti".
export function engineVersionLabel(version: string | null | undefined): string {
  if (!version) return '';
  const m = /-(v\d+)-/.exec(version);
  return m ? m[1] : version;
}
