/**
 * Gemini Embedding Client
 *
 * Singleton wrapper around Google's text-embedding-004 model.
 * Outputs 768-dimensional vectors — matches our `vector(768)` column in DocumentChunk.
 *
 * @see ADR-006 in .claude/decisions.md
 */

import { GoogleGenerativeAIEmbeddings } from "@langchain/google-genai";

if (!process.env.GOOGLE_API_KEY) {
  throw new Error(
    "GOOGLE_API_KEY is required for embedding generation. Add it to your .env file."
  );
}

/**
 * Singleton embedding model instance.
 * Uses Gemini text-embedding-004 which outputs 768-dim vectors by default.
 */
export const embeddings = new GoogleGenerativeAIEmbeddings({
  modelName: "text-embedding-004",
  apiKey: process.env.GOOGLE_API_KEY,
});

/**
 * Generate embeddings for a single text string.
 * Returns a 768-dimensional number array.
 */
export async function embedText(text: string): Promise<number[]> {
  const result = await embeddings.embedQuery(text);
  if (result.length !== 768) {
    throw new Error(
      `Embedding dimension mismatch: expected 768, got ${result.length}`
    );
  }
  return result;
}

/**
 * Generate embeddings for multiple texts in batch.
 * More efficient than calling embedText repeatedly.
 */
export async function embedTexts(texts: string[]): Promise<number[][]> {
  const results = await embeddings.embedDocuments(texts);
  for (const result of results) {
    if (result.length !== 768) {
      throw new Error(
        `Embedding dimension mismatch: expected 768, got ${result.length}`
      );
    }
  }
  return results;
}
