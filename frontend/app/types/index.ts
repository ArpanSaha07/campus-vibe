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
  /**
   * The organizing club's display name, carried alongside its id so a card can
   * name the club without fetching it. Before this the name was derived by
   * title-casing the slug against mock data, which was right for the seeded
   * clubs only by coincidence.
   */
  organizerName: string;
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

// Platform-wide roles, mirroring com.campusvibe.user.RoleName. These describe
// the account and travel in the JWT.
//
// ROLE_CLUB_ADMIN is deliberately absent. Managing a club is a relationship
// with that club, not an attribute of the account — see ClubRole below and
// .claude/docs/architecture/club_admin_governance.md.
export enum Role {
  USER = "ROLE_USER",
  ADMIN = "ROLE_ADMIN",
}

/**
 * Authority over one specific club, mirroring com.campusvibe.clubadmin.ClubRole.
 *
 * Never infer this from `User.roles` — it is not there. It comes from
 * `getManagedClubs()`, and the backend re-checks it on every request regardless
 * of what the UI decided to show.
 */
export type ClubRole = "CLUB_OWNER" | "CLUB_ADMIN";

/** Mirrors com.campusvibe.clubadmin.AssignmentStatus. Only ACTIVE grants anything. */
export type AssignmentStatus = "PENDING" | "ACTIVE" | "REVOKED" | "EXPIRED";

export interface User {
  id: number;
  name: string;
  email: string;
  roles: Role[];
  createdAt: string; // ISO-8601 instant from the backend
  /** Whether the address has been confirmed. Display only — the backend decides
   *  what an unverified account may do. */
  emailVerified: boolean;
  /** How the account signs in. Mirrors the backend `AuthProvider` enum. */
  authProvider: "LOCAL" | "GOOGLE";
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
  organizerName: string;
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

/** A club the signed-in user may manage. Mirrors ManagedClubDTO. */
export interface ManagedClub {
  clubId: string;
  clubName: string;
  logo: string | null;
  followers: number;
  role: ClubRole;
  /** Null until a platform admin sets one — club admins cannot change it. */
  officialEmail: string | null;
  officialEmailVerified: boolean;
}

/** One member of a club's management team. Mirrors ClubAdminDTO. */
export interface ClubAdmin {
  assignmentId: number;
  userId: number;
  userName: string;
  userEmail: string;
  role: ClubRole;
  status: AssignmentStatus;
  createdAt: string;
  activatedAt: string | null;
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