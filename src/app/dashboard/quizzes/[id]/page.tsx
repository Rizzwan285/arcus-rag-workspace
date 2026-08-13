"use client";

import { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { trpc } from "@/lib/trpc/client";
import { ArrowLeft, Loader2, CheckCircle2, XCircle, ArrowRight, RotateCcw } from "lucide-react";
import { cn } from "@/lib/utils";

export default function QuizRunnerPage() {
  const params = useParams();
  const router = useRouter();
  const quizId = params.id as string;

  const { data: quiz, isLoading } = trpc.quiz.getQuizById.useQuery(
    { id: quizId },
    { enabled: !!quizId }
  );

  const [currentIndex, setCurrentIndex] = useState(0);
  const [selectedAnswers, setSelectedAnswers] = useState<Record<number, string>>({});
  const [showResults, setShowResults] = useState(false);

  if (isLoading) {
    return (
      <div className="flex h-[60vh] items-center justify-center">
        <Loader2 className="h-10 w-10 animate-spin text-arcus-500" />
      </div>
    );
  }

  if (!quiz || quiz.questions.length === 0) {
    return (
      <div className="mx-auto max-w-3xl text-center py-20">
        <h2 className="text-2xl font-bold text-surface-900">Quiz not found or empty</h2>
        <Link href="/dashboard/quizzes" className="mt-4 inline-block text-arcus-600 hover:underline">
          Return to Quizzes
        </Link>
      </div>
    );
  }

  const currentQuestion = quiz.questions[currentIndex];
  const totalQuestions = quiz.questions.length;
  const isLastQuestion = currentIndex === totalQuestions - 1;

  const handleSelectOption = (option: string) => {
    setSelectedAnswers((prev) => ({
      ...prev,
      [currentIndex]: option,
    }));
  };

  const handleNext = () => {
    if (isLastQuestion) {
      setShowResults(true);
    } else {
      setCurrentIndex((prev) => prev + 1);
    }
  };

  const handleRestart = () => {
    setCurrentIndex(0);
    setSelectedAnswers({});
    setShowResults(false);
  };

  // ── Results View ──
  if (showResults) {
    const score = quiz.questions.reduce((acc, q, idx) => {
      return acc + (selectedAnswers[idx] === q.correctAnswer ? 1 : 0);
    }, 0);
    
    const percentage = Math.round((score / totalQuestions) * 100);

    return (
      <div className="mx-auto max-w-3xl space-y-8">
        <div className="flex items-center gap-4">
          <Link
            href="/dashboard/quizzes"
            className="flex h-10 w-10 items-center justify-center rounded-xl border border-surface-200 bg-white text-surface-500 hover:bg-surface-50 hover:text-surface-900"
          >
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <h1 className="text-2xl font-bold text-surface-900">Quiz Results</h1>
        </div>

        <div className="flex flex-col items-center justify-center rounded-3xl border border-surface-200 bg-white p-12 text-center shadow-sm">
          <div className="relative mb-6 flex h-32 w-32 items-center justify-center rounded-full border-8 border-surface-100">
            <svg className="absolute inset-0 h-full w-full -rotate-90">
              <circle
                cx="50%"
                cy="50%"
                r="45%"
                className="fill-none stroke-purple-500"
                strokeWidth="10%"
                strokeDasharray="283"
                strokeDashoffset={283 - (283 * percentage) / 100}
                strokeLinecap="round"
              />
            </svg>
            <span className="text-3xl font-bold text-surface-900">{percentage}%</span>
          </div>
          <h2 className="text-2xl font-bold text-surface-900">
            {percentage >= 80 ? "Great job!" : percentage >= 50 ? "Good effort!" : "Keep practicing!"}
          </h2>
          <p className="mt-2 text-surface-500">
            You scored {score} out of {totalQuestions} correctly.
          </p>
          <button
            onClick={handleRestart}
            className="mt-8 flex items-center gap-2 rounded-xl bg-purple-600 px-6 py-3 font-semibold text-white shadow-md hover:bg-purple-700"
          >
            <RotateCcw className="h-4 w-4" /> Retake Quiz
          </button>
        </div>

        <div className="space-y-6">
          <h3 className="text-xl font-bold text-surface-900">Review Answers</h3>
          {quiz.questions.map((q, idx) => {
            const userAnswer = selectedAnswers[idx];
            const isCorrect = userAnswer === q.correctAnswer;

            return (
              <div key={q.id} className="rounded-2xl border border-surface-200 bg-white p-6 shadow-sm">
                <div className="flex items-start gap-3">
                  {isCorrect ? (
                    <CheckCircle2 className="mt-1 h-5 w-5 flex-shrink-0 text-emerald-500" />
                  ) : (
                    <XCircle className="mt-1 h-5 w-5 flex-shrink-0 text-red-500" />
                  )}
                  <div>
                    <h4 className="font-semibold text-surface-900">
                      {idx + 1}. {q.question}
                    </h4>
                    <div className="mt-4 space-y-2 text-sm">
                      <p className="text-surface-600">
                        <span className="font-medium text-surface-900">Your answer:</span>{" "}
                        <span className={isCorrect ? "text-emerald-600" : "text-red-600"}>
                          {userAnswer || "No answer selected"}
                        </span>
                      </p>
                      {!isCorrect && (
                        <p className="text-surface-600">
                          <span className="font-medium text-surface-900">Correct answer:</span>{" "}
                          <span className="text-emerald-600">{q.correctAnswer}</span>
                        </p>
                      )}
                    </div>
                    {q.explanation && (
                      <div className="mt-4 rounded-xl bg-surface-50 p-4 text-sm text-surface-600 border border-surface-100">
                        <span className="font-semibold text-surface-900">Explanation:</span>{" "}
                        {q.explanation}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  // ── Quiz Runner View ──
  return (
    <div className="mx-auto max-w-3xl space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link
            href="/dashboard/quizzes"
            className="flex h-10 w-10 items-center justify-center rounded-xl border border-surface-200 bg-white text-surface-500 hover:bg-surface-50 hover:text-surface-900"
          >
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-surface-900 line-clamp-1">{quiz.title}</h1>
          </div>
        </div>
        <div className="text-sm font-medium text-surface-500">
          Question {currentIndex + 1} of {totalQuestions}
        </div>
      </div>

      {/* Progress Bar */}
      <div className="h-2 w-full overflow-hidden rounded-full bg-surface-100">
        <div
          className="h-full bg-purple-500 transition-all duration-300 ease-out"
          style={{ width: `${((currentIndex + 1) / totalQuestions) * 100}%` }}
        />
      </div>

      {/* Question Card */}
      <div className="rounded-3xl border border-surface-200 bg-white p-8 shadow-sm">
        <h2 className="mb-8 text-xl font-medium text-surface-900 leading-relaxed">
          {currentQuestion.question}
        </h2>
        
        <div className="space-y-3">
          {currentQuestion.options.map((option, idx) => {
            const isSelected = selectedAnswers[currentIndex] === option;
            return (
              <button
                key={idx}
                onClick={() => handleSelectOption(option)}
                className={cn(
                  "flex w-full items-center gap-4 rounded-xl border p-4 text-left transition-all",
                  isSelected
                    ? "border-purple-500 bg-purple-50 text-purple-900 ring-1 ring-purple-500 shadow-sm"
                    : "border-surface-200 bg-white text-surface-700 hover:border-purple-200 hover:bg-purple-50/30"
                )}
              >
                <div
                  className={cn(
                    "flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full border text-xs font-semibold",
                    isSelected
                      ? "border-purple-500 bg-purple-500 text-white"
                      : "border-surface-300 text-surface-500"
                  )}
                >
                  {String.fromCharCode(65 + idx)}
                </div>
                <span>{option}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Footer Controls */}
      <div className="flex justify-end pt-4">
        <button
          onClick={handleNext}
          disabled={!selectedAnswers[currentIndex]}
          className="flex items-center gap-2 rounded-xl bg-purple-600 px-8 py-3 font-semibold text-white shadow-md transition-all hover:bg-purple-700 disabled:opacity-50 disabled:shadow-none"
        >
          {isLastQuestion ? "Finish Quiz" : "Next Question"}
          {!isLastQuestion && <ArrowRight className="h-4 w-4" />}
        </button>
      </div>
    </div>
  );
}
