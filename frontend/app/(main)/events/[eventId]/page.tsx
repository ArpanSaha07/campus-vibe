import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import type { EventPageProps } from "@/app/types";
import { getEvent } from "@/app/lib/event";
import { getClubById } from "@/app/lib/club";
import { FALLBACK_EVENT_IMAGE } from "@/app/lib/adapters";
import EventShareButton from "@/app/components/event/EventShareButton";
import EventLikeButton from "@/app/components/event/EventLikeButton";
import ClubFollowButton from "@/app/components/club/ClubFollowButton";
import ClubLogo from "@/app/components/club/ClubLogo";
import Chip from "@/app/components/ui/Chip";
import Button from "@/app/components/ui/Button";

// A Server Component, like the club page: the event is resolved before anything
// is sent, so an unknown id gets a real 404 instead of a 200 carrying an error,
// and the content is in the first response rather than after hydration.
//
// This page used to render one hardcoded event for every URL, ignoring the
// eventId entirely (BUG-023). Its organizer was the string
// "fashion-takes-action" — a slug no seeded club shares — which is why the club
// link went nowhere and the Follow button reverted a moment after being
// clicked. The organizer now comes from the event's real organizerId.

/** "Sunday, September 28, 2026" */
function formatDate(date: Date): string {
  return date.toLocaleDateString(undefined, {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

/** "6:00 PM EDT" */
function formatTime(date: Date): string {
  return date.toLocaleTimeString(undefined, {
    hour: "numeric",
    minute: "2-digit",
    timeZoneName: "short",
  });
}

export async function generateMetadata({ params }: EventPageProps): Promise<Metadata> {
  const { eventId } = await params;
  const event = await getEvent(eventId).catch(() => null);
  if (!event) return { title: "Event not found · CampusVibe" };

  return {
    title: `${event.title} · CampusVibe`,
    description: event.details || `${event.title} — ${formatDate(event.dateTime)}.`,
  };
}

export default async function EventPage({ params }: EventPageProps) {
  const { eventId } = await params;
  const event = await getEvent(eventId);

  // In the page body rather than inside a Suspense boundary, so the response is
  // not yet streaming and can still carry a 404 status.
  if (!event) notFound();

  // The event already carries its organizer's id and name, so the block below
  // renders from those alone. This fetch only enriches it with the logo and the
  // follower count, which are club-shaped data no event DTO should carry — so a
  // miss or a failure costs those two details and nothing else.
  const organizer = await getClubById(event.organizer).catch(() => null);

  const banner = event.images[0] ?? FALLBACK_EVENT_IMAGE;

  // Rendered twice — inline on small screens, in the side column on lg+.
  // Extracted so the markup stays identical in both spots.
  const ticket = (
    <div className="lg:sticky lg:top-6 rounded-2xl border border-mist-200 bg-white overflow-hidden">
      <div className="px-5 pt-5 pb-4 space-y-4">
        <div>
          <p className="ticket-label text-ink-600">Date</p>
          <p className="font-mono text-sm text-ink-900 mt-1">{formatDate(event.dateTime)}</p>
          <p className="font-mono text-sm text-ink-900">{formatTime(event.dateTime)}</p>
        </div>
        <div>
          <p className="ticket-label text-ink-600">Location</p>
          <p className="text-sm text-ink-900 mt-1">{event.location.name}</p>
          {event.location.address && (
            <p className="text-xs text-ink-600">{event.location.address}</p>
          )}
        </div>
        <div>
          <p className="ticket-label text-ink-600">Price</p>
          <p className="font-mono text-sm font-medium text-berry-600 mt-1">{event.price}</p>
        </div>
        {event.capacity > 0 && (
          <div>
            <p className="ticket-label text-ink-600">Spots</p>
            <p className="font-mono text-sm text-ink-900 mt-1">
              {Math.max(0, event.capacity - event.registered)} of {event.capacity} left
            </p>
          </div>
        )}
      </div>

      <div className="ticket-divider" aria-hidden="true" />

      <div className="px-5 py-4">
        <Button size="lg" className="w-full">
          Save your spot
        </Button>
      </div>
    </div>
  );

  return (
    <div className="flex flex-col max-w-6xl mx-auto my-10 px-4 sm:px-6">
      {/* Banner */}
      <div className="w-full h-72 lg:h-96 relative">
        <Image
          src={banner}
          alt={event.title}
          fill
          className="object-cover rounded-2xl"
          priority
        />
      </div>

      <h1 className="font-display text-3xl lg:text-4xl font-bold text-ink-900 mt-8">
        {event.title}
      </h1>

      {/* Content */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-10 py-8">
        {/* Left Column */}
        <div className="lg:col-span-2 space-y-10">
          {/* Details */}
          <section>
            <div className="flex items-center justify-between gap-4 mb-3">
              <h2 className="font-display text-2xl font-bold text-ink-900">Details</h2>
              <div className="flex items-center gap-2">
                <EventLikeButton event={{ eventId: event.eventId }} />
                <EventShareButton eventId={event.eventId} />
              </div>
            </div>
            <p className="text-ink-600 pt-2 leading-relaxed">
              {event.details || "No description yet."}
            </p>
          </section>

          {/* Ticket — shown here on small screens, in the side column on lg+ */}
          <div className="lg:hidden">{ticket}</div>

          {/* Categories */}
          {event.categories.length > 0 && (
            <section>
              <h2 className="font-display text-xl font-bold text-ink-900 mb-3">Categories</h2>
              <div className="flex flex-wrap gap-2">
                {event.categories.map((category) => (
                  <Chip key={category}>{category}</Chip>
                ))}
              </div>
            </section>
          )}

          {/* Organized By */}
          <section className="px-5 py-4 bg-mist-100 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              {/* No logo when the club could not be loaded, which ClubLogo
                  renders as the initial of the name the event already gave us. */}
              <ClubLogo name={event.organizerName} logo={organizer?.logo} />
              <div>
                <Link
                  href={`/clubs/${event.organizer}`}
                  className="font-semibold text-ink-900 hover:text-lavender-800"
                >
                  {event.organizerName}
                </Link>
                {organizer && (
                  <p className="font-mono text-xs text-ink-600 mt-1">
                    {organizer.followers} followers
                  </p>
                )}
              </div>
            </div>
            <div className="flex gap-2">
              <Button variant="secondary">Contact</Button>
              <ClubFollowButton clubId={event.organizer} />
            </div>
          </section>

          <a href="#" className="inline-block text-sm text-ink-600 underline hover:text-ink-900">
            Report this event
          </a>
        </div>

        {/* Right Column — the ticket (side column on lg+, hidden on small screens) */}
        <div className="hidden lg:block lg:col-span-1">{ticket}</div>
      </div>
    </div>
  );
}
