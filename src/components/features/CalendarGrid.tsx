"use client";

import { useState, useMemo } from "react";
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

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

const EVENT_DOT_COLORS: Record<string, string> = {
  EXAM: "bg-red-500",
  ASSIGNMENT: "bg-blue-500",
  DEADLINE: "bg-amber-500",
  LECTURE: "bg-purple-500",
  STUDY_SESSION: "bg-emerald-500",
  REVIEW: "bg-teal-500",
  OTHER: "bg-surface-400",
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

  // Build calendar grid
  const calendarDays = useMemo(() => {
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const startPadding = firstDay.getDay();
    const daysInMonth = lastDay.getDate();

    // Previous month's trailing days
    const prevMonthLastDay = new Date(year, month, 0).getDate();
    const days: Array<{
      date: Date;
      isCurrentMonth: boolean;
      isToday: boolean;
    }> = [];

    for (let i = startPadding - 1; i >= 0; i--) {
      days.push({
        date: new Date(year, month - 1, prevMonthLastDay - i),
        isCurrentMonth: false,
        isToday: false,
      });
    }

    const today = new Date();
    for (let d = 1; d <= daysInMonth; d++) {
      const date = new Date(year, month, d);
      days.push({
        date,
        isCurrentMonth: true,
        isToday: date.toDateString() === today.toDateString(),
      });
    }

    // Next month's leading days (fill to 6 rows)
    const remaining = 42 - days.length;
    for (let i = 1; i <= remaining; i++) {
      days.push({
        date: new Date(year, month + 1, i),
        isCurrentMonth: false,
        isToday: false,
      });
    }

    return days;
  }, [year, month]);

  // Map events by date string
  const eventsByDate = useMemo(() => {
    const map = new Map<string, CalendarEvent[]>();
    for (const event of events) {
      const key = new Date(event.date).toDateString();
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(event);
    }
    return map;
  }, [events]);

  const goToPrevMonth = () => onMonthChange(new Date(year, month - 1, 1));
  const goToNextMonth = () => onMonthChange(new Date(year, month + 1, 1));
  const goToToday = () => {
    const today = new Date();
    onMonthChange(new Date(today.getFullYear(), today.getMonth(), 1));
    onSelectDate(today);
  };

  return (
    <div className="rounded-2xl border border-surface-200 bg-white shadow-sm">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-surface-200 px-6 py-4">
        <div className="flex items-center gap-3">
          <h2 className="text-lg font-bold text-surface-900">
            {MONTHS[month]} {year}
          </h2>
          <button
            onClick={goToToday}
            className="rounded-lg bg-surface-100 px-3 py-1 text-xs font-medium text-surface-600 transition-colors hover:bg-surface-200"
          >
            Today
          </button>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={goToPrevMonth}
            className="rounded-lg p-2 text-surface-400 transition-colors hover:bg-surface-100 hover:text-surface-600"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <button
            onClick={goToNextMonth}
            className="rounded-lg p-2 text-surface-400 transition-colors hover:bg-surface-100 hover:text-surface-600"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Day headers */}
      <div className="grid grid-cols-7 border-b border-surface-100">
        {DAYS.map((day) => (
          <div
            key={day}
            className="py-2 text-center text-xs font-semibold uppercase tracking-wider text-surface-400"
          >
            {day}
          </div>
        ))}
      </div>

      {/* Calendar cells */}
      <div className="grid grid-cols-7">
        {calendarDays.map((day, index) => {
          const dateKey = day.date.toDateString();
          const dayEvents = eventsByDate.get(dateKey) || [];
          const isSelected =
            selectedDate && selectedDate.toDateString() === dateKey;

          return (
            <button
              key={index}
              onClick={() => onSelectDate(day.date)}
              className={cn(
                "group relative flex h-[88px] flex-col border-b border-r border-surface-100 p-1.5 text-left transition-colors hover:bg-arcus-50/50",
                !day.isCurrentMonth && "bg-surface-50/50",
                isSelected && "bg-arcus-50 ring-1 ring-inset ring-arcus-300"
              )}
            >
              {/* Day number */}
              <span
                className={cn(
                  "flex h-6 w-6 items-center justify-center rounded-full text-xs font-medium",
                  day.isToday
                    ? "bg-arcus-600 text-white"
                    : day.isCurrentMonth
                      ? "text-surface-700"
                      : "text-surface-300"
                )}
              >
                {day.date.getDate()}
              </span>

              {/* Event dots */}
              {dayEvents.length > 0 && (
                <div className="mt-auto flex flex-wrap gap-0.5">
                  {dayEvents.slice(0, 3).map((event) => (
                    <span
                      key={event.id}
                      className={cn(
                        "h-1.5 w-1.5 rounded-full",
                        event.completed
                          ? "bg-surface-300"
                          : EVENT_DOT_COLORS[event.eventType] || "bg-surface-400"
                      )}
                    />
                  ))}
                  {dayEvents.length > 3 && (
                    <span className="text-[9px] font-medium text-surface-400">
                      +{dayEvents.length - 3}
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
