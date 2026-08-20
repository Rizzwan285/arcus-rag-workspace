import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { createTRPCRouter, protectedProcedure } from "@/server/api/trpc";

export const accountRouter = createTRPCRouter({
  /**
   * Permanently delete the signed-in user and everything they own.
   *
   * Every relation from `User` cascades on delete, so removing the row takes
   * documents, chunks, ingestion runs, chat history, study modules, calendar
   * events, and OAuth sessions with it in a single statement.
   *
   * Requires the caller to echo back "DELETE" — a deliberate speed bump on an
   * action with no undo.
   */
  deleteAccount: protectedProcedure
    .input(z.object({ confirmation: z.literal("DELETE") }))
    .mutation(async ({ ctx }) => {
      try {
        await ctx.prisma.user.delete({ where: { id: ctx.user.id } });
      } catch {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Account deletion failed. Nothing was removed.",
        });
      }
      return { deleted: true };
    }),
});
