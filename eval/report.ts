/**
 * Report rendering for the retrieval benchmark.
 * Produces the markdown that lands in `eval/RESULTS.md`.
 */

import type { AggregateScores, PairedComparison } from "../src/lib/retrieval/metrics";
import type { QueryCategory } from "./dataset/queries";

export type SystemName = "vector" | "keyword" | "hybrid";

export const SYSTEM_LABEL: Record<SystemName, string> = {
  vector: "Vector only",
  keyword: "Lexical only",
  hybrid: "Hybrid (RRF)",
};

export interface RunSummary {
  overall: Record<SystemName, AggregateScores>;
  byCategory: Record<QueryCategory, Record<SystemName, AggregateScores>>;
  comparisons: {
    label: string;
    metric: string;
    result: PairedComparison;
  }[];
  latencyMs: Record<SystemName, { median: number; p95: number }>;
  /** Exploratory keyword-weight sweep; empty unless `--sweep` was passed. */
  sweep?: { keywordWeight: number; scores: AggregateScores }[];
  meta: {
    ranAt: string;
    corpusSize: number;
    queryCount: number;
    limit: number;
    rrfK: number;
    candidatePool: number;
    embeddingModel: string;
    apiCalls: number;
    cacheHits: number;
  };
}

const pct = (value: number) => (value * 100).toFixed(1);
const num = (value: number) => value.toFixed(3);

function metricsTable(scores: Record<SystemName, AggregateScores>): string {
  const systems: SystemName[] = ["vector", "keyword", "hybrid"];
  const rows = systems.map((system) => {
    const s = scores[system];
    return `| ${SYSTEM_LABEL[system]} | ${pct(s.recallAt1)} | ${pct(s.recallAt5)} | ${pct(s.recallAt10)} | ${num(s.mrr)} | ${num(s.ndcgAt10)} | ${pct(s.hitAt10)} |`;
  });

  return [
    "| System | R@1 | R@5 | R@10 | MRR | nDCG@10 | Hit@10 |",
    "| :--- | ---: | ---: | ---: | ---: | ---: | ---: |",
    ...rows,
  ].join("\n");
}

/** Mark the best value in each column so the comparison is readable at a glance. */
function bestOf(
  scores: Record<SystemName, AggregateScores>,
  key: keyof AggregateScores,
): SystemName {
  const systems: SystemName[] = ["vector", "keyword", "hybrid"];
  return systems.reduce((best, system) =>
    (scores[system][key] as number) > (scores[best][key] as number) ? system : best,
  );
}

export function renderReport(summary: RunSummary): string {
  const { meta, overall, byCategory, comparisons, latencyMs } = summary;

  const categoryOrder: QueryCategory[] = ["paraphrase", "exact-term", "mixed"];
  const categoryNotes: Record<QueryCategory, string> = {
    paraphrase:
      "Conceptual phrasing with little vocabulary overlap. The dense arm is expected to carry these.",
    "exact-term":
      "Course codes, named theorems, acronyms. The lexical arm is expected to carry these.",
    mixed:
      "A natural question that also carries a distinctive term. Fusion is expected to help.",
  };

  const comparisonRows = comparisons.map((c) => {
    const [lo, hi] = c.result.ci95;
    const verdict = c.result.significant
      ? c.result.meanDelta > 0
        ? "**significant gain**"
        : "**significant loss**"
      : "not significant";
    return `| ${c.label} | ${c.metric} | ${c.result.meanDelta >= 0 ? "+" : ""}${num(c.result.meanDelta)} | [${num(lo)}, ${num(hi)}] | ${c.result.wins}/${c.result.losses}/${c.result.ties} | ${verdict} |`;
  });

  return `# Retrieval Benchmark Results

_Generated ${meta.ranAt} by \`npm run eval\`._

Compares three retrieval configurations over a labelled fixture corpus:
the dense (pgvector/HNSW) arm alone, the lexical (tsvector/GIN) arm alone, and
Reciprocal Rank Fusion over both. All three run through the **same SQL
statement** — the arms are ablated with query parameters, so any difference is
attributable to fusion rather than to a difference in implementation.

## Setup

| | |
| :--- | :--- |
| Corpus | ${meta.corpusSize} passages across 4 synthetic course documents |
| Queries | ${meta.queryCount}, hand-labelled, balanced across 3 categories |
| Retrieval depth | top ${meta.limit}, candidate pool ${meta.candidatePool} per arm |
| RRF constant | k = ${meta.rrfK} (untuned — the published default) |
| Embeddings | \`${meta.embeddingModel}\`, 768d, asymmetric task types |
| Embedding calls this run | ${meta.apiCalls} (${meta.cacheHits} served from cache) |

## Headline

On this corpus, **fusion does not beat the dense arm alone** — it loses
${num(Math.abs(overall.vector.mrr - overall.hybrid.mrr))} MRR against it, and the
paired bootstrap puts that difference outside the noise floor. The dense arm
answers ${pct(overall.vector.hitAt10)}% of queries within the top 10 on its own,
including every exact-term query, so the lexical arm has nothing left to
contribute and its weaker ranking drags the fused order down.

This contradicts the assumption the retriever was built on. It is reported here
rather than buried because it is the finding, and because the conditions that
would change it — a corpus the embedding model handles badly, which is exactly
what the production PDF is — are listed under threats to validity below.

## Overall

${metricsTable(overall)}

Best per column: R@1 → **${SYSTEM_LABEL[bestOf(overall, "recallAt1")]}**, R@5 → **${SYSTEM_LABEL[bestOf(overall, "recallAt5")]}**, R@10 → **${SYSTEM_LABEL[bestOf(overall, "recallAt10")]}**, MRR → **${SYSTEM_LABEL[bestOf(overall, "mrr")]}**, nDCG@10 → **${SYSTEM_LABEL[bestOf(overall, "ndcgAt10")]}**.

## By query category

${categoryOrder
  .map(
    (category) => `### ${category}

${categoryNotes[category]}

${metricsTable(byCategory[category])}`,
  )
  .join("\n\n")}

## Significance

Paired bootstrap over per-query deltas, 10,000 resamples, seed 42. The
win/loss/tie column counts queries, not magnitude. An interval that straddles
zero means the query set is too small to separate the systems on that metric —
which is the honest reading, not a hedge.

| Comparison | Metric | Mean Δ | 95% CI | W/L/T | Verdict |
| :--- | :--- | ---: | :--- | :--- | :--- |
${comparisonRows.join("\n")}

## Latency

Wall-clock time for the SQL statement only, excluding query embedding
(which is cached and identical across systems).

| System | Median | p95 |
| :--- | ---: | ---: |
${(["vector", "keyword", "hybrid"] as SystemName[])
  .map(
    (s) =>
      `| ${SYSTEM_LABEL[s]} | ${latencyMs[s].median.toFixed(0)} ms | ${latencyMs[s].p95.toFixed(0)} ms |`,
  )
  .join("\n")}

${
    summary.sweep && summary.sweep.length > 0
      ? `## Keyword-weight sweep (exploratory)

How the fused ranking responds as the lexical arm's RRF weight falls. **This is
not validation.** Picking a weight by its score here would be fitting 30
queries; the sweep only shows the shape of the trade-off, and any change to the
shipped default needs a held-out set.

| Keyword weight | R@1 | R@5 | R@10 | MRR | nDCG@10 |
| ---: | ---: | ---: | ---: | ---: | ---: |
${summary.sweep
  .map(
    (row) =>
      `| ${row.keywordWeight.toFixed(2)} | ${pct(row.scores.recallAt1)} | ${pct(row.scores.recallAt5)} | ${pct(row.scores.recallAt10)} | ${num(row.scores.mrr)} | ${num(row.scores.ndcgAt10)} |`,
  )
  .join("\n")}

`
      : ""
  }## How to read this

**Recall@k** is the fraction of a query's relevant passages inside the top k. It
is capped by \`k / |relevant|\`, so a query with two relevant passages has a
Recall@1 ceiling of 0.5 — the number is not broken. **Hit@10** is the softer
"did anything relevant land in the top 10". **MRR** is the mean reciprocal rank
of the *first* relevant passage. **nDCG@10** is the only metric here that is
sensitive to ordering within the top k.

## Threats to validity

1. **The corpus and the labels share an author.** The passages, the queries, and
   the relevance judgements were all written by the same party, which is the
   dominant limitation. Categories were assigned before any retrieval ran, and
   per-category results are reported so a failed prediction stays visible.
2. **The corpus is synthetic and small** (${meta.corpusSize} passages). Absolute
   numbers would move on a real corpus at production scale. What transfers is the
   *relative* behaviour of the arms on each query type.
3. **This measures ranking, not index recall.** At ${meta.corpusSize} rows the
   planner may not choose the HNSW index at all, so approximate-nearest-neighbour
   recall is not under test here. Index usage is verified separately by
   \`npm run db:verify\` and by \`EXPLAIN ANALYZE\` on the production corpus.
4. **Single embedding model.** Results are specific to \`${meta.embeddingModel}\`
   with asymmetric task types.
`;
}
