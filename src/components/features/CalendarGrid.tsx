"use client";

import { useMemo } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

interface CalendarEvent {
  id: string;
  title: string;
  eventType: string;
  date: Date;
  priority: string;
  completed: boolean;
}

interface CalendarGridProps {
  events: CalendarEvent[];
  selectedDate: Date | null;
  onSelectDate: (date: Date) => void;
  currentMonth: Date;
  onMonthChange: (date: Date) => void;
}

const DAYS = ["Mo", "Tu", "We", "Th", "Fr", "Sa", "Su"];
const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

/** One colour per kind, drawn from the status palette rather than a rainbow. */
export const EVENT_DOT: Record<string, string> = {
  EXAM: "bg-err",
  ASSIGNMENT: "bg-busy",
  DEADLINE: "bg-warn",
  LECTURE: "bg-surface-500",
  STUDY_SESSION: "bg-ok",
  REVIEW: "bg-surface-400",
  OTHER: "bg-surface-300",
};

export default function CalendarGrid({
  events,
  selectedDate,
  onSelectDate,
  currentMonth,
  onMonthChange,
}: CalendarGridProps) {
  const year = currentMonth.getFullYear();
  const month = currentMonth.getMonth();

  const calendarDays = useMemo(() => {
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    // Monday-first: JS weeks start on Sunday, so shift by one.
    const startPadding = (firstDay.getDay() + 6) % 7;
    const daysInMonth = lastDay.getDate();
    const prevMonthLastDay = new Date(year, month, 0).getDate();

    const days: Array<{ date: Date; isCurrentMonth: boolean; isToday: boolean }> = [];
    const today = new Date();

    for (let i = startPadding - 1; i >= 0; i--) {
      days.push({
        date: new Date(year, month - 1, prevMonthLastDay - i),
        isCurrentMonth: false,
        isToday: false,
      });
    }

    for (let d = 1; d <= daysInMonth; d++) {
      const date = new Date(year, month, d);
      days.push({
        date,
        isCurrentMonth: true,
        isToday: date.toDateString() === today.toDateString(),
      });
    }

    for (let i = 1; days.length < 42; i++) {
      days.push({
        date: new Date(year, month + 1, i),
        isCurrentMonth: false,
        isToday: false,
      });
    }

    return days;
  }, [year, month]);

  const eventsByDate = useMemo(() => {
    const map = new Map<string, CalendarEvent[]>();
    for (const event of events) {
      const key = new Date(event.date).toDateString();
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(event);
    }
    return map;
  }, [events]);

  return (
    <div className="panel overflow-hidden">
      <div className="flex items-center justify-between border-b border-line px-4 py-3">
        <div className="flex items-baseline gap-2">
          <h2 className="text-sm font-semibold text-surface-900">
            {MONTHS[month]}
          </h2>
          <span className="font-mono text-xs tabular text-surface-400">
            {year}
          </span>
        </div>

        <div className="flex items-center gap-1">
          <button
            onClick={() => {
              const today = new Date();
              onMonthChange(new Date(today.getFullYear(), today.getMonth(), 1));
              onSelectDate(today);
            }}
            className="rounded-md px-2 py-1 text-xs text-surface-500 transition-colors hover:bg-surface-100 hover:text-surface-900"
          >
            Today
          </button>
          <button
            onClick={() => onMonthChange(new Date(year, month - 1, 1))}
            aria-label="Previous month"
            className="rounded-md p-1.5 text-surface-400 transition-colors hover:bg-surface-100 hover:text-surface-700"
          >
            <ChevronLeft className="h-3.5 w-3.5" />
          </button>
          <button
            onClick={() => onMonthChange(new Date(year, month + 1, 1))}
            aria-label="Next month"
            className="rounded-md p-1.5 text-surface-400 transition-colors hover:bg-surface-100 hover:text-surface-700"
          >
            <ChevronRight className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      <div className="grid grid-cols-7 border-b border-line bg-surface-50">
        {DAYS.map((day) => (
          <div
            key={day}
            className="py-1.5 text-center font-mono text-2xs tracking-[0.08em] text-surface-400 uppercase"
          >
            {day}
          </div>
        ))}
      </div>

      <div className="grid grid-cols-7">
        {calendarDays.map((day, index) => {
          const dateKey = day.date.toDateString();
          const dayEvents = eventsByDate.get(dateKey) ?? [];
          const isSelected = selectedDate?.toDateString() === dateKey;

          return (
            <button
              key={index}
              onClick={() => onSelectDate(day.date)}
              aria-current={day.isToday ? "date" : undefined}
              className={cn(
                "relative flex h-[76px] flex-col items-start gap-1 border-r border-b border-line p-1.5 text-left transition-colors",
                // Trim the outer edges so the grid reads as one block.
                index % 7 === 6 && "border-r-0",
                index >= 35 && "border-b-0",
                !day.isCurrentMonth && "bg-surface-50",
                isSelected ? "bg-surface-200/60" : "hover:bg-surface-50"
              )}
            >
              <span
                className={cn(
                  "flex h-5 min-w-5 items-center justify-center rounded font-mono text-2xs tabular",
                  day.isToday
                    ? "bg-surface-900 px-1 text-white"
                    : day.isCurrentMonth
                      ? "text-surface-700"
                      : "text-surface-300"
                )}
              >
                {day.date.getDate()}
              </span>

              {dayEvents.length > 0 && (
                <div className="mt-auto flex w-full flex-wrap items-center gap-0.5">
                  {dayEvents.slice(0, 4).map((event) => (
                    <span
                      key={event.id}
                      title={event.title}
                      className={cn(
                        "h-1 w-1 rounded-full",
                        event.completed
                          ? "bg-surface-300"
                          : (EVENT_DOT[event.eventType] ?? "bg-surface-400")
                      )}
                    />
                  ))}
                  {dayEvents.length > 4 && (
                    <span className="font-mono text-2xs text-surface-400">
                      +{dayEvents.length - 4}
                    </span>
                  )}
                </div>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
