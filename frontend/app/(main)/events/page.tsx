'use client';
import { useEffect, useState } from "react";
import { listEvents } from "@/app/lib/event"
import { EventInstance } from "@/app/types";
import EventSection from "@/app/components/main-page/EventSectionMainPage";

import { popularEvents } from "@/app/data/data"; // Temporary hardcoded events until backend is ready

export default function DiscoverEvents() {

  // const [events, setEvents] = useState<EventInstance[]>([]);

  // useEffect(() => {
  //   listEvents().then(setEvents);
  // }, []);

  return (
    <div className="p-6 bg-white rounded-md shadow-md hover:shadow-lg transition">
      <h2 className="text-xl font-semibold mb-4">Discover Events</h2>
      <p className="text-gray-600">Explore upcoming events on campus and join the fun!</p>

      <EventSection title="Upcoming Events" events={popularEvents} />
    </div>
  );
}