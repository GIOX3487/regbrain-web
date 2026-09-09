-- Create a function to notify about new user registrations
CREATE OR REPLACE FUNCTION public.notify_new_user_registration()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  request_id bigint;
  user_metadata jsonb;
BEGIN
  -- Skip notification for demo accounts
  IF NEW.email IN ('dpo@demo.regbrain.com', 'ciso@demo.regbrain.com') THEN
    RAISE LOG 'Skipping notification for demo account: %', NEW.email;
    RETURN NEW;
  END IF;

  -- Extract user metadata
  user_metadata := jsonb_build_object(
    'jurisdiction', COALESCE(NEW.raw_user_meta_data->>'jurisdiction', 'EU'),
    'sector', COALESCE(NEW.raw_user_meta_data->>'sector', 'Technology'),
    'compliance_role', COALESCE(NEW.raw_user_meta_data->>'compliance_role', 'DPO')
  );

  -- Call the edge function to send notification email
  SELECT net.http_post(
    url := 'https://mnbagzwdlvyjrmoyroqg.supabase.co/functions/v1/send-registration-notification',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1uYmFnendkbHZ5anJtb3lyb3FnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjAyMDQ2NTQsImV4cCI6MjA3NTc4MDY1NH0.l-p39_lUEK3jKV7pixX4wW8E5p34lJ4kBBz3E9OsYTQ'
    ),
    body := jsonb_build_object(
      'email', NEW.email,
      'userId', NEW.id::text,
      'metadata', user_metadata
    )
  ) INTO request_id;

  RAISE LOG 'Registration notification triggered for user % with request_id %', NEW.email, request_id;

  RETURN NEW;
END;
$$;

-- Create trigger to call the notification function after user signup
DROP TRIGGER IF EXISTS on_user_registered ON auth.users;

CREATE TRIGGER on_user_registered
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_new_user_registration();