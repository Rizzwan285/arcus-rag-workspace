"use client";

import { useState, useMemo } from "react";
import {
  CalendarDays,
  Plus,
  ListTodo,
  Target,
  GraduationCap,
  Clock,
  TrendingUp,
  Sparkles,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { trpc } from "@/lib/trpc/client";
import CalendarGrid from "@/components/features/CalendarGrid";
import EventCard from "@/components/features/EventCard";

const EVENT_TYPE_OPTIONS = [
  { value: "EXAM", label: "Exam", icon: GraduationCap },
  { value: "ASSIGNMENT", label: "Assignment", icon: ListTodo },
  { value: "DEADLINE", label: "Deadline", icon: Clock },
  { value: "STUDY_SESSION", label: "Study Session", icon: Target },
  { value: "REVIEW", label: "Review", icon: TrendingUp },
  { value: "OTHER", label: "Other", icon: CalendarDays },
];

const PRIORITY_OPTIONS = [
  { value: "LOW", label: "Low", color: "bg-surface-300" },
  { value: "MEDIUM", label: "Medium", color: "bg-blue-400" },
  { value: "HIGH", label: "High", color: "bg-amber-500" },
  { value: "CRITICAL", label: "Critical", color: "bg-red-500" },
];

export default function CalendarPage() {
  const [currentMonth, setCurrentMonth] = useState(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  });
  const [selectedDate, setSelectedDate] = useState<Date | null>(new Date());
  const [showCreateModal, setShowCreateModal] = useState(false);

  // Form state for creating events
  const [newEvent, setNewEvent] = useState({
    title: "",
    description: "",
    eventType: "STUDY_SESSION" as string,
    date: new Date().toISOString().split("T")[0],
    priority: "MEDIUM" as string,
  });

  const utils = trpc.useUtils();

  // Query events for the current month view (padded by a week on each side)
  const startDate = useMemo(() => {
    const d = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), -7);
    return d.toISOString();
  }, [currentMonth]);

  const endDate = useMemo(() => {
    const d = new Date(
      currentMonth.getFullYear(),
      currentMonth.getMonth() + 1,
      7
    );
    return d.toISOString();
  }, [currentMonth]);

  const { data: events, isLoading } = trpc.calendar.getEvents.useQuery({
    startDate,
    endDate,
  });

  const { data: stats } = trpc.calendar.getStats.useQuery();

  const createEvent = trpc.calendar.createEvent.useMutation({
    onSuccess: () => {
      utils.calendar.getEvents.invalidate();
      utils.calendar.getStats.invalidate();
      setShowCreateModal(false);
      setNewEvent({
        title: "",
        description: "",
        eventType: "STUDY_SESSION",
        date: new Date().toISOString().split("T")[0],
        priority: "MEDIUM",
      });
    },
  });

  const toggleComplete = trpc.calendar.toggleComplete.useMutation({
    onSuccess: () => {
      utils.calendar.getEvents.invalidate();
      utils.calendar.getStats.invalidate();
    },
  });

  const deleteEvent = trpc.calendar.deleteEvent.useMutation({
    onSuccess: () => {
      utils.calendar.getEvents.invalidate();
      utils.calendar.getStats.invalidate();
    },
  });

  // Filter events for the selected date
  const selectedDateEvents = useMemo(() => {
    if (!selectedDate || !events) return [];
    return events.filter(
      (e) => new Date(e.date).toDateString() === selectedDate.toDateString()
    );
  }, [events, selectedDate]);

  const handleCreateEvent = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newEvent.title.trim()) return;

    createEvent.mutate({
      title: newEvent.title.trim(),
      description: newEvent.description.trim() || undefined,
      eventType: newEvent.eventType as
        | "EXAM"
        | "ASSIGNMENT"
        | "DEADLINE"
        | "LECTURE"
        | "STUDY_SESSION"
        | "REVIEW"
        | "OTHER",
      date: newEvent.date,
      priority: newEvent.priority as "LOW" | "MEDIUM" | "HIGH" | "CRITICAL",
    });
  };

  return (
    <div className="mx-auto max-w-6xl">
      {/* Header */}
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-surface-900">
            Study Calendar
          </h1>
          <p className="mt-1 text-surface-500">
            Track exams, deadlines, and study sessions
          </p>
        </div>
        <button
          onClick={() => {
            if (selectedDate) {
              setNewEvent((prev) => ({
                ...prev,
                date: selectedDate.toISOString().split("T")[0],
              }));
            }
            setShowCreateModal(true);
          }}
          className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-arcus-600 to-arcus-500 px-4 py-2.5 text-sm font-semibold text-white shadow-md shadow-arcus-600/20 transition-all hover:shadow-lg hover:shadow-arcus-600/30 active:scale-[0.98]"
        >
          <Plus className="h-4 w-4" />
          Add Event
        </button>
      </div>

      {/* Stats */}
      {stats && (
        <div className="mb-6 grid grid-cols-2 gap-4 md:grid-cols-4">
          {[
            {
              label: "Total Events",
              value: stats.totalEvents,
              icon: CalendarDays,
              color: "text-arcus-600",
              bg: "bg-arcus-50",
            },
            {
              label: "Upcoming Exams",
              value: stats.upcomingExams,
              icon: GraduationCap,
              color: "text-red-600",
              bg: "bg-red-50",
            },
            {
              label: "Pending Tasks",
              value: stats.pendingTasks,
              icon: Target,
              color: "text-amber-600",
              bg: "bg-amber-50",
            },
            {
              label: "Completed",
              value: stats.completedTasks,
              icon: TrendingUp,
              color: "text-emerald-600",
              bg: "bg-emerald-50",
            },
          ].map((stat) => (
            <div
              key={stat.label}
              className="rounded-2xl border border-surface-200 bg-white p-4 shadow-sm"
            >
              <div className="flex items-center gap-3">
                <div className={cn("rounded-xl p-2.5", stat.bg)}>
                  <stat.icon className={cn("h-5 w-5", stat.color)} />
                </div>
                <div>
                  <p className="text-xs text-surface-500">{stat.label}</p>
                  <p className="text-xl font-bold text-surface-900">
                    {stat.value}
                  </p>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Main Content */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Calendar Grid */}
        <div className="lg:col-span-2">
          <CalendarGrid
            events={events || []}
            selectedDate={selectedDate}
            onSelectDate={setSelectedDate}
            currentMonth={currentMonth}
            onMonthChange={setCurrentMonth}
          />
        </div>

        {/* Events Sidebar */}
        <div className="space-y-4">
          <div className="rounded-2xl border border-surface-200 bg-white p-5 shadow-sm">
            <h3 className="mb-4 flex items-center gap-2 text-sm font-semibold text-surface-900">
              <CalendarDays className="h-4 w-4 text-arcus-500" />
              {selectedDate
                ? selectedDate.toLocaleDateString("en-US", {
                    weekday: "long",
                    month: "long",
                    day: "numeric",
                  })
                : "Select a date"}
            </h3>

            {isLoading ? (
              <div className="space-y-3">
                {[1, 2, 3].map((i) => (
                  <div
                    key={i}
                    className="h-20 animate-pulse rounded-xl bg-surface-100"
                  />
                ))}
              </div>
            ) : selectedDateEvents.length > 0 ? (
              <div className="space-y-3">
                {selectedDateEvents.map((event) => (
                  <EventCard
                    key={event.id}
                    event={event}
                    onToggleComplete={(id) => toggleComplete.mutate({ id })}
                    onDelete={(id) => deleteEvent.mutate({ id })}
                  />
                ))}
              </div>
            ) : (
              <div className="flex flex-col items-center py-8 text-center">
                <CalendarDays className="mb-3 h-8 w-8 text-surface-300" />
                <p className="text-sm font-medium text-surface-500">
                  No events on this day
                </p>
                <p className="mt-1 text-xs text-surface-400">
                  Ask Arcus to extract dates from your documents, or add events
                  manually.
                </p>
                <button
                  onClick={() => {
                    if (selectedDate) {
                      setNewEvent((prev) => ({
                        ...prev,
                        date: selectedDate.toISOString().split("T")[0],
                      }));
                    }
                    setShowCreateModal(true);
                  }}
                  className="mt-4 flex items-center gap-1.5 rounded-lg bg-arcus-50 px-3 py-1.5 text-xs font-medium text-arcus-600 transition-colors hover:bg-arcus-100"
                >
                  <Plus className="h-3 w-3" />
                  Add event
                </button>
              </div>
            )}
          </div>

          {/* AI Tip */}
          <div className="rounded-2xl border border-arcus-200 bg-gradient-to-br from-arcus-50/50 to-purple-50/50 p-5">
            <div className="flex items-start gap-3">
              <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-arcus-500 to-purple-500">
                <Sparkles className="h-4 w-4 text-white" />
              </div>
              <div>
                <h4 className="text-sm font-semibold text-surface-900">
                  AI-Powered Scheduling
                </h4>
                <p className="mt-1 text-xs text-surface-500">
                  Use the Chat page to ask Arcus to automatically extract dates
                  and deadlines from your documents, or generate a study plan
                  for your upcoming exams.
                </p>
                <p className="mt-2 text-xs font-medium text-arcus-600">
                  Try: &quot;Extract all deadlines from my documents&quot;
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Create Event Modal */}
      {showCreateModal && (
        <>
          <div
            className="fixed inset-0 z-40 bg-black/30 backdrop-blur-sm"
            onClick={() => setShowCreateModal(false)}
          />
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="w-full max-w-md rounded-2xl border border-surface-200 bg-white p-6 shadow-2xl">
              <div className="mb-6 flex items-center justify-between">
                <h3 className="text-lg font-bold text-surface-900">
                  Add Study Event
                </h3>
                <button
                  onClick={() => setShowCreateModal(false)}
                  className="rounded-lg p-1 text-surface-400 hover:bg-surface-100 hover:text-surface-600"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              <form onSubmit={handleCreateEvent} className="space-y-4">
                {/* Title */}
                <div>
                  <label className="mb-1.5 block text-xs font-medium text-surface-700">
                    Title
                  </label>
                  <input
                    type="text"
                    value={newEvent.title}
                    onChange={(e) =>
                      setNewEvent((prev) => ({
                        ...prev,
                        title: e.target.value,
                      }))
                    }
                    placeholder="e.g. Midterm Exam, Assignment Due"
                    className="w-full rounded-xl border border-surface-200 bg-surface-50 px-4 py-2.5 text-sm text-surface-900 placeholder:text-surface-400 focus:border-arcus-500 focus:bg-white focus:ring-2 focus:ring-arcus-500/20 focus:outline-none"
                    required
                  />
                </div>

                {/* Event Type */}
                <div>
                  <label className="mb-1.5 block text-xs font-medium text-surface-700">
                    Type
                  </label>
                  <div className="grid grid-cols-3 gap-2">
                    {EVENT_TYPE_OPTIONS.map((opt) => (
                      <button
                        key={opt.value}
                        type="button"
                        onClick={() =>
                          setNewEvent((prev) => ({
                            ...prev,
                            eventType: opt.value,
                          }))
                        }
                        className={cn(
                          "flex items-center gap-1.5 rounded-lg border px-3 py-2 text-xs font-medium transition-all",
                          newEvent.eventType === opt.value
                            ? "border-arcus-500 bg-arcus-50 text-arcus-700"
                            : "border-surface-200 text-surface-500 hover:border-surface-300"
                        )}
                      >
                        <opt.icon className="h-3.5 w-3.5" />
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Date */}
                <div>
                  <label className="mb-1.5 block text-xs font-medium text-surface-700">
                    Date
                  </label>
                  <input
                    type="date"
                    value={newEvent.date}
                    onChange={(e) =>
                      setNewEvent((prev) => ({
                        ...prev,
                        date: e.target.value,
                      }))
                    }
                    className="w-full rounded-xl border border-surface-200 bg-surface-50 px-4 py-2.5 text-sm text-surface-900 focus:border-arcus-500 focus:bg-white focus:ring-2 focus:ring-arcus-500/20 focus:outline-none"
                    required
                  />
                </div>

                {/* Priority */}
                <div>
                  <label className="mb-1.5 block text-xs font-medium text-surface-700">
                    Priority
                  </label>
                  <div className="flex gap-2">
                    {PRIORITY_OPTIONS.map((opt) => (
                      <button
                        key={opt.value}
                        type="button"
                        onClick={() =>
                          setNewEvent((prev) => ({
                            ...prev,
                            priority: opt.value,
                          }))
                        }
                        className={cn(
                          "flex items-center gap-1.5 rounded-lg border px-3 py-2 text-xs font-medium transition-all",
                          newEvent.priority === opt.value
                            ? "border-arcus-500 bg-arcus-50 text-arcus-700"
                            : "border-surface-200 text-surface-500 hover:border-surface-300"
                        )}
                      >
                        <span
                          className={cn("h-2 w-2 rounded-full", opt.color)}
                        />
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Description */}
                <div>
                  <label className="mb-1.5 block text-xs font-medium text-surface-700">
                    Description (optional)
                  </label>
                  <textarea
                    value={newEvent.description}
                    onChange={(e) =>
                      setNewEvent((prev) => ({
                        ...prev,
                        description: e.target.value,
                      }))
                    }
                    placeholder="Additional notes..."
                    rows={2}
                    className="w-full rounded-xl border border-surface-200 bg-surface-50 px-4 py-2.5 text-sm text-surface-900 placeholder:text-surface-400 focus:border-arcus-500 focus:bg-white focus:ring-2 focus:ring-arcus-500/20 focus:outline-none"
                  />
                </div>

                {/* Submit */}
                <button
                  type="submit"
                  disabled={createEvent.isPending || !newEvent.title.trim()}
                  className="w-full rounded-xl bg-gradient-to-r from-arcus-600 to-arcus-500 py-2.5 text-sm font-semibold text-white shadow-md shadow-arcus-600/20 transition-all hover:shadow-lg hover:shadow-arcus-600/30 disabled:opacity-50"
                >
                  {createEvent.isPending ? "Creating..." : "Add to Calendar"}
                </button>
              </form>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
