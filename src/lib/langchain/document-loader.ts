/**
 * PDF Document Loader & Text Chunker
 *
 * Parses a PDF, splits it with LangChain's RecursiveCharacterTextSplitter, then
 * normalises, hashes, and validates every chunk before it is allowed near the
 * database.
 *
 * Uses pdf-parse directly (not LangChain's PDFLoader) to avoid Vercel/Turbopack
 * bundling issues where pdf-parse gets tree-shaken out.
 *
 * Chunk size 1000 / overlap 200 — captures a full concept from academic text
 * while preserving context across boundaries.
 *
 * @see ADR-005, ADR-015, ADR-016 in .claude/decisions.md
 */

import { createHash } from "node:crypto";
import { RecursiveCharacterTextSplitter } from "@langchain/textsplitters";
import { estimateTokens } from "@/lib/ingestion/cost";
import {
  chunkSchema,
  type ChunkingResult,
  type RejectedChunk,
  type ValidatedChunk,
} from "@/lib/ingestion/schemas";

/** Configuration for text chunking */
const CHUNK_SIZE = 1000;
const CHUNK_OVERLAP = 200;

/** Back-compat alias — the pipeline now works with `ValidatedChunk`. */
export type ChunkedDocument = ValidatedChunk;

/**
 * SHA-256 of a chunk's text, hex encoded.
 *
 * Hashing the *stored* (already normalised) content is what makes the digest a
 * usable idempotency key: re-running the pipeline over the same PDF produces
 * byte-identical text and therefore identical hashes, so
 * `@@unique([documentId, contentHash])` collapses the retry into a no-op.
 *
 * Matches Postgres `encode(sha256(convert_to(content, 'UTF8')), 'hex')`, which
 * the migration uses to backfill pre-existing rows.
 */
export function hashChunkContent(content: string): string {
  return createHash("sha256").update(content, "utf8").digest("hex");
}

/**
 * Collapse whitespace artefacts left by PDF text extraction.
 *
 * Runs *before* hashing so that cosmetically different extractions of the same
 * passage — a stray double space, CRLF vs LF — dedupe against each other
 * instead of slipping past the unique constraint as "new" chunks.
 */
function normaliseText(text: string): string {
  return text
    .replace(/\r\n?/g, "\n")
    // Soft hyphen + line break: PDF line-wrapping splits words mid-token.
    .replace(/(\w)-\n(\w)/g, "$1$2")
    .replace(/[ \t\f\v]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/ ?\n ?/g, "\n")
    .trim();
}

/**
 * Load a PDF from a Buffer and split it into validated, hashed chunks.
 *
 * Chunks that fail validation are returned in `rejected` rather than thrown:
 * one malformed fragment should not fail an otherwise good document. The caller
 * decides whether the rejection rate warrants failing the run.
 *
 * @param pdfBuffer - Raw PDF file data as a Buffer
 * @throws Error if the PDF contains no extractable text at all
 */
export async function loadAndChunkPDF(pdfBuffer: Buffer): Promise<ChunkingResult> {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const pdfParse = require("pdf-parse");

  // 1. Parse the PDF directly using pdf-parse
  const parsed = await pdfParse(pdfBuffer);
  const rawText: string = parsed.text ?? "";

  if (!rawText.trim()) {
    throw new Error(
      "PDF contains no extractable text. It may be a scanned image or corrupted.",
    );
  }

  const fullText = normaliseText(rawText);
  const totalPages: number = parsed.numpages || 1;

  // 2. Split using the academic-text separator hierarchy
  const splitter = new RecursiveCharacterTextSplitter({
    chunkSize: CHUNK_SIZE,
    chunkOverlap: CHUNK_OVERLAP,
    separators: ["\n\n", "\n", ". ", " ", ""],
  });

  const textChunks = await splitter.splitText(fullText);

  // 3. Normalise → hash → validate. pdf-parse returns one flat string, so page
  //    numbers are interpolated across the chunk sequence.
  const chunks: ValidatedChunk[] = [];
  const rejected: RejectedChunk[] = [];
  // Repeated boilerplate (running headers, footers, licence blocks) hashes
  // identically. The unique constraint would reject these at insert time
  // anyway; dropping them here keeps chunkIndex dense and the counters honest.
  const seenHashes = new Set<string>();
  let duplicatesDropped = 0;

  for (const [index, raw] of textChunks.entries()) {
    const content = normaliseText(raw);

    const candidate = {
      content,
      contentHash: hashChunkContent(content),
      chunkIndex: index,
      pageNumber: Math.min(
        Math.floor((index / textChunks.length) * totalPages),
        totalPages - 1,
      ),
      tokenCount: estimateTokens(content),
      metadata: {
        totalPages,
        chunkCount: textChunks.length,
        charCount: content.length,
      },
    };

    const result = chunkSchema.safeParse(candidate);

    if (result.success) {
      if (seenHashes.has(result.data.contentHash)) {
        duplicatesDropped += 1;
        continue;
      }
      seenHashes.add(result.data.contentHash);
      chunks.push(result.data);
    } else {
      rejected.push({
        chunkIndex: index,
        reason: result.error.issues
          .map((issue) => `${issue.path.join(".") || "chunk"}: ${issue.message}`)
          .join("; "),
        preview: content.slice(0, 120),
      });
    }
  }

  // 4. Re-index survivors so chunkIndex stays dense after rejections.
  const compacted = chunks.map((chunk, position) => ({
    ...chunk,
    chunkIndex: position,
  }));

  return {
    chunks: compacted,
    rejected,
    duplicatesDropped,
    pagesParsed: totalPages,
    charsExtracted: fullText.length,
  };
}

/**
 * Get the page count from a PDF buffer without full parsing.
 */
export async function getPDFPageCount(pdfBuffer: Buffer): Promise<number> {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const pdfParse = require("pdf-parse");
  const parsed = await pdfParse(pdfBuffer);
  return parsed.numpages || 0;
}
