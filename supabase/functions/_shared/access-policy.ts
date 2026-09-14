type Denial = {error: string; status: number};
type OwnershipLookup = (table: string, id: string, userId: string) => Promise<boolean>;

export async function validateRequestAccess(req: Request, userId: string, owns: OwnershipLookup): Promise<Denial | null> {
  // The handlers parse JSON regardless of Content-Type. Apply the same checks
  // to every supplied body, regardless of header or HTTP method. Bodyless
  // maintenance handlers remain supported; authentication is handled by protect.
  if (req.body === null) return null;
  let body: Record<string, unknown>;
  try { body = await req.clone().json(); } catch { return {error:'Richiesta non valida.', status:400}; }
  if (!body || typeof body !== 'object' || Array.isArray(body)) return {error:'Richiesta non valida.', status:400};
  for (const field of ['userId', 'user_id']) {
    if (body[field] && body[field] !== userId) return {error:'Accesso non consentito.', status:403};
  }
  for (const [field, table] of [
    ['assessmentId', 'compliance_assessments'], ['assessment_id', 'compliance_assessments'],
    ['modelId', 'ai_models'], ['monitorId', 'compliance_monitors'],
    ['_backgroundDocId', 'generated_documents'],
  ]) {
    const id = body[field];
    if (id === undefined || id === null) continue;
    if (typeof id !== 'string' || !id.trim()) return {error:'Richiesta non valida.', status:400};
    if (!await owns(table, id, userId)) return {error:'Elemento non trovato nel tuo account.', status:403};
  }
  return null;
}
