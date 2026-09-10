BEGIN;
DO $$
DECLARE a uuid:=gen_random_uuid(); b uuid:=gen_random_uuid(); da uuid:=gen_random_uuid(); db uuid:=gen_random_uuid(); n integer;
BEGIN
 INSERT INTO auth.users(id,email,raw_app_meta_data) VALUES(a,'test-'||a||'@example.invalid','{}'),(b,'test-'||b||'@example.invalid','{}');
 INSERT INTO public.profiles(id,jurisdiction,sector,compliance_role) VALUES(a,'IT','tech','dpo'),(b,'EU','finance','ciso');
 INSERT INTO public.documents(id,title,jurisdiction,sector,created_by) VALUES(da,'Private A','IT','tech',a),(db,'Private B','EU','finance',b);
 INSERT INTO public.chunks(document_id,content) VALUES(da,'Only A'),(db,'Only B');
 PERFORM set_config('request.jwt.claims',json_build_object('sub',a,'role','authenticated')::text,true);
 EXECUTE 'SET LOCAL ROLE authenticated';
 SELECT count(*) INTO n FROM public.profiles WHERE id IN(a,b);
 IF n<>1 THEN RAISE EXCEPTION 'Profile isolation failed'; END IF;
 SELECT count(*) INTO n FROM public.documents WHERE id IN(da,db);
 IF n<>1 THEN RAISE EXCEPTION 'Document isolation failed'; END IF;
 SELECT count(*) INTO n FROM public.chunks WHERE document_id IN(da,db);
 IF n<>1 THEN RAISE EXCEPTION 'Chunk isolation failed'; END IF;
 BEGIN
  UPDATE public.demo_sessions SET expires_at=now()+interval '10 years';
  RAISE EXCEPTION 'Demo expiry must not be editable';
 EXCEPTION WHEN insufficient_privilege THEN NULL;
 END;
 EXECUTE 'RESET ROLE';
 UPDATE auth.users SET raw_app_meta_data=jsonb_build_object('is_demo',true,'demo_expires_at',now()-interval '1 hour') WHERE id=a;
 EXECUTE 'SET LOCAL ROLE authenticated';
 SELECT count(*) INTO n FROM public.profiles WHERE id=a;
 IF n<>0 THEN RAISE EXCEPTION 'Expired account can still read'; END IF;
 EXECUTE 'RESET ROLE';
 PERFORM public.cleanup_expired_demo_sessions();
 IF EXISTS(SELECT 1 FROM auth.users WHERE id=a) THEN RAISE EXCEPTION 'Cleanup failed'; END IF;
 IF NOT EXISTS(SELECT 1 FROM auth.users WHERE id=b) THEN RAISE EXCEPTION 'Cleanup deleted unrelated user'; END IF;
END $$;
ROLLBACK;
SELECT 'PASS: profile/document/chunk isolation, server-owned expiry, expired access denial, scoped cleanup' AS verification;
