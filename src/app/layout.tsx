import type { Metadata } from "next";
import "./globals.css";
import { TRPCProvider } from "@/lib/trpc/client";
import { SessionProvider } from "@/components/providers/session-provider";

export const metadata: Metadata = {
  title: "Arcus – AI-Powered Academic Workspace",
  description:
    "Transform your course materials into interactive learning experiences with AI-powered document understanding, smart chat, flashcards, and quizzes.",
  keywords: [
    "AI study assistant",
    "RAG",
    "academic workspace",
    "flashcards",
    "quizzes",
    "document AI",
  ],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>
        <SessionProvider>
          <TRPCProvider>{children}</TRPCProvider>
        </SessionProvider>
      </body>
    </html>
  );
}
