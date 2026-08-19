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

/**
 * The part of a profile the user writes about themselves, as opposed to the
 * account facts in `User`.
 *
 * Deliberately NOT fields on `User`. That interface is pinned to the backend's
 * UserDTO by contracts/api-dto-fields.json, and the contract test keys on
 * `Record<keyof User, true>` — so adding `bio` there fails type-check until the
 * backend serialises it too, which is exactly the guard working as intended.
 *
 * Nothing returns this yet. The shape is settled first so the profile page and
 * the edit form that follows it agree on one vocabulary, the same way PlanSlot
 * was settled before the RAG endpoint existed. Every field is nullable because
 * every one of them is optional to the user.
 */
export interface UserProfile {
  /** Free text, the user's own words. Newlines are preserved when shown. */
  bio: string | null;
  /** e.g. "Faculty of Engineering". */
  faculty: string | null;
  /** e.g. "BSc Computer Science". */
  degree: string | null;
  /** Subjects being studied. Empty rather than null when none are chosen. */
  subjects: string[];
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
  /**
   * Null when the caller is a platform admin with no assignment in this club —
   * they may manage it without holding a role in it. Never null in the
   * managed-clubs list, which is built from assignments.
   */
  role: ClubRole | null;
  /** Null until a platform admin sets one — club admins cannot change it. */
  officialEmail: string | null;
  officialEmailVerified: boolean;
}

/** One member of a club's management team. Mirrors ClubAdminDTO. */
export interface ClubAdmin {
  assignmentId: number;
  /** Null while an invitation is outstanding to an address with no account. */
  userId: number | null;
  /** Null in the same case. Render `invitedEmail` instead. */
  userName: string | null;
  userEmail: string | null;
  /** The address the owner invited. Null on rows that were never an invitation. */
  invitedEmail: string | null;
  role: ClubRole;
  status: AssignmentStatus;
  createdAt: string;
  activatedAt: string | null;
}

/**
 * An invitation as the person invited sees it. Mirrors ClubInvitationDTO.
 *
 * Not `ClubAdmin` turned around: this is what someone outside the club is shown
 * before they accept, so it carries the club's identity and none of the other
 * administrators' details.
 */
export interface ClubInvitation {
  invitationId: number;
  clubId: string;
  clubName: string;
  clubLogo: string | null;
  role: ClubRole;
  /** Null if the inviting account has since been deleted. */
  invitedByName: string | null;
  invitedAt: string;
}

/** What becomes of the outgoing owner. Mirrors ClubOwnershipTransfer.OutgoingOwner. */
export type OutgoingOwner = "CLUB_ADMIN" | "REVOKED";

/** Mirrors com.campusvibe.clubadmin.TransferStatus. Only PENDING is live. */
export type TransferStatus = "PENDING" | "ACCEPTED" | "DECLINED" | "CANCELLED";

/**
 * A club changing hands. Mirrors OwnershipTransferDTO.
 *
 * One shape for both sides: the outgoing owner watching their offer, and the
 * admin deciding whether to take the club. Neither learns anything from it the
 * other could not already see.
 */
export interface OwnershipTransfer {
  transferId: number;
  clubId: string;
  clubName: string;
  clubLogo: string | null;
  fromUserId: number;
  fromUserName: string;
  toUserId: number;
  toUserName: string;
  outgoingBecomes: OutgoingOwner;
  status: TransferStatus;
  createdAt: string;
}

/**
 * What an audit entry records. Mirrors com.campusvibe.clubadmin.ClubAuditAction.
 *
 * The backend sends the raw action and lets the frontend word it, so fixing a
 * typo in the sentence does not mean redeploying the API.
 */
export type ClubAuditAction =
  | "CLUB_ADMIN_INVITED"
  | "CLUB_ADMIN_ADDED"
  | "CLUB_ADMIN_DECLINED"
  | "CLUB_ADMIN_REMOVED"
  | "OWNERSHIP_TRANSFER_REQUESTED"
  | "OWNERSHIP_TRANSFER_COMPLETED"
  | "OWNERSHIP_TRANSFER_DECLINED"
  | "OWNERSHIP_TRANSFER_CANCELLED";

/** Mirrors com.campusvibe.clubadmin.AuditEntityType. */
export type AuditEntityType =
  | "CLUB"
  | "EVENT"
  | "CLUB_ADMIN_ASSIGNMENT"
  | "CLUB_OWNERSHIP_TRANSFER";

/** One line of a club's activity log. Mirrors ClubAuditLogDTO. */
export interface ClubAuditLog {
  id: number;
  action: ClubAuditAction;
  entityType: AuditEntityType;
  entityId: string | null;
  /** Null when the entry has no human behind it, or the account is gone. */
  actorUserId: number | null;
  /** The actor's name as it was at the time, not as it is now. */
  actorName: string;
  /** Snapshotted context for rendering the line. Absent keys are normal. */
  metadata: Record<string, string> | null;
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