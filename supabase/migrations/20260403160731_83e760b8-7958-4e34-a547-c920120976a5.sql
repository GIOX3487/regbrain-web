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

-- Fix 5: trigger_news_update - add SET search_path
CREATE OR REPLACE FUNCTION public.trigger_news_update()
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  request_id BIGINT;
BEGIN
  SELECT net.http_post(
    url:='https://mnbagzwdlvyjrmoyroqg.supabase.co/functions/v1/auto-update-news',
    headers:='{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1uYmFnendkbHZ5anJtb3lyb3FnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjAyMDQ2NTQsImV4cCI6MjA3NTc4MDY1NH0.l-p39_lUEK3jKV7pixX4wW8E5p34lJ4kBBz3E9OsYTQ"}'::jsonb
  ) INTO request_id;
  
  RETURN 'News update triggered with request_id: ' || request_id;
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