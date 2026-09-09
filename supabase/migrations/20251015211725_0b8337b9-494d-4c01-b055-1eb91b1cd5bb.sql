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