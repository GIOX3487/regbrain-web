# Specifica Tecnica Completa — RegBrain Gap Analysis

Versione codice analizzato: `gap-analysis-v18-realistic-fines` (cache fingerprint, `supabase/functions/gap-analysis/index.ts` r. 2760).

Questa specifica descrive **esattamente** le regole e il flusso operativo della Gap Analysis, in modo che un agente AI esterno possa replicarla end-to-end. Ogni sezione cita, dove utile, i riferimenti di riga nei file sorgente.

---

## 1. Pipeline generale

```
INPUT UTENTE (src/pages/NewAssessment.tsx)
  ├─ Estrazione testo client-side (PDF/DOCX/XLSX/CSV/TXT)
  ├─ INSERT compliance_assessments
  ├─ Fire-and-forget POST → /functions/v1/gap-analysis
  └─ Polling DB ogni 3s per max 8 min

EDGE FUNCTION gap-analysis
  0. Auth JWT + validazione (UUID, max 50 doc, ≥1 regulation)
  1. Canonicalizzazione input (NFKC, whitespace, sort deterministico)
  2. SHA-256 fingerprint (cache key)
  3. Cache lookup in gap_analysis_cache (user_id, cache_key)
     HIT  → riusa gaps → salta a STEP 9
     MISS ↓
  4. Selezione requisiti applicabili:
     - REQUIREMENTS_CATALOG hardcoded (per normativa)
     - + regulatory_requirements dinamici (active=true)
  5. Build user corpus (lowercase, tutti i doc concatenati)
  6. Build RAG Validation Cache (chunks KB → set articoli presenti)
  7. [Opz.] Embeddings granulari doc utente (gemini-embedding-001, dim 768)
  8. Per ogni requisito:
     a) RAG validation (requisito esiste nella KB? altrimenti SKIP)
     b) Keyword matching deterministico (threshold 0.10, min_matches 1)
     c) Zona ambigua → semantic matching con embeddings
     d) Benefit-of-the-doubt se ≥1 keyword e coverage ≥ 0.10 (senza embed)
  8b. Cosine sim > 0.65 → COVERED; 0.30–0.65 → COVERED (benefit); < 0.30 → GAP
  8c. Sort deterministico gaps (requirement_reference|gap_description)
  8d. Salva in gap_analysis_cache
  9. LLM Enrichment Layer (google/gemini-3-pro-preview, temp 0)
     — SOLO correzione di requirement_reference; testi restano dal catalogo
  10. Risoluzione source_chunk_id (traceability)
  11. Scoring: risk_score, compliance %, sanzioni
  12. DELETE + INSERT idempotenti in identified_gaps + action_plans
  13. UPDATE compliance_assessments (status=completed)
  14. Response JSON
```

---

## 2. Input attesi

Body POST all'edge function:
```json
{
  "assessmentId": "<UUID v4>",
  "userDocuments": [{ "name": "...", "type": "...", "content": "..." }],
  "regulations": ["GDPR", "NIS2", "..."],
  "language": "it"
}
```

Limiti:
- Max documenti: **50** (edge, r. 1976) / 30 nel form UI
- Max caratteri per file: **15.000** (troncato)
- Max caratteri totali: **400.000**
- Lingue: it, en, es, fr, de
- Normative supportate: GDPR, NIS2, DORA, AI Act, CRA, Data Act, ISO 27001, D.Lgs 81/08, Legge 124/2024 Albania

Estrazione testo client-side (`NewAssessment.tsx`):
| Formato | Libreria |
|---|---|
| `.pdf` | `pdfjs-dist`, max 80 pagine |
| `.docx/.doc` | `mammoth` (extractRawText) |
| `.xlsx/.xls/.csv` | `xlsx` (SheetJS), tutte le sheet concatenate come CSV con header `--- SheetName ---` |
| `.txt/.md/.json/.xml/.html/.rtf` | `file.text()` |
| Fallback binario | TextDecoder UTF-8 → windows-1252 → ISO-8859-1, regex `[A-Za-zÀ-ÿ0-9][…]{20,}` |

Normalizzazione: rimozione `\u0000`, compressione whitespace, min 10 caratteri.

---

## 3. Estrazione requisiti dalla normativa (`extract-requirements`)

1. `documents.ilike(title, %pattern%)` con pattern per normativa.
2. Recupero `chunks` + `structured_chunks` per document_id.
3. Raggruppamento per articolo: prima da `structured_chunks.article_number`, poi da `chunks` con regex `/(?:articol[oi]|article|art\.?)\s*(\d+)/gi` + snippet ±200/2000 char.
4. Paginazione: `offset` + `limit=30` articoli per chiamata.
5. Batching: `BATCH_SIZE=10` articoli, `PARALLEL=3` batch concorrenti.
6. Upsert in `regulatory_requirements` (batch 20, conflict su `requirement_id`).

Modello: `google/gemini-2.5-flash`, `temperature=0`, `max_tokens=8000`, endpoint `https://ai.gateway.lovable.dev/v1/chat/completions`.

Prompt (user):
```
Analizza questi articoli della normativa "{regulation}" ed estrai SOLO i requisiti
che impongono OBBLIGHI CONCRETI E VERIFICABILI alle organizzazioni.

NON includere: definizioni, ambito di applicazione, disposizioni transitorie,
riferimenti senza obbligo.

{articlesText}

Per ogni requisito, restituisci un JSON array con:
- "requirement_id": "{regIdPrefix}_artN_topic"
- "article_number": integer
- "reference": "Articolo N {regulation} - Titolo"
- "description_it" / "description_en": 2-3 frasi
- "risk_level": critical|high|medium|low
- "remediation_effort": very_high|high|medium|low
- "coverage_keywords": ALMENO 8 termini PRATICI (IT+EN), sinonimi, abbreviazioni (DPO,DPIA,ROPA,DSAR)
- "gap_description_it" / "gap_description_en"
- "recommended_action_it" / "recommended_action_en"
- "action_hours": integer

Se un articolo non contiene obblighi concreti, restituisci [].
Restituisci SOLO un JSON array valido, SENZA markdown/commenti/backtick.
```

Validazione output: accetta se `requirement_id`, `description_it`, e `coverage_keywords.length ≥ 3`.

Default per requisito estratto:
```
coverage_threshold: 0.10
min_keyword_matches: 1
action_cost_eur: action_hours * 85   // €85/h (HOURLY_RATE_EUR)
source: 'auto_extracted'
verified: false
active: false   // attivato solo dal cleanup
```

Catalogo hardcoded (`REQUIREMENTS_CATALOG`):
| Normativa | # req hardcoded |
|---|---:|
| GDPR | 11 (Art. 5,6,13-14,12/15-22,25,28,30,32,33-34,35,37) |
| NIS2 (+ D.Lgs 138/2024) | 11 |
| DORA | 4 (Art. 5,6,17,28) |
| AI Act | 5 (Art. 9,11,13,14,15) |
| ISO 27001 | 15 (Clauses 4–10 + Annex A.5–A.8) |
| D.Lgs 81/08 | 9 |
| Legge 124/2024 Albania, CRA, Data Act | presenti |

Il catalogo hardcoded è **interamente scritto a mano** (NO AI involved).

---

## 4. Balance & Cleanup requisiti

### balance-requirements (solo `source='auto_extracted'`)
Allowlist articoli:
- D.Lgs 81/08: [17,18,26,28,30,31,32,…,190]
- AI Act: [5,6,9,10,11,13,14,15,16,17,26,27,50,53,55]
- GDPR: [5,6,7,9,12,13,14,15,17,20,22,24,25,26,28,30,32,33,34,35,37,44–49]
- DORA: [5–13,17,19,24–28,30]

Fuori allowlist → **elimina**. Blacklist ID: `ai_act_art36_notify_changes`, `gdpr_art62_joint_operations`.

### cleanup-requirements (6 passi)
1. Elimina requisiti con testo che impone obblighi a Stati Membri (8 pattern IT + 5 EN).
2. Elimina articoli con `article_number ≤ 0` o `> max` (GDPR≤99, NIS2≤46, DORA≤64, AI Act≤113, CRA≤71, Data Act≤50, ISO 27001≤10, D.Lgs 81/08≤306).
3. Deduplica: max 2 req per `(regulation, article_number)`, ordinati per `risk_level` DESC (critical>high>medium>low), poi `action_hours` DESC.
4. Clamp `action_hours ∈ [8, 120]`; ricalcola `action_cost_eur = hours * 85`.
5. Elimina requisiti con `coverage_keywords.length < 4`.
6. Soglie uniformi: `coverage_threshold=0.10`, `min_keyword_matches=1`, `rag_validation_keywords=['articolo N','art. N','art N']`.

Post-cleanup: sopravvissuti → `verified=true, active=true`.

---

## 5. Retrieval RAG

**Non pgvector/HNSW** nella gap analysis. Retrieval per titolo documento:
```ts
documents.select('id,title').ilike('title', `%${pattern}%`).limit(10)
chunks.select('content').in('document_id', docIds).limit(500)
```

Pattern per normativa (esempi):
- GDPR: `['GDPR','General Data Protection','2016/679']`
- NIS2: `['NIS2','NIS 2','2022/2555','D.Lgs. 138','138/2024','Determinazione ACN','Piattaforma NIS','Decreto NIS']`
- DORA: `['DORA','Digital Operational Resilience','2022/2554']`
- AI Act: `['AI Act','Artificial Intelligence','2024/1689']`
- ISO 27001: `['ISO 27001','ISO/IEC 27001','ISMS']`

Da ogni chunk estrae articoli con:
```
/(?:articolo|art\.?|article)\s+\d+/gi
/clausola\s+\d+/gi
/clause\s+\d+/gi
/annex\s+a/gi
/a\.\d+/gi
```
Risultato: `Map<regulation_lowercase, Set<string>>`.

**RAG validation di un requisito**: passa sse almeno uno dei suoi `rag_validation_keywords` è nel Set della normativa. Se la KB è vuota per quella normativa → **tutti i suoi requisiti vengono saltati** (guardrail).

`structured_chunks` (in extract-requirements) è la fonte primaria per raggruppare per articolo (l'equivalente interno di "Strategy 0"); i `chunks` sono fallback.

---

## 6. Semantic matching gap ↔ requisito

### 6.1 Keyword matching deterministico
Normalizzazione corpus: `NFKC → lowercase → NFD → strip diacritici → [^\p{L}\p{N}\s]→spazio`.

Stop-words IT + EN usate per match flessibile:
```
di, del, della, delle, dello, dei, degli, dell,
a, al, alla, alle, allo, ai, agli,
da, dal, dalla, dalle, dallo, dai, dagli,
in, nel, nella, nelle, nello, nei, negli,
su, sul, sulla, sulle, sullo, sui, sugli,
con, per, tra, fra, e, ed, o, od,
il, lo, la, i, gli, le, l, un, uno, una,
che, the, of, and, for, to, in, on, by
```

Match keyword:
1. `corpus.includes(keyword)` letterale.
2. Se fallisce e ≥2 token, regex con stop-word opzionali tra token:
   `"diritti interessato" → /diritti\s+(?:di|del|...)?\s*interessato/i`.

Formula:
```
coveredKeywords    = keywords trovate nel corpus
uniqueKeywordCount = max(1, |Set(normalized(keywords))|)
coverageRatio      = coveredKeywords.length / uniqueKeywordCount

isCovered = (coveredKeywords.length ≥ min_keyword_matches)
         AND (coverageRatio ≥ coverage_threshold)
```

Default: `coverage_threshold=0.10`, `min_keyword_matches=1`.
Eccezione: `gdpr_art12_15_22_data_subject_rights` → `threshold=0.05`, `min=1`.

### 6.2 Zona ambigua & semantic matching
Trigger: `0 < coverageRatio < threshold` E embeddings disponibili.

- Modello: `models/gemini-embedding-001`, `outputDimensionality=768` (Gemini API diretta).
- Testo embedded del requisito:
  `"{reference}: {description_it} {description_en} {coverage_keywords.join(', ')}"` (troncato 4000 char).
- Documenti utente splittati in sezioni ~500 char (per paragrafo, poi per frase se >750; min 50 char).
- Cosine: `sim(a,b) = (a·b) / (||a||·||b||)`.

Decisione:
| cosine | esito |
|---|---|
| > 0.65 | COVERED |
| 0.30–0.65 | COVERED (benefit-of-the-doubt) |
| < 0.30 | GAP confermato |

Fallback senza embeddings: se ≥1 keyword E `coverageRatio ≥ 0.10` → COVERED (benefit).

### 6.3 Jaccard
La funzione è definita (`token set >2 char, |∩|/|∪|`) ma **non usata** nel flusso principale. La soglia 0.70 talvolta citata in interfaccia **non è presente** nel codice attuale.

---

## 7. Regex articoli

- extract-requirements: `/(?:articol[oi]|article|art\.?)\s*(\d+)/gi` (multi-lingua, no negative lookahead).
- RAG cache: `/(?:articolo|art\.?|article)\s+\d+/gi`, `/clausola\s+\d+/gi`, `/clause\s+\d+/gi`, `/annex\s+a/gi`, `/a\.\d+/gi`.
- findSourceChunk: `/(?:articolo|art\.?|article)\s+(\d+)/i`, poi cerca `['articolo N','art. N','art N','article N']`.
- Inferenza normativa: `/GDPR|NIS2|D\.Lgs\.?\s*138\/2024|DORA|AI Act|CRA|D\.Lgs\.?\s*81\/08|Data Act|ISO 27001|Legge\s*124/i`.

---

## 8. Scoring

### Risk score per gap
`{ critical:92, high:74, medium:52, low:28 }`

### Overall risk score
```
weightedRisk = cc*1.0 + hc*0.7 + mc*0.4 + lc*0.2
overallRisk  = clamp(round(weightedRisk / max(1, applicableCount) * 100), 1, 95)
if gapsCount == 0: overallRisk = 0
```

### Overall compliance %
```
overallCompliance = clamp(round((applicable - gaps) / applicable * 100), 5, 99)
if gapsCount == 0: 100
```

### Priority matrix (risk × effort)
```
              very_high  high  medium  low
critical:         1       1      1     2
high:             1       2      2     3
medium:           2       2      3     3
low:              3       3      4     4
```

### Sanzioni

**GDPR — Art. 83**
- Tier 5 (max 4% / €20M): art. 5,6,7,9,12–22,44–49
- Tier 4 (max 2% / €10M): altri
```
Tier5 → critical 4% | high 2% | medium 1% | low 0.5%   cap 20M
Tier4 → critical 2% | high 1% | medium 0.5% | low 0.2% cap 10M
theoretical = min(revenue * pct, cap)
realistic   = theoretical
if firstViolation:      realistic *= 0.50
if remediationPlan:     realistic *= 0.70
if revenue < 50M:       realistic  = max(realistic*0.30, critical?50k:10k)
```

**NIS2 / D.Lgs 138/2024**
```
critical 2%/10M | high 1.4%/7M | altri 0.5%/1M
if firstViolation: *=0.50
if remediationPlan: *=0.70
if revenue < 50M:   = max(*0.30, 25.000)
```

**AI Act**
```
critical (pratiche vietate) 7%/35M | altri (alto rischio) 3%/15M
if firstViolation: *=0.40
if remediationPlan: *=0.65
if revenue < 50M:   = max(*0.25, 50.000)
```

**Altre (FINE_CONFIG_BY_REGULATION)**
| Norm | risk | % | min | max |
|---|---|---|---|---|
| DORA | crit | 1% | 50k | 5M |
| DORA | high | 0.5% | 25k | 2M |
| CRA | crit | 2.5% | 100k | 15M |
| CRA | high | 1% | 50k | 5M |
| D.Lgs 81/08 | crit | 0% | 5k | 50k |
| D.Lgs 81/08 | high | 0% | 2.5k | 13k |
| ISO 27001 | crit | 0.5% | 10k | 500k |
| Data Act | crit | 1% | 50k | 5M |
```
theoretical = clamp(revenue*pct, min, max)
if firstViolation:  *=0.50
if remediationPlan: *=0.70
if revenue < 50M:    = max(*0.35, min)
```

Assunzioni default: `isFirstViolation=true`, `hasRemediationPlan=true`. Revenue fallback: `assessment.annual_revenue_eur || 5_000_000`.

### ROI
Non esiste formula esplicita. `action_cost_eur = action_hours * 85`. Confronto costo/sanzione è implicito nella UI.

---

## 9. Auto-inclusione ISO 27001
**Non presente**. Il filtro è strettamente per normativa selezionata: se l'utente non seleziona ISO 27001, non viene aggiunta.

---

## 10. Traceability `source_chunk_id`
1. Regex articolo dalla reference.
2. Cerca nei primi 100 chunk RAG uno che contenga `['articolo N','art. N','art N','article N']`.
3. Se trovato: `source_chunk_id`, `article_text_excerpt = chunk.content.substring(0,300)`.
4. Fallback: match sul prefisso della reference (30 char).
5. Altrimenti `null`. UI "Vedi fonte normativa" usa questi campi.

---

## 11. Configurazione deterministica

| Componente | Modello | Temp | Max tokens |
|---|---|---:|---:|
| LLM Enrichment/Validation | `google/gemini-3-pro-preview` | 0 | default |
| Extract Requirements | `google/gemini-2.5-flash` | 0 | 8000 |
| Embeddings | `models/gemini-embedding-001` (dim 768) | — | — |

Nessun `seed` esplicito. Fingerprint cache SHA-256 su:
```json
{ "v":"gap-analysis-v18-realistic-fines", "r":[normative_sorted], "l":"it",
  "p":{ "j":"EU","s":"Technology","c":"DPO" }, "rev":5000000,
  "d":[{"n":name,"t":type,"c":content}] }
```

---

## 12. Guardrail anti-allucinazione

- **KB mancante**: RAG cache vuota per una normativa → tutti i suoi requisiti vengono skippati (compliance = 100% artefatto per quella normativa; nessun errore all'utente).
- **LLM Enrichment**: può correggere SOLO `requirement_reference` se lo stesso articolo esiste nella RAG. Tutti i testi (gap_description, current_state, recommended_actions) restano quelli deterministici del catalogo.
- **LLM Discovery**: la funzione `discoverMissedGapsWithLLM` è definita ma **NON invocata** per determinismo.

---

## 13. Timeout & retry

**Client**: fire-and-forget; polling ogni 3s; timeout complessivo 8 min. Nessun timeout esplicito sulla `fetch`.

**Server**: nessun timeout esplicito lato edge; si applica il default di piattaforma. Retry embeddings: fino a 3 tentativi su HTTP 429 con wait 5·n secondi. Delay tra batch embeddings 500 ms. LLM calls senza `AbortController`.

---

## 14. Schema JSON di output

Response HTTP:
```json
{
  "success": true,
  "gaps": [ /* identified_gaps persistiti */ ],
  "overall_risk_score": 74,
  "overall_compliance_percentage": 42,
  "coverage_scope": {
    "requirements_analyzed": 15,
    "total_estimated_requirements": 30,
    "coverage_percentage": 50,
    "analysis_depth": "standard",
    "disclaimer": "Analisi basata su N requisiti chiave su M totali stimati...",
    "regulations_breakdown": [
      { "regulation":"GDPR", "analyzed":11, "total_estimated":30, "depth":"standard" }
    ]
  },
  "method": "rule_based_with_llm_validation"
}
```

Record `identified_gaps`:
```ts
{
  assessment_id: UUID,
  requirement_reference: string,     // es. "Articolo 5 GDPR - Principi..."
  requirement_description: string,
  current_state: string,             // coverage % + keywords trovate
  gap_description: string,           // dal catalogo
  risk_level: 'critical'|'high'|'medium'|'low',
  risk_score: 92|74|52|28,
  potential_fine_eur: number,        // realistica
  potential_fine_max_eur: number,    // teorico
  fine_tier_basis: string,           // es. "Art. 83(5) GDPR (max 4%)"
  priority: 1|2|3|4,
  remediation_effort: 'very_high'|'high'|'medium'|'low',
  recommended_actions: [{ action, estimated_hours, estimated_cost_eur }],
  source_chunk_id: UUID|null,
  article_text_excerpt: string|null,
  detection_method: 'keyword'|'semantic'
}
```

Stime totali per normativa (per coverage_scope):
```
GDPR:30, NIS2:25, DORA:24, AI Act:31, CRA:18,
Data Act:27, ISO 27001:18, D.Lgs 81/08:35, Albania:15
```

---

## 15. Deduplicazione

1. Requisiti dinamici DB: aggiunti solo se `regulation:reference` non esiste già nel catalogo hardcoded.
2. Sort deterministico gap: `${requirement_reference}|${gap_description}` (lowercase, `localeCompare`).
3. Idempotenza DB: prima dell'insert, `DELETE FROM identified_gaps` e `action_plans` per `assessment_id`.
4. Cleanup requisiti (già visto): max 2 per `(regulation, article_number)`.
5. **Nessuna** dedup Jaccard sui gap identificati.

---

## 16. Coverage disclaimer & scope

Se `applicableRequirements.length < totalEstimated`:
> "Analisi basata su N requisiti chiave su M totali stimati. Per una valutazione esaustiva, si consiglia un audit completo con un consulente certificato."

Livelli:
- ≥ 70% → `comprehensive`
- 40–70% → `standard`
- < 40% → `basic`

**Scope fondamentale**: analisi rule-based sul `REQUIREMENTS_CATALOG` + requisiti dinamici approvati. Non tutti gli articoli di ogni normativa vengono analizzati. Normative senza KB → 0 gap, ma senza errore esplicito.
