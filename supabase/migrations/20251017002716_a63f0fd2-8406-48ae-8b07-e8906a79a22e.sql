-- Elimina i profili degli utenti demo esistenti per forzare l'onboarding
DELETE FROM profiles 
WHERE id IN (
  SELECT id FROM auth.users 
  WHERE email IN ('dpo@demo.regbrain.com', 'ciso@demo.regbrain.com')
);