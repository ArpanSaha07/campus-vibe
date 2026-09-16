import type { ReactNode } from "react";

/**
 * One row of event or club cards under a planner answer. It never wraps: a
 * row wider than the thread scrolls sideways on a thin lavender scrollbar
 * (`.card-row` in globals.css). The top padding leaves room for a card's
 * hover lift, which the scroll container would otherwise clip.
 */
export default function CardRow({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div
      role="list"
      aria-label={label}
      className="card-row -mx-4 flex gap-4 overflow-x-auto px-4 pt-1 pb-3 sm:mx-0 sm:gap-6 sm:px-0"
    >
      {children}
    </div>
  );
}
