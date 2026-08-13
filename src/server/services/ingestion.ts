/**
 * Document Ingestion Pipeline
 *
 * Core orchestrator that transforms uploaded PDFs into searchable vector embeddings.
 * Flow: fetchPDF → parse → chunk → embed (batched) → store → update status
 *
 * Uses fire-and-forget pattern from onUploadComplete for local dev.
 * For production (Vercel), migrate to Inngest or a job queue.
 *
 * @see Phase 3 Implementation Plan
 * @see ADR-004, ADR-005, ADR-006 in .claude/decisions.md
 */

import { prisma } from "@/server/db/prisma";
import { loadAndChunkPDF, type ChunkedDocument } from "@/lib/langchain/document-loader";
import { embedTexts } from "@/lib/langchain/embeddings";

/** Batch size for embedding API calls to avoid Gemini rate limits */
const EMBEDDING_BATCH_SIZE = 50;

/** Delay between embedding batches (ms) to respect rate limits */
const BATCH_DELAY_MS = 500;

/**
 * Main ingestion entry point.
 * Takes a document ID and its file URL, processes the entire pipeline.
 *
 * @param documentId - The database ID of the Document record
 * @param fileUrl - The UploadThing URL to fetch the PDF from
 */
export async function ingestDocument(
  documentId: string,
  fileUrl: string
): Promise<void> {
  console.log(`[Ingestion] Starting for document: ${documentId}`);

  try {
    // ── Step 1: Set status to PROCESSING ──
    await prisma.document.update({
      where: { id: documentId },
      data: { status: "PROCESSING" },
    });

    // ── Step 2: Fetch the PDF from UploadThing ──
    console.log(`[Ingestion] Fetching PDF from: ${fileUrl}`);
    const pdfBuffer = await fetchPDF(fileUrl);
    console.log(`[Ingestion] PDF fetched: ${(pdfBuffer.length / 1024).toFixed(1)} KB`);

    // ── Step 3: Parse PDF and split into chunks ──
    console.log(`[Ingestion] Parsing and chunking PDF...`);
    const chunks = await loadAndChunkPDF(pdfBuffer);
    console.log(`[Ingestion] Generated ${chunks.length} chunks`);

    if (chunks.length === 0) {
      throw new Error("No text could be extracted from the PDF");
    }

    // ── Step 4: Generate embeddings in batches ──
    console.log(`[Ingestion] Generating embeddings in batches of ${EMBEDDING_BATCH_SIZE}...`);
    const allEmbeddings = await generateEmbeddingsInBatches(
      chunks.map((c) => c.content)
    );
    console.log(`[Ingestion] Generated ${allEmbeddings.length} embeddings`);

    // ── Step 5: Store chunks + embeddings in pgvector ──
    console.log(`[Ingestion] Storing chunks in database...`);
    await storeChunksWithEmbeddings(documentId, chunks, allEmbeddings);

    // ── Step 6: Update document status to COMPLETED ──
    const pageCount =
      chunks.length > 0
        ? Math.max(...chunks.map((c) => c.pageNumber)) + 1
        : 0;

    await prisma.document.update({
      where: { id: documentId },
      data: {
        status: "COMPLETED",
        pageCount,
      },
    });

    console.log(
      `[Ingestion] ✅ Completed for document ${documentId}: ${chunks.length} chunks, ${pageCount} pages`
    );
  } catch (error) {
    // ── Error: Set status to FAILED ──
    console.error(`[Ingestion] ❌ Failed for document ${documentId}:`, error);

    await prisma.document.update({
      where: { id: documentId },
      data: { status: "FAILED" },
    });

    throw error; // Re-throw for the caller's .catch() handler
  }
}

/**
 * Fetch a PDF file from a URL and return it as a Buffer.
 */
async function fetchPDF(url: string): Promise<Buffer> {
  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(`Failed to fetch PDF: ${response.status} ${response.statusText}`);
  }

  const arrayBuffer = await response.arrayBuffer();
  return Buffer.from(arrayBuffer);
}

/**
 * Generate embeddings in batches to avoid Gemini API rate limits.
 * Processes EMBEDDING_BATCH_SIZE texts at a time with delays between batches.
 */
async function generateEmbeddingsInBatches(
  texts: string[]
): Promise<number[][]> {
  const allEmbeddings: number[][] = [];

  for (let i = 0; i < texts.length; i += EMBEDDING_BATCH_SIZE) {
    const batch = texts.slice(i, i + EMBEDDING_BATCH_SIZE);
    const batchNum = Math.floor(i / EMBEDDING_BATCH_SIZE) + 1;
    const totalBatches = Math.ceil(texts.length / EMBEDDING_BATCH_SIZE);

    console.log(`[Ingestion] Embedding batch ${batchNum}/${totalBatches} (${batch.length} chunks)`);

    try {
      const batchEmbeddings = await embedTexts(batch);
      allEmbeddings.push(...batchEmbeddings);
    } catch (error) {
      // Retry once with exponential backoff
      console.warn(`[Ingestion] Batch ${batchNum} failed, retrying in 2s...`);
      await delay(2000);

      const batchEmbeddings = await embedTexts(batch);
      allEmbeddings.push(...batchEmbeddings);
    }

    // Delay between batches to respect rate limits (skip after last batch)
    if (i + EMBEDDING_BATCH_SIZE < texts.length) {
      await delay(BATCH_DELAY_MS);
    }
  }

  return allEmbeddings;
}

/**
 * Store document chunks with their embeddings in the database.
 * Uses Prisma's $executeRaw for pgvector INSERT operations.
 *
 * @see ADR-004 — Prisma doesn't natively support pgvector types
 */
async function storeChunksWithEmbeddings(
  documentId: string,
  chunks: ChunkedDocument[],
  embeddings: number[][]
): Promise<void> {
  // Insert chunks one at a time using raw SQL for vector type support
  // (Prisma's createMany doesn't support Unsupported types)
  for (let i = 0; i < chunks.length; i++) {
    const chunk = chunks[i];
    const embedding = embeddings[i];
    const id = generateCUID();
    const vectorStr = `[${embedding.join(",")}]`;
    const metadataJson = JSON.stringify(chunk.metadata);

    await prisma.$executeRaw`
      INSERT INTO "DocumentChunk" (id, "documentId", content, metadata, "pageNumber", "chunkIndex", embedding)
      VALUES (
        ${id},
        ${documentId},
        ${chunk.content},
        ${metadataJson}::jsonb,
        ${chunk.pageNumber},
        ${chunk.chunkIndex},
        ${vectorStr}::vector
      )
    `;
  }
}

/**
 * Generate a CUID-like unique ID.
 * Uses crypto.randomUUID for simplicity — close enough to CUID for our purposes.
 */
function generateCUID(): string {
  // Generate a random string matching cuid format (25 chars, lowercase alphanumeric)
  const chars = "abcdefghijklmnopqrstuvwxyz0123456789";
  const timestamp = Date.now().toString(36);
  let result = "c" + timestamp; // CUIDs start with 'c'
  while (result.length < 25) {
    result += chars[Math.floor(Math.random() * chars.length)];
  }
  return result.slice(0, 25);
}

/**
 * Simple delay utility for rate limiting.
 */
function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
