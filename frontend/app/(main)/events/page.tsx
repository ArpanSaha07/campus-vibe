"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { listEvents } from "@/app/lib/event";
import { searchEvents } from "@/app/lib/search";
import { EventInstance } from "@/app/types";
import EventGrid from "@/app/components/event/EventGrid";

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
    <div className="p-6 bg-white rounded-md shadow-md hover:shadow-lg transition">
      <div className="px-8">
        {q ? (
          <>
            <h2 className="text-xl font-semibold mb-4">
              Results for &ldquo;{q}&rdquo;
            </h2>
            {events && !error && (
              <p className="text-gray-600">
                {events.length === 0
                  ? "No events match your search. Try different words — search understands meaning, not just exact matches."
                  : `${events.length} event${events.length === 1 ? "" : "s"} found, best matches first.`}
              </p>
            )}
          </>
        ) : (
          <>
            <h2 className="text-xl font-semibold mb-4">Discover Events</h2>
            <p className="text-gray-600">
              Explore upcoming events on campus and join the fun!
            </p>
          </>
        )}
        {error && (
          <p className="text-red-600">
            Something went wrong loading events. Please try again.
          </p>
        )}
        {events === null && !error && <p className="text-gray-500">Loading events…</p>}
      </div>
      {events && events.length > 0 && <EventGrid events={events} />}
    </div>
  );
}

export default function DiscoverEvents() {
  return (
    <Suspense fallback={<div className="p-6">Loading events…</div>}>
      <EventsContent />
    </Suspense>
  );
}
