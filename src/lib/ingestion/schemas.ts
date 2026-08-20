/**
 * Ingestion Data Contracts
 *
 * Every value that crosses a pipeline boundary — the Inngest event payload, the
 * chunker's output, the embedding API's response — is validated here before it
 * reaches PostgreSQL. Malformed chunks are rejected individually (and counted in
 * telemetry) rather than poisoning a whole batch insert.
 *
 * @see ADR-016 in .claude/decisions.md
 */

import { z } from "zod";

/** Hard ceiling on a single chunk. Guards against a splitter that fails to split. */
export const MAX_CHUNK_CHARS = 8_000;

/** Chunks shorter than this carry no retrievable signal (page numbers, artefacts). */
export const MIN_CHUNK_CHARS = 24;

/** Must match `vector(768)` on DocumentChunk.embedding. */
export const EMBEDDING_DIMENSIONS = 768;

/**
 * The event that kicks off ingestion. Validated at the top of the Inngest
 * function so a malformed publish fails fast with a readable error instead of
 * throwing somewhere deep in the pipeline.
 */
export const ingestEventSchema = z.object({
  documentId: z.string().min(1, "documentId is required"),
  fileUrl: z.url("fileUrl must be an absolute URL"),
});

export type IngestEvent = z.infer<typeof ingestEventSchema>;

/**
 * A single chunk, exactly as it will be written to `DocumentChunk`.
 *
 * `contentHash` is the SHA-256 of `content` and doubles as the idempotency key:
 * `@@unique([documentId, contentHash])` means a retried run re-inserting the
 * same chunk is a no-op rather than a duplicate.
 */
export const chunkSchema = z.object({
  content: z
    .string()
    .min(MIN_CHUNK_CHARS, `chunk must be at least ${MIN_CHUNK_CHARS} characters`)
    .max(MAX_CHUNK_CHARS, `chunk must be at most ${MAX_CHUNK_CHARS} characters`)
    .refine((v) => v.trim().length > 0, "chunk must not be blank"),
  contentHash: z
    .string()
    .regex(/^[0-9a-f]{64}$/, "contentHash must be a lowercase SHA-256 hex digest"),
  chunkIndex: z.number().int().nonnegative(),
  pageNumber: z.number().int().nonnegative(),
  tokenCount: z.number().int().positive(),
  metadata: z.record(z.string(), z.unknown()),
});

export type ValidatedChunk = z.infer<typeof chunkSchema>;

/** A chunk the validator turned away, kept for telemetry and DLQ diagnostics. */
export interface RejectedChunk {
  chunkIndex: number;
  reason: string;
  preview: string;
}

/** One embedding vector, checked for dimensionality and numeric sanity. */
export const embeddingSchema = z
  .array(z.number().finite())
  .length(
    EMBEDDING_DIMENSIONS,
    `embedding must have exactly ${EMBEDDING_DIMENSIONS} dimensions`,
  );

/** The chunker's full output: what survived, what did not, and why. */
export interface ChunkingResult {
  chunks: ValidatedChunk[];
  rejected: RejectedChunk[];
  /** Chunks dropped because an identical hash already appeared in this document. */
  duplicatesDropped: number;
  pagesParsed: number;
  /** Characters of extracted text before splitting. */
  charsExtracted: number;
}
