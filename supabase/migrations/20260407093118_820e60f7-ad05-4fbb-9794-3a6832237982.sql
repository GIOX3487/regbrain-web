
CREATE TABLE IF NOT EXISTS public.partner_api_tokens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  partner_id text UNIQUE NOT NULL,
  tenant_id text UNIQUE NOT NULL,
  client_secret_hash text NOT NULL,
  refresh_token_hash text,
  refresh_token_expires_at timestamptz,
  scopes text[] NOT NULL DEFAULT ARRAY['chat', 'analyze', 'updates', 'assessments', 'health'],
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.partner_api_tokens ENABLE ROW LEVEL SECURITY;

CREATE INDEX idx_partner_tokens_tenant ON public.partner_api_tokens(tenant_id);
CREATE INDEX idx_partner_tokens_partner ON public.partner_api_tokens(partner_id);

CREATE TRIGGER update_partner_api_tokens_updated_at
  BEFORE UPDATE ON public.partner_api_tokens
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
