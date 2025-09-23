// components/EventList.tsx
"use client";
import { useState } from "react";
import EventFilterPopup from "./EventFilterPopup";
import { EventInstance } from "@/app/types";

export default function EventList() {
  const [filter, setFilter] = useState<"upcoming" | "past" | "all">("upcoming");
  const [isPopupOpen, setPopupOpen] = useState(false);

  const events: EventInstance[] = []; // Replace with fetch from backend
  const filteredEvents = events.filter(e => {
    if (filter === "upcoming") return new Date(e.date) > new Date();
    if (filter === "past") return new Date(e.date) < new Date();
    return true;
  });

  return (
    <div>
      <div className="flex gap-4 mb-6">
        <input
          type="text"
          placeholder="Search events"
          className="border rounded px-3 py-2"
        />
        <button
          onClick={() => setPopupOpen(true)}
          className="bg-blue-600 text-white px-4 py-2 rounded"
        >
          {filter.charAt(0).toUpperCase() + filter.slice(1)} events ⬇
        </button>
      </div>

      {filteredEvents.length === 0 ? (
        <div className="text-center text-gray-500">
          <p>No events to show</p>
        </div>
      ) : (
        <div className="grid gap-4">
          {filteredEvents.map(event => (
            <div key={event.id} className="border p-4 rounded shadow">
              <h2 className="font-bold">{event.title}</h2>
              <p>{event.date}</p>
            </div>
          ))}
        </div>
      )}

      {isPopupOpen && (
        <EventFilterPopup
          currentFilter={filter}
          onSelect={setFilter}
          onClose={() => setPopupOpen(false)}
        />
      )}
    </div>
  );
}
