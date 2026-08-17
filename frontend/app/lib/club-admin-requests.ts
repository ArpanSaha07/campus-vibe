import { apiFetch } from "@/app/lib/api";
import type { ClubAdmin, ClubAdminRequest, ManagedClub } from "@/app/types";

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
