/**
 * Document Ingestion Pipeline (Inngest)
 *
 * fetch → parse → chunk → validate → embed → upsert → finalise
 *
 * Three properties this pipeline is built around:
 *
 *   Idempotency — every chunk carries a SHA-256 of its text, and
 *   `@@unique([documentId, contentHash])` turns a re-inserted chunk into a
 *   no-op. A step that fails after writing half a batch can be retried
 *   verbatim without duplicating rows.
 *
 *   Observability — each attempt opens an `IngestionRun` row and closes it with
 *   latency, chunk yield, dedupe count, and estimated embedding token spend.
 *   Step-level structured logs carry the same identifiers.
 *
 *   Containment — embeddings never cross a step boundary. Each batch is
 *   embedded and written inside a single step, so step output stays a few
 *   hundred bytes of counters rather than megabytes of float arrays.
 *
 * @see ADR-015, ADR-016, ADR-017 in .claude/decisions.md
 */

import { NonRetriableError } from "inngest";
import { documentIngestEvent, inngest } from "./client";
import { prisma } from "@/server/db/prisma";
import { loadAndChunkPDF } from "@/lib/langchain/document-loader";
import { embedTexts } from "@/lib/langchain/embeddings";
import { createChunkId } from "@/lib/ingestion/ids";
import {
  addUsage,
  emptyUsage,
  estimateEmbeddingCostUsd,
  type EmbeddingUsage,
} from "@/lib/ingestion/cost";
import {
  describeError,
  PipelineLogger,
  StepTimer,
} from "@/lib/ingestion/telemetry";
import {
  chunkSchema,
  ingestEventSchema,
  type ValidatedChunk,
} from "@/lib/ingestion/schemas";

/** Chunks embedded per API call. Gemini caps `batchEmbedContents` at 100. */
const EMBEDDING_BATCH_SIZE = 50;

/** Pause between batches so a large document does not trip the API rate limit. */
const BATCH_DELAY_MS = 500;

/**
 * Upper bound on chunks per document. A 32 MB PDF of dense text would otherwise
 * produce tens of thousands of chunks — enough to blow past Inngest's step
 * output limit and to make the embedding bill for one upload surprising.
 * Exceeding it is a permanent failure, routed to the DLQ for triage.
 */
const MAX_CHUNKS_PER_DOCUMENT = 3_000;

/**
 * Fraction of chunks that may fail validation before the document is considered
 * unusable. A few rejected fragments are normal (headers, page numbers); a
 * majority means the extraction itself went wrong.
 */
const MAX_REJECTION_RATE = 0.5;

interface BatchOutcome {
  batchIndex: number;
  attempted: number;
  inserted: number;
  deduped: number;
  tokens: number;
  calls: number;
  retries: number;
  costUsd: number;
  durationMs: number;
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Write one batch of chunks with their vectors.
 *
 * A single multi-row INSERT keeps the round trips down; `ON CONFLICT DO NOTHING`
 * against the `(documentId, contentHash)` unique index is what makes a retry
 * safe. The statement's row count tells us how many rows were genuinely new,
 * and the difference is the dedupe count.
 */
async function insertChunkBatch(
  documentId: string,
  chunks: ValidatedChunk[],
  embeddings: number[][],
): Promise<{ inserted: number; deduped: number }> {
  if (chunks.length === 0) return { inserted: 0, deduped: 0 };

  const valueRows: string[] = [];
  const params: unknown[] = [];
  let paramIndex = 1;

  for (const [i, chunk] of chunks.entries()) {
    valueRows.push(
      `($${paramIndex}, $${paramIndex + 1}, $${paramIndex + 2}, $${paramIndex + 3}, ` +
        `$${paramIndex + 4}, $${paramIndex + 5}::jsonb, $${paramIndex + 6}, ` +
        `$${paramIndex + 7}, $${paramIndex + 8}::vector)`,
    );
    params.push(
      createChunkId(),
      documentId,
      chunk.content,
      chunk.contentHash,
      chunk.tokenCount,
      JSON.stringify(chunk.metadata),
      chunk.pageNumber,
      chunk.chunkIndex,
      `[${embeddings[i].join(",")}]`,
    );
    paramIndex += 9;
  }

  const sql = `
    INSERT INTO "DocumentChunk"
      (id, "documentId", content, "contentHash", "tokenCount", metadata, "pageNumber", "chunkIndex", embedding)
    VALUES ${valueRows.join(", ")}
    ON CONFLICT ("documentId", "contentHash") DO NOTHING
  `;

  const inserted = await prisma.$executeRawUnsafe(sql, ...params);
  return { inserted, deduped: chunks.length - inserted };
}

export const ingestDocument = inngest.createFunction(
  {
    id: "ingest-document",
    triggers: [documentIngestEvent],
    /**
     * Transient faults (a flaky UploadThing fetch, a 429 from Gemini) are
     * retried; only an exhausted budget reaches `onFailure` and the DLQ.
     */
    retries: 3,
    /** Protects the embedding API's rate limit when several uploads land together. */
    concurrency: { limit: 3 },
    /** A second run for the same document while one is in flight is redundant work. */
    singleton: { key: "event.data.documentId", mode: "skip" },

    /**
     * Dead Letter Queue.
     *
     * Fires only once Inngest has exhausted every retry, which is the point at
     * which a failure is genuinely permanent. Marking FAILED here rather than
     * inside the handler's catch means a document is not shown as broken to the
     * user while it still has retries left.
     */
    onFailure: async ({ event, error }) => {
      const documentId = (event?.data?.event?.data as { documentId?: string } | undefined)
        ?.documentId;
      if (!documentId) return;

      const { message, trace } = describeError(error);
      const log = new PipelineLogger({ documentId });

      log.error("ingestion.dead_lettered", { error: message });

      // Best-effort: the DLQ must never throw and re-enter the failure path.
      try {
        await prisma.$transaction([
          prisma.document.update({
            where: { id: documentId },
            data: {
              status: "FAILED",
              failedAt: new Date(),
              failedStep: "pipeline",
              errorMessage: message.slice(0, 2_000),
              errorTrace: trace.slice(0, 8_000),
            },
          }),
          prisma.ingestionRun.updateMany({
            where: { documentId, status: "RUNNING" },
            data: {
              status: "FAILED",
              finishedAt: new Date(),
              errorMessage: message.slice(0, 2_000),
              errorTrace: trace.slice(0, 8_000),
            },
          }),
        ]);
      } catch (dlqError) {
        log.error("ingestion.dead_letter_write_failed", { error: dlqError });
      }
    },
  },
  async ({ event, step, runId, attempt }) => {
    // ── Contract check ────────────────────────────────────────────────
    // A malformed payload will never succeed, so it must not consume retries.
    const parsedEvent = ingestEventSchema.safeParse(event.data);
    if (!parsedEvent.success) {
      throw new NonRetriableError(
        `Invalid document/ingest payload: ${parsedEvent.error.issues
          .map((issue) => `${issue.path.join(".")}: ${issue.message}`)
          .join("; ")}`,
      );
    }

    const { documentId, fileUrl } = parsedEvent.data;
    const log = new PipelineLogger({ documentId, runId, attempt });
    const timer = new StepTimer();

    log.info("ingestion.started", { fileUrl });

    // ── Step 1: open the telemetry record and claim the document ──────
    const ingestionRunId = await step.run("open-ingestion-run", async () => {
      const [run] = await prisma.$transaction([
        prisma.ingestionRun.create({
          data: { documentId, runId, attempt: attempt + 1, status: "RUNNING" },
          select: { id: true },
        }),
        prisma.document.update({
          where: { id: documentId },
          data: {
            status: "PROCESSING",
            // Clear any DLQ state from a previous failed attempt.
            failedAt: null,
            failedStep: null,
            errorMessage: null,
            errorTrace: null,
          },
        }),
      ]);
      return run.id;
    });

    let failedStep = "unknown";

    try {
      // ── Step 2: fetch, parse, chunk, validate ──────────────────────
      failedStep = "fetch-and-chunk";
      const chunking = await step.run("fetch-and-chunk", async () => {
        const startedAt = Date.now();

        const response = await fetch(fileUrl);
        if (!response.ok) {
          throw new Error(
            `Failed to fetch PDF: ${response.status} ${response.statusText}`,
          );
        }
        const arrayBuffer = await response.arrayBuffer();
        const pdfBuffer = Buffer.from(arrayBuffer);

        const result = await loadAndChunkPDF(pdfBuffer);

        if (result.chunks.length === 0) {
          throw new NonRetriableError(
            "No usable text chunks could be extracted from this PDF. " +
              "It may be a scanned image, password-protected, or contain only figures.",
          );
        }

        const rejectionRate =
          result.rejected.length /
          (result.chunks.length + result.rejected.length);
        if (rejectionRate > MAX_REJECTION_RATE) {
          throw new NonRetriableError(
            `${Math.round(rejectionRate * 100)}% of extracted chunks failed validation ` +
              `(first reason: ${result.rejected[0]?.reason}). The PDF text layer is likely corrupt.`,
          );
        }

        if (result.chunks.length > MAX_CHUNKS_PER_DOCUMENT) {
          throw new NonRetriableError(
            `Document produced ${result.chunks.length} chunks, above the ` +
              `${MAX_CHUNKS_PER_DOCUMENT} limit. Split it into smaller uploads.`,
          );
        }

        return {
          chunks: result.chunks,
          rejectedCount: result.rejected.length,
          rejectedSample: result.rejected.slice(0, 5),
          duplicatesDropped: result.duplicatesDropped,
          pagesParsed: result.pagesParsed,
          charsExtracted: result.charsExtracted,
          bytesFetched: pdfBuffer.length,
          durationMs: Date.now() - startedAt,
        };
      });

      timer.record("fetch-and-chunk", chunking.durationMs);

      log.info("ingestion.chunked", {
        chunksYielded: chunking.chunks.length,
        chunksRejected: chunking.rejectedCount,
        duplicatesDropped: chunking.duplicatesDropped,
        pagesParsed: chunking.pagesParsed,
        charsExtracted: chunking.charsExtracted,
        bytesFetched: chunking.bytesFetched,
        durationMs: chunking.durationMs,
      });

      if (chunking.rejectedCount > 0) {
        log.warn("ingestion.chunks_rejected", {
          count: chunking.rejectedCount,
          sample: chunking.rejectedSample,
        });
      }

      // Step output is JSON, so revalidate on the way back in — this is the
      // last gate before the text reaches PostgreSQL.
      const chunks = chunking.chunks.map((chunk) => chunkSchema.parse(chunk));

      // ── Step 3: embed + upsert, one step per batch ─────────────────
      failedStep = "embed-and-store";
      const totalBatches = Math.ceil(chunks.length / EMBEDDING_BATCH_SIZE);
      const outcomes: BatchOutcome[] = [];

      for (let batchIndex = 0; batchIndex < totalBatches; batchIndex++) {
        const start = batchIndex * EMBEDDING_BATCH_SIZE;
        const batch = chunks.slice(start, start + EMBEDDING_BATCH_SIZE);

        const outcome = await step.run(
          `embed-and-store-batch-${batchIndex}`,
          async (): Promise<BatchOutcome> => {
            const startedAt = Date.now();

            const { embeddings, usage } = await embedTexts(
              batch.map((chunk) => chunk.content),
            );

            const { inserted, deduped } = await insertChunkBatch(
              documentId,
              batch,
              embeddings,
            );

            return {
              batchIndex,
              attempted: batch.length,
              inserted,
              deduped,
              tokens: usage.tokens,
              calls: usage.calls,
              retries: usage.retries,
              costUsd: usage.costUsd,
              durationMs: Date.now() - startedAt,
            };
          },
        );

        outcomes.push(outcome);
        timer.record("embed-and-store", outcome.durationMs);

        log.info("ingestion.batch_completed", {
          batch: `${batchIndex + 1}/${totalBatches}`,
          ...outcome,
        });

        if (batchIndex < totalBatches - 1) {
          await delay(BATCH_DELAY_MS);
        }
      }

      const usage: EmbeddingUsage = outcomes.reduce<EmbeddingUsage>(
        (total, outcome) =>
          addUsage(total, {
            tokens: outcome.tokens,
            calls: outcome.calls,
            retries: outcome.retries,
            costUsd: outcome.costUsd,
          }),
        emptyUsage(),
      );

      const insertedTotal = outcomes.reduce((n, o) => n + o.inserted, 0);
      const dedupedTotal =
        outcomes.reduce((n, o) => n + o.deduped, 0) + chunking.duplicatesDropped;

      // ── Step 4: close out the run ──────────────────────────────────
      failedStep = "finalize";
      const latencyMs = timer.elapsedMs;

      const summary = await step.run("finalize", async () => {
        // Count from the table rather than from counters: after a partial retry
        // this is the only number that is certainly correct.
        const storedChunks = await prisma.documentChunk.count({
          where: { documentId },
        });

        await prisma.$transaction([
          prisma.document.update({
            where: { id: documentId },
            data: {
              status: "COMPLETED",
              pageCount: chunking.pagesParsed,
              chunkCount: storedChunks,
              ingestedAt: new Date(),
              failedAt: null,
              failedStep: null,
              errorMessage: null,
              errorTrace: null,
            },
          }),
          prisma.ingestionRun.update({
            where: { id: ingestionRunId },
            data: {
              status: "SUCCEEDED",
              attempt: attempt + 1,
              finishedAt: new Date(),
              latencyMs,
              bytesFetched: chunking.bytesFetched,
              pagesParsed: chunking.pagesParsed,
              chunksYielded: chunks.length,
              chunksRejected: chunking.rejectedCount,
              chunksInserted: insertedTotal,
              chunksDeduped: dedupedTotal,
              embeddingTokens: usage.tokens,
              embeddingCalls: usage.calls,
              embeddingCostUsd: usage.costUsd,
              stepTimings: timer.stepTimings,
            },
          }),
        ]);

        return { storedChunks };
      });

      log.info("ingestion.completed", {
        latencyMs,
        pagesParsed: chunking.pagesParsed,
        chunksYielded: chunks.length,
        chunksInserted: insertedTotal,
        chunksDeduped: dedupedTotal,
        chunksRejected: chunking.rejectedCount,
        chunksStored: summary.storedChunks,
        embeddingTokens: usage.tokens,
        embeddingCalls: usage.calls,
        embeddingRetries: usage.retries,
        estimatedCostUsd: Number(usage.costUsd.toFixed(6)),
        stepTimings: timer.stepTimings,
      });

      return {
        success: true,
        documentId,
        latencyMs,
        chunksYielded: chunks.length,
        chunksInserted: insertedTotal,
        chunksDeduped: dedupedTotal,
        chunksStored: summary.storedChunks,
        embeddingTokens: usage.tokens,
        estimatedCostUsd: usage.costUsd,
      };
    } catch (error) {
      // Record which step failed on *this* attempt. The document is only moved
      // to FAILED once retries are exhausted, in `onFailure`.
      const { message, trace } = describeError(error);

      log.error("ingestion.attempt_failed", {
        failedStep,
        latencyMs: timer.elapsedMs,
        error: message,
      });

      await step.run("record-attempt-failure", async () => {
        await prisma.ingestionRun.update({
          where: { id: ingestionRunId },
          data: {
            attempt: attempt + 1,
            failedStep,
            errorMessage: message.slice(0, 2_000),
            errorTrace: trace.slice(0, 8_000),
            latencyMs: timer.elapsedMs,
            stepTimings: timer.stepTimings,
          },
        });
        // Surface the failing step on the document too, so DLQ triage shows
        // where it broke even if `onFailure` cannot resolve the cause.
        await prisma.document.update({
          where: { id: documentId },
          data: { failedStep },
        });
      });

      throw error;
    }
  },
);

/** Estimated USD cost helper re-exported for callers reporting on a run. */
export { estimateEmbeddingCostUsd };
