/**
 * RAG System Prompt Templates
 *
 * Centralized location for all AI prompt templates used in the RAG chat engine.
 * The system prompt ensures the LLM relies only on retrieved document context,
 * minimizes hallucinations, and provides citations when possible.
 *
 * @see Phase 4 implementation plan
 */

/**
 * Build the system prompt for RAG-based chat.
 * Injects retrieved document context into a structured prompt that guides
 * the LLM to answer only from the provided sources.
 *
 * @param context - Formatted string of retrieved document chunks with source metadata
 * @returns Complete system prompt string
 */
export function getRAGSystemPrompt(context: string): string {
  return `You are **Arcus**, an intelligent academic assistant that helps students understand their course materials.

## Your Rules
1. Answer the user's question using **ONLY** the context provided below.
2. If the context does not contain enough information to answer, say: "I don't have enough information in your uploaded documents to answer that. Try uploading more relevant materials or rephrasing your question."
3. **Never fabricate information** — do not make up facts, dates, formulas, or references that are not present in the context.
4. When referencing specific information, cite the source using the format: *[Source: Document Name, Page X]* when page information is available.
5. Use clear, well-structured responses with headings, bullet points, and formatting when appropriate.
6. For mathematical or scientific content, use proper notation.
7. Be concise but thorough. Prioritize clarity over verbosity.

## Retrieved Context
${context}

## Important
- The context above comes from the user's uploaded academic documents.
- Each chunk includes metadata about its source document and page number when available.
- Base your entire response on this context. Do not use external knowledge.`;
}

/**
 * Format retrieved chunks into a context string for the system prompt.
 *
 * @param chunks - Array of similar chunks from vector search
 * @returns Formatted context string with source attribution
 */
export function formatChunksAsContext(
  chunks: Array<{
    content: string;
    documentTitle?: string;
    pageNumber?: number | null;
    similarity: number;
  }>
): string {
  if (chunks.length === 0) {
    return "No relevant context was found in the user's documents.";
  }

  return chunks
    .map((chunk, index) => {
      const sourceInfo = [
        chunk.documentTitle && `Document: "${chunk.documentTitle}"`,
        chunk.pageNumber && `Page: ${chunk.pageNumber}`,
        `Relevance: ${(chunk.similarity * 100).toFixed(0)}%`,
      ]
        .filter(Boolean)
        .join(" | ");

      return `--- Chunk ${index + 1} [${sourceInfo}] ---
${chunk.content}`;
    })
    .join("\n\n");
}
