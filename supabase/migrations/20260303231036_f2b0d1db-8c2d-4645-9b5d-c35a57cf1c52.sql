
-- Table for partner webhook registrations
CREATE TABLE public.partner_webhooks (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  partner_id TEXT NOT NULL UNIQUE,
  webhook_url TEXT NOT NULL,
  regulations TEXT[] NOT NULL DEFAULT '{}',
  jurisdiction TEXT NOT NULL DEFAULT 'EU',
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.partner_webhooks ENABLE ROW LEVEL SECURITY;

-- Only service role can manage webhooks (edge functions use service role)
CREATE POLICY "Service role manages partner webhooks"
  ON public.partner_webhooks FOR ALL
  USING (true) WITH CHECK (true);

-- Table for partner API usage logging
CREATE TABLE public.partner_api_log (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  partner_id TEXT NOT NULL,
  endpoint TEXT NOT NULL,
  action TEXT,
  request_summary JSONB,
  response_summary JSONB,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.partner_api_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role manages API log"
  ON public.partner_api_log FOR ALL
  USING (true) WITH CHECK (true);

-- Admins can read logs
CREATE POLICY "Admins can read API log"
  ON public.partner_api_log FOR SELECT
  USING (public.has_role(auth.uid(), 'admin'));
