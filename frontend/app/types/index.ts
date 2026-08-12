import type { ReactNode } from "react"

// Data Types
export type EventInstance = {
  eventId: string;
  title: string;
  details: string;
  dateTime: Date;
  createdAt: Date;
  location: { 
    name: string,
    address: string,
    mapUrl: string,
    locationDetails?: string
  };
  price: string;
  organizer: Club["clubId"];
  followers: number;
  images: string[];
  promoted: boolean;
  capacity: number;
  registered: number;
  categories: string[];
  // recurrence?
};

// How the signed-in user relates to an event on the My events page.
//
// The two are independent, not one status: a bookmark and a commitment are
// different promises, and an event can be both. Mirrors the backend's
// com.campusvibe.user.MyEventDTO.
export type MyEvent = {
  event: EventInstance;
  going: boolean;
  saved: boolean;
};

/** Which badge a card shows. "going" wins when both are true. */
export type MyEventStatus = "going" | "saved";

export type MyEventsTab = "going" | "saved" | "past";

export type Club = {
    clubId: string;
    name: string;
    description: string;
    followers: number;
    logo: string;
    socialLinks: {
      email: string;
      website?: string;
      facebook?: string;
      instagram?: string;
    },
    featured: boolean;
    images: string[];
    createdAt: Date;
    // clubcategories: string[];
};

// AI planner (see .claude/docs/architecture/ai-planner.md).
// Built from mock data today; this is the shape the RAG endpoint should return,
// so the page does not have to change when the backend lands.
export type PlanSlot = {
  time: string;        // printed label, e.g. '6:00 PM'
  event: EventInstance;
  rationale: string;   // why this pick answers the request
};

export type Plan = {
  prompt: string;          // the request this plan answers
  refinements: string[];   // follow-up prompts applied, oldest first
  title: string;
  summary: string;
  slots: PlanSlot[];
  clubs: Club[];
  nextSteps: string[];
};

// Mirrors backend RBAC (see .claude/docs/architecture/user-roles.md and
// com.campusvibe.user.UserDTO).
// One User interface for all roles — role-specific data comes from separate endpoints.
export enum Role {
  USER = "ROLE_USER",
  CLUB_ADMIN = "ROLE_CLUB_ADMIN",
  ADMIN = "ROLE_ADMIN",
}

export interface User {
  id: number;
  name: string;
  email: string;
  roles: Role[];
  createdAt: string; // ISO-8601 instant from the backend
}

export interface AuthResponse {
  token: string;
  user: User;
}

// Raw backend DTO shapes (com.campusvibe.event.EventDTO / club.ClubDTO).
// Adapt to EventInstance/Club via app/lib/adapters before rendering.
export interface ApiEvent {
  id: number;
  title: string;
  description: string | null;
  dateTime: string;
  createdAt: string;
  location: string | null;
  price: string | null;
  organizerId: string;
  followers: number;
  images: string[];
  promoted: boolean;
  capacity: number | null;
  registered: number;
  categories: string[];
}

export interface ApiMyEvent {
  event: ApiEvent;
  going: boolean;
  saved: boolean;
}

export interface ApiClub {
  id: string;
  name: string;
  description: string | null;
  followers: number;
  logo: string | null;
  socialLinks: string | null;
  featured: boolean;
  images: string[];
  createdAt: string;
}

export interface ClubAdminRequest {
  id: number;
  userId: number;
  userName: string;
  userEmail: string;
  clubId: string;
  clubName: string;
  message: string | null;
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
  requestedAt: string;
  reviewedAt: string | null;
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

export type PlannerPageProps = {
  searchParams: Promise<{
    prompt?: string | string[];
  }>;
}

// Components Types
export type PillProps = {
    children: ReactNode
    className?: string
}

export interface ClubFormData {
  name: string;
  description: string;
  logo: File | null;
  images: File[];
  socialLinks: {
    email: string;
    website: string;
    facebook: string;
    instagram: string;
  };
}

export interface LogoPreviewProps {
  logoPreview: string | null;
  onRemove: () => void;
  onUploadClick: () => void;
  isDisabled?: boolean;
  error?: string;
}

export interface ImageGalleryProps {
  imagePreviews: string[];
  imageCount: number;
  maxImages: number;
  onRemove: (index: number) => void;
  onUploadClick: () => void;
  isDisabled?: boolean;
  error?: string;
}

// Error Types
export interface FormErrors {
  name?: string;
  description?: string;
  logo?: string;
  images?: string;
  social?: string;
  general?: string;
}