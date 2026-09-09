CREATE TABLE IF NOT EXISTS public.gap_analysis_cache (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  cache_key TEXT NOT NULL,
  input_fingerprint TEXT NOT NULL,
  regulations TEXT[] NOT NULL DEFAULT '{}',
  language TEXT NOT NULL DEFAULT 'it',
  documents_count INTEGER NOT NULL DEFAULT 0,
  result_payload JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT gap_analysis_cache_unique_key UNIQUE (user_id, cache_key)
);

ALTER TABLE public.gap_analysis_cache ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own gap cache"
ON public.gap_analysis_cache
FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own gap cache"
ON public.gap_analysis_cache
FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own gap cache"
ON public.gap_analysis_cache
FOR UPDATE
USING (auth.uid() = user_id);

CREATE INDEX idx_gap_analysis_cache_user_key
ON public.gap_analysis_cache(user_id, cache_key);

CREATE TRIGGER update_gap_analysis_cache_updated_at
BEFORE UPDATE ON public.gap_analysis_cache
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();