import Image from "next/image";
import Link from "next/link";
import { EventInstance } from "@/app/types";
import { FALLBACK_EVENT_IMAGE } from "@/app/lib/adapters";
import { isOngoing } from "@/app/lib/event-time";
import { formatEventDateShort } from "@/app/lib/event-zone";
import { normaliseWebLink } from "@/app/lib/links";
import EventPoster from "@/app/components/event/EventPoster";
import EventLikeButton from "@/app/components/event/EventLikeButton";
import EventShareButton from "@/app/components/event/EventShareButton";

// Ticket-stub card: image on top, perforated divider, printed (mono) data below.
// See docs/design-guidelines.md — "Signature: the ticket perforation".
//
// The whole card is the link. Rather than wrap everything in one <Link> — which
// would nest the like/share <button>s inside an <a> — the title link stretches
// itself over the card with an ::after overlay. Anything that needs its own
// click target sits above that overlay on z-10.

export default function EventCard({ event }: { event: EventInstance }) {
  // Running right now, by the event's own start and end. Replaces a check that
  // compared calendar dates as the server saw them, which badged the wrong
  // events on a Montreal evening and a morning event all day after it ended.
  const ongoing = isOngoing(event);
  const almostFull = event.capacity > 0 && event.registered / event.capacity >= 0.75;
  // Imported from Instagram: the card opens the post or story there, and the
  // poster is shown whole rather than cropped to the frame.
  const instagramUrl = normaliseWebLink(event.sourceUrl);
  const linkClass =
    "after:absolute after:inset-0 after:content-[''] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-lavender-600";

  return (
    <div
      aria-label="event-card"
      className="relative bg-transparent flex-shrink-0 w-72 rounded-2xl hover:shadow-lg transition-shadow overflow-hidden group lift"
    >
      <div className="relative">
        {/* Image */}
        <div className="block overflow-hidden h-40">
          <div className="relative w-full h-full">
            {instagramUrl ? (
              <EventPoster
                src={event.images[0] || FALLBACK_EVENT_IMAGE}
                alt={event.title}
                sizes="(max-width: 768px) 100vw, 400px"
              />
            ) : (
              <Image
                src={event.images[0] || FALLBACK_EVENT_IMAGE}
                alt={event.title}
                fill
                sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
                className="object-cover"
              />
            )}
          </div>
        </div>

        {/* Actions: revealed on hover where the device can hover, always shown on
            touch. Keyed on (hover: hover), the same query Tailwind v4 wraps
            group-hover in, so the two never disagree. */}
        <div
          aria-label="event-card-actions"
          className="absolute bottom-2 right-2 z-10 opacity-100 [@media(hover:hover)]:opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-opacity duration-200 flex space-x-2"
        >
          <EventLikeButton event={event} />
          <EventShareButton eventId={event.eventId} />
        </div>

        {/* Badges over the image. pointer-events-none so they read as decoration
            and clicks fall through to the card link underneath. */}
        {(almostFull || ongoing) && (
          <div className="absolute top-2 left-2 z-10 flex space-x-1.5 pointer-events-none">
            {almostFull && (
              <span className="ticket-label rounded-full bg-berry-100 text-berry-600 px-2.5 py-1">
                Almost full
              </span>
            )}
            {ongoing && (
              <span className="ticket-label rounded-full bg-sun-300 text-ink-900 px-2.5 py-1">
                Happening now
              </span>
            )}
          </div>
        )}
      </div>



      {/* Stub content */}
      <div className="px-4 pt-3 pb-4">
        {instagramUrl ? (
          <a href={instagramUrl} target="_blank" rel="noopener noreferrer" className={linkClass}>
            <CardStub event={event} instagram />
          </a>
        ) : (
          <Link href={`/events/${event.eventId}`} className={linkClass}>
            <CardStub event={event} />
          </Link>
        )}
      </div>
    </div>
  );
}

/** The printed half of the card: title, date, price, place, club. */
function CardStub({ event, instagram = false }: { event: EventInstance; instagram?: boolean }) {
  return (
    <>
      <h3 className="font-semibold text-[15px] leading-snug line-clamp-2 text-ink-900 group-hover:text-lavender-800">
        {event.title}
      </h3>

      <div className="mt-2 flex items-baseline justify-between font-mono text-xs text-ink-600">
        <span>
          {formatEventDateShort(event.dateTime)}
        </span>
        <span className="font-medium text-berry-600">{event.price}</span>
      </div>

      <p className="mt-1 text-xs text-ink-600 line-clamp-1">{event.location.name}</p>

      <p className="mt-2 text-sm font-semibold text-lavender-600">
        {event.organizerName}
      </p>

      {event.promoted && (
        <p className="ticket-label text-ink-600/70 pt-2">Promoted</p>
      )}
      {instagram && (
        <p className="mt-2 text-xs font-semibold text-ink-600">View on Instagram ↗</p>
      )}
    </>
  );
}
