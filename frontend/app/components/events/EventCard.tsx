import Image from "next/image";
import { EventInstance } from "@/app/types";

// TODO: add links to the texts, images and buttons; work on the status div section; set card height to auto?;

export default function EventCard({ event }: { event: EventInstance }) {
  return (
    <div
        aria-label="event-card"
        className="bg-transparent flex-shrink-0 w-72 rounded-2xl hover:shadow-lg transition-shadow group duration-300"
    >
      <div className="relative">
        {/* Image */}
        <a
          href="#"
          className="block rounded-t-2xl rounded-b-md overflow-hidden h-35"
        >
          <div className="relative w-full h-full">
            <Image
              src={event.images[0]}
              alt={event.title}
              fill
              className="object-cover"
            />
          </div>
        </a>

        {/* Hover Buttons */}
        <div
          aria-label="event-card-actions"
          className="absolute bottom-2 right-2 z-10 opacity-0 group-hover:opacity-100 transition-opacity duration-200 flex space-x-2"
        >
          <span data-spec="icon-button">
            <button
              aria-label="Save"
              className="p-2 rounded-full bg-white cursor-pointer"
            >
              <svg
                fill="#444444"
                width="20px"
                height="20px"
                viewBox="0 0 24 24"
              >
                <path
                  d="M18.8 6.2C18.1 5.4 17 5 16 5c-1 0-2 .4-2.8 1.2L12 7.4l-1.2-1.2C10 5.4 9 5 8 5c-1 0-2 .4-2.8 1.2-1.5 1.6-1.5 4.2 0 5.8l6.8 7 6.8-7c1.6-1.6 1.6-4.2 0-5.8zm-1.4 4.4L12 16.1l-5.4-5.5c-.8-.8-.8-2.2 0-3C7 7.2 7.5 7 8 7c.5 0 1 .2 1.4.6l2.6 2.7 2.7-2.7c.3-.4.8-.6 1.3-.6s1 .2 1.4.6c.8.8.8 2.2 0 3z"
                ></path>
              </svg>
            </button>
          </span>
          <span data-spec="icon-button">
            <button
              aria-label="Share"
              className="p-2 rounded-full bg-white cursor-pointer"
            >
              <svg
                fill="#444444"
                width="20px"
                height="20px"
                viewBox="0 0 24 24"
              >
                <path
                  d="M18 16v2H6v-2H4v4h16v-4z"
                ></path>
                <path
                  d="M12 4L7 9l1.4 1.4L11 7.8V16h2V7.8l2.6 2.6L17 9l-5-5z"
                ></path>
              </svg>
            </button>
          </span>
        </div>

      </div>

      {/* Card Content */}
      <div className="space-y-1 px-3 pb-3">
        <div className="flex space-x-2 pt-1.5">
          {event.registered / event.capacity >= 0.75 && (
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
        <p className="text-xs text-gray-600">{event.location}</p>
        <p className="text-xs font-medium">{event.price}</p>

        <div className="text-sm text-gray-700">
          <p className="font-medium">{event.organizer.name}</p>
        </div>

        <p className="text-xs text-gray-400 pt-1">
          {event.promoted && "Promoted"}
        </p>
      </div>
    </div>
  );
}
