-- SOLUZIONE PERMANENTE: Elimina profili demo ad ogni logout
-- Elimina i profili demo esistenti SUBITO
DELETE FROM profiles 
WHERE id IN (
  SELECT id FROM auth.users 
  WHERE email IN ('dpo@demo.regbrain.com', 'ciso@demo.regbrain.com')
);

-- Crea una funzione trigger che elimina automaticamente il profilo demo quando l'utente si disconnette
-- Questo garantisce che gli utenti demo partano SEMPRE dall'onboarding
CREATE OR REPLACE FUNCTION delete_demo_profile_on_session_end()
RETURNS TRIGGER AS $$
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
$$ LANGUAGE plpgsql SECURITY DEFINER;