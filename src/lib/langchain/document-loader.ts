/**
 * PDF Document Loader & Text Chunker
 *
 * Uses pdf-parse directly (not through LangChain's PDFLoader) to avoid
 * Vercel/Turbopack bundling issues where pdf-parse gets tree-shaken out.
 *
 * Uses LangChain's RecursiveCharacterTextSplitter for intelligent chunking.
 *
 * Chunk size: 1000 chars — captures full concepts from academic text
 * Chunk overlap: 200 chars — preserves context at boundaries
 *
 * @see ADR-005 in .claude/decisions.md
 */

// eslint-disable-next-line @typescript-eslint/no-require-imports
const pdfParse = require("pdf-parse");
import { RecursiveCharacterTextSplitter } from "@langchain/textsplitters";

/** Configuration for text chunking */
const CHUNK_SIZE = 1000;
const CHUNK_OVERLAP = 200;

/** Result of loading and chunking a PDF */
export interface ChunkedDocument {
  /** The text content of the chunk */
  content: string;
  /** Page number this chunk originated from (0-indexed) */
  pageNumber: number;
  /** Sequential index of this chunk within the document */
  chunkIndex: number;
  /** Additional metadata from the PDF */
  metadata: Record<string, unknown>;
}

/**
 * Load a PDF from a Buffer and split it into chunks.
 *
 * @param pdfBuffer - Raw PDF file data as a Buffer
 * @returns Array of chunked documents with content and metadata
 * @throws Error if PDF contains no extractable text
 */
export async function loadAndChunkPDF(
  pdfBuffer: Buffer
): Promise<ChunkedDocument[]> {
  // 1. Parse the PDF directly using pdf-parse
  const parsed = await pdfParse(pdfBuffer);
  const fullText: string = parsed.text;

  if (!fullText || fullText.trim().length === 0) {
    throw new Error("PDF contains no extractable text. It may be scanned or corrupted.");
  }

  const totalPages: number = parsed.numpages || 1;

  // 2. Split the full text into chunks using LangChain's text splitter
  const splitter = new RecursiveCharacterTextSplitter({
    chunkSize: CHUNK_SIZE,
    chunkOverlap: CHUNK_OVERLAP,
    separators: ["\n\n", "\n", ". ", " ", ""], // Academic text hierarchy
  });

  const textChunks = await splitter.splitText(fullText);

  // 3. Map to our ChunkedDocument format
  // Since pdf-parse returns all text as one string, we estimate page numbers
  // by distributing chunks proportionally across the page count.
  return textChunks.map((text, index) => ({
    content: text,
    pageNumber: Math.min(
      Math.floor((index / textChunks.length) * totalPages),
      totalPages - 1
    ),
    chunkIndex: index,
    metadata: {
      totalPages,
      chunkCount: textChunks.length,
    },
  }));
}

/**
 * Get the page count from a PDF buffer without full parsing.
 */
export async function getPDFPageCount(pdfBuffer: Buffer): Promise<number> {
  const parsed = await pdfParse(pdfBuffer);
  return parsed.numpages || 0;
}
