import { z } from "zod";
import {
  createTRPCRouter,
  protectedProcedure,
} from "@/server/api/trpc";

export const chatRouter = createTRPCRouter({
  /**
   * Create a new chat session for the authenticated user.
   */
  createSession: protectedProcedure
    .input(
      z.object({
        title: z.string().default("New Chat"),
      })
    )
    .mutation(async ({ ctx, input }) => {
      return ctx.prisma.chatSession.create({
        data: {
          userId: ctx.user.id,
          title: input.title,
        },
      });
    }),

  /**
   * Get all chat sessions for the authenticated user.
   * Ordered by most recently updated first.
   */
  getSessions: protectedProcedure.query(async ({ ctx }) => {
    return ctx.prisma.chatSession.findMany({
      where: { userId: ctx.user.id },
      orderBy: { updatedAt: "desc" },
      include: {
        _count: { select: { messages: true } },
      },
    });
  }),

  /**
   * Get messages for a specific chat session.
   * Verifies the session belongs to the authenticated user.
   */
  getSessionMessages: protectedProcedure
    .input(
      z.object({
        sessionId: z.string(),
      })
    )
    .query(async ({ ctx, input }) => {
      // Verify session ownership
      const session = await ctx.prisma.chatSession.findFirst({
        where: {
          id: input.sessionId,
          userId: ctx.user.id,
        },
      });

      if (!session) {
        throw new Error("Chat session not found");
      }

      return ctx.prisma.chatMessage.findMany({
        where: { sessionId: input.sessionId },
        orderBy: { createdAt: "asc" },
      });
    }),

  /**
   * Update the title of a chat session.
   */
  updateSessionTitle: protectedProcedure
    .input(
      z.object({
        sessionId: z.string(),
        title: z.string().min(1).max(200),
      })
    )
    .mutation(async ({ ctx, input }) => {
      return ctx.prisma.chatSession.update({
        where: { id: input.sessionId },
        data: { title: input.title },
      });
    }),

  /**
   * Delete a chat session and all its messages (cascade).
   * Verifies the session belongs to the authenticated user.
   */
  deleteSession: protectedProcedure
    .input(z.object({ sessionId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      // Verify ownership before deleting
      const session = await ctx.prisma.chatSession.findFirst({
        where: {
          id: input.sessionId,
          userId: ctx.user.id,
        },
      });

      if (!session) {
        throw new Error("Chat session not found");
      }

      return ctx.prisma.chatSession.delete({
        where: { id: input.sessionId },
      });
    }),
});
