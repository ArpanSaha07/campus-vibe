import type { ReactNode } from "react"

// Data Types
export type EventInstance = {
  id: number;
  title: string;
  description: string;
  dateTime: Date;
  createdAt: Date;
  location: string;
  price: string;
  organizer: Club["id"];
  followers: number;
  images: string[];
  promoted: boolean;
  capacity: number;
  registered: number;
  categories: string[];
};

export type Club = {
    id: string;
    name: string;
    description: string;
    followers: number;
    logo: string;
    socialLinks: {
      email: string;
      website: string;
      facebook: string;
      instagram: string;
    },
    featured: boolean;
    images: string[];
    createdAt: Date;
    // categories: string[];
    // events: EventInstance[];
};

export interface User {
  id: number;
  name: string;
  email: string;
  password: string;
  role: 'user' | 'clubAdmin' | 'admin';
  dateJoined: Date;
};

export interface Admin extends User {
  role: 'admin';
}

export interface ClubAdmin extends User {
  role: 'clubAdmin';
  managedClub: Club["id"];
}

export interface RegularUser extends User {
  role: 'user';
  savedEvents: EventInstance[];
  followedClubs: Club[];
  preferredCategories: string[]
}

// Page Types
export type RootLayoutProps = Readonly<{
  children: ReactNode;
}>

export type ClubPageProps = {
  params: Promise<{
    clubId: string;
  }>;
}

export type EventPageProps = {
  params: Promise<{
    eventId: string;
  }>;
}

// Components Types
export type PillProps = {
    children: ReactNode
    className?: string
}