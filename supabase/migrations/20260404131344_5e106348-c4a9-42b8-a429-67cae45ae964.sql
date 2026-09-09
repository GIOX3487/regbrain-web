-- Create table for dynamic regulatory requirements catalog
CREATE TABLE IF NOT EXISTS public.regulatory_requirements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  requirement_id text UNIQUE NOT NULL,
  regulation text NOT NULL,
  reference text NOT NULL,
  article_number integer NOT NULL,
  paragraph text,
  description_it text NOT NULL,
  description_en text NOT NULL,
  risk_level text NOT NULL DEFAULT 'high',
  remediation_effort text NOT NULL DEFAULT 'medium',
  coverage_keywords text[] NOT NULL DEFAULT '{}',
  rag_validation_keywords text[] NOT NULL DEFAULT '{}',
  gap_description_it text NOT NULL,
  gap_description_en text NOT NULL,
  recommended_action_it text NOT NULL,
  recommended_action_en text NOT NULL,
  action_hours integer NOT NULL DEFAULT 24,
  action_cost_eur integer NOT NULL DEFAULT 2040,
  coverage_threshold float DEFAULT 0.10,
  min_keyword_matches integer DEFAULT 1,
  source text NOT NULL DEFAULT 'auto_extracted',
  verified boolean NOT NULL DEFAULT false,
  active boolean NOT NULL DEFAULT true,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);

-- Indexes for performance
CREATE INDEX idx_rr_regulation ON public.regulatory_requirements(regulation);
CREATE INDEX idx_rr_active ON public.regulatory_requirements(active);
CREATE INDEX idx_rr_regulation_active ON public.regulatory_requirements(regulation, active);

-- Enable RLS
ALTER TABLE public.regulatory_requirements ENABLE ROW LEVEL SECURITY;

-- Authenticated users can read active requirements
CREATE POLICY "Authenticated users can view active requirements"
  ON public.regulatory_requirements
  FOR SELECT
  TO authenticated
  USING (true);

-- Admins can manage all requirements
CREATE POLICY "Admins can manage requirements"
  ON public.regulatory_requirements
  FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Service role full access (for edge functions)
CREATE POLICY "Service role full access"
  ON public.regulatory_requirements
  FOR ALL
  USING (((current_setting('request.jwt.claims'::text, true))::json ->> 'role'::text) = 'service_role')
  WITH CHECK (((current_setting('request.jwt.claims'::text, true))::json ->> 'role'::text) = 'service_role');

-- Trigger for updated_at
CREATE TRIGGER update_regulatory_requirements_updated_at
  BEFORE UPDATE ON public.regulatory_requirements
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();