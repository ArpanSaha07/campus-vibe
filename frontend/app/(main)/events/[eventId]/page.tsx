import { use } from "react";
import Image from "next/image";
import { EventPageProps } from "@/app/types";
import EventShareButton from "@/app/components/event/EventShareButton";
import EventLikeButton from "@/app/components/event/EventLikeButton";
import ClubFollowButton from "@/app/components/club/ClubFollowButton";
import Chip from "@/app/components/ui/Chip";
import Button from "@/app/components/ui/Button";

export default function EventPage({ params }: EventPageProps) {
  const { eventId } = use(params);

  // Example event data (replace with API or DB fetch)
  const event = {
    title: "Dance Party",
    eventId: "dance-party",
    banner: "/rave.jpg",
    date: "Sunday, September 28, 2025",
    time: "6:00 PM – 9:00 PM EDT",
    recurrence: "Every week on Sunday until March 25, 2026",
    price: "Free",
    location: {
      name: "BHive Café",
      address: "2313 Sainte-Catherine O, Montréal, QC",
      mapsEmbedUrl:
        "https://www.google.com/maps/embed?pb=!1m18!..." // replace with real maps embed
    },
    details: `
      A festival with high-energy dance music, vibrant lights, and a lively atmosphere.
    `,
    categories: [
      "Montreal Parties",
      "Dance",
      "Nightlife",
      "#danceparty",
      "#lgbtq_friendly",
    ],
    organizer: {
      name: "fashion-takes-action",
      logo: "/frosh1.jpeg",
      followers: 343,
      events: 64
    },
  };

  // The ticket is rendered in two places: inline in the left column on small
  // screens (via lg:hidden), and in the side column on large screens (via
  // hidden lg:block). Extracted so the markup stays identical in both spots.
  const ticket = (
    <div className="lg:sticky lg:top-6 rounded-2xl border border-mist-200 bg-white overflow-hidden">
      <div className="px-5 pt-5 pb-4 space-y-4">
        <div>
          <p className="ticket-label text-ink-600">Date</p>
          <p className="font-mono text-sm text-ink-900 mt-1">{event.date}</p>
          <p className="font-mono text-sm text-ink-900">{event.time}</p>
          <p className="text-xs text-ink-600 mt-1">{event.recurrence}</p>
        </div>
        <div>
          <p className="ticket-label text-ink-600">Location</p>
          <p className="text-sm text-ink-900 mt-1">{event.location.name}</p>
          <p className="text-xs text-ink-600">{event.location.address}</p>
        </div>
        <div>
          <p className="ticket-label text-ink-600">Price</p>
          <p className="font-mono text-sm font-medium text-berry-600 mt-1">{event.price}</p>
        </div>
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
          src={event.banner}
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
            <p className="text-ink-600 pt-2 leading-relaxed">{event.details}</p>
          </section>

          {/* Ticket — shown here on small screens, in the side column on lg+ */}
          <div className="lg:hidden">{ticket}</div>

          {/* Categories */}
          <section>
            <h2 className="font-display text-xl font-bold text-ink-900 mb-3">Categories</h2>
            <div className="flex flex-wrap gap-2">
              {event.categories.map((category) => (
                <Chip key={category}>{category}</Chip>
              ))}
            </div>
          </section>

          {/* Organized By */}
          <section className="px-5 py-4 bg-mist-100 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="w-16 h-16 rounded-full bg-lavender-100 flex items-center justify-center overflow-hidden shrink-0">
                <Image
                  src={event.organizer.logo}
                  alt={event.organizer.name}
                  width={80}
                  height={80}
                  className="object-cover"
                />
              </div>
              <div>
                <a
                  href={`/clubs/${event.organizer.name}`}
                  className="font-semibold text-ink-900 hover:text-lavender-800"
                >
                  {event.organizer.name}
                </a>
                <p className="font-mono text-xs text-ink-600 mt-1">
                  {event.organizer.followers} followers · {event.organizer.events} events
                </p>
              </div>
            </div>
            <div className="flex gap-2">
              <Button variant="secondary">Contact</Button>
              <ClubFollowButton clubId={event.organizer.name} />
            </div>
          </section>

          <a href="#" className="inline-block text-sm text-ink-600 underline hover:text-ink-900">
            Report this event
          </a>
        </div>

        {/* Right Column — the ticket (side column on lg+, hidden on small screens) */}
        <div className="hidden lg:block lg:col-span-1">
          {ticket}
        </div>
      </div>
    </div>
  );
}
