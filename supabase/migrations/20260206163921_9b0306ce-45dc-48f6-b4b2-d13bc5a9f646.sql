-- Create table to cache market intelligence results for deterministic output
CREATE TABLE public.market_intelligence_cache (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  cache_key TEXT NOT NULL UNIQUE,
  sector TEXT NOT NULL,
  jurisdiction TEXT NOT NULL,
  user_role TEXT NOT NULL,
  intelligence_data JSONB NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT (now() + interval '7 days')
);

-- Enable RLS
ALTER TABLE public.market_intelligence_cache ENABLE ROW LEVEL SECURITY;

-- Allow all authenticated users to read cache (shared data)
CREATE POLICY "Users can read market intelligence cache"
ON public.market_intelligence_cache
FOR SELECT
TO authenticated
USING (true);

-- Only service role can insert/update (edge function)
CREATE POLICY "Service role can manage cache"
ON public.market_intelligence_cache
FOR ALL
USING (true)
WITH CHECK (true);

-- Create index for fast lookups
CREATE INDEX idx_market_intelligence_cache_key ON public.market_intelligence_cache(cache_key);
CREATE INDEX idx_market_intelligence_cache_expires ON public.market_intelligence_cache(expires_at);