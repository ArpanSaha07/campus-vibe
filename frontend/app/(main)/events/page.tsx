import type { Metadata } from "next";
import { listEvents } from "@/app/lib/event";
import { searchEvents } from "@/app/lib/search";
import EventGrid from "@/app/components/event/EventGrid";
import EmptyState from "@/app/components/ui/EmptyState";
import Button from "@/app/components/ui/Button";

// A Server Component. `?q=` arrives as the searchParams prop, so the list is
// fetched and rendered before anything is sent — no useSearchParams, no
// Suspense wrapper to work around it, and no "Loading events…" flash on a page
// whose whole job is to show events.
//
// There is no notFound() here on purpose: /events always exists. An empty
// result is an empty state, not a 404 — answering "no events match" with a 404
// would tell a crawler the search page itself is gone.

export const metadata: Metadata = {
  title: "Discover events · CampusVibe",
  description: "Explore upcoming events on campus and join the fun.",
};

export default async function DiscoverEvents({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const raw = (await searchParams).q;
  // A repeated ?q= arrives as an array; take the first rather than rendering
  // "a,b" as the heading.
  const q = (Array.isArray(raw) ? raw[0] : raw)?.trim() ?? "";

  const events = q ? await searchEvents(q, 50) : await listEvents();

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 fade-up">
      {q ? (
        <>
          <p className="ticket-label text-lavender-600">Search results</p>
          <h1 className="font-display text-3xl font-bold text-ink-900 mt-1 mb-2">
            &ldquo;{q}&rdquo;
          </h1>
          {events.length > 0 && (
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

      {events.length === 0 && q && (
        <div className="mt-8">
          <EmptyState
            title={`Nothing matches "${q}"`}
            body="Try different words — search understands meaning, not just exact matches."
            action={
              <Button href="/events" variant="secondary">
                Browse all events
              </Button>
            }
          />
        </div>
      )}

      {events.length === 0 && !q && (
        <div className="mt-8">
          <EmptyState
            title="No events yet"
            body="Follow your favorite clubs to get notified about upcoming events."
            action={<Button href="/clubs">Browse clubs</Button>}
          />
        </div>
      )}

      {events.length > 0 && <EventGrid events={events} />}
    </div>
  );
}
