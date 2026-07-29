import Image from "next/image";
import Link from "next/link";
import { EventInstance } from "@/app/types";
import { getClubNameById } from "@/app/lib/club";
import { FALLBACK_EVENT_IMAGE } from "@/app/lib/adapters";
import EventLikeButton from "@/app/components/event/EventLikeButton";
import EventShareButton from "@/app/components/event/EventShareButton";

// Ticket-stub card: image on top, perforated divider, printed (mono) data below.
// See .claude/design-guidelines.md — "Signature: the ticket perforation".

export default function EventCard({ event }: { event: EventInstance }) {
  const isToday =
    event.dateTime.toISOString().split("T")[0] === new Date().toISOString().split("T")[0];
  const almostFull = event.capacity > 0 && event.registered / event.capacity >= 0.75;

  return (
    <div
      aria-label="event-card"
      className="bg-transparent flex-shrink-0 w-72 rounded-2xl hover:shadow-lg transition-shadow overflow-hidden group lift"
    >
      <div className="relative">
        {/* Image */}
        <div className="block overflow-hidden h-40">
          <div className="relative w-full h-full">
            <Image
              src={event.images[0] || FALLBACK_EVENT_IMAGE}
              alt={event.title}
              fill
              sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
              className="object-cover"
            />
          </div>
        </div>

        {/* Hover actions */}
        <div
          aria-label="event-card-actions"
          className="absolute bottom-2 right-2 z-10 opacity-0 group-hover:opacity-100 transition-opacity duration-200 flex space-x-2"
        >
          <EventLikeButton event={event} />
          <EventShareButton eventId={event.eventId} />
        </div>

        {/* Badges over the image */}
        {(almostFull || isToday) && (
          <div className="absolute top-2 left-2 z-10 flex space-x-1.5">
            {almostFull && (
              <span className="ticket-label rounded-full bg-berry-100 text-berry-600 px-2.5 py-1">
                Almost full
              </span>
            )}
            {isToday && (
              <span className="ticket-label rounded-full bg-sun-300 text-ink-900 px-2.5 py-1">
                Happening now
              </span>
            )}
          </div>
        )}
      </div>



      {/* Stub content */}
      <div className="px-4 pt-3 pb-4">
        <Link href={`/events/${event.eventId}`}>
          <h3 className="font-semibold text-[15px] leading-snug line-clamp-2 text-ink-900 group-hover:text-lavender-800">
            {event.title}
          </h3>

          <div className="mt-2 flex items-baseline justify-between font-mono text-xs text-ink-600">
            <span>
              {event.dateTime.toLocaleDateString(undefined, {
                weekday: "short",
                month: "short",
                day: "numeric",
              })}
            </span>
            <span className="font-medium text-berry-600">{event.price}</span>
          </div>

          <p className="mt-1 text-xs text-ink-600 line-clamp-1">{event.location.name}</p>

          <p className="mt-2 text-sm font-semibold text-lavender-600">
            {getClubNameById(event.organizer)}
          </p>

          {event.promoted && (
            <p className="ticket-label text-ink-600/70 pt-2">Promoted</p>
          )}
        </Link>
      </div>
    </div>
  );
}
