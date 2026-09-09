
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
