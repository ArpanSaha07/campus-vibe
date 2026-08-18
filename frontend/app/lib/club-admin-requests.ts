import { apiFetch } from "@/app/lib/api";
import type {
  ClubAdmin,
  ClubAdminRequest,
  ClubAuditLog,
  ClubInvitation,
  ManagedClub,
  OutgoingOwner,
  OwnershipTransfer,
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
 * One club, as somebody managing it sees it.
 *
 * The single-club twin of `getManagedClubs()`, and the only way a platform
 * admin can load a dashboard: that list is built from assignments and they have
 * none, so they appear in nobody's list. `role` comes back null for exactly
 * that caller.
 *
 * 403 for anyone who may not manage the club, which is what the dashboard guard
 * reads to decide whether to render at all.
 */
export async function getManagedClub(clubId: string): Promise<ManagedClub> {
  return apiFetch<ManagedClub>(
    `/api/v1/clubs/${encodeURIComponent(clubId)}/managed`,
    { auth: true },
  );
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

// --- handing the club on ----------------------------------------------------

/**
 * The club's handover in flight, or null when there is none.
 *
 * The backend answers 204 rather than an empty object for the common case, so
 * apiFetch gets no body to parse; that is normalised to null here rather than
 * at three call sites.
 */
export async function getPendingOwnershipTransfer(
  clubId: string,
): Promise<OwnershipTransfer | null> {
  const transfer = await apiFetch<OwnershipTransfer | null>(
    `/api/v1/clubs/${encodeURIComponent(clubId)}/ownership-transfer`,
    { auth: true },
  );
  return transfer ?? null;
}

/**
 * Offers the club to one of its admins. Owner-only, and nothing moves until
 * they accept.
 *
 * `toUserId` rather than an address: ownership can only pass to an active admin
 * of this club, so the successor is picked from a list rather than typed.
 */
export async function offerOwnership(
  clubId: string,
  toUserId: number,
  outgoingBecomes: OutgoingOwner,
): Promise<OwnershipTransfer> {
  return apiFetch<OwnershipTransfer>(
    `/api/v1/clubs/${encodeURIComponent(clubId)}/ownership-transfer`,
    {
      method: "POST",
      body: JSON.stringify({ toUserId, outgoingBecomes }),
      auth: true,
    },
  );
}

/** The outgoing owner withdrawing, before the successor answers. */
export async function cancelOwnershipTransfer(clubId: string): Promise<void> {
  await apiFetch<void>(
    `/api/v1/clubs/${encodeURIComponent(clubId)}/ownership-transfer`,
    { method: "DELETE", auth: true },
  );
}

/** Handovers waiting on the signed-in user to answer. */
export async function listMyOwnershipTransfers(): Promise<OwnershipTransfer[]> {
  return apiFetch<OwnershipTransfer[]>(`/api/v1/users/me/ownership-transfers`, {
    auth: true,
  });
}

/** Accepts a club. Returns it as it now appears on the dashboard, owner role. */
export async function acceptOwnership(transferId: number): Promise<ManagedClub> {
  return apiFetch<ManagedClub>(
    `/api/v1/users/me/ownership-transfers/${transferId}/accept`,
    { method: "POST", auth: true },
  );
}

export async function declineOwnership(transferId: number): Promise<void> {
  await apiFetch<void>(
    `/api/v1/users/me/ownership-transfers/${transferId}/decline`,
    { method: "POST", auth: true },
  );
}

// --- the activity log -------------------------------------------------------

/**
 * A page of a club's activity log, newest first.
 *
 * Readable by the whole management team, per §19 — an admin who cannot see what
 * changed cannot notice a change they did not expect.
 *
 * `before` is the smallest id already seen, not an offset. Entries are appended
 * constantly, and an offset repeats a row whenever one arrives between two page
 * requests.
 */
export async function listClubAuditLogs(
  clubId: string,
  options: { before?: number; limit?: number } = {},
): Promise<ClubAuditLog[]> {
  const params = new URLSearchParams();
  if (options.before !== undefined) params.set("before", String(options.before));
  if (options.limit !== undefined) params.set("limit", String(options.limit));
  const query = params.toString();

  return apiFetch<ClubAuditLog[]>(
    `/api/v1/clubs/${encodeURIComponent(clubId)}/audit-logs${query ? `?${query}` : ""}`,
    { auth: true },
  );
}
