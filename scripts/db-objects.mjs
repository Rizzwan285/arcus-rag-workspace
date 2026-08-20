/**
 * Verify (or repair) the retrieval objects Prisma cannot model.
 *
 *   node scripts/db-objects.mjs verify   # exit 1 if anything is missing
 *   node scripts/db-objects.mjs repair   # replay prisma/sql/retrieval-objects.sql
 *
 * `prisma migrate dev` will try to drop the HNSW index and the generated-column
 * expression, because neither exists in schema.prisma. Run `verify` after any
 * migration; run `repair` if it fails.
 */

import "dotenv/config";
import { readFileSync } from "node:fs";
import pg from "pg";

const CHECKS = [
  {
    name: "HNSW index on DocumentChunk.embedding",
    sql: `SELECT 1 FROM pg_indexes
          WHERE tablename = 'DocumentChunk'
            AND indexname = 'DocumentChunk_embedding_hnsw_idx'
            AND indexdef ILIKE '%USING hnsw%vector_cosine_ops%'`,
  },
  {
    name: "GIN index on DocumentChunk.searchVector",
    sql: `SELECT 1 FROM pg_indexes
          WHERE tablename = 'DocumentChunk'
            AND indexname = 'DocumentChunk_searchVector_idx'
            AND indexdef ILIKE '%USING gin%'`,
  },
  {
    name: "searchVector is GENERATED ALWAYS ... STORED",
    sql: `SELECT 1 FROM information_schema.columns
          WHERE table_name = 'DocumentChunk'
            AND column_name = 'searchVector'
            AND is_generated = 'ALWAYS'`,
  },
  {
    name: "Unique (documentId, contentHash) idempotency key",
    sql: `SELECT 1 FROM pg_indexes
          WHERE tablename = 'DocumentChunk'
            AND indexname = 'DocumentChunk_documentId_contentHash_key'`,
  },
  {
    name: "pgvector extension installed",
    sql: `SELECT 1 FROM pg_extension WHERE extname = 'vector'`,
  },
];

function connectionString() {
  const url = process.env.DIRECT_URL ?? process.env.DATABASE_URL;
  if (!url) {
    console.error("DIRECT_URL / DATABASE_URL is not set.");
    process.exit(1);
  }
  return url;
}

function isLocal(url) {
  return /@(localhost|127\.0\.0\.1|host\.docker\.internal)[:/]/.test(url);
}

async function main() {
  const mode = process.argv[2] ?? "verify";
  const url = connectionString();
  const client = new pg.Client({
    connectionString: url,
    // Managed Postgres (Supabase) terminates TLS with its own CA chain.
    ssl: isLocal(url) ? undefined : { rejectUnauthorized: false },
    connectionTimeoutMillis: 20_000,
  });

  await client.connect();

  try {
    if (mode === "repair") {
      const sql = readFileSync(
        new URL("../prisma/sql/retrieval-objects.sql", import.meta.url),
        "utf8",
      );
      await client.query(sql);
      console.log("Replayed prisma/sql/retrieval-objects.sql");
    }

    let failed = 0;
    for (const check of CHECKS) {
      const { rowCount } = await client.query(check.sql);
      const ok = rowCount > 0;
      if (!ok) failed++;
      console.log(`${ok ? "  ok  " : " MISS "} ${check.name}`);
    }

    if (failed > 0) {
      console.error(
        `\n${failed} retrieval object(s) missing. Run: npm run db:repair`,
      );
      process.exitCode = 1;
    } else {
      console.log("\nAll retrieval objects present.");
    }
  } finally {
    await client.end();
  }
}

main().catch((error) => {
  console.error("db-objects failed:", error.message);
  process.exit(1);
});
