// Mock/static data (or fetch here if SSR/ISR)

import { EventInstance } from "@/app/types";
import { Club } from "@/app/types";

export const popularEvents: EventInstance[] = [
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
    dateTime: "2025-09-20T12:00:00",
    categories: ["Dating", "Research", "Food"]
  },
  {
    id: 2,
    title: "Montreal Tech Summit 2025",
    date: "Mon, Oct 6, 9:00 AM",
    location: "Palais des congrès de Montréal",
    price: "Paid",
    organizer: "Tech Montreal",
    followers: 520,
    image: "/frosh2.jpeg",
    promoted: false,
    capacity: 500,
    registered: 400,
    dateTime: "2025-10-06T09:00:00",
    categories: ["Dating", "Research", "Food"]
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
    dateTime: "2025-10-18T11:00:00",
    categories: ["Dating", "Research", "Food"]
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
    dateTime: "2025-10-18T11:00:00",
    categories: ["Dating", "Research", "Food"]
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
    dateTime: "2025-10-18T11:00:00",
    categories: ["Dating", "Research", "Food"]
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
    dateTime: "2025-10-18T11:00:00",
    categories: ["Nightlife"]
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
    dateTime: "2025-10-18T11:00:00",
    categories: ["Tech", "Networking"]
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
    dateTime: "2025-10-18T11:00:00",
    categories: ["Tech", "Networking"]
  },
];

export const clubs: Club[] = [
  {
    id: "fashion-takes-action",
    name: "Fashion Takes Action",
    followers: 130,
    logo: "/logos/fta.png",
    banner: "/banners/fta.jpg",
    description: "A student-run organization dedicated to promoting sustainable fashion practices and raising awareness about the environmental and social impacts of the fashion industry.",
    website: "",
    email: "",
    socialLinks: {
        facebook: "",
        instagram: "",
    },
    featured: true
  },
  {
    id: "rib-entertainment",
    name: "RIB ENTERTAINMENT",
    followers: 380,
    logo: "/frosh1.jpeg",
     banner: "/banners/fta.jpg",
    description: "A student-run organization dedicated to promoting sustainable fashion practices and raising awareness about the environmental and social impacts of the fashion industry.",
    website: "",
    email: "",
    socialLinks: {
        facebook: "",
        instagram: "",
    },
    featured: true
  },
  {
    id: "making-waves-montreal",
    name: "Making Waves Montreal",
    followers: 174,
    logo: "/logos/mwm.png",
     banner: "/banners/fta.jpg",
    description: "A student-run organization dedicated to promoting sustainable fashion practices and raising awareness about the environmental and social impacts of the fashion industry.",
    website: "",
    email: "",
    socialLinks: {
        facebook: "",
        instagram: "",
    },
    featured: false
  },
  {
    id: "persian-events",
    name: "PersianEvents",
    followers: 128,
    logo: "/logos/persian.png",
     banner: "/banners/fta.jpg",
    description: "A student-run organization dedicated to promoting sustainable fashion practices and raising awareness about the environmental and social impacts of the fashion industry.",
    website: "",
    email: "",
    socialLinks: {
        facebook: "",
        instagram: "",
    },
    featured: false
  },
  {
    id: "glimmering-dolls",
    name: "Glimmering Dolls",
    followers: 341,
    logo: "/logos/dolls.png",
     banner: "/banners/fta.jpg",
    description: "A student-run organization dedicated to promoting sustainable fashion practices and raising awareness about the environmental and social impacts of the fashion industry.",
    website: "",
    email: "",
    socialLinks: {
        facebook: "",
        instagram: "",
    },
    featured: true
  }
];
