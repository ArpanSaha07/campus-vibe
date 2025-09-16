import Image from "next/image";

const events = [
  {
    id: 1,
    title: "Loyola High School - Open House 2025",
    date: "Sat, Sep 13 • 9:00 AM",
    location: "Loyola High School",
    price: "Free",
    status: "Almost full",
    image: "/images/event1.png", // replace with your image path
  },
  {
    id: 2,
    title: "SUGAR SAMMY - MONTREAL - ENGLISH EDITION",
    date: "Fri, Sep 12 • 7:00 PM",
    location: "Salle Pierre-Mercure",
    price: "From $79.99",
    status: "Almost full",
    image: "/images/event2.png",
  },
];

export default function EventsSection() {
  return (
    <section className="w-full py-10">
      {/* Tabs */}
      <div className="flex space-x-6 mb-6 text-sm font-medium">
        <button className="text-blue-600 border-b-2 border-blue-600 pb-1">
          All
        </button>
        <button className="text-gray-600 hover:text-blue-600 transition">
          Today
        </button>
        <button className="text-gray-600 hover:text-blue-600 transition">
          This weekend
        </button>
      </div>

      {/* Section title */}
      <h2 className="text-xl font-semibold mb-6">Events in Montreal</h2>

      {/* Events Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
        {events.map((event) => (
          <div
            key={event.id}
            className="bg-white rounded-xl overflow-hidden border border-gray-100 shadow-sm hover:shadow-lg transition cursor-pointer"
          >
            {/* Event image */}
            <div className="relative h-40 w-full">
              <Image
                src={event.image}
                alt={event.title}
                fill
                className="object-cover"
              />
            </div>

            {/* Card content */}
            <div className="p-4">
              {/* Status badge */}
              <span className="inline-block text-xs px-2 py-1 rounded-md bg-purple-100 text-purple-700 mb-2">
                {event.status}
              </span>

              {/* Title */}
              <h3 className="font-semibold text-gray-800 mb-1">
                {event.title}
              </h3>

              {/* Date */}
              <p className="text-sm text-gray-600">{event.date}</p>

              {/* Location */}
              <p className="text-sm text-gray-600">{event.location}</p>

              {/* Price */}
              <p className="text-sm text-gray-800 mt-1">{event.price}</p>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
