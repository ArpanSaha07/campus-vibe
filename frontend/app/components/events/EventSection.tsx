import EventCard from "./EventCard";
import { EventInstance } from "@/lib/types";

export default function EventSection({title, events}: {title: string, events: EventInstance[]}) {
  return (
    <section className="max-w-7xl mx-auto px-6 py-10">
      <div className="flex flex-row justify-between pr-4">
        <a href="#" className="hover:text-indigo-600 hover:underline">
          <h2 className="text-2xl font-semibold mb-6">{title}</h2>
        </a>
        <span>
          <a
            href="#"
            className="text-sm text-gray-700 hover:text-indigo-600 hover:underline"
          >
            Explore more events
          </a>{" "}
          &nbsp;&gt;
        </span>
      </div>

      {/* Horizontal scroll, grid view for screens larger than xl */}
      <div
        className="
        flex space-x-4 overflow-x-auto pb-4 scrollbar-thin
        xl:grid xl:grid-cols-4 xl:grid-rows-2 xl:gap-y-6 xl:gap-x-6 xl:justify-between"
      >
        {events.map((event) => (
          <EventCard key={event.id} event={event} />
        ))}
      </div>
    </section>
  );
}
