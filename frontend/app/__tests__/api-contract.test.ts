import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import type {
  ApiClub,
  ApiEvent,
  ApiMyEvent,
  AuthResponse,
  ClubAdmin,
  ClubAdminRequest,
  ClubAuditLog,
  ClubInvitation,
  Interest,
  ManagedClub,
  NotificationPreferences,
  OwnershipTransfer,
  ProfileSocialLinks,
  User,
  UserProfile,
} from "@/app/types";

/**
 * The frontend half of the API contract.
 *
 * `app/types/index.ts` is a hand-written mirror of the backend's records —
 * there is no OpenAPI generation and no shared package. So renaming a field in
 * `EventDTO` used to break this app with nothing failing anywhere: the backend
 * suite passed, this suite passed, and the defect surfaced in a browser.
 * Neither side can catch that alone, because neither knows the other's types.
 *
 * Both sides now assert against one file, `contracts/api-dto-fields.json`.
 * `ApiContractTest.java` proves the backend serialises exactly those names;
 * this proves the interfaces below declare exactly those names. Agreeing with
 * the same file is what makes them agree with each other.
 *
 * There are two layers here, and they catch different mistakes:
 *
 *   - `Record<keyof T, true>` is a COMPILE-TIME check. Remove a field from the
 *     interface and the object below has an excess property; add one and the
 *     object is missing a key. Either way `npm run type-check` fails, naming
 *     the field, before any test runs.
 *   - The assertions are a RUNTIME check against the backend's list. This is
 *     the one that catches the case that matters: the interface and the record
 *     drifting apart.
 */

const CONTRACT: Record<string, string[]> = JSON.parse(
  readFileSync(
    resolve(__dirname, "..", "..", "..", "contracts", "api-dto-fields.json"),
    "utf8",
  ),
);

// Keying on `keyof T` is the whole point — these are not free-standing lists of
// strings, they are exhaustive over the interface. Do not replace them with
// `string[]`, which would compile happily while the interface changed.
const eventFields: Record<keyof ApiEvent, true> = {
  id: true,
  title: true,
  description: true,
  dateTime: true,
  createdAt: true,
  location: true,
  price: true,
  organizerId: true,
  organizerName: true,
  followers: true,
  images: true,
  promoted: true,
  capacity: true,
  registered: true,
  categories: true,
};

const clubFields: Record<keyof ApiClub, true> = {
  id: true,
  name: true,
  description: true,
  followers: true,
  logo: true,
  socialLinks: true,
  featured: true,
  images: true,
  createdAt: true,
};

const userFields: Record<keyof User, true> = {
  id: true,
  name: true,
  email: true,
  roles: true,
  createdAt: true,
  emailVerified: true,
  authProvider: true,
};

const myEventFields: Record<keyof ApiMyEvent, true> = {
  event: true,
  going: true,
  saved: true,
};

const authResponseFields: Record<keyof AuthResponse, true> = {
  token: true,
  user: true,
};

const clubAdminRequestFields: Record<keyof ClubAdminRequest, true> = {
  id: true,
  userId: true,
  userName: true,
  userEmail: true,
  clubId: true,
  clubName: true,
  message: true,
  status: true,
  requestedAt: true,
  reviewedAt: true,
};

const clubAdminFields: Record<keyof ClubAdmin, true> = {
  assignmentId: true,
  userId: true,
  userName: true,
  userEmail: true,
  invitedEmail: true,
  role: true,
  status: true,
  createdAt: true,
  activatedAt: true,
};

const clubInvitationFields: Record<keyof ClubInvitation, true> = {
  invitationId: true,
  clubId: true,
  clubName: true,
  clubLogo: true,
  role: true,
  invitedByName: true,
  invitedAt: true,
};

const ownershipTransferFields: Record<keyof OwnershipTransfer, true> = {
  transferId: true,
  clubId: true,
  clubName: true,
  clubLogo: true,
  fromUserId: true,
  fromUserName: true,
  toUserId: true,
  toUserName: true,
  outgoingBecomes: true,
  status: true,
  createdAt: true,
};

const clubAuditLogFields: Record<keyof ClubAuditLog, true> = {
  id: true,
  action: true,
  entityType: true,
  entityId: true,
  actorUserId: true,
  actorName: true,
  metadata: true,
  createdAt: true,
};

const managedClubFields: Record<keyof ManagedClub, true> = {
  clubId: true,
  clubName: true,
  logo: true,
  followers: true,
  role: true,
  officialEmail: true,
  officialEmailVerified: true,
};

const userProfileFields: Record<keyof UserProfile, true> = {
  bio: true,
  faculty: true,
  degree: true,
  subjects: true,
  socialLinks: true,
  interests: true,
  showInterests: true,
  showSocialLinks: true,
};

// Pinned separately because the contract records a nested object as one field
// name: `userProfileFields` above contributes `socialLinks` and says nothing
// about what is inside it. Without an entry of its own, renaming `instagram` on
// either side would break the app with both suites still green.
const profileSocialLinksFields: Record<keyof ProfileSocialLinks, true> = {
  instagram: true,
  facebook: true,
  linkedin: true,
};

const notificationPreferencesFields: Record<keyof NotificationPreferences, true> = {
  eventReminders: true,
  clubAnnouncements: true,
  weeklyDigest: true,
  newFollowerEvents: true,
  productNews: true,
};

const interestFields: Record<keyof Interest, true> = {
  slug: true,
  label: true,
  category: true,
};

/** Backend DTO name → the TypeScript interface mirroring it. */
const MIRRORS: Record<string, Record<string, true>> = {
  EventDTO: eventFields,
  ClubDTO: clubFields,
  UserDTO: userFields,
  MyEventDTO: myEventFields,
  AuthenticationResponse: authResponseFields,
  ClubAdminRequestDTO: clubAdminRequestFields,
  ClubAdminDTO: clubAdminFields,
  ClubInvitationDTO: clubInvitationFields,
  OwnershipTransferDTO: ownershipTransferFields,
  ClubAuditLogDTO: clubAuditLogFields,
  ManagedClubDTO: managedClubFields,
  UserProfileDTO: userProfileFields,
  ProfileSocialLinksDTO: profileSocialLinksFields,
  NotificationPreferencesDTO: notificationPreferencesFields,
  InterestDTO: interestFields,
};

describe("API contract", () => {
  it.each(Object.keys(MIRRORS))(
    "%s — the TypeScript mirror declares exactly the agreed fields",
    (dto) => {
      expect(CONTRACT[dto]).toBeDefined();
      expect(Object.keys(MIRRORS[dto]).sort()).toEqual([...CONTRACT[dto]].sort());
    },
  );

  it("mirrors every type the contract names", () => {
    // Without this, adding a DTO to the contract without a TypeScript mirror
    // passes silently — the loop above only checks what it already knows about.
    // Keys beginning with $ are documentation, not types.
    const documented = Object.keys(CONTRACT)
      .filter((key) => !key.startsWith("$"))
      .sort();

    expect(documented).toEqual(Object.keys(MIRRORS).sort());
  });
});
