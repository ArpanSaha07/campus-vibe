"use client";

import { useEffect, useRef, useState } from "react";
import { ChevronDown, ChevronLeft, ChevronRight } from "lucide-react";
import {
  WEEKDAY_INITIALS,
  addDays,
  buildMonthGrid,
  isSameDay,
  startOfDay,
} from "@/app/lib/my-events";

// The "Today ⌄" control: a month calendar that anchors the list at a date.
// Days are set in mono — on this page a date is ticket data, not prose.

function startOfMonth(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

export default function EventDateFilter({
  value,
  onChange,
  min = null,
  max = null,
}: {
  value: Date;
  onChange: (date: Date) => void;
  /** Earliest selectable day, inclusive. null means unbounded. */
  min?: Date | null;
  /** Latest selectable day, inclusive. null means unbounded. */
  max?: Date | null;
}) {
  const [open, setOpen] = useState(false);
  const [month, setMonth] = useState(() => startOfMonth(value));
  const containerRef = useRef<HTMLDivElement>(null);
  const today = new Date();

  function isSelectable(day: Date): boolean {
    const time = startOfDay(day).getTime();
    if (min && time < startOfDay(min).getTime()) return false;
    if (max && time > startOfDay(max).getTime()) return false;
    return true;
  }

  // Paging into a month with nothing selectable in it is a dead end, so the
  // arrow that would go there is disabled rather than left to be discovered.
  const lastDayOfPreviousMonth = new Date(month.getFullYear(), month.getMonth(), 0);
  const firstDayOfNextMonth = new Date(month.getFullYear(), month.getMonth() + 1, 1);
  const canGoBack = isSelectable(lastDayOfPreviousMonth);
  const canGoForward = isSelectable(firstDayOfNextMonth);

  useEffect(() => {
    if (!open) return;

    function handlePointerDown(pointerEvent: MouseEvent) {
      if (!containerRef.current?.contains(pointerEvent.target as Node)) {
        setOpen(false);
      }
    }
    function handleKeyDown(keyEvent: KeyboardEvent) {
      if (keyEvent.key === "Escape") setOpen(false);
    }

    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [open]);

  // Reopening lands on the selected month, not wherever you last paged to.
  function toggle() {
    if (!open) setMonth(startOfMonth(value));
    setOpen((wasOpen) => !wasOpen);
  }

  function shiftMonth(delta: number) {
    setMonth((current) => new Date(current.getFullYear(), current.getMonth() + delta, 1));
  }

  function selectDay(day: Date) {
    onChange(startOfDay(day));
    setOpen(false);
  }

  // "Yesterday" earns its place because it is where the Past tab starts.
  let label = value.toLocaleDateString(undefined, { month: "short", day: "numeric" });
  if (isSameDay(value, today)) label = "Today";
  else if (isSameDay(value, addDays(today, -1))) label = "Yesterday";

  return (
    <div className="relative" ref={containerRef}>
      <button
        type="button"
        onClick={toggle}
        aria-expanded={open}
        aria-haspopup="dialog"
        className="inline-flex items-center gap-1.5 rounded-full px-3 py-2 text-sm font-semibold text-ink-900 transition-colors hover:bg-lavender-50"
      >
        {label}
        <ChevronDown
          className={`h-4 w-4 transition-transform duration-150 ${open ? "rotate-180" : ""}`}
          aria-hidden="true"
        />
      </button>

      {open && (
        <div
          role="dialog"
          aria-label="Filter events by date"
          className="absolute right-0 z-40 mt-2 w-80 rounded-2xl border border-mist-200 bg-white p-4 shadow-lift"
        >
          <div className="flex items-center justify-between">
            <button
              type="button"
              onClick={() => shiftMonth(-1)}
              disabled={!canGoBack}
              aria-label="Previous month"
              className="rounded-full p-1.5 text-ink-600 transition-colors hover:bg-lavender-50 hover:text-lavender-800 disabled:pointer-events-none disabled:opacity-30"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>

            <p className="font-display text-base font-semibold text-ink-900">
              {month.toLocaleDateString(undefined, { month: "long", year: "numeric" })}
            </p>

            <button
              type="button"
              onClick={() => shiftMonth(1)}
              disabled={!canGoForward}
              aria-label="Next month"
              className="rounded-full p-1.5 text-ink-600 transition-colors hover:bg-lavender-50 hover:text-lavender-800 disabled:pointer-events-none disabled:opacity-30"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>

          <div className="mt-4 grid grid-cols-7 gap-1">
            {WEEKDAY_INITIALS.map((weekday) => (
              <div key={weekday} className="ticket-label py-1 text-center text-ink-600">
                {weekday}
              </div>
            ))}

            {buildMonthGrid(month).map((day) => {
              const isSelected = isSameDay(day, value);
              const isToday = isSameDay(day, today);
              const isOutsideMonth = day.getMonth() !== month.getMonth();
              const disabled = !isSelectable(day);

              let dayClasses = "text-ink-900 hover:bg-lavender-50";
              if (isOutsideMonth) dayClasses = "text-ink-600/40 hover:bg-lavender-50";
              if (isToday && !isSelected) dayClasses = "bg-lavender-50 font-semibold text-lavender-800";
              if (isSelected) dayClasses = "bg-lavender-600 font-semibold text-white";
              // Last, so an out-of-range day never keeps a hover or today accent.
              if (disabled) dayClasses = "text-ink-600/25 cursor-not-allowed";

              return (
                <button
                  key={day.toISOString()}
                  type="button"
                  onClick={() => selectDay(day)}
                  disabled={disabled}
                  aria-current={isToday ? "date" : undefined}
                  aria-label={day.toLocaleDateString(undefined, {
                    weekday: "long",
                    month: "long",
                    day: "numeric",
                    year: "numeric",
                  })}
                  className={`mx-auto flex h-9 w-9 items-center justify-center rounded-full font-mono text-sm transition-colors ${dayClasses}`}
                >
                  {day.getDate()}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
