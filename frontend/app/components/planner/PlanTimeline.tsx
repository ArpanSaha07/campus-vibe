import EventCard from "@/app/components/event/EventCard";
import type { PlanSlot } from "@/app/types";

/**
 * The plan itself: a time gutter down the left, the standard EventCard in each
 * slot, and the reason that pick was chosen underneath it. EventCard stays the
 * single source of truth for how an event is displayed anywhere on the site.
 */
export default function PlanTimeline({ slots }: { slots: PlanSlot[] }) {
  return (
    <ol className="mt-4">
      {slots.map((slot, index) => {
        const isLast = index === slots.length - 1;
        return (
          <li key={slot.event.eventId} className="flex gap-3 sm:gap-6">
            <p className="ticket-label w-16 sm:w-20 shrink-0 pt-3 text-right text-ink-600">
              {slot.time}
            </p>
            <div
              className={`relative flex-1 pl-5 sm:pl-6 ${isLast ? "pb-2" : "border-l border-mist-200 pb-8"}`}
            >
              {/* The last slot drops the connecting line but keeps its marker. */}
              {isLast && (
                <span
                  aria-hidden="true"
                  className="absolute left-0 top-0 h-4 w-px bg-mist-200"
                />
              )}
              <span
                aria-hidden="true"
                className="absolute -left-[4px] top-3.5 h-2 w-2 rounded-full bg-lavender-600"
              />
              <EventCard event={slot.event} />
              <p className="mt-3 w-72 max-w-full text-sm text-ink-600">{slot.rationale}</p>
            </div>
          </li>
        );
      })}
    </ol>
  );
}
