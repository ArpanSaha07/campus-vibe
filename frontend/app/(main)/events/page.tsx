"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { listEvents } from "@/app/lib/event";
import { searchEvents } from "@/app/lib/search";
import { EventInstance } from "@/app/types";
import EventGrid from "@/app/components/event/EventGrid";
import EmptyState from "@/app/components/ui/EmptyState";
import Button from "@/app/components/ui/Button";

function EventsContent() {
  const searchParams = useSearchParams();
  const q = searchParams.get("q")?.trim() ?? "";
  const [events, setEvents] = useState<EventInstance[] | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setEvents(null);
    setError(false);
    const load = q ? searchEvents(q, 50) : listEvents();
    load
      .then((results) => {
        if (!cancelled) setEvents(results);
      })
      .catch(() => {
        if (!cancelled) {
          setError(true);
          setEvents([]);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [q]);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 fade-up">
      {q ? (
        <>
          <p className="ticket-label text-lavender-600">Search results</p>
          <h1 className="font-display text-3xl font-bold text-ink-900 mt-1 mb-2">
            &ldquo;{q}&rdquo;
          </h1>
          {events && !error && events.length > 0 && (
            <p className="text-ink-600">
              {events.length} event{events.length === 1 ? "" : "s"} found, best matches first.
            </p>
          )}
        </>
      ) : (
        <>
          <p className="ticket-label text-lavender-600">This week and beyond</p>
          <h1 className="font-display text-3xl font-bold text-ink-900 mt-1 mb-2">
            Discover events
          </h1>
          <p className="text-ink-600">Explore upcoming events on campus and join the fun.</p>
        </>
      )}

      {error && (
        <div className="mt-8">
          <EmptyState
            title="Events didn't load"
            body="Something went wrong on our end. Refresh to try again."
          />
        </div>
      )}

      {events === null && !error && (
        <p className="mt-8 text-ink-600 font-mono text-sm">Loading events…</p>
      )}

      {events && events.length === 0 && !error && q && (
        <div className="mt-8">
          <EmptyState
            title={`Nothing matches "${q}"`}
            body="Try different words — search understands meaning, not just exact matches."
            action={<Button href="/events" variant="secondary">Browse all events</Button>}
          />
        </div>
      )}

      {events && events.length === 0 && !error && !q && (
        <div className="mt-8">
          <EmptyState
            title="No events yet"
            body="Be the first to host one — create an event for your club."
            action={<Button href="/create-event">Create event</Button>}
          />
        </div>
      )}

      {events && events.length > 0 && <EventGrid events={events} />}
    </div>
  );
}

export default function DiscoverEvents() {
  return (
    <Suspense fallback={<div className="p-10 font-mono text-sm text-ink-600">Loading events…</div>}>
      <EventsContent />
    </Suspense>
  );
}
