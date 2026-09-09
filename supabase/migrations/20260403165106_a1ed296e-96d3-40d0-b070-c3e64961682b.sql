
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
