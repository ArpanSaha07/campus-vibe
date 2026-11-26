import EventCard from "@/app/components/event/EventCard";
import SectionHeading from "@/app/components/ui/SectionHeading";
import { EventInstance } from "@/app/types";

export default function EventSection({ title, events }: { title: string; events: EventInstance[] }) {
  return (
    <section className="max-w-7xl mx-auto py-4 px-4 sm:px-6">
      <SectionHeading title={title} moreHref="/events" moreLabel="Explore more events" />

      {/* One horizontal row at every width; the rest scrolls (Arpan, 2026-11-26). */}
      <div className="flex space-x-6 overflow-x-auto py-4">
        {events.map((event) => (
          <EventCard key={event.eventId} event={event} />
        ))}
      </div>
    </section>
  );
}
