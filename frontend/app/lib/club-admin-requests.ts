import { apiFetch } from "@/app/lib/api";
import type {
  ClubAdmin,
  ClubAdminRequest,
  ClubInvitation,
  ManagedClub,
} from "@/app/types";

export async function requestClubAdminAccess(clubId: string, message: string): Promise<ClubAdminRequest> {
  return apiFetch<ClubAdminRequest>(`/api/v1/club-admin-requests`, {
    method: "POST",
    body: JSON.stringify({ clubId, message }),
    auth: true,
  });
}

export async function listClubAdminRequests(
  status?: ClubAdminRequest["status"]
): Promise<ClubAdminRequest[]> {
  const query = status ? `?status=${status}` : "";
  return apiFetch<ClubAdminRequest[]>(`/api/v1/club-admin-requests${query}`, { auth: true });
}

export async function approveClubAdminRequest(id: number): Promise<ClubAdminRequest> {
  return apiFetch<ClubAdminRequest>(`/api/v1/club-admin-requests/${id}/approve`, {
    method: "POST",
    auth: true,
  });
}

export async function rejectClubAdminRequest(id: number): Promise<ClubAdminRequest> {
  return apiFetch<ClubAdminRequest>(`/api/v1/club-admin-requests/${id}/reject`, {
    method: "POST",
    auth: true,
  });
}

/**
 * Every club the signed-in user may manage, with the role they hold in each.
 *
 * Replaces the old `getMyClub()`, which hit `/clubs/my-club` and could only
 * ever answer with one club. Returns `[]` for an ordinary member — that is a
 * normal answer, not an error.
 */
export async function getManagedClubs(): Promise<ManagedClub[]> {
  return apiFetch<ManagedClub[]>(`/api/v1/users/me/managed-clubs`, { auth: true });
}

/**
 * A club's management team. Readable by anyone on it, and by platform admins;
 * 403 for everyone else.
 */
export async function listClubAdmins(clubId: string): Promise<ClubAdmin[]> {
  return apiFetch<ClubAdmin[]>(`/api/v1/clubs/${encodeURIComponent(clubId)}/admins`, {
    auth: true,
  });
}

/**
 * Invites someone to help administer the club, by address.
 *
 * The address does not have to belong to a CampusVibe account yet — the person
 * signs up with it and the invitation is waiting. Owner-only; the server
 * answers 403 for a club admin, whatever the UI decided to render.
 */
export async function inviteClubAdmin(clubId: string, email: string): Promise<ClubAdmin> {
  return apiFetch<ClubAdmin>(`/api/v1/clubs/${encodeURIComponent(clubId)}/admins/invitations`, {
    method: "POST",
    body: JSON.stringify({ email }),
    auth: true,
  });
}

/**
 * Removes an administrator, or cancels an invitation they have not accepted.
 *
 * One call for both because they are one row. Keyed on the assignment id rather
 * than a user id: an invitation to someone without an account has no user id
 * and still has to be cancellable.
 */
export async function removeClubAdmin(clubId: string, assignmentId: number): Promise<void> {
  await apiFetch<void>(
    `/api/v1/clubs/${encodeURIComponent(clubId)}/admins/${assignmentId}`,
    { method: "DELETE", auth: true },
  );
}

/** Invitations waiting on the signed-in user, across every club. */
export async function listMyClubInvitations(): Promise<ClubInvitation[]> {
  return apiFetch<ClubInvitation[]>(`/api/v1/users/me/club-invitations`, { auth: true });
}

/**
 * Accepts an invitation. Returns the club as it now appears on the dashboard,
 * so the caller can route straight into it.
 *
 * Requires a confirmed email address; the server answers 403 with a message
 * saying so if the account has never followed its confirmation link.
 */
export async function acceptClubInvitation(invitationId: number): Promise<ManagedClub> {
  return apiFetch<ManagedClub>(
    `/api/v1/users/me/club-invitations/${invitationId}/accept`,
    { method: "POST", auth: true },
  );
}

export async function declineClubInvitation(invitationId: number): Promise<void> {
  await apiFetch<void>(
    `/api/v1/users/me/club-invitations/${invitationId}/decline`,
    { method: "POST", auth: true },
  );
}
