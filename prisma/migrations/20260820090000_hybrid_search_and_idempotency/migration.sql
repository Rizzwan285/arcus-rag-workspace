-- Hybrid retrieval (dense + lexical), idempotent chunk writes, and pipeline telemetry.
--
-- Hand-authored rather than fully generated, because three objects are outside
-- Prisma's schema language:
--   1. "DocumentChunk"."searchVector" is a GENERATED ALWAYS ... STORED column.
--   2. The HNSW index on "embedding" (Prisma has no `type: Hnsw`).
--   3. The backfill/dedupe needed before "contentHash" can be NOT NULL + UNIQUE.

-- CreateEnum
CREATE TYPE "IngestionRunStatus" AS ENUM ('RUNNING', 'SUCCEEDED', 'FAILED');

-- AlterTable: ingestion outcome + Dead Letter Queue columns
ALTER TABLE "Document" ADD COLUMN     "chunkCount" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "errorMessage" TEXT,
ADD COLUMN     "errorTrace" TEXT,
ADD COLUMN     "failedAt" TIMESTAMP(3),
ADD COLUMN     "failedStep" TEXT,
ADD COLUMN     "ingestedAt" TIMESTAMP(3);

-- AlterTable: chunk idempotency key + token accounting
-- "contentHash" is added nullable so existing rows can be backfilled first.
ALTER TABLE "DocumentChunk" ADD COLUMN     "contentHash" TEXT,
ADD COLUMN     "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "tokenCount" INTEGER NOT NULL DEFAULT 0;

-- Backfill: sha256 over the UTF-8 bytes of `content`, hex-encoded. This is the
-- exact value Node's `crypto.createHash("sha256").update(content, "utf8")` yields,
-- so pre-existing rows dedupe against freshly ingested ones.
UPDATE "DocumentChunk"
SET "contentHash" = encode(sha256(convert_to("content", 'UTF8')), 'hex')
WHERE "contentHash" IS NULL;

-- Collapse any pre-existing duplicates (same document, byte-identical text)
-- before the unique constraint goes on. Keeps the lowest chunkIndex of each group.
DELETE FROM "DocumentChunk" a
USING "DocumentChunk" b
WHERE a."documentId" = b."documentId"
  AND a."contentHash" = b."contentHash"
  AND (a."chunkIndex", a."id") > (b."chunkIndex", b."id");

ALTER TABLE "DocumentChunk" ALTER COLUMN "contentHash" SET NOT NULL;

-- Lexical retrieval arm: a stored generated column, so the tsvector can never
-- drift from `content` and the application never has to write it.
ALTER TABLE "DocumentChunk"
ADD COLUMN "searchVector" tsvector
GENERATED ALWAYS AS (to_tsvector('english', coalesce("content", ''))) STORED;

-- CreateTable
CREATE TABLE "IngestionRun" (
    "id" TEXT NOT NULL,
    "documentId" TEXT NOT NULL,
    "runId" TEXT,
    "attempt" INTEGER NOT NULL DEFAULT 1,
    "status" "IngestionRunStatus" NOT NULL DEFAULT 'RUNNING',
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finishedAt" TIMESTAMP(3),
    "latencyMs" INTEGER,
    "bytesFetched" INTEGER,
    "pagesParsed" INTEGER,
    "chunksYielded" INTEGER,
    "chunksRejected" INTEGER,
    "chunksInserted" INTEGER,
    "chunksDeduped" INTEGER,
    "embeddingTokens" INTEGER,
    "embeddingCalls" INTEGER,
    "embeddingCostUsd" DOUBLE PRECISION,
    "stepTimings" JSONB,
    "failedStep" TEXT,
    "errorMessage" TEXT,
    "errorTrace" TEXT,

    CONSTRAINT "IngestionRun_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "IngestionRun_documentId_startedAt_idx" ON "IngestionRun"("documentId", "startedAt");

-- CreateIndex
CREATE INDEX "IngestionRun_status_startedAt_idx" ON "IngestionRun"("status", "startedAt");

-- CreateIndex
CREATE INDEX "Document_userId_status_idx" ON "Document"("userId", "status");

-- CreateIndex
CREATE INDEX "DocumentChunk_searchVector_idx" ON "DocumentChunk" USING GIN ("searchVector");

-- CreateIndex: the idempotency constraint the ingestion pipeline's
-- ON CONFLICT DO NOTHING targets.
CREATE UNIQUE INDEX "DocumentChunk_documentId_contentHash_key" ON "DocumentChunk"("documentId", "contentHash");

-- AddForeignKey
ALTER TABLE "IngestionRun" ADD CONSTRAINT "IngestionRun_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "Document"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Dense retrieval arm: HNSW over cosine distance. Prisma's schema language has
-- no `type: Hnsw`, so this index lives only here. m/ef_construction are pgvector's
-- defaults — raise ef_construction for better recall once the corpus grows.
CREATE INDEX "DocumentChunk_embedding_hnsw_idx"
ON "DocumentChunk"
USING hnsw ("embedding" vector_cosine_ops)
WITH (m = 16, ef_construction = 64);
