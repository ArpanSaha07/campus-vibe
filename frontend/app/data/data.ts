// Mock/static data (or fetch here if SSR/ISR)

import { EventInstance } from "@/app/types";
import { Club } from "@/app/types";

// The eight draft listings from campusvibe-draft-event-seed-data.json, in its
// order. Every value not in that file — price, followers, capacity, registered,
// promoted, createdAt, the street address and the map embed — is mock filler
// carried over from the rows these replaced. Rooms are TBD in the seed, so they
// stay TBD in `locationDetails`.
//
// The seed's topics and formats are free text; they are written here as
// interest_catalogue and event_formats slugs (V20, V26, V29), because that is
// the vocabulary the filters join on.
export const popularEvents: EventInstance[] = [
  {
    eventId: "diwali-lights-night",
    title: "Diwali Lights Night",
    details: "Draft showcase listing based on McGill ISA's established cultural-programming themes. Celebrate Diwali with music, dance, festive food, and a welcoming community atmosphere. Date, room, admission details, and organizer approval must be confirmed before publication.",
    dateTime: new Date("2026-09-25T19:00:00-04:00"),
    endTime: new Date("2026-09-25T22:00:00-04:00"),
    createdAt: new Date("2026-09-01T09:00:00-04:00"),
    location: {
      name: "McGill University Centre",
      address: "McGill University, 845 Rue Sherbrooke Ouest, Montréal, QC H3A 0G4",
      mapUrl: "https://www.google.com/maps/embed?pb=!1m18!...", // replace with real maps embed
      locationDetails: "Room TBD"
    },
    price: "Free",
    organizer: "mcgill-isa",
    organizerName: "McGill Indian Students' Association (ISA)",
    followers: 480,
    images: ["/rave.jpg"],
    promoted: true,
    capacity: 200,
    registered: 100,
    topics: ["faith-spirituality", "live-music", "international-students", "make-friends"],
    formats: ["social", "performance"]
  },
  {
    eventId: "bollywood-dance-workshop",
    title: "Bollywood Dance Workshop",
    details: "Draft showcase listing based on McGill ISA's established cultural-programming themes. Learn an upbeat beginner-friendly Bollywood routine, meet other students, and enjoy a relaxed dance session. Date, room, instructor, and registration details must be confirmed before publication.",
    dateTime: new Date("2026-10-03T17:30:00-04:00"),
    endTime: new Date("2026-10-03T19:30:00-04:00"),
    createdAt: new Date("2026-09-01T09:00:00-04:00"),
    location: {
      name: "McGill University Centre",
      address: "McGill University, 845 Rue Sherbrooke Ouest, Montréal, QC H3A 0G4",
      mapUrl: "https://www.google.com/maps/embed?pb=!1m18!...", // replace with real maps embed
      locationDetails: "Room TBD"
    },
    price: "Free",
    organizer: "mcgill-isa",
    organizerName: "McGill Indian Students' Association (ISA)",
    followers: 480,
    images: ["/food.jpg"],
    promoted: false,
    capacity: 60,
    registered: 34,
    topics: ["live-music", "international-students", "mental-health"],
    formats: ["workshop"]
  },
  {
    eventId: "chai-chaat-social",
    title: "Chai & Chaat Social",
    details: "Draft showcase listing based on McGill ISA's established cultural-programming themes. Connect with new and returning students over chai, Indian snacks, conversation, and casual games. Date, room, menu, and accessibility details must be confirmed before publication.",
    dateTime: new Date("2026-10-10T16:00:00-04:00"),
    endTime: new Date("2026-10-10T18:00:00-04:00"),
    createdAt: new Date("2026-09-01T09:00:00-04:00"),
    location: {
      name: "McGill University Centre",
      address: "McGill University, 845 Rue Sherbrooke Ouest, Montréal, QC H3A 0G4",
      mapUrl: "https://www.google.com/maps/embed?pb=!1m18!...", // replace with real maps embed
      locationDetails: "Room TBD"
    },
    price: "Free",
    organizer: "mcgill-isa",
    organizerName: "McGill Indian Students' Association (ISA)",
    followers: 480,
    images: ["/birthday-party.jpg"],
    promoted: false,
    capacity: 120,
    registered: 45,
    topics: ["food-drink", "international-students", "make-friends"],
    formats: ["social"]
  },
  {
    eventId: "kamayan-community-dinner",
    title: "Kamayan Community Dinner",
    details: "Draft showcase listing inspired by MUFASA's Filipino cultural and community mandate. Gather for a communal Filipino-style meal, cultural sharing, and conversation with students from across McGill. Date, room, food service, pricing, and organizer approval must be confirmed before publication.",
    dateTime: new Date("2026-09-26T18:30:00-04:00"),
    endTime: new Date("2026-09-26T21:00:00-04:00"),
    createdAt: new Date("2026-09-01T09:00:00-04:00"),
    location: {
      name: "McGill University Centre",
      address: "McGill University, 845 Rue Sherbrooke Ouest, Montréal, QC H3A 0G4",
      mapUrl: "https://www.google.com/maps/embed?pb=!1m18!...", // replace with real maps embed
      locationDetails: "Room TBD"
    },
    price: "Free",
    organizer: "mufasa",
    organizerName: "McGill University Filipino Asian Students' Association (MUFASA)",
    followers: 260,
    images: ["/party.jpg"],
    promoted: false,
    capacity: 150,
    registered: 110,
    topics: ["food-drink", "potlucks", "international-students", "make-friends"],
    formats: ["social"]
  },
  {
    eventId: "filipino-culture-games-night",
    title: "Filipino Culture & Games Night",
    details: "Draft showcase listing inspired by MUFASA's Filipino cultural and community mandate. Discover Filipino traditions through team games, trivia, music, and low-pressure social activities. Date, room, capacity, and organizer approval must be confirmed before publication.",
    dateTime: new Date("2026-10-08T18:00:00-04:00"),
    endTime: new Date("2026-10-08T20:00:00-04:00"),
    createdAt: new Date("2026-09-01T09:00:00-04:00"),
    location: {
      name: "McGill University Centre",
      address: "McGill University, 845 Rue Sherbrooke Ouest, Montréal, QC H3A 0G4",
      mapUrl: "https://www.google.com/maps/embed?pb=!1m18!...", // replace with real maps embed
      locationDetails: "Room TBD"
    },
    price: "Free",
    organizer: "mufasa",
    organizerName: "McGill University Filipino Asian Students' Association (MUFASA)",
    followers: 260,
    images: ["/frosh3.jpeg"],
    promoted: false,
    capacity: 80,
    registered: 52,
    topics: ["board-games", "trivia", "international-students", "make-friends"],
    formats: ["game-night", "social"]
  },
  {
    eventId: "halo-halo-study-break",
    title: "Halo-Halo Study Break",
    details: "Draft showcase listing inspired by MUFASA's Filipino cultural and community mandate. Take a midterm-season break, meet other students, and enjoy a Filipino dessert-themed social. Date, room, food service, allergens, and organizer approval must be confirmed before publication.",
    dateTime: new Date("2026-10-22T16:00:00-04:00"),
    endTime: new Date("2026-10-22T18:00:00-04:00"),
    createdAt: new Date("2026-09-01T09:00:00-04:00"),
    location: {
      name: "McGill University Centre",
      address: "McGill University, 845 Rue Sherbrooke Ouest, Montréal, QC H3A 0G4",
      mapUrl: "https://www.google.com/maps/embed?pb=!1m18!...", // replace with real maps embed
      locationDetails: "Room TBD"
    },
    price: "Free",
    organizer: "mufasa",
    organizerName: "McGill University Filipino Asian Students' Association (MUFASA)",
    followers: 260,
    images: ["/ski-mcgill.jpg"],
    promoted: false,
    capacity: 100,
    registered: 38,
    topics: ["food-drink", "study-groups", "mental-health", "international-students"],
    formats: ["social"]
  },
  {
    eventId: "networking-101-workshop",
    title: "Networking 101 Workshop",
    details: "Draft showcase listing based on McConnect's established professional-development programming. Practice introductions, build a concise personal pitch, and learn how to follow up after meeting recruiters and professionals. Date, speakers, room, and registration details must be confirmed before publication.",
    dateTime: new Date("2026-09-24T18:00:00-04:00"),
    endTime: new Date("2026-09-24T19:30:00-04:00"),
    createdAt: new Date("2026-09-01T09:00:00-04:00"),
    location: {
      name: "McGill University Centre",
      address: "McGill University, 845 Rue Sherbrooke Ouest, Montréal, QC H3A 0G4",
      mapUrl: "https://www.google.com/maps/embed?pb=!1m18!...", // replace with real maps embed
      locationDetails: "Room TBD"
    },
    price: "Free",
    organizer: "mcconnect-mcgill",
    organizerName: "McConnect McGill",
    followers: 320,
    images: ["/frosh2.jpeg"],
    promoted: false,
    capacity: 70,
    registered: 55,
    topics: ["networking", "public-speaking"],
    formats: ["workshop"]
  },
  {
    eventId: "mcconnect-fall-career-fair",
    title: "McConnect Fall Career Fair",
    details: "Draft showcase listing based on McConnect's established career-fair programming. Meet professionals from several industries, learn about internships and early-career paths, and practise purposeful networking. Date, venue, participating organizations, tickets, and organizer approval must be confirmed before publication.",
    dateTime: new Date("2026-10-05T18:00:00-04:00"),
    endTime: new Date("2026-10-05T20:00:00-04:00"),
    createdAt: new Date("2026-09-01T09:00:00-04:00"),
    location: {
      name: "Trottier Building",
      address: "McGill University, 845 Rue Sherbrooke Ouest, Montréal, QC H3A 0G4",
      mapUrl: "https://www.google.com/maps/embed?pb=!1m18!...", // replace with real maps embed
      locationDetails: "Room TBD"
    },
    price: "Free",
    organizer: "mcconnect-mcgill",
    organizerName: "McConnect McGill",
    followers: 320,
    images: ["/techfair-image.png"],
    promoted: false,
    capacity: 400,
    registered: 260,
    topics: ["career-fairs", "networking"],
    formats: ["fair", "networking"]
  },
];

export const clubs: Club[] = [
  { 
    clubId: "mcgill-ski-club",
    name: "McGill Ski Club",
    description: "A student-run organization dedicated to promoting sustainable fashion practices and raising awareness about the environmental and social impacts of the fashion industry.",
    followers: 220,
    logo: "/ski-mcgill.jpg",
    socialLinks: {
      email: "",
      website: "",
      facebook: "",
      instagram: "",
    },
    featured: true,
    images: ["/logos/ski.png", "/banners/fta.jpg"],
    createdAt: new Date("2025-08-01T09:00:00"),
    category: "general",
    interests: [],
  },
  {
    clubId: "fashion-takes-action",
    name: "Fashion Takes Action",
    description: "A student-run organization dedicated to promoting sustainable fashion practices and raising awareness about the environmental and social impacts of the fashion industry.",
    followers: 130,
    logo: "/rave.jpg",
    socialLinks: {
      email: "",
      website: "",
      facebook: "",
      instagram: "",
    },
    featured: true,
    images: ["/logos/fta.png", "/banners/fta.jpg"],
    createdAt: new Date("2025-08-01T09:00:00"),
    category: "general",
    interests: [],
  },
  {
    clubId: "eng-frosh",
    name: "Eng Frosh",
    description: "A student-run organization dedicated to promoting sustainable fashion practices and raising awareness about the environmental and social impacts of the fashion industry.",
    followers: 380,
    logo: "/frosh3.jpeg",
    socialLinks: {
      email: "",
      website: "",
      facebook: "",
      instagram: "",
    },
    featured: true,
    images: ["/frosh1.jpeg", "/banners/fta.jpg"],
    createdAt: new Date("2025-08-01T09:00:00"),
    category: "general",
    interests: [],
  },
  {
    clubId: "startup-montreal",
    name: "Making Waves Montreal",
    description: "A student-run organization dedicated to promoting sustainable fashion practices and raising awareness about the environmental and social impacts of the fashion industry.",
    followers: 174,
    logo: "/logos/mwm.png",
    socialLinks: {
      email: "",
      website: "",
      facebook: "",
      instagram: "",
    },
    featured: false,
    images: ["/logos/mwm.png", "/banners/fta.jpg"],
    createdAt: new Date("2025-08-01T09:00:00"),
    category: "general",
    interests: [],
  },
  {
    clubId: "tech-montreal",
    name: "PersianEvents",
    description: "A student-run organization dedicated to promoting sustainable fashion practices and raising awareness about the environmental and social impacts of the fashion industry.",
    followers: 128,
    logo: "/food.jpg",
    socialLinks: {
      email: "",
      website: "",
      facebook: "",
      instagram: "",
    },
    featured: true,
    images: ["/logos/persian.png", "/banners/fta.jpg"],
    createdAt: new Date("2025-08-01T09:00:00"),
    category: "general",
    interests: [],
  },
  {
    clubId: "montreal-artists",
    name: "F1 club",
    description: "A student-run organization dedicated to promoting sustainable fashion practices and raising awareness about the environmental and social impacts of the fashion industry.",
    followers: 341,
    logo: "/frosh3.jpeg",
    socialLinks: {
      email: "",
      website: "",
      facebook: "",
      instagram: "",
    },
    featured: true,
    images: ["/logos/dolls.png", "/banners/fta.jpg"],
    createdAt: new Date("2025-08-01T09:00:00"),
    category: "general",
    interests: [],
  }
];
