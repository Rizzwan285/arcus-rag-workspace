"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, ChevronLeft, ChevronRight, RotateCcw } from "lucide-react";
import { trpc } from "@/lib/trpc/client";
import { cn } from "@/lib/utils";
import { Button, ButtonLink, EmptyState, Panel, Skeleton } from "@/components/ui";

export default function FlashcardStudyPage() {
  const params = useParams();
  const deckId = params.id as string;

  const { data: deck, isLoading } = trpc.flashcard.getDeckById.useQuery(
    { id: deckId },
    { enabled: !!deckId }
  );

  const [currentIndex, setCurrentIndex] = useState(0);
  const [isFlipped, setIsFlipped] = useState(false);

  const total = deck?.cards.length ?? 0;

  const go = useCallback(
    (delta: number) => {
      setIsFlipped(false);
      // Let the card settle face-up before swapping its content.
      setTimeout(() => {
        setCurrentIndex((prev) => Math.min(Math.max(prev + delta, 0), total - 1));
      }, 140);
    },
    [total]
  );

  // Keyboard study loop: arrows to move, space to flip.
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "ArrowRight") go(1);
      else if (event.key === "ArrowLeft") go(-1);
      else if (event.key === " ") {
        event.preventDefault();
        setIsFlipped((flipped) => !flipped);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [go]);

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-1/3" />
        <Skeleton className="h-[320px] w-full" />
      </div>
    );
  }

  if (!deck || deck.cards.length === 0) {
    return (
      <EmptyState
        title="Deck not found"
        description="This deck may have been deleted, or it contains no cards."
        action={
          <ButtonLink href="/dashboard/flashcards" size="sm">
            Back to flashcards
          </ButtonLink>
        }
      />
    );
  }

  const card = deck.cards[currentIndex];

  return (
    <div className="space-y-6">
      {/* ── Header ── */}
      <header className="flex flex-wrap items-start justify-between gap-4 border-b border-line pb-5">
        <div className="flex min-w-0 items-start gap-3">
          <Link
            href="/dashboard/flashcards"
            className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-line text-surface-500 transition-colors hover:bg-surface-50 hover:text-surface-900"
            aria-label="Back to flashcards"
          >
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <div className="min-w-0">
            <h1 className="truncate text-xl text-surface-900">{deck.title}</h1>
            <p className="mt-0.5 truncate font-mono text-2xs text-surface-400">
              {deck.document.title}
            </p>
          </div>
        </div>
        <p className="font-mono text-sm tabular text-surface-500">
          {String(currentIndex + 1).padStart(2, "0")}
          <span className="text-surface-300"> / {String(total).padStart(2, "0")}</span>
        </p>
      </header>

      {/* ── Progress ── */}
      <div className="h-px w-full bg-surface-100">
        <div
          className="h-px bg-surface-900 transition-[width] duration-300"
          style={{ width: `${((currentIndex + 1) / total) * 100}%` }}
        />
      </div>

      {/* ── Card ── */}
      <div className="flip-scene mx-auto w-full max-w-2xl">
        <button
          onClick={() => setIsFlipped((flipped) => !flipped)}
          aria-label={isFlipped ? "Show the prompt" : "Reveal the answer"}
          className={cn(
            "flip-card relative block h-[320px] w-full text-left",
            isFlipped && "is-flipped"
          )}
        >
          {/* Front */}
          <div className="flip-face absolute inset-0 flex flex-col justify-between rounded-lg border border-line bg-surface-0 p-8">
            <span className="font-mono text-2xs tracking-[0.12em] text-surface-400 uppercase">
              Prompt
            </span>
            <p className="text-2xl leading-snug text-surface-900">{card.front}</p>
            <span className="flex items-center gap-1.5 font-mono text-2xs text-surface-400">
              <RotateCcw className="h-3 w-3" />
              Click or press space to reveal
            </span>
          </div>

          {/* Back */}
          <div className="flip-face flip-face-back absolute inset-0 flex flex-col justify-between overflow-y-auto rounded-lg border border-surface-800 bg-surface-900 p-8">
            <span className="font-mono text-2xs tracking-[0.12em] text-surface-500 uppercase">
              Answer
            </span>
            <p className="text-lg leading-relaxed text-surface-100">{card.back}</p>
            <span className="font-mono text-2xs text-surface-500">
              ← → to move between cards
            </span>
          </div>
        </button>
      </div>

      {/* ── Controls ── */}
      <div className="mx-auto flex max-w-2xl items-center justify-between">
        <Button
          onClick={() => go(-1)}
          disabled={currentIndex === 0}
          aria-label="Previous card"
        >
          <ChevronLeft className="h-3.5 w-3.5" />
          Previous
        </Button>

        <Button variant="ghost" onClick={() => setIsFlipped((f) => !f)}>
          {isFlipped ? "Show prompt" : "Reveal answer"}
        </Button>

        <Button
          variant="solid"
          onClick={() => go(1)}
          disabled={currentIndex === total - 1}
          aria-label="Next card"
        >
          Next
          <ChevronRight className="h-3.5 w-3.5" />
        </Button>
      </div>

      {/* ── Card index ── */}
      <Panel className="mx-auto max-w-2xl p-3">
        <div className="flex flex-wrap gap-1">
          {deck.cards.map((_, index) => (
            <button
              key={index}
              onClick={() => {
                setIsFlipped(false);
                setCurrentIndex(index);
              }}
              aria-label={`Go to card ${index + 1}`}
              aria-current={index === currentIndex ? "true" : undefined}
              className={cn(
                "h-6 w-6 rounded font-mono text-2xs tabular transition-colors",
                index === currentIndex
                  ? "bg-surface-900 text-white"
                  : "text-surface-400 hover:bg-surface-100 hover:text-surface-700"
              )}
            >
              {index + 1}
            </button>
          ))}
        </div>
      </Panel>
    </div>
  );
}
