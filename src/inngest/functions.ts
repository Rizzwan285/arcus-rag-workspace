import { inngest } from "./client";
import { prisma } from "@/server/db/prisma";
import { loadAndChunkPDF, type ChunkedDocument } from "@/lib/langchain/document-loader";
import { embedTexts } from "@/lib/langchain/embeddings";

const EMBEDDING_BATCH_SIZE = 50;
const BATCH_DELAY_MS = 500;

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

      // 3. Generate Embeddings
      const allEmbeddings = await step.run("generate-embeddings", async () => {
        const texts = chunks.map((c: ChunkedDocument) => c.content);
        const embeddings: number[][] = [];

        for (let i = 0; i < texts.length; i += EMBEDDING_BATCH_SIZE) {
          const batch = texts.slice(i, i + EMBEDDING_BATCH_SIZE);
          
          try {
            const batchEmbeddings = await embedTexts(batch);
            embeddings.push(...batchEmbeddings);
          } catch (error) {
            // Retry once with simple backoff
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

      // 4. Store Chunks in DB
      await step.run("store-chunks", async () => {
        for (let i = 0; i < chunks.length; i++) {
          const chunk = chunks[i];
          const embedding = allEmbeddings[i];
          
          const chars = "abcdefghijklmnopqrstuvwxyz0123456789";
          let id = "c" + Date.now().toString(36);
          while (id.length < 25) {
            id += chars[Math.floor(Math.random() * chars.length)];
          }
          id = id.slice(0, 25);
          
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
      });

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
      // If any step fails, update status to FAILED
      await step.run("update-status-failed", async () => {
        await prisma.document.update({
          where: { id: documentId },
          data: { status: "FAILED" },
        });
      });
      
      throw error; // Re-throw so Inngest knows the function failed
    }
  }
);
