"use client";

import { useSession } from "next-auth/react";
import Link from "next/link";
import { HelpCircle, Layers, Trash2, ArrowRight, FileText, Loader2, Brain } from "lucide-react";
import { trpc } from "@/lib/trpc/client";

export default function QuizzesPage() {
  const { data: session } = useSession();
  
  const { data: quizzes = [], isLoading, refetch } = trpc.quiz.getQuizzes.useQuery(undefined, {
    enabled: !!session?.user,
  });

  const deleteQuiz = trpc.quiz.deleteQuiz.useMutation({
    onSuccess: () => refetch(),
  });

  return (
    <div className="mx-auto max-w-6xl space-y-8">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-surface-900">
            Quizzes
          </h1>
          <p className="mt-1 text-surface-500">
            Test your knowledge with AI-generated quizzes
          </p>
        </div>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="h-8 w-8 animate-spin text-arcus-500" />
        </div>
      ) : quizzes.length === 0 ? (
        <div className="rounded-2xl border border-surface-200 bg-white p-16 text-center">
          <Brain className="mx-auto mb-4 h-12 w-12 text-surface-300" />
          <h3 className="text-lg font-semibold text-surface-900">
            No Quizzes Yet
          </h3>
          <p className="mt-1 text-sm text-surface-500">
            Generate multiple-choice quizzes from your documents to test yourself.
          </p>
          <Link
            href="/dashboard/documents"
            className="mt-6 inline-flex items-center gap-2 rounded-xl bg-arcus-600 px-6 py-3 text-sm font-semibold text-white shadow-md hover:bg-arcus-700"
          >
            Go to Documents
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      ) : (
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {quizzes.map((quiz) => (
            <div
              key={quiz.id}
              className="group relative flex flex-col overflow-hidden rounded-2xl border border-surface-200 bg-white transition-all hover:border-arcus-300 hover:shadow-lg hover:shadow-arcus-500/5"
            >
              <div className="p-6">
                <div className="mb-4 flex items-center justify-between">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-purple-50 text-purple-600">
                    <HelpCircle className="h-5 w-5" />
                  </div>
                  <button
                    onClick={(e) => {
                      e.preventDefault();
                      if (confirm("Delete this quiz?")) {
                        deleteQuiz.mutate({ id: quiz.id });
                      }
                    }}
                    className="rounded-lg p-2 text-surface-300 transition-colors hover:bg-red-50 hover:text-red-600"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
                <h3 className="mb-1 text-lg font-bold text-surface-900 line-clamp-1">
                  {quiz.title}
                </h3>
                <div className="flex items-center gap-2 text-xs text-surface-500">
                  <FileText className="h-3 w-3" />
                  <span className="truncate">{quiz.document.title}</span>
                </div>
              </div>
              <div className="mt-auto border-t border-surface-100 bg-surface-50/50 p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5 text-sm font-medium text-surface-600">
                    <Layers className="h-4 w-4 text-surface-400" />
                    {quiz._count.questions} questions
                  </div>
                  <Link
                    href={`/dashboard/quizzes/${quiz.id}`}
                    className="flex items-center gap-1.5 text-sm font-semibold text-purple-600 hover:text-purple-700"
                  >
                    Take Quiz
                    <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
                  </Link>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
