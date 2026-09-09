-- Tabella per policy aziendali generate
CREATE TABLE public.generated_policies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  assessment_id UUID REFERENCES compliance_assessments(id) ON DELETE SET NULL,
  policy_type TEXT NOT NULL, -- 'incident_response', 'data_protection', 'access_control', etc.
  title TEXT NOT NULL,
  content JSONB NOT NULL, -- Struttura della policy
  version INTEGER NOT NULL DEFAULT 1,
  status TEXT NOT NULL DEFAULT 'draft', -- 'draft', 'approved', 'active'
  approved_by UUID REFERENCES auth.users(id),
  approved_at TIMESTAMP WITH TIME ZONE,
  review_date TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Tabella per registro rischi
CREATE TABLE public.risk_register (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  assessment_id UUID REFERENCES compliance_assessments(id) ON DELETE SET NULL,
  risk_id TEXT NOT NULL, -- ID univoco del rischio (es. "R-001")
  risk_category TEXT NOT NULL, -- 'cyber', 'operational', 'compliance', 'strategic'
  risk_title TEXT NOT NULL,
  risk_description TEXT NOT NULL,
  threat_source TEXT,
  vulnerability TEXT,
  likelihood TEXT NOT NULL, -- 'very_low', 'low', 'medium', 'high', 'very_high'
  impact TEXT NOT NULL, -- 'very_low', 'low', 'medium', 'high', 'very_high'
  inherent_risk_score NUMERIC NOT NULL, -- Score prima dei controlli
  existing_controls JSONB DEFAULT '[]'::jsonb,
  residual_risk_score NUMERIC NOT NULL, -- Score dopo i controlli
  risk_appetite TEXT NOT NULL, -- 'accept', 'mitigate', 'transfer', 'avoid'
  treatment_plan TEXT,
  owner TEXT, -- Responsabile del rischio
  review_frequency TEXT NOT NULL DEFAULT 'quarterly',
  last_review_date TIMESTAMP WITH TIME ZONE,
  next_review_date TIMESTAMP WITH TIME ZONE,
  status TEXT NOT NULL DEFAULT 'open', -- 'open', 'mitigated', 'closed', 'accepted'
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Tabella per tabletop exercises
CREATE TABLE public.tabletop_exercises (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  scenario_type TEXT NOT NULL, -- 'ransomware', 'data_breach', 'ddos', 'insider_threat', 'supply_chain'
  scenario_description TEXT NOT NULL,
  objectives JSONB NOT NULL DEFAULT '[]'::jsonb,
  participants JSONB NOT NULL DEFAULT '[]'::jsonb, -- Ruoli e nomi partecipanti
  duration_minutes INTEGER,
  scheduled_date TIMESTAMP WITH TIME ZONE,
  status TEXT NOT NULL DEFAULT 'planned', -- 'planned', 'in_progress', 'completed', 'cancelled'
  facilitator TEXT,
  injects JSONB DEFAULT '[]'::jsonb, -- Eventi da iniettare durante l'esercizio
  timeline JSONB DEFAULT '[]'::jsonb, -- Cronologia eventi durante esercizio
  lessons_learned JSONB DEFAULT '[]'::jsonb,
  action_items JSONB DEFAULT '[]'::jsonb,
  effectiveness_score NUMERIC, -- 0-100
  acn_compliant BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  completed_at TIMESTAMP WITH TIME ZONE
);

-- Tabella per report ACN
CREATE TABLE public.acn_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  report_type TEXT NOT NULL, -- 'incident', 'annual_compliance', 'risk_assessment', 'audit'
  reporting_period_start TIMESTAMP WITH TIME ZONE NOT NULL,
  reporting_period_end TIMESTAMP WITH TIME ZONE NOT NULL,
  content JSONB NOT NULL, -- Contenuto strutturato del report
  assessment_ids UUID[] DEFAULT ARRAY[]::UUID[],
  incident_ids UUID[] DEFAULT ARRAY[]::UUID[],
  status TEXT NOT NULL DEFAULT 'draft', -- 'draft', 'submitted', 'acknowledged'
  submitted_at TIMESTAMP WITH TIME ZONE,
  submission_reference TEXT, -- Numero protocollo ACN
  acn_response TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Tabella per training CDA
CREATE TABLE public.board_training (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  training_type TEXT NOT NULL, -- 'nis2_governance', 'cyber_risk', 'incident_management', 'regulatory_overview'
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  content JSONB NOT NULL, -- Moduli, slides, materiali
  duration_minutes INTEGER NOT NULL,
  mandatory BOOLEAN DEFAULT true,
  target_roles JSONB NOT NULL DEFAULT '["CEO", "Board Member", "CISO", "CRO"]'::jsonb,
  completion_criteria JSONB,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Tabella per tracking completamento training
CREATE TABLE public.training_completions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  training_id UUID NOT NULL REFERENCES board_training(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  team_member_id UUID REFERENCES team_members(id) ON DELETE CASCADE,
  started_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  completed_at TIMESTAMP WITH TIME ZONE,
  progress_percentage INTEGER NOT NULL DEFAULT 0,
  quiz_score NUMERIC,
  certificate_issued BOOLEAN DEFAULT false,
  certificate_url TEXT,
  UNIQUE(training_id, user_id, team_member_id)
);

-- Tabella per orchestrazione remediation
CREATE TABLE public.remediation_workflows (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  assessment_id UUID REFERENCES compliance_assessments(id) ON DELETE CASCADE,
  workflow_name TEXT NOT NULL,
  workflow_type TEXT NOT NULL, -- 'automated', 'semi_automated', 'manual'
  total_actions INTEGER NOT NULL DEFAULT 0,
  completed_actions INTEGER NOT NULL DEFAULT 0,
  current_phase TEXT NOT NULL, -- 'planning', 'execution', 'verification', 'completed'
  orchestration_rules JSONB DEFAULT '{}'::jsonb, -- Regole di automazione
  dependencies JSONB DEFAULT '[]'::jsonb, -- Dipendenze tra azioni
  milestones JSONB DEFAULT '[]'::jsonb,
  status TEXT NOT NULL DEFAULT 'active',
  start_date TIMESTAMP WITH TIME ZONE,
  target_completion_date TIMESTAMP WITH TIME ZONE,
  actual_completion_date TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Indici per performance
CREATE INDEX idx_generated_policies_user ON generated_policies(user_id);
CREATE INDEX idx_generated_policies_assessment ON generated_policies(assessment_id);
CREATE INDEX idx_risk_register_user ON risk_register(user_id);
CREATE INDEX idx_risk_register_status ON risk_register(status);
CREATE INDEX idx_tabletop_exercises_user ON tabletop_exercises(user_id);
CREATE INDEX idx_tabletop_exercises_status ON tabletop_exercises(status);
CREATE INDEX idx_acn_reports_user ON acn_reports(user_id);
CREATE INDEX idx_board_training_type ON board_training(training_type);
CREATE INDEX idx_training_completions_user ON training_completions(user_id);
CREATE INDEX idx_remediation_workflows_user ON remediation_workflows(user_id);

-- RLS Policies
ALTER TABLE public.generated_policies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.risk_register ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tabletop_exercises ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.acn_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.board_training ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.training_completions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.remediation_workflows ENABLE ROW LEVEL SECURITY;

-- Policies per generated_policies
CREATE POLICY "Users can view own policies" ON generated_policies FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can create own policies" ON generated_policies FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own policies" ON generated_policies FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own policies" ON generated_policies FOR DELETE USING (auth.uid() = user_id);

-- Policies per risk_register
CREATE POLICY "Users can view own risks" ON risk_register FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can create own risks" ON risk_register FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own risks" ON risk_register FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own risks" ON risk_register FOR DELETE USING (auth.uid() = user_id);

-- Policies per tabletop_exercises
CREATE POLICY "Users can view own exercises" ON tabletop_exercises FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can create own exercises" ON tabletop_exercises FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own exercises" ON tabletop_exercises FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own exercises" ON tabletop_exercises FOR DELETE USING (auth.uid() = user_id);

-- Policies per acn_reports
CREATE POLICY "Users can view own reports" ON acn_reports FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can create own reports" ON acn_reports FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own reports" ON acn_reports FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own reports" ON acn_reports FOR DELETE USING (auth.uid() = user_id);

-- Policies per board_training (visibile a tutti gli utenti autenticati)
CREATE POLICY "Authenticated users can view trainings" ON board_training FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Admins can manage trainings" ON board_training FOR ALL USING (has_role(auth.uid(), 'admin'));

-- Policies per training_completions
CREATE POLICY "Users can view own completions" ON training_completions FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can create own completions" ON training_completions FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own completions" ON training_completions FOR UPDATE USING (auth.uid() = user_id);

-- Policies per remediation_workflows
CREATE POLICY "Users can view own workflows" ON remediation_workflows FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can create own workflows" ON remediation_workflows FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own workflows" ON remediation_workflows FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own workflows" ON remediation_workflows FOR DELETE USING (auth.uid() = user_id);

-- Trigger per updated_at
CREATE TRIGGER update_generated_policies_updated_at BEFORE UPDATE ON generated_policies FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_risk_register_updated_at BEFORE UPDATE ON risk_register FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_tabletop_exercises_updated_at BEFORE UPDATE ON tabletop_exercises FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_acn_reports_updated_at BEFORE UPDATE ON acn_reports FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_board_training_updated_at BEFORE UPDATE ON board_training FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_remediation_workflows_updated_at BEFORE UPDATE ON remediation_workflows FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();