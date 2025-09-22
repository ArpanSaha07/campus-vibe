import type { ReactNode } from "react"

// Data Types
export type EventInstance = {
  id: number;
  title: string;
  date: string;
  location: string;
  price: string;
  organizer: string;
  followers: number;
  image: string;
  promoted: boolean;
  capacity: number;
  registered: number;
  dateTime: string;
  categories: string[];
};

export type Club = {
    id: string;
    name: string;
    description: string;
    followers: number;
    logo: string;
    banner: string;
    website: string;
    email: string;
    socialLinks: {
        facebook: string;
        instagram: string;
    },
    featured: boolean;
};

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