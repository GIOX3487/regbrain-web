ALTER TABLE public.chunks ADD COLUMN IF NOT EXISTS embedding_model text;
ALTER TABLE public.structured_chunks ADD COLUMN IF NOT EXISTS embedding_model text;
CREATE OR REPLACE FUNCTION public.save_normative_embeddings(items jsonb)
RETURNS integer LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
DECLARE item jsonb; stored integer := 0; changed integer; v public.vector; doc_id uuid; source_text text;
BEGIN
 IF jsonb_typeof(items) <> 'array' OR jsonb_array_length(items) NOT BETWEEN 1 AND 20 THEN RAISE EXCEPTION 'Batch must contain 1 to 20 items'; END IF;
 FOR item IN SELECT value FROM jsonb_array_elements(items) LOOP
  IF jsonb_typeof(item->'embedding') <> 'array' OR jsonb_array_length(item->'embedding') <> 768 THEN RAISE EXCEPTION 'Expected 768 dimensions'; END IF;
  v := (item->'embedding')::text::public.vector;
  IF abs(public.vector_norm(v)-1)>0.0001 THEN RAISE EXCEPTION 'Vector must be normalized'; END IF;
  source_text := item->>'content';
  UPDATE public.chunks c SET embedding=v,embedding_model='gemini-embedding-001:RETRIEVAL_DOCUMENT:768'
  FROM public.documents d WHERE c.id=(item->>'id')::uuid AND d.id=c.document_id AND d.is_public AND c.content=source_text AND c.embedding IS NULL
  RETURNING c.document_id INTO doc_id;
  GET DIAGNOSTICS changed=ROW_COUNT;
  IF changed <> 1 THEN RAISE EXCEPTION 'Chunk missing, changed, private or already indexed'; END IF;
  UPDATE public.structured_chunks s SET embedding=v,embedding_model='gemini-embedding-001:RETRIEVAL_DOCUMENT:768'
  WHERE s.document_id=doc_id AND s.chunk_text=source_text;
  stored:=stored+1;
 END LOOP;
 RETURN stored;
END $$;
REVOKE ALL ON FUNCTION public.save_normative_embeddings(jsonb) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.save_normative_embeddings(jsonb) TO service_role;

