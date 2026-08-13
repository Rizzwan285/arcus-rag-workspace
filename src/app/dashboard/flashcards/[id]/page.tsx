"use client";

import { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { trpc } from "@/lib/trpc/client";
import { ArrowLeft, ChevronLeft, ChevronRight, RefreshCcw, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

export default function FlashcardStudyPage() {
  const params = useParams();
  const router = useRouter();
  const deckId = params.id as string;

  const { data: deck, isLoading } = trpc.flashcard.getDeckById.useQuery(
    { id: deckId },
    { enabled: !!deckId }
  );

  const [currentIndex, setCurrentIndex] = useState(0);
  const [isFlipped, setIsFlipped] = useState(false);

  if (isLoading) {
    return (
      <div className="flex h-[60vh] items-center justify-center">
        <Loader2 className="h-10 w-10 animate-spin text-arcus-500" />
      </div>
    );
  }

  if (!deck || deck.cards.length === 0) {
    return (
      <div className="mx-auto max-w-3xl text-center py-20">
        <h2 className="text-2xl font-bold text-surface-900">Deck not found or empty</h2>
        <Link href="/dashboard/flashcards" className="mt-4 inline-block text-arcus-600 hover:underline">
          Return to Flashcards
        </Link>
      </div>
    );
  }

  const currentCard = deck.cards[currentIndex];
  const totalCards = deck.cards.length;

  const handleNext = () => {
    if (currentIndex < totalCards - 1) {
      setIsFlipped(false);
      setTimeout(() => setCurrentIndex((prev) => prev + 1), 150);
    }
  };

  const handlePrev = () => {
    if (currentIndex > 0) {
      setIsFlipped(false);
      setTimeout(() => setCurrentIndex((prev) => prev - 1), 150);
    }
  };

  const handleFlip = () => {
    setIsFlipped(!isFlipped);
  };

  return (
    <div className="mx-auto max-w-4xl space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link
            href="/dashboard/flashcards"
            className="flex h-10 w-10 items-center justify-center rounded-xl border border-surface-200 bg-white text-surface-500 hover:bg-surface-50 hover:text-surface-900"
          >
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-surface-900">{deck.title}</h1>
            <p className="text-sm text-surface-500">From document: {deck.document.title}</p>
          </div>
        </div>
        <div className="text-sm font-medium text-surface-500">
          Card {currentIndex + 1} of {totalCards}
        </div>
      </div>

      {/* Progress Bar */}
      <div className="h-2 w-full overflow-hidden rounded-full bg-surface-100">
        <div
          className="h-full bg-arcus-500 transition-all duration-300 ease-out"
          style={{ width: `${((currentIndex + 1) / totalCards) * 100}%` }}
        />
      </div>

      {/* Flashcard Area */}
      <div className="perspective-1000 relative mx-auto mt-12 aspect-[3/2] w-full max-w-2xl cursor-pointer" onClick={handleFlip}>
        <div
          className={cn(
            "preserve-3d absolute h-full w-full transition-transform duration-500 ease-in-out",
            isFlipped ? "rotate-y-180" : ""
          )}
        >
          {/* Front */}
          <div className="backface-hidden absolute flex h-full w-full flex-col items-center justify-center rounded-2xl border border-surface-200 bg-white p-12 text-center shadow-lg">
            <span className="absolute top-6 right-6 rounded-full bg-arcus-50 px-3 py-1 text-xs font-semibold text-arcus-600">
              Front
            </span>
            <h2 className="text-3xl font-medium text-surface-900 leading-tight">
              {currentCard.front}
            </h2>
            <p className="absolute bottom-6 flex items-center gap-2 text-sm text-surface-400">
              <RefreshCcw className="h-4 w-4" /> Click to flip
            </p>
          </div>

          {/* Back */}
          <div className="backface-hidden rotate-y-180 absolute flex h-full w-full flex-col items-center justify-center rounded-2xl border border-arcus-200 bg-arcus-50 p-12 text-center shadow-lg">
            <span className="absolute top-6 right-6 rounded-full bg-arcus-100 px-3 py-1 text-xs font-semibold text-arcus-700">
              Back
            </span>
            <p className="text-2xl font-medium text-surface-900 leading-relaxed">
              {currentCard.back}
            </p>
          </div>
        </div>
      </div>

      {/* Controls */}
      <div className="mx-auto flex max-w-sm items-center justify-between pt-8">
        <button
          onClick={(e) => {
            e.stopPropagation();
            handlePrev();
          }}
          disabled={currentIndex === 0}
          className="flex h-12 w-12 items-center justify-center rounded-xl bg-white text-surface-600 shadow-sm transition-all hover:bg-surface-50 disabled:opacity-50 disabled:shadow-none"
        >
          <ChevronLeft className="h-6 w-6" />
        </button>

        <button
          onClick={handleFlip}
          className="rounded-xl border border-surface-200 bg-white px-8 py-3 font-semibold text-surface-700 shadow-sm hover:bg-surface-50"
        >
          Flip Card
        </button>

        <button
          onClick={(e) => {
            e.stopPropagation();
            handleNext();
          }}
          disabled={currentIndex === totalCards - 1}
          className="flex h-12 w-12 items-center justify-center rounded-xl bg-arcus-600 text-white shadow-md transition-all hover:bg-arcus-700 disabled:opacity-50 disabled:shadow-none"
        >
          <ChevronRight className="h-6 w-6" />
        </button>
      </div>

      <style jsx global>{`
        .perspective-1000 {
          perspective: 1000px;
        }
        .preserve-3d {
          transform-style: preserve-3d;
        }
        .backface-hidden {
          backface-visibility: hidden;
        }
        .rotate-y-180 {
          transform: rotateY(180deg);
        }
      `}</style>
    </div>
  );
}
