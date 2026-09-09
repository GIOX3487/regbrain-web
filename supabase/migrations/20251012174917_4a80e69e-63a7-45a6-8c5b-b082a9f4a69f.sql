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