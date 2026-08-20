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
 * @see ADR-015 in .claude/decisions.md
 */

import { prisma } from "@/server/db/prisma";
import { embedQuery } from "@/lib/langchain/embeddings";

/** Standard RRF damping constant. */
const DEFAULT_RRF_K = 60;

/** Rows pulled from each arm before fusion. Over-fetching is what gives RRF something to fuse. */
const DEFAULT_CANDIDATE_POOL = 40;

/**
 * HNSW search-list size. Higher = better recall, more work. 100 is a sane
 * default for a corpus of this size; pgvector's default of 40 under-recalls
 * once a per-user filter is applied.
 */
const DEFAULT_EF_SEARCH = 100;

export interface RetrievedChunk {
  id: string;
  documentId: string;
  content: string;
  metadata: Record<string, unknown> | null;
  pageNumber: number | null;
  chunkIndex: number;
  /** Cosine similarity (0–1). 0 when the chunk was found only by the lexical arm. */
  similarity: number;
  /** `ts_rank_cd` score. 0 when the chunk was found only by the dense arm. */
  keywordScore: number;
  /** 1-based rank within the dense arm, or null if it did not appear. */
  vectorRank: number | null;
  /** 1-based rank within the lexical arm, or null if it did not appear. */
  keywordRank: number | null;
  /** Fused RRF score — the ordering key. */
  rrfScore: number;
  /** Which arm(s) surfaced this chunk. Useful for evaluating retrieval quality. */
  matchedBy: "both" | "vector" | "keyword";
}

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

/** Shape returned by the raw SQL below. */
interface FusedRow {
  id: string;
  documentId: string;
  content: string;
  metadata: Record<string, unknown> | null;
  pageNumber: number | null;
  chunkIndex: number;
  similarity: number;
  keywordScore: number;
  vectorRank: number | null;
  keywordRank: number | null;
  rrfScore: number;
}

/** pgvector's literal format: `[0.1,0.2,...]`. */
function toVectorLiteral(embedding: number[]): string {
  return `[${embedding.join(",")}]`;
}

/**
 * The fusion query.
 *
 * Both arms filter by owner and completion status *inside* their own CTE and
 * apply their own LIMIT, so each stays index-driven and neither has to rank the
 * full corpus. The FULL OUTER JOIN is what lets a chunk found by only one arm
 * still compete — it simply scores from that arm alone.
 */
const HYBRID_SEARCH_SQL = /* sql */ `
WITH vector_arm AS (
  SELECT
    v.id,
    v.similarity,
    (ROW_NUMBER() OVER (ORDER BY v.distance ASC))::int AS rank
  FROM (
    SELECT
      dc.id,
      dc.embedding <=> $1::vector              AS distance,
      1 - (dc.embedding <=> $1::vector)        AS similarity
    FROM "DocumentChunk" dc
    INNER JOIN "Document" d ON d.id = dc."documentId"
    WHERE d."userId" = $2
      AND d.status = 'COMPLETED'
      AND ($3::text IS NULL OR dc."documentId" = $3::text)
    ORDER BY dc.embedding <=> $1::vector
    LIMIT $4::int
  ) v
  WHERE v.similarity >= $5::float8
),
keyword_arm AS (
  SELECT
    k.id,
    k.score,
    (ROW_NUMBER() OVER (ORDER BY k.score DESC, k.id ASC))::int AS rank
  FROM (
    SELECT
      dc.id,
      ts_rank_cd(dc."searchVector", q.query) AS score
    FROM "DocumentChunk" dc
    INNER JOIN "Document" d ON d.id = dc."documentId"
    CROSS JOIN websearch_to_tsquery('english', $6::text) AS q(query)
    WHERE d."userId" = $2
      AND d.status = 'COMPLETED'
      AND ($3::text IS NULL OR dc."documentId" = $3::text)
      AND dc."searchVector" @@ q.query
    ORDER BY score DESC
    LIMIT $4::int
  ) k
),
fused AS (
  SELECT
    COALESCE(v.id, k.id)                                        AS id,
    v.rank                                                      AS vector_rank,
    k.rank                                                      AS keyword_rank,
    COALESCE(v.similarity, 0)::float8                           AS similarity,
    COALESCE(k.score, 0)::float8                                AS keyword_score,
    (
      COALESCE($7::float8 / ($8::float8 + v.rank), 0) +
      COALESCE($9::float8 / ($8::float8 + k.rank), 0)
    )::float8                                                   AS rrf_score
  FROM vector_arm v
  FULL OUTER JOIN keyword_arm k ON k.id = v.id
)
SELECT
  dc.id,
  dc."documentId"      AS "documentId",
  dc.content,
  dc.metadata,
  dc."pageNumber"      AS "pageNumber",
  dc."chunkIndex"      AS "chunkIndex",
  f.similarity         AS "similarity",
  f.keyword_score      AS "keywordScore",
  f.vector_rank        AS "vectorRank",
  f.keyword_rank       AS "keywordRank",
  f.rrf_score          AS "rrfScore"
FROM fused f
INNER JOIN "DocumentChunk" dc ON dc.id = f.id
ORDER BY f.rrf_score DESC, f.similarity DESC
LIMIT $10::int
`;

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
  } = options;

  const startedAt = Date.now();

  // The query is embedded with RETRIEVAL_QUERY; the corpus used
  // RETRIEVAL_DOCUMENT. Gemini optimises each side of that pair separately.
  const embedStartedAt = Date.now();
  const queryEmbedding = await embedQuery(query);
  const embedMs = Date.now() - embedStartedAt;

  const params = [
    toVectorLiteral(queryEmbedding), // $1  query vector
    userId, // $2  owner
    documentId ?? null, // $3  optional document scope
    Math.max(candidatePool, limit), // $4  per-arm candidate pool
    minSimilarity, // $5  dense-arm floor
    query, // $6  raw text for websearch_to_tsquery
    vectorWeight, // $7
    rrfK, // $8
    keywordWeight, // $9
    limit, // $10
  ];

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

  const chunks: RetrievedChunk[] = rows.map((row) => ({
    ...row,
    similarity: Number(row.similarity),
    keywordScore: Number(row.keywordScore),
    rrfScore: Number(row.rrfScore),
    vectorRank: row.vectorRank === null ? null : Number(row.vectorRank),
    keywordRank: row.keywordRank === null ? null : Number(row.keywordRank),
    matchedBy:
      row.vectorRank !== null && row.keywordRank !== null
        ? "both"
        : row.vectorRank !== null
          ? "vector"
          : "keyword",
  }));

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
