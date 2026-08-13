/**
 * Vector Similarity Search
 *
 * Uses pgvector's cosine distance operator (`<=>`) to find the most
 * semantically similar document chunks to a query.
 *
 * Uses raw SQL via Prisma's $queryRaw because Prisma doesn't natively
 * support pgvector operations.
 *
 * @see ADR-004 in .claude/decisions.md
 */

import { prisma } from "@/server/db/prisma";
import { embedText } from "./embeddings";
import { Prisma } from "@/generated/prisma/client";

/** Result from a vector similarity search */
export interface SimilarChunk {
  id: string;
  documentId: string;
  content: string;
  metadata: Record<string, unknown> | null;
  pageNumber: number | null;
  chunkIndex: number;
  similarity: number;
}

/**
 * Search for document chunks semantically similar to a query string.
 *
 * @param query - Natural language query text
 * @param userId - ID of the user whose documents to search
 * @param limit - Maximum number of results to return (default: 5)
 * @param minSimilarity - Minimum cosine similarity threshold (default: 0.3)
 * @returns Array of similar chunks sorted by relevance
 */
export async function searchSimilarChunks(
  query: string,
  userId: string,
  limit: number = 5,
  minSimilarity: number = 0.3
): Promise<SimilarChunk[]> {
  // 1. Convert the query to an embedding vector
  const queryEmbedding = await embedText(query);

  // 2. Format the embedding as a pgvector-compatible string
  const vectorStr = `[${queryEmbedding.join(",")}]`;

  // 3. Execute cosine similarity search using raw SQL
  const results = await prisma.$queryRaw<SimilarChunk[]>`
    SELECT 
      dc.id,
      dc."documentId",
      dc.content,
      dc.metadata,
      dc."pageNumber",
      dc."chunkIndex",
      1 - (dc.embedding <=> ${vectorStr}::vector) AS similarity
    FROM "DocumentChunk" dc
    INNER JOIN "Document" d ON dc."documentId" = d.id
    WHERE d."userId" = ${userId}
      AND d.status = 'COMPLETED'
      AND 1 - (dc.embedding <=> ${vectorStr}::vector) >= ${minSimilarity}
    ORDER BY dc.embedding <=> ${vectorStr}::vector
    LIMIT ${limit}
  `;

  return results;
}

/**
 * Search for similar chunks within a specific document.
 */
export async function searchWithinDocument(
  query: string,
  documentId: string,
  userId: string,
  limit: number = 5
): Promise<SimilarChunk[]> {
  const queryEmbedding = await embedText(query);
  const vectorStr = `[${queryEmbedding.join(",")}]`;

  const results = await prisma.$queryRaw<SimilarChunk[]>`
    SELECT 
      dc.id,
      dc."documentId",
      dc.content,
      dc.metadata,
      dc."pageNumber",
      dc."chunkIndex",
      1 - (dc.embedding <=> ${vectorStr}::vector) AS similarity
    FROM "DocumentChunk" dc
    INNER JOIN "Document" d ON dc."documentId" = d.id
    WHERE dc."documentId" = ${documentId}
      AND d."userId" = ${userId}
    ORDER BY dc.embedding <=> ${vectorStr}::vector
    LIMIT ${limit}
  `;

  return results;
}
