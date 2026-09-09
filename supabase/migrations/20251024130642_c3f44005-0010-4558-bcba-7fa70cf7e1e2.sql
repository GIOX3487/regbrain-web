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