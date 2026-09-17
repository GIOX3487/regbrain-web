import { CHECKS_VERSION } from './gap-checks.ts';
import type { RegulatoryRequirement, ApplicabilityProfile } from './gap-checks.ts';
function canonicalizeString(value: unknown): string {
  return String(value ?? '')
    .normalize('NFKC')
    .replace(/\u0000/g, '')
    .replace(/\r\n/g, '\n').replace(/\r/g, '\n')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

export async function generateCacheFingerprint(
  regulations: string[],
  userDocuments: Array<{ name: string; type: string; content: string }>,
  language: string,
  profile: any,
  annualRevenue: number | null | undefined,
  requirements: RegulatoryRequirement[] = [],
  applicabilityProfile: ApplicabilityProfile | null = null,
  model = '',
): Promise<string> {
  const canonicalInput = JSON.stringify({
    v: CHECKS_VERSION,
    q: [...requirements].sort((a, b) => a.id.localeCompare(b.id)),
    size: canonicalizeString(applicabilityProfile?.size || ''),
    model,
    a: Object.entries(applicabilityProfile?.answers || {}).sort(([x], [y]) => x.localeCompare(y)),
    r: [...regulations].map(canonicalizeString).filter(Boolean).sort((a, b) => a.localeCompare(b)),
    l: canonicalizeString(language).toLowerCase() || 'it',
    p: {
      j: canonicalizeString(profile?.jurisdiction || 'EU'),
      s: canonicalizeString(profile?.sector || 'Technology'),
      c: canonicalizeString(profile?.compliance_role || 'DPO'),
    },
    rev: Math.max(0, Number(annualRevenue || 5000000)),
    d: userDocuments.map(d => ({ n: d.name, t: d.type, c: d.content })),
  });
  const data = new TextEncoder().encode(canonicalInput);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(hashBuffer)).map(b => b.toString(16).padStart(2, '0')).join('');
}

