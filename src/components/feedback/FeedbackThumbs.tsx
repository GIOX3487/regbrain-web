import { useEffect, useState } from "react";
import { ThumbsDown, ThumbsUp, Check, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import type { Json } from "@/integrations/supabase/types";

export type FeedbackSource = "rag" | "gap_analysis" | "gap_item";

export interface ExistingFeedback {
  id: string;
  rating: number;
  comment: string | null;
}

interface FeedbackThumbsProps {
  source: FeedbackSource;
  /** Identifica in modo stabile cosa si sta valutando (una risposta, un'analisi, un obbligo). */
  targetKey: string;
  /** Istantanea di ciò che l'utente ha visto: resta leggibile anche se l'oggetto viene cancellato. */
  context: Record<string, unknown>;
  queryLogId?: string | null;
  assessmentId?: string | null;
  initial?: ExistingFeedback | null;
  /** Testo accanto alle icone, per esempio "Questa analisi ti è stata utile?". */
  prompt?: string;
  language?: string;
  className?: string;
}

const TEXT: Record<string, Record<string, string>> = {
  it: {
    up: "Utile",
    down: "Non utile",
    askUp: "Cosa ti è piaciuto? (facoltativo)",
    askDown: "Cosa non ha funzionato? (facoltativo)",
    send: "Invia",
    skip: "Chiudi",
    thanks: "Grazie, il team lo legge.",
    thanksComment: "Grazie, il commento è arrivato al team.",
    error: "Non è stato possibile inviare il feedback. Riprova.",
    edit: "Modifica commento",
  },
  en: {
    up: "Helpful",
    down: "Not helpful",
    askUp: "What did you like? (optional)",
    askDown: "What went wrong? (optional)",
    send: "Send",
    skip: "Close",
    thanks: "Thanks, the team reads this.",
    thanksComment: "Thanks, your comment reached the team.",
    error: "The feedback could not be sent. Please try again.",
    edit: "Edit comment",
  },
  es: {
    up: "Útil",
    down: "No útil",
    askUp: "¿Qué te ha gustado? (opcional)",
    askDown: "¿Qué no ha funcionado? (opcional)",
    send: "Enviar",
    skip: "Cerrar",
    thanks: "Gracias, el equipo lo lee.",
    thanksComment: "Gracias, tu comentario ha llegado al equipo.",
    error: "No se ha podido enviar la valoración. Inténtalo de nuevo.",
    edit: "Editar comentario",
  },
  fr: {
    up: "Utile",
    down: "Pas utile",
    askUp: "Qu'avez-vous apprécié ? (facultatif)",
    askDown: "Qu'est-ce qui n'a pas fonctionné ? (facultatif)",
    send: "Envoyer",
    skip: "Fermer",
    thanks: "Merci, l'équipe le lit.",
    thanksComment: "Merci, votre commentaire est parvenu à l'équipe.",
    error: "L'avis n'a pas pu être envoyé. Réessayez.",
    edit: "Modifier le commentaire",
  },
  de: {
    up: "Hilfreich",
    down: "Nicht hilfreich",
    askUp: "Was hat Ihnen gefallen? (optional)",
    askDown: "Was hat nicht funktioniert? (optional)",
    send: "Senden",
    skip: "Schließen",
    thanks: "Danke, das Team liest es.",
    thanksComment: "Danke, Ihr Kommentar ist beim Team angekommen.",
    error: "Das Feedback konnte nicht gesendet werden. Bitte erneut versuchen.",
    edit: "Kommentar bearbeiten",
  },
};

export function FeedbackThumbs({
  source,
  targetKey,
  context,
  queryLogId,
  assessmentId,
  initial,
  prompt,
  language = "it",
  className,
}: FeedbackThumbsProps) {
  const t = TEXT[language] || TEXT.it;
  const [feedbackId, setFeedbackId] = useState<string | null>(initial?.id ?? null);
  const [rating, setRating] = useState<number | null>(initial?.rating ?? null);
  const [comment, setComment] = useState(initial?.comment ?? "");
  const [savedComment, setSavedComment] = useState(initial?.comment ?? "");
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!initial) return;
    setFeedbackId(initial.id);
    setRating(initial.rating);
    setComment(initial.comment ?? "");
    setSavedComment(initial.comment ?? "");
  }, [initial?.id, initial?.rating, initial?.comment]);

  const save = async (next: { rating: number; comment?: string | null }) => {
    setBusy(true);
    setError(null);
    try {
      if (feedbackId) {
        const patch: { rating: number; comment?: string | null } = { rating: next.rating };
        if (next.comment !== undefined) patch.comment = next.comment;
        const { error: e } = await supabase.from("feedback").update(patch).eq("id", feedbackId);
        if (e) throw e;
        return true;
      }
      const { data, error: e } = await supabase
        .from("feedback")
        .insert({
          source,
          target_key: targetKey,
          rating: next.rating,
          comment: next.comment ?? null,
          query_log_id: queryLogId ?? null,
          assessment_id: assessmentId ?? null,
          context: context as Json,
        })
        .select("id")
        .single();
      if (e && e.code === "23505") {
        // Esiste già un voto per lo stesso elemento (per esempio dopo un ricaricamento): lo aggiorna.
        const { data: { user } } = await supabase.auth.getUser();
        const { data: existing } = await supabase
          .from("feedback")
          .select("id")
          .eq("target_key", targetKey)
          .eq("author_id", user?.id ?? "")
          .maybeSingle();
        if (!existing) throw e;
        setFeedbackId(existing.id);
        const patch: { rating: number; comment?: string | null } = { rating: next.rating };
        if (next.comment !== undefined) patch.comment = next.comment;
        const { error: e2 } = await supabase.from("feedback").update(patch).eq("id", existing.id);
        if (e2) throw e2;
        return true;
      }
      if (e) throw e;
      setFeedbackId(data.id);
      return true;
    } catch (err) {
      console.error("Feedback non inviato:", err);
      setError(t.error);
      return false;
    } finally {
      setBusy(false);
    }
  };

  const vote = async (value: 1 | -1) => {
    if (busy) return;
    const previous = rating;
    setRating(value);
    setOpen(true);
    const ok = await save({ rating: value });
    if (!ok) {
      setRating(previous);
      setOpen(false);
    }
  };

  const sendComment = async () => {
    if (rating === null) return;
    const text = comment.trim().slice(0, 1000);
    const ok = await save({ rating, comment: text || null });
    if (ok) {
      setSavedComment(text);
      setOpen(false);
    }
  };

  const iconButton = (value: 1 | -1) => {
    const active = rating === value;
    const Icon = value === 1 ? ThumbsUp : ThumbsDown;
    return (
      <button
        type="button"
        onClick={() => vote(value)}
        disabled={busy}
        aria-label={value === 1 ? t.up : t.down}
        aria-pressed={active}
        title={value === 1 ? t.up : t.down}
        className={cn(
          "inline-flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground transition-colors",
          "hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
          "disabled:opacity-60",
          active && value === 1 && "text-emerald-600 dark:text-emerald-400",
          active && value === -1 && "text-rose-600 dark:text-rose-400",
        )}
      >
        <Icon className="h-3.5 w-3.5" fill={active ? "currentColor" : "none"} fillOpacity={active ? 0.15 : 0} />
      </button>
    );
  };

  return (
    <div className={cn("space-y-2", className)}>
      <div className="flex flex-wrap items-center gap-1">
        {prompt && <span className="mr-1 text-xs text-muted-foreground">{prompt}</span>}
        {iconButton(1)}
        {iconButton(-1)}
        {rating !== null && !open && (
          <span className="ml-1 inline-flex items-center gap-1 text-xs text-muted-foreground">
            <Check className="h-3 w-3" />
            {savedComment ? t.thanksComment : t.thanks}
            <button
              type="button"
              className="ml-1 underline-offset-2 hover:underline"
              onClick={() => setOpen(true)}
            >
              {t.edit}
            </button>
          </span>
        )}
      </div>
      {open && rating !== null && (
        <div className="max-w-xl space-y-2 rounded-md border bg-muted/30 p-2">
          <Textarea
            value={comment}
            onChange={(e) => setComment(e.target.value.slice(0, 1000))}
            placeholder={rating === 1 ? t.askUp : t.askDown}
            rows={2}
            className="min-h-[60px] resize-none bg-background text-sm"
            autoFocus
            onKeyDown={(e) => {
              if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) sendComment();
            }}
          />
          <div className="flex items-center justify-between gap-2">
            <span className="text-[11px] text-muted-foreground">{comment.length}/1000</span>
            <div className="flex gap-1">
              <Button type="button" size="sm" variant="ghost" className="h-7 px-2 text-xs" onClick={() => setOpen(false)}>
                <X className="mr-1 h-3 w-3" />
                {t.skip}
              </Button>
              <Button type="button" size="sm" className="h-7 px-3 text-xs" onClick={sendComment} disabled={busy}>
                {t.send}
              </Button>
            </div>
          </div>
        </div>
      )}
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}
