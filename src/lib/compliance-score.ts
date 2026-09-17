export function formatComplianceScore(value: number | null | undefined): string {
  return typeof value === 'number' && Number.isFinite(value) ? `${value.toFixed(0)}%` : 'N/D';
}
