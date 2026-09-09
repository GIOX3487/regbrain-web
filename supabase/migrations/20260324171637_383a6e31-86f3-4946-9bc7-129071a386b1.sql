
ALTER TABLE public.identified_gaps 
  ADD COLUMN IF NOT EXISTS source_chunk_id uuid REFERENCES public.chunks(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS article_text_excerpt text,
  ADD COLUMN IF NOT EXISTS detection_method text DEFAULT 'keyword';
