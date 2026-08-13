"use client";

import {
  Brain,
  FileText,
  ChevronRight,
  Sparkles,
  Target,
  Trophy,
  BarChart3,
} from "lucide-react";

export default function QuizzesPage() {
  return (
    <div className="mx-auto max-w-6xl space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-surface-900">
            Quizzes
          </h1>
          <p className="mt-1 text-surface-500">
            Test your understanding with AI-generated quizzes
          </p>
        </div>
      </div>

      {/* ── Empty State ── */}
      <div className="rounded-2xl border border-surface-200 bg-white p-16 text-center">
        <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-3xl bg-gradient-to-br from-amber-50 to-orange-50">
          <Brain className="h-10 w-10 text-amber-500" />
        </div>
        <h2 className="mb-2 text-xl font-bold text-surface-900">
          No Quizzes Yet
        </h2>
        <p className="mx-auto mb-8 max-w-sm text-sm text-surface-500">
          Generate multiple-choice quizzes from your documents to test your
          knowledge and identify learning gaps.
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
              <span className="text-xs text-surface-600">AI Creates Quiz</span>
            </div>
            <ChevronRight className="h-4 w-4 text-surface-300" />
            <div className="flex flex-col items-center gap-1.5 text-center">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-amber-50">
                <Target className="h-5 w-5 text-amber-500" />
              </div>
              <span className="text-xs text-surface-600">Take Quiz</span>
            </div>
          </div>
        </div>

        {/* Stats Teaser */}
        <div className="mx-auto mt-6 flex max-w-xs justify-center gap-6">
          <div className="flex items-center gap-2 text-xs text-surface-500">
            <Trophy className="h-4 w-4 text-amber-400" />
            Track scores
          </div>
          <div className="flex items-center gap-2 text-xs text-surface-500">
            <BarChart3 className="h-4 w-4 text-arcus-400" />
            Identify gaps
          </div>
        </div>
      </div>

      {/* ── Quiz Grid (placeholder for future) ── */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
        {/* Quiz cards will go here */}
      </div>
    </div>
  );
}
