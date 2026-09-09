-- Pulisci tutti i chunks e documenti esistenti per ricominciare con embeddings consistenti
TRUNCATE TABLE chunks CASCADE;
TRUNCATE TABLE documents CASCADE;

-- Ricrea la colonna embedding con dimensioni corrette (768)
ALTER TABLE chunks DROP COLUMN IF EXISTS embedding;
ALTER TABLE chunks ADD COLUMN embedding vector(768);