-- RegBrain Sentinel: AI Model Security Module
-- Tables for model scanning, dataset analysis, and compliance tracking

-- AI models registry
CREATE TABLE IF NOT EXISTS public.ai_models (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  model_type TEXT NOT NULL, -- 'pytorch', 'onnx', 'tensorflow', 'safetensors', etc.
  file_size BIGINT NOT NULL,
  file_hash TEXT NOT NULL, -- SHA-256 hash
  upload_date TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  metadata JSONB DEFAULT '{}'::jsonb,
  status TEXT NOT NULL DEFAULT 'pending', -- 'pending', 'scanning', 'completed', 'failed'
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Security scan results
CREATE TABLE IF NOT EXISTS public.model_scans (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  model_id UUID NOT NULL REFERENCES public.ai_models(id) ON DELETE CASCADE,
  scan_type TEXT NOT NULL, -- 'integrity', 'anomaly', 'compliance'
  trust_score INTEGER CHECK (trust_score >= 0 AND trust_score <= 100),
  risk_level TEXT NOT NULL, -- 'low', 'medium', 'high', 'critical'
  findings JSONB DEFAULT '[]'::jsonb,
  recommendations JSONB DEFAULT '[]'::jsonb,
  compliance_status JSONB DEFAULT '{}'::jsonb, -- AI Act, CRA compliance checks
  scan_date TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  scan_duration_ms INTEGER,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Dataset analysis results
CREATE TABLE IF NOT EXISTS public.dataset_analyses (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  model_id UUID NOT NULL REFERENCES public.ai_models(id) ON DELETE CASCADE,
  dataset_name TEXT NOT NULL,
  record_count INTEGER,
  anomaly_score DECIMAL(5,2),
  poisoning_indicators JSONB DEFAULT '[]'::jsonb,
  statistical_checks JSONB DEFAULT '{}'::jsonb,
  quality_metrics JSONB DEFAULT '{}'::jsonb,
  analysis_date TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Supply chain tracking
CREATE TABLE IF NOT EXISTS public.model_provenance (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  model_id UUID NOT NULL REFERENCES public.ai_models(id) ON DELETE CASCADE,
  source_url TEXT,
  source_organization TEXT,
  version TEXT,
  training_date TIMESTAMP WITH TIME ZONE,
  chain_of_custody JSONB DEFAULT '[]'::jsonb,
  verification_status TEXT DEFAULT 'unverified', -- 'verified', 'unverified', 'suspicious'
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Monitoring schedules
CREATE TABLE IF NOT EXISTS public.sentinel_monitoring (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  model_id UUID NOT NULL REFERENCES public.ai_models(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  frequency TEXT NOT NULL, -- 'daily', 'weekly', 'monthly'
  last_scan TIMESTAMP WITH TIME ZONE,
  next_scan TIMESTAMP WITH TIME ZONE NOT NULL,
  active BOOLEAN NOT NULL DEFAULT true,
  alert_threshold INTEGER DEFAULT 70, -- Trust score threshold for alerts
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.ai_models ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.model_scans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dataset_analyses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.model_provenance ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sentinel_monitoring ENABLE ROW LEVEL SECURITY;

-- RLS Policies for ai_models
CREATE POLICY "Users can view their own AI models"
  ON public.ai_models FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own AI models"
  ON public.ai_models FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own AI models"
  ON public.ai_models FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own AI models"
  ON public.ai_models FOR DELETE
  USING (auth.uid() = user_id);

-- RLS Policies for model_scans
CREATE POLICY "Users can view scans of their models"
  ON public.model_scans FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM public.ai_models
    WHERE ai_models.id = model_scans.model_id
    AND ai_models.user_id = auth.uid()
  ));

CREATE POLICY "Users can insert scans for their models"
  ON public.model_scans FOR INSERT
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.ai_models
    WHERE ai_models.id = model_scans.model_id
    AND ai_models.user_id = auth.uid()
  ));

-- RLS Policies for dataset_analyses
CREATE POLICY "Users can view analyses of their models"
  ON public.dataset_analyses FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM public.ai_models
    WHERE ai_models.id = dataset_analyses.model_id
    AND ai_models.user_id = auth.uid()
  ));

CREATE POLICY "Users can insert analyses for their models"
  ON public.dataset_analyses FOR INSERT
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.ai_models
    WHERE ai_models.id = dataset_analyses.model_id
    AND ai_models.user_id = auth.uid()
  ));

-- RLS Policies for model_provenance
CREATE POLICY "Users can view provenance of their models"
  ON public.model_provenance FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM public.ai_models
    WHERE ai_models.id = model_provenance.model_id
    AND ai_models.user_id = auth.uid()
  ));

CREATE POLICY "Users can manage provenance of their models"
  ON public.model_provenance FOR ALL
  USING (EXISTS (
    SELECT 1 FROM public.ai_models
    WHERE ai_models.id = model_provenance.model_id
    AND ai_models.user_id = auth.uid()
  ));

-- RLS Policies for sentinel_monitoring
CREATE POLICY "Users can view their monitoring schedules"
  ON public.sentinel_monitoring FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can manage their monitoring schedules"
  ON public.sentinel_monitoring FOR ALL
  USING (auth.uid() = user_id);

-- Indexes for performance
CREATE INDEX idx_ai_models_user_id ON public.ai_models(user_id);
CREATE INDEX idx_ai_models_status ON public.ai_models(status);
CREATE INDEX idx_model_scans_model_id ON public.model_scans(model_id);
CREATE INDEX idx_model_scans_risk_level ON public.model_scans(risk_level);
CREATE INDEX idx_dataset_analyses_model_id ON public.dataset_analyses(model_id);
CREATE INDEX idx_model_provenance_model_id ON public.model_provenance(model_id);
CREATE INDEX idx_sentinel_monitoring_next_scan ON public.sentinel_monitoring(next_scan) WHERE active = true;

-- Trigger for updated_at
CREATE TRIGGER update_ai_models_updated_at
  BEFORE UPDATE ON public.ai_models
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_model_provenance_updated_at
  BEFORE UPDATE ON public.model_provenance
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_sentinel_monitoring_updated_at
  BEFORE UPDATE ON public.sentinel_monitoring
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();