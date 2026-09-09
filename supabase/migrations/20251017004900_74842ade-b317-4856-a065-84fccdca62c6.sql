-- SOLUZIONE DEFINITIVA: Cancella i profili demo esistenti nel database
-- Gli account demo devono SEMPRE passare per l'onboarding

-- Trova gli ID degli utenti demo e cancella i loro profili
DO $$
DECLARE
  dpo_user_id UUID;
  ciso_user_id UUID;
BEGIN
  -- Trova l'ID dell'utente DPO demo
  SELECT id INTO dpo_user_id 
  FROM auth.users 
  WHERE email = 'dpo@demo.regbrain.com';
  
  -- Trova l'ID dell'utente CISO demo
  SELECT id INTO ciso_user_id 
  FROM auth.users 
  WHERE email = 'ciso@demo.regbrain.com';
  
  -- Cancella i profili se esistono
  IF dpo_user_id IS NOT NULL THEN
    DELETE FROM public.profiles WHERE id = dpo_user_id;
    RAISE NOTICE 'Deleted DPO demo profile';
  END IF;
  
  IF ciso_user_id IS NOT NULL THEN
    DELETE FROM public.profiles WHERE id = ciso_user_id;
    RAISE NOTICE 'Deleted CISO demo profile';
  END IF;
END $$;