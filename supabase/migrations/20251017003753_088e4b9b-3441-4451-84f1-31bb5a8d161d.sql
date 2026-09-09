-- Fix security warning: set search_path per la funzione
DROP FUNCTION IF EXISTS delete_demo_profile_on_session_end() CASCADE;

CREATE OR REPLACE FUNCTION delete_demo_profile_on_session_end()
RETURNS TRIGGER 
LANGUAGE plpgsql 
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Controlla se l'utente è un account demo
  IF EXISTS (
    SELECT 1 FROM auth.users 
    WHERE id = OLD.user_id 
    AND email IN ('dpo@demo.regbrain.com', 'ciso@demo.regbrain.com')
  ) THEN
    -- Elimina il profilo se esiste
    DELETE FROM profiles WHERE id = OLD.user_id;
    RAISE LOG 'Demo profile deleted for user %', OLD.user_id;
  END IF;
  
  RETURN OLD;
END;
$$;