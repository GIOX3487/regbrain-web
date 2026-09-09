import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";
import { Loader2, CheckCircle2, XCircle, Database, FileText, ArrowLeft } from "lucide-react";

interface RegulationStats {
  name: string;
  searchTerms: string[];
  documentCount: number;
  chunkCount: number;
  totalSizeKB: number;
  articlesFound: number[];
  loading: boolean;
  loaded: boolean;
}

const REGULATIONS: { name: string; searchTerms: string[] }[] = [
  { name: "GDPR", searchTerms: ["GDPR", "2016/679", "protezione dei dati personali"] },
  { name: "NIS2", searchTerms: ["NIS2", "NIS 2", "2022/2555"] },
  { name: "DORA", searchTerms: ["DORA", "2022/2554", "resilienza operativa digitale"] },
  { name: "AI Act", searchTerms: ["AI Act", "2024/1689", "intelligenza artificiale"] },
  { name: "CRA", searchTerms: ["CRA", "Cyber Resilience Act", "2024/2847", "ciberresilienza"] },
  { name: "Codice della Cybersicurezza", searchTerms: ["Codice della Cybersicurezza", "cybersicurezza nazionale"] },
  { name: "D.Lgs 81/08", searchTerms: ["81/08", "81/2008", "sicurezza sul lavoro", "testo unico sicurezza"] },
  { name: "ISO 27001", searchTerms: ["ISO 27001", "27001"] },
  { name: "Data Act", searchTerms: ["Data Act", "2023/2854"] },
  { name: "Legge 124/2024 Albania", searchTerms: ["124/2024", "protezione dati albania", "Albanian"] },
];

const extractArticleNumbers = (text: string): number[] => {
  const regex = /(?:articolo|art\.?)\s*(\d+)/gi;
  const numbers = new Set<number>();
  let match;
  while ((match = regex.exec(text)) !== null) {
    numbers.add(parseInt(match[1], 10));
  }
  return Array.from(numbers).sort((a, b) => a - b);
};

const VerifyKnowledgeBase = () => {
  const navigate = useNavigate();
  const [stats, setStats] = useState<RegulationStats[]>(
    REGULATIONS.map(r => ({
      ...r,
      documentCount: 0,
      chunkCount: 0,
      totalSizeKB: 0,
      articlesFound: [],
      loading: false,
      loaded: false,
    }))
  );
  const [loadingAll, setLoadingAll] = useState(false);

  const loadRegulationStats = async (index: number) => {
    setStats(prev => prev.map((s, i) => i === index ? { ...s, loading: true } : s));

    const reg = REGULATIONS[index];
    try {
      // Find documents matching this regulation
      let docIds: string[] = [];
      for (const term of reg.searchTerms) {
        const { data: docs } = await supabase
          .from("documents")
          .select("id, title")
          .ilike("title", `%${term}%`);
        if (docs) {
          for (const d of docs) {
            if (!docIds.includes(d.id)) docIds.push(d.id);
          }
        }
      }

      // Also check structured_chunks for this regulation
      const { data: structuredDocs } = await supabase
        .from("structured_chunks")
        .select("document_id")
        .ilike("regulation", `%${reg.searchTerms[0]}%`)
        .limit(500);
      
      if (structuredDocs) {
        for (const sc of structuredDocs) {
          if (!docIds.includes(sc.document_id)) docIds.push(sc.document_id);
        }
      }

      const documentCount = docIds.length;

      // Get chunks for these documents
      let chunkCount = 0;
      let totalSize = 0;
      const allArticles = new Set<number>();

      if (docIds.length > 0) {
        // Process in batches of 10
        for (let i = 0; i < docIds.length; i += 10) {
          const batch = docIds.slice(i, i + 10);
          const { data: chunks, count } = await supabase
            .from("chunks")
            .select("content", { count: "exact" })
            .in("document_id", batch)
            .limit(1000);

          if (count) chunkCount += count;
          if (chunks) {
            for (const chunk of chunks) {
              totalSize += new Blob([chunk.content]).size;
              const articles = extractArticleNumbers(chunk.content);
              articles.forEach(a => allArticles.add(a));
            }
          }
        }

        // Also check structured_chunks
        const { data: sChunks, count: sCount } = await supabase
          .from("structured_chunks")
          .select("chunk_text, article_number", { count: "exact" })
          .in("document_id", docIds)
          .limit(1000);

        if (sCount) chunkCount += sCount;
        if (sChunks) {
          for (const sc of sChunks) {
            totalSize += new Blob([sc.chunk_text]).size;
            if (sc.article_number) allArticles.add(sc.article_number);
            const articles = extractArticleNumbers(sc.chunk_text);
            articles.forEach(a => allArticles.add(a));
          }
        }
      }

      setStats(prev => prev.map((s, i) => i === index ? {
        ...s,
        documentCount,
        chunkCount,
        totalSizeKB: Math.round(totalSize / 1024),
        articlesFound: Array.from(allArticles).sort((a, b) => a - b),
        loading: false,
        loaded: true,
      } : s));
    } catch (error) {
      console.error(`Error loading stats for ${reg.name}:`, error);
      setStats(prev => prev.map((s, i) => i === index ? { ...s, loading: false, loaded: true } : s));
    }
  };

  const loadAll = async () => {
    setLoadingAll(true);
    for (let i = 0; i < REGULATIONS.length; i++) {
      await loadRegulationStats(i);
    }
    setLoadingAll(false);
  };

  const isSufficient = (s: RegulationStats) => s.chunkCount > 50 && s.articlesFound.length > 10;

  return (
    <div className="container max-w-6xl mx-auto py-8 px-4">
      <div className="flex items-center gap-4 mb-6">
        <Button variant="ghost" onClick={() => navigate('/chat')}>
          <ArrowLeft className="w-4 h-4 mr-2" />
          Torna alla Chat
        </Button>
      </div>

      <div className="flex justify-between items-start mb-6">
        <div>
          <h1 className="text-3xl font-bold mb-2 flex items-center gap-3">
            <Database className="w-8 h-8 text-primary" />
            Verifica Knowledge Base
          </h1>
          <p className="text-muted-foreground">
            Dashboard di verifica della copertura normativa nel sistema RAG.
          </p>
        </div>
        <Button onClick={loadAll} disabled={loadingAll} size="lg">
          {loadingAll ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Analisi in corso...
            </>
          ) : (
            "Verifica Tutte"
          )}
        </Button>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {stats.map((s, i) => (
          <Card key={s.name} className="overflow-hidden">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg flex items-center gap-2">
                  <FileText className="w-5 h-5 text-primary" />
                  {s.name}
                </CardTitle>
                {s.loaded && (
                  isSufficient(s) ? (
                    <Badge className="bg-green-100 text-green-800 border-green-300">
                      <CheckCircle2 className="w-3 h-3 mr-1" />
                      Sufficiente
                    </Badge>
                  ) : (
                    <Badge className="bg-red-100 text-red-800 border-red-300">
                      <XCircle className="w-3 h-3 mr-1" />
                      Insufficiente
                    </Badge>
                  )
                )}
              </div>
            </CardHeader>
            <CardContent>
              {s.loading ? (
                <div className="flex items-center gap-2 text-muted-foreground py-4">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Analisi in corso...
                </div>
              ) : s.loaded ? (
                <div className="space-y-3">
                  <div className="grid grid-cols-3 gap-3 text-sm">
                    <div className="bg-muted/50 rounded-lg p-3 text-center">
                      <div className="text-2xl font-bold text-foreground">{s.documentCount}</div>
                      <div className="text-muted-foreground text-xs">Documenti</div>
                    </div>
                    <div className="bg-muted/50 rounded-lg p-3 text-center">
                      <div className="text-2xl font-bold text-foreground">{s.chunkCount}</div>
                      <div className="text-muted-foreground text-xs">Chunk</div>
                    </div>
                    <div className="bg-muted/50 rounded-lg p-3 text-center">
                      <div className="text-2xl font-bold text-foreground">{s.totalSizeKB}</div>
                      <div className="text-muted-foreground text-xs">KB</div>
                    </div>
                  </div>

                  <div>
                    <p className="text-xs font-medium text-muted-foreground mb-1">
                      Articoli trovati ({s.articlesFound.length}):
                    </p>
                    {s.articlesFound.length > 0 ? (
                      <div className="flex flex-wrap gap-1 max-h-20 overflow-y-auto">
                        {s.articlesFound.map(a => (
                          <span key={a} className="inline-block bg-primary/10 text-primary text-xs px-1.5 py-0.5 rounded">
                            Art. {a}
                          </span>
                        ))}
                      </div>
                    ) : (
                      <p className="text-xs text-muted-foreground italic">Nessun articolo trovato</p>
                    )}
                  </div>
                </div>
              ) : (
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full"
                  onClick={() => loadRegulationStats(i)}
                >
                  Verifica
                </Button>
              )}
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
};

export default VerifyKnowledgeBase;
