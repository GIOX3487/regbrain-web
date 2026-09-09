-- Benchmark di Settore Tables

-- Table for sector benchmarks
CREATE TABLE public.sector_benchmarks (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  sector TEXT NOT NULL,
  jurisdiction TEXT NOT NULL,
  regulation TEXT NOT NULL,
  requirement_reference TEXT NOT NULL,
  adoption_percentage NUMERIC(5,2) NOT NULL CHECK (adoption_percentage BETWEEN 0 AND 100),
  average_compliance_score NUMERIC(5,2),
  common_gaps JSONB,
  best_practices JSONB,
  implementation_timeline_days INTEGER,
  average_cost_eur NUMERIC(12,2),
  last_updated TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  data_source TEXT,
  sample_size INTEGER,
  UNIQUE(sector, jurisdiction, regulation, requirement_reference)
);

ALTER TABLE public.sector_benchmarks ENABLE ROW LEVEL SECURITY;

-- Public read access for benchmarks (aggregated data, not sensitive)
CREATE POLICY "Benchmarks are publicly readable"
ON public.sector_benchmarks
FOR SELECT
USING (true);

-- Only admins can insert/update benchmarks
CREATE POLICY "Admins can manage benchmarks"
ON public.sector_benchmarks
FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role));

-- Table for assessment benchmarks (results of comparison)
CREATE TABLE public.assessment_benchmarks (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  assessment_id UUID NOT NULL REFERENCES public.compliance_assessments(id) ON DELETE CASCADE,
  sector_position_percentile NUMERIC(5,2),
  areas_ahead_of_market JSONB,
  areas_behind_market JSONB,
  sector_average_compliance NUMERIC(5,2),
  your_compliance NUMERIC(5,2),
  competitive_insights JSONB,
  quick_wins JSONB,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(assessment_id)
);

ALTER TABLE public.assessment_benchmarks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view benchmarks of own assessments"
ON public.assessment_benchmarks
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.compliance_assessments
    WHERE id = assessment_benchmarks.assessment_id
    AND user_id = auth.uid()
  )
);

CREATE POLICY "Users can create benchmarks for own assessments"
ON public.assessment_benchmarks
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.compliance_assessments
    WHERE id = assessment_id
    AND user_id = auth.uid()
  )
);

-- Trigger for updated_at
CREATE TRIGGER update_assessment_benchmarks_updated_at
BEFORE UPDATE ON public.assessment_benchmarks
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Indexes
CREATE INDEX idx_sector_benchmarks_sector ON public.sector_benchmarks(sector);
CREATE INDEX idx_sector_benchmarks_regulation ON public.sector_benchmarks(regulation);
CREATE INDEX idx_assessment_benchmarks_assessment_id ON public.assessment_benchmarks(assessment_id);

-- Seed some realistic benchmark data
INSERT INTO public.sector_benchmarks (sector, jurisdiction, regulation, requirement_reference, adoption_percentage, average_compliance_score, common_gaps, best_practices, implementation_timeline_days, average_cost_eur, data_source, sample_size) VALUES
-- GDPR benchmarks
('Technology', 'EU', 'GDPR', 'Art. 30 - RoPA', 78.5, 72.3, 
  '["Incomplete processor mapping", "Missing retention policies", "Outdated documentation"]'::jsonb,
  '["Automated RoPA tools", "Quarterly reviews", "Integration with DPM systems"]'::jsonb,
  90, 15000, 'EU Tech Compliance Survey 2024', 450),
  
('Technology', 'EU', 'GDPR', 'Art. 32 - Security Measures', 92.1, 85.7,
  '["Insufficient encryption at rest", "Weak access controls", "No security monitoring"]'::jsonb,
  '["Zero-trust architecture", "Automated patch management", "SOC 2 certification"]'::jsonb,
  180, 75000, 'EU Tech Compliance Survey 2024', 450),

('Healthcare', 'EU', 'GDPR', 'Art. 35 - DPIA', 85.2, 79.4,
  '["Incomplete risk assessments", "Missing stakeholder consultation", "No review cycles"]'::jsonb,
  '["DPIA templates", "Privacy by design methodology", "Annual DPIA reviews"]'::jsonb,
  120, 25000, 'Healthcare Privacy Report 2024', 320),

-- NIS2 benchmarks  
('Technology', 'EU', 'NIS2', 'Art. 21 - Cybersecurity Measures', 45.8, 58.2,
  '["No incident response plan", "Incomplete supply chain security", "Missing MFA"]'::jsonb,
  '["ISO 27001 alignment", "SIEM implementation", "Third-party risk assessment"]'::jsonb,
  240, 120000, 'EU Cyber Resilience Study 2024', 280),

('Finance', 'EU', 'GDPR', 'Art. 30 - RoPA', 91.3, 88.5,
  '["Third-party processor documentation", "Cross-border transfer details"]'::jsonb,
  '["Centralized GRC platform", "Automated compliance monitoring"]'::jsonb,
  60, 35000, 'Financial Sector Compliance 2024', 520),

-- AI Act benchmarks
('Technology', 'EU', 'AI Act', 'Art. 9 - Risk Management', 12.4, 35.8,
  '["No AI risk assessment framework", "Incomplete bias testing", "Missing human oversight"]'::jsonb,
  '["MLOps with compliance integration", "Automated bias detection", "AI governance board"]'::jsonb,
  365, 250000, 'AI Governance Readiness 2024', 150);
