"use client";

import { use, useEffect, useMemo, useState } from "react";
import { listEventsByClub } from "@/app/lib/event";
import type { EventInstance } from "@/app/types";
import SectionHeading from "@/app/components/ui/SectionHeading";
import EmptyState from "@/app/components/ui/EmptyState";
import Button from "@/app/components/ui/Button";
import EventCard from "@/app/components/event/EventCard";

/**
 * The club's events, split into upcoming and past.
 *
 * Upcoming/past rather than draft/published/archived: `events` has no status
 * column yet, so date is the only lifecycle the data can actually support.
 * Adding real statuses is queued as its own task in todo.md — it needs every
 * public read path to filter on status, or drafts leak onto the homepage.
 */

type Tab = "upcoming" | "past";

export default function ClubEventsPage({
  params,
}: {
  params: Promise<{ clubId: string }>;
}) {
  const { clubId } = use(params);
  const [events, setEvents] = useState<EventInstance[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [tab, setTab] = useState<Tab>("upcoming");

  useEffect(() => {
    let cancelled = false;
    listEventsByClub(clubId)
      .then((clubEvents) => {
        if (!cancelled) setEvents(clubEvents);
      })
      .catch(() => {
        if (cancelled) return;
        setEvents([]);
        setFailed(true);
      });
    return () => {
      cancelled = true;
    };
  }, [clubId]);

  const { upcoming, past } = useMemo(() => {
    const now = new Date();
    const all = events ?? [];
    return {
      // Soonest first for what is still to come; most recent first for what is
      // done — in both cases the event you are most likely to want is on top.
      upcoming: all
        .filter((event) => event.dateTime >= now)
        .sort((a, b) => a.dateTime.getTime() - b.dateTime.getTime()),
      past: all
        .filter((event) => event.dateTime < now)
        .sort((a, b) => b.dateTime.getTime() - a.dateTime.getTime()),
    };
  }, [events]);

  const shown = tab === "upcoming" ? upcoming : past;

  return (
    <div>
      <SectionHeading
        title="Events"
        subtitle="Everything this club has put on, and everything still to come."
      />

      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <div role="tablist" aria-label="Event timeframe" className="flex gap-2">
          {(
            [
              ["upcoming", "Upcoming", upcoming.length],
              ["past", "Past", past.length],
            ] as const
          ).map(([value, label, count]) => (
            <button
              key={value}
              role="tab"
              aria-selected={tab === value}
              onClick={() => setTab(value)}
              className={`rounded-full px-4 py-2 text-sm font-semibold transition-colors duration-150 ${
                tab === value
                  ? "bg-lavender-600 text-white"
                  : "border border-mist-200 text-ink-900 hover:bg-lavender-50"
              }`}
            >
              {label}
              <span className="ml-2 font-mono text-xs opacity-70">
                {events === null ? "…" : count}
              </span>
            </button>
          ))}
        </div>

        <Button href="/create-event">Create event</Button>
      </div>

      {events === null && (
        <p className="font-mono text-sm text-ink-600">Loading events…</p>
      )}

      {failed && (
        <EmptyState
          title="Events didn't load"
          body="The server didn't answer. Refresh to try again."
        />
      )}

      {events !== null && !failed && shown.length === 0 && (
        <EmptyState
          title={tab === "upcoming" ? "Nothing coming up" : "Nothing in the past"}
          body={
            tab === "upcoming"
              ? "No events yet — be the first to host one. Give your followers something to show up for."
              : "Once an event has been and gone, it lands here."
          }
          action={
            tab === "upcoming" ? <Button href="/create-event">Create event</Button> : undefined
          }
        />
      )}

      {shown.length > 0 && (
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 xl:grid-cols-3">
          {shown.map((event) => (
            <EventCard key={event.eventId} event={event} />
          ))}
        </div>
      )}
    </div>
  );
}
