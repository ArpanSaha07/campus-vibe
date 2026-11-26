import { connection } from "next/server";
import { listUpcomingEvents } from "@/app/lib/event";
import { formatEventWeekday } from "@/app/lib/event-zone";
import EventSection from "@/app/components/main-page/EventSectionMainPage";
import PersonalisedEventSection from "@/app/components/main-page/PersonalisedEventSection";
import SectionHeading from "@/app/components/ui/SectionHeading";
import type { EventInstance } from "@/app/types";

/**
 * One of the homepage's three event rows — Popular this week, Workshops and
 * Personalised for you — filled with real upcoming events: the ones clubs create and the ones read
 * from club Instagram accounts. They used to show the demo list.
 *
 * Fetches for itself inside the homepage's Suspense, like FeaturedClubs: a
 * backend that is down renders no row rather than failing the page or the
 * production build. The three rows share one cached request.
 */
const ROW_SIZE = 8;
const WEEKEND = ["Fri", "Sat", "Sun"];
const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

const WORKSHOP = ["workshop", "info-session", "study-session"];

// `personal` replaced the Outdoors row (Arpan, 2026-11-26). It is filtered in
// the browser by PersonalisedEventSection, which can read the student's profile.
type Row = "popular" | "workshops" | "personal";

const TITLES: Record<Exclude<Row, "personal">, string> = {
  popular: "Popular this week",
  workshops: "Workshops",
};

export function tagged(event: EventInstance, slugs: string[]) {
  return event.formats.some((f) => slugs.includes(f)) || event.topics.some((t) => slugs.includes(t));
}

/** This weekend's events first; topped up with the soonest ones so the row is never thin. */
export function popular(events: EventInstance[], now: number) {
  const weekend = events.filter(
    (e) => e.dateTime.getTime() - now < WEEK_MS && WEEKEND.includes(formatEventWeekday(e.dateTime)),
  );
  const rest = events.filter((e) => !weekend.includes(e));
  return [...weekend, ...rest].slice(0, ROW_SIZE);
}

export default async function LiveEventSection({ row }: { row: Row }) {
  await connection();

  let events: EventInstance[];
  try {
    events = await listUpcomingEvents();
  } catch (error) {
    console.error("Upcoming events could not be loaded:", error);
    return null;
  }

  if (row === "personal") return <PersonalisedEventSection events={events} />;

  const shown =
    row === "popular"
      ? popular(events, Date.now())
      : events.filter((e) => tagged(e, WORKSHOP)).slice(0, ROW_SIZE);

  if (shown.length === 0) {
    return (
      <section className="max-w-7xl mx-auto py-4 px-4 sm:px-6">
        <SectionHeading title={TITLES[row]} moreHref="/events" moreLabel="Explore more events" />
        <p className="text-sm text-ink-600 py-4">Nothing coming up here yet. New events are added twice a day.</p>
      </section>
    );
  }
  return <EventSection title={TITLES[row]} events={shown} />;
}
