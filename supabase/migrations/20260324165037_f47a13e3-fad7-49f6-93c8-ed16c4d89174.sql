
-- Create structured_chunks table
CREATE TABLE public.structured_chunks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id uuid NOT NULL REFERENCES public.documents(id) ON DELETE CASCADE,
  regulation text NOT NULL,
  article_reference text,
  article_number integer,
  section_hierarchy text,
  chunk_text text NOT NULL,
  embedding vector(768),
  cross_references text[] DEFAULT '{}',
  is_obligation boolean DEFAULT false,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Indexes for fast filtering
CREATE INDEX idx_structured_chunks_regulation ON public.structured_chunks(regulation);
CREATE INDEX idx_structured_chunks_article_number ON public.structured_chunks(article_number);
CREATE INDEX idx_structured_chunks_document_id ON public.structured_chunks(document_id);
CREATE INDEX idx_structured_chunks_reg_article ON public.structured_chunks(regulation, article_number);

-- Vector similarity index
CREATE INDEX idx_structured_chunks_embedding ON public.structured_chunks
  USING hnsw (embedding vector_cosine_ops);

-- Enable RLS
ALTER TABLE public.structured_chunks ENABLE ROW LEVEL SECURITY;

-- RLS: authenticated users can read all structured chunks (same as documents)
CREATE POLICY "Authenticated users can view structured chunks"
  ON public.structured_chunks
  FOR SELECT
  TO authenticated
  USING (true);

-- Match function for structured_chunks vector search
CREATE OR REPLACE FUNCTION public.match_structured_chunks(
  query_embedding vector,
  filter_regulation text DEFAULT NULL,
  filter_article_number integer DEFAULT NULL,
  match_threshold double precision DEFAULT 0.55,
  match_count integer DEFAULT 20
)
RETURNS TABLE(
  id uuid,
  document_id uuid,
  regulation text,
  article_reference text,
  article_number integer,
  section_hierarchy text,
  chunk_text text,
  cross_references text[],
  is_obligation boolean,
  similarity double precision
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  RETURN QUERY
  SELECT
    sc.id,
    sc.document_id,
    sc.regulation,
    sc.article_reference,
    sc.article_number,
    sc.section_hierarchy,
    sc.chunk_text,
    sc.cross_references,
    sc.is_obligation,
    1 - (sc.embedding <=> query_embedding) AS similarity
  FROM structured_chunks sc
  WHERE
    (filter_regulation IS NULL OR sc.regulation = filter_regulation)
    AND (filter_article_number IS NULL OR sc.article_number = filter_article_number)
    AND sc.embedding IS NOT NULL
    AND 1 - (sc.embedding <=> query_embedding) > match_threshold
  ORDER BY sc.embedding <=> query_embedding
  LIMIT match_count;
END;
$$;
