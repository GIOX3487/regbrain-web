export const EMBEDDING_MODEL = 'gemini-embedding-001';
export const EMBEDDING_DIMENSIONS = 768;
export type EmbeddingTask = 'RETRIEVAL_DOCUMENT' | 'RETRIEVAL_QUERY' | 'SEMANTIC_SIMILARITY';

export function normalizeEmbedding(value: unknown): number[] {
  if (!Array.isArray(value) || value.length !== EMBEDDING_DIMENSIONS || value.some(n => typeof n !== 'number' || !Number.isFinite(n))) {
    throw new Error('Invalid embedding dimensions or values');
  }
  const norm = Math.sqrt(value.reduce((sum, n) => sum + n * n, 0));
  if (!Number.isFinite(norm) || norm === 0) throw new Error('Invalid embedding norm');
  return value.map(n => n / norm);
}

export async function embedTexts(apiKey: string, texts: string[], task: EmbeddingTask, transport: typeof fetch = globalThis.fetch): Promise<number[][]> {
  if (!apiKey || texts.length < 1 || texts.length > 20 || texts.some(t => typeof t !== 'string' || !t.trim() || t.length > 8000)) {
    throw new Error('Invalid embedding request');
  }
  const response = await transport(`https://generativelanguage.googleapis.com/v1beta/models/${EMBEDDING_MODEL}:batchEmbedContents`, {
    method: 'POST',
    headers: {'Content-Type':'application/json', 'x-goog-api-key':apiKey},
    signal: AbortSignal.timeout(35000),
    body: JSON.stringify({requests: texts.map(text => ({model:`models/${EMBEDDING_MODEL}`,content:{parts:[{text}]},taskType:task,outputDimensionality:EMBEDDING_DIMENSIONS}))}),
  });
  if (!response.ok) {
    // Never expose provider bodies, API keys or request URLs in logs/responses.
    let detail: any = {};
    try { detail = await response.json(); } catch { /* body is intentionally discarded */ }
    const entries = Array.isArray(detail?.error?.details) ? detail.error.details : [];
    const quotas = entries.flatMap((item:any) => Array.isArray(item.violations) ? item.violations.map((v:any) => v.quotaId).filter((v:unknown) => typeof v === 'string' && /^[a-zA-Z0-9_-]+$/.test(v)) : []);
    const retry = entries.find((item:any) => typeof item.retryDelay === 'string' && /^\d+(\.\d+)?s$/.test(item.retryDelay))?.retryDelay;
    throw new Error(`Embedding provider HTTP ${response.status}${quotas.length ? '; quota='+quotas.join(',') : ''}${retry ? '; retry='+retry : ''}`);
  }
  const data = await response.json();
  if (!Array.isArray(data.embeddings) || data.embeddings.length !== texts.length) throw new Error('Incomplete embedding batch');
  return data.embeddings.map((item: any) => normalizeEmbedding(item.values));
}

export function configuredServiceKeys(read: (name:string)=>string|undefined): string[] {
  let map: unknown;
  try { map = JSON.parse(read('SUPABASE_SECRET_KEYS') || '{}'); } catch { map = {}; }
  const modern = map && typeof map === 'object' && !Array.isArray(map) ? Object.values(map) : [];
  return [...modern, read('SUPABASE_SECRET_KEY'), read('SUPABASE_SERVICE_ROLE_KEY')].filter((v): v is string => typeof v === 'string' && v.length > 20);
}

export async function isServiceRequest(req: Request, keys: string[]): Promise<boolean> {
  const supplied = req.headers.get('apikey') || req.headers.get('authorization')?.replace(/^Bearer /,'') || '';
  if (!supplied || !keys.length) return false;
  const digest = async (v:string) => new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(v)));
  const actual = await digest(supplied);
  for (const key of keys) {
    const expected = await digest(key);
    let difference = 0;
    for (let i=0;i<actual.length;i++) difference |= actual[i] ^ expected[i];
    if (difference === 0) return true;
  }
  return false;
}
