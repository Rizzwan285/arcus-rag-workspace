-- Retrieval objects that Prisma's schema language cannot express.
--
-- WHY THIS FILE EXISTS
-- `prisma migrate dev` diffs the live database against schema.prisma. Neither
-- the HNSW index nor the GENERATED ALWAYS expression on "searchVector" can be
-- represented there, so Prisma sees them as drift and will happily emit a
-- `DROP INDEX` / `DROP DEFAULT` into the next generated migration.
--
-- WORKFLOW
--   1. Run `npx prisma migrate dev` as normal.
--   2. DELETE any `DROP INDEX "DocumentChunk_embedding_hnsw_idx"` or
--      `ALTER COLUMN "searchVector" DROP DEFAULT` lines from the generated SQL.
--   3. Run `npm run db:verify` to confirm both objects survived.
--   4. If either was lost, `npm run db:repair` replays this file.
--
-- Everything here is idempotent and safe to run repeatedly.

-- Lexical retrieval arm: stored tsvector, maintained by Postgres.
ALTER TABLE "DocumentChunk"
  ADD COLUMN IF NOT EXISTS "searchVector" tsvector
  GENERATED ALWAYS AS (to_tsvector('english', coalesce("content", ''))) STORED;

CREATE INDEX IF NOT EXISTS "DocumentChunk_searchVector_idx"
  ON "DocumentChunk" USING GIN ("searchVector");

-- Dense retrieval arm: HNSW over cosine distance.
CREATE INDEX IF NOT EXISTS "DocumentChunk_embedding_hnsw_idx"
  ON "DocumentChunk" USING hnsw ("embedding" vector_cosine_ops)
  WITH (m = 16, ef_construction = 64);

-- Idempotency key for chunk writes.
CREATE UNIQUE INDEX IF NOT EXISTS "DocumentChunk_documentId_contentHash_key"
  ON "DocumentChunk" ("documentId", "contentHash");
