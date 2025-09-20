import { register } from "module";
import Image from "next/image";

// add links to the texts, images and buttons

const events = [
  {
    id: 1,
    title: "ReMode, Circular Fashion Festival | Festival de Mode...",
    date: "Sun, Sep 28, 12:00 PM",
    location: "Society for Arts and Technology [SAT]",
    price: "Free",
    organizer: "Fashion Takes Action",
    followers: 137,
    image: "/frosh1.jpeg",
    promoted: true,
    capacity: 200,
    registered: 100,
    dateTime: "2025-09-20T12:00:00"
  },
  {
    id: 2,
    title: "Montreal Tech Summit 2025",
    date: "Mon, Oct 6, 9:00 AM",
    location: "Palais des congrès de Montréal",
    price: "Paid",
    organizer: "Tech Montreal",
    followers: 520,
    image: "/events/event2.jpg",
    promoted: false,
    capacity: 500,
    registered: 400,
    dateTime: "2025-10-06T09:00:00"
  },
  {
    id: 3,
    title: "Art Expo Montreal",
    date: "Sat, Oct 18, 11:00 AM",
    location: "Montreal Art Centre",
    price: "Free",
    organizer: "Montreal Artists",
    followers: 260,
    image: "/events/event3.jpg",
    promoted: false,
    capacity: 300,
    registered: 100,
    dateTime: "2025-10-18T11:00:00"
  },
  {
    id: 4,
    title: "Startup Pitch Night",
    date: "Fri, Nov 3, 6:00 PM",
    location: "Notman House",
    price: "Free",
    organizer: "Startup Montreal",
    followers: 420,
    image: "/events/event4.jpg",
    promoted: false,
    capacity: 150,
    registered: 120,
    dateTime: "2025-10-18T11:00:00"
  },
  {
    id: 5,
    title: "Startup Pitch Night",
    date: "Fri, Nov 3, 6:00 PM",
    location: "Notman House",
    price: "Free",
    organizer: "Startup Montreal",
    followers: 420,
    image: "/events/event4.jpg",
    promoted: false,
    capacity: 150,
    registered: 120,
    dateTime: "2025-10-18T11:00:00"
  },
  {
    id: 6,
    title: "Startup Pitch Night",
    date: "Fri, Nov 3, 6:00 PM",
    location: "Notman House",
    price: "Free",
    organizer: "Startup Montreal",
    followers: 420,
    image: "/events/event4.jpg",
    promoted: false,
    capacity: 150,
    registered: 120,
    dateTime: "2025-10-18T11:00:00"
  },
  {
    id: 7,
    title: "Startup Pitch Night",
    date: "Fri, Nov 3, 6:00 PM",
    location: "Notman House",
    price: "Free",
    organizer: "Startup Montreal",
    followers: 420,
    image: "/events/event4.jpg",
    promoted: false,
    capacity: 150,
    registered: 120,
    dateTime: "2025-10-18T11:00:00"
  },
  {
    id: 8,
    title: "Startup Pitch Night",
    date: "Fri, Nov 3, 6:00 PM",
    location: "Notman House",
    price: "Free",
    organizer: "Startup Montreal",
    followers: 420,
    image: "/events/event4.jpg",
    promoted: false,
    capacity: 150,
    registered: 120,
    dateTime: "2025-10-18T11:00:00"
  }
];

export default function EventsSection() {
  return (
    <section className="max-w-7xl mx-auto px-6 py-10">
        <div className="flex flex-row justify-between">
            <h2 className="text-xl font-semibold mb-6">Popular events at McGill</h2>
            <span><a href="#" className="text-sm text-gray-700 hover:text-indigo-600 hover:underline">Explore more events</a> &nbsp;&gt;</span>
        </div>

      {/* Grid for xl screens, horizontal scroll for smaller */}
      <div className="
        flex space-x-4 overflow-x-auto pb-4 scrollbar-thin
        xl:grid xl:grid-cols-4 xl:grid-rows-2 xl:gap-y-4 xl:overflow-hidden xl:justify-between group"
    >
        {events.map((event) => (
          <div
            key={event.id}
            className="bg-transparent flex-shrink-0 w-75 rounded-2xl hover:shadow-lg transition-shadow cursor-pointer border"
          >
            <div className="relative">
                {/* Image */}
                <a href="#" className="block rounded-t-2xl rounded-b-md overflow-hidden h-35">
                <div className="relative w-full h-full">
                    <Image
                    src={event.image}
                    alt={event.title}
                    fill
                    className="object-cover"
                    />
                </div>
                </a>
                {/* Actions */}
                <div 
                    aria-label="event-card-actions"
                    className="absolute bottom-2 right-2 z-10 opacity-0 group-hover:opacity-100 transition-opacity duration-200 flex space-x-2"
                >
                    <span data-spec="icon-button">
                        <button aria-label="Save" className="p-2 rounded-full bg-white">
                            <svg fill="#444444" width="25px" height="25px" viewBox="0 0 24 24">
                                <path id="heart-chunky_svg__eds-icon--heart-chunky_base" fill-rule="evenodd" clip-rule="evenodd" d="M18.8 6.2C18.1 5.4 17 5 16 5c-1 0-2 .4-2.8 1.2L12 7.4l-1.2-1.2C10 5.4 9 5 8 5c-1 0-2 .4-2.8 1.2-1.5 1.6-1.5 4.2 0 5.8l6.8 7 6.8-7c1.6-1.6 1.6-4.2 0-5.8zm-1.4 4.4L12 16.1l-5.4-5.5c-.8-.8-.8-2.2 0-3C7 7.2 7.5 7 8 7c.5 0 1 .2 1.4.6l2.6 2.7 2.7-2.7c.3-.4.8-.6 1.3-.6s1 .2 1.4.6c.8.8.8 2.2 0 3z"></path>
                            </svg>
                        </button>
                    </span>
                    <span data-spec="icon-button">
                        <button aria-label="Share" className="p-2 rounded-full bg-white">
                            <svg fill="#444444" width="25px" height="25px" viewBox="0 0 24 24">
                                <path id="share-ios-chunky_svg__eds-icon--share-ios-chunky_base" fill-rule="evenodd" clip-rule="evenodd" d="M18 16v2H6v-2H4v4h16v-4z"></path>
                                <path id="share-ios-chunky_svg__eds-icon--share-ios-chunky_arrow" fill-rule="evenodd" clip-rule="evenodd" d="M12 4L7 9l1.4 1.4L11 7.8V16h2V7.8l2.6 2.6L17 9l-5-5z"></path>
                            </svg>
                        </button>
                    </span>
                </div>
            </div>


            {/* Card Content */}
            <div className="space-y-1 px-3 pb-3">

                <div className="flex space-x-2 py-0.5">
                    {event.registered/ event.capacity >= 0.75 && 
                        <span className="text-xs text-gray-500 font-semibold bg-orange-300 rounded-lg p-2">Almost Full</span>}

                    {// event happening soon if within today (or one day?)
                    event.date === new Date().toISOString().split("T")[0] && 
                        <span className="text-xs text-gray-500 font-semibold bg-blue-300 rounded-lg p-2">Happening Soon</span>}
                </div>

              <h3 className="font-medium text-[15px] leading-snug line-clamp-2">
                {event.title}
              </h3>
              <p className="text-xs text-gray-600 font-semibold">{event.date}</p>
              <p className="text-xs text-gray-600">{event.location}</p>
              <p className="text-xs font-medium">{event.price}</p>

              <div className="text-sm text-gray-700">
                <p className="font-medium">{event.organizer}</p>
              </div>

              <p className="text-xs text-gray-400 pt-1">{event.promoted && "Promoted"}</p>
            </div>

          </div>
        ))}
      </div>
    </section>
  );
}




