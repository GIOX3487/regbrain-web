-- Enable pg_cron extension for scheduled jobs
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Enable pg_net extension for HTTP requests
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Create a cron job to auto-update news every day at 8:00 AM UTC
SELECT cron.schedule(
  'auto-update-news-daily',
  '0 8 * * *', -- Every day at 8:00 AM UTC
  $$
  SELECT
    net.http_post(
        url:='https://mnbagzwdlvyjrmoyroqg.supabase.co/functions/v1/auto-update-news',
        headers:='{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1uYmFnendkbHZ5anJtb3lyb3FnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjAyMDQ2NTQsImV4cCI6MjA3NTc4MDY1NH0.l-p39_lUEK3jKV7pixX4wW8E5p34lJ4kBBz3E9OsYTQ"}'::jsonb
    ) as request_id;
  $$
);

-- Create a function to manually trigger news update (useful for testing)
CREATE OR REPLACE FUNCTION trigger_news_update()
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  request_id BIGINT;
BEGIN
  SELECT net.http_post(
    url:='https://mnbagzwdlvyjrmoyroqg.supabase.co/functions/v1/auto-update-news',
    headers:='{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1uYmFnendkbHZ5anJtb3lyb3FnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjAyMDQ2NTQsImV4cCI6MjA3NTc4MDY1NH0.l-p39_lUEK3jKV7pixX4wW8E5p34lJ4kBBz3E9OsYTQ"}'::jsonb
  ) INTO request_id;
  
  RETURN 'News update triggered with request_id: ' || request_id;
END;
$$;