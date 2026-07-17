import { apiFetch } from "@/app/lib/api";
import type { Club, ClubAdminRequest } from "@/app/types";

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

export async function getMyClub(): Promise<Club> {
  return apiFetch<Club>(`/api/v1/clubs/my-club`, { auth: true });
}
