import EventCard from "../event/EventCard";
import SectionHeading from "@/app/components/ui/SectionHeading";
import { EventInstance } from "@/app/types";

export default function EventSection({ title, events }: { title: string; events: EventInstance[] }) {
  return (
    <section className="max-w-7xl mx-auto py-4 px-4 sm:px-6">
      <SectionHeading title={title} moreHref="/events" moreLabel="Explore more events" />

      {/* Horizontal scroll, grid view for screens larger than xl */}
      <div
        className="
        flex space-x-6 overflow-x-auto py-4
        xl:grid xl:grid-cols-4 xl:grid-rows-2 xl:gap-6 xl:justify-between"
      >
        {events.map((event) => (
          <EventCard key={event.eventId} event={event} />
        ))}
      </div>
    </section>
  );
}
