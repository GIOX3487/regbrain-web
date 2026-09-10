-- Administrator-only importer for the source texts supplied with this project.
CREATE OR REPLACE FUNCTION private.import_regbrain_source(file_name text, document_title text, regulation_name text, official_url text)
RETURNS integer LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
DECLARE response extensions.http_response; doc uuid; total integer;
BEGIN
 IF file_name !~ '^[a-z0-9-]+\.txt$' THEN RAISE EXCEPTION 'Invalid source file'; END IF;
 IF EXISTS(SELECT 1 FROM public.documents WHERE title=document_title AND is_public) THEN
  SELECT count(*) INTO total FROM public.chunks c JOIN public.documents d ON d.id=c.document_id WHERE d.title=document_title AND d.is_public;
  RETURN total;
 END IF;
 SELECT * INTO response FROM extensions.http_get('https://regbrain-web.vercel.app/documents/'||file_name);
 IF response.status <> 200 OR length(response.content)<1000 OR left(ltrim(response.content),1)='<' THEN
  RAISE EXCEPTION 'Source not available: %',file_name;
 END IF;
 INSERT INTO public.documents(title,source_url,jurisdiction,sector,language,version,is_public)
 VALUES(document_title,official_url,'EU','generale','IT','ZIP-2026-09-08',true) RETURNING id INTO doc;
 INSERT INTO public.chunks(document_id,content,start_pos,end_pos)
 SELECT doc,substring(response.content from pos for 2000),pos-1,least(pos+1999,length(response.content))
 FROM generate_series(1,length(response.content),1800) pos;
 GET DIAGNOSTICS total=ROW_COUNT;
 -- Preserve source text without manufacturing semantic vectors or article citations.
 INSERT INTO public.structured_chunks(document_id,regulation,chunk_text,source_format,lang)
 SELECT doc,regulation_name,content,'text','IT' FROM public.chunks WHERE document_id=doc;
 RETURN total;
END $$;
REVOKE ALL ON FUNCTION private.import_regbrain_source(text,text,text,text) FROM PUBLIC,anon,authenticated,service_role;

