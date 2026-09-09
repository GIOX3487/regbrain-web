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