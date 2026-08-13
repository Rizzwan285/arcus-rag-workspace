import { z } from "zod";
import { createTRPCRouter, protectedProcedure } from "@/server/api/trpc";
import { TRPCError } from "@trpc/server";

export const flashcardRouter = createTRPCRouter({
  // Get all decks for the user
  getDecks: protectedProcedure.query(async ({ ctx }) => {
    return ctx.db.flashcardDeck.findMany({
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
          select: { cards: true },
        },
      },
      orderBy: { createdAt: "desc" },
    });
  }),

  // Get a specific deck with its cards
  getDeckById: protectedProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
      const deck = await ctx.db.flashcardDeck.findUnique({
        where: { id: input.id },
        include: {
          cards: true,
          document: {
            select: { userId: true, title: true },
          },
        },
      });

      if (!deck) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Deck not found" });
      }

      if (deck.document.userId !== ctx.session.user.id) {
        throw new TRPCError({ code: "FORBIDDEN", message: "Access denied" });
      }

      return deck;
    }),

  // Delete a deck
  deleteDeck: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const deck = await ctx.db.flashcardDeck.findUnique({
        where: { id: input.id },
        include: { document: { select: { userId: true } } },
      });

      if (!deck) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Deck not found" });
      }

      if (deck.document.userId !== ctx.session.user.id) {
        throw new TRPCError({ code: "FORBIDDEN", message: "Access denied" });
      }

      await ctx.db.flashcardDeck.delete({
        where: { id: input.id },
      });

      return { success: true };
    }),
});
