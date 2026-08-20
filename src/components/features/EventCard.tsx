"use client";

import { Check, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { EVENT_DOT } from "./CalendarGrid";

const EVENT_LABEL: Record<string, string> = {
  EXAM: "exam",
  ASSIGNMENT: "assignment",
  DEADLINE: "deadline",
  LECTURE: "lecture",
  STUDY_SESSION: "study",
  REVIEW: "review",
  OTHER: "other",
};

/** Priority is a weight, so it reads as a bar rather than another colour. */
const PRIORITY_LABEL: Record<string, string> = {
  LOW: "low",
  MEDIUM: "med",
  HIGH: "high",
  CRITICAL: "critical",
};

interface EventCardProps {
  event: {
    id: string;
    title: string;
    description?: string | null;
    eventType: string;
    date: Date;
    priority: string;
    completed: boolean;
  };
  onToggleComplete: (id: string) => void;
  onDelete: (id: string) => void;
}

export default function EventCard({
  event,
  onToggleComplete,
  onDelete,
}: EventCardProps) {
  const isCritical = event.priority === "CRITICAL" && !event.completed;

  return (
    <div className="group flex items-start gap-2.5 rounded-md border border-line px-3 py-2.5 transition-colors hover:border-line-strong">
      <button
        onClick={() => onToggleComplete(event.id)}
        aria-pressed={event.completed}
        aria-label={
          event.completed ? `Mark ${event.title} incomplete` : `Mark ${event.title} complete`
        }
        className={cn(
          "mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded border transition-colors",
          event.completed
            ? "border-surface-900 bg-surface-900 text-white"
            : "border-line-strong hover:border-surface-500"
        )}
      >
        {event.completed && <Check className="h-2.5 w-2.5" strokeWidth={3} />}
      </button>

      <div className="min-w-0 flex-1">
        <p
          className={cn(
            "text-sm leading-snug",
            event.completed
              ? "text-surface-400 line-through"
              : "font-medium text-surface-900"
          )}
        >
          {event.title}
        </p>

        <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 font-mono text-2xs text-surface-400">
          <span className="flex items-center gap-1">
            <span
              className={cn(
                "h-1 w-1 rounded-full",
                event.completed
                  ? "bg-surface-300"
                  : (EVENT_DOT[event.eventType] ?? "bg-surface-400")
              )}
            />
            {EVENT_LABEL[event.eventType] ?? "event"}
          </span>
          <span className="text-surface-300">·</span>
          <span className={cn(isCritical && "text-err")}>
            {PRIORITY_LABEL[event.priority] ?? "med"}
          </span>
          <span className="text-surface-300">·</span>
          <span className="tabular">
            {new Date(event.date).toLocaleDateString("en-US", {
              month: "short",
              day: "numeric",
            })}
          </span>
        </div>

        {event.description && (
          <p className="mt-1.5 text-xs leading-relaxed text-surface-500">
            {event.description}
          </p>
        )}
      </div>

      <button
        onClick={() => onDelete(event.id)}
        aria-label={`Delete ${event.title}`}
        className="shrink-0 rounded p-1 text-surface-300 opacity-0 transition-opacity group-hover:opacity-100 focus:opacity-100 hover:bg-err-soft hover:text-err"
      >
        <Trash2 className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}
