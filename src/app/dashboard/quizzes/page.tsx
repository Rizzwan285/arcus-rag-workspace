"use client";

import { useSession } from "next-auth/react";
import Link from "next/link";
import { ArrowRight, Brain, FileText, Trash2 } from "lucide-react";
import { trpc } from "@/lib/trpc/client";
import {
  Button,
  ButtonLink,
  EmptyState,
  Panel,
  PageHeader,
  Skeleton,
} from "@/components/ui";
import { relativeTime } from "@/lib/utils";

export default function QuizzesPage() {
  const { data: session } = useSession();

  const {
    data: quizzes = [],
    isLoading,
    refetch,
  } = trpc.quiz.getQuizzes.useQuery(undefined, { enabled: !!session?.user });

  const deleteQuiz = trpc.quiz.deleteQuiz.useMutation({
    onSuccess: () => void refetch(),
  });

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Study"
        title="Quizzes"
        description="Multiple-choice sets drawn from your documents, each answer carrying an explanation."
        action={
          <ButtonLink href="/dashboard/documents" variant="outline">
            Generate from a document
          </ButtonLink>
        }
      />

      {isLoading ? (
        <Panel className="divide-y divide-line">
          {[0, 1, 2].map((i) => (
            <div key={i} className="space-y-2 px-4 py-3.5">
              <Skeleton className="h-4 w-1/3" />
              <Skeleton className="h-3 w-1/4" />
            </div>
          ))}
        </Panel>
      ) : quizzes.length === 0 ? (
        <EmptyState
          icon={Brain}
          title="No quizzes yet"
          description="Open an indexed document and generate a quiz from its content."
          action={
            <ButtonLink href="/dashboard/documents" variant="solid" size="sm">
              Go to documents
              <ArrowRight className="h-3.5 w-3.5" />
            </ButtonLink>
          }
        />
      ) : (
        <Panel className="divide-y divide-line">
          {quizzes.map((quiz) => (
            <div key={quiz.id} className="group flex items-center gap-3 px-4 py-3.5">
              <Brain
                className="h-4 w-4 shrink-0 text-surface-300"
                strokeWidth={1.75}
              />

              <div className="min-w-0 flex-1">
                <Link
                  href={`/dashboard/quizzes/${quiz.id}`}
                  className="truncate text-sm font-medium text-surface-900 hover:underline"
                >
                  {quiz.title}
                </Link>
                <div className="mt-0.5 flex items-center gap-2 font-mono text-2xs text-surface-400">
                  <span className="tabular">
                    {quiz._count.questions} questions
                  </span>
                  <span className="text-surface-300">·</span>
                  <FileText className="h-3 w-3" />
                  <span className="min-w-0 truncate">{quiz.document.title}</span>
                  <span className="text-surface-300">·</span>
                  <span>{relativeTime(quiz.createdAt)}</span>
                </div>
              </div>

              <div className="flex shrink-0 items-center gap-1.5">
                <ButtonLink href={`/dashboard/quizzes/${quiz.id}`} size="sm">
                  Start
                  <ArrowRight className="h-3 w-3" />
                </ButtonLink>
                <Button
                  variant="ghost"
                  size="sm"
                  aria-label={`Delete ${quiz.title}`}
                  className="opacity-0 transition-opacity group-hover:opacity-100 focus:opacity-100 hover:text-err"
                  onClick={() => {
                    if (confirm(`Delete the quiz “${quiz.title}”?`)) {
                      deleteQuiz.mutate({ id: quiz.id });
                    }
                  }}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
          ))}
        </Panel>
      )}
    </div>
  );
}
