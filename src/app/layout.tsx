import type { Metadata } from "next";
import { Inter, JetBrains_Mono } from "next/font/google";
import "./globals.css";
import { TRPCProvider } from "@/lib/trpc/client";
import { SessionProvider } from "@/components/providers/session-provider";

// Self-hosted at build time by next/font: no render-blocking request to
// Google, and no layout shift from a late-arriving face.
const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-mono-jet",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Arcus — Academic Retrieval Workspace",
  description:
    "Upload course material and query it with hybrid retrieval: pgvector similarity and PostgreSQL full-text search, fused with Reciprocal Rank Fusion. Grounded answers, flashcards, quizzes, and an observable ingestion pipeline.",
  keywords: [
    "RAG",
    "hybrid search",
    "pgvector",
    "reciprocal rank fusion",
    "document ingestion",
    "study assistant",
  ],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${inter.variable} ${jetbrainsMono.variable}`}>
      <body>
        <SessionProvider>
          <TRPCProvider>{children}</TRPCProvider>
        </SessionProvider>
      </body>
    </html>
  );
}
