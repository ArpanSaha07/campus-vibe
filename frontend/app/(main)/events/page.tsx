import type { Metadata } from "next";
import { listEvents } from "@/app/lib/event";
import { searchClubs, searchEvents } from "@/app/lib/search";
import EventGrid from "@/app/components/event/EventGrid";
import ClubCard from "@/app/components/club/ClubCard";
import EmptyState from "@/app/components/ui/EmptyState";
import Button from "@/app/components/ui/Button";
import type { Club, EventInstance } from "@/app/types";

// A Server Component. `?q=` arrives as the searchParams prop, so the list is
// fetched and rendered before anything is sent — no useSearchParams, no
// Suspense wrapper to work around it, and no "Loading events…" flash on a page
// whose whole job is to show events.
//
// There is no notFound() here on purpose: /events always exists. An empty
// result is an empty state, not a 404 — answering "no events match" with a 404
// would tell a crawler the search page itself is gone.
//
// A search shows clubs as well as events: the search box's dropdown lists both
// and links here as "See all results", so an events-only page answered
// "Nothing matches" right after the dropdown had shown matching clubs.

export const metadata: Metadata = {
  title: "Discover events · CampusVibe",
  description: "Explore upcoming events on campus and join the fun.",
};

function plural(n: number, word: string) {
  return `${n} ${word}${n === 1 ? "" : "s"}`;
}

export default async function DiscoverEvents({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const raw = (await searchParams).q;
  // A repeated ?q= arrives as an array; take the first rather than rendering
  // "a,b" as the heading.
  const q = (Array.isArray(raw) ? raw[0] : raw)?.trim() ?? "";

  let events: EventInstance[];
  let clubs: Club[] = [];
  if (q) {
    [events, clubs] = await Promise.all([searchEvents(q, 50), searchClubs(q, 12)]);
  } else {
    events = await listEvents();
  }

  const nothingFound = q && events.length === 0 && clubs.length === 0;
  const counts = [
    events.length > 0 && plural(events.length, "event"),
    clubs.length > 0 && plural(clubs.length, "club"),
  ].filter(Boolean);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 fade-up">
      {q ? (
        <>
          <p className="ticket-label text-lavender-600">Search results</p>
          <h1 className="font-display text-3xl font-bold text-ink-900 mt-1 mb-2">
            &ldquo;{q}&rdquo;
          </h1>
          {counts.length > 0 && (
            <p className="text-ink-600">{counts.join(" · ")} found, best matches first.</p>
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

      {nothingFound && (
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

      {events.length > 0 && (
        <section aria-label="Event results" className={q ? "mt-8" : undefined}>
          {q && <h2 className="font-display text-xl font-bold text-ink-900 mb-3">Events</h2>}
          <EventGrid events={events} />
        </section>
      )}

      {clubs.length > 0 && (
        <section aria-label="Club results" className="mt-10">
          <h2 className="font-display text-xl font-bold text-ink-900 mb-3">Clubs</h2>
          {/* The /clubs page's grid rather than ClubGrid: ClubGrid's auto-fit
              columns collapsed to one narrow column here. */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 justify-items-center">
            {clubs.map((club) => (
              <ClubCard key={club.clubId} club={club} />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
