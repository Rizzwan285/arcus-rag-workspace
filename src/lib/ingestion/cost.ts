/**
 * Embedding Token & Cost Accounting
 *
 * `batchEmbedContents` does not return usage metadata, so token counts are
 * estimated locally. The estimate is deliberately conservative and its
 * assumptions live in one place, so it can be swapped for exact counts from
 * `:countTokens` (or a tokenizer) without touching call sites.
 *
 * Every number the pipeline reports as a token count or dollar figure comes
 * from here, and is labelled as an estimate wherever it surfaces.
 *
 * @see ADR-017 in .claude/decisions.md
 */

/**
 * Average characters per token for English prose under Gemini's SentencePiece
 * vocabulary. Academic text with formulae and citations runs denser than plain
 * prose, so 4.0 slightly over-counts — the safe direction for a cost estimate.
 */
const CHARS_PER_TOKEN = 4;

/**
 * USD per million input tokens for `gemini-embedding-001`.
 *
 * Override with `EMBEDDING_USD_PER_MTOK` when pricing changes, so a rate update
 * is an environment variable rather than a deploy.
 */
const DEFAULT_USD_PER_MILLION_TOKENS = 0.15;

function usdPerMillionTokens(): number {
  const raw = process.env.EMBEDDING_USD_PER_MTOK;
  if (!raw) return DEFAULT_USD_PER_MILLION_TOKENS;
  const parsed = Number.parseFloat(raw);
  return Number.isFinite(parsed) && parsed >= 0
    ? parsed
    : DEFAULT_USD_PER_MILLION_TOKENS;
}

/**
 * Estimate the token count of a string. Always returns at least 1 for
 * non-empty input so a chunk can never be recorded as costing zero tokens.
 */
export function estimateTokens(text: string): number {
  if (!text) return 0;
  return Math.max(1, Math.ceil(text.length / CHARS_PER_TOKEN));
}

/** Estimated USD cost of embedding `tokens` tokens. */
export function estimateEmbeddingCostUsd(tokens: number): number {
  return (tokens / 1_000_000) * usdPerMillionTokens();
}

/** Running totals for the embedding stage of one ingestion run. */
export interface EmbeddingUsage {
  /** Estimated input tokens across every batch. */
  tokens: number;
  /** Number of HTTP calls made to the embedding API, retries included. */
  calls: number;
  /** Number of batches that needed a retry. */
  retries: number;
  /** Estimated USD cost. */
  costUsd: number;
}

export function emptyUsage(): EmbeddingUsage {
  return { tokens: 0, calls: 0, retries: 0, costUsd: 0 };
}

export function addUsage(a: EmbeddingUsage, b: EmbeddingUsage): EmbeddingUsage {
  return {
    tokens: a.tokens + b.tokens,
    calls: a.calls + b.calls,
    retries: a.retries + b.retries,
    costUsd: a.costUsd + b.costUsd,
  };
}
