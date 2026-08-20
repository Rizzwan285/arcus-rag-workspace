"use client";

import { useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  RotateCcw,
  X,
} from "lucide-react";
import { trpc } from "@/lib/trpc/client";
import { cn } from "@/lib/utils";
import { Button, ButtonLink, EmptyState, Panel, Skeleton } from "@/components/ui";

export default function QuizRunnerPage() {
  const params = useParams();
  const quizId = params.id as string;

  const { data: quiz, isLoading } = trpc.quiz.getQuizById.useQuery(
    { id: quizId },
    { enabled: !!quizId }
  );

  const [currentIndex, setCurrentIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<number, string>>({});
  const [showResults, setShowResults] = useState(false);

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-1/3" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (!quiz || quiz.questions.length === 0) {
    return (
      <EmptyState
        title="Quiz not found"
        description="This quiz may have been deleted, or it contains no questions."
        action={
          <ButtonLink href="/dashboard/quizzes" size="sm">
            Back to quizzes
          </ButtonLink>
        }
      />
    );
  }

  const total = quiz.questions.length;
  const question = quiz.questions[currentIndex];
  const isLast = currentIndex === total - 1;
  const answered = Object.keys(answers).length;

  const restart = () => {
    setCurrentIndex(0);
    setAnswers({});
    setShowResults(false);
  };

  /* ── Results ─────────────────────────────────────────────────── */
  if (showResults) {
    const score = quiz.questions.reduce(
      (acc, q, index) => acc + (answers[index] === q.correctAnswer ? 1 : 0),
      0
    );
    const percentage = Math.round((score / total) * 100);
    const tone =
      percentage >= 80 ? "ok" : percentage >= 50 ? "warn" : "err";

    return (
      <div className="space-y-6">
        <header className="flex items-start gap-3 border-b border-line pb-5">
          <Link
            href="/dashboard/quizzes"
            className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-line text-surface-500 transition-colors hover:bg-surface-50 hover:text-surface-900"
            aria-label="Back to quizzes"
          >
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <div className="min-w-0">
            <p className="font-mono text-2xs tracking-[0.12em] text-surface-400 uppercase">
              Results
            </p>
            <h1 className="truncate text-xl text-surface-900">{quiz.title}</h1>
          </div>
        </header>

        {/* Score */}
        <Panel className="flex flex-wrap items-center justify-between gap-6 p-6">
          <div>
            <p className="font-mono text-2xs tracking-[0.12em] text-surface-400 uppercase">
              Score
            </p>
            <p className="mt-1 flex items-baseline gap-2">
              <span
                className={cn(
                  "font-mono text-5xl tabular",
                  tone === "ok"
                    ? "text-ok"
                    : tone === "warn"
                      ? "text-warn"
                      : "text-err"
                )}
              >
                {percentage}
              </span>
              <span className="font-mono text-lg text-surface-400">%</span>
            </p>
            <p className="mt-1 font-mono text-xs tabular text-surface-500">
              {score} of {total} correct
            </p>
          </div>

          {/* Per-question strip: where the misses are, at a glance. */}
          <div className="flex flex-wrap gap-1">
            {quiz.questions.map((q, index) => {
              const correct = answers[index] === q.correctAnswer;
              return (
                <span
                  key={q.id}
                  title={`Question ${index + 1}: ${correct ? "correct" : "incorrect"}`}
                  className={cn(
                    "h-6 w-6 rounded font-mono text-2xs tabular leading-6 text-center",
                    correct ? "bg-ok-soft text-ok" : "bg-err-soft text-err"
                  )}
                >
                  {index + 1}
                </span>
              );
            })}
          </div>

          <Button variant="solid" onClick={restart}>
            <RotateCcw className="h-3.5 w-3.5" />
            Retake
          </Button>
        </Panel>

        {/* Review */}
        <section className="space-y-3">
          <h2 className="font-mono text-2xs tracking-[0.12em] text-surface-400 uppercase">
            Review
          </h2>
          <div className="space-y-3">
            {quiz.questions.map((q, index) => {
              const chosen = answers[index];
              const correct = chosen === q.correctAnswer;

              return (
                <Panel key={q.id} className="overflow-hidden">
                  <div className="flex items-start gap-3 border-b border-line px-4 py-3">
                    <span
                      className={cn(
                        "mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded",
                        correct ? "bg-ok-soft text-ok" : "bg-err-soft text-err"
                      )}
                    >
                      {correct ? (
                        <Check className="h-3 w-3" strokeWidth={2.5} />
                      ) : (
                        <X className="h-3 w-3" strokeWidth={2.5} />
                      )}
                    </span>
                    <p className="min-w-0 flex-1 text-sm font-medium text-surface-900">
                      <span className="mr-2 font-mono text-2xs text-surface-300">
                        {String(index + 1).padStart(2, "0")}
                      </span>
                      {q.question}
                    </p>
                  </div>

                  <div className="divide-y divide-line">
                    {q.options.map((option) => {
                      const isCorrect = option === q.correctAnswer;
                      const isChosen = option === chosen;
                      return (
                        <div
                          key={option}
                          className={cn(
                            "flex items-center gap-2.5 px-4 py-2 text-sm",
                            isCorrect
                              ? "bg-ok-soft text-surface-900"
                              : isChosen
                                ? "bg-err-soft text-surface-900"
                                : "text-surface-500"
                          )}
                        >
                          <span
                            className={cn(
                              "font-mono text-2xs",
                              isCorrect
                                ? "text-ok"
                                : isChosen
                                  ? "text-err"
                                  : "text-surface-300"
                            )}
                          >
                            {isCorrect ? "✓" : isChosen ? "✕" : "·"}
                          </span>
                          <span className="min-w-0 flex-1">{option}</span>
                          {isChosen && (
                            <span className="shrink-0 font-mono text-2xs text-surface-400">
                              your answer
                            </span>
                          )}
                        </div>
                      );
                    })}
                  </div>

                  {q.explanation && (
                    <p className="border-t border-line bg-surface-50 px-4 py-2.5 text-xs leading-relaxed text-surface-600">
                      {q.explanation}
                    </p>
                  )}
                </Panel>
              );
            })}
          </div>
        </section>
      </div>
    );
  }

  /* ── Question ────────────────────────────────────────────────── */
  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-start justify-between gap-4 border-b border-line pb-5">
        <div className="flex min-w-0 items-start gap-3">
          <Link
            href="/dashboard/quizzes"
            className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-line text-surface-500 transition-colors hover:bg-surface-50 hover:text-surface-900"
            aria-label="Back to quizzes"
          >
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <div className="min-w-0">
            <h1 className="truncate text-xl text-surface-900">{quiz.title}</h1>
            <p className="mt-0.5 truncate font-mono text-2xs text-surface-400">
              {quiz.document.title}
            </p>
          </div>
        </div>
        <p className="font-mono text-sm tabular text-surface-500">
          {String(currentIndex + 1).padStart(2, "0")}
          <span className="text-surface-300"> / {String(total).padStart(2, "0")}</span>
        </p>
      </header>

      <div className="h-px w-full bg-surface-100">
        <div
          className="h-px bg-surface-900 transition-[width] duration-300"
          style={{ width: `${(answered / total) * 100}%` }}
        />
      </div>

      <Panel className="overflow-hidden">
        <div className="border-b border-line px-5 py-4">
          <p className="text-lg leading-snug text-surface-900">
            {question.question}
          </p>
        </div>

        <div className="divide-y divide-line">
          {question.options.map((option, index) => {
            const selected = answers[currentIndex] === option;
            return (
              <button
                key={option}
                onClick={() =>
                  setAnswers((prev) => ({ ...prev, [currentIndex]: option }))
                }
                aria-pressed={selected}
                className={cn(
                  "flex w-full items-center gap-3 px-5 py-3 text-left text-sm transition-colors",
                  selected
                    ? "bg-surface-900 text-white"
                    : "text-surface-700 hover:bg-surface-50"
                )}
              >
                <span
                  className={cn(
                    "flex h-5 w-5 shrink-0 items-center justify-center rounded font-mono text-2xs",
                    selected
                      ? "bg-white/15 text-white"
                      : "bg-surface-100 text-surface-500"
                  )}
                >
                  {String.fromCharCode(65 + index)}
                </span>
                <span className="min-w-0 flex-1">{option}</span>
              </button>
            );
          })}
        </div>
      </Panel>

      <div className="flex items-center justify-between">
        <Button
          onClick={() => setCurrentIndex((i) => Math.max(0, i - 1))}
          disabled={currentIndex === 0}
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Previous
        </Button>

        <p className="font-mono text-2xs tabular text-surface-400">
          {answered} of {total} answered
        </p>

        <Button
          variant="solid"
          disabled={!answers[currentIndex]}
          onClick={() => {
            if (isLast) setShowResults(true);
            else setCurrentIndex((i) => i + 1);
          }}
        >
          {isLast ? "See results" : "Next"}
          <ArrowRight className="h-3.5 w-3.5" />
        </Button>
      </div>
    </div>
  );
}
