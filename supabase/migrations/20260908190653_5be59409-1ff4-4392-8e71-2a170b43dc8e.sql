-- 1. Citazioni a livello di comma su structured_chunks
ALTER TABLE public.structured_chunks
  ADD COLUMN IF NOT EXISTS paragraph text,
  ADD COLUMN IF NOT EXISTS letter text,
  ADD COLUMN IF NOT EXISTS citation_label text,
  ADD COLUMN IF NOT EXISTS chunk_key text,
  ADD COLUMN IF NOT EXISTS content_hash text,
  ADD COLUMN IF NOT EXISTS context_header text,
  ADD COLUMN IF NOT EXISTS unit_type text,
  ADD COLUMN IF NOT EXISTS celex text,
  ADD COLUMN IF NOT EXISTS lang text DEFAULT 'IT',
  ADD COLUMN IF NOT EXISTS valid_from date,
  ADD COLUMN IF NOT EXISTS valid_to date,
  ADD COLUMN IF NOT EXISTS source_format text;

CREATE UNIQUE INDEX IF NOT EXISTS structured_chunks_chunk_key_idx
  ON public.structured_chunks (chunk_key) WHERE chunk_key IS NOT NULL;
CREATE INDEX IF NOT EXISTS structured_chunks_validity_idx
  ON public.structured_chunks (regulation, valid_from, valid_to);
CREATE INDEX IF NOT EXISTS structured_chunks_par_idx
  ON public.structured_chunks (regulation, article_number, paragraph);

-- Backfill etichette di citazione per i testi già presenti
UPDATE public.structured_chunks
SET citation_label = COALESCE(citation_label,
      CASE WHEN article_number IS NOT NULL
           THEN regulation || ', art. ' || article_number::text
           ELSE regulation END),
    unit_type = COALESCE(unit_type, 'articolo'),
    lang = COALESCE(lang, 'IT'),
    source_format = COALESCE(source_format, 'txt')
WHERE citation_label IS NULL OR unit_type IS NULL OR source_format IS NULL;

-- 2. Golden set del retrieval
CREATE TABLE IF NOT EXISTS public.rag_golden_queries (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  query_text text NOT NULL,
  regulation text,
  category text NOT NULL DEFAULT 'generale',
  expected_articles text[] NOT NULL DEFAULT '{}',
  expected_chunk_keys text[] NOT NULL DEFAULT '{}',
  notes text,
  active boolean NOT NULL DEFAULT true,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

GRANT SELECT ON public.rag_golden_queries TO authenticated;
GRANT INSERT, UPDATE, DELETE ON public.rag_golden_queries TO authenticated;
GRANT ALL ON public.rag_golden_queries TO service_role;
ALTER TABLE public.rag_golden_queries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can read golden queries"
  ON public.rag_golden_queries FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins manage golden queries insert"
  ON public.rag_golden_queries FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins manage golden queries update"
  ON public.rag_golden_queries FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins manage golden queries delete"
  ON public.rag_golden_queries FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER update_rag_golden_queries_updated_at
  BEFORE UPDATE ON public.rag_golden_queries
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE IF NOT EXISTS public.rag_eval_runs (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  label text NOT NULL DEFAULT 'manuale',
  queries_total integer NOT NULL DEFAULT 0,
  recall_at_10 numeric,
  mrr numeric,
  article_precision numeric,
  rerank_enabled boolean NOT NULL DEFAULT false,
  details jsonb NOT NULL DEFAULT '[]'::jsonb,
  run_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT ON public.rag_eval_runs TO authenticated;
GRANT DELETE ON public.rag_eval_runs TO authenticated;
GRANT ALL ON public.rag_eval_runs TO service_role;
ALTER TABLE public.rag_eval_runs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can read eval runs"
  ON public.rag_eval_runs FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins can insert eval runs"
  ON public.rag_eval_runs FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can delete eval runs"
  ON public.rag_eval_runs FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER update_rag_eval_runs_updated_at
  BEFORE UPDATE ON public.rag_eval_runs
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 3. Ricerca con filtro di validità e metadati di citazione completi
CREATE OR REPLACE FUNCTION public.match_structured_chunks_v2(
  query_embedding vector,
  filter_regulation text DEFAULT NULL,
  filter_article_number integer DEFAULT NULL,
  as_of_date date DEFAULT CURRENT_DATE,
  match_threshold double precision DEFAULT 0.45,
  match_count integer DEFAULT 40
)
RETURNS TABLE(
  id uuid, document_id uuid, regulation text, article_reference text,
  article_number integer, paragraph text, letter text, citation_label text,
  chunk_key text, context_header text, section_hierarchy text,
  chunk_text text, cross_references text[], is_obligation boolean,
  valid_from date, valid_to date, similarity double precision
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  RETURN QUERY
  SELECT
    sc.id, sc.document_id, sc.regulation, sc.article_reference,
    sc.article_number, sc.paragraph, sc.letter, sc.citation_label,
    sc.chunk_key, sc.context_header, sc.section_hierarchy,
    sc.chunk_text, sc.cross_references, sc.is_obligation,
    sc.valid_from, sc.valid_to,
    1 - (sc.embedding <=> query_embedding) AS similarity
  FROM structured_chunks sc
  WHERE
    (filter_regulation IS NULL OR sc.regulation = filter_regulation)
    AND (filter_article_number IS NULL OR sc.article_number = filter_article_number)
    AND sc.embedding IS NOT NULL
    AND (sc.valid_from IS NULL OR sc.valid_from <= as_of_date)
    AND (sc.valid_to IS NULL OR sc.valid_to > as_of_date)
    AND 1 - (sc.embedding <=> query_embedding) > match_threshold
  ORDER BY sc.embedding <=> query_embedding
  LIMIT match_count;
END;
$function$;

REVOKE ALL ON FUNCTION public.match_structured_chunks_v2(vector, text, integer, date, double precision, integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.match_structured_chunks_v2(vector, text, integer, date, double precision, integer) TO authenticated, service_role;