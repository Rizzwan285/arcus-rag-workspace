"use client";

import { cn } from "@/lib/utils";
import {
  BookOpen,
  FileText,
  GraduationCap,
  Clock,
  CheckCircle,
  Target,
  AlertTriangle,
} from "lucide-react";

// Event type to icon mapping
const EVENT_TYPE_CONFIG: Record<
  string,
  { icon: typeof BookOpen; label: string; color: string; bg: string }
> = {
  EXAM: {
    icon: GraduationCap,
    label: "Exam",
    color: "text-red-600",
    bg: "bg-red-50 border-red-200",
  },
  ASSIGNMENT: {
    icon: FileText,
    label: "Assignment",
    color: "text-blue-600",
    bg: "bg-blue-50 border-blue-200",
  },
  DEADLINE: {
    icon: AlertTriangle,
    label: "Deadline",
    color: "text-amber-600",
    bg: "bg-amber-50 border-amber-200",
  },
  LECTURE: {
    icon: BookOpen,
    label: "Lecture",
    color: "text-purple-600",
    bg: "bg-purple-50 border-purple-200",
  },
  STUDY_SESSION: {
    icon: Target,
    label: "Study",
    color: "text-emerald-600",
    bg: "bg-emerald-50 border-emerald-200",
  },
  REVIEW: {
    icon: Clock,
    label: "Review",
    color: "text-teal-600",
    bg: "bg-teal-50 border-teal-200",
  },
  OTHER: {
    icon: Clock,
    label: "Other",
    color: "text-surface-600",
    bg: "bg-surface-50 border-surface-200",
  },
};

const PRIORITY_DOT: Record<string, string> = {
  LOW: "bg-surface-300",
  MEDIUM: "bg-blue-400",
  HIGH: "bg-amber-500",
  CRITICAL: "bg-red-500",
};

interface EventCardProps {
  event: {
    id: string;
    title: string;
    description: string | null;
    eventType: string;
    date: Date;
    priority: string;
    completed: boolean;
    document?: { id: string; title: string } | null;
  };
  onToggleComplete: (id: string) => void;
  onDelete: (id: string) => void;
  compact?: boolean;
}

export default function EventCard({
  event,
  onToggleComplete,
  onDelete,
  compact = false,
}: EventCardProps) {
  const config = EVENT_TYPE_CONFIG[event.eventType] || EVENT_TYPE_CONFIG.OTHER;
  const Icon = config.icon;
  const priorityDot = PRIORITY_DOT[event.priority] || PRIORITY_DOT.MEDIUM;

  const eventDate = new Date(event.date);
  const isToday =
    eventDate.toDateString() === new Date().toDateString();
  const isPast = eventDate < new Date() && !isToday;

  if (compact) {
    return (
      <div
        className={cn(
          "flex items-center gap-2 rounded-lg px-2 py-1 text-xs",
          config.bg,
          event.completed && "opacity-50"
        )}
      >
        <span className={cn("h-1.5 w-1.5 rounded-full", priorityDot)} />
        <span className={cn("truncate font-medium", config.color)}>
          {event.title}
        </span>
      </div>
    );
  }

  return (
    <div
      className={cn(
        "group rounded-xl border p-4 transition-all hover:shadow-md",
        config.bg,
        event.completed && "opacity-60",
        isPast && !event.completed && "border-dashed"
      )}
    >
      <div className="flex items-start gap-3">
        {/* Completion Toggle */}
        <button
          onClick={() => onToggleComplete(event.id)}
          className={cn(
            "mt-0.5 flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full border-2 transition-colors",
            event.completed
              ? "border-emerald-500 bg-emerald-500 text-white"
              : "border-surface-300 hover:border-arcus-500"
          )}
        >
          {event.completed && <CheckCircle className="h-3 w-3" />}
        </button>

        {/* Content */}
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <Icon className={cn("h-4 w-4 flex-shrink-0", config.color)} />
            <h3
              className={cn(
                "truncate text-sm font-semibold text-surface-900",
                event.completed && "line-through"
              )}
            >
              {event.title}
            </h3>
            <span className={cn("h-2 w-2 rounded-full flex-shrink-0", priorityDot)} />
          </div>

          {event.description && (
            <p className="mt-1 line-clamp-2 text-xs text-surface-500">
              {event.description}
            </p>
          )}

          <div className="mt-2 flex items-center gap-3 text-[10px] text-surface-400">
            <span
              className={cn(
                "rounded-full px-2 py-0.5 font-medium",
                isToday
                  ? "bg-arcus-100 text-arcus-700"
                  : isPast
                    ? "bg-red-100 text-red-600"
                    : "bg-surface-100 text-surface-600"
              )}
            >
              {isToday
                ? "Today"
                : eventDate.toLocaleDateString("en-US", {
                    weekday: "short",
                    month: "short",
                    day: "numeric",
                  })}
            </span>
            <span className="font-medium uppercase">{config.label}</span>
            {event.document && (
              <span className="truncate">📄 {event.document.title}</span>
            )}
          </div>
        </div>

        {/* Delete */}
        <button
          onClick={() => onDelete(event.id)}
          className="rounded-lg p-1 text-surface-300 opacity-0 transition-all hover:bg-white/50 hover:text-red-500 group-hover:opacity-100"
        >
          ×
        </button>
      </div>
    </div>
  );
}

/** Helper to get the event dot color for calendar cells */
export function getEventDotColor(eventType: string): string {
  return EVENT_TYPE_CONFIG[eventType]?.color || "text-surface-400";
}
