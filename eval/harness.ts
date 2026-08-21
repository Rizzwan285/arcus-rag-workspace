/**
 * Evaluation harness: seed a fixture corpus, query it through the shipped SQL,
 * tear it down.
 *
 * ISOLATION
 * The fixture is written to the configured database under a dedicated user id
 * that no OAuth account can ever map to, and removed in a `finally` block.
 * Teardown deletes exactly one `User` row and relies on the schema's cascades,
 * so it cannot reach anything it did not create.
 *
 * FIDELITY
 * Retrieval runs `HYBRID_SEARCH_SQL` with parameters from
 * `buildHybridSearchParams` — the same statement and the same parameter
 * construction the application uses. Only the connection differs.
 *
 * @see ADR-020 in .claude/decisions.md
 */

import { createHash, randomUUID } from "node:crypto";
import { Client } from "pg";
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
} from "../src/lib/retrieval/query";
import { EVAL_CORPUS, EVAL_DOCUMENTS, type EvalDocumentKey } from "./dataset/corpus";

/** Fixed so a crashed run can be cleaned up by re-running the harness. */
export const EVAL_USER_ID = "evalharness0000000000user";
const EVAL_EMAIL = "eval-harness@arcus.invalid";

/** Chunk ids are derived from passage ids, so results map back without a lookup. */
export function chunkIdForPassage(passageId: string): string {
  return `evalchunk${passageId.replace(/-/g, "")}`.slice(0, 25).padEnd(25, "0");
}

export function passageIdForChunk(chunkId: string): string | null {
  const entry = EVAL_CORPUS.find((p) => chunkIdForPassage(p.id) === chunkId);
  return entry?.id ?? null;
}

function isLocal(url: string): boolean {
  return /@(localhost|127\.0\.0\.1|host\.docker\.internal)[:/]/.test(url);
}

/**
 * Advisory-lock key for the harness. Two concurrent runs share one fixture user,
 * so without this the teardown of one run deletes the corpus the other is
 * querying — producing plausible-looking but silently wrong numbers rather than
 * an error. Learned the hard way; see ADR-020.
 */
const ADVISORY_LOCK_KEY = 728_144_021;

/**
 * Take an exclusive, session-scoped lock on the fixture.
 * Fails fast rather than waiting: a second run is a mistake, not a queue.
 */
export async function acquireLock(client: Client): Promise<void> {
  const { rows } = await client.query<{ locked: boolean }>(
    "SELECT pg_try_advisory_lock($1) AS locked",
    [ADVISORY_LOCK_KEY],
  );
  if (!rows[0]?.locked) {
    throw new Error(
      "Another benchmark run holds the fixture lock. Wait for it to finish — " +
        "concurrent runs would corrupt each other's measurements.",
    );
  }
}

export async function releaseLock(client: Client): Promise<void> {
  await client.query("SELECT pg_advisory_unlock($1)", [ADVISORY_LOCK_KEY]);
}

export async function connect(): Promise<Client> {
  const url = process.env.DIRECT_URL ?? process.env.DATABASE_URL;
  if (!url) {
    throw new Error("DIRECT_URL or DATABASE_URL must be set.");
  }

  const client = new Client({
    connectionString: url,
    ssl: isLocal(url) ? undefined : { rejectUnauthorized: false },
    connectionTimeoutMillis: 20_000,
  });
  await client.connect();
  return client;
}

/**
 * Remove every trace of a previous run. Safe to call when nothing exists.
 * Scoped to the harness user; cascades handle documents, chunks, and runs.
 */
export async function teardown(client: Client): Promise<void> {
  await client.query(`DELETE FROM "User" WHERE id = $1`, [EVAL_USER_ID]);
}

export interface SeedResult {
  documents: number;
  chunks: number;
}

/**
 * Insert the fixture corpus with pre-computed embeddings.
 * `searchVector` is omitted deliberately — Postgres generates it.
 */
export async function seed(
  client: Client,
  embeddings: Map<string, number[]>,
): Promise<SeedResult> {
  await teardown(client);

  const now = new Date();

  await client.query(
    `INSERT INTO "User" (id, email, name, "createdAt", "updatedAt")
     VALUES ($1, $2, $3, $4, $4)`,
    [EVAL_USER_ID, EVAL_EMAIL, "Evaluation Harness", now],
  );

  const documentIds = new Map<EvalDocumentKey, string>();
  for (const [key, title] of Object.entries(EVAL_DOCUMENTS)) {
    const id = `evaldoc-${key}-${randomUUID().slice(0, 8)}`;
    documentIds.set(key as EvalDocumentKey, id);

    await client.query(
      `INSERT INTO "Document"
         (id, "userId", title, "fileUrl", "fileType", status, "chunkCount", "ingestedAt", "createdAt", "updatedAt")
       VALUES ($1, $2, $3, $4, 'pdf', 'COMPLETED', 0, $5, $5, $5)`,
      [id, EVAL_USER_ID, title, `https://eval.invalid/${key}.pdf`, now],
    );
  }

  let inserted = 0;
  for (const [index, passage] of EVAL_CORPUS.entries()) {
    const vector = embeddings.get(passage.text);
    if (!vector) throw new Error(`Missing embedding for passage ${passage.id}`);

    await client.query(
      `INSERT INTO "DocumentChunk"
         (id, "documentId", content, "contentHash", "tokenCount", metadata, "pageNumber", "chunkIndex", embedding, "createdAt")
       VALUES ($1, $2, $3, $4, $5, $6::jsonb, $7, $8, $9::vector, $10)`,
      [
        chunkIdForPassage(passage.id),
        documentIds.get(passage.doc),
        passage.text,
        createHash("sha256").update(passage.text, "utf8").digest("hex"),
        Math.ceil(passage.text.length / 4),
        JSON.stringify({ evalPassageId: passage.id }),
        0,
        index,
        `[${vector.join(",")}]`,
        now,
      ],
    );
    inserted++;
  }

  for (const [key, id] of documentIds) {
    await client.query(
      `UPDATE "Document" SET "chunkCount" = (SELECT COUNT(*) FROM "DocumentChunk" WHERE "documentId" = $1) WHERE id = $1`,
      [id],
    );
    void key;
  }

  return { documents: documentIds.size, chunks: inserted };
}

export interface SearchOptions {
  mode: RetrievalMode;
  limit: number;
  queryText: string;
  queryEmbedding: number[];
  /** Defaults to 1. Lowered by the weight sweep. */
  keywordWeight?: number;
}

/**
 * Execute the shipped fusion query in the requested mode.
 * Mirrors `hybridSearch`'s transaction and GUC tuning.
 */
export async function search(
  client: Client,
  options: SearchOptions,
): Promise<{ chunks: RetrievedChunk[]; latencyMs: number }> {
  const params = buildHybridSearchParams({
    queryEmbedding: options.queryEmbedding,
    queryText: options.queryText,
    userId: EVAL_USER_ID,
    limit: options.limit,
    candidatePool: DEFAULT_CANDIDATE_POOL,
    rrfK: DEFAULT_RRF_K,
    vectorWeight: 1,
    keywordWeight: options.keywordWeight ?? 1,
    minSimilarity: 0,
    documentId: null,
    mode: options.mode,
  });

  const startedAt = Date.now();
  await client.query("BEGIN");
  try {
    await client.query(`SET LOCAL hnsw.ef_search = ${DEFAULT_EF_SEARCH}`);
    await client.query(`SET LOCAL hnsw.iterative_scan = 'strict_order'`);
    const result = await client.query<FusedRow>(HYBRID_SEARCH_SQL, params);
    await client.query("COMMIT");
    return {
      chunks: result.rows.map(toRetrievedChunk),
      latencyMs: Date.now() - startedAt,
    };
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  }
}
