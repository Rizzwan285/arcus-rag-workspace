import { createTRPCRouter, createCallerFactory } from "@/server/api/trpc";
import { documentRouter } from "@/server/api/routers/document";
import { chatRouter } from "@/server/api/routers/chat";
import { studyRouter } from "@/server/api/routers/study";

/**
 * Root tRPC Router
 * All sub-routers are merged here
 */
export const appRouter = createTRPCRouter({
  document: documentRouter,
  chat: chatRouter,
  study: studyRouter,
});

export type AppRouter = typeof appRouter;

export const createCaller = createCallerFactory(appRouter);
