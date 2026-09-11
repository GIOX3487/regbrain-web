DO $$ BEGIN IF EXISTS (SELECT 1 FROM public.chunks WHERE embedding IS NOT NULL) THEN RAISE EXCEPTION 'Existing vectors require an explicit model migration'; END IF; END $$;
DROP INDEX IF EXISTS public.chunks_embedding_idx;
ALTER TABLE public.chunks ALTER COLUMN embedding TYPE public.vector(768);
CREATE INDEX chunks_embedding_idx ON public.chunks USING hnsw (embedding public.vector_cosine_ops);

