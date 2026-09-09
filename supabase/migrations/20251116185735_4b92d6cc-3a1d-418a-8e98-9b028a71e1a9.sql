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