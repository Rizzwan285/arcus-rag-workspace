import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/server/auth";
import { prisma } from "@/server/db/prisma";
import { google } from "@ai-sdk/google";
import { generateObject } from "ai";
import { z } from "zod";

export const maxDuration = 60; // Allow more time for generation

const requestSchema = z.object({
  documentId: z.string(),
  type: z.enum(["flashcards", "quiz"]),
});

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const json = await req.json();
    const result = requestSchema.safeParse(json);
    if (!result.success) {
      return NextResponse.json(
        { error: "Invalid request body", details: result.error },
        { status: 400 }
      );
    }

    const { documentId, type } = result.data;

    // Verify document belongs to user
    const document = await prisma.document.findFirst({
      where: { id: documentId, userId: session.user.id },
      include: {
        chunks: {
          take: 10, // Retrieve top 10 chunks to base the generation on
          orderBy: { chunkIndex: "asc" },
        },
      },
    });

    if (!document) {
      return NextResponse.json({ error: "Document not found" }, { status: 404 });
    }

    const contextText = document.chunks.map((c) => c.content).join("\n\n");
    if (!contextText) {
      return NextResponse.json({ error: "Document has no content yet" }, { status: 400 });
    }

    const systemPrompt = `You are an expert academic tutor.
Generate study materials based strictly on the provided document context.
Do not hallucinate or use outside knowledge.
Document Title: ${document.title}
Context:
${contextText}`;

    if (type === "flashcards") {
      const { object } = await generateObject({
        model: google("gemini-1.5-pro-latest"),
        system: systemPrompt,
        prompt: "Create a flashcard deck of 10 essential concepts from this document.",
        schema: z.object({
          title: z.string().describe("A good title for this flashcard deck"),
          flashcards: z.array(
            z.object({
              front: z.string().describe("The concept, question, or term (front of card)"),
              back: z.string().describe("The explanation, answer, or definition (back of card)"),
            })
          ).min(5).max(15),
        }),
      });

      // Save to database
      const deck = await prisma.flashcardDeck.create({
        data: {
          title: object.title,
          documentId,
          cards: {
            create: object.flashcards,
          },
        },
      });

      return NextResponse.json({ success: true, deckId: deck.id });
    } else {
      // type === "quiz"
      const { object } = await generateObject({
        model: google("gemini-1.5-pro-latest"),
        system: systemPrompt,
        prompt: "Create a multiple-choice quiz with 5-10 questions to test knowledge of this document.",
        schema: z.object({
          title: z.string().describe("A suitable title for this quiz"),
          questions: z.array(
            z.object({
              question: z.string(),
              options: z.array(z.string()).length(4).describe("Exactly 4 options"),
              correctAnswer: z.string().describe("Must exactly match one of the options"),
              explanation: z.string().describe("Explanation for why the answer is correct"),
            })
          ).min(5).max(10),
        }),
      });

      // Validate correct answers exist in options
      const validQuestions = object.questions.map((q) => {
        if (!q.options.includes(q.correctAnswer)) {
          // Fallback if model made a mistake
          return { ...q, correctAnswer: q.options[0] };
        }
        return q;
      });

      // Save to database
      const quiz = await prisma.quiz.create({
        data: {
          title: object.title,
          documentId,
          questions: {
            create: validQuestions,
          },
        },
      });

      return NextResponse.json({ success: true, quizId: quiz.id });
    }
  } catch (error) {
    console.error("Generation error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
