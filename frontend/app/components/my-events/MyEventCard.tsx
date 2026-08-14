import Image from "next/image";
import Link from "next/link";
import { getClubNameById } from "@/app/lib/club";
import { FALLBACK_EVENT_IMAGE } from "@/app/lib/adapters";
import { formatEventDateTime, isPastEvent, myEventStatus } from "@/app/lib/my-events";
import EventLikeButton from "@/app/components/event/EventLikeButton";
import AddToCalendarLink from "@/app/components/event/AddToCalendarLink";
import type { MyEvent } from "@/app/types";

// The agenda-row version of an event card: same ticket-stub anatomy as
// EventCard, but it carries the user's own status instead of promo badges, and
// the heart stays visible rather than appearing on hover — on this page it is
// the control you came for.

const STATUS_STYLES = {
  going: { label: "Going", dot: "bg-go-600", text: "text-go-600" },
  saved: { label: "Saved", dot: "bg-berry-600", text: "text-berry-600" },
} as const;

export default function MyEventCard({ myEvent }: { myEvent: MyEvent }) {
  const { event } = myEvent;
  const badge = STATUS_STYLES[myEventStatus(myEvent)];
  const isPast = isPastEvent(event.dateTime);

  return (
    <div
      aria-label="my-event-card"
      className="group w-full sm:w-72 overflow-hidden rounded-2xl border border-mist-200 bg-white lift"
    >
      <div className="relative h-40">
        <Image
          src={event.images[0] || FALLBACK_EVENT_IMAGE}
          alt={event.title}
          fill
          sizes="(max-width: 640px) 100vw, 288px"
          className={`object-cover ${isPast ? "opacity-75" : ""}`}
        />

        <span
          className={`absolute left-2 top-2 inline-flex items-center gap-1.5 rounded-full bg-white/95 px-2.5 py-1 ticket-label ${badge.text}`}
        >
          <span className={`h-1.5 w-1.5 rounded-full ${badge.dot}`} aria-hidden="true" />
          {badge.label}
        </span>

        <div className="absolute right-2 top-2">
          <EventLikeButton event={event} initiallySaved={myEvent.saved} />
        </div>
      </div>

      <div className="px-4 pb-4 pt-3">
        <Link href={`/events/${event.eventId}`}>
          <h3 className="line-clamp-2 text-[15px] font-semibold leading-snug text-ink-900 group-hover:text-lavender-800">
            {event.title}
          </h3>

          <p className="mt-2 font-mono text-xs text-ink-600">
            {formatEventDateTime(event.dateTime)}
          </p>

          <p className="mt-1 line-clamp-1 text-xs text-ink-600">{event.location.name}</p>

          <p className="mt-2 text-sm font-semibold text-lavender-600">
            by {getClubNameById(event.organizer)}
          </p>
        </Link>

        {/* Outside the <Link> above: nesting an <a> inside one is invalid HTML.
            Past events get no calendar link — there is nothing left to attend. */}
        <div className="mt-2 flex items-center justify-between gap-2">
          <p className="ticket-label text-ink-900">
            {event.registered} {isPast ? "attended" : "attending"}
          </p>
          {!isPast && <AddToCalendarLink event={event} />}
        </div>
      </div>
    </div>
  );
}
