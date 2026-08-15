/**
 * RAG Chat Streaming Endpoint
 *
 * Next.js Route Handler that implements the full RAG pipeline:
 * 1. Validates user session (NextAuth)
 * 2. Extracts the last user message
 * 3. Performs vector similarity search on pgvector
 * 4. Injects retrieved context into a system prompt
 * 5. Streams the response from Gemini via Vercel AI SDK v6
 * 6. Saves messages to the database on stream completion
 *
 * Uses standard Route Handler (not tRPC) because Vercel AI SDK
 * requires it for optimal streaming.
 *
 * @see Phase 4 implementation plan
 * @see ADR-011 in .claude/decisions.md
 */

import { google } from "@ai-sdk/google";
import {
  streamText,
  convertToModelMessages,
  type UIMessage,
} from "ai";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/server/db/prisma";
import { searchSimilarChunks } from "@/lib/langchain/vector-search";
import {
  getRAGSystemPrompt,
  formatChunksAsContext,
} from "@/lib/langchain/prompts";
import { createChatTools } from "@/lib/ai/tools";

export const maxDuration = 60; // Allow up to 60s for LLM generation

export async function POST(req: Request) {
  try {
    // 1. Validate user session
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return new Response("Unauthorized", { status: 401 });
    }

    const userId = session.user.id;

    // 2. Parse request body (AI SDK v6 sends UIMessages)
    const body = await req.json();
    const { messages: rawMessages, sessionId } = body as {
      messages: UIMessage[];
      sessionId?: string;
    };

    if (!rawMessages || rawMessages.length === 0) {
      return new Response("No messages provided", { status: 400 });
    }

    // Get the last user message text from parts
    const lastUserMessage = rawMessages.findLast(
      (m: UIMessage) => m.role === "user"
    );
    if (!lastUserMessage) {
      return new Response("No user message found", { status: 400 });
    }

    // Extract text content from parts
    const lastUserText = lastUserMessage.parts
      .filter((p): p is { type: "text"; text: string } => p.type === "text")
      .map((p) => p.text)
      .join("\n");

    if (!lastUserText.trim()) {
      return new Response("Empty user message", { status: 400 });
    }

    // 3. Perform vector similarity search
    const similarChunks = await searchSimilarChunks(
      lastUserText,
      userId,
      5, // top 5 chunks
      0.25 // lower threshold to be more inclusive
    );

    // Fetch document titles for context attribution
    const documentIds = [
      ...new Set(similarChunks.map((c) => c.documentId)),
    ];
    const documents =
      documentIds.length > 0
        ? await prisma.document.findMany({
            where: { id: { in: documentIds } },
            select: { id: true, title: true },
          })
        : [];

    const docTitleMap = new Map(documents.map((d) => [d.id, d.title]));

    // 4. Format context and build system prompt
    const contextChunks = similarChunks.map((chunk) => ({
      content: chunk.content,
      documentTitle: docTitleMap.get(chunk.documentId),
      pageNumber: chunk.pageNumber,
      similarity: chunk.similarity,
    }));

    const contextString = formatChunksAsContext(contextChunks);
    const systemPrompt = getRAGSystemPrompt(contextString);

    // Build source references for saving with the AI message
    const sources = similarChunks.map((chunk) => ({
      chunkId: chunk.id,
      documentId: chunk.documentId,
      documentTitle: docTitleMap.get(chunk.documentId) || "Unknown",
      pageNumber: chunk.pageNumber,
      similarity: chunk.similarity,
      preview: chunk.content.substring(0, 150) + "...",
    }));

    // 5. Convert UI messages to model messages for the LLM
    const modelMessages = await convertToModelMessages(rawMessages);

    // 6. Stream the response from Gemini with tool calling
    const chatTools = createChatTools(userId);

    const result = streamText({
      model: google("gemini-3.7-flash"),
      system: systemPrompt,
      messages: modelMessages,
      tools: chatTools,
      onFinish: async ({ text }) => {
        // 7. Save messages to database on completion
        if (sessionId) {
          try {
            // Save the user message
            await prisma.chatMessage.create({
              data: {
                sessionId,
                role: "USER",
                content: lastUserText,
              },
            });

            // Save the AI response with source references
            await prisma.chatMessage.create({
              data: {
                sessionId,
                role: "AI",
                content: text,
                sources: sources.length > 0 ? sources : undefined,
              },
            });

            // Update session's updatedAt timestamp
            await prisma.chatSession.update({
              where: { id: sessionId },
              data: { updatedAt: new Date() },
            });
          } catch (dbError) {
            console.error("Failed to save chat messages:", dbError);
          }
        }
      },
    });

    // 8. Return as UIMessage streaming response (AI SDK v6)
    return result.toUIMessageStreamResponse();
  } catch (error) {
    console.error("Chat API error:", error);
    return new Response(
      JSON.stringify({
        error: "An error occurred while processing your request.",
      }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
}
