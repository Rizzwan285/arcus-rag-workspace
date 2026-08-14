/**
 * Gemini Embedding Client
 *
 * Uses Google's Generative AI REST API directly for text-embedding-004.
 * Outputs 768-dimensional vectors — matches our `vector(768)` column in DocumentChunk.
 *
 * We call the REST API directly instead of going through LangChain's wrapper
 * to avoid compatibility issues with @langchain/google-genai v2.
 *
 * @see ADR-006 in .claude/decisions.md
 */

const GOOGLE_API_KEY = process.env.GOOGLE_API_KEY;
const EMBEDDING_MODEL = "text-embedding-004";
const EMBEDDING_API_URL = `https://generativelanguage.googleapis.com/v1beta/models/${EMBEDDING_MODEL}:batchEmbedContents?key=${GOOGLE_API_KEY}`;

if (!GOOGLE_API_KEY) {
  console.warn(
    "GOOGLE_API_KEY is not set. Embedding generation will fail at runtime."
  );
}

/**
 * Generate embeddings for a single text string.
 * Returns a 768-dimensional number array.
 */
export async function embedText(text: string): Promise<number[]> {
  const results = await embedTexts([text]);
  return results[0];
}

/**
 * Generate embeddings for multiple texts in batch.
 * Uses the batchEmbedContents endpoint for efficiency.
 */
export async function embedTexts(texts: string[]): Promise<number[][]> {
  if (texts.length === 0) return [];

  const requests = texts.map((text) => ({
    model: `models/${EMBEDDING_MODEL}`,
    content: { parts: [{ text }] },
  }));

  const response = await fetch(EMBEDDING_API_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ requests }),
  });

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(
      `Embedding API error (${response.status}): ${errorBody}`
    );
  }

  const data = await response.json();

  if (!data.embeddings || data.embeddings.length !== texts.length) {
    throw new Error(
      `Embedding response mismatch: expected ${texts.length} embeddings, got ${data.embeddings?.length ?? 0}`
    );
  }

  const results: number[][] = data.embeddings.map(
    (e: { values: number[] }) => e.values
  );

  // Validate dimensions
  for (const result of results) {
    if (result.length !== 768) {
      throw new Error(
        `Embedding dimension mismatch: expected 768, got ${result.length}`
      );
    }
  }

  return results;
}
