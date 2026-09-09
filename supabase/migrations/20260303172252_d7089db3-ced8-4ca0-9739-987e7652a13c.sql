UPDATE storage.buckets 
SET allowed_mime_types = ARRAY['application/pdf', 'text/plain', 'text/markdown', 'application/octet-stream', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document']
WHERE id = 'regulatory-documents';
