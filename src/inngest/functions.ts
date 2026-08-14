import { inngest } from "./client";
import { prisma } from "@/server/db/prisma";
import { loadAndChunkPDF, type ChunkedDocument } from "@/lib/langchain/document-loader";
import { embedTexts } from "@/lib/langchain/embeddings";

const EMBEDDING_BATCH_SIZE = 50;
const BATCH_DELAY_MS = 500;
const DB_INSERT_BATCH_SIZE = 25;

/**
 * Generate a CUID-like unique ID.
 */
function generateCUID(): string {
  const chars = "abcdefghijklmnopqrstuvwxyz0123456789";
  const timestamp = Date.now().toString(36);
  let result = "c" + timestamp;
  while (result.length < 25) {
    result += chars[Math.floor(Math.random() * chars.length)];
  }
  return result.slice(0, 25);
}

export const ingestDocument = inngest.createFunction(
  { id: "ingest-document", triggers: [{ event: "document/ingest" }] },
  async ({ event, step }: any) => {
    const { documentId, fileUrl } = event.data;

    try {
      // 1. Update status to PROCESSING
      await step.run("update-status-processing", async () => {
        await prisma.document.update({
          where: { id: documentId },
          data: { status: "PROCESSING" },
        });
      });

      // 2. Fetch PDF and extract chunks
      const chunks = await step.run("fetch-and-chunk-pdf", async () => {
        const response = await fetch(fileUrl);
        if (!response.ok) {
          throw new Error(`Failed to fetch PDF: ${response.status} ${response.statusText}`);
        }

        const arrayBuffer = await response.arrayBuffer();
        const pdfBuffer = Buffer.from(arrayBuffer);

        const extractedChunks = await loadAndChunkPDF(pdfBuffer);
        if (extractedChunks.length === 0) {
          throw new Error("No text could be extracted from the PDF");
        }
        return extractedChunks;
      });

      // 3. Generate embeddings in batches
      const allEmbeddings = await step.run("generate-embeddings", async () => {
        const texts = chunks.map((c: ChunkedDocument) => c.content);
        const embeddings: number[][] = [];

        for (let i = 0; i < texts.length; i += EMBEDDING_BATCH_SIZE) {
          const batch = texts.slice(i, i + EMBEDDING_BATCH_SIZE);

          try {
            const batchEmbeddings = await embedTexts(batch);
            embeddings.push(...batchEmbeddings);
          } catch {
            // Retry once with backoff
            await new Promise((resolve) => setTimeout(resolve, 2000));
            const batchEmbeddings = await embedTexts(batch);
            embeddings.push(...batchEmbeddings);
          }

          if (i + EMBEDDING_BATCH_SIZE < texts.length) {
            await new Promise((resolve) => setTimeout(resolve, BATCH_DELAY_MS));
          }
        }
        return embeddings;
      });

      // 4. Store chunks in DB using BATCHED inserts (25 at a time)
      const totalBatches = Math.ceil(chunks.length / DB_INSERT_BATCH_SIZE);
      for (let batchIdx = 0; batchIdx < totalBatches; batchIdx++) {
        await step.run(`store-chunks-batch-${batchIdx}`, async () => {
          const start = batchIdx * DB_INSERT_BATCH_SIZE;
          const end = Math.min(start + DB_INSERT_BATCH_SIZE, chunks.length);
          const batchChunks = chunks.slice(start, end);
          const batchEmbeddings = allEmbeddings.slice(start, end);

          // Build a single multi-row INSERT statement
          const valueRows: string[] = [];
          const params: any[] = [];
          let paramIdx = 1;

          for (let i = 0; i < batchChunks.length; i++) {
            const chunk = batchChunks[i];
            const embedding = batchEmbeddings[i];
            const id = generateCUID();
            const vectorStr = `[${embedding.join(",")}]`;
            const metadataJson = JSON.stringify(chunk.metadata);

            valueRows.push(
              `($${paramIdx}, $${paramIdx + 1}, $${paramIdx + 2}, $${paramIdx + 3}::jsonb, $${paramIdx + 4}, $${paramIdx + 5}, $${paramIdx + 6}::vector)`
            );
            params.push(id, documentId, chunk.content, metadataJson, chunk.pageNumber, chunk.chunkIndex, vectorStr);
            paramIdx += 7;
          }

          const sql = `INSERT INTO "DocumentChunk" (id, "documentId", content, metadata, "pageNumber", "chunkIndex", embedding) VALUES ${valueRows.join(", ")}`;
          await prisma.$executeRawUnsafe(sql, ...params);
        });
      }

      // 5. Update status to COMPLETED
      await step.run("update-status-completed", async () => {
        const pageCount = Math.max(...chunks.map((c: ChunkedDocument) => c.pageNumber)) + 1;
        await prisma.document.update({
          where: { id: documentId },
          data: {
            status: "COMPLETED",
            pageCount,
          },
        });
      });

      return { success: true, chunksProcessed: chunks.length };
    } catch (error) {
      await step.run("update-status-failed", async () => {
        await prisma.document.update({
          where: { id: documentId },
          data: { status: "FAILED" },
        });
      });

      throw error;
    }
  }
);
