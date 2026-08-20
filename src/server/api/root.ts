import { createTRPCRouter, createCallerFactory } from "@/server/api/trpc";
import { documentRouter } from "@/server/api/routers/document";
import { chatRouter } from "@/server/api/routers/chat";
import { calendarRouter } from "@/server/api/routers/calendar";
import { flashcardRouter } from "@/server/api/routers/flashcard";
import { quizRouter } from "@/server/api/routers/quiz";
import { accountRouter } from "@/server/api/routers/account";

/**
 * Root tRPC Router
 * All sub-routers are merged here
 */
export const appRouter = createTRPCRouter({
  document: documentRouter,
  chat: chatRouter,
  calendar: calendarRouter,
  flashcard: flashcardRouter,
  quiz: quizRouter,
  account: accountRouter,
});

export type AppRouter = typeof appRouter;

export const createCaller = createCallerFactory(appRouter);
