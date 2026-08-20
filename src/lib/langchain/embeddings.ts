/**
 * Gemini Embedding Client
 *
 * Calls Google's Generative AI REST API directly for `gemini-embedding-001`,
 * producing 768-dimensional vectors that match `vector(768)` on DocumentChunk.
 * We bypass LangChain's wrapper because of compatibility issues with
 * @langchain/google-genai v2.
 *
 * Responsibilities beyond the raw call:
 *   - asymmetric task types (documents and queries are embedded differently)
 *   - bounded retries with exponential backoff + jitter on transient failures
 *   - dimension/finiteness validation via zod
 *   - token and cost accounting for pipeline telemetry
 *
 * @see ADR-006, ADR-015, ADR-017 in .claude/decisions.md
 */

import {
  addUsage,
  emptyUsage,
  estimateEmbeddingCostUsd,
  estimateTokens,
  type EmbeddingUsage,
} from "@/lib/ingestion/cost";
import { EMBEDDING_DIMENSIONS, embeddingSchema } from "@/lib/ingestion/schemas";

const EMBEDDING_MODEL = "gemini-embedding-001";
const API_BASE = "https://generativelanguage.googleapis.com/v1beta";

/** Transient-failure retry budget for a single batch. */
const MAX_ATTEMPTS = 4;
const BASE_BACKOFF_MS = 1_000;

/**
 * Gemini embeds documents and queries into the same space but optimises each
 * for its role. Using the matching task type on both sides measurably improves
 * retrieval quality over the untyped default.
 */
export type EmbeddingTaskType = "RETRIEVAL_DOCUMENT" | "RETRIEVAL_QUERY";

export interface EmbeddingResult {
  embeddings: number[][];
  usage: EmbeddingUsage;
}

function apiKey(): string {
  const key = process.env.GOOGLE_API_KEY ?? process.env.GOOGLE_GENERATIVE_AI_API_KEY;
  if (!key) {
    throw new Error(
      "GOOGLE_API_KEY is not set — embedding generation cannot proceed.",
    );
  }
  return key;
}

/** HTTP statuses worth retrying: rate limits and transient server faults. */
function isRetryableStatus(status: number): boolean {
  return status === 408 || status === 429 || status >= 500;
}

function backoffMs(attempt: number): number {
  const exponential = BASE_BACKOFF_MS * 2 ** (attempt - 1);
  // Full jitter — avoids a thundering herd when several batches retry together.
  return Math.round(exponential * (0.5 + Math.random() * 0.5));
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Embed one batch, retrying transient failures.
 * Returns the vectors plus what the attempt cost.
 */
async function embedBatch(
  texts: string[],
  taskType: EmbeddingTaskType,
): Promise<EmbeddingResult> {
  const url = `${API_BASE}/models/${EMBEDDING_MODEL}:batchEmbedContents?key=${apiKey()}`;
  const body = JSON.stringify({
    requests: texts.map((text) => ({
      model: `models/${EMBEDDING_MODEL}`,
      content: { parts: [{ text }] },
      taskType,
      outputDimensionality: EMBEDDING_DIMENSIONS,
    })),
  });

  const tokens = texts.reduce((sum, text) => sum + estimateTokens(text), 0);
  let calls = 0;
  let retries = 0;
  let lastError: unknown;

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    calls += 1;
    try {
      const response = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body,
      });

      if (!response.ok) {
        const errorBody = await response.text();
        const error = new Error(
          `Embedding API error (${response.status}): ${errorBody.slice(0, 500)}`,
        );
        if (isRetryableStatus(response.status) && attempt < MAX_ATTEMPTS) {
          retries += 1;
          await delay(backoffMs(attempt));
          lastError = error;
          continue;
        }
        throw error;
      }

      const data = (await response.json()) as {
        embeddings?: Array<{ values: number[] }>;
      };

      if (!data.embeddings || data.embeddings.length !== texts.length) {
        throw new Error(
          `Embedding response mismatch: expected ${texts.length} vectors, got ${data.embeddings?.length ?? 0}`,
        );
      }

      const embeddings = data.embeddings.map((entry, index) => {
        const parsed = embeddingSchema.safeParse(entry.values);
        if (!parsed.success) {
          throw new Error(
            `Invalid embedding at batch position ${index}: ${parsed.error.issues[0]?.message}`,
          );
        }
        return parsed.data;
      });

      return {
        embeddings,
        usage: {
          tokens,
          calls,
          retries,
          costUsd: estimateEmbeddingCostUsd(tokens),
        },
      };
    } catch (error) {
      lastError = error;
      // Network-level failures (fetch rejects) are retryable too.
      const isNetworkError = !(error instanceof Error && error.message.startsWith("Embedding"));
      if (isNetworkError && attempt < MAX_ATTEMPTS) {
        retries += 1;
        await delay(backoffMs(attempt));
        continue;
      }
      throw error;
    }
  }

  throw lastError instanceof Error
    ? lastError
    : new Error("Embedding failed after exhausting retries");
}

/**
 * Embed many texts as *documents* (corpus side of retrieval).
 * Callers are responsible for splitting into API-sized batches.
 */
export async function embedTexts(
  texts: string[],
  taskType: EmbeddingTaskType = "RETRIEVAL_DOCUMENT",
): Promise<EmbeddingResult> {
  if (texts.length === 0) {
    return { embeddings: [], usage: emptyUsage() };
  }
  return embedBatch(texts, taskType);
}

/**
 * Embed a single text as a *query* (search side of retrieval).
 * This is what the retrieval layer calls.
 */
export async function embedQuery(text: string): Promise<number[]> {
  const { embeddings } = await embedBatch([text], "RETRIEVAL_QUERY");
  return embeddings[0];
}

/**
 * Embed a single text as a document. Kept for callers that need one vector
 * without the usage envelope.
 */
export async function embedText(text: string): Promise<number[]> {
  const { embeddings } = await embedBatch([text], "RETRIEVAL_DOCUMENT");
  return embeddings[0];
}

export { addUsage, emptyUsage };
export type { EmbeddingUsage };
