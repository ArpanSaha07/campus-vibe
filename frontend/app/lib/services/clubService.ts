import { ApiError, apiFetch } from "@/app/lib/api";
import { toClub } from "@/app/lib/adapters";
import type { ApiClub, Club, ClubSocialLinks } from "@/app/types";

/**
 * Creating a club.
 *
 * <strong>This file used to call endpoints that do not exist.</strong> It
 * fetched `/api/clubs/check-name` and `/api/clubs/create` — relative paths, no
 * version prefix — and there are no Next route handlers in this app, so both
 * were 404s. Club creation has never worked from the UI. It now goes through
 * `apiFetch` to the real backend, like every other domain module.
 *
 * The multipart half lives here too, as of the club-governance work: a club is
 * now born with an owner, so the caller of `createClub` can immediately upload
 * to it. See `uploadClubLogo` and `uploadClubImages`.
 */

/**
 * The id a club will get, derived from its name.
 *
 * `Club.id` is a slug and the backend takes it from the request rather than
 * generating one, so the client has to decide it. Kept beside the name check
 * because the two have to agree: checking availability of anything other than
 * the id that will actually be used answers a different question.
 */
export function clubSlug(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/**
 * Whether a club already holds the slug this name would take.
 *
 * A 404 is the answer, not an error — it is how the backend says *nothing here*.
 * Deliberately uncached: this runs as somebody types, and a stale yes would let
 * two people both believe a name was free.
 *
 * Only a 404 means free. Any other failure rethrows, because answering `false`
 * to a request that never completed is a false negative: it tells the user the
 * name is available, and the real create then fails with a 409 they have no way
 * to have predicted. The caller decides what to do with an availability check
 * that could not run; it must not be silently reported as a yes.
 */
export async function checkClubNameExists(clubName: string): Promise<boolean> {
  const slug = clubSlug(clubName);
  if (!slug) return false;

  try {
    await apiFetch<ApiClub>(`/api/v1/clubs/${encodeURIComponent(slug)}`);
    return true;
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) return false;
    throw error;
  }
}

export interface NewClub {
  name: string;
  description: string;
  /** A `club_categories` slug. */
  category: string | null;
  /** `interest_catalogue` slugs — at most eight, enforced server-side too. */
  interests: string[];
  /**
   * Seeds the club's `official_email` — its recovery channel, and where
   * administrator-change notices go. Taken from the form's contact email, and
   * separate from it the moment the club exists: this one only a platform admin
   * may change, that one the club's own team edits.
   *
   * Optional, and a seeded address is always unverified — only redeeming a link
   * mailed to it can say otherwise (ADR-006).
   */
  officialEmail?: string | null;
}

/**
 * Creates the club and returns it. **Platform admins only** — `POST
 * /api/v1/clubs` requires `hasRole('ADMIN')` since ADR-004. An ordinary user
 * proposes instead, through `app/lib/club-creation-requests.ts`.
 *
 * The creating admin becomes the club's owner in the same transaction, so the
 * logo, banner and social-link calls below can follow immediately without a
 * 403. That was the P0 this closed: the form used to collect all three and say
 * it could not send them.
 *
 * They are separate calls rather than one payload because the backend takes
 * them separately — images are multipart against `{id}/logo` and `{id}/images`,
 * social links are a `PUT` on the club. `createClubWithMedia` chains them.
 */
export async function createClub(club: NewClub): Promise<Club> {
  const created = await apiFetch<ApiClub>("/api/v1/clubs", {
    method: "POST",
    body: JSON.stringify({
      id: clubSlug(club.name),
      name: club.name.trim(),
      description: club.description.trim(),
      category: club.category,
      interests: club.interests,
      // Seeds `official_email`, which had no way of being set at creation and
      // so was null on every club until an admin went and added one. The same
      // address also goes into `social_links` by the PUT below, and the two are
      // independent from then on: this one is the club's recovery channel and
      // only a platform admin may change it.
      officialEmail: club.officialEmail?.trim() || null,
    }),
    auth: true,
  });
  return toClub(created);
}

/**
 * A club's logo. Multipart, part name `file`, matching
 * `ClubController.uploadLogo`.
 *
 * Requires `canManageClub`, which the creating admin now passes by assignment
 * as well as by the platform-admin bypass.
 */
export async function uploadClubLogo(clubId: string, file: File): Promise<void> {
  const body = new FormData();
  body.append("file", file);
  await apiFetch<void>(`/api/v1/clubs/${encodeURIComponent(clubId)}/logo`, {
    method: "POST",
    body,
    auth: true,
  });
}

/**
 * A club's banner images. Multipart, part name `files`, sent in one request.
 *
 * Not called from the create form: banner photos are a club's own content
 * rather than part of deciding it should exist, so they belong to the club
 * editor ([BUG-043](../../../.claude/bugs/bugs.md)) alongside every other field
 * an owner edits after the fact. The endpoint and the read path (ADR-007) both
 * exist; only the editor does not.
 */
export async function uploadClubImages(clubId: string, files: File[]): Promise<void> {
  if (files.length === 0) return;
  const body = new FormData();
  files.forEach((file) => body.append("files", file));
  await apiFetch<void>(`/api/v1/clubs/${encodeURIComponent(clubId)}/images`, {
    method: "POST",
    body,
    auth: true,
  });
}

/**
 * The club's public contact links.
 *
 * Stored as a JSON *string* in one column rather than as columns, which is why
 * this stringifies rather than sending an object — see `Club.socialLinks`.
 */
export async function updateClubSocialLinks(
  clubId: string,
  socialLinks: ClubSocialLinks,
): Promise<Club> {
  const updated = await apiFetch<ApiClub>(`/api/v1/clubs/${encodeURIComponent(clubId)}`, {
    method: "PUT",
    body: JSON.stringify({ socialLinks: JSON.stringify(socialLinks) }),
    auth: true,
  });
  return toClub(updated);
}

export interface ClubMedia {
  logo: File | null;
  socialLinks: ClubSocialLinks;
}

/**
 * Creates a club and then attaches everything that needs a club id to exist.
 *
 * Sequential on purpose: both follow-ups address `/clubs/{id}`, so the club has
 * to be there first. Each is awaited rather than fired in parallel so that a
 * failure names which step failed — a caller told only "upload failed" cannot
 * say whether the club was created.
 *
 * **The club is created even if a follow-up throws.** That is the honest
 * outcome rather than a bug to paper over: the row exists and the caller now
 * owns it, so the recovery is to finish the job from `/manage/[clubId]`, not to
 * delete a club somebody may already have seen. Callers should say so.
 */
export async function createClubWithMedia(club: NewClub, media: ClubMedia): Promise<Club> {
  const created = await createClub(club);

  if (media.logo) {
    await uploadClubLogo(created.clubId, media.logo);
  }
  if (Object.values(media.socialLinks).some((v) => v && v.trim() !== "")) {
    await updateClubSocialLinks(created.clubId, media.socialLinks);
  }

  return created;
}
