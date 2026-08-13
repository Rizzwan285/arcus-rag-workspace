/**
 * AI SDK Tool Definitions for Phase 5
 *
 * These tools are called by the LLM during chat to perform structured
 * actions like extracting dates, creating study events, and generating
 * study plans. Each tool executes server-side with database access.
 *
 * Uses zodSchema() wrapper for Zod v4 compatibility with AI SDK v6.
 *
 * @see ADR-013 in .claude/decisions.md
 */

import { tool } from "ai";
import { z } from "zod";
import { prisma } from "@/server/db/prisma";
import type { StudyEventType, EventPriority } from "@/generated/prisma/client";

/**
 * Creates tools bound to a specific user context.
 * Each tool function receives the userId for scoped database operations.
 */
export function createChatTools(userId: string) {
  return {
    /**
     * Extract academic dates/deadlines from the conversation context.
     * The LLM identifies dates mentioned in documents (exams, assignments,
     * deadlines) and persists them as StudyEvents.
     */
    extractDates: tool({
      description:
        "Extract academic dates and deadlines from the document context. " +
        "Use this when the user asks to find dates, deadlines, exams, or " +
        "assignment due dates from their documents. Returns the extracted " +
        "events that were saved to the user's study calendar.",
      inputSchema: z.object({
        events: z
          .array(
            z.object({
              title: z.string().describe("Short title for the event"),
              description: z
                .string()
                .optional()
                .describe("Additional details about the event"),
              eventType: z
                .enum([
                  "EXAM",
                  "ASSIGNMENT",
                  "DEADLINE",
                  "LECTURE",
                  "OTHER",
                ])
                .describe("The type of academic event"),
              date: z
                .string()
                .describe(
                  "ISO 8601 date string (YYYY-MM-DD or YYYY-MM-DDTHH:mm:ss)"
                ),
              priority: z
                .enum(["LOW", "MEDIUM", "HIGH", "CRITICAL"])
                .describe("Priority level of the event"),
            })
          )
          .describe("Array of academic events extracted from the context"),
      }),
      execute: async ({ events }: { events: Array<{ title: string; description?: string; eventType: string; date: string; priority: string; }> }) => {
        const savedEvents = [];

        for (const event of events) {
          try {
            const saved = await prisma.studyEvent.create({
              data: {
                userId,
                title: event.title,
                description: event.description,
                eventType: event.eventType as StudyEventType,
                date: new Date(event.date),
                isAllDay: !event.date.includes("T"),
                priority: event.priority as EventPriority,
              },
            });
            savedEvents.push({
              id: saved.id,
              title: saved.title,
              date: saved.date.toISOString(),
              eventType: saved.eventType,
            });
          } catch (err) {
            console.error("Failed to save event:", event.title, err);
          }
        }

        return {
          success: true,
          savedCount: savedEvents.length,
          events: savedEvents,
          message: `Successfully saved ${savedEvents.length} event(s) to your study calendar.`,
        };
      },
    }),

    /**
     * Add a single study event from a user's natural language request.
     * e.g. "Remind me to review Chapter 5 on Friday"
     */
    addStudyEvent: tool({
      description:
        "Add a study event or reminder to the user's calendar. " +
        "Use this when the user asks to schedule something, add a reminder, " +
        "or create a study session. Always infer the best event type.",
      inputSchema: z.object({
        title: z.string().describe("Title for the study event"),
        description: z
          .string()
          .optional()
          .describe("Optional description or notes"),
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
          .describe("Type of study event"),
        date: z
          .string()
          .describe(
            "ISO 8601 date string for when the event should occur"
          ),
        endDate: z
          .string()
          .optional()
          .describe("Optional end date for multi-day or timed events"),
        priority: z
          .enum(["LOW", "MEDIUM", "HIGH", "CRITICAL"])
          .default("MEDIUM")
          .describe("Priority level"),
      }),
      execute: async ({
        title,
        description,
        eventType,
        date,
        endDate,
        priority,
      }: {
        title: string;
        description?: string;
        eventType: string;
        date: string;
        endDate?: string;
        priority: string;
      }) => {
        try {
          const event = await prisma.studyEvent.create({
            data: {
              userId,
              title,
              description,
              eventType: eventType as StudyEventType,
              date: new Date(date),
              endDate: endDate ? new Date(endDate) : undefined,
              isAllDay: !date.includes("T"),
              priority: (priority || "MEDIUM") as EventPriority,
            },
          });

          return {
            success: true,
            event: {
              id: event.id,
              title: event.title,
              date: event.date.toISOString(),
              eventType: event.eventType,
              priority: event.priority,
            },
            message: `"${title}" has been added to your calendar for ${new Date(date).toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" })}.`,
          };
        } catch (err) {
          console.error("Failed to create study event:", err);
          return {
            success: false,
            message: "Failed to create the study event. Please try again.",
          };
        }
      },
    }),

    /**
     * Generate a study plan with spaced repetition sessions leading up to
     * an exam or deadline. Creates multiple StudyEvents.
     */
    createStudyPlan: tool({
      description:
        "Generate an optimized study plan with multiple study sessions " +
        "leading up to an exam or deadline. The plan uses spaced repetition " +
        "principles. Use when the user asks to create a study schedule, " +
        "plan for an exam, or organize their study time.",
      inputSchema: z.object({
        examTitle: z
          .string()
          .describe("Title of the exam or goal to prepare for"),
        examDate: z
          .string()
          .describe("ISO 8601 date of the exam/deadline"),
        topics: z
          .array(z.string())
          .describe("List of topics/chapters to study"),
        dailyStudyHours: z
          .number()
          .default(2)
          .describe(
            "Hours per day the student can dedicate to studying"
          ),
        startDate: z
          .string()
          .optional()
          .describe(
            "When to start studying (defaults to today if not specified)"
          ),
      }),
      execute: async ({
        examTitle,
        examDate,
        topics,
        dailyStudyHours,
        startDate,
      }: {
        examTitle: string;
        examDate: string;
        topics: string[];
        dailyStudyHours: number;
        startDate?: string;
      }) => {
        try {
          const exam = new Date(examDate);
          const start = startDate ? new Date(startDate) : new Date();
          const daysUntilExam = Math.max(
            1,
            Math.ceil(
              (exam.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)
            )
          );

          // Create the exam event itself
          await prisma.studyEvent.create({
            data: {
              userId,
              title: examTitle,
              eventType: "EXAM",
              date: exam,
              isAllDay: true,
              priority: "CRITICAL",
            },
          });

          // Distribute topics across available days using spaced repetition
          const sessions: Array<{
            title: string;
            date: Date;
            description: string;
            eventType: StudyEventType;
            priority: EventPriority;
          }> = [];

          // Initial study sessions: spread topics evenly
          const daysForNewMaterial = Math.ceil(daysUntilExam * 0.6);
          const topicsPerDay = Math.max(
            1,
            Math.ceil(topics.length / daysForNewMaterial)
          );

          let topicIndex = 0;
          for (
            let day = 0;
            day < daysForNewMaterial && topicIndex < topics.length;
            day++
          ) {
            const sessionDate = new Date(start);
            sessionDate.setDate(sessionDate.getDate() + day);

            const dayTopics = topics.slice(
              topicIndex,
              topicIndex + topicsPerDay
            );
            topicIndex += topicsPerDay;

            sessions.push({
              title: `Study: ${dayTopics.join(", ")}`,
              date: sessionDate,
              description: `Focus on: ${dayTopics.join(", ")}\nEstimated time: ${dailyStudyHours}h\nFor: ${examTitle}`,
              eventType: "STUDY_SESSION",
              priority: "MEDIUM",
            });
          }

          // Review sessions in the remaining days (spaced repetition)
          const reviewDays = daysUntilExam - daysForNewMaterial;
          if (reviewDays > 0) {
            // First review: cover first half of topics
            const firstReviewDate = new Date(start);
            firstReviewDate.setDate(
              firstReviewDate.getDate() + daysForNewMaterial
            );
            sessions.push({
              title: `Review: ${topics.slice(0, Math.ceil(topics.length / 2)).join(", ")}`,
              date: firstReviewDate,
              description: `Review session for: ${examTitle}\nCover first half of material`,
              eventType: "REVIEW",
              priority: "HIGH",
            });

            // Second review: cover second half
            if (reviewDays > 1) {
              const secondReviewDate = new Date(start);
              secondReviewDate.setDate(
                secondReviewDate.getDate() +
                  daysForNewMaterial +
                  Math.floor(reviewDays / 2)
              );
              sessions.push({
                title: `Review: ${topics.slice(Math.ceil(topics.length / 2)).join(", ")}`,
                date: secondReviewDate,
                description: `Review session for: ${examTitle}\nCover second half of material`,
                eventType: "REVIEW",
                priority: "HIGH",
              });
            }

            // Final review: day before exam
            const finalReviewDate = new Date(exam);
            finalReviewDate.setDate(finalReviewDate.getDate() - 1);
            if (finalReviewDate > start) {
              sessions.push({
                title: `Final Review: All topics for ${examTitle}`,
                date: finalReviewDate,
                description: `Final comprehensive review before ${examTitle}\nAll topics: ${topics.join(", ")}`,
                eventType: "REVIEW",
                priority: "CRITICAL",
              });
            }
          }

          // Save all sessions to database
          const savedSessions = [];
          for (const session of sessions) {
            const saved = await prisma.studyEvent.create({
              data: {
                userId,
                title: session.title,
                description: session.description,
                eventType: session.eventType,
                date: session.date,
                isAllDay: true,
                priority: session.priority,
              },
            });
            savedSessions.push({
              id: saved.id,
              title: saved.title,
              date: saved.date.toISOString().split("T")[0],
              eventType: saved.eventType,
            });
          }

          return {
            success: true,
            examDate: examDate,
            totalSessions: savedSessions.length + 1, // +1 for exam
            studySessions: savedSessions.filter(
              (s) => s.eventType === "STUDY_SESSION"
            ).length,
            reviewSessions: savedSessions.filter(
              (s) => s.eventType === "REVIEW"
            ).length,
            sessions: savedSessions,
            message: `Study plan created for "${examTitle}"! ${savedSessions.length} study/review sessions have been added to your calendar leading up to ${new Date(examDate).toLocaleDateString("en-US", { month: "long", day: "numeric" })}.`,
          };
        } catch (err) {
          console.error("Failed to create study plan:", err);
          return {
            success: false,
            message: "Failed to create the study plan. Please try again.",
          };
        }
      },
    }),

    /**
     * Extract key topics/concepts from the document context.
     * Useful for generating study plans or flashcard suggestions.
     */
    extractKeyTopics: tool({
      description:
        "Extract the main topics, concepts, and key themes from the " +
        "document context. Use when the user asks what topics are covered, " +
        "wants a topic overview, or needs to identify study areas.",
      inputSchema: z.object({
        topics: z
          .array(
            z.object({
              name: z.string().describe("Topic or concept name"),
              description: z
                .string()
                .describe("Brief description of the topic"),
              importance: z
                .enum(["essential", "important", "supplementary"])
                .describe("How important this topic is"),
            })
          )
          .describe("Array of key topics extracted from the context"),
      }),
      execute: async ({ topics }: { topics: Array<{ name: string; description: string; importance: string; }> }) => {
        // This tool is informational — it returns data for the LLM to
        // present to the user. No database persistence needed.
        return {
          success: true,
          topicCount: topics.length,
          topics,
          message: `Found ${topics.length} key topic(s) in your documents.`,
        };
      },
    }),
  };
}
