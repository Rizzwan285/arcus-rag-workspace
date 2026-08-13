import { z } from "zod";
import { createTRPCRouter, publicProcedure } from "@/server/api/trpc";

export const studyRouter = createTRPCRouter({
  // ──────────────────────────────────────
  // Flashcard Decks
  // ──────────────────────────────────────

  /**
   * Get all flashcard decks for a document
   */
  getFlashcardDecks: publicProcedure
    .input(z.object({ documentId: z.string() }))
    .query(async ({ ctx, input }) => {
      return ctx.prisma.flashcardDeck.findMany({
        where: { documentId: input.documentId },
        orderBy: { createdAt: "desc" },
        include: {
          cards: true,
          _count: { select: { cards: true } },
        },
      });
    }),

  /**
   * Get a single flashcard deck with all cards
   */
  getFlashcardDeck: publicProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
      return ctx.prisma.flashcardDeck.findUnique({
        where: { id: input.id },
        include: { cards: true },
      });
    }),

  /**
   * Create a flashcard deck with cards
   */
  createFlashcardDeck: publicProcedure
    .input(
      z.object({
        documentId: z.string(),
        title: z.string(),
        cards: z.array(
          z.object({
            front: z.string(),
            back: z.string(),
          })
        ),
      })
    )
    .mutation(async ({ ctx, input }) => {
      return ctx.prisma.flashcardDeck.create({
        data: {
          documentId: input.documentId,
          title: input.title,
          cards: {
            create: input.cards,
          },
        },
        include: { cards: true },
      });
    }),

  // ──────────────────────────────────────
  // Quizzes
  // ──────────────────────────────────────

  /**
   * Get all quizzes for a document
   */
  getQuizzes: publicProcedure
    .input(z.object({ documentId: z.string() }))
    .query(async ({ ctx, input }) => {
      return ctx.prisma.quiz.findMany({
        where: { documentId: input.documentId },
        orderBy: { createdAt: "desc" },
        include: {
          _count: { select: { questions: true } },
        },
      });
    }),

  /**
   * Get a single quiz with all questions
   */
  getQuiz: publicProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
      return ctx.prisma.quiz.findUnique({
        where: { id: input.id },
        include: { questions: true },
      });
    }),

  /**
   * Create a quiz with questions
   */
  createQuiz: publicProcedure
    .input(
      z.object({
        documentId: z.string(),
        title: z.string(),
        questions: z.array(
          z.object({
            question: z.string(),
            options: z.array(z.string()),
            correctAnswer: z.string(),
            explanation: z.string().optional(),
          })
        ),
      })
    )
    .mutation(async ({ ctx, input }) => {
      return ctx.prisma.quiz.create({
        data: {
          documentId: input.documentId,
          title: input.title,
          questions: {
            create: input.questions,
          },
        },
        include: { questions: true },
      });
    }),
});
