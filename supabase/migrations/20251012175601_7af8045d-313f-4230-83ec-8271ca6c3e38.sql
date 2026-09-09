-- Allow anonymous users to insert news updates for demo purposes
DROP POLICY IF EXISTS "Authenticated users can insert news" ON news_updates;

CREATE POLICY "Anyone can insert news updates"
ON news_updates
FOR INSERT
WITH CHECK (true);