// Mock/static data (or fetch here if SSR/ISR)

import { EventInstance } from "@/app/types";
import { Club } from "@/app/types";

export const popularEvents: EventInstance[] = [
  {
    eventId: "sat-2025",
    title: "ReMode, Circular Fashion Festival | Festival de Mode...",
    details: "A festival celebrating circular fashion and sustainability.",
    dateTime: new Date("2025-09-28T12:00:00"),
    createdAt: new Date("2025-09-01T09:00:00"),
    location: { 
      name: "Society for Arts and Technology [SAT]",
      address: "1201 Boulevard Saint-Laurent, Montréal, QC H2X 2S6",
      mapUrl: "https://www.google.com/maps/embed?pb=!1m18!..." // replace with real maps embed
    },
    price: "Free",
    organizer: "fashion-takes-action",
    organizerName: "Fashion Takes Action",
    followers: 137,
    images: ["/rave.jpg"],
    promoted: true,
    capacity: 200,
    registered: 100,
    categories: ["Dating", "Research", "Food"]
  },
  {
    eventId: "mts-2025",
    title: "Persian New Year Celebration",
    details: "Celebrate the Persian New Year with traditional music, dance, and food.",
    dateTime: new Date("2025-10-06T09:00:00"),
    createdAt: new Date("2025-09-10T09:00:00"),
    location: { 
      name: "Palais des congrès de Montréal",
      address: "1201 Boulevard Saint-Laurent, Montréal, QC H2X 2S6",
      mapUrl: "https://www.google.com/maps/embed?pb=!1m18!..." // replace with real maps embed
    },
    price: "Paid",
    organizer: "tech-montreal",
    organizerName: "PersianEvents",
    followers: 520,
    images: ["/food.jpg"],
    promoted: false,
    capacity: 500,
    registered: 400,
    categories: ["Dating", "Research", "Food"]
  },
  {
    eventId: "art-expo-montreal",
    title: "Art Expo Montreal",
    details: "Showcase of local and international artists.",
    dateTime: new Date("2025-10-18T11:00:00"),
    createdAt: new Date("2025-09-15T09:00:00"),
    location: { 
      name: "Montreal Art Centre",
      address: "1201 Boulevard Saint-Laurent, Montréal, QC H2X 2S6",
      mapUrl: "https://www.google.com/maps/embed?pb=!1m18!..." // replace with real maps embed
    },
    price: "Free",
    organizer: "montreal-artists",
    organizerName: "F1 club",
    followers: 260,
    images: ["/birthday-party.jpg"],
    promoted: false,
    capacity: 300,
    registered: 100,
    categories: ["Dating", "Research", "Food"]
  },
  {
    eventId: "startup-pitch-night",
    title: "Startup Pitch Night",
    details: "Pitch your startup ideas to investors.",
    dateTime: new Date("2025-11-03T18:00:00"),
    createdAt: new Date("2025-09-20T09:00:00"),
    location: { 
      name: "Notman House",
      address: "600 Saint Jerome Street, Montreal, QC H2L 4M1",
      mapUrl: "https://www.google.com/maps/embed?pb=!1m18!..." // replace with real maps embed
    },
    price: "Free",
    organizer: "startup-montreal",
    organizerName: "Making Waves Montreal",
    followers: 420,
    images: ["/party.jpg"],
    promoted: false,
    capacity: 150,
    registered: 120,
    categories: ["Dating", "Research", "Food"]
  },
  {
    eventId: "startup-pitch-night-2",
    title: "Montreal Tech Summit 2025",
    details: "Annual summit for tech enthusiasts and professionals.",
    dateTime: new Date("2025-11-03T18:00:00"),
    createdAt: new Date("2025-09-20T09:00:00"),
    location: { 
      name: "Notman House",
      address: "600 Saint Jerome Street, Montreal, QC H2L 4M1",
      mapUrl: "https://www.google.com/maps/embed?pb=!1m18!..." // replace with real maps embed
    },
    price: "Free",
    organizer: "startup-montreal",
    organizerName: "Making Waves Montreal",
    followers: 420,
    images: ["/frosh3.jpeg"],
    promoted: false,
    capacity: 150,
    registered: 120,
    categories: ["Dating", "Research", "Food"]
  },
  {
    eventId: "annual-ski-trip",
    title: "Ski Trip to Mont Tremblant",
    details: "A club for skiing enthusiasts at McGill University.",
    dateTime: new Date("2025-11-03T18:00:00"),
    createdAt: new Date("2025-09-20T09:00:00"),
    location: { 
      name: "Notman House",
      address: "600 Saint Jerome Street, Montreal, QC H2L 4M1",
      mapUrl: "https://www.google.com/maps/embed?pb=!1m18!..." // replace with real maps embed
    },
    price: "Free",
    organizer: "mcgill-ski-club",
    organizerName: "McGill Ski Club",
    followers: 420,
    images: ["/ski-mcgill.jpg"],
    promoted: false,
    capacity: 150,
    registered: 120,
    categories: ["Nightlife"]
  },
  {
    eventId: "startup-pitch-night-4",
    title: "Startup Pitch Night",
    details: "Pitch your startup ideas to investors.",
    dateTime: new Date("2025-11-03T18:00:00"),
    createdAt: new Date("2025-09-20T09:00:00"),
    location: { 
      name: "Notman House",
      address: "600 Saint Jerome Street, Montreal, QC H2L 4M1",
      mapUrl: "https://www.google.com/maps/embed?pb=!1m18!..." // replace with real maps embed
    },
    price: "Free",
    organizer: "startup-montreal",
    organizerName: "Making Waves Montreal",
    followers: 420,
    images: ["/frosh2.jpeg"],
    promoted: false,
    capacity: 150,
    registered: 120,
    categories: ["Tech", "Networking"]
  },
  {
    eventId: "tech-fair-2025",
    title: "Tech Fair 2025",
    details: "Explore the latest in technology and innovation.",
    dateTime: new Date("2025-11-03T18:00:00"),
    createdAt: new Date("2025-09-20T09:00:00"),
    location: { 
      name: "Notman House",
      address: "600 Saint Jerome Street, Montreal, QC H2L 4M1",
      mapUrl: "https://www.google.com/maps/embed?pb=!1m18!..." // replace with real maps embed
    },
    price: "Free",
    organizer: "startup-montreal",
    organizerName: "Making Waves Montreal",
    followers: 420,
    images: ["/techfair-image.png"],
    promoted: false,
    capacity: 150,
    registered: 120,
    categories: ["Tech", "Networking"]
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
  }
];
