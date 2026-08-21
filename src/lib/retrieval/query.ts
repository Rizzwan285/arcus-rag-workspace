/**
 * The hybrid retrieval query — pure, with no database dependency.
 *
 * Kept separate from `hybrid-search.ts` so that the exact SQL and parameter
 * construction the application runs can also be executed by the evaluation
 * harness against its own connection. The benchmark therefore measures the
 * shipped query rather than a reimplementation of it.
 *
 * @see ADR-015, ADR-020 in .claude/decisions.md
 */

/** Standard RRF damping constant (Cormack et al. 2009). Untuned. */
export const DEFAULT_RRF_K = 60;

/** Rows pulled from each arm before fusion. Over-fetching gives RRF something to fuse. */
export const DEFAULT_CANDIDATE_POOL = 40;

/**
 * HNSW search-list size. Higher = better recall, more work. pgvector's default
 * of 40 under-recalls once a per-user filter is applied.
 */
export const DEFAULT_EF_SEARCH = 100;

/**
 * Which retrieval arms participate.
 *
 * `vector` and `keyword` exist so the two arms can be ablated *through the same
 * query* — the benchmark compares arms, not implementations.
 */
export type RetrievalMode = "hybrid" | "vector" | "keyword";

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
  /** Which arm(s) surfaced this chunk. */
  matchedBy: "both" | "vector" | "keyword";
}

/** Raw shape returned by {@link HYBRID_SEARCH_SQL}. */
export interface FusedRow {
  id: string;
  documentId: string;
  content: string;
  metadata: Record<string, unknown> | null;
  pageNumber: number | null;
  chunkIndex: number;
  similarity: number | string;
  keywordScore: number | string;
  vectorRank: number | null;
  keywordRank: number | null;
  rrfScore: number | string;
}

export interface QueryParamOptions {
  queryEmbedding: number[];
  queryText: string;
  userId: string;
  limit: number;
  candidatePool: number;
  rrfK: number;
  vectorWeight: number;
  keywordWeight: number;
  minSimilarity: number;
  documentId?: string | null;
  mode: RetrievalMode;
}

/** pgvector's literal format: `[0.1,0.2,...]`. */
export function toVectorLiteral(embedding: number[]): string {
  return `[${embedding.join(",")}]`;
}

/**
 * The fusion query.
 *
 * Both arms filter by owner *inside* their own CTE and carry their own LIMIT, so
 * each stays index-driven and neither has to rank the full corpus. The FULL
 * OUTER JOIN lets a chunk found by only one arm still compete — it simply scores
 * from that arm alone.
 *
 * `$11` / `$12` gate the arms. Disabling an arm empties its CTE, which reduces
 * the fusion to the surviving arm's own ranking; the ordering is then identical
 * to that arm run alone, because RRF is monotonic in rank.
 */
export const HYBRID_SEARCH_SQL = /* sql */ `
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
    WHERE $11::bool
      AND d."userId" = $2
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
    CROSS JOIN LATERAL (
      -- Disjunctive tsquery. websearch_to_tsquery (and plainto_tsquery)
      -- join terms with AND, which makes this arm a boolean filter rather than
      -- a ranker: "what is the minimum CGPA required to graduate" becomes
      -- 'minimum' & 'cgpa' & 'requir' & 'graduat', and a passage that states the
      -- CGPA rule without the word "graduate" matches nothing at all. Measured
      -- on the evaluation set, that cost the lexical arm every natural-language
      -- query (ADR-021). OR-ing the lexemes and letting ts_rank_cd order them is
      -- the correct shape for an arm feeding rank fusion: recall here, precision
      -- from the fusion. Trade-off: phrase and negation operators are dropped.
      SELECT to_tsquery('english', string_agg(quote_literal(lexeme), ' | ')) AS query
      FROM unnest(tsvector_to_array(to_tsvector('english', $6::text))) AS lexeme
    ) q
    WHERE $12::bool
      AND d."userId" = $2
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
 * Build the positional parameter list for {@link HYBRID_SEARCH_SQL}.
 * Order matters and is asserted by the unit tests.
 */
export function buildHybridSearchParams(options: QueryParamOptions): unknown[] {
  const {
    queryEmbedding,
    queryText,
    userId,
    limit,
    candidatePool,
    rrfK,
    vectorWeight,
    keywordWeight,
    minSimilarity,
    documentId,
    mode,
  } = options;

  return [
    toVectorLiteral(queryEmbedding), // $1  query vector
    userId, // $2  owner
    documentId ?? null, // $3  optional document scope
    Math.max(candidatePool, limit), // $4  per-arm candidate pool
    minSimilarity, // $5  dense-arm floor
    queryText, // $6  raw text for websearch_to_tsquery
    vectorWeight, // $7
    rrfK, // $8
    keywordWeight, // $9
    limit, // $10
    mode === "hybrid" || mode === "vector", // $11 dense arm enabled
    mode === "hybrid" || mode === "keyword", // $12 lexical arm enabled
  ];
}

/** Normalise a raw row into a {@link RetrievedChunk}. */
export function toRetrievedChunk(row: FusedRow): RetrievedChunk {
  const vectorRank = row.vectorRank === null ? null : Number(row.vectorRank);
  const keywordRank = row.keywordRank === null ? null : Number(row.keywordRank);

  return {
    id: row.id,
    documentId: row.documentId,
    content: row.content,
    metadata: row.metadata,
    pageNumber: row.pageNumber,
    chunkIndex: row.chunkIndex,
    similarity: Number(row.similarity),
    keywordScore: Number(row.keywordScore),
    vectorRank,
    keywordRank,
    rrfScore: Number(row.rrfScore),
    matchedBy:
      vectorRank !== null && keywordRank !== null
        ? "both"
        : vectorRank !== null
          ? "vector"
          : "keyword",
  };
}
