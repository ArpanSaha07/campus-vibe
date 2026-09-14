import { apiFetch } from "@/app/lib/api";
import { clubSlug } from "@/app/lib/services/clubService";
import type { ClubCreationRequest, NewClubProposal } from "@/app/types";

/**
 * Proposing a club, and reviewing the proposals.
 *
 * The ordinary user's route to a club. `POST /api/v1/clubs` is admin-only since
 * ADR-004, so everyone else submits here and an admin approves — which creates
 * the club and makes the requester its owner in one transaction.
 *
 * Deliberately separate from `club-admin-requests.ts`, which claims a club that
 * already exists. The two render as one Pending requests list on `/admin`, but
 * that is a presentation choice: they approve through different endpoints
 * because approving a proposal has to create the club first.
 */

/**
 * Submits a proposal. No images — a logo or a banner needs a club id and an S3
 * key, and neither exists until approval.
 *
 * The contact links do travel, as one JSON string in the shape
 * `clubs.social_links` holds, so approval can carry the value onto the club
 * without translating it. That is why this stringifies rather than sending an
 * object, the same way `updateClubSocialLinks` does on the admin path.
 *
 * The slug is derived here with the same `clubSlug` the admin create path uses,
 * so the name check the form already ran answers the question that actually
 * decides. The server normalises it again rather than trusting this — and it
 * normalises the links too, which is where a `javascript:` URL is refused.
 */
export async function proposeClub(proposal: NewClubProposal): Promise<ClubCreationRequest> {
  return apiFetch<ClubCreationRequest>(`/api/v1/club-creation-requests`, {
    method: "POST",
    body: JSON.stringify({
      id: clubSlug(proposal.name),
      name: proposal.name.trim(),
      description: proposal.description.trim(),
      category: proposal.category,
      interests: proposal.interests,
      message: proposal.message.trim(),
      // Omitted rather than sent as an object of empty strings when the
      // requester filled in none of them: the column is NULL for a proposal
      // nobody answered, and an empty object would claim otherwise.
      socialLinks: hasAnyLink(proposal.socialLinks)
        ? JSON.stringify(proposal.socialLinks)
        : null,
    }),
    auth: true,
  });
}

function hasAnyLink(links: NewClubProposal["socialLinks"]): boolean {
  return Object.values(links).some((value) => value && value.trim() !== "");
}

/** The review queue. Admin only — the backend answers 403 to anyone else. */
export async function listClubCreationRequests(
  status?: ClubCreationRequest["status"],
): Promise<ClubCreationRequest[]> {
  const query = status ? `?status=${status}` : "";
  return apiFetch<ClubCreationRequest[]>(`/api/v1/club-creation-requests${query}`, { auth: true });
}

/** Approving creates the club and installs the requester as its owner. */
export async function approveClubCreationRequest(id: number): Promise<ClubCreationRequest> {
  return apiFetch<ClubCreationRequest>(`/api/v1/club-creation-requests/${id}/approve`, {
    method: "POST",
    auth: true,
  });
}

/** Rejecting creates nothing and carries no reason. */
export async function rejectClubCreationRequest(id: number): Promise<ClubCreationRequest> {
  return apiFetch<ClubCreationRequest>(`/api/v1/club-creation-requests/${id}/reject`, {
    method: "POST",
    auth: true,
  });
}
