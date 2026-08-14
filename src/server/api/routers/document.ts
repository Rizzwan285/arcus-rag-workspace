import { z } from "zod";
import {
  createTRPCRouter,
  publicProcedure,
  protectedProcedure,
} from "@/server/api/trpc";

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
    const [documentCount, chatSessionCount, flashcardDeckCount, quizCount] =
      await Promise.all([
        ctx.prisma.document.count({ where: { userId: ctx.user.id } }),
        ctx.prisma.chatSession.count({ where: { userId: ctx.user.id } }),
        ctx.prisma.flashcardDeck.count({
          where: { document: { userId: ctx.user.id } },
        }),
        ctx.prisma.quiz.count({
          where: { document: { userId: ctx.user.id } },
        }),
      ]);

    return { documentCount, chatSessionCount, flashcardDeckCount, quizCount };
  }),
});
