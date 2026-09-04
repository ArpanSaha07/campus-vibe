"use client";

import { use, useEffect, useMemo, useState } from "react";
import { listEventsByClub } from "@/app/lib/event";
import type { EventInstance } from "@/app/types";
import SectionHeading from "@/app/components/ui/SectionHeading";
import EmptyState from "@/app/components/ui/EmptyState";
import Button from "@/app/components/ui/Button";
import EventCard from "@/app/components/event/EventCard";
import ClubEventTabButton, { type EventTab } from "@/app/components/club/ClubEventTabButtons";

/**
 * The club's events, split into upcoming and past.
 *
 * Upcoming/past rather than draft/published/archived: `events` has no status
 * column yet, so date is the only lifecycle the data can actually support.
 * Adding real statuses is queued as its own task in todo.md — it needs every
 * public read path to filter on status, or drafts leak onto the homepage.
 */
export default function ClubEventsPage({
  params,
}: {
  params: Promise<{ clubId: string }>;
}) {
  const { clubId } = use(params);
  const [events, setEvents] = useState<EventInstance[] | null>(null);
  const [failed, setFailed] = useState(false);
  // Lives here, not in ClubEventTabButton: the cards below are drawn from it.
  const [tab, setTab] = useState<EventTab>("upcoming");

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

  const shown = tab === "past" ? past : upcoming;

  return (
    <div>
      <SectionHeading
        title="Events"
        subtitle="Everything this club has put on, and everything still to come."
      />

      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <ClubEventTabButton
          value={tab}
          onChange={setTab}
          // null rather than 0 while the fetch is in flight, so the pill
          // reads as pending instead of claiming this club has none.
          upcomingCount={events === null ? null : upcoming.length}
          pastCount={events === null ? null : past.length}
        />

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
