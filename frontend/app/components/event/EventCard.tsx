import Image from "next/image";
import Link from "next/link";
import { EventInstance } from "@/app/types";
import { getClubNameById } from "@/app/lib/club";
import { FALLBACK_EVENT_IMAGE } from "@/app/lib/adapters";
import EventLikeButton from "@/app/components/event/EventLikeButton";
import EventShareButton from "@/app/components/event/EventShareButton";
import { isRegularUser, me } from "@/app/lib/user";

// TODO: add links to the texts, images and buttons; work on the status div section; set card height to auto?;

export default function EventCard({ event }: { event: EventInstance }) {
  return (
    <div
        aria-label="event-card"
        className="bg-transparent flex-shrink-0 w-72 rounded-2xl hover:shadow-lg transition-shadow group duration-300"
    >
      <div className="relative">
        {/* Image */}
        <div
          className="block rounded-t-2xl rounded-b-md overflow-hidden h-35"
        >
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

        {/* Hover Buttons */}
        {/* {isRegularUser(await me()) && */}
        { true &&
          <div
            aria-label="event-card-actions"
            className="absolute bottom-2 right-2 z-10 opacity-0 group-hover:opacity-100 transition-opacity duration-200 flex space-x-2"
          >
            <EventLikeButton event={event} />
            <EventShareButton eventId={event.eventId} />
          </div>
        }

      </div>

      {/* Card Content */}
      <div className="space-y-1 px-3 pb-3">
        <Link href={`/events/${event.eventId}`}>
          <div className="flex space-x-2 pt-1.5">
            {event.capacity > 0 && event.registered / event.capacity >= 0.75 && (
              <span className="text-xs text-gray-500 font-semibold bg-orange-300 rounded-lg p-2">
                Almost Full
              </span>
            )}

            {
              // event happening soon if within today (or one day?)
              event.dateTime.toISOString().split("T")[0] === new Date().toISOString().split("T")[0] && (
                <span className="text-xs text-gray-500 font-semibold bg-blue-300 rounded-lg p-2">
                  Happening Now
                </span>
              )
            }
          </div>

          <h3 className="font-medium text-[15px] leading-snug line-clamp-2">
            {event.title}
          </h3>
          <p className="text-xs text-gray-600 font-semibold">{event.dateTime.toISOString().split("T")[0]}</p>
          <p className="text-xs text-gray-600">{event.location.name}</p>
          <p className="text-xs font-medium">{event.price}</p>

          <div className="text-sm text-gray-700">
            <p className="font-medium">{getClubNameById(event.organizer)}</p>
          </div>

          <p className="text-xs text-gray-400 pt-1">
            {event.promoted && "Promoted"}
          </p>
        </Link>
      </div>
    </div>
  );
}
