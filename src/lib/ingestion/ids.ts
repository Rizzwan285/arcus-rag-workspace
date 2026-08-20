/**
 * Collision-resistant IDs for rows written through raw SQL.
 *
 * `DocumentChunk.id` is declared `@default(cuid())`, but that default is applied
 * by Prisma Client — the pgvector inserts bypass it, so IDs are minted here.
 * Format matches the surrounding cuid-shaped IDs (25 chars, `c` + lowercase
 * alphanumerics) but draws its entropy from `crypto.randomBytes` rather than
 * `Math.random`.
 */

import { randomBytes } from "node:crypto";

const ALPHABET = "abcdefghijklmnopqrstuvwxyz0123456789";
const ID_LENGTH = 25;

export function createChunkId(): string {
  const timestamp = Date.now().toString(36);
  const randomLength = ID_LENGTH - 1 - timestamp.length;
  const bytes = randomBytes(randomLength);

  let suffix = "";
  for (let i = 0; i < randomLength; i++) {
    suffix += ALPHABET[bytes[i] % ALPHABET.length];
  }

  return `c${timestamp}${suffix}`;
}
