import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { createTRPCRouter, protectedProcedure } from "@/server/api/trpc";
import { documentIngestEvent, inngest } from "@/inngest/client";

export const documentRouter = createTRPCRouter({
  /**
   * Get all documents for the authenticated user
   */
  getAll: protectedProcedure.query(async ({ ctx }) => {
    return ctx.prisma.document.findMany({
      where: { userId: ctx.user.id },
      orderBy: { createdAt: "desc" },
      include: {
        _count: {
          select: { chunks: true },
        },
      },
    });
  }),

  /**
   * Get a single document by ID
   */
  getById: protectedProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
      return ctx.prisma.document.findUnique({
        where: { id: input.id, userId: ctx.user.id },
        include: {
          chunks: {
            select: { id: true, chunkIndex: true, pageNumber: true },
            orderBy: { chunkIndex: "asc" },
          },
          flashcardDecks: {
            include: { _count: { select: { cards: true } } },
          },
          quizzes: {
            include: { _count: { select: { questions: true } } },
          },
        },
      });
    }),

  /**
   * Get real-time processing status for a document.
   * Used by the UI to poll for status updates during ingestion.
   */
  getStatus: protectedProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
      const doc = await ctx.prisma.document.findUnique({
        where: { id: input.id, userId: ctx.user.id },
        select: {
          status: true,
          pageCount: true,
          chunkCount: true,
          ingestedAt: true,
          failedAt: true,
          failedStep: true,
          errorMessage: true,
          _count: { select: { chunks: true } },
        },
      });
      return doc;
    }),

  /**
   * Create a new document record (after file upload)
   */
  create: protectedProcedure
    .input(
      z.object({
        title: z.string().min(1),
        fileUrl: z.string().url(),
        fileType: z.string().default("pdf"),
      })
    )
    .mutation(async ({ ctx, input }) => {
      return ctx.prisma.document.create({
        data: {
          userId: ctx.user.id,
          title: input.title,
          fileUrl: input.fileUrl,
          fileType: input.fileType,
        },
      });
    }),

  /**
   * Update document status (used by ingestion pipeline)
   */
  updateStatus: protectedProcedure
    .input(
      z.object({
        id: z.string(),
        status: z.enum(["PENDING", "PROCESSING", "COMPLETED", "FAILED"]),
        pageCount: z.number().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      return ctx.prisma.document.update({
        where: { id: input.id, userId: ctx.user.id },
        data: {
          status: input.status,
          pageCount: input.pageCount,
        },
      });
    }),

  /**
   * Delete a document and all related data
   */
  delete: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      return ctx.prisma.document.delete({
        where: { id: input.id, userId: ctx.user.id },
      });
    }),

  /**
   * Get aggregate stats for the dashboard home page.
   */
  getStats: protectedProcedure.query(async ({ ctx }) => {
    const [
      documentCount,
      readyCount,
      processingCount,
      failedCount,
      chunkCount,
      chatSessionCount,
      flashcardDeckCount,
      quizCount,
    ] = await Promise.all([
      ctx.prisma.document.count({ where: { userId: ctx.user.id } }),
      ctx.prisma.document.count({
        where: { userId: ctx.user.id, status: "COMPLETED" },
      }),
      ctx.prisma.document.count({
        where: { userId: ctx.user.id, status: { in: ["PENDING", "PROCESSING"] } },
      }),
      ctx.prisma.document.count({
        where: { userId: ctx.user.id, status: "FAILED" },
      }),
      // The indexed corpus — the number that actually determines answer quality.
      ctx.prisma.documentChunk.count({
        where: { document: { userId: ctx.user.id } },
      }),
      ctx.prisma.chatSession.count({ where: { userId: ctx.user.id } }),
      ctx.prisma.flashcardDeck.count({
        where: { document: { userId: ctx.user.id } },
      }),
      ctx.prisma.quiz.count({
        where: { document: { userId: ctx.user.id } },
      }),
    ]);

    return {
      documentCount,
      readyCount,
      processingCount,
      failedCount,
      chunkCount,
      chatSessionCount,
      flashcardDeckCount,
      quizCount,
    };
  }),

  /**
   * Dead Letter Queue view: documents whose ingestion exhausted every retry,
   * with the failing step and error trace needed to triage them.
   */
  getFailed: protectedProcedure.query(async ({ ctx }) => {
    return ctx.prisma.document.findMany({
      where: { userId: ctx.user.id, status: "FAILED" },
      orderBy: { failedAt: "desc" },
      select: {
        id: true,
        title: true,
        fileUrl: true,
        failedAt: true,
        failedStep: true,
        errorMessage: true,
        errorTrace: true,
        createdAt: true,
        ingestionRuns: {
          orderBy: { startedAt: "desc" },
          take: 1,
          select: {
            attempt: true,
            latencyMs: true,
            chunksYielded: true,
            startedAt: true,
          },
        },
      },
    });
  }),

  /**
   * Ingestion run history for one document — latency, chunk yield, dedupe
   * count, and estimated embedding spend per attempt.
   */
  getIngestionRuns: protectedProcedure
    .input(z.object({ documentId: z.string() }))
    .query(async ({ ctx, input }) => {
      // Ownership is checked on the parent document, not the run.
      const document = await ctx.prisma.document.findFirst({
        where: { id: input.documentId, userId: ctx.user.id },
        select: { id: true },
      });
      if (!document) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Document not found" });
      }

      return ctx.prisma.ingestionRun.findMany({
        where: { documentId: input.documentId },
        orderBy: { startedAt: "desc" },
        take: 20,
      });
    }),

  /**
   * Most recent ingestion runs across the user's whole corpus — the feed the
   * pipeline view is built on.
   */
  getRecentRuns: protectedProcedure
    .input(z.object({ limit: z.number().int().min(1).max(100).default(25) }))
    .query(async ({ ctx, input }) => {
      return ctx.prisma.ingestionRun.findMany({
        where: { document: { userId: ctx.user.id } },
        orderBy: { startedAt: "desc" },
        take: input.limit,
        include: {
          document: { select: { id: true, title: true, status: true } },
        },
      });
    }),

  /**
   * DLQ redrive: re-enqueue ingestion for a document.
   *
   * Safe to call repeatedly — chunk writes are keyed on
   * `(documentId, contentHash)`, so re-running over already-indexed content is
   * a no-op. `purgeExistingChunks` forces a clean rebuild, which is what you
   * want after the chunking or embedding strategy changes.
   */
  retryIngestion: protectedProcedure
    .input(
      z.object({
        id: z.string(),
        purgeExistingChunks: z.boolean().default(false),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const document = await ctx.prisma.document.findFirst({
        where: { id: input.id, userId: ctx.user.id },
        select: { id: true, fileUrl: true, status: true },
      });
      if (!document) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Document not found" });
      }
      if (document.status === "PROCESSING") {
        throw new TRPCError({
          code: "CONFLICT",
          message: "This document is already being processed.",
        });
      }

      if (input.purgeExistingChunks) {
        await ctx.prisma.documentChunk.deleteMany({
          where: { documentId: document.id },
        });
      }

      await ctx.prisma.document.update({
        where: { id: document.id },
        data: {
          status: "PENDING",
          failedAt: null,
          failedStep: null,
          errorMessage: null,
          errorTrace: null,
          ...(input.purgeExistingChunks ? { chunkCount: 0 } : {}),
        },
      });

      await inngest.send(
        documentIngestEvent.create({
          documentId: document.id,
          fileUrl: document.fileUrl,
        })
      );

      return { queued: true, documentId: document.id };
    }),

  /**
   * Aggregate pipeline health for the observability panel.
   *
   * p95 latency comes from `percentile_cont` in raw SQL — Prisma's aggregate
   * API has no percentile support, and an average alone hides the tail that
   * actually matters.
   */
  getPipelineStats: protectedProcedure.query(async ({ ctx }) => {
    const rows = await ctx.prisma.$queryRaw<
      Array<{
        totalRuns: bigint;
        succeeded: bigint;
        failed: bigint;
        avgLatencyMs: number | null;
        p95LatencyMs: number | null;
        totalChunks: bigint | null;
        totalDeduped: bigint | null;
        totalTokens: bigint | null;
        totalCostUsd: number | null;
      }>
    >`
      SELECT
        COUNT(*)                                                          AS "totalRuns",
        COUNT(*) FILTER (WHERE r.status = 'SUCCEEDED')                    AS "succeeded",
        COUNT(*) FILTER (WHERE r.status = 'FAILED')                       AS "failed",
        AVG(r."latencyMs") FILTER (WHERE r.status = 'SUCCEEDED')          AS "avgLatencyMs",
        PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY r."latencyMs")
          FILTER (WHERE r.status = 'SUCCEEDED')                           AS "p95LatencyMs",
        SUM(r."chunksInserted")                                           AS "totalChunks",
        SUM(r."chunksDeduped")                                            AS "totalDeduped",
        SUM(r."embeddingTokens")                                          AS "totalTokens",
        SUM(r."embeddingCostUsd")                                         AS "totalCostUsd"
      FROM "IngestionRun" r
      INNER JOIN "Document" d ON d.id = r."documentId"
      WHERE d."userId" = ${ctx.user.id}
    `;

    const row = rows[0];
    // Postgres COUNT/SUM return bigint; normalise before it crosses the wire.
    const toNumber = (value: bigint | number | null | undefined) =>
      value === null || value === undefined ? 0 : Number(value);

    return {
      totalRuns: toNumber(row?.totalRuns),
      succeeded: toNumber(row?.succeeded),
      failed: toNumber(row?.failed),
      avgLatencyMs: Math.round(toNumber(row?.avgLatencyMs)),
      p95LatencyMs: Math.round(toNumber(row?.p95LatencyMs)),
      totalChunks: toNumber(row?.totalChunks),
      totalDeduped: toNumber(row?.totalDeduped),
      totalTokens: toNumber(row?.totalTokens),
      totalCostUsd: toNumber(row?.totalCostUsd),
    };
  }),
});
