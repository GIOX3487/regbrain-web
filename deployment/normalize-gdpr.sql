-- Normalize a PDF extraction artifact in the imported public GDPR corpus.
-- Source offsets refer to the original text; the official source file is preserved.
BEGIN;
UPDATE public.chunks c SET content=regexp_replace(c.content,'\mAr\s+ticolo\M','Articolo','gi')
FROM public.documents d WHERE d.id=c.document_id AND d.is_public AND d.title='GDPR - Regolamento (UE) 2016/679' AND c.content ~* '\mAr\s+ticolo\M';
UPDATE public.structured_chunks c SET chunk_text=regexp_replace(c.chunk_text,'\mAr\s+ticolo\M','Articolo','gi')
FROM public.documents d WHERE d.id=c.document_id AND d.is_public AND d.title='GDPR - Regolamento (UE) 2016/679' AND c.chunk_text ~* '\mAr\s+ticolo\M';
COMMIT;
SELECT count(*) AS article_37_chunks FROM public.chunks c JOIN public.documents d ON d.id=c.document_id WHERE d.is_public AND d.title='GDPR - Regolamento (UE) 2016/679' AND c.content ILIKE '%Articolo 37%';