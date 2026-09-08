"use client";

export type EventTab = "upcoming" | "going" | "saved" | "past";

const LABELS: Record<EventTab, string> = {
  upcoming: "Upcoming",
  going: "Going",
  saved: "Saved",
  past: "Past",
};

// Fixed order, so two pages showing the same pills never disagree about which
// comes first. Which of them actually appear is decided per call site below —
// the manage screen takes Upcoming and Past, My events the other three.
const ORDER: EventTab[] = ["upcoming", "going", "saved", "past"];

/**
 * The Upcoming / Going / Saved / Past pills that sit above a list of events.
 *
 * <strong>Counts come in as numbers, not as the event arrays.</strong> This
 * component never renders an event, so taking `EventInstance[]` would have it
 * ask for data it throws away — and, more to the point, an array cannot say
 * "still loading": `[]` and a fetch in flight look identical, and the pill has
 * to show `…` for one and `0` for the other. A count of `null` says loading.
 *
 * Each count is three-valued, which is also how a page picks its tabs:
 *   - a number — show this pill, with that many
 *   - `null`   — show this pill, count not known yet
 *   - undefined (omitted) — this page has no such tab, so draw no pill
 *
 * <strong>Controlled.</strong> The selected tab lives in the page, not here.
 * The page renders the event cards under these pills and so has to know which
 * tab is open; state in here would be invisible to it.
 */
export default function ClubEventTabButton({
  value,
  onChange,
  label = "Event timeframe",
  upcomingCount,
  goingCount,
  savedCount,
  pastCount,
}: {
  value: EventTab;
  onChange: (tab: EventTab) => void;
  /** Names the group for a screen reader. Not drawn. */
  label?: string;
  upcomingCount?: number | null;
  goingCount?: number | null;
  savedCount?: number | null;
  pastCount?: number | null;
}) {
  const counts: Record<EventTab, number | null | undefined> = {
    upcoming: upcomingCount,
    going: goingCount,
    saved: savedCount,
    past: pastCount,
  };

  return (
    <div role="tablist" aria-label={label} className="flex gap-2">
      {ORDER.filter((tab) => counts[tab] !== undefined).map((tab) => (
        <button
          key={tab}
          role="tab"
          aria-selected={value === tab}
          onClick={() => onChange(tab)}
          className={`rounded-full px-4 py-2 text-sm font-semibold transition-colors duration-150 ${
            value === tab
              ? "bg-lavender-600 text-white"
              : "border border-mist-200 text-ink-900 hover:bg-lavender-50"
          }`}
        >
          {LABELS[tab]}
          {/* Only null reaches the fallback — undefined counts were filtered
              out above, so a missing tab is absent rather than showing "…". */}
          <span className="ml-2 font-mono text-xs opacity-70">{counts[tab] ?? "…"}</span>
        </button>
      ))}
    </div>
  );
}
