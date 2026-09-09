-- Create storage bucket for regulatory documents
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'regulatory-documents',
  'regulatory-documents',
  false,
  10485760,
  ARRAY['text/plain', 'application/pdf']
);

-- RLS policies for regulatory documents bucket
CREATE POLICY "Admin can upload regulatory documents"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'regulatory-documents' AND
  auth.uid() IN (
    SELECT user_id FROM user_roles WHERE role = 'admin'
  )
);

CREATE POLICY "Admin can read regulatory documents"
ON storage.objects FOR SELECT
USING (bucket_id = 'regulatory-documents');

CREATE POLICY "Service role can access regulatory documents"
ON storage.objects FOR ALL
USING (bucket_id = 'regulatory-documents');