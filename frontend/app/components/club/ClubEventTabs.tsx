"use client";

import { useState } from "react";
import EventCard from "@/app/components/event/EventCard";
import ClubEventTabButton, { type EventTab } from "@/app/components/club/ClubEventTabButtons";
import SectionHeading from "@/app/components/ui/SectionHeading";
import EmptyState from "@/app/components/ui/EmptyState";
import Button from "@/app/components/ui/Button";
import type { EventInstance } from "@/app/types";

/**
 * Upcoming / Past switch for a club's events.
 *
 * Split out of the club page so that page can be a Server Component: this
 * `useState` was the only thing keeping the whole route on the client, and with
 * it gone the club itself can be fetched and 404'd server-side.
 *
 * Both lists arrive whole and already split and sorted by the page, so the
 * counts are plain lengths — there is no loading state to pass `null` for,
 * unlike the manage screen which fetches its own.
 *
 * <strong>This used to render `EventSectionMainPage`</strong>, which is a home
 * page component: it carries its own `max-w-7xl mx-auto px-4 sm:px-6` inside
 * the club page's identical container, so every event sat one gutter to the
 * right of the club's own heading. It also has a fixed four-column grid whose
 * tracks, at that second level of padding, come out 278px wide — narrower than
 * EventCard's 288px — so the right-hand card was sliced by the rail's
 * `overflow-x-auto`. The same component is fine on the home page, where it is
 * the thing that owns the container. Here the grid is local and fluid instead.
 */

// auto-fill rather than a fixed column count, and a floor of the card's own
// width: EventCard is `w-72 flex-shrink-0` and stays that way, so a track
// narrower than 288px is what clips it. `min(288px, 100%)` keeps that floor
// from forcing a horizontal scrollbar on a phone narrower than a card.
const GRID = "grid gap-6 justify-items-center grid-cols-[repeat(auto-fill,minmax(min(288px,100%),1fr))]";

export default function ClubEventTabs({
  clubName,
  upcomingEvents,
  pastEvents,
}: {
  clubName: string;
  upcomingEvents: EventInstance[];
  pastEvents: EventInstance[];
}) {
  // Widened to the pills' own union: a narrower setter is not assignable to
  // their onChange. Only Upcoming and Past are ever drawn here.
  const [tab, setTab] = useState<EventTab>("upcoming");

  // The page sorts soonest-first, so the head of the list is the next thing
  // this club is doing — which is the one fact a visitor came for. It is
  // promoted out of the grid rather than left to be found in it.
  const [next, ...later] = upcomingEvents;

  return (
    <section className="mt-8">
      {/* No moreHref: "Explore more events" pointed at /events, which is the
          one place a reader of this section has not asked to go. */}
      <SectionHeading title="Events" />

      <div className="mt-4">
        <ClubEventTabButton
          value={tab}
          onChange={setTab}
          upcomingCount={upcomingEvents.length}
          pastCount={pastEvents.length}
        />
      </div>

      {tab === "upcoming" ? (
        upcomingEvents.length === 0 ? (
          <div className="mt-8">
            <EmptyState
              title="Nothing on the calendar yet"
              body={`Follow ${clubName} and we'll tell you as soon as they post something.`}
              action={
                <Button href="/events" variant="secondary">
                  Browse all events
                </Button>
              }
            />
          </div>
        ) : (
          <>
            {/* A printed label, not a value — see the .ticket-label rule. */}
            <p className="ticket-label text-ink-600 mt-8">Up next</p>
            <div className="mt-3">
              <EventCard event={next} />
            </div>

            {later.length > 0 && (
              <>
                <p className="ticket-label text-ink-600 mt-8">Also coming up</p>
                <div className={`mt-3 ${GRID}`}>
                  {later.map((event) => (
                    <EventCard key={event.eventId} event={event} />
                  ))}
                </div>
              </>
            )}
          </>
        )
      ) : pastEvents.length === 0 ? (
        <div className="mt-8">
          <EmptyState title="No past events yet" />
        </div>
      ) : (
        // No "up next" on Past: that label means "this is the one coming", so
        // repeating it over a finished season would be decoration.
        <div className={`mt-8 ${GRID}`}>
          {pastEvents.map((event) => (
            <EventCard key={event.eventId} event={event} />
          ))}
        </div>
      )}
    </section>
  );
}
