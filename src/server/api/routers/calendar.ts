import { z } from "zod";
import {
  createTRPCRouter,
  protectedProcedure,
} from "@/server/api/trpc";

export const calendarRouter = createTRPCRouter({
  /**
   * Get study events within a date range.
   */
  getEvents: protectedProcedure
    .input(
      z.object({
        startDate: z.string().transform((s) => new Date(s)),
        endDate: z.string().transform((s) => new Date(s)),
      })
    )
    .query(async ({ ctx, input }) => {
      return ctx.prisma.studyEvent.findMany({
        where: {
          userId: ctx.user.id,
          date: {
            gte: input.startDate,
            lte: input.endDate,
          },
        },
        orderBy: { date: "asc" },
        include: {
          document: {
            select: { id: true, title: true },
          },
        },
      });
    }),

  /**
   * Get upcoming events (next 14 days).
   */
  getUpcoming: protectedProcedure.query(async ({ ctx }) => {
    const now = new Date();
    const twoWeeksFromNow = new Date();
    twoWeeksFromNow.setDate(twoWeeksFromNow.getDate() + 14);

    return ctx.prisma.studyEvent.findMany({
      where: {
        userId: ctx.user.id,
        date: {
          gte: now,
          lte: twoWeeksFromNow,
        },
        completed: false,
      },
      orderBy: { date: "asc" },
      take: 10,
      include: {
        document: {
          select: { id: true, title: true },
        },
      },
    });
  }),

  /**
   * Create a new study event.
   */
  createEvent: protectedProcedure
    .input(
      z.object({
        title: z.string().min(1).max(200),
        description: z.string().optional(),
        eventType: z.enum([
          "EXAM",
          "ASSIGNMENT",
          "DEADLINE",
          "LECTURE",
          "STUDY_SESSION",
          "REVIEW",
          "OTHER",
        ]),
        date: z.string().transform((s) => new Date(s)),
        endDate: z
          .string()
          .optional()
          .transform((s) => (s ? new Date(s) : undefined)),
        isAllDay: z.boolean().default(true),
        priority: z.enum(["LOW", "MEDIUM", "HIGH", "CRITICAL"]).default("MEDIUM"),
        documentId: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      return ctx.prisma.studyEvent.create({
        data: {
          userId: ctx.user.id,
          title: input.title,
          description: input.description,
          eventType: input.eventType,
          date: input.date,
          endDate: input.endDate,
          isAllDay: input.isAllDay,
          priority: input.priority,
          documentId: input.documentId,
        },
      });
    }),

  /**
   * Update a study event.
   */
  updateEvent: protectedProcedure
    .input(
      z.object({
        id: z.string(),
        title: z.string().min(1).max(200).optional(),
        description: z.string().optional(),
        eventType: z
          .enum([
            "EXAM",
            "ASSIGNMENT",
            "DEADLINE",
            "LECTURE",
            "STUDY_SESSION",
            "REVIEW",
            "OTHER",
          ])
          .optional(),
        date: z
          .string()
          .optional()
          .transform((s) => (s ? new Date(s) : undefined)),
        priority: z.enum(["LOW", "MEDIUM", "HIGH", "CRITICAL"]).optional(),
        completed: z.boolean().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      // Verify ownership
      const event = await ctx.prisma.studyEvent.findFirst({
        where: { id: input.id, userId: ctx.user.id },
      });
      if (!event) {
        throw new Error("Event not found");
      }

      const { id, ...data } = input;
      // Remove undefined values
      const updateData = Object.fromEntries(
        Object.entries(data).filter(([, v]) => v !== undefined)
      );

      return ctx.prisma.studyEvent.update({
        where: { id },
        data: updateData,
      });
    }),

  /**
   * Toggle event completion status.
   */
  toggleComplete: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const event = await ctx.prisma.studyEvent.findFirst({
        where: { id: input.id, userId: ctx.user.id },
      });
      if (!event) {
        throw new Error("Event not found");
      }

      return ctx.prisma.studyEvent.update({
        where: { id: input.id },
        data: { completed: !event.completed },
      });
    }),

  /**
   * Delete a study event.
   */
  deleteEvent: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const event = await ctx.prisma.studyEvent.findFirst({
        where: { id: input.id, userId: ctx.user.id },
      });
      if (!event) {
        throw new Error("Event not found");
      }

      return ctx.prisma.studyEvent.delete({
        where: { id: input.id },
      });
    }),

  /**
   * Get event statistics for the dashboard.
   */
  getStats: protectedProcedure.query(async ({ ctx }) => {
    const now = new Date();
    const [totalEvents, upcomingExams, pendingTasks, completedTasks] =
      await Promise.all([
        ctx.prisma.studyEvent.count({
          where: { userId: ctx.user.id },
        }),
        ctx.prisma.studyEvent.count({
          where: {
            userId: ctx.user.id,
            eventType: "EXAM",
            date: { gte: now },
          },
        }),
        ctx.prisma.studyEvent.count({
          where: {
            userId: ctx.user.id,
            completed: false,
            date: { gte: now },
          },
        }),
        ctx.prisma.studyEvent.count({
          where: {
            userId: ctx.user.id,
            completed: true,
          },
        }),
      ]);

    return {
      totalEvents,
      upcomingExams,
      pendingTasks,
      completedTasks,
    };
  }),
});
