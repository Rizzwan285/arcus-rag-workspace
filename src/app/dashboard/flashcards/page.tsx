"use client";

import {
  BookOpen,
  Plus,
  FileText,
  ChevronRight,
  Layers,
  Sparkles,
} from "lucide-react";

export default function FlashcardsPage() {
  return (
    <div className="mx-auto max-w-6xl space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-surface-900">
            Flashcards
          </h1>
          <p className="mt-1 text-surface-500">
            AI-generated study cards from your documents
          </p>
        </div>
      </div>

      {/* ── Empty State ── */}
      <div className="rounded-2xl border border-surface-200 bg-white p-16 text-center">
        <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-3xl bg-gradient-to-br from-emerald-50 to-teal-50">
          <BookOpen className="h-10 w-10 text-emerald-500" />
        </div>
        <h2 className="mb-2 text-xl font-bold text-surface-900">
          No Flashcard Decks Yet
        </h2>
        <p className="mx-auto mb-8 max-w-sm text-sm text-surface-500">
          Upload documents and generate flashcard decks to study key concepts
          with spaced repetition.
        </p>

        {/* How it works */}
        <div className="mx-auto max-w-lg rounded-xl border border-surface-200 bg-surface-50 p-6">
          <h3 className="mb-4 text-sm font-semibold text-surface-700">
            How It Works
          </h3>
          <div className="flex items-center justify-center gap-4">
            <div className="flex flex-col items-center gap-1.5 text-center">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-50">
                <FileText className="h-5 w-5 text-blue-500" />
              </div>
              <span className="text-xs text-surface-600">Upload PDF</span>
            </div>
            <ChevronRight className="h-4 w-4 text-surface-300" />
            <div className="flex flex-col items-center gap-1.5 text-center">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-arcus-50">
                <Sparkles className="h-5 w-5 text-arcus-500" />
              </div>
              <span className="text-xs text-surface-600">AI Generates</span>
            </div>
            <ChevronRight className="h-4 w-4 text-surface-300" />
            <div className="flex flex-col items-center gap-1.5 text-center">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-50">
                <Layers className="h-5 w-5 text-emerald-500" />
              </div>
              <span className="text-xs text-surface-600">Study Cards</span>
            </div>
          </div>
        </div>
      </div>

      {/* ── Deck Grid (placeholder for future) ── */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
        {/* Placeholder deck cards will go here */}
      </div>
    </div>
  );
}
