export interface RegulatorySource {
  id: string;
  content: string;
  document_id: string;
  regulation: string;
}

const ACT_PATTERNS: Record<string, string> = {
  GDPR: '2016/679', NIS2: '2022/2555', DORA: '2022/2554',
  'AI Act': '2024/1689', CRA: '2024/2847', 'Data Act': '2023/2854',
};

// Only public normative documents; stable pagination avoids arbitrary first-N coverage.
export async function loadRegulatorySources(db: any, regulations: string[]): Promise<RegulatorySource[]> {
  const result: RegulatorySource[] = [];
  for (const regulation of regulations) {
    const ids: string[] = [];
    for (let from = 0; ; from += 500) {
      const { data, error } = await db.from('documents').select('id')
        .eq('is_public', true).ilike('title', `%${ACT_PATTERNS[regulation] || regulation}%`)
        .order('id').range(from, from + 499);
      if (error) throw error;
      ids.push(...(data || []).map((d: any) => d.id));
      if (!data || data.length < 500) break;
    }
    for (const id of ids) {
      for (let from = 0; ; from += 500) {
        const { data, error } = await db.from('chunks').select('id, content, document_id')
          .eq('document_id', id).order('id').range(from, from + 499);
        if (error) throw error;
        result.push(...(data || []).map((c: any) => ({ ...c, regulation })));
        if (!data || data.length < 500) break;
      }
    }
  }
  return result;
}

export function findRegulatorySource(reference: string, regulation: string, sources: RegulatorySource[]) {
  const none = { chunk_id: null as string | null, excerpt: null as string | null };
  // Compound references and national implementing acts need their own source mapping.
  // Leave them unlinked rather than silently substituting one article of an EU act.
  if (/D\.\s*Lgs|ACN|articoli|articles|\d\s*[-–/]\s*\d/i.test(reference)) return none;
  const article = reference.match(/(?:articolo|art\.?|article)\s+(\d+)(?![\d\w])/i)?.[1];
  if (!article) return none;
  const paragraph = reference.match(/(?:paragrafo|par\.?|paragraph)\s+(\d+)(?![\d\w])/i)?.[1];
  for (const source of sources) {
    if (source.regulation !== regulation) continue;
    const header = source.content.match(/^\[([^\]\n]+)\]/)?.[1];
    if (!header || header.split(',')[0].trim().toLowerCase() !== regulation.toLowerCase()) continue;
    const sourceArticle = header.match(/\bArt\.\s+(\d+)(?![\d\w])/i)?.[1];
    const sourceParagraph = header.match(/\bPar\.\s+(\d+)(?![\d\w])/i)?.[1];
    if (sourceArticle === article && (!paragraph || paragraph === sourceParagraph)) return { chunk_id: source.id, excerpt: source.content.substring(0, 300) };
  }
  return none;
}
