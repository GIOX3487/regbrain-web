-- Create table for granular user document embeddings
CREATE TABLE IF NOT EXISTS public.user_document_embeddings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  assessment_id uuid REFERENCES public.compliance_assessments(id) ON DELETE CASCADE NOT NULL,
  document_name text NOT NULL,
  document_type text,
  section_text text NOT NULL,
  section_index integer NOT NULL DEFAULT 0,
  embedding vector(768),
  created_at timestamp with time zone DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.user_document_embeddings ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Users can view own document embeddings"
  ON public.user_document_embeddings FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create own document embeddings"
  ON public.user_document_embeddings FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own document embeddings"
  ON public.user_document_embeddings FOR DELETE
  USING (auth.uid() = user_id);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_ude_assessment ON public.user_document_embeddings(assessment_id);
CREATE INDEX IF NOT EXISTS idx_ude_user ON public.user_document_embeddings(user_id);
CREATE INDEX IF NOT EXISTS idx_ude_embedding ON public.user_document_embeddings 
  USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);

-- RPC function for semantic search
CREATE OR REPLACE FUNCTION public.match_user_document_sections(
  query_embedding vector(768),
  filter_assessment_id uuid,
  match_threshold float DEFAULT 0.65,
  match_count int DEFAULT 5
)
RETURNS TABLE (
  id uuid,
  document_name text,
  section_text text,
  section_index integer,
  similarity float
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT
    ude.id,
    ude.document_name,
    ude.section_text,
    ude.section_index,
    (1 - (ude.embedding <=> query_embedding))::float as similarity
  FROM user_document_embeddings ude
  WHERE ude.assessment_id = filter_assessment_id
    AND 1 - (ude.embedding <=> query_embedding) > match_threshold
  ORDER BY ude.embedding <=> query_embedding
  LIMIT match_count;
END;
$$;

-- Add semantic_similarity column to identified_gaps
ALTER TABLE public.identified_gaps 
  ADD COLUMN IF NOT EXISTS semantic_similarity numeric;