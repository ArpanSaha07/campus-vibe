// "use client";

// import { useEffect, useState } from "react";
// import { useRouter } from "next/navigation";
// import { useAuth } from "@/app/lib/auth";
// import { getUserEvents } from "@/app/lib/event";
// import type { EventInstance } from "@/app/types";
// import Link from "next/link";
// import Image from "next/image";

// type SortOption = "upcoming" | "past" | "newest";
// type FilterOption = "all" | "registered" | "created";

// export default function MyEventsPage() {
//   const router = useRouter();
//   const { isUserAuthenticated, user } = useAuth();
//   const [events, setEvents] = useState<EventInstance[]>([]);
//   const [loading, setLoading] = useState(true);
//   const [error, setError] = useState<string | null>(null);
//   const [sortBy, setSortBy] = useState<SortOption>("upcoming");
//   const [filterBy, setFilterBy] = useState<FilterOption>("all");

//   // Redirect if not authenticated
//   useEffect(() => {
//     if (!isUserAuthenticated()) {
//       router.push("/login");
//     }
//   }, [isUserAuthenticated, router]);

//   // Fetch user's events
//   useEffect(() => {
//     const fetchEvents = async () => {
//       try {
//         setLoading(true);
//         setError(null);
//         const userEvents = await getUserEvents();
//         setEvents(userEvents);
//       } catch (err) {
//         console.error("Error fetching events:", err);
//         setError("Failed to load your events. Please try again later.");
//       } finally {
//         setLoading(false);
//       }
//     };

//     if (isUserAuthenticated()) {
//       fetchEvents();
//     }
//   }, [isUserAuthenticated]);

//   // Filter and sort events
//   const processedEvents = events
//     .filter((event) => {
//       // In a real app, you'd have metadata to distinguish registered vs created events
//       // For now, we'll show all events
//       if (filterBy === "all") return true;
//       return true;
//     })
//     .sort((a, b) => {
//       const now = new Date();
//       const dateA = new Date(a.dateTime);
//       const dateB = new Date(b.dateTime);

//       switch (sortBy) {
//         case "upcoming":
//           // Show upcoming first
//           const aIsUpcoming = dateA > now;
//           const bIsUpcoming = dateB > now;
//           if (aIsUpcoming !== bIsUpcoming) {
//             return aIsUpcoming ? -1 : 1;
//           }
//           return dateA.getTime() - dateB.getTime();
//         case "past":
//           // Show past first
//           const aIsPast = dateA <= now;
//           const bIsPast = dateB <= now;
//           if (aIsPast !== bIsPast) {
//             return aIsPast ? -1 : 1;
//           }
//           return dateB.getTime() - dateA.getTime();
//         case "newest":
//           // Sort by creation date (newest first)
//           const createA = new Date(a.createdAt);
//           const createB = new Date(b.createdAt);
//           return createB.getTime() - createA.getTime();
//         default:
//           return 0;
//       }
//     });

//   const upcomingCount = events.filter((e) => new Date(e.dateTime) > new Date()).length;
//   const pastCount = events.length - upcomingCount;

//   if (!isUserAuthenticated()) {
//     return null; // Will redirect via useEffect
//   }

//   return (
//     <div className="min-h-screen bg-gray-50">
//       {/* Header */}
//       <div className="bg-white border-b border-gray-200">
//         <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
//           <h1 className="text-3xl font-bold text-gray-900">My Events</h1>
//           <p className="mt-2 text-gray-600">
//             {user?.username ? `Welcome back, ${user.username}!` : "Manage your events"}
//           </p>
//         </div>
//       </div>

//       {/* Controls */}
//       <div className="bg-white border-b border-gray-200 sticky top-16 z-40">
//         <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
//           <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
//             {/* Sort */}
//             <div className="flex items-center gap-2">
//               <label htmlFor="sort" className="text-sm font-medium text-gray-700">
//                 Sort by:
//               </label>
//               <select
//                 id="sort"
//                 value={sortBy}
//                 onChange={(e) => setSortBy(e.target.value as SortOption)}
//                 className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
//               >
//                 <option value="upcoming">Upcoming First</option>
//                 <option value="past">Past First</option>
//                 <option value="newest">Newest</option>
//               </select>
//             </div>

//             {/* Filter */}
//             <div className="flex items-center gap-2">
//               <label htmlFor="filter" className="text-sm font-medium text-gray-700">
//                 Filter:
//               </label>
//               <select
//                 id="filter"
//                 value={filterBy}
//                 onChange={(e) => setFilterBy(e.target.value as FilterOption)}
//                 className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
//               >
//                 <option value="all">All Events ({events.length})</option>
//                 <option value="registered">Registered ({upcomingCount})</option>
//                 <option value="created">Created ({pastCount})</option>
//               </select>
//             </div>
//           </div>
//         </div>
//       </div>

//       {/* Main Content */}
//       <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
//         {/* Loading State */}
//         {loading && (
//           <div className="flex justify-center items-center min-h-[400px]">
//             <div className="text-center">
//               <div className="mb-4 inline-block">
//                 <div className="animate-spin h-12 w-12 border-4 border-orange-200 border-t-orange-600 rounded-full"></div>
//               </div>
//               <p className="text-gray-600">Loading your events...</p>
//             </div>
//           </div>
//         )}

//         {/* Error State */}
//         {error && (
//           <div className="bg-red-50 border border-red-200 rounded-lg p-6 text-center">
//             <p className="text-red-800 font-medium">{error}</p>
//             <button
//               onClick={() => window.location.reload()}
//               className="mt-4 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition"
//             >
//               Try Again
//             </button>
//           </div>
//         )}

//         {/* Empty State */}
//         {!loading && !error && processedEvents.length === 0 && (
//           <div className="text-center py-12">
//             <svg
//               className="mx-auto h-12 w-12 text-gray-400"
//               fill="none"
//               viewBox="0 0 24 24"
//               stroke="currentColor"
//             >
//               <path
//                 strokeLinecap="round"
//                 strokeLinejoin="round"
//                 strokeWidth={2}
//                 d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
//               />
//             </svg>
//             <h3 className="mt-4 text-lg font-medium text-gray-900">No events found</h3>
//             <p className="mt-2 text-gray-500">
//               {filterBy === "all"
//                 ? "You haven't registered for or created any events yet."
//                 : `No ${filterBy} events.`}
//             </p>
//             <div className="mt-6">
//               <Link
//                 href="/events"
//                 className="inline-block px-6 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 transition"
//               >
//                 Explore Events
//               </Link>
//             </div>
//           </div>
//         )}

//         {/* Events Grid */}
//         {!loading && !error && processedEvents.length > 0 && (
//           <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
//             {processedEvents.map((event) => (
//               <EventCard key={event.id} event={event} />
//             ))}
//           </div>
//         )}
//       </div>
//     </div>
//   );
// }

// // Event Card Component
// function EventCard({ event }: { event: EventInstance }) {
//   const isUpcoming = new Date(event.dateTime) > new Date();

//   return (
//     <Link href={`/events/${event.id}`}>
//       <div className="bg-white rounded-lg overflow-hidden shadow-md hover:shadow-lg transition-shadow cursor-pointer h-full">
//         {/* Image */}
//         {event.images && event.images.length > 0 && (
//           <div className="relative h-48 w-full bg-gray-200">
//             <Image
//               src={event.images[0]}
//               alt={event.title}
//               fill
//               className="object-cover"
//             />
//             {isUpcoming && (
//               <div className="absolute top-3 right-3 bg-green-500 text-white px-3 py-1 rounded-full text-xs font-semibold">
//                 Upcoming
//               </div>
//             )}
//             {!isUpcoming && (
//               <div className="absolute top-3 right-3 bg-gray-500 text-white px-3 py-1 rounded-full text-xs font-semibold">
//                 Past
//               </div>
//             )}
//           </div>
//         )}

//         {/* Content */}
//         <div className="p-4">
//           <h3 className="font-bold text-gray-900 line-clamp-2">{event.title}</h3>

//           {/* Date and Time */}
//           <div className="mt-3 flex items-center text-gray-600 text-sm">
//             <svg
//               className="w-4 h-4 mr-2"
//               fill="none"
//               stroke="currentColor"
//               viewBox="0 0 24 24"
//             >
//               <path
//                 strokeLinecap="round"
//                 strokeLinejoin="round"
//                 strokeWidth={2}
//                 d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
//               />
//             </svg>
//             {new Date(event.dateTime).toLocaleDateString("en-US", {
//               month: "short",
//               day: "numeric",
//               year: "numeric",
//               hour: "2-digit",
//               minute: "2-digit",
//             })}
//           </div>

//           {/* Location */}
//           <div className="mt-2 flex items-center text-gray-600 text-sm">
//             <svg
//               className="w-4 h-4 mr-2"
//               fill="none"
//               stroke="currentColor"
//               viewBox="0 0 24 24"
//             >
//               <path
//                 strokeLinecap="round"
//                 strokeLinejoin="round"
//                 strokeWidth={2}
//                 d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"
//               />
//               <path
//                 strokeLinecap="round"
//                 strokeLinejoin="round"
//                 strokeWidth={2}
//                 d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"
//               />
//             </svg>
//             <span className="truncate">{event.location}</span>
//           </div>

//           {/* Stats */}
//           <div className="mt-4 flex justify-between text-sm text-gray-600">
//             <span>{event.registered}/{event.capacity} Registered</span>
//             {event.price && event.price !== "Free" && (
//               <span className="font-semibold text-orange-600">{event.price}</span>
//             )}
//           </div>

//           {/* Categories */}
//           {event.categories && event.categories.length > 0 && (
//             <div className="mt-3 flex flex-wrap gap-2">
//               {event.categories.slice(0, 2).map((category) => (
//                 <span
//                   key={category}
//                   className="inline-block px-2 py-1 bg-gray-100 text-gray-700 text-xs rounded"
//                 >
//                   {category}
//                 </span>
//               ))}
//             </div>
//           )}
//         </div>
//       </div>
//     </Link>
//   );
// }
