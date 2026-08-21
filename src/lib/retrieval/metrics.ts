/**
 * Information-retrieval metrics.
 *
 * Definitions are stated explicitly because "Recall@k" is overloaded in the RAG
 * literature — some authors mean the fraction of relevant items found, others
 * mean "was anything relevant found". Both are reported here under distinct
 * names so the numbers cannot be misread.
 *
 * Every function is pure and total; ranked lists are 0-indexed arrays of
 * document ids, and relevance judgements are sets of ids.
 *
 * @see ADR-020 in .claude/decisions.md
 */

/** A single query's outcome: what was retrieved, in order, and what was relevant. */
export interface QueryResult {
  queryId: string;
  /** Retrieved document ids, best first. */
  ranked: string[];
  /** Ids judged relevant for this query. Must be non-empty. */
  relevant: Set<string>;
}

/**
 * Recall@k — the fraction of a query's relevant documents that appear in the
 * top k.
 *
 * With `|relevant| > k` this is capped by `k / |relevant|` and cannot reach 1.
 * That is the honest behaviour: Recall@1 for a query with three relevant
 * documents has a ceiling of 0.333, and reporting it as 1.0 would overstate the
 * system.
 */
export function recallAtK(ranked: string[], relevant: Set<string>, k: number): number {
  if (relevant.size === 0) return 0;
  let found = 0;
  for (const id of ranked.slice(0, k)) {
    if (relevant.has(id)) found++;
  }
  return found / relevant.size;
}

/**
 * Hit@k — 1 if any relevant document appears in the top k, else 0.
 *
 * Reported alongside Recall@k because for a single-answer query the two
 * coincide, and where they diverge the difference is informative.
 */
export function hitAtK(ranked: string[], relevant: Set<string>, k: number): number {
  return ranked.slice(0, k).some((id) => relevant.has(id)) ? 1 : 0;
}

/**
 * Reciprocal rank — 1 / (rank of the first relevant document), 1-based.
 * Returns 0 when no relevant document was retrieved at all.
 */
export function reciprocalRank(ranked: string[], relevant: Set<string>): number {
  const index = ranked.findIndex((id) => relevant.has(id));
  return index === -1 ? 0 : 1 / (index + 1);
}

/**
 * nDCG@k with binary relevance.
 *
 * Unlike Recall@k this is sensitive to *where* in the top k a relevant document
 * lands, which is what separates two systems that retrieve the same set in a
 * different order.
 */
export function ndcgAtK(ranked: string[], relevant: Set<string>, k: number): number {
  let dcg = 0;
  ranked.slice(0, k).forEach((id, index) => {
    if (relevant.has(id)) dcg += 1 / Math.log2(index + 2);
  });

  // Ideal DCG: every relevant document packed into the top positions.
  const idealHits = Math.min(relevant.size, k);
  let idcg = 0;
  for (let i = 0; i < idealHits; i++) idcg += 1 / Math.log2(i + 2);

  return idcg === 0 ? 0 : dcg / idcg;
}

/** Per-query scores for one retrieval configuration. */
export interface PerQueryScores {
  queryId: string;
  recallAt1: number;
  recallAt5: number;
  recallAt10: number;
  hitAt1: number;
  hitAt5: number;
  hitAt10: number;
  reciprocalRank: number;
  ndcgAt10: number;
}

export function scoreQuery(result: QueryResult): PerQueryScores {
  const { queryId, ranked, relevant } = result;
  return {
    queryId,
    recallAt1: recallAtK(ranked, relevant, 1),
    recallAt5: recallAtK(ranked, relevant, 5),
    recallAt10: recallAtK(ranked, relevant, 10),
    hitAt1: hitAtK(ranked, relevant, 1),
    hitAt5: hitAtK(ranked, relevant, 5),
    hitAt10: hitAtK(ranked, relevant, 10),
    reciprocalRank: reciprocalRank(ranked, relevant),
    ndcgAt10: ndcgAtK(ranked, relevant, 10),
  };
}

/** Macro-averaged metrics across a query set. */
export interface AggregateScores {
  queries: number;
  recallAt1: number;
  recallAt5: number;
  recallAt10: number;
  hitAt1: number;
  hitAt5: number;
  hitAt10: number;
  /** Mean Reciprocal Rank. */
  mrr: number;
  ndcgAt10: number;
}

function mean(values: number[]): number {
  return values.length === 0
    ? 0
    : values.reduce((sum, value) => sum + value, 0) / values.length;
}

/**
 * Macro-average: every query contributes equally, regardless of how many
 * relevant documents it has. Micro-averaging would let a query with many
 * judgements dominate the score.
 */
export function aggregate(scores: PerQueryScores[]): AggregateScores {
  return {
    queries: scores.length,
    recallAt1: mean(scores.map((s) => s.recallAt1)),
    recallAt5: mean(scores.map((s) => s.recallAt5)),
    recallAt10: mean(scores.map((s) => s.recallAt10)),
    hitAt1: mean(scores.map((s) => s.hitAt1)),
    hitAt5: mean(scores.map((s) => s.hitAt5)),
    hitAt10: mean(scores.map((s) => s.hitAt10)),
    mrr: mean(scores.map((s) => s.reciprocalRank)),
    ndcgAt10: mean(scores.map((s) => s.ndcgAt10)),
  };
}

/* ────────────────────────────────────────────────────────────────────
   Significance
   ──────────────────────────────────────────────────────────────────── */

/**
 * Deterministic PRNG (mulberry32), so a reported confidence interval is
 * reproducible from the seed rather than shifting on every run.
 */
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export interface PairedComparison {
  /** Mean of (system A − system B) over the query set. */
  meanDelta: number;
  /** Percentile bootstrap 95% confidence interval on the mean delta. */
  ci95: [number, number];
  /** Queries where A scored strictly higher / lower / equal. */
  wins: number;
  losses: number;
  ties: number;
  /**
   * True when the interval excludes zero. With query sets this small, a
   * confident-looking point estimate whose interval straddles zero is noise,
   * and this flag is what stops it being reported as a win.
   */
  significant: boolean;
}

/**
 * Paired bootstrap over per-query deltas.
 *
 * Paired because both systems answer the same queries: comparing their per-query
 * differences removes query difficulty as a source of variance, which matters
 * enormously when the query set is small.
 */
export function pairedBootstrap(
  a: number[],
  b: number[],
  { iterations = 10_000, seed = 42 }: { iterations?: number; seed?: number } = {},
): PairedComparison {
  if (a.length !== b.length) {
    throw new Error(
      `pairedBootstrap requires equal-length samples (got ${a.length} and ${b.length})`,
    );
  }

  const deltas = a.map((value, index) => value - b[index]);
  const n = deltas.length;

  if (n === 0) {
    return {
      meanDelta: 0,
      ci95: [0, 0],
      wins: 0,
      losses: 0,
      ties: 0,
      significant: false,
    };
  }

  const random = mulberry32(seed);
  const means: number[] = [];

  for (let i = 0; i < iterations; i++) {
    let total = 0;
    for (let j = 0; j < n; j++) {
      total += deltas[Math.floor(random() * n)];
    }
    means.push(total / n);
  }

  means.sort((x, y) => x - y);
  const lower = means[Math.floor(0.025 * iterations)];
  const upper = means[Math.min(iterations - 1, Math.floor(0.975 * iterations))];

  return {
    meanDelta: mean(deltas),
    ci95: [lower, upper],
    wins: deltas.filter((d) => d > 0).length,
    losses: deltas.filter((d) => d < 0).length,
    ties: deltas.filter((d) => d === 0).length,
    significant: (lower > 0 && upper > 0) || (lower < 0 && upper < 0),
  };
}
