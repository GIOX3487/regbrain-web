// Una risposta dell'intake che ripete le alternative della domanda non è un fatto:
// "accordo sindacale/ispettorato" alla domanda "avete già coinvolto i sindacati o
// l'Ispettorato?" non dice se l'accordo esiste. La regola è deterministica e stretta:
// scatta solo quando la risposta elenca alternative (con "/" o " o ") e le sue parole
// sono già nella domanda.
export function isAmbiguousAnswer(questionText: string, answerText: string): boolean {
  const norm = (t: string) =>
    t.toLowerCase().replace(/[^\p{L}\p{N}\s\/]/gu, " ").replace(/\s+/g, " ").trim();
  const a = norm(answerText);
  if (!a) return true;
  // Più scelte selezionate nell'interfaccia arrivano separate da ";": sono fatti scelti, non alternative.
  if (answerText.includes(";")) return false;
  const listsAlternatives = a.includes("/") || /\s(o|oppure)\s/.test(a);
  if (!listsAlternatives) return false;
  const words = a.split(/[\s\/]+/).filter((w) => w.length > 2 && w !== "oppure");
  if (words.length === 0 || words.length > 8) return false;
  const q = norm(questionText);
  const echoed = words.filter((w) => q.includes(w.slice(0, Math.min(6, w.length)))).length;
  return echoed / words.length >= 0.6;
}

// Una domanda dell'intake ammette più risposte insieme quando chiede categorie, tipi o
// ruoli che coesistono (un professionista è titolare per i propri dati e responsabile
// per i clienti). Il modello dichiara "multiple" da sé; questa regola copre i casi in cui
// non lo fa, guardando testo e opzioni.
export function inferMultiple(questionText: string, options?: string[]): boolean {
  const q = questionText.toLowerCase();
  const opts = (options || []).map((o) => o.toLowerCase());
  if (opts.length < 2) return false;
  const roles = opts.some((o) => o.includes("titolare")) && opts.some((o) => o.includes("responsabile"));
  if (roles) return true;
  return /\b(quali|categori[ae]|tipolog\w*|tipi\s+di|tipo\s+di\s+dat\w+|conseguenz\w+|danni?\b|misure)\b/.test(q);
}

// Il messaggio descrive una violazione di dati personali (data breach): la risposta deve
// seguire la struttura di valutazione (tipo di violazione, danni possibili, rischio,
// notifica al Garante, comunicazione agli interessati, registro).
export const BREACH_PATTERN =
  /data\s*breach|violazion[ei]\s+(dei\s+|di\s+)?dati|notifica\w*\s+(la\s+|della\s+|una\s+)?violazione|ransomware|esfiltra\w+|accesso\s+non\s+autorizzato|dati\s+(sottratti|rubati|trafugati|persi|smarriti|esposti|pubblicati\s+per\s+errore)|smarri\w+\s+(di\s+)?(un\s+|il\s+|lo\s+|la\s+|una\s+)?(pc|computer|portatile|laptop|notebook|telefono|smartphone|cellulare|chiavetta|dispositivo|tablet)|furto\s+(di\s+|del\s+|dello\s+|della\s+)?(un\s+)?(pc|computer|portatile|laptop|notebook|telefono|smartphone|cellulare|dispositivo|tablet|dati|archivio)|(email|mail|e-mail|messaggio|documento|referto|allegato)\s+(inviat\w+|mandat\w+|spedit\w+)\s+(al|a|ai|alla)\s+(un\s+)?destinatari\w+\s+(sbagliat\w+|errat\w+)|destinatari\w+\s+(sbagliat\w+|errat\w+)|attacco\s+(informatico|hacker|cyber)|credenziali\s+(compromesse|rubate|sottratte)/i;

export function isBreachContext(texts: Array<string | null | undefined>): boolean {
  return texts.some((t) => typeof t === "string" && BREACH_PATTERN.test(t));
}
