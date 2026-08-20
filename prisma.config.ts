/**
 * Prisma CLI configuration (Prisma v7).
 *
 * This file is read by the Prisma CLI only — the application runtime builds its
 * own connection in `src/server/db/prisma.ts` via the `PrismaPg` driver adapter.
 * Prisma v7 removed `datasource.url` from the schema language, so migration
 * connectivity is configured here.
 *
 * @see ADR-014 in .claude/decisions.md
 */
import "dotenv/config";
import { defineConfig } from "prisma/config";

/**
 * Supabase's pooler hangs the Rust schema engine when libpq negotiates
 * `sslmode=prefer` (the default). Pinning `sslmode=require` makes every CLI
 * command connect deterministically. Local Postgres (Docker) is left alone —
 * it has no TLS listener.
 */
function withSslMode(url: string | undefined): string | undefined {
  if (!url) return undefined;
  if (/[?&]sslmode=/.test(url)) return url;
  if (/@(localhost|127\.0\.0\.1|host\.docker\.internal)[:/]/.test(url)) return url;
  return `${url}${url.includes("?") ? "&" : "?"}sslmode=require`;
}

/**
 * The CLI always talks to the session-mode (`DIRECT_URL`, :5432) connection.
 * Supabase's transaction-mode pooler (:6543) cannot hold the advisory locks the
 * schema engine takes out, and it rejects the engine's prepared statements —
 * both surface as an indefinite hang rather than an error.
 */
const cliUrl = withSslMode(process.env["DIRECT_URL"] ?? process.env["DATABASE_URL"]);

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
  },
  datasource: {
    // Prisma 7.9's config type exposes only `url`/`shadowDatabaseUrl`; the
    // direct URL is supplied here because the CLI is its only consumer.
    url: cliUrl,
  },
});
