"use client";

import { useState } from "react";
import EventSection from "@/app/components/main-page/EventSectionMainPage";
import type { EventInstance } from "@/app/types";

/**
 * Upcoming / Past switch for a club's events.
 *
 * Split out of the club page so that page can be a Server Component: this
 * `useState` was the only thing keeping the whole route on the client, and with
 * it gone the club itself can be fetched and 404'd server-side.
 */
export default function ClubEventTabs({
  upcomingEvents,
  pastEvents,
}: {
  upcomingEvents: EventInstance[];
  pastEvents: EventInstance[];
}) {
  const [tab, setTab] = useState<"upcoming" | "past">("upcoming");

  const tabClasses = (active: boolean) =>
    `px-4 py-2 rounded-full text-sm font-semibold transition-colors ${
      active
        ? "bg-lavender-600 text-white"
        : "bg-lavender-100 text-lavender-800 hover:bg-lavender-200"
    }`;

  return (
    <div className="mt-10">
      <h2 className="font-display text-2xl font-bold text-ink-900">Events</h2>
      <div className="flex gap-3 mt-4">
        <button
          onClick={() => setTab("upcoming")}
          aria-pressed={tab === "upcoming"}
          className={tabClasses(tab === "upcoming")}
        >
          Upcoming
        </button>
        <button
          onClick={() => setTab("past")}
          aria-pressed={tab === "past"}
          className={tabClasses(tab === "past")}
        >
          Past
        </button>
      </div>

      <div className="mt-1">
        <EventSection
          title={tab === "upcoming" ? "Upcoming" : "Past"}
          events={tab === "upcoming" ? upcomingEvents : pastEvents}
        />
      </div>
    </div>
  );
}
