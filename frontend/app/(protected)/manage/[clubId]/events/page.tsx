"use client";

import { use, useEffect, useMemo, useState } from "react";
import { deleteEvent, listEventsByClub } from "@/app/lib/event";
import { parseApiError } from "@/app/lib/auth-errors";
import { revalidateEvents } from "@/app/lib/actions/revalidate";
import type { EventInstance } from "@/app/types";
import SectionHeading from "@/app/components/ui/SectionHeading";
import EmptyState from "@/app/components/ui/EmptyState";
import Button from "@/app/components/ui/Button";
import EventCard from "@/app/components/event/EventCard";
import ClubEventTabButton, { type EventTab } from "@/app/components/club/ClubEventTabButtons";

/**
 * The club's events, split into upcoming and past, each with Edit and Delete.
 *
 * Upcoming/past rather than draft/published/archived: `events` has no status
 * column yet, so date is the only lifecycle the data can actually support.
 * Adding real statuses is queued as its own task in todo.md — it needs every
 * public read path to filter on status, or drafts leak onto the homepage.
 *
 * Delete is a hard delete that takes every RSVP and bookmark with it (CEM-14
 * is not built), so it asks inline first and says so. Not `window.confirm`,
 * which blocks the page and cannot be styled or read as part of the card.
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

  const [confirming, setConfirming] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState("");

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

  async function confirmDelete(eventId: string) {
    setDeleting(true);
    setDeleteError("");
    try {
      await deleteEvent(eventId);
    } catch (error) {
      setDeleteError(parseApiError(error, "That event couldn't be deleted. Try again."));
      return;
    } finally {
      setDeleting(false);
    }
    setEvents((prev) => prev?.filter((event) => event.eventId !== eventId) ?? null);
    setConfirming(null);
    // After the write (BUG-045), caught on its own (BUG-047).
    try {
      await revalidateEvents();
    } catch {
      // Public lists catch up within five minutes.
    }
  }

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
            <div key={event.eventId} className="flex flex-col gap-3">
              <EventCard event={event} />

              {confirming === event.eventId ? (
                <div
                  role="group"
                  aria-label={`Confirm deleting ${event.title}`}
                  className="rounded-2xl border border-alert-600/30 bg-white p-4"
                >
                  <p className="text-sm font-semibold text-ink-900">Delete this event?</p>
                  <p className="mt-1 text-sm text-ink-600">
                    It can&apos;t be undone. Everyone&apos;s RSVP and bookmark goes with it.
                  </p>
                  {deleteError && (
                    <p className="mt-2 text-sm text-alert-600">{deleteError}</p>
                  )}
                  <div className="mt-3 flex gap-2">
                    <button
                      type="button"
                      onClick={() => confirmDelete(event.eventId)}
                      disabled={deleting}
                      className="rounded-full bg-alert-600 px-4 py-2 text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-50"
                    >
                      {deleting ? "Deleting…" : "Delete event"}
                    </button>
                    <Button
                      variant="secondary"
                      onClick={() => {
                        setConfirming(null);
                        setDeleteError("");
                      }}
                      disabled={deleting}
                    >
                      Cancel
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="flex gap-2">
                  <Button
                    href={`/manage/${clubId}/events/${event.eventId}/edit`}
                    variant="secondary"
                  >
                    Edit
                  </Button>
                  <button
                    type="button"
                    onClick={() => {
                      setConfirming(event.eventId);
                      setDeleteError("");
                    }}
                    className="rounded-full px-4 py-2 text-sm font-semibold text-alert-600 transition-colors hover:bg-alert-600/10"
                  >
                    Delete
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
