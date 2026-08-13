import { z } from "zod";
import { createTRPCRouter, protectedProcedure } from "@/server/api/trpc";
import { TRPCError } from "@trpc/server";

export const quizRouter = createTRPCRouter({
  // Get all quizzes for the user
  getQuizzes: protectedProcedure.query(async ({ ctx }) => {
    return ctx.prisma.quiz.findMany({
      where: {
        document: {
          userId: ctx.session.user.id,
        },
      },
      include: {
        document: {
          select: { title: true },
        },
        _count: {
          select: { questions: true },
        },
      },
      orderBy: { createdAt: "desc" },
    });
  }),

  // Get a specific quiz with its questions
  getQuizById: protectedProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
      const quiz = await ctx.prisma.quiz.findUnique({
        where: { id: input.id },
        include: {
          questions: true,
          document: {
            select: { userId: true, title: true },
          },
        },
      });

      if (!quiz) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Quiz not found" });
      }

      if (quiz.document.userId !== ctx.session.user.id) {
        throw new TRPCError({ code: "FORBIDDEN", message: "Access denied" });
      }

      return quiz;
    }),

  // Delete a quiz
  deleteQuiz: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const quiz = await ctx.prisma.quiz.findUnique({
        where: { id: input.id },
        include: { document: { select: { userId: true } } },
      });

      if (!quiz) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Quiz not found" });
      }

      if (quiz.document.userId !== ctx.session.user.id) {
        throw new TRPCError({ code: "FORBIDDEN", message: "Access denied" });
      }

      await ctx.prisma.quiz.delete({
        where: { id: input.id },
      });

      return { success: true };
    }),
});
