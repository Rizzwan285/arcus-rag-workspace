"use client";

import { useEffect, useMemo, useState } from "react";
import { CalendarDays, Plus, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { trpc } from "@/lib/trpc/client";
import CalendarGrid, { EVENT_DOT } from "@/components/features/CalendarGrid";
import EventCard from "@/components/features/EventCard";
import {
  Button,
  Metric,
  Panel,
  PanelHeader,
  PageHeader,
  Skeleton,
} from "@/components/ui";

const EVENT_TYPES = [
  { value: "EXAM", label: "Exam" },
  { value: "ASSIGNMENT", label: "Assignment" },
  { value: "DEADLINE", label: "Deadline" },
  { value: "LECTURE", label: "Lecture" },
  { value: "STUDY_SESSION", label: "Study" },
  { value: "REVIEW", label: "Review" },
  { value: "OTHER", label: "Other" },
] as const;

const PRIORITIES = [
  { value: "LOW", label: "Low" },
  { value: "MEDIUM", label: "Medium" },
  { value: "HIGH", label: "High" },
  { value: "CRITICAL", label: "Critical" },
] as const;

type EventType = (typeof EVENT_TYPES)[number]["value"];
type Priority = (typeof PRIORITIES)[number]["value"];

export default function CalendarPage() {
  const [currentMonth, setCurrentMonth] = useState(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  });
  const [selectedDate, setSelectedDate] = useState<Date | null>(new Date());
  const [showCreate, setShowCreate] = useState(false);

  const [form, setForm] = useState({
    title: "",
    description: "",
    eventType: "STUDY_SESSION" as EventType,
    date: new Date().toISOString().split("T")[0],
    priority: "MEDIUM" as Priority,
  });

  const utils = trpc.useUtils();

  // Pad the window by a week either side so trailing/leading cells show dots.
  const startDate = useMemo(
    () => new Date(currentMonth.getFullYear(), currentMonth.getMonth(), -7).toISOString(),
    [currentMonth]
  );
  const endDate = useMemo(
    () => new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 7).toISOString(),
    [currentMonth]
  );

  const { data: events, isLoading } = trpc.calendar.getEvents.useQuery({
    startDate,
    endDate,
  });
  const { data: stats } = trpc.calendar.getStats.useQuery();

  const refresh = () => {
    void utils.calendar.getEvents.invalidate();
    void utils.calendar.getStats.invalidate();
  };

  const createEvent = trpc.calendar.createEvent.useMutation({
    onSuccess: () => {
      refresh();
      setShowCreate(false);
      setForm((prev) => ({ ...prev, title: "", description: "" }));
    },
  });
  const toggleComplete = trpc.calendar.toggleComplete.useMutation({ onSuccess: refresh });
  const deleteEvent = trpc.calendar.deleteEvent.useMutation({ onSuccess: refresh });

  const selectedEvents = useMemo(() => {
    if (!selectedDate || !events) return [];
    return events.filter(
      (e) => new Date(e.date).toDateString() === selectedDate.toDateString()
    );
  }, [events, selectedDate]);

  // Close the dialog on Escape.
  useEffect(() => {
    if (!showCreate) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setShowCreate(false);
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [showCreate]);

  const openCreate = () => {
    if (selectedDate) {
      setForm((prev) => ({
        ...prev,
        date: selectedDate.toISOString().split("T")[0],
      }));
    }
    setShowCreate(true);
  };

  const fieldClass =
    "w-full rounded-md border border-line bg-surface-0 px-3 py-2 text-sm text-surface-900 placeholder:text-surface-400 focus:border-surface-400 focus:outline-none";

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Study"
        title="Calendar"
        description="Exams, deadlines, and study sessions — added by hand, or extracted from your documents by the chat assistant."
        action={
          <Button variant="solid" onClick={openCreate}>
            <Plus className="h-3.5 w-3.5" />
            Add event
          </Button>
        }
      />

      {stats && (
        <Panel className="grid grid-cols-2 divide-line md:grid-cols-4 md:divide-x">
          <div className="border-b border-line p-4 md:border-b-0">
            <Metric label="Events" value={stats.totalEvents} />
          </div>
          <div className="border-b border-line p-4 md:border-b-0">
            <Metric
              label="Upcoming exams"
              value={stats.upcomingExams}
              tone={stats.upcomingExams > 0 ? "err" : "idle"}
            />
          </div>
          <div className="p-4">
            <Metric
              label="Pending"
              value={stats.pendingTasks}
              tone={stats.pendingTasks > 0 ? "warn" : "idle"}
            />
          </div>
          <div className="p-4">
            <Metric
              label="Completed"
              value={stats.completedTasks}
              tone={stats.completedTasks > 0 ? "ok" : "idle"}
            />
          </div>
        </Panel>
      )}

      <div className="grid gap-5 lg:grid-cols-[1.7fr_1fr]">
        <CalendarGrid
          events={events ?? []}
          selectedDate={selectedDate}
          onSelectDate={setSelectedDate}
          currentMonth={currentMonth}
          onMonthChange={setCurrentMonth}
        />

        <div className="space-y-4">
          <Panel>
            <PanelHeader
              title={
                selectedDate
                  ? selectedDate.toLocaleDateString("en-US", {
                      weekday: "long",
                      month: "long",
                      day: "numeric",
                    })
                  : "Select a date"
              }
              description={
                selectedEvents.length > 0
                  ? `${selectedEvents.length} event${selectedEvents.length === 1 ? "" : "s"}`
                  : undefined
              }
              action={
                <Button variant="ghost" size="sm" onClick={openCreate}>
                  <Plus className="h-3 w-3" />
                  Add
                </Button>
              }
            />

            <div className="space-y-2 p-3">
              {isLoading ? (
                [0, 1].map((i) => <Skeleton key={i} className="h-16 w-full" />)
              ) : selectedEvents.length > 0 ? (
                selectedEvents.map((event) => (
                  <EventCard
                    key={event.id}
                    event={event}
                    onToggleComplete={(id) => toggleComplete.mutate({ id })}
                    onDelete={(id) => deleteEvent.mutate({ id })}
                  />
                ))
              ) : (
                <div className="flex flex-col items-center px-4 py-8 text-center">
                  <CalendarDays
                    className="mb-2 h-5 w-5 text-surface-300"
                    strokeWidth={1.5}
                  />
                  <p className="text-xs font-medium text-surface-500">
                    Nothing scheduled
                  </p>
                  <p className="mt-0.5 text-xs text-surface-400">
                    Add an event, or ask the chat to extract deadlines from your
                    documents.
                  </p>
                </div>
              )}
            </div>
          </Panel>

          <Panel className="p-4">
            <p className="font-mono text-2xs tracking-[0.12em] text-surface-400 uppercase">
              Legend
            </p>
            <div className="mt-2.5 grid grid-cols-2 gap-x-3 gap-y-1.5">
              {EVENT_TYPES.map((type) => (
                <span
                  key={type.value}
                  className="flex items-center gap-1.5 text-xs text-surface-500"
                >
                  <span
                    className={cn(
                      "h-1.5 w-1.5 rounded-full",
                      EVENT_DOT[type.value]
                    )}
                  />
                  {type.label}
                </span>
              ))}
            </div>
          </Panel>
        </div>
      </div>

      {/* ── Create dialog ── */}
      {showCreate && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-surface-950/25 p-4"
          onClick={(event) => {
            if (event.target === event.currentTarget) setShowCreate(false);
          }}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Add study event"
            className="w-full max-w-md overflow-hidden rounded-lg border border-line bg-surface-0 shadow-xl"
          >
            <div className="flex items-center justify-between border-b border-line px-4 py-3">
              <h2 className="text-sm font-semibold text-surface-900">
                Add study event
              </h2>
              <button
                onClick={() => setShowCreate(false)}
                aria-label="Close"
                className="rounded p-1 text-surface-400 transition-colors hover:bg-surface-100 hover:text-surface-700"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form
              onSubmit={(event) => {
                event.preventDefault();
                if (!form.title.trim()) return;
                createEvent.mutate({
                  title: form.title.trim(),
                  description: form.description.trim() || undefined,
                  eventType: form.eventType,
                  date: form.date,
                  priority: form.priority,
                });
              }}
              className="space-y-4 p-4"
            >
              <div>
                <label
                  htmlFor="event-title"
                  className="mb-1.5 block font-mono text-2xs tracking-[0.1em] text-surface-400 uppercase"
                >
                  Title
                </label>
                <input
                  id="event-title"
                  value={form.title}
                  onChange={(event) =>
                    setForm((prev) => ({ ...prev, title: event.target.value }))
                  }
                  placeholder="Midterm exam, problem set 3…"
                  required
                  autoFocus
                  className={fieldClass}
                />
              </div>

              <div>
                <span className="mb-1.5 block font-mono text-2xs tracking-[0.1em] text-surface-400 uppercase">
                  Type
                </span>
                <div className="flex flex-wrap gap-1.5">
                  {EVENT_TYPES.map((type) => (
                    <button
                      key={type.value}
                      type="button"
                      onClick={() =>
                        setForm((prev) => ({ ...prev, eventType: type.value }))
                      }
                      aria-pressed={form.eventType === type.value}
                      className={cn(
                        "flex items-center gap-1.5 rounded-md border px-2.5 py-1 text-xs transition-colors",
                        form.eventType === type.value
                          ? "border-surface-900 bg-surface-900 text-white"
                          : "border-line text-surface-600 hover:border-line-strong"
                      )}
                    >
                      <span
                        className={cn(
                          "h-1.5 w-1.5 rounded-full",
                          EVENT_DOT[type.value]
                        )}
                      />
                      {type.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label
                    htmlFor="event-date"
                    className="mb-1.5 block font-mono text-2xs tracking-[0.1em] text-surface-400 uppercase"
                  >
                    Date
                  </label>
                  <input
                    id="event-date"
                    type="date"
                    value={form.date}
                    onChange={(event) =>
                      setForm((prev) => ({ ...prev, date: event.target.value }))
                    }
                    required
                    className={cn(fieldClass, "font-mono tabular")}
                  />
                </div>
                <div>
                  <label
                    htmlFor="event-priority"
                    className="mb-1.5 block font-mono text-2xs tracking-[0.1em] text-surface-400 uppercase"
                  >
                    Priority
                  </label>
                  <select
                    id="event-priority"
                    value={form.priority}
                    onChange={(event) =>
                      setForm((prev) => ({
                        ...prev,
                        priority: event.target.value as Priority,
                      }))
                    }
                    className={fieldClass}
                  >
                    {PRIORITIES.map((priority) => (
                      <option key={priority.value} value={priority.value}>
                        {priority.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label
                  htmlFor="event-description"
                  className="mb-1.5 block font-mono text-2xs tracking-[0.1em] text-surface-400 uppercase"
                >
                  Notes
                </label>
                <textarea
                  id="event-description"
                  value={form.description}
                  onChange={(event) =>
                    setForm((prev) => ({
                      ...prev,
                      description: event.target.value,
                    }))
                  }
                  rows={2}
                  placeholder="Optional"
                  className={cn(fieldClass, "resize-none")}
                />
              </div>

              <div className="flex justify-end gap-2 border-t border-line pt-3">
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => setShowCreate(false)}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  variant="solid"
                  loading={createEvent.isPending}
                  disabled={!form.title.trim()}
                >
                  Add to calendar
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
