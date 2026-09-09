-- Modifica il trigger handle_new_user per NON creare profili per utenti demo
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
DROP FUNCTION IF EXISTS handle_new_user() CASCADE;

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER 
LANGUAGE plpgsql 
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- NON creare profili per gli account demo
  -- Gli account demo devono sempre passare attraverso l'onboarding
  IF NEW.email IN ('dpo@demo.regbrain.com', 'ciso@demo.regbrain.com') THEN
    RAISE LOG 'Skipping profile creation for demo account: %', NEW.email;
    RETURN NEW;
  END IF;
  
  -- Per tutti gli altri utenti, crea il profilo normalmente
  INSERT INTO public.profiles (id, jurisdiction, sector, compliance_role)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'jurisdiction', 'EU'),
    COALESCE(NEW.raw_user_meta_data->>'sector', 'Technology'),
    COALESCE(NEW.raw_user_meta_data->>'compliance_role', 'DPO')
  );
  
  RETURN NEW;
END;
$$;

-- Ricrea il trigger
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();