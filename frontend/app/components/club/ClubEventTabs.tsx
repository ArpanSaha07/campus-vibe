"use client";

import { useState } from "react";
import EventSection from "@/app/components/main-page/EventSectionMainPage";
import ClubEventTabButton, { type EventTab } from "@/app/components/club/ClubEventTabButtons";
import type { EventInstance } from "@/app/types";

/**
 * Upcoming / Past switch for a club's events.
 *
 * Split out of the club page so that page can be a Server Component: this
 * `useState` was the only thing keeping the whole route on the client, and with
 * it gone the club itself can be fetched and 404'd server-side.
 *
 * Both lists arrive whole, so the counts are plain lengths — there is no
 * loading state to pass `null` for, unlike the manage screen which fetches
 * its own.
 */
export default function ClubEventTabs({
  upcomingEvents,
  pastEvents,
}: {
  upcomingEvents: EventInstance[];
  pastEvents: EventInstance[];
}) {
  // Widened to the pills' own union: a narrower setter is not assignable to
  // their onChange. Only Upcoming and Past are ever drawn here.
  const [tab, setTab] = useState<EventTab>("upcoming");

  return (
    <div className="mt-10">
      <h2 className="font-display text-2xl font-bold text-ink-900">Events</h2>
      <div className="mt-4">
        <ClubEventTabButton
          value={tab}
          onChange={setTab}
          upcomingCount={upcomingEvents.length}
          pastCount={pastEvents.length}
        />
      </div>

      <div className="mt-1">
        <EventSection
          title={tab === "past" ? "Past" : "Upcoming"}
          events={tab === "past" ? pastEvents : upcomingEvents}
        />
      </div>
    </div>
  );
}
