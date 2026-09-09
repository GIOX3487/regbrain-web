-- Compliance Assessment System Tables

-- Table for compliance assessments
CREATE TABLE public.compliance_assessments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  assessment_type TEXT NOT NULL CHECK (assessment_type IN ('gap_analysis', 'full_audit', 'targeted_review')),
  scope_jurisdiction TEXT NOT NULL,
  scope_sector TEXT NOT NULL,
  scope_regulations TEXT[] NOT NULL DEFAULT '{}',
  status TEXT NOT NULL DEFAULT 'in_progress' CHECK (status IN ('in_progress', 'completed', 'archived')),
  overall_risk_score NUMERIC(5,2),
  overall_compliance_percentage NUMERIC(5,2),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  completed_at TIMESTAMP WITH TIME ZONE
);

ALTER TABLE public.compliance_assessments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own assessments"
ON public.compliance_assessments
FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can create own assessments"
ON public.compliance_assessments
FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own assessments"
ON public.compliance_assessments
FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own assessments"
ON public.compliance_assessments
FOR DELETE
USING (auth.uid() = user_id);

-- Table for identified gaps
CREATE TABLE public.identified_gaps (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  assessment_id UUID NOT NULL REFERENCES public.compliance_assessments(id) ON DELETE CASCADE,
  requirement_reference TEXT NOT NULL,
  requirement_description TEXT NOT NULL,
  current_state TEXT,
  gap_description TEXT NOT NULL,
  risk_level TEXT NOT NULL CHECK (risk_level IN ('critical', 'high', 'medium', 'low')),
  risk_score NUMERIC(5,2) NOT NULL,
  potential_fine_eur NUMERIC(15,2),
  priority INTEGER NOT NULL CHECK (priority BETWEEN 1 AND 5),
  remediation_effort TEXT CHECK (remediation_effort IN ('low', 'medium', 'high', 'very_high')),
  recommended_actions JSONB,
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'in_progress', 'resolved', 'accepted_risk')),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  resolved_at TIMESTAMP WITH TIME ZONE
);

ALTER TABLE public.identified_gaps ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view gaps of own assessments"
ON public.identified_gaps
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.compliance_assessments
    WHERE id = identified_gaps.assessment_id
    AND user_id = auth.uid()
  )
);

CREATE POLICY "Users can create gaps for own assessments"
ON public.identified_gaps
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.compliance_assessments
    WHERE id = assessment_id
    AND user_id = auth.uid()
  )
);

CREATE POLICY "Users can update gaps of own assessments"
ON public.identified_gaps
FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM public.compliance_assessments
    WHERE id = identified_gaps.assessment_id
    AND user_id = auth.uid()
  )
);

CREATE POLICY "Users can delete gaps of own assessments"
ON public.identified_gaps
FOR DELETE
USING (
  EXISTS (
    SELECT 1 FROM public.compliance_assessments
    WHERE id = identified_gaps.assessment_id
    AND user_id = auth.uid()
  )
);

-- Table for generated audit documents
CREATE TABLE public.generated_documents (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  assessment_id UUID REFERENCES public.compliance_assessments(id) ON DELETE SET NULL,
  document_type TEXT NOT NULL CHECK (document_type IN ('dpia', 'ropa', 'lia', 'gap_report', 'action_plan')),
  title TEXT NOT NULL,
  content JSONB NOT NULL,
  metadata JSONB,
  version INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.generated_documents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own generated documents"
ON public.generated_documents
FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can create own generated documents"
ON public.generated_documents
FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own generated documents"
ON public.generated_documents
FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own generated documents"
ON public.generated_documents
FOR DELETE
USING (auth.uid() = user_id);

-- Table for action plans
CREATE TABLE public.action_plans (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  assessment_id UUID NOT NULL REFERENCES public.compliance_assessments(id) ON DELETE CASCADE,
  gap_id UUID REFERENCES public.identified_gaps(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  priority INTEGER NOT NULL CHECK (priority BETWEEN 1 AND 5),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'in_progress', 'completed', 'blocked')),
  assigned_to TEXT,
  due_date TIMESTAMP WITH TIME ZONE,
  estimated_cost_eur NUMERIC(12,2),
  estimated_hours INTEGER,
  progress_percentage INTEGER DEFAULT 0 CHECK (progress_percentage BETWEEN 0 AND 100),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  completed_at TIMESTAMP WITH TIME ZONE
);

ALTER TABLE public.action_plans ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view action plans of own assessments"
ON public.action_plans
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.compliance_assessments
    WHERE id = action_plans.assessment_id
    AND user_id = auth.uid()
  )
);

CREATE POLICY "Users can create action plans for own assessments"
ON public.action_plans
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.compliance_assessments
    WHERE id = assessment_id
    AND user_id = auth.uid()
  )
);

CREATE POLICY "Users can update action plans of own assessments"
ON public.action_plans
FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM public.compliance_assessments
    WHERE id = action_plans.assessment_id
    AND user_id = auth.uid()
  )
);

CREATE POLICY "Users can delete action plans of own assessments"
ON public.action_plans
FOR DELETE
USING (
  EXISTS (
    SELECT 1 FROM public.compliance_assessments
    WHERE id = action_plans.assessment_id
    AND user_id = auth.uid()
  )
);

-- Triggers for updated_at
CREATE TRIGGER update_compliance_assessments_updated_at
BEFORE UPDATE ON public.compliance_assessments
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_identified_gaps_updated_at
BEFORE UPDATE ON public.identified_gaps
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_generated_documents_updated_at
BEFORE UPDATE ON public.generated_documents
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_action_plans_updated_at
BEFORE UPDATE ON public.action_plans
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Indexes for performance
CREATE INDEX idx_compliance_assessments_user_id ON public.compliance_assessments(user_id);
CREATE INDEX idx_compliance_assessments_status ON public.compliance_assessments(status);
CREATE INDEX idx_identified_gaps_assessment_id ON public.identified_gaps(assessment_id);
CREATE INDEX idx_identified_gaps_risk_level ON public.identified_gaps(risk_level);
CREATE INDEX idx_identified_gaps_priority ON public.identified_gaps(priority);
CREATE INDEX idx_generated_documents_user_id ON public.generated_documents(user_id);
CREATE INDEX idx_generated_documents_type ON public.generated_documents(document_type);
CREATE INDEX idx_action_plans_assessment_id ON public.action_plans(assessment_id);
CREATE INDEX idx_action_plans_status ON public.action_plans(status);