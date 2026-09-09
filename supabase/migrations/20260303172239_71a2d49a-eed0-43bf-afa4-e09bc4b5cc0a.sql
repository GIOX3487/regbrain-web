-- Update regulatory-documents bucket to accept text files
UPDATE storage.buckets 
SET allowed_mime_types = ARRAY['application/pdf', 'text/plain', 'text/markdown', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document']
WHERE id = 'regulatory-documents';

-- Allow service role to upload (add policy for authenticated uploads)
CREATE POLICY "Service role can upload regulatory documents"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'regulatory-documents');

CREATE POLICY "Service role can read regulatory documents"  
ON storage.objects FOR SELECT
TO authenticated
USING (bucket_id = 'regulatory-documents');
