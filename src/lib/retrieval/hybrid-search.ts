/**
 * Hybrid Retrieval — Dense + Lexical, fused with Reciprocal Rank Fusion
 *
 * Two independent retrieval arms run against `DocumentChunk` in a single round
 * trip, and their *ranks* (not their scores) are fused:
 *
 *   - Dense arm:   pgvector cosine distance (`<=>`) over an HNSW index.
 *                  Catches paraphrase and conceptual similarity.
 *   - Lexical arm: PostgreSQL full-text search over the generated `searchVector`
 *                  tsvector column, GIN-indexed, ranked with `ts_rank_cd`.
 *                  Catches exact terms a dense model blurs — theorem names,
 *                  acronyms, notation, citation keys, course codes.
 *
 * RRF is used instead of a weighted score blend because cosine similarity and
 * `ts_rank_cd` are on incomparable scales; normalising them requires
 * corpus-wide statistics that shift with every ingest. Rank position is stable,
 * so RRF needs no tuning to stay calibrated:
 *
 *     score(d) = Σ_arms  weight_arm / (k + rank_arm(d))
 *
 * `k` (default 60, per Cormack et al. 2009) damps the influence of the very top
 * ranks, so a document both arms rank moderately well outranks one that a
 * single arm ranks first — which is exactly the behaviour that makes hybrid
 * beat either arm alone.
 *
 * The SQL itself lives in `./query.ts` so the evaluation harness can execute the
 * identical statement over its own connection.
 *
 * @see ADR-015, ADR-020 in .claude/decisions.md
 */

import { prisma } from "@/server/db/prisma";
import { embedQuery } from "@/lib/langchain/embeddings";
import {
  buildHybridSearchParams,
  DEFAULT_CANDIDATE_POOL,
  DEFAULT_EF_SEARCH,
  DEFAULT_RRF_K,
  HYBRID_SEARCH_SQL,
  toRetrievedChunk,
  type FusedRow,
  type RetrievalMode,
  type RetrievedChunk,
} from "./query";

export type { RetrievedChunk, RetrievalMode };

export interface HybridSearchOptions {
  /** Rows returned after fusion. */
  limit?: number;
  /** Rows fetched per arm before fusion. */
  candidatePool?: number;
  /** RRF damping constant. */
  rrfK?: number;
  /** Relative weight of the dense arm. */
  vectorWeight?: number;
  /** Relative weight of the lexical arm. */
  keywordWeight?: number;
  /** Floor on cosine similarity for the dense arm. Does not filter lexical hits. */
  minSimilarity?: number;
  /** Restrict the search to one document. */
  documentId?: string;
  /** Override HNSW `ef_search` for this query. */
  efSearch?: number;
  /** Ablate an arm. Defaults to `"hybrid"` — both arms. */
  mode?: RetrievalMode;
  /** Reuse an embedding instead of calling the embedding API. */
  queryEmbedding?: number[];
}

/** Telemetry returned alongside results, so retrieval quality is observable. */
export interface HybridSearchTelemetry {
  latencyMs: number;
  embedMs: number;
  queryMs: number;
  returned: number;
  vectorOnly: number;
  keywordOnly: number;
  overlap: number;
  /** True when the HNSW/iterative-scan tuning GUCs could not be applied. */
  degraded: boolean;
}

export interface HybridSearchResponse {
  chunks: RetrievedChunk[];
  telemetry: HybridSearchTelemetry;
}

/**
 * Run hybrid retrieval for one user.
 *
 * @param query  Natural-language query text
 * @param userId Owner whose documents may be searched (enforced in SQL, not in app code)
 */
export async function hybridSearch(
  query: string,
  userId: string,
  options: HybridSearchOptions = {},
): Promise<HybridSearchResponse> {
  const {
    limit = 5,
    candidatePool = DEFAULT_CANDIDATE_POOL,
    rrfK = DEFAULT_RRF_K,
    vectorWeight = 1,
    keywordWeight = 1,
    minSimilarity = 0,
    documentId,
    efSearch = DEFAULT_EF_SEARCH,
    mode = "hybrid",
    queryEmbedding: providedEmbedding,
  } = options;

  const startedAt = Date.now();

  // The query is embedded with RETRIEVAL_QUERY; the corpus used
  // RETRIEVAL_DOCUMENT. Gemini optimises each side of that pair separately.
  const embedStartedAt = Date.now();
  const queryEmbedding = providedEmbedding ?? (await embedQuery(query));
  const embedMs = Date.now() - embedStartedAt;

  const params = buildHybridSearchParams({
    queryEmbedding,
    queryText: query,
    userId,
    limit,
    candidatePool,
    rrfK,
    vectorWeight,
    keywordWeight,
    minSimilarity,
    documentId,
    mode,
  });

  const queryStartedAt = Date.now();
  let degraded = false;
  let rows: FusedRow[];

  try {
    // `SET LOCAL` scopes the tuning to this transaction only, so it cannot leak
    // to another request sharing the pooled connection.
    rows = await prisma.$transaction(async (tx) => {
      await tx.$executeRawUnsafe(`SET LOCAL hnsw.ef_search = ${Number(efSearch)}`);
      // Without iterative scan, the per-user filter can shrink an HNSW result
      // set below LIMIT; pgvector ≥ 0.8 re-scans instead of returning short.
      await tx.$executeRawUnsafe(`SET LOCAL hnsw.iterative_scan = 'strict_order'`);
      return tx.$queryRawUnsafe<FusedRow[]>(HYBRID_SEARCH_SQL, ...params);
    });
  } catch {
    // Older pgvector, or a pooler that rejects SET LOCAL: the query is still
    // correct without the tuning, just potentially lower-recall.
    degraded = true;
    rows = await prisma.$queryRawUnsafe<FusedRow[]>(HYBRID_SEARCH_SQL, ...params);
  }
  const queryMs = Date.now() - queryStartedAt;

  const chunks = rows.map(toRetrievedChunk);

  return {
    chunks,
    telemetry: {
      latencyMs: Date.now() - startedAt,
      embedMs,
      queryMs,
      returned: chunks.length,
      vectorOnly: chunks.filter((c) => c.matchedBy === "vector").length,
      keywordOnly: chunks.filter((c) => c.matchedBy === "keyword").length,
      overlap: chunks.filter((c) => c.matchedBy === "both").length,
      degraded,
    },
  };
}

/**
 * Convenience wrapper returning just the chunks.
 * Replaces the old pure-vector `searchSimilarChunks`.
 */
export async function searchSimilarChunks(
  query: string,
  userId: string,
  limit = 5,
  minSimilarity = 0,
): Promise<RetrievedChunk[]> {
  const { chunks } = await hybridSearch(query, userId, { limit, minSimilarity });
  return chunks;
}

/** Hybrid search scoped to a single document. */
export async function searchWithinDocument(
  query: string,
  documentId: string,
  userId: string,
  limit = 5,
): Promise<RetrievedChunk[]> {
  const { chunks } = await hybridSearch(query, userId, { limit, documentId });
  return chunks;
}
