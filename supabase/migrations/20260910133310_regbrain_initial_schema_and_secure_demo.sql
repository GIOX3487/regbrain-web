-- Source: 20251012163221_59f3780d-1f9d-4317-b422-a156dbc31653.sql
-- Enable pgvector extension for embeddings
CREATE EXTENSION IF NOT EXISTS vector;

-- Create profiles table
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  jurisdiction TEXT NOT NULL,
  sector TEXT NOT NULL,
  compliance_role TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Enable RLS on profiles
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Profiles policies
CREATE POLICY "Users can view own profile"
  ON public.profiles FOR SELECT
  USING (auth.uid() = id);

CREATE POLICY "Users can update own profile"
  ON public.profiles FOR UPDATE
  USING (auth.uid() = id);

CREATE POLICY "Users can insert own profile"
  ON public.profiles FOR INSERT
  WITH CHECK (auth.uid() = id);

-- Create documents table
CREATE TABLE public.documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  source_url TEXT,
  jurisdiction TEXT NOT NULL,
  sector TEXT NOT NULL,
  language TEXT NOT NULL DEFAULT 'IT',
  version TEXT NOT NULL DEFAULT '1.0',
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Enable RLS on documents
ALTER TABLE public.documents ENABLE ROW LEVEL SECURITY;

-- Documents policies (all authenticated users can read)
CREATE POLICY "Authenticated users can view documents"
  ON public.documents FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can insert documents"
  ON public.documents FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = created_by);

-- Create chunks table for embeddings
CREATE TABLE public.chunks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id UUID NOT NULL REFERENCES public.documents(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  start_pos INTEGER NOT NULL DEFAULT 0,
  end_pos INTEGER NOT NULL DEFAULT 0,
  embedding vector(1536),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Enable RLS on chunks
ALTER TABLE public.chunks ENABLE ROW LEVEL SECURITY;

-- Chunks policies
CREATE POLICY "Authenticated users can view chunks"
  ON public.chunks FOR SELECT
  TO authenticated
  USING (true);

-- Create index for vector similarity search
CREATE INDEX chunks_embedding_idx ON public.chunks USING ivfflat (embedding vector_cosine_ops);

-- Create query_log table for audit trail
CREATE TABLE public.query_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  question TEXT NOT NULL,
  answer TEXT NOT NULL,
  risk_level TEXT,
  next_steps JSONB,
  citations JSONB,
  model TEXT NOT NULL,
  latency_ms INTEGER,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Enable RLS on query_log
ALTER TABLE public.query_log ENABLE ROW LEVEL SECURITY;

-- Query log policies
CREATE POLICY "Users can view own queries"
  ON public.query_log FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own queries"
  ON public.query_log FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Create API keys table
CREATE TABLE public.api_keys (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key_hash TEXT NOT NULL UNIQUE,
  organization_id TEXT NOT NULL DEFAULT 'demo',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  revoked_at TIMESTAMPTZ
);

-- Enable RLS on api_keys
ALTER TABLE public.api_keys ENABLE ROW LEVEL SECURITY;

-- API keys policies (admin only - will be implemented later)
CREATE POLICY "Authenticated users can view api keys"
  ON public.api_keys FOR SELECT
  TO authenticated
  USING (true);

-- Create alert watches table
CREATE TABLE public.alert_watches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  label TEXT NOT NULL,
  jurisdiction TEXT,
  sector TEXT,
  document_id UUID REFERENCES public.documents(id) ON DELETE CASCADE,
  created_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Enable RLS on alert_watches
ALTER TABLE public.alert_watches ENABLE ROW LEVEL SECURITY;

-- Alert watches policies
CREATE POLICY "Users can view own watches"
  ON public.alert_watches FOR SELECT
  USING (auth.uid() = created_by);

CREATE POLICY "Users can create own watches"
  ON public.alert_watches FOR INSERT
  WITH CHECK (auth.uid() = created_by);

CREATE POLICY "Users can delete own watches"
  ON public.alert_watches FOR DELETE
  USING (auth.uid() = created_by);

-- Create notifications table
CREATE TABLE public.notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  payload JSONB,
  read_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Enable RLS on notifications
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

-- Notifications policies
CREATE POLICY "Users can view own notifications"
  ON public.notifications FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can update own notifications"
  ON public.notifications FOR UPDATE
  USING (auth.uid() = user_id);

-- Create function to update updated_at timestamp
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Create triggers for updated_at
CREATE TRIGGER update_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_documents_updated_at
  BEFORE UPDATE ON public.documents
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();



-- Source: 20251012165009_80300c62-bf33-4a06-afb4-1bae7db74d64.sql
-- Create vector similarity search function for RAG
CREATE OR REPLACE FUNCTION match_chunks(
  query_embedding vector(1536),
  match_threshold float DEFAULT 0.7,
  match_count int DEFAULT 10
)
RETURNS TABLE (
  id uuid,
  document_id uuid,
  content text,
  similarity float
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT
    chunks.id,
    chunks.document_id,
    chunks.content,
    1 - (chunks.embedding <=> query_embedding) AS similarity
  FROM chunks
  WHERE 1 - (chunks.embedding <=> query_embedding) > match_threshold
  ORDER BY chunks.embedding <=> query_embedding
  LIMIT match_count;
END;
$$;

-- Source: 20251012165106_1048a1b5-0f7d-4f00-a797-99a3300e71e4.sql
-- Fix security issues from previous migration
-- Set search_path for match_chunks function
CREATE OR REPLACE FUNCTION match_chunks(
  query_embedding vector(1536),
  match_threshold float DEFAULT 0.7,
  match_count int DEFAULT 10
)
RETURNS TABLE (
  id uuid,
  document_id uuid,
  content text,
  similarity float
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT
    chunks.id,
    chunks.document_id,
    chunks.content,
    1 - (chunks.embedding <=> query_embedding) AS similarity
  FROM chunks
  WHERE 1 - (chunks.embedding <=> query_embedding) > match_threshold
  ORDER BY chunks.embedding <=> query_embedding
  LIMIT match_count;
END;
$$;

-- Source: 20251012174917_4a80e69e-63a7-45a6-8c5b-b082a9f4a69f.sql
-- Tabella per memorizzare gli aggiornamenti normativi
CREATE TABLE public.news_updates (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  summary TEXT NOT NULL,
  source TEXT NOT NULL,
  source_url TEXT,
  published_at TIMESTAMP WITH TIME ZONE NOT NULL,
  regulation_type TEXT NOT NULL, -- GDPR, NIS2, AI Act, etc.
  jurisdiction TEXT NOT NULL DEFAULT 'EU',
  impact_level TEXT CHECK (impact_level IN ('low', 'medium', 'high')),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Indice per velocizzare le query ordinate per data
CREATE INDEX idx_news_updates_published_at ON public.news_updates(published_at DESC);

-- Indice per filtrare per tipo di normativa
CREATE INDEX idx_news_updates_regulation ON public.news_updates(regulation_type);

-- Enable RLS
ALTER TABLE public.news_updates ENABLE ROW LEVEL SECURITY;

-- Policy: tutti possono leggere le news (sono pubbliche)
CREATE POLICY "News updates are publicly readable"
  ON public.news_updates
  FOR SELECT
  USING (true);

-- Policy: solo authenticated users possono inserire (per il backend)
CREATE POLICY "Authenticated users can insert news"
  ON public.news_updates
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Trigger per aggiornare updated_at
CREATE TRIGGER update_news_updates_updated_at
  BEFORE UPDATE ON public.news_updates
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Source: 20251012175601_7af8045d-313f-4230-83ec-8271ca6c3e38.sql
-- Allow anonymous users to insert news updates for demo purposes
DROP POLICY IF EXISTS "Authenticated users can insert news" ON news_updates;

CREATE POLICY "Anyone can insert news updates"
ON news_updates
FOR INSERT
WITH CHECK (true);

-- Source: 20251012185634_e3b8ba5e-6c53-487f-9149-d20f1cbad01c.sql
-- Step 1: Create security definer function to check document access
CREATE OR REPLACE FUNCTION public.can_access_document(doc_id uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS(
    SELECT 1 FROM documents 
    WHERE id = doc_id AND created_by = auth.uid()
  )
$$;

-- Step 2: Drop existing overly permissive policies
DROP POLICY IF EXISTS "Authenticated users can view chunks" ON chunks;
DROP POLICY IF EXISTS "Authenticated users can view documents" ON documents;
DROP POLICY IF EXISTS "Authenticated users can view api keys" ON api_keys;

-- Step 3: Create restrictive policies for chunks (only access chunks of own documents)
CREATE POLICY "Users can view chunks of accessible documents"
ON chunks
FOR SELECT
USING (can_access_document(document_id));

-- Step 4: Create restrictive policy for documents (only view own documents)
CREATE POLICY "Users can view own documents"
ON documents
FOR SELECT
USING (auth.uid() = created_by);

-- Step 5: Remove api_keys read access entirely (only system should access)
-- No SELECT policy = no read access for regular users

-- Step 6: Add delete policy for query_log (GDPR compliance)
CREATE POLICY "Users can delete own queries"
ON query_log
FOR DELETE
USING (auth.uid() = user_id);

-- Step 7: Restrict news_updates INSERT to authenticated users only
DROP POLICY IF EXISTS "Anyone can insert news updates" ON news_updates;
CREATE POLICY "Authenticated users can insert news updates"
ON news_updates
FOR INSERT
TO authenticated
WITH CHECK (true);

-- Source: 20251012191031_be0dcabc-38a2-45c2-8e46-93a8c501a2b2.sql
-- Create role enum
CREATE TYPE public.app_role AS ENUM ('admin', 'user');

-- Create user_roles table
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  role app_role NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
  UNIQUE (user_id, role)
);

-- Enable RLS on user_roles
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- Create security definer function to check roles
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role = _role
  )
$$;

-- RLS policies for user_roles table
CREATE POLICY "Users can view own roles"
ON public.user_roles
FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Admins can manage all roles"
ON public.user_roles
FOR ALL
USING (public.has_role(auth.uid(), 'admin'));

-- Remove unused api_keys table
DROP TABLE IF EXISTS public.api_keys;

-- Source: 20251015203300_0e355d5b-e0bd-4c8f-b0db-0b6aa0949c60.sql
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

-- Source: 20251015204216_23a27471-934b-4772-8c10-b63b04e1c4c6.sql
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



-- Source: 20251015211725_0b8337b9-494d-4c01-b055-1eb91b1cd5bb.sql
-- Tabella per i monitor configurati
CREATE TABLE IF NOT EXISTS public.compliance_monitors (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  monitor_type TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'active',
  check_frequency_minutes INTEGER DEFAULT 60,
  config JSONB DEFAULT '{}'::jsonb,
  last_check TIMESTAMP WITH TIME ZONE,
  total_scans INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Tabella per i findings del monitoring
CREATE TABLE IF NOT EXISTS public.monitoring_findings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  monitor_id UUID REFERENCES public.compliance_monitors(id) ON DELETE SET NULL,
  monitor_type TEXT NOT NULL,
  resource_type TEXT NOT NULL,
  resource_name TEXT NOT NULL,
  finding_type TEXT NOT NULL,
  severity TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  recommended_actions JSONB DEFAULT '[]'::jsonb,
  compliance_impact JSONB DEFAULT '[]'::jsonb,
  status TEXT NOT NULL DEFAULT 'open',
  resolved_at TIMESTAMP WITH TIME ZONE,
  resolution_notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.compliance_monitors ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.monitoring_findings ENABLE ROW LEVEL SECURITY;

-- RLS Policies for compliance_monitors
CREATE POLICY "Users can view own monitors" 
  ON public.compliance_monitors 
  FOR SELECT 
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create own monitors" 
  ON public.compliance_monitors 
  FOR INSERT 
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own monitors" 
  ON public.compliance_monitors 
  FOR UPDATE 
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own monitors" 
  ON public.compliance_monitors 
  FOR DELETE 
  USING (auth.uid() = user_id);

-- RLS Policies for monitoring_findings
CREATE POLICY "Users can view own findings" 
  ON public.monitoring_findings 
  FOR SELECT 
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create own findings" 
  ON public.monitoring_findings 
  FOR INSERT 
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own findings" 
  ON public.monitoring_findings 
  FOR UPDATE 
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own findings" 
  ON public.monitoring_findings 
  FOR DELETE 
  USING (auth.uid() = user_id);

-- Trigger per updated_at
CREATE TRIGGER update_compliance_monitors_updated_at
  BEFORE UPDATE ON public.compliance_monitors
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_monitoring_findings_updated_at
  BEFORE UPDATE ON public.monitoring_findings
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Function per ottenere info sulle tabelle (usata dal monitoring)
CREATE OR REPLACE FUNCTION public.get_table_info()
RETURNS TABLE (
  table_name TEXT,
  columns JSONB
) 
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    t.table_name::TEXT,
    jsonb_agg(
      jsonb_build_object(
        'column_name', c.column_name,
        'data_type', c.data_type,
        'is_nullable', c.is_nullable
      )
    ) as columns
  FROM information_schema.tables t
  LEFT JOIN information_schema.columns c 
    ON t.table_name = c.table_name 
    AND t.table_schema = c.table_schema
  WHERE t.table_schema = 'public'
    AND t.table_type = 'BASE TABLE'
  GROUP BY t.table_name;
END;
$$;

-- Source: 20251017003735_f5637918-6d94-4022-9c03-722f6dcba471.sql
CREATE OR REPLACE FUNCTION delete_demo_profile_on_session_end()
RETURNS TRIGGER AS $$
BEGIN
  -- Controlla se l'utente è un account demo
  IF EXISTS (
    SELECT 1 FROM auth.users 
    WHERE id = OLD.user_id 
    AND email IN ('dpo@demo.regbrain.com', 'ciso@demo.regbrain.com')
  ) THEN
    -- Elimina il profilo se esiste
    DELETE FROM profiles WHERE id = OLD.user_id;
    RAISE LOG 'Demo profile deleted for user %', OLD.user_id;
  END IF;
  
  RETURN OLD;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Source: 20251017003753_088e4b9b-3441-4451-84f1-31bb5a8d161d.sql
-- Fix security warning: set search_path per la funzione
DROP FUNCTION IF EXISTS delete_demo_profile_on_session_end() CASCADE;

CREATE OR REPLACE FUNCTION delete_demo_profile_on_session_end()
RETURNS TRIGGER 
LANGUAGE plpgsql 
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Controlla se l'utente è un account demo
  IF EXISTS (
    SELECT 1 FROM auth.users 
    WHERE id = OLD.user_id 
    AND email IN ('dpo@demo.regbrain.com', 'ciso@demo.regbrain.com')
  ) THEN
    -- Elimina il profilo se esiste
    DELETE FROM profiles WHERE id = OLD.user_id;
    RAISE LOG 'Demo profile deleted for user %', OLD.user_id;
  END IF;
  
  RETURN OLD;
END;
$$;

-- Source: 20251017004505_db67e80a-13e6-434f-9f03-b9620dc634ae.sql
-- Modifica il trigger handle_new_user per NON creare profili per utenti demo
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
DROP FUNCTION IF EXISTS handle_new_user() CASCADE;

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER 
LANGUAGE plpgsql 
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- NON creare profili per gli account demo
  -- Gli account demo devono sempre passare attraverso l'onboarding
  IF NEW.email IN ('dpo@demo.regbrain.com', 'ciso@demo.regbrain.com') THEN
    RAISE LOG 'Skipping profile creation for demo account: %', NEW.email;
    RETURN NEW;
  END IF;
  
  -- Per tutti gli altri utenti, crea il profilo normalmente
  INSERT INTO public.profiles (id, jurisdiction, sector, compliance_role)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'jurisdiction', 'EU'),
    COALESCE(NEW.raw_user_meta_data->>'sector', 'Technology'),
    COALESCE(NEW.raw_user_meta_data->>'compliance_role', 'DPO')
  );
  
  RETURN NEW;
END;
$$;

-- Ricrea il trigger
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- Source: 20251017014911_f25fa154-2fc2-4f51-b226-7aa2b62358f6.sql
-- Modifica la policy per permettere a tutti gli utenti autenticati di leggere i documenti
DROP POLICY IF EXISTS "Users can view own documents" ON documents;

CREATE POLICY "Authenticated users can view all documents"
  ON documents
  FOR SELECT
  TO authenticated
  USING (true);

-- Source: 20251023144651_2d0c10b6-871a-44bb-8f85-21b38b1489ca.sql
CREATE OR REPLACE FUNCTION public.trigger_news_update() RETURNS text LANGUAGE sql SET search_path=public AS $$ SELECT 'News scheduling is disabled on this deployment'::text; $$;

-- Source: 20251024130642_c3f44005-0010-4558-bcba-7fa70cf7e1e2.sql
-- Add admin check to get_table_info() function to prevent schema exposure

DROP FUNCTION IF EXISTS public.get_table_info();

CREATE OR REPLACE FUNCTION public.get_table_info()
RETURNS TABLE(table_name text, columns jsonb)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  -- Require admin role to view database schema
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Admin access required to view database schema';
  END IF;

  RETURN QUERY
  SELECT 
    t.table_name::TEXT,
    jsonb_agg(
      jsonb_build_object(
        'column_name', c.column_name,
        'data_type', c.data_type,
        'is_nullable', c.is_nullable
      )
    ) as columns
  FROM information_schema.tables t
  LEFT JOIN information_schema.columns c 
    ON t.table_name = c.table_name 
    AND t.table_schema = c.table_schema
  WHERE t.table_schema = 'public'
    AND t.table_type = 'BASE TABLE'
  GROUP BY t.table_name;
END;
$$;

-- Source: 20251024130824_ab74f62a-f6c1-4996-a72b-224824768965.sql
-- Add admin check to get_table_info() function to prevent schema exposure

DROP FUNCTION IF EXISTS public.get_table_info();

CREATE OR REPLACE FUNCTION public.get_table_info()
RETURNS TABLE(table_name text, columns jsonb)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  -- Require admin role to view database schema
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Admin access required to view database schema';
  END IF;

  RETURN QUERY
  SELECT 
    t.table_name::TEXT,
    jsonb_agg(
      jsonb_build_object(
        'column_name', c.column_name,
        'data_type', c.data_type,
        'is_nullable', c.is_nullable
      )
    ) as columns
  FROM information_schema.tables t
  LEFT JOIN information_schema.columns c 
    ON t.table_name = c.table_name 
    AND t.table_schema = c.table_schema
  WHERE t.table_schema = 'public'
    AND t.table_type = 'BASE TABLE'
  GROUP BY t.table_name;
END;
$$;

-- Source: 20251027170235_9d99e589-26f0-45b6-9d8e-66cfdf4213b9.sql
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

-- Source: 20251028134409_c4606483-a51b-40df-b95a-bd85cb8e4e41.sql
-- Create enum for achievement types
CREATE TYPE achievement_type AS ENUM (
  'first_assessment',
  'perfect_compliance',
  'documents_uploaded_10',
  'documents_uploaded_50',
  'documents_uploaded_100',
  'gap_resolved_10',
  'gap_resolved_50',
  'week_streak',
  'month_streak',
  'team_builder',
  'compliance_expert'
);

-- User achievements table
CREATE TABLE user_achievements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  achievement_type achievement_type NOT NULL,
  earned_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  metadata JSONB DEFAULT '{}'::jsonb,
  UNIQUE(user_id, achievement_type)
);

ALTER TABLE user_achievements ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own achievements"
  ON user_achievements FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "System can insert achievements"
  ON user_achievements FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- User streaks table
CREATE TABLE user_streaks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE,
  current_streak INTEGER NOT NULL DEFAULT 0,
  longest_streak INTEGER NOT NULL DEFAULT 0,
  last_activity_date DATE NOT NULL DEFAULT CURRENT_DATE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE user_streaks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own streak"
  ON user_streaks FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can update own streak"
  ON user_streaks FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own streak"
  ON user_streaks FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Compliance maturity scores table
CREATE TABLE compliance_maturity_scores (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE,
  total_score INTEGER NOT NULL DEFAULT 0,
  assessments_score INTEGER NOT NULL DEFAULT 0,
  documentation_score INTEGER NOT NULL DEFAULT 0,
  proactivity_score INTEGER NOT NULL DEFAULT 0,
  team_score INTEGER NOT NULL DEFAULT 0,
  level INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE compliance_maturity_scores ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own maturity score"
  ON compliance_maturity_scores FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can manage own maturity score"
  ON compliance_maturity_scores FOR ALL
  USING (auth.uid() = user_id);

-- Team members table with role-based benefits
CREATE TABLE team_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  team_owner_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  member_email TEXT NOT NULL,
  member_user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('DPO', 'CISO', 'Legal', 'Compliance Officer', 'Auditor')),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'active', 'inactive')),
  invited_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  joined_at TIMESTAMP WITH TIME ZONE,
  permissions JSONB DEFAULT '{"can_edit": true, "can_delete": false, "can_invite": false}'::jsonb,
  UNIQUE(team_owner_id, member_email)
);

ALTER TABLE team_members ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own team"
  ON team_members FOR SELECT
  USING (auth.uid() = team_owner_id OR auth.uid() = member_user_id);

CREATE POLICY "Team owners can manage team"
  ON team_members FOR ALL
  USING (auth.uid() = team_owner_id);

-- Team benefits tracking (for monetization)
CREATE TABLE team_benefits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE,
  team_size INTEGER NOT NULL DEFAULT 1,
  discount_percentage INTEGER NOT NULL DEFAULT 0,
  has_collaboration_features BOOLEAN NOT NULL DEFAULT false,
  has_priority_support BOOLEAN NOT NULL DEFAULT false,
  has_advanced_analytics BOOLEAN NOT NULL DEFAULT false,
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE team_benefits ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own benefits"
  ON team_benefits FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can manage own benefits"
  ON team_benefits FOR ALL
  USING (auth.uid() = user_id);

-- Document comments table
CREATE TABLE document_comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  parent_comment_id UUID REFERENCES document_comments(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE document_comments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view comments on accessible documents"
  ON document_comments FOR SELECT
  USING (can_access_document(document_id));

CREATE POLICY "Authenticated users can create comments"
  ON document_comments FOR INSERT
  WITH CHECK (auth.uid() = user_id AND can_access_document(document_id));

CREATE POLICY "Users can update own comments"
  ON document_comments FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own comments"
  ON document_comments FOR DELETE
  USING (auth.uid() = user_id);

-- Notification preferences table
CREATE TABLE notification_preferences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE,
  new_regulations BOOLEAN NOT NULL DEFAULT true,
  compliance_deadlines BOOLEAN NOT NULL DEFAULT true,
  team_activity BOOLEAN NOT NULL DEFAULT true,
  weekly_insights BOOLEAN NOT NULL DEFAULT true,
  achievement_unlocked BOOLEAN NOT NULL DEFAULT true,
  email_frequency TEXT NOT NULL DEFAULT 'daily' CHECK (email_frequency IN ('realtime', 'daily', 'weekly', 'never')),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE notification_preferences ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own preferences"
  ON notification_preferences FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can manage own preferences"
  ON notification_preferences FOR ALL
  USING (auth.uid() = user_id);

-- Function to update streak
CREATE OR REPLACE FUNCTION update_user_streak(p_user_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_last_date DATE;
  v_current_streak INTEGER;
  v_longest_streak INTEGER;
BEGIN
  SELECT last_activity_date, current_streak, longest_streak
  INTO v_last_date, v_current_streak, v_longest_streak
  FROM user_streaks
  WHERE user_id = p_user_id;

  IF NOT FOUND THEN
    INSERT INTO user_streaks (user_id, current_streak, longest_streak, last_activity_date)
    VALUES (p_user_id, 1, 1, CURRENT_DATE);
    RETURN;
  END IF;

  IF v_last_date = CURRENT_DATE THEN
    RETURN;
  ELSIF v_last_date = CURRENT_DATE - INTERVAL '1 day' THEN
    v_current_streak := v_current_streak + 1;
    IF v_current_streak > v_longest_streak THEN
      v_longest_streak := v_current_streak;
    END IF;
  ELSE
    v_current_streak := 1;
  END IF;

  UPDATE user_streaks
  SET current_streak = v_current_streak,
      longest_streak = v_longest_streak,
      last_activity_date = CURRENT_DATE,
      updated_at = now()
  WHERE user_id = p_user_id;
END;
$$;

-- Function to calculate and update team benefits
CREATE OR REPLACE FUNCTION update_team_benefits(p_user_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_team_size INTEGER;
  v_discount INTEGER;
  v_collab BOOLEAN;
  v_priority BOOLEAN;
  v_analytics BOOLEAN;
BEGIN
  SELECT COUNT(*) + 1 INTO v_team_size
  FROM team_members
  WHERE team_owner_id = p_user_id AND status = 'active';

  -- Benefits scaling
  v_discount := CASE
    WHEN v_team_size >= 10 THEN 30
    WHEN v_team_size >= 5 THEN 20
    WHEN v_team_size >= 3 THEN 10
    ELSE 0
  END;

  v_collab := v_team_size >= 2;
  v_priority := v_team_size >= 5;
  v_analytics := v_team_size >= 3;

  INSERT INTO team_benefits (
    user_id, team_size, discount_percentage,
    has_collaboration_features, has_priority_support, has_advanced_analytics
  )
  VALUES (p_user_id, v_team_size, v_discount, v_collab, v_priority, v_analytics)
  ON CONFLICT (user_id) DO UPDATE SET
    team_size = v_team_size,
    discount_percentage = v_discount,
    has_collaboration_features = v_collab,
    has_priority_support = v_priority,
    has_advanced_analytics = v_analytics,
    updated_at = now();
END;
$$;

-- Triggers for updated_at
CREATE TRIGGER update_user_streaks_updated_at
  BEFORE UPDATE ON user_streaks
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_compliance_maturity_scores_updated_at
  BEFORE UPDATE ON compliance_maturity_scores
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_document_comments_updated_at
  BEFORE UPDATE ON document_comments
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_notification_preferences_updated_at
  BEFORE UPDATE ON notification_preferences
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Source: 20251029133317_acaea967-de33-44e9-8c8b-34b631ac339c.sql
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

-- Source: 20251029135810_e919da51-5d49-485d-89a3-223bdd04a293.sql
CREATE OR REPLACE FUNCTION public.notify_new_user_registration() RETURNS trigger LANGUAGE plpgsql SET search_path=public AS $$ BEGIN RETURN NEW; END; $$;

-- Source: 20251029135843_7d53d9eb-4701-4b7c-b279-a40b1f48d737.sql
CREATE OR REPLACE FUNCTION public.notify_new_user_registration() RETURNS trigger LANGUAGE plpgsql SET search_path=public AS $$ BEGIN RETURN NEW; END; $$;

-- Source: 20251111171828_8a346823-7823-4923-aa24-d0632ffbfcba.sql
-- Ensure RLS is enabled on query_log table
ALTER TABLE query_log ENABLE ROW LEVEL SECURITY;

-- Make user_id NOT NULL to prevent orphaned queries
ALTER TABLE query_log ALTER COLUMN user_id SET NOT NULL;

-- Drop existing policies to recreate them cleanly
DROP POLICY IF EXISTS "Users can view own queries" ON query_log;
DROP POLICY IF EXISTS "Users can insert own queries" ON query_log;
DROP POLICY IF EXISTS "Users can delete own queries" ON query_log;

-- Recreate policies with explicit authentication requirement
CREATE POLICY "Users can view own queries"
ON query_log
FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own queries"
ON query_log
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own queries"
ON query_log
FOR DELETE
TO authenticated
USING (auth.uid() = user_id);

-- Add index for better performance on user_id lookups
CREATE INDEX IF NOT EXISTS idx_query_log_user_id ON query_log(user_id);

-- Source: 20251116185735_4b92d6cc-3a1d-418a-8e98-9b028a71e1a9.sql
-- Create demo_sessions table to track temporary demo accounts
CREATE TABLE IF NOT EXISTS public.demo_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  email TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT (now() + interval '24 hours'),
  last_activity TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.demo_sessions ENABLE ROW LEVEL SECURITY;

-- Demo sessions are only visible to the owner
CREATE POLICY "Users can view own demo sessions"
ON public.demo_sessions
FOR SELECT
USING (auth.uid() = user_id);

-- System can insert demo sessions
CREATE POLICY "System can create demo sessions"
ON public.demo_sessions
FOR INSERT
WITH CHECK (true);

-- System can update demo sessions
CREATE POLICY "System can update demo sessions"
ON public.demo_sessions
FOR UPDATE
USING (true);

-- Create index for faster cleanup
CREATE INDEX idx_demo_sessions_expires_at ON public.demo_sessions(expires_at);
CREATE INDEX idx_demo_sessions_user_id ON public.demo_sessions(user_id);

-- Function to cleanup expired demo sessions
CREATE OR REPLACE FUNCTION public.cleanup_expired_demo_sessions()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  expired_user_id UUID;
BEGIN
  -- Find all expired demo sessions
  FOR expired_user_id IN 
    SELECT user_id 
    FROM demo_sessions 
    WHERE expires_at < now()
  LOOP
    -- Delete user data
    DELETE FROM query_log WHERE user_id = expired_user_id;
    DELETE FROM profiles WHERE id = expired_user_id;
    DELETE FROM demo_sessions WHERE user_id = expired_user_id;
    
    -- Delete auth user (this will cascade to other tables)
    DELETE FROM auth.users WHERE id = expired_user_id;
    
    RAISE LOG 'Cleaned up expired demo session for user %', expired_user_id;
  END LOOP;
END;
$$;

-- Update last_activity on profile updates for demo users
CREATE OR REPLACE FUNCTION public.update_demo_session_activity()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Update last_activity for demo sessions
  UPDATE demo_sessions
  SET last_activity = now()
  WHERE user_id = NEW.id
    AND expires_at > now();
  
  RETURN NEW;
END;
$$;

-- Trigger to update demo session activity
CREATE TRIGGER update_demo_activity_on_profile_update
AFTER INSERT OR UPDATE ON public.profiles
FOR EACH ROW
EXECUTE FUNCTION public.update_demo_session_activity();

-- Source: 20251120140347_d9619a3d-a13a-4875-b012-cfa9df58818d.sql
-- Create storage bucket for regulatory documents
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'regulatory-documents',
  'regulatory-documents',
  false,
  10485760,
  ARRAY['text/plain', 'application/pdf']
);

-- RLS policies for regulatory documents bucket
CREATE POLICY "Admin can upload regulatory documents"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'regulatory-documents' AND
  auth.uid() IN (
    SELECT user_id FROM user_roles WHERE role = 'admin'
  )
);

CREATE POLICY "Admin can read regulatory documents"
ON storage.objects FOR SELECT
USING (bucket_id = 'regulatory-documents');

CREATE POLICY "Service role can access regulatory documents"
ON storage.objects FOR ALL
USING (bucket_id = 'regulatory-documents');

-- Source: 20260127172144_c60a53f8-da34-42ee-bd56-12972b4fb6cb.sql
-- Add annual revenue column to compliance_assessments table
ALTER TABLE public.compliance_assessments 
ADD COLUMN annual_revenue_eur numeric NULL;

-- Add a comment to explain the column purpose
COMMENT ON COLUMN public.compliance_assessments.annual_revenue_eur IS 'Annual company revenue in EUR, used to calculate potential fines based on regulatory requirements (e.g., GDPR fines up to 4% of annual turnover)';

-- Source: 20260206163921_9b0306ce-45dc-48f6-b4b2-d13bc5a9f646.sql
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

-- Source: 20260224140122_765f1493-0dd3-4088-ad1a-2c11d736deb5.sql
CREATE TABLE IF NOT EXISTS public.gap_analysis_cache (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  cache_key TEXT NOT NULL,
  input_fingerprint TEXT NOT NULL,
  regulations TEXT[] NOT NULL DEFAULT '{}',
  language TEXT NOT NULL DEFAULT 'it',
  documents_count INTEGER NOT NULL DEFAULT 0,
  result_payload JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT gap_analysis_cache_unique_key UNIQUE (user_id, cache_key)
);

ALTER TABLE public.gap_analysis_cache ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own gap cache"
ON public.gap_analysis_cache
FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own gap cache"
ON public.gap_analysis_cache
FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own gap cache"
ON public.gap_analysis_cache
FOR UPDATE
USING (auth.uid() = user_id);

CREATE INDEX idx_gap_analysis_cache_user_key
ON public.gap_analysis_cache(user_id, cache_key);

CREATE TRIGGER update_gap_analysis_cache_updated_at
BEFORE UPDATE ON public.gap_analysis_cache
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Source: 20260303172239_71a2d49a-eed0-43bf-afa4-e09bc4b5cc0a.sql
-- Update regulatory-documents bucket to accept text files
UPDATE storage.buckets 
SET allowed_mime_types = ARRAY['application/pdf', 'text/plain', 'text/markdown', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document']
WHERE id = 'regulatory-documents';

-- Allow service role to upload (add policy for authenticated uploads)
CREATE POLICY "Service role can upload regulatory documents"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'regulatory-documents');

CREATE POLICY "Service role can read regulatory documents"  
ON storage.objects FOR SELECT
TO authenticated
USING (bucket_id = 'regulatory-documents');


-- Source: 20260303172252_d7089db3-ced8-4ca0-9739-987e7652a13c.sql
UPDATE storage.buckets 
SET allowed_mime_types = ARRAY['application/pdf', 'text/plain', 'text/markdown', 'application/octet-stream', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document']
WHERE id = 'regulatory-documents';


-- Source: 20260303231036_f2b0d1db-8c2d-4645-9b5d-c35a57cf1c52.sql

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


-- Source: 20260324165037_f47a13e3-fad7-49f6-93c8-ed16c4d89174.sql

-- Create structured_chunks table
CREATE TABLE public.structured_chunks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id uuid NOT NULL REFERENCES public.documents(id) ON DELETE CASCADE,
  regulation text NOT NULL,
  article_reference text,
  article_number integer,
  section_hierarchy text,
  chunk_text text NOT NULL,
  embedding vector(768),
  cross_references text[] DEFAULT '{}',
  is_obligation boolean DEFAULT false,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Indexes for fast filtering
CREATE INDEX idx_structured_chunks_regulation ON public.structured_chunks(regulation);
CREATE INDEX idx_structured_chunks_article_number ON public.structured_chunks(article_number);
CREATE INDEX idx_structured_chunks_document_id ON public.structured_chunks(document_id);
CREATE INDEX idx_structured_chunks_reg_article ON public.structured_chunks(regulation, article_number);

-- Vector similarity index
CREATE INDEX idx_structured_chunks_embedding ON public.structured_chunks
  USING hnsw (embedding vector_cosine_ops);

-- Enable RLS
ALTER TABLE public.structured_chunks ENABLE ROW LEVEL SECURITY;

-- RLS: authenticated users can read all structured chunks (same as documents)
CREATE POLICY "Authenticated users can view structured chunks"
  ON public.structured_chunks
  FOR SELECT
  TO authenticated
  USING (true);

-- Match function for structured_chunks vector search
CREATE OR REPLACE FUNCTION public.match_structured_chunks(
  query_embedding vector,
  filter_regulation text DEFAULT NULL,
  filter_article_number integer DEFAULT NULL,
  match_threshold double precision DEFAULT 0.55,
  match_count integer DEFAULT 20
)
RETURNS TABLE(
  id uuid,
  document_id uuid,
  regulation text,
  article_reference text,
  article_number integer,
  section_hierarchy text,
  chunk_text text,
  cross_references text[],
  is_obligation boolean,
  similarity double precision
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  RETURN QUERY
  SELECT
    sc.id,
    sc.document_id,
    sc.regulation,
    sc.article_reference,
    sc.article_number,
    sc.section_hierarchy,
    sc.chunk_text,
    sc.cross_references,
    sc.is_obligation,
    1 - (sc.embedding <=> query_embedding) AS similarity
  FROM structured_chunks sc
  WHERE
    (filter_regulation IS NULL OR sc.regulation = filter_regulation)
    AND (filter_article_number IS NULL OR sc.article_number = filter_article_number)
    AND sc.embedding IS NOT NULL
    AND 1 - (sc.embedding <=> query_embedding) > match_threshold
  ORDER BY sc.embedding <=> query_embedding
  LIMIT match_count;
END;
$$;


-- Source: 20260324171637_383a6e31-86f3-4946-9bc7-129071a386b1.sql

ALTER TABLE public.identified_gaps 
  ADD COLUMN IF NOT EXISTS source_chunk_id uuid REFERENCES public.chunks(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS article_text_excerpt text,
  ADD COLUMN IF NOT EXISTS detection_method text DEFAULT 'keyword';


-- Source: 20260403160731_83e760b8-7958-4e34-a547-c920120976a5.sql
-- Fix 1: has_role - restrict to checking own roles or admin checking others
CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role app_role)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT CASE 
    WHEN _user_id = auth.uid() THEN 
      EXISTS(SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role)
    WHEN EXISTS(SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'admin') THEN
      EXISTS(SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role)
    ELSE false
  END;
$$;

-- Fix 2: update_user_streak - only own streak
CREATE OR REPLACE FUNCTION public.update_user_streak(p_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  v_last_date DATE;
  v_current_streak INTEGER;
  v_longest_streak INTEGER;
BEGIN
  IF p_user_id != auth.uid() THEN
    RAISE EXCEPTION 'Can only update own streak';
  END IF;

  SELECT last_activity_date, current_streak, longest_streak
  INTO v_last_date, v_current_streak, v_longest_streak
  FROM user_streaks
  WHERE user_id = p_user_id;

  IF NOT FOUND THEN
    INSERT INTO user_streaks (user_id, current_streak, longest_streak, last_activity_date)
    VALUES (p_user_id, 1, 1, CURRENT_DATE);
    RETURN;
  END IF;

  IF v_last_date = CURRENT_DATE THEN
    RETURN;
  ELSIF v_last_date = CURRENT_DATE - INTERVAL '1 day' THEN
    v_current_streak := v_current_streak + 1;
    IF v_current_streak > v_longest_streak THEN
      v_longest_streak := v_current_streak;
    END IF;
  ELSE
    v_current_streak := 1;
  END IF;

  UPDATE user_streaks
  SET current_streak = v_current_streak,
      longest_streak = v_longest_streak,
      last_activity_date = CURRENT_DATE,
      updated_at = now()
  WHERE user_id = p_user_id;
END;
$function$;

-- Fix 3: update_team_benefits - only own benefits
CREATE OR REPLACE FUNCTION public.update_team_benefits(p_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  v_team_size INTEGER;
  v_discount INTEGER;
  v_collab BOOLEAN;
  v_priority BOOLEAN;
  v_analytics BOOLEAN;
BEGIN
  IF p_user_id != auth.uid() THEN
    RAISE EXCEPTION 'Can only update own team benefits';
  END IF;

  SELECT COUNT(*) + 1 INTO v_team_size
  FROM team_members
  WHERE team_owner_id = p_user_id AND status = 'active';

  v_discount := CASE
    WHEN v_team_size >= 10 THEN 30
    WHEN v_team_size >= 5 THEN 20
    WHEN v_team_size >= 3 THEN 10
    ELSE 0
  END;

  v_collab := v_team_size >= 2;
  v_priority := v_team_size >= 5;
  v_analytics := v_team_size >= 3;

  INSERT INTO team_benefits (
    user_id, team_size, discount_percentage,
    has_collaboration_features, has_priority_support, has_advanced_analytics
  )
  VALUES (p_user_id, v_team_size, v_discount, v_collab, v_priority, v_analytics)
  ON CONFLICT (user_id) DO UPDATE SET
    team_size = v_team_size,
    discount_percentage = v_discount,
    has_collaboration_features = v_collab,
    has_priority_support = v_priority,
    has_advanced_analytics = v_analytics,
    updated_at = now();
END;
$function$;

-- Fix 4: cleanup_expired_demo_sessions - restrict to admin/service role
CREATE OR REPLACE FUNCTION public.cleanup_expired_demo_sessions()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  expired_user_id UUID;
BEGIN
  IF NOT (
    public.has_role(auth.uid(), 'admin') OR 
    current_setting('request.jwt.claims', true)::json->>'role' = 'service_role'
  ) THEN
    RAISE EXCEPTION 'Admin or service role access required';
  END IF;

  FOR expired_user_id IN 
    SELECT user_id 
    FROM demo_sessions 
    WHERE expires_at < now()
  LOOP
    DELETE FROM query_log WHERE user_id = expired_user_id;
    DELETE FROM profiles WHERE id = expired_user_id;
    DELETE FROM demo_sessions WHERE user_id = expired_user_id;
    DELETE FROM auth.users WHERE id = expired_user_id;
    RAISE LOG 'Cleaned up expired demo session for user %', expired_user_id;
  END LOOP;
END;
$function$;

-- Fix 6: Storage - restrict regulatory-documents SELECT to admin only
DROP POLICY IF EXISTS "Admin can read regulatory documents" ON storage.objects;
CREATE POLICY "Admin can read regulatory documents"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'regulatory-documents' AND
  auth.uid() IN (
    SELECT user_id FROM public.user_roles WHERE role = 'admin'
  )
);

-- Fix 7: Tighten demo_sessions RLS - restrict INSERT/UPDATE
DROP POLICY IF EXISTS "System can create demo sessions" ON public.demo_sessions;
CREATE POLICY "Service role can create demo sessions"
ON public.demo_sessions FOR INSERT
WITH CHECK (
  current_setting('request.jwt.claims', true)::json->>'role' = 'service_role'
);

DROP POLICY IF EXISTS "System can update demo sessions" ON public.demo_sessions;
CREATE POLICY "Service role can update demo sessions"
ON public.demo_sessions FOR UPDATE
USING (
  current_setting('request.jwt.claims', true)::json->>'role' = 'service_role'
  OR auth.uid() = user_id
);

-- Fix 8: Restrict news_updates INSERT to admin only
DROP POLICY IF EXISTS "Authenticated users can insert news updates" ON public.news_updates;
CREATE POLICY "Admins can insert news updates"
ON public.news_updates FOR INSERT
TO authenticated
WITH CHECK (
  public.has_role(auth.uid(), 'admin')
);

-- Source: 20260403165106_a1ed296e-96d3-40d0-b070-c3e64961682b.sql

-- 1. Fix partner_webhooks: remove fully public policy, restrict to admin
DROP POLICY IF EXISTS "Enable all operations for all users" ON public.partner_webhooks;

REVOKE ALL ON public.partner_webhooks FROM anon;
REVOKE ALL ON public.partner_webhooks FROM authenticated;

CREATE POLICY "Admins can manage partner webhooks"
  ON public.partner_webhooks FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- 2. Fix demo_sessions INSERT policy: restrict to service_role only
DROP POLICY IF EXISTS "Service role can manage demo sessions" ON public.demo_sessions;

REVOKE INSERT, UPDATE, DELETE ON public.demo_sessions FROM anon;
REVOKE INSERT, UPDATE, DELETE ON public.demo_sessions FROM authenticated;

-- Only service_role (which bypasses RLS) can insert demo sessions.
-- Authenticated users can only read their own sessions (existing policy).

-- 3. Fix regulatory-documents storage: drop overly permissive policies
DROP POLICY IF EXISTS "Service role can read regulatory documents" ON storage.objects;
DROP POLICY IF EXISTS "Service role can upload regulatory documents" ON storage.objects;

-- 4. Fix can_access_document: shared knowledge base - all authenticated users can access
CREATE OR REPLACE FUNCTION public.can_access_document(doc_id uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS(SELECT 1 FROM documents WHERE id = doc_id);
$$;


-- Source: 20260403172918_092c2244-6929-4978-8ef2-67b1cdbe224b.sql
-- Create table for granular user document embeddings
CREATE TABLE IF NOT EXISTS public.user_document_embeddings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  assessment_id uuid REFERENCES public.compliance_assessments(id) ON DELETE CASCADE NOT NULL,
  document_name text NOT NULL,
  document_type text,
  section_text text NOT NULL,
  section_index integer NOT NULL DEFAULT 0,
  embedding vector(768),
  created_at timestamp with time zone DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.user_document_embeddings ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Users can view own document embeddings"
  ON public.user_document_embeddings FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create own document embeddings"
  ON public.user_document_embeddings FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own document embeddings"
  ON public.user_document_embeddings FOR DELETE
  USING (auth.uid() = user_id);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_ude_assessment ON public.user_document_embeddings(assessment_id);
CREATE INDEX IF NOT EXISTS idx_ude_user ON public.user_document_embeddings(user_id);
CREATE INDEX IF NOT EXISTS idx_ude_embedding ON public.user_document_embeddings 
  USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);

-- RPC function for semantic search
CREATE OR REPLACE FUNCTION public.match_user_document_sections(
  query_embedding vector(768),
  filter_assessment_id uuid,
  match_threshold float DEFAULT 0.65,
  match_count int DEFAULT 5
)
RETURNS TABLE (
  id uuid,
  document_name text,
  section_text text,
  section_index integer,
  similarity float
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT
    ude.id,
    ude.document_name,
    ude.section_text,
    ude.section_index,
    (1 - (ude.embedding <=> query_embedding))::float as similarity
  FROM user_document_embeddings ude
  WHERE ude.assessment_id = filter_assessment_id
    AND 1 - (ude.embedding <=> query_embedding) > match_threshold
  ORDER BY ude.embedding <=> query_embedding
  LIMIT match_count;
END;
$$;

-- Add semantic_similarity column to identified_gaps
ALTER TABLE public.identified_gaps 
  ADD COLUMN IF NOT EXISTS semantic_similarity numeric;

-- Source: 20260404131344_5e106348-c4a9-42b8-a429-67cae45ae964.sql
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

-- Source: 20260407093118_820e60f7-ad05-4fbb-9794-3a6832237982.sql

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


-- Source: 20260410165945_38698b36-4f48-45b6-b1b1-0350710ea9ff.sql
ALTER TABLE public.generated_documents DROP CONSTRAINT generated_documents_document_type_check;
ALTER TABLE public.generated_documents ADD CONSTRAINT generated_documents_document_type_check CHECK (document_type IN ('dpia', 'ropa', 'lia', 'gap_report', 'risk_analysis'));

-- Source: 20260425171622_77284184-b678-40f0-bc48-553ed89f52f4.sql
ALTER TABLE public.identified_gaps
ADD COLUMN IF NOT EXISTS potential_fine_max_eur BIGINT,
ADD COLUMN IF NOT EXISTS fine_tier_basis TEXT;

-- Source: 20260713150821_a4079ee1-c2dc-4f47-9721-610bdfb80512.sql

-- 1) Fix can_access_document: require authentication
CREATE OR REPLACE FUNCTION public.can_access_document(doc_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT auth.uid() IS NOT NULL
    AND EXISTS (SELECT 1 FROM public.documents WHERE id = doc_id);
$$;

-- 2) demo_sessions: restrict service_role policy roles from public
DROP POLICY IF EXISTS "Service role can create demo sessions" ON public.demo_sessions;
CREATE POLICY "Service role can create demo sessions"
ON public.demo_sessions
FOR INSERT
TO service_role
WITH CHECK (true);

DROP POLICY IF EXISTS "Service role can update demo sessions" ON public.demo_sessions;
CREATE POLICY "Service role can update demo sessions"
ON public.demo_sessions
FOR UPDATE
TO authenticated, service_role
USING (
  ((current_setting('request.jwt.claims', true))::json ->> 'role') = 'service_role'
  OR auth.uid() = user_id
);

-- 3) market_intelligence_cache: restrict full-access policy to service_role only
DROP POLICY IF EXISTS "Service role can manage cache" ON public.market_intelligence_cache;
CREATE POLICY "Service role can manage cache"
ON public.market_intelligence_cache
FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

-- 4) partner_api_log: restrict full-access policy to service_role only
DROP POLICY IF EXISTS "Service role manages API log" ON public.partner_api_log;
CREATE POLICY "Service role manages API log"
ON public.partner_api_log
FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

-- 5) partner_webhooks: restrict full-access policy to service_role only
DROP POLICY IF EXISTS "Service role manages partner webhooks" ON public.partner_webhooks;
CREATE POLICY "Service role manages partner webhooks"
ON public.partner_webhooks
FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

-- 6) partner_api_tokens: add explicit admin-only SELECT policy (RLS enabled, no policy)
DROP POLICY IF EXISTS "Admins can view partner api tokens" ON public.partner_api_tokens;
CREATE POLICY "Admins can view partner api tokens"
ON public.partner_api_tokens
FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

-- 7) Revoke EXECUTE on SECURITY DEFINER functions from anon / public
-- Trigger functions: no EXECUTE grants needed (triggers run as function owner)
REVOKE ALL ON FUNCTION public.update_demo_session_activity() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.delete_demo_profile_on_session_end() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.notify_new_user_registration() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.update_updated_at_column() FROM PUBLIC, anon, authenticated;

-- Admin/service utilities: not callable by anon/authenticated
REVOKE ALL ON FUNCTION public.trigger_news_update() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.cleanup_expired_demo_sessions() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.get_table_info() FROM PUBLIC, anon;

-- Self-scoped user helpers: keep for authenticated, remove from anon/public
REVOKE ALL ON FUNCTION public.update_user_streak(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.update_team_benefits(uuid) FROM PUBLIC, anon;

-- can_access_document: only authenticated should call it
REVOKE ALL ON FUNCTION public.can_access_document(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.can_access_document(uuid) TO authenticated;

-- has_role: needed by RLS via authenticated; remove anon
REVOKE ALL ON FUNCTION public.has_role(uuid, app_role) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, app_role) TO authenticated;

-- Vector search RPCs: keep for authenticated, remove anon
REVOKE ALL ON FUNCTION public.match_chunks(vector, double precision, integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.match_chunks(vector, double precision, integer) TO authenticated;

REVOKE ALL ON FUNCTION public.match_structured_chunks(vector, text, integer, double precision, integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.match_structured_chunks(vector, text, integer, double precision, integer) TO authenticated;

REVOKE ALL ON FUNCTION public.match_user_document_sections(vector, uuid, double precision, integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.match_user_document_sections(vector, uuid, double precision, integer) TO authenticated;


-- Source: 20260908190653_5be59409-1ff4-4392-8e71-2a170b43dc8e.sql
-- 1. Citazioni a livello di comma su structured_chunks
ALTER TABLE public.structured_chunks
  ADD COLUMN IF NOT EXISTS paragraph text,
  ADD COLUMN IF NOT EXISTS letter text,
  ADD COLUMN IF NOT EXISTS citation_label text,
  ADD COLUMN IF NOT EXISTS chunk_key text,
  ADD COLUMN IF NOT EXISTS content_hash text,
  ADD COLUMN IF NOT EXISTS context_header text,
  ADD COLUMN IF NOT EXISTS unit_type text,
  ADD COLUMN IF NOT EXISTS celex text,
  ADD COLUMN IF NOT EXISTS lang text DEFAULT 'IT',
  ADD COLUMN IF NOT EXISTS valid_from date,
  ADD COLUMN IF NOT EXISTS valid_to date,
  ADD COLUMN IF NOT EXISTS source_format text;

CREATE UNIQUE INDEX IF NOT EXISTS structured_chunks_chunk_key_idx
  ON public.structured_chunks (chunk_key) WHERE chunk_key IS NOT NULL;
CREATE INDEX IF NOT EXISTS structured_chunks_validity_idx
  ON public.structured_chunks (regulation, valid_from, valid_to);
CREATE INDEX IF NOT EXISTS structured_chunks_par_idx
  ON public.structured_chunks (regulation, article_number, paragraph);

-- Backfill etichette di citazione per i testi già presenti
UPDATE public.structured_chunks
SET citation_label = COALESCE(citation_label,
      CASE WHEN article_number IS NOT NULL
           THEN regulation || ', art. ' || article_number::text
           ELSE regulation END),
    unit_type = COALESCE(unit_type, 'articolo'),
    lang = COALESCE(lang, 'IT'),
    source_format = COALESCE(source_format, 'txt')
WHERE citation_label IS NULL OR unit_type IS NULL OR source_format IS NULL;

-- 2. Golden set del retrieval
CREATE TABLE IF NOT EXISTS public.rag_golden_queries (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  query_text text NOT NULL,
  regulation text,
  category text NOT NULL DEFAULT 'generale',
  expected_articles text[] NOT NULL DEFAULT '{}',
  expected_chunk_keys text[] NOT NULL DEFAULT '{}',
  notes text,
  active boolean NOT NULL DEFAULT true,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

GRANT SELECT ON public.rag_golden_queries TO authenticated;
GRANT INSERT, UPDATE, DELETE ON public.rag_golden_queries TO authenticated;
GRANT ALL ON public.rag_golden_queries TO service_role;
ALTER TABLE public.rag_golden_queries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can read golden queries"
  ON public.rag_golden_queries FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins manage golden queries insert"
  ON public.rag_golden_queries FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins manage golden queries update"
  ON public.rag_golden_queries FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins manage golden queries delete"
  ON public.rag_golden_queries FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER update_rag_golden_queries_updated_at
  BEFORE UPDATE ON public.rag_golden_queries
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE IF NOT EXISTS public.rag_eval_runs (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  label text NOT NULL DEFAULT 'manuale',
  queries_total integer NOT NULL DEFAULT 0,
  recall_at_10 numeric,
  mrr numeric,
  article_precision numeric,
  rerank_enabled boolean NOT NULL DEFAULT false,
  details jsonb NOT NULL DEFAULT '[]'::jsonb,
  run_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT ON public.rag_eval_runs TO authenticated;
GRANT DELETE ON public.rag_eval_runs TO authenticated;
GRANT ALL ON public.rag_eval_runs TO service_role;
ALTER TABLE public.rag_eval_runs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can read eval runs"
  ON public.rag_eval_runs FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins can insert eval runs"
  ON public.rag_eval_runs FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can delete eval runs"
  ON public.rag_eval_runs FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER update_rag_eval_runs_updated_at
  BEFORE UPDATE ON public.rag_eval_runs
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 3. Ricerca con filtro di validità e metadati di citazione completi
CREATE OR REPLACE FUNCTION public.match_structured_chunks_v2(
  query_embedding vector,
  filter_regulation text DEFAULT NULL,
  filter_article_number integer DEFAULT NULL,
  as_of_date date DEFAULT CURRENT_DATE,
  match_threshold double precision DEFAULT 0.45,
  match_count integer DEFAULT 40
)
RETURNS TABLE(
  id uuid, document_id uuid, regulation text, article_reference text,
  article_number integer, paragraph text, letter text, citation_label text,
  chunk_key text, context_header text, section_hierarchy text,
  chunk_text text, cross_references text[], is_obligation boolean,
  valid_from date, valid_to date, similarity double precision
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  RETURN QUERY
  SELECT
    sc.id, sc.document_id, sc.regulation, sc.article_reference,
    sc.article_number, sc.paragraph, sc.letter, sc.citation_label,
    sc.chunk_key, sc.context_header, sc.section_hierarchy,
    sc.chunk_text, sc.cross_references, sc.is_obligation,
    sc.valid_from, sc.valid_to,
    1 - (sc.embedding <=> query_embedding) AS similarity
  FROM structured_chunks sc
  WHERE
    (filter_regulation IS NULL OR sc.regulation = filter_regulation)
    AND (filter_article_number IS NULL OR sc.article_number = filter_article_number)
    AND sc.embedding IS NOT NULL
    AND (sc.valid_from IS NULL OR sc.valid_from <= as_of_date)
    AND (sc.valid_to IS NULL OR sc.valid_to > as_of_date)
    AND 1 - (sc.embedding <=> query_embedding) > match_threshold
  ORDER BY sc.embedding <=> query_embedding
  LIMIT match_count;
END;
$function$;

REVOKE ALL ON FUNCTION public.match_structured_chunks_v2(vector, text, integer, date, double precision, integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.match_structured_chunks_v2(vector, text, integer, date, double precision, integer) TO authenticated, service_role;

-- Source: 20260908190728_21458e6c-9070-452c-827f-53f27ae200a0.sql
REVOKE ALL ON FUNCTION public.match_structured_chunks_v2(vector, text, integer, date, double precision, integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.match_structured_chunks_v2(vector, text, integer, date, double precision, integer) TO service_role;

-- Source: 20260908191201_e43d4c36-e0fa-4567-ab0b-d0eae5d6c2e0.sql
INSERT INTO public.rag_golden_queries (query_text, regulation, category, expected_articles, notes) VALUES
('Quando è obbligatoria una valutazione d''impatto sulla protezione dei dati?', 'GDPR', 'obblighi', ARRAY['art 35'], 'DPIA obbligatoria'),
('Quali sono le basi giuridiche del trattamento dei dati personali?', 'GDPR', 'definizioni', ARRAY['art 6'], NULL),
('Entro quanto tempo va notificata una violazione dei dati personali al Garante?', 'GDPR', 'termini', ARRAY['art 33'], '72 ore'),
('Quando devo comunicare la violazione agli interessati?', 'GDPR', 'termini', ARRAY['art 34'], NULL),
('Quando è obbligatorio nominare un responsabile della protezione dei dati?', 'GDPR', 'ruoli', ARRAY['art 37'], NULL),
('Quali sono i compiti del responsabile della protezione dei dati?', 'GDPR', 'ruoli', ARRAY['art 39'], NULL),
('Cosa deve contenere il registro dei trattamenti?', 'GDPR', 'documentazione', ARRAY['art 30'], 'RoPA'),
('Quali misure di sicurezza del trattamento sono richieste?', 'GDPR', 'sicurezza', ARRAY['art 32'], NULL),
('Quali sono gli obblighi del responsabile del trattamento verso il titolare?', 'GDPR', 'contratti', ARRAY['art 28'], NULL),
('Come si valuta il legittimo interesse come base giuridica?', 'GDPR', 'obblighi', ARRAY['art 6'], 'LIA'),
('Quali sono i diritti dell''interessato di accesso ai propri dati?', 'GDPR', 'diritti', ARRAY['art 15'], NULL),
('Quando si applica il diritto alla cancellazione?', 'GDPR', 'diritti', ARRAY['art 17'], NULL),
('Quali sono gli importi massimi delle sanzioni amministrative?', 'GDPR', 'sanzioni', ARRAY['art 83'], NULL),
('Quali garanzie servono per trasferire dati fuori dall''Unione europea?', 'GDPR', 'trasferimenti', ARRAY['art 46'], NULL),
('Cosa prevede il principio di responsabilizzazione del titolare?', 'GDPR', 'principi', ARRAY['art 24'], 'Art. 24'),
('Quali sono i principi applicabili al trattamento dei dati personali?', 'GDPR', 'principi', ARRAY['art 5'], NULL),
('Quali obblighi di gestione del rischio di cibersicurezza hanno i soggetti essenziali?', 'NIS2', 'obblighi', ARRAY['art 21'], NULL),
('Entro quanto tempo va inviata la notifica preliminare di un incidente significativo?', 'NIS2', 'termini', ARRAY['art 23'], '24 ore preallerta'),
('Quali sono le responsabilità degli organi di gestione in materia di cibersicurezza?', 'NIS2', 'governance', ARRAY['art 20'], NULL),
('Quali soggetti sono considerati essenziali e quali importanti?', 'NIS2', 'ambito', ARRAY['art 3'], NULL),
('Quali sono le sanzioni previste per i soggetti essenziali?', 'NIS2', 'sanzioni', ARRAY['art 34'], NULL),
('Quali settori rientrano nell''ambito di applicazione della direttiva?', 'NIS2', 'ambito', ARRAY['art 2'], 'Allegati I e II'),
('Cosa si intende per incidente significativo?', 'NIS2', 'definizioni', ARRAY['art 23'], NULL),
('Quali obblighi di sicurezza della catena di approvvigionamento sono previsti?', 'NIS2', 'obblighi', ARRAY['art 21'], NULL),
('Entro quale data gli Stati membri devono recepire la direttiva?', 'NIS2', 'termini', ARRAY['art 41'], NULL),
('Quali requisiti deve avere il quadro di gestione dei rischi informatici?', 'DORA', 'obblighi', ARRAY['art 6'], NULL),
('Come vanno classificati e segnalati gli incidenti connessi alle tecnologie informatiche?', 'DORA', 'termini', ARRAY['art 19'], NULL),
('Quali sono gli obblighi di test di resilienza operativa digitale?', 'DORA', 'test', ARRAY['art 24'], NULL),
('Quando è obbligatorio il test di penetrazione guidato dalla minaccia?', 'DORA', 'test', ARRAY['art 26'], NULL),
('Quali clausole contrattuali sono obbligatorie con i fornitori terzi di servizi informatici?', 'DORA', 'contratti', ARRAY['art 30'], NULL),
('Quali sono le responsabilità dell''organo di gestione nel quadro di governance?', 'DORA', 'governance', ARRAY['art 5'], NULL),
('Quali obblighi hanno i fornitori di sistemi di intelligenza artificiale ad alto rischio?', 'AI_ACT', 'obblighi', ARRAY['art 16'], NULL),
('Quali pratiche di intelligenza artificiale sono vietate?', 'AI_ACT', 'divieti', ARRAY['art 5'], NULL),
('Come si classifica un sistema di intelligenza artificiale come ad alto rischio?', 'AI_ACT', 'ambito', ARRAY['art 6'], NULL),
('Quali requisiti di gestione dei rischi sono previsti per i sistemi ad alto rischio?', 'AI_ACT', 'obblighi', ARRAY['art 9'], NULL),
('Quali obblighi di trasparenza si applicano ai sistemi che interagiscono con le persone?', 'AI_ACT', 'trasparenza', ARRAY['art 50'], NULL),
('Quali sono le sanzioni previste dal regolamento sull''intelligenza artificiale?', 'AI_ACT', 'sanzioni', ARRAY['art 99'], NULL),
('Quali requisiti essenziali di cibersicurezza devono avere i prodotti con elementi digitali?', 'CRA', 'obblighi', ARRAY['art 13'], NULL),
('Quali obblighi di segnalazione delle vulnerabilità sfruttate attivamente sono previsti?', 'CRA', 'termini', ARRAY['art 14'], NULL),
('Per quanto tempo il fabbricante deve fornire aggiornamenti di sicurezza?', 'CRA', 'obblighi', ARRAY['art 13'], 'periodo di supporto');
-- Applied atomically with the bootstrap to a new, empty project.
CREATE SCHEMA IF NOT EXISTS private;
REVOKE ALL ON SCHEMA private FROM PUBLIC;
GRANT USAGE ON SCHEMA private TO authenticated, service_role;

-- A deleted or expired demo cannot keep using an unexpired access token.
CREATE FUNCTION private.active_user() RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT EXISTS (SELECT 1 FROM auth.users u WHERE u.id = auth.uid()
    AND (u.raw_app_meta_data->>'demo_expires_at' IS NULL
      OR (u.raw_app_meta_data->>'demo_expires_at')::timestamptz > now()));
$$;
REVOKE ALL ON FUNCTION private.active_user() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION private.active_user() TO authenticated, service_role;

ALTER TABLE public.documents ADD COLUMN is_public boolean NOT NULL DEFAULT false;
CREATE OR REPLACE FUNCTION public.can_access_document(doc_id uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY INVOKER SET search_path = public AS $$
 SELECT EXISTS(SELECT 1 FROM public.documents WHERE id=doc_id);
$$;
DROP POLICY IF EXISTS "Authenticated users can view documents" ON public.documents;
DROP POLICY IF EXISTS "Users can view own documents" ON public.documents;
CREATE POLICY "Read shared regulations or own documents" ON public.documents FOR SELECT TO authenticated
USING (is_public OR created_by=auth.uid());
DROP POLICY IF EXISTS "Authenticated users can insert documents" ON public.documents;
CREATE POLICY "Insert own private documents" ON public.documents FOR INSERT TO authenticated
WITH CHECK (created_by=auth.uid() AND NOT is_public);
DROP POLICY IF EXISTS "Authenticated users can view structured chunks" ON public.structured_chunks;
CREATE POLICY "Read accessible structured chunks" ON public.structured_chunks FOR SELECT TO authenticated
USING (public.can_access_document(document_id));
ALTER FUNCTION public.match_chunks(vector,double precision,integer) SECURITY INVOKER;
ALTER FUNCTION public.match_structured_chunks(vector,text,integer,double precision,integer) SECURITY INVOKER;
ALTER FUNCTION public.match_structured_chunks_v2(vector,text,integer,date,double precision,integer) SECURITY INVOKER;
ALTER FUNCTION public.match_user_document_sections(vector,uuid,double precision,integer) SECURITY INVOKER;

-- Restrict all existing policies to signed-in, active users and supply UPDATE checks.
DO $$ DECLARE t record; p record; BEGIN
 FOR t IN SELECT tablename FROM pg_tables WHERE schemaname='public' LOOP
  EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY',t.tablename);
  EXECUTE format('REVOKE ALL ON public.%I FROM anon, authenticated',t.tablename);
  EXECUTE format('CREATE POLICY active_account ON public.%I AS RESTRICTIVE FOR ALL TO authenticated USING (private.active_user()) WITH CHECK (private.active_user())',t.tablename);
 END LOOP;
 FOR p IN SELECT * FROM pg_policies WHERE schemaname='public' AND policyname <> 'active_account' LOOP
  IF 'public'=ANY(p.roles::text[]) THEN
   EXECUTE format('ALTER POLICY %I ON public.%I TO authenticated',p.policyname,p.tablename);
  END IF;
  IF p.cmd IN ('ALL','UPDATE') AND p.with_check IS NULL AND p.qual IS NOT NULL THEN
   EXECUTE format('ALTER POLICY %I ON public.%I WITH CHECK (%s)',p.policyname,p.tablename,p.qual);
  END IF;
 END LOOP;
 -- Grant only operations for which an intentional permissive policy exists.
 FOR p IN SELECT DISTINCT tablename,cmd FROM pg_policies WHERE schemaname='public'
   AND policyname <> 'active_account' AND ('authenticated'=ANY(roles::text[])) LOOP
  IF p.cmd='ALL' THEN
   EXECUTE format('GRANT SELECT,INSERT,UPDATE,DELETE ON public.%I TO authenticated',p.tablename);
  ELSE
   EXECUTE format('GRANT %s ON public.%I TO authenticated',p.cmd,p.tablename);
  END IF;
 END LOOP;
END $$;
GRANT USAGE ON SCHEMA public TO authenticated,service_role;
GRANT ALL ON ALL TABLES IN SCHEMA public TO service_role;
GRANT USAGE,SELECT ON ALL SEQUENCES IN SCHEMA public TO service_role;
-- Demo expiry is controlled by the server, never editable by the user.
REVOKE INSERT,UPDATE,DELETE ON public.demo_sessions FROM authenticated;
REVOKE ALL ON public.partner_api_tokens,public.partner_api_log,public.partner_webhooks FROM authenticated;
REVOKE ALL ON ALL FUNCTIONS IN SCHEMA public FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.update_user_streak(uuid),public.update_team_benefits(uuid) TO authenticated;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO service_role;

-- Storage contains normative source documents; only administrators may upload.
DO $$ DECLARE p record; BEGIN
 FOR p IN SELECT policyname FROM pg_policies WHERE schemaname='storage' AND tablename='objects' LOOP
  EXECUTE format('DROP POLICY %I ON storage.objects',p.policyname);
 END LOOP;
END $$;
CREATE POLICY "Admins manage normative storage" ON storage.objects FOR ALL TO authenticated
USING (bucket_id='regulatory-documents' AND private.active_user() AND public.has_role(auth.uid(),'admin'))
WITH CHECK (bucket_id='regulatory-documents' AND private.active_user() AND public.has_role(auth.uid(),'admin'));

-- Do not invent a completed profile on sign-up: onboarding provides it.
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

-- Atomic rate-limit reservation for demo creation. No client access.
CREATE TABLE private.demo_requests (token_hash text PRIMARY KEY, created_at timestamptz NOT NULL DEFAULT now());
CREATE FUNCTION public.reserve_demo(p_token_hash text) RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE n integer;
BEGIN
 DELETE FROM private.demo_requests WHERE created_at < now()-interval '24 hours';
 INSERT INTO private.demo_requests(token_hash) VALUES(p_token_hash) ON CONFLICT DO NOTHING;
 GET DIAGNOSTICS n=ROW_COUNT;
 RETURN n=1;
END $$;
REVOKE ALL ON FUNCTION public.reserve_demo(text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.reserve_demo(text) TO service_role;

-- Demo accounts carry server-controlled expiry, and cleanup touches only those accounts.
CREATE OR REPLACE FUNCTION public.cleanup_expired_demo_sessions() RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE u record; t record;
BEGIN
 FOR u IN SELECT id FROM auth.users
  WHERE raw_app_meta_data->>'is_demo'='true'
  AND (raw_app_meta_data->>'demo_expires_at')::timestamptz < now()
 LOOP
  DELETE FROM auth.sessions WHERE user_id=u.id;
  DELETE FROM public.documents WHERE created_by=u.id;
  FOR t IN SELECT table_name FROM information_schema.columns
   WHERE table_schema='public' AND column_name='user_id' LOOP
   EXECUTE format('DELETE FROM public.%I WHERE user_id=$1',t.table_name) USING u.id;
  END LOOP;
  DELETE FROM auth.users WHERE id=u.id;
 END LOOP;
END $$;
REVOKE ALL ON FUNCTION public.cleanup_expired_demo_sessions() FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.cleanup_expired_demo_sessions() TO service_role;
CREATE EXTENSION IF NOT EXISTS pg_cron;
SELECT cron.schedule('regbrain-expired-demos','*/10 * * * *','SELECT public.cleanup_expired_demo_sessions()');

GRANT EXECUTE ON FUNCTION public.match_structured_chunks_v2(vector,text,integer,date,double precision,integer) TO authenticated;

