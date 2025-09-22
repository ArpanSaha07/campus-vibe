// app/events/[slug]/page.tsx
import Image from "next/image";

export default function EventPage({ params }: { params: { slug: string } }) {
  const { slug } = params;

  // Example event data (replace with API or DB fetch)
  const event = {
    title: "Taylor Swift Dance Party",
    banner: "/event-banner.jpg",
    date: "Sunday, September 28, 2025 6:00 PM - 9:00 PM EDT",
    recurrence: "Every week on Sunday until March 25, 2026",
    location: {
      name: "BHive Café",
      address: "2313 Sainte-Catherine O, Montréal, QC",
      mapsEmbedUrl:
        "https://www.google.com/maps/embed?pb=!1m18!...", // replace with real maps embed
    },
    details: `
      Join us for an unforgettable night! Dance to Taylor Swift hits and enjoy
      a lively atmosphere in downtown Montreal.
    `,
    tags: [
      "Canada Events",
      "Quebec Events",
      "Things to do in Montreal, Canada",
      "Montreal Parties",
      "#danceparty",
      "#taylorswift",
      "#lgbtq_friendly",
    ],
    organizer: {
      name: "Glimmering Dolls",
      logo: "/organizer-logo.png",
      followers: 343,
      events: 64,
      hosting: "2 years",
    },
  };

  return (
    <div className="flex flex-col">
      {/* Banner */}
      <div className="w-full h-64 relative">
        <Image
          src={event.banner}
          alt={event.title}
          fill
          className="object-cover"
        />
      </div>

      {/* Content */}
      <div className="max-w-6xl mx-auto grid grid-cols-3 gap-15 py-8">
        {/* Left Column */}
        <div className="col-span-2 space-y-8 border">
          {/* Details */}
          <section>
            <h2 className="text-2xl font-bold mb-2">Details</h2>
            <p className="text-gray-700 whitespace-pre-line">{event.details}</p>
          </section>

          {/* Tags */}
          <section>
            <h2 className="text-xl font-semibold mb-3">Tags</h2>
            <div className="flex flex-wrap gap-2">
              {event.tags.map((tag) => (
                <span
                  key={tag}
                  className="px-3 py-1 text-sm rounded-full bg-gray-100"
                >
                  {tag}
                </span>
              ))}
            </div>
          </section>

          {/* Organized By */}
          <section className="px-4 py-2 mr-20 bg-gray-50 rounded-xl flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Image
                src={event.organizer.logo}
                alt={event.organizer.name}
                width={60}
                height={60}
                className="rounded-full"
              />
              <div className="">
                <a href="#" className="font-bold pb-2 hover:underline">{event.organizer.name}</a>
                <p className="text-sm text-gray-500">
                  Followers: {event.organizer.followers} · Events:{" "}
                  {event.organizer.events} · Hosting: {event.organizer.hosting}
                </p>
              </div>
            </div>
            <div className="flex gap-2 py-6 font-bold">
              <button className="border px-6 py-2 rounded border-gray-200 hover:bg-gray-200">Contact</button>
              <button className="px-6 py-2 rounded bg-orange-600 text-white hover:bg-orange-700">
                Follow
              </button>
            </div>
          </section>

          {/* Report + More Events */}
          <div className="space-y-4">
            <a href="#" className="text-blue-600 text-sm">
              Report this event
            </a>
            <h3 className="text-lg font-semibold">
              More events from this organizer
            </h3>
            {/* Insert EventSection component for more events */}
          </div>
        </div>

        {/* Right Column */}
        <div className="col-span-1">
          <div className="pt-4 border-gray-300 border-1 rounded-xl shadow-sm bg-white space-y-4">
            <div className="px-4">
              <p className="text-sm">{event.date}</p>
              <p className="test-sm">event.time</p>
              <p className="text-xs text-gray-500">{event.recurrence}</p>
            </div>
            <div className="px-4">
              <p className="text-sm">{event.location.name}</p>
              <p className="text-xs text-gray-500">{event.location.address}</p>
            </div>
            <div className="w-full h-40">
              <a data-event-label="event-map" target="_blank" rel="noopener noreferrer" className="text-blue-600 text-sm px-4" href="https://www.google.com/maps/search/?api=1&query=45.4898%2C%20-73.584175">
                <picture>
                  <img 
                    className="" 
                    srcSet="https://maps-googleapis.meetup.com/maps/api/staticmap?center=45.4898%2C+-73.584175&amp;zoom=17&amp;size=480x300&amp;format=png&amp;scale=1&amp;key=AIzaSyBhcQiQISkjMBwLAugJj8V78nMPfitnr44&amp;markers=icon%3Ahttps%3A%2F%2Fsecure.meetupstatic.com%2Fnext%2Fimages%2Fevent%2Fmup-custom-google-map-pin.png%7Ccolor%3A0xF65858%7C45.4898%2C+-73.584175, https://maps-googleapis.meetup.com/maps/api/staticmap?center=45.4898%2C+-73.584175&amp;zoom=17&amp;size=480x300&amp;format=png&amp;scale=2&amp;key=AIzaSyBhcQiQISkjMBwLAugJj8V78nMPfitnr44&amp;markers=icon%3Ahttps%3A%2F%2Fsecure.meetupstatic.com%2Fnext%2Fimages%2Fevent%2Fmup-custom-google-map-pin.png%7Ccolor%3A0xF65858%7C45.4898%2C+-73.584175 2x" 
                    src="https://maps-googleapis.meetup.com/maps/api/staticmap?center=45.4898%2C+-73.584175&amp;zoom=17&amp;size=480x300&amp;format=png&amp;scale=1&amp;key=AIzaSyBhcQiQISkjMBwLAugJj8V78nMPfitnr44&amp;markers=icon%3Ahttps%3A%2F%2Fsecure.meetupstatic.com%2Fnext%2Fimages%2Fevent%2Fmup-custom-google-map-pin.png%7Ccolor%3A0xF65858%7C45.4898%2C+-73.584175" 
                    alt="Google map of the event's location" 
                  />
                </picture>
              </a>
              {/* <iframe
                src={event.location.mapsEmbedUrl}
                width="100%"
                height="100%"
                style={{ border: 0 }}
                allowFullScreen
                loading="lazy"
              ></iframe> */}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
