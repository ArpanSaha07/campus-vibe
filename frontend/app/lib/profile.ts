import type { NotificationPreferences, UserProfile } from "@/app/types";

/**
 * Turns something a user typed into an href, or into null.
 *
 * Kept out of the component, and pure, so the refusals below can be tested
 * directly — every one of them is a case where getting it wrong is a security
 * bug rather than a cosmetic one.
 *
 * Two jobs, in this order and not the other:
 *
 *  1. Reject any scheme that is not http or https. `javascript:alert(1)` is a
 *     perfectly valid URL and React will happily put it in an href, so a
 *     profile link is a stored-XSS vector unless something refuses it. This
 *     runs on read rather than only on write because that is where the harm
 *     would happen — the edit form should refuse it too, but a row already in
 *     the database from before that form existed would still render.
 *  2. Only then, accept `instagram.com/someone` by assuming https. Trying the
 *     bare string as a URL first is what makes this safe: `javascript:...`
 *     parses on the first attempt and is rejected on its scheme, so it never
 *     reaches the line that would prepend https and disguise it.
 */
export function normaliseProfileLink(value: string | null | undefined): string | null {
  const raw = value?.trim();
  if (!raw) return null;

  let parsed: URL;
  try {
    parsed = new URL(raw);
  } catch {
    // Not absolute — the usual way someone types a profile link.
    try {
      parsed = new URL(`https://${raw}`);
    } catch {
      return null;
    }
  }

  return parsed.protocol === "http:" || parsed.protocol === "https:" ? parsed.href : null;
}

/**
 * A profile with nothing filled in.
 *
 * The editor needs a complete object to bind its inputs to -- a controlled
 * input given undefined becomes uncontrolled, and React only complains about
 * that on the render where it flips. So the absence of a profile is
 * represented once, here, rather than with a fallback at every field.
 */
export function emptyProfile(): UserProfile {
  return {
    bio: null,
    faculty: null,
    degree: null,
    subjects: [],
    socialLinks: { instagram: null, facebook: null, linkedin: null },
    interests: [],
    showInterests: true,
    showSocialLinks: true,
  };
}

/**
 * Where the profile save will go.
 *
 * <strong>This persists nothing.</strong> There is no profile table and no
 * endpoint yet, so the editor is a working UI over memory: everything survives
 * navigation between its sections and nothing survives a reload.
 *
 * It resolves rather than throwing so the screens around it are exercised as
 * they will really behave -- the disabled Save, the saving state, the
 * confirmation, the button going quiet again. When PATCH /api/v1/users/me
 * lands, this function body is the only thing that changes.
 */
export async function saveProfile(_profile: UserProfile): Promise<void> {
  return Promise.resolve();
}

/** Same seam, same warning, for the email preferences. */
export async function saveNotificationPreferences(
  _preferences: NotificationPreferences,
): Promise<void> {
  return Promise.resolve();
}
