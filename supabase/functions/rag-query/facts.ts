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
  const listsAlternatives = a.includes("/") || /\s(o|oppure)\s/.test(a);
  if (!listsAlternatives) return false;
  const words = a.split(/[\s\/]+/).filter((w) => w.length > 2 && w !== "oppure");
  if (words.length === 0 || words.length > 8) return false;
  const q = norm(questionText);
  const echoed = words.filter((w) => q.includes(w.slice(0, Math.min(6, w.length)))).length;
  return echoed / words.length >= 0.6;
}
