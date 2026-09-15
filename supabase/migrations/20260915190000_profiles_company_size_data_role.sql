-- Profilo: dimensione aziendale e ruolo nel trattamento, usati dal RAG per ridurre le domande di chiarimento
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS company_size text,
  ADD COLUMN IF NOT EXISTS data_role text;

ALTER TABLE public.profiles
  DROP CONSTRAINT IF EXISTS profiles_company_size_check,
  DROP CONSTRAINT IF EXISTS profiles_data_role_check;

ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_company_size_check
    CHECK (company_size IS NULL OR company_size IN ('micro','small','medium','large','unknown')),
  ADD CONSTRAINT profiles_data_role_check
    CHECK (data_role IS NULL OR data_role IN ('controller','processor','both','unknown'));

COMMENT ON COLUMN public.profiles.company_size IS 'micro <10 addetti, small 10-49, medium 50-249, large 250+, unknown';
COMMENT ON COLUMN public.profiles.data_role IS 'controller = titolare, processor = responsabile, both, unknown';
