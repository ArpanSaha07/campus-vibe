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
    followers: 137,
    images: ["/frosh1.jpeg"],
    promoted: true,
    capacity: 200,
    registered: 100,
    categories: ["Dating", "Research", "Food"]
  },
  {
    eventId: "mts-2025",
    title: "Montreal Tech Summit 2025",
    details: "Annual summit for tech enthusiasts and professionals.",
    dateTime: new Date("2025-10-06T09:00:00"),
    createdAt: new Date("2025-09-10T09:00:00"),
    location: { 
      name: "Palais des congrès de Montréal",
      address: "1201 Boulevard Saint-Laurent, Montréal, QC H2X 2S6",
      mapUrl: "https://www.google.com/maps/embed?pb=!1m18!..." // replace with real maps embed
    },
    price: "Paid",
    organizer: "tech-montreal",
    followers: 520,
    images: ["/frosh2.jpeg"],
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
    followers: 260,
    images: ["/events/event3.jpg"],
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
    followers: 420,
    images: ["/events/event4.jpg"],
    promoted: false,
    capacity: 150,
    registered: 120,
    categories: ["Dating", "Research", "Food"]
  },
  {
    eventId: "startup-pitch-night-2",
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
    followers: 420,
    images: ["/events/event4.jpg"],
    promoted: false,
    capacity: 150,
    registered: 120,
    categories: ["Dating", "Research", "Food"]
  },
  {
    eventId: "startup-pitch-night-3",
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
    followers: 420,
    images: ["/events/event4.jpg"],
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
    followers: 420,
    images: ["/events/event4.jpg"],
    promoted: false,
    capacity: 150,
    registered: 120,
    categories: ["Tech", "Networking"]
  },
  {
    eventId: "startup-pitch-night-5",
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
    followers: 420,
    images: ["/events/event4.jpg"],
    promoted: false,
    capacity: 150,
    registered: 120,
    categories: ["Tech", "Networking"]
  },
];

export const clubs: Club[] = [
  {
    clubId: "fashion-takes-action",
    name: "Fashion Takes Action",
    description: "A student-run organization dedicated to promoting sustainable fashion practices and raising awareness about the environmental and social impacts of the fashion industry.",
    followers: 130,
    logo: "/logos/fta.png",
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
    clubId: "rib-entertainment",
    name: "RIB ENTERTAINMENT",
    description: "A student-run organization dedicated to promoting sustainable fashion practices and raising awareness about the environmental and social impacts of the fashion industry.",
    followers: 380,
    logo: "/frosh1.jpeg",
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
    featured: true,
    images: ["/logos/mwm.png", "/banners/fta.jpg"],
    createdAt: new Date("2025-08-01T09:00:00"),
  },
  {
    clubId: "tech-montreal",
    name: "PersianEvents",
    description: "A student-run organization dedicated to promoting sustainable fashion practices and raising awareness about the environmental and social impacts of the fashion industry.",
    followers: 128,
    logo: "/logos/persian.png",
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
    name: "Glimmering Dolls",
    description: "A student-run organization dedicated to promoting sustainable fashion practices and raising awareness about the environmental and social impacts of the fashion industry.",
    followers: 341,
    logo: "/logos/dolls.png",
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
