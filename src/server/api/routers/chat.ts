import { z } from "zod";
import { createTRPCRouter, publicProcedure } from "@/server/api/trpc";

export const chatRouter = createTRPCRouter({
  /**
   * Get all chat sessions for a user
   */
  getSessions: publicProcedure
    .input(z.object({ userId: z.string().optional() }))
    .query(async ({ ctx, input }) => {
      return ctx.prisma.chatSession.findMany({
        where: input.userId ? { userId: input.userId } : undefined,
        orderBy: { updatedAt: "desc" },
        include: {
          _count: { select: { messages: true } },
        },
      });
    }),

  /**
   * Get messages for a chat session
   */
  getMessages: publicProcedure
    .input(
      z.object({
        sessionId: z.string(),
        limit: z.number().min(1).max(100).default(50),
        cursor: z.string().optional(),
      })
    )
    .query(async ({ ctx, input }) => {
      const messages = await ctx.prisma.chatMessage.findMany({
        where: { sessionId: input.sessionId },
        orderBy: { createdAt: "asc" },
        take: input.limit + 1,
        cursor: input.cursor ? { id: input.cursor } : undefined,
      });

      let nextCursor: string | undefined;
      if (messages.length > input.limit) {
        const nextItem = messages.pop();
        nextCursor = nextItem?.id;
      }

      return { messages, nextCursor };
    }),

  /**
   * Create a new chat session
   */
  createSession: publicProcedure
    .input(
      z.object({
        userId: z.string(),
        title: z.string().default("New Chat"),
      })
    )
    .mutation(async ({ ctx, input }) => {
      return ctx.prisma.chatSession.create({
        data: input,
      });
    }),

  /**
   * Add a message to a chat session
   */
  addMessage: publicProcedure
    .input(
      z.object({
        sessionId: z.string(),
        role: z.enum(["USER", "AI", "SYSTEM"]),
        content: z.string(),
        sources: z.any().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      // Update session's updatedAt timestamp
      await ctx.prisma.chatSession.update({
        where: { id: input.sessionId },
        data: { updatedAt: new Date() },
      });

      return ctx.prisma.chatMessage.create({
        data: input,
      });
    }),

  /**
   * Delete a chat session
   */
  deleteSession: publicProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      return ctx.prisma.chatSession.delete({
        where: { id: input.id },
      });
    }),
});
