import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

async function embedViaGateway(text: string): Promise<number[] | null> {
  const key = Deno.env.get("LOVABLE_API_KEY");
  if (!key) return null;
  try {
    const res = await fetch("https://ai.gateway.lovable.dev/v1/embeddings", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-embedding-001",
        input: text.substring(0, 4000),
        dimensions: 768,
      }),
    });
    if (!res.ok) return null;
    const data = await res.json();
    const vec = data?.data?.[0]?.embedding;
    return Array.isArray(vec) ? vec : null;
  } catch (_e) {
    return null;
  }
}

async function embedQuery(
  geminiKey: string,
  text: string,
): Promise<number[] | null> {
  const gw = await embedViaGateway(text);
  if (gw) return gw;
  try {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-embedding-001:embedContent?key=${geminiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "models/gemini-embedding-001",
          content: { parts: [{ text: text.substring(0, 4000) }] },
          taskType: "RETRIEVAL_QUERY",
          outputDimensionality: 768,
        }),
      },
    );
    if (!res.ok) return null;
    const data = await res.json();
    return data.embedding?.values ?? null;
  } catch (_e) {
    return null;
  }
}

/** Riordinamento con modello leggero (cross-encoder LLM). */
async function rerank(
  lovableKey: string,
  question: string,
  candidates: Array<{ label: string; text: string }>,
  top: number,
): Promise<number[] | null> {
  if (candidates.length <= top) return candidates.map((_, i) => i);
  const passages = candidates
    .map((c, i) => `[${i}] ${c.label}\n${c.text.substring(0, 500)}`)
    .join("\n\n");
  try {
    const res = await fetch(
      "https://ai.gateway.lovable.dev/v1/chat/completions",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${lovableKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "google/gemini-2.5-flash",
          messages: [
            {
              role: "system",
              content:
                `Sei un ordinatore di rilevanza per testi normativi. Data una domanda e passi numerati, restituisci SOLO un array JSON con gli indici ordinati per rilevanza, i migliori ${top}. Nessun altro testo.`,
            },
            { role: "user", content: `Domanda: ${question}\n\n${passages}` },
          ],
          temperature: 0,
          max_tokens: 300,
        }),
      },
    );
    if (!res.ok) return null;
    const data = await res.json();
    const txt = data.choices?.[0]?.message?.content ?? "";
    const m = txt.match(/\[[\d,\s]+\]/);
    if (!m) return null;
    const idx: number[] = JSON.parse(m[0]);
    return idx.filter((i) => i >= 0 && i < candidates.length);
  } catch (_e) {
    return null;
  }
}

function normArticle(s: string): string {
  return s
    .toLowerCase()
    .replace(/articolo|art\.?/g, "art")
    .replace(/paragrafo|par\.?/g, "par")
    .replace(/\s+/g, "")
    .replace(/[,;]/g, ":");
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Non autorizzato" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user } } = await userClient.auth.getUser();
    if (!user) {
      return new Response(JSON.stringify({ error: "Non autorizzato" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(supabaseUrl, serviceKey);
    const { data: roleRow } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .eq("role", "admin")
      .maybeSingle();
    if (!roleRow) {
      return new Response(
        JSON.stringify({ error: "Accesso riservato agli amministratori" }),
        {
          status: 403,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    const body = await req.json().catch(() => ({}));
    const label: string = String(body.label ?? "manuale").substring(0, 80);
    const useRerank: boolean = body.rerank !== false;
    const maxQueries: number = Math.min(Number(body.maxQueries ?? 40), 120);
    const regulationFilter: string | null = body.regulation ?? null;

    const geminiKey = Deno.env.get("GEMINI_API_KEY");
    const lovableKey = Deno.env.get("LOVABLE_API_KEY");
    if (!geminiKey) {
      return new Response(
        JSON.stringify({ error: "Chiave per gli embedding non configurata" }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    let q = supabase
      .from("rag_golden_queries")
      .select(
        "id, query_text, regulation, category, expected_articles, expected_chunk_keys",
      )
      .eq("active", true)
      .limit(maxQueries);
    if (regulationFilter) q = q.eq("regulation", regulationFilter);
    const { data: goldens, error: gErr } = await q;
    if (gErr) throw gErr;
    if (!goldens || goldens.length === 0) {
      return new Response(
        JSON.stringify({ error: "Nessuna domanda di riferimento attiva" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    const details: Array<Record<string, unknown>> = [];
    let recallSum = 0;
    let mrrSum = 0;
    let precisionSum = 0;

    for (const g of goldens) {
      const emb = await embedQuery(geminiKey, g.query_text);
      if (!emb) {
        details.push({
          query: g.query_text,
          error: "embedding non disponibile",
          recall: 0,
          rr: 0,
        });
        continue;
      }

      const { data: matches } = await supabase.rpc(
        "match_structured_chunks_v2",
        {
          query_embedding: emb,
          filter_regulation: g.regulation ?? null,
          filter_article_number: null,
          match_threshold: 0.35,
          match_count: 40,
        },
      );

      let candidates = (matches ?? []) as Array<Record<string, unknown>>;

      if (useRerank && lovableKey && candidates.length > 10) {
        const order = await rerank(
          lovableKey,
          g.query_text,
          candidates.map((c) => ({
            label: String(c.citation_label ?? c.article_reference ?? ""),
            text: String(c.chunk_text ?? ""),
          })),
          10,
        );
        if (order) candidates = order.map((i) => candidates[i]);
      }

      const top10 = candidates.slice(0, 10);
      const expectedArticles = (g.expected_articles ?? []).map(normArticle);
      const expectedKeys = g.expected_chunk_keys ?? [];

      const isHit = (c: Record<string, unknown>): boolean => {
        const key = String(c.chunk_key ?? "");
        if (expectedKeys.length > 0 && expectedKeys.includes(key)) return true;
        const artNum = c.article_number;
        const par = c.paragraph;
        if (artNum === null || artNum === undefined) return false;
        const forms = [
          normArticle(`art ${artNum}`),
          par ? normArticle(`art ${artNum}, par ${par}`) : "",
        ].filter(Boolean);
        return expectedArticles.some((e) =>
          forms.some((f) => e === f || e.startsWith(f))
        );
      };

      const hits = top10.filter(isHit);
      const distinctHitArticles = new Set(
        hits.map((h) => `art${h.article_number}`),
      );
      const expectedArticleCount = new Set(
        expectedArticles.map((e) => e.split(":")[0]),
      ).size;
      const recall = expectedArticleCount > 0
        ? distinctHitArticles.size / expectedArticleCount
        : 0;
      const firstHitIdx = top10.findIndex(isHit);
      const rr = firstHitIdx >= 0 ? 1 / (firstHitIdx + 1) : 0;
      const precision = top10.length > 0 ? hits.length / top10.length : 0;

      recallSum += Math.min(recall, 1);
      mrrSum += rr;
      precisionSum += precision;

      details.push({
        query: g.query_text,
        regulation: g.regulation,
        category: g.category,
        expected: g.expected_articles,
        retrieved: top10.map((c) => c.citation_label ?? c.article_reference),
        recall: Number(Math.min(recall, 1).toFixed(3)),
        rr: Number(rr.toFixed(3)),
        precision: Number(precision.toFixed(3)),
      });
    }

    const n = goldens.length;
    const runRecord = {
      label,
      queries_total: n,
      recall_at_10: Number((recallSum / n).toFixed(4)),
      mrr: Number((mrrSum / n).toFixed(4)),
      article_precision: Number((precisionSum / n).toFixed(4)),
      rerank_enabled: useRerank,
      details,
      run_by: user.id,
    };

    const { data: saved, error: saveErr } = await supabase
      .from("rag_eval_runs")
      .insert(runRecord)
      .select("id, created_at")
      .single();
    if (saveErr) console.error("[rag-eval] save error", saveErr);

    return new Response(
      JSON.stringify({
        success: true,
        runId: saved?.id ?? null,
        ...runRecord,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e) {
    console.error("[rag-eval] fatal", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : String(e) }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  }
});
