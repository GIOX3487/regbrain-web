ALTER TABLE public.identified_gaps
ADD COLUMN IF NOT EXISTS potential_fine_max_eur BIGINT,
ADD COLUMN IF NOT EXISTS fine_tier_basis TEXT;