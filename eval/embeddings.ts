/**
 * Embedding client for the evaluation harness, with an on-disk cache.
 *
 * Deliberately separate from `src/lib/langchain/embeddings.ts`: that module is
 * bound to the application's error handling and telemetry, while this one needs
 * to be callable from a plain Node script and to memoise aggressively so a
 * re-run costs nothing and returns byte-identical vectors. The request shape —
 * model, task type, and output dimensionality — is kept in lockstep with the
 * application client; a drift there would invalidate the benchmark.
 */

import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";

const EMBEDDING_MODEL = "gemini-embedding-001";
const EMBEDDING_DIMENSIONS = 768;
const API_BASE = "https://generativelanguage.googleapis.com/v1beta";
const BATCH_SIZE = 50;

export type EmbeddingTaskType = "RETRIEVAL_DOCUMENT" | "RETRIEVAL_QUERY";

const CACHE_PATH = join(__dirname, "..", "..", "eval", ".cache", "embeddings.json");

type Cache = Record<string, number[]>;

function loadCache(): Cache {
  if (!existsSync(CACHE_PATH)) return {};
  try {
    return JSON.parse(readFileSync(CACHE_PATH, "utf8")) as Cache;
  } catch {
    // A corrupt cache is not worth failing the run over — just rebuild it.
    return {};
  }
}

function saveCache(cache: Cache): void {
  mkdirSync(dirname(CACHE_PATH), { recursive: true });
  writeFileSync(CACHE_PATH, JSON.stringify(cache));
}

function cacheKey(taskType: EmbeddingTaskType, text: string): string {
  return createHash("sha256")
    .update(`${EMBEDDING_MODEL}:${EMBEDDING_DIMENSIONS}:${taskType}:${text}`)
    .digest("hex");
}

function apiKey(): string {
  const key =
    process.env.GOOGLE_API_KEY ?? process.env.GOOGLE_GENERATIVE_AI_API_KEY;
  if (!key) {
    throw new Error(
      "GOOGLE_API_KEY (or GOOGLE_GENERATIVE_AI_API_KEY) must be set to run the benchmark.",
    );
  }
  return key;
}

const MAX_ATTEMPTS = 6;
const BASE_BACKOFF_MS = 4_000;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Gemini returns a `retryDelay` on quota errors. Honouring it beats guessing,
 * because the free tier's per-minute window is longer than a naive backoff.
 */
function retryDelayFromBody(body: string, attempt: number): number {
  const match = body.match(/"retryDelay"\s*:\s*"(\d+)s"/);
  if (match) return (Number(match[1]) + 1) * 1000;
  const exponential = BASE_BACKOFF_MS * 2 ** (attempt - 1);
  return Math.round(exponential * (0.5 + Math.random() * 0.5));
}

async function embedBatch(
  texts: string[],
  taskType: EmbeddingTaskType,
): Promise<number[][]> {
  const body = JSON.stringify({
    requests: texts.map((text) => ({
      model: `models/${EMBEDDING_MODEL}`,
      content: { parts: [{ text }] },
      taskType,
      outputDimensionality: EMBEDDING_DIMENSIONS,
    })),
  });

  let response: Response | undefined;

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    response = await fetch(
      `${API_BASE}/models/${EMBEDDING_MODEL}:batchEmbedContents?key=${apiKey()}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body,
      },
    );

    if (response.ok) break;

    const errorBody = await response.text();
    const retryable = response.status === 429 || response.status >= 500;

    if (!retryable || attempt === MAX_ATTEMPTS) {
      throw new Error(
        `Embedding API error (${response.status}): ${errorBody.slice(0, 300)}`,
      );
    }

    const delay = retryDelayFromBody(errorBody, attempt);
    console.log(
      `    rate limited (${response.status}); retrying in ${Math.round(delay / 1000)}s [${attempt}/${MAX_ATTEMPTS - 1}]`,
    );
    await sleep(delay);
  }

  if (!response || !response.ok) {
    throw new Error("Embedding request failed after exhausting retries");
  }

  const data = (await response.json()) as { embeddings?: { values: number[] }[] };
  if (!data.embeddings || data.embeddings.length !== texts.length) {
    throw new Error(
      `Expected ${texts.length} embeddings, got ${data.embeddings?.length ?? 0}`,
    );
  }

  for (const entry of data.embeddings) {
    if (entry.values.length !== EMBEDDING_DIMENSIONS) {
      throw new Error(
        `Expected ${EMBEDDING_DIMENSIONS} dimensions, got ${entry.values.length}`,
      );
    }
  }

  return data.embeddings.map((entry) => entry.values);
}

export interface EmbedResult {
  vectors: Map<string, number[]>;
  apiCalls: number;
  cacheHits: number;
}

/**
 * Embed many texts, consulting the cache first.
 * Returns a map keyed by the original text.
 */
export async function embedAll(
  texts: string[],
  taskType: EmbeddingTaskType,
): Promise<EmbedResult> {
  const cache = loadCache();
  const vectors = new Map<string, number[]>();
  const missing: string[] = [];
  let cacheHits = 0;

  for (const text of texts) {
    const cached = cache[cacheKey(taskType, text)];
    if (cached) {
      vectors.set(text, cached);
      cacheHits++;
    } else {
      missing.push(text);
    }
  }

  let apiCalls = 0;
  for (let i = 0; i < missing.length; i += BATCH_SIZE) {
    const batch = missing.slice(i, i + BATCH_SIZE);
    const embedded = await embedBatch(batch, taskType);
    apiCalls++;

    batch.forEach((text, index) => {
      vectors.set(text, embedded[index]);
      cache[cacheKey(taskType, text)] = embedded[index];
    });

    // Persist after every batch: a quota failure part-way through a large
    // corpus should not discard the work already paid for.
    saveCache(cache);

    if (i + BATCH_SIZE < missing.length) await sleep(1_000);
  }

  return { vectors, apiCalls, cacheHits };
}
