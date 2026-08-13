/**
 * PDF Document Loader & Text Chunker
 *
 * Uses LangChain's PDFLoader (wraps pdf-parse) for text extraction
 * and RecursiveCharacterTextSplitter for intelligent chunking.
 *
 * Chunk size: 1000 chars — captures full concepts from academic text
 * Chunk overlap: 200 chars — preserves context at boundaries
 *
 * @see ADR-005 in .claude/decisions.md
 */

import { PDFLoader } from "@langchain/community/document_loaders/fs/pdf";
import { RecursiveCharacterTextSplitter } from "@langchain/textsplitters";
import { Document } from "@langchain/core/documents";

/** Configuration for text chunking */
const CHUNK_SIZE = 1000;
const CHUNK_OVERLAP = 200;

/** Result of loading and chunking a PDF */
export interface ChunkedDocument {
  /** The text content of the chunk */
  content: string;
  /** Page number this chunk originated from (0-indexed from pdf-parse) */
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
  // 1. Convert Buffer to Blob for PDFLoader
  // Cast to Uint8Array to resolve Node Buffer vs DOM Blob type mismatch
  const blob = new Blob([new Uint8Array(pdfBuffer)], { type: "application/pdf" });

  // 2. Load PDF into LangChain Document objects (one per page)
  const loader = new PDFLoader(blob, {
    splitPages: true, // One document per page for better page tracking
  });
  const pages: Document[] = await loader.load();

  if (pages.length === 0) {
    throw new Error("PDF contains no extractable text. It may be scanned or corrupted.");
  }

  // 3. Split pages into smaller chunks
  const splitter = new RecursiveCharacterTextSplitter({
    chunkSize: CHUNK_SIZE,
    chunkOverlap: CHUNK_OVERLAP,
    separators: ["\n\n", "\n", ". ", " ", ""], // Academic text hierarchy
  });

  const chunks: Document[] = await splitter.splitDocuments(pages);

  // 4. Map to our ChunkedDocument format
  return chunks.map((chunk, index) => ({
    content: chunk.pageContent,
    pageNumber: (chunk.metadata?.loc?.pageNumber as number) ?? 0,
    chunkIndex: index,
    metadata: {
      source: chunk.metadata?.source,
      pageNumber: chunk.metadata?.loc?.pageNumber,
      totalPages: pages.length,
    },
  }));
}

/**
 * Get the page count from a PDF buffer without full parsing.
 */
export async function getPDFPageCount(pdfBuffer: Buffer): Promise<number> {
  const blob = new Blob([new Uint8Array(pdfBuffer)], { type: "application/pdf" });
  const loader = new PDFLoader(blob, { splitPages: true });
  const pages = await loader.load();
  return pages.length;
}
