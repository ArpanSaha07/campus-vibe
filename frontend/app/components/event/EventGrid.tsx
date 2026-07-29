import EventCard from "@/app/components/event/EventCard";
import { EventInstance } from "@/app/types";

export default function EventGrid({ events }: { events: EventInstance[] }) {
   return (
        <div className="container px-2 py-8 mx-auto justify-items-center">
            <div className="grid grid-cols-1 gap-10 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                {events.map((event: EventInstance) => (
                    <EventCard key={event.eventId} event={event} />
                ))}
            </div>
        </div>
    )
}