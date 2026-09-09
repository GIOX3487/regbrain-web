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