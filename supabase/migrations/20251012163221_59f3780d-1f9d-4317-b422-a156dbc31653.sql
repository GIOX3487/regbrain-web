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

-- Insert sample documents
INSERT INTO public.documents (title, jurisdiction, sector, language, version, source_url) VALUES
  ('GDPR – art. 37–39 (IT)', 'IT', 'generale', 'IT', '1.0', 'https://eur-lex.europa.eu/legal-content/IT/TXT/?uri=CELEX:32016R0679'),
  ('NIS2 – obblighi essenziali (IT)', 'IT', 'generale', 'IT', '1.0', 'https://eur-lex.europa.eu/legal-content/IT/TXT/?uri=CELEX:32022L2555'),
  ('AI Act – classificazione rischi (EN)', 'EU', 'tech', 'EN', '1.0', 'https://eur-lex.europa.eu/legal-content/EN/TXT/?uri=CELEX:52021PC0206');
