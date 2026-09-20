// Transport failures are not document findings. Keep the current group pending.
export class GapAIUnavailable extends Error {
  readonly code = 'AI_ANALYSIS_UNAVAILABLE';
  readonly reason: 'timeout' | 'overloaded' | 'rate_limited' | 'provider_error' | 'invalid_response' | 'not_configured';
  readonly providerStatus?: number;
  constructor(reason: GapAIUnavailable['reason'], providerStatus?: number) {
    super('Il servizio IA non ha completato la valutazione. L’avanzamento è salvato: riprendi l’analisi più tardi.');
    this.name = 'GapAIUnavailable';
    this.reason = reason;
    this.providerStatus = providerStatus;
  }
}

export function providerFailure(status: number): GapAIUnavailable {
  return new GapAIUnavailable(status === 429 ? 'rate_limited' : status === 503 ? 'overloaded' : 'provider_error', status);
}

export function validateBatchResults(ids: string[], result: Map<string, any>): Map<string, any> {
  const allowed = new Set(['covered', 'partial', 'missing', 'not_applicable']);
  if (result.size !== ids.length || ids.some(id => !allowed.has(result.get(id)?.status))) {
    throw new GapAIUnavailable('invalid_response');
  }
  return result;
}

// Stop scheduling work on the first failure and drain the already running calls.
// Retries belong to the saved assessment, not a burst of requests during an outage.
export async function evaluateBatches<T>(batches: T[], evaluate: (batch: T) => Promise<Map<string, any>>, concurrency = 2): Promise<Array<Map<string, any>>> {
  const results: Array<Map<string, any>> = new Array(batches.length);
  let next = 0;
  let failure: GapAIUnavailable | undefined;
  async function worker() {
    while (!failure && next < batches.length) {
      const index = next++;
      try { results[index] = await evaluate(batches[index]); }
      catch (error) {
        failure ||= error instanceof GapAIUnavailable ? error
          : new GapAIUnavailable(error instanceof Error && ['TimeoutError', 'AbortError'].includes(error.name) ? 'timeout' : 'provider_error');
      }
    }
  }
  await Promise.all(Array.from({ length: Math.min(batches.length, Math.max(1, concurrency)) }, worker));
  if (failure) throw failure;
  return results;
}

export function unavailableResponse(error: GapAIUnavailable, headers: Record<string, string>): Response {
  return new Response(JSON.stringify({error: error.message, code: error.code, reason: error.reason,
    retry_after_seconds: 60, resumable: true}), {
    status: 503, headers: {...headers, 'Content-Type':'application/json', 'Retry-After':'60'},
  });
}
