"use client";

import { useSession } from "next-auth/react";
import Link from "next/link";
import { ArrowRight, BookOpen, FileText, Trash2 } from "lucide-react";
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

export default function FlashcardsPage() {
  const { data: session } = useSession();

  const {
    data: decks = [],
    isLoading,
    refetch,
  } = trpc.flashcard.getDecks.useQuery(undefined, { enabled: !!session?.user });

  const deleteDeck = trpc.flashcard.deleteDeck.useMutation({
    onSuccess: () => void refetch(),
  });

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Study"
        title="Flashcards"
        description="Decks generated from your indexed documents, as structured output rather than free-form prose."
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
      ) : decks.length === 0 ? (
        <EmptyState
          icon={BookOpen}
          title="No decks yet"
          description="Open an indexed document and generate a deck from its content."
          action={
            <ButtonLink href="/dashboard/documents" variant="solid" size="sm">
              Go to documents
              <ArrowRight className="h-3.5 w-3.5" />
            </ButtonLink>
          }
        />
      ) : (
        <Panel className="divide-y divide-line">
          {decks.map((deck) => (
            <div key={deck.id} className="group flex items-center gap-3 px-4 py-3.5">
              <BookOpen
                className="h-4 w-4 shrink-0 text-surface-300"
                strokeWidth={1.75}
              />

              <div className="min-w-0 flex-1">
                <Link
                  href={`/dashboard/flashcards/${deck.id}`}
                  className="truncate text-sm font-medium text-surface-900 hover:underline"
                >
                  {deck.title}
                </Link>
                <div className="mt-0.5 flex items-center gap-2 font-mono text-2xs text-surface-400">
                  <span className="tabular">{deck._count.cards} cards</span>
                  <span className="text-surface-300">·</span>
                  <FileText className="h-3 w-3" />
                  <span className="min-w-0 truncate">{deck.document.title}</span>
                  <span className="text-surface-300">·</span>
                  <span>{relativeTime(deck.createdAt)}</span>
                </div>
              </div>

              <div className="flex shrink-0 items-center gap-1.5">
                <ButtonLink href={`/dashboard/flashcards/${deck.id}`} size="sm">
                  Study
                  <ArrowRight className="h-3 w-3" />
                </ButtonLink>
                <Button
                  variant="ghost"
                  size="sm"
                  aria-label={`Delete ${deck.title}`}
                  className="opacity-0 transition-opacity group-hover:opacity-100 focus:opacity-100 hover:text-err"
                  onClick={() => {
                    if (confirm(`Delete the deck “${deck.title}”?`)) {
                      deleteDeck.mutate({ id: deck.id });
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
