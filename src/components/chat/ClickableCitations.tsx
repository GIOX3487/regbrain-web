import React from "react";

/**
 * Renders a string, replacing inline citation markers like `[3]` or `[3,5]`
 * with clickable buttons that scroll to and briefly highlight the matching
 * citation card by id `citation-{messageIndex}-{N}` (handled by GroupedCitations
 * / CitationPanel which set those ids).
 */
interface Props {
  text: string;
  messageIndex: number;
  maxCitation?: number;
}

export const renderWithClickableCitations = (
  text: string,
  messageIndex: number,
  maxCitation?: number,
): React.ReactNode[] => {
  const parts: React.ReactNode[] = [];
  const regex = /\[(\d+(?:\s*,\s*\d+)*)\]/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  let key = 0;

  while ((match = regex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      parts.push(text.slice(lastIndex, match.index));
    }
    const nums = match[1]
      .split(",")
      .map((s) => parseInt(s.trim(), 10))
      .filter((n) => !isNaN(n) && (!maxCitation || n <= maxCitation));

    if (nums.length === 0) {
      parts.push(match[0]);
    } else {
      parts.push(
        <span key={`cit-${messageIndex}-${key++}`} className="inline-flex gap-0.5">
          {nums.map((n, i) => (
            <button
              key={`${n}-${i}`}
              type="button"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                const el = document.getElementById(`citation-${messageIndex}-${n}`);
                if (el) {
                  el.scrollIntoView({ behavior: "smooth", block: "center" });
                  el.classList.add("ring-2", "ring-primary", "ring-offset-2");
                  setTimeout(() => {
                    el.classList.remove("ring-2", "ring-primary", "ring-offset-2");
                  }, 1800);
                }
              }}
              className="citation-chip inline-flex items-center justify-center min-w-[1.25em] h-[1.25em] px-[0.3em] mx-[0.15em] text-[0.68em] leading-none font-semibold rounded bg-primary/10 text-primary hover:bg-primary hover:text-primary-foreground transition-colors cursor-pointer relative -top-[0.35em]"
              title={`Vai alla fonte normativa [${n}]`}
              aria-label={`Vai alla fonte ${n}`}
            >
              {n}
            </button>
          ))}
        </span>,
      );
    }
    lastIndex = regex.lastIndex;
  }
  if (lastIndex < text.length) {
    parts.push(text.slice(lastIndex));
  }
  return parts;
};

export const ClickableCitations: React.FC<Props> = ({ text, messageIndex, maxCitation }) => {
  return <>{renderWithClickableCitations(text, messageIndex, maxCitation)}</>;
};
