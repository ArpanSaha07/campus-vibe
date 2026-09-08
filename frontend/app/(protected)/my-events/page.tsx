"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { getMyEvents } from "@/app/lib/event";
import {
  anchorRangeForTab,
  defaultAnchorForTab,
  groupMyEventsByDay,
  isAnchorAllowed,
  isMyEventsTab,
  selectMyEvents,
} from "@/app/lib/my-events";
import ClubEventTabButton, { type EventTab } from "@/app/components/club/ClubEventTabButtons";
import MyEventsList from "@/app/components/my-events/MyEventsList";
import EventDateFilter from "@/app/components/my-events/EventDateFilter";
import EmptyState from "@/app/components/ui/EmptyState";
import type { MyEvent, MyEventsTab } from "@/app/types";

// Sign-in is already enforced by (protected)/layout.tsx, which also supplies
// the navbar and footer — this page renders the panel only.

function MyEventsContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

  // The tab lives in the URL so it survives a refresh and the back button, and
  // so /my-events?tab=saved can be linked to directly.
  const tabParam = searchParams.get("tab");
  const tab: MyEventsTab = isMyEventsTab(tabParam) ? tabParam : "going";

  // Seeded from the tab in the URL, so landing straight on ?tab=past starts at
  // yesterday rather than a date that tab cannot reach.
  const [anchor, setAnchor] = useState(() => defaultAnchorForTab(tab));
  const [myEvents, setMyEvents] = useState<MyEvent[] | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    let cancelled = false;
    getMyEvents()
      .then((events) => {
        if (!cancelled) setMyEvents(events);
      })
      .catch(() => {
        if (!cancelled) {
          setError(true);
          setMyEvents([]);
        }
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // All three tabs are served from one fetch, so switching tabs is instant.
  const groups = useMemo(
    () => (myEvents ? groupMyEventsByDay(selectMyEvents(myEvents, tab, anchor)) : []),
    [myEvents, tab, anchor],
  );

  // Going and Saved look forwards from the anchor, Past looks back from it, and
  // their ranges do not overlap — so a date picked on one tab is often out of
  // bounds on the next. Snap to that tab's own default instead of leaving the
  // list anchored somewhere it cannot reach.
  function selectTab(next: EventTab) {
    // The pills speak a union wide enough for the manage screen too. This page
    // never draws Upcoming, so that value can only arrive from a bug — and
    // isMyEventsTab narrows the rest without a cast.
    if (!isMyEventsTab(next)) return;

    if (!isAnchorAllowed(anchor, next)) {
      setAnchor(defaultAnchorForTab(next));
    }
    router.replace(next === "going" ? "/my-events" : `/my-events?tab=${next}`, {
      scroll: false,
    });
  }

  // Every pill's count, not just the open tab's. Three passes over the list
  // where the page needs one, on purpose: selectMyEvents is the only
  // definition of what a tab contains, and a cheaper count-only variant would
  // be a second one, free to drift from it.
  //
  // Counted at the current anchor even for the tabs that anchor is out of
  // range for, which is safe rather than lucky: out of range always means
  // looser than that tab's own bound, and isPastEvent enforces that bound
  // anyway — so each count already equals what selectTab's snap will show.
  const counts = useMemo(
    () =>
      myEvents === null
        ? null
        : {
            going: selectMyEvents(myEvents, "going", anchor).length,
            saved: selectMyEvents(myEvents, "saved", anchor).length,
            past: selectMyEvents(myEvents, "past", anchor).length,
          },
    [myEvents, anchor],
  );

  const anchorRange = anchorRangeForTab(tab);

  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-10 sm:px-6 lg:px-8 fade-up">
      <Link
        href="/"
        className="inline-flex items-center gap-2 text-sm font-semibold text-ink-600 transition-colors hover:text-lavender-600"
      >
        <ArrowLeft className="h-4 w-4" aria-hidden="true" />
        Back to home
      </Link>

      {/* "Add to calendar" lives on each card, not here: a Google Calendar
          template link carries exactly one event, and its title has to be that
          event's own. A single header control would need an .ics feed instead. */}
      <h1 className="mt-4 font-display text-4xl font-bold text-ink-900">Your events</h1>

      <div className="mt-6 flex flex-wrap items-center justify-between gap-4">
        <ClubEventTabButton
          label="Which of your events"
          value={tab}
          onChange={selectTab}
          goingCount={counts?.going ?? null}
          savedCount={counts?.saved ?? null}
          pastCount={counts?.past ?? null}
        />
        <EventDateFilter
          value={anchor}
          onChange={setAnchor}
          min={anchorRange.min}
          max={anchorRange.max}
        />
      </div>

      <div className="mt-8 mb-5">
        {error ? (
          <EmptyState
            title="Your events didn't load"
            body="Something went wrong on our end. Refresh to try again."
          />
        ) : myEvents === null ? (
          <p className="font-mono text-sm text-ink-600">Loading your events…</p>
        ) : (
          <MyEventsList groups={groups} tab={tab} />
        )}
      </div>
    </div>
  );
}

export default function MyEventsPage() {
  return (
    <Suspense
      fallback={<div className="p-10 font-mono text-sm text-ink-600">Loading your events…</div>}
    >
      <MyEventsContent />
    </Suspense>
  );
}
