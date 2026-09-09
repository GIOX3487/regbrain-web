-- PULIZIA DEFINITIVA: Cancella TUTTI i profili demo esistenti
-- Esegue una pulizia completa per risolvere il problema dei profili persistenti

DO $$
DECLARE
  demo_emails TEXT[] := ARRAY['dpo@demo.regbrain.com', 'ciso@demo.regbrain.com'];
  demo_email TEXT;
  demo_user_id UUID;
  deleted_count INTEGER := 0;
BEGIN
  FOREACH demo_email IN ARRAY demo_emails
  LOOP
    -- Trova l'ID dell'utente demo
    SELECT id INTO demo_user_id 
    FROM auth.users 
    WHERE email = demo_email;
    
    -- Cancella il profilo se esiste
    IF demo_user_id IS NOT NULL THEN
      DELETE FROM public.profiles WHERE id = demo_user_id;
      GET DIAGNOSTICS deleted_count = ROW_COUNT;
      
      IF deleted_count > 0 THEN
        RAISE NOTICE 'Deleted profile for %', demo_email;
      ELSE
        RAISE NOTICE 'No profile found for %', demo_email;
      END IF;
    ELSE
      RAISE NOTICE 'No user found for %', demo_email;
    END IF;
  END LOOP;
  
  RAISE NOTICE 'Demo profile cleanup completed';
END $$;