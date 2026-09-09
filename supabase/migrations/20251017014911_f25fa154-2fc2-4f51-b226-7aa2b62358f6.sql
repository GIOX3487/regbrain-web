-- Modifica la policy per permettere a tutti gli utenti autenticati di leggere i documenti
DROP POLICY IF EXISTS "Users can view own documents" ON documents;

CREATE POLICY "Authenticated users can view all documents"
  ON documents
  FOR SELECT
  TO authenticated
  USING (true);