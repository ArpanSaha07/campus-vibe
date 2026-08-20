import { apiFetch } from "@/app/lib/api";
import type { Interest, NotificationPreferences, UserProfile } from "@/app/types";

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

/** The signed-in user's profile. Answers a complete empty one if never edited. */
export async function getProfile(): Promise<UserProfile> {
  return apiFetch<UserProfile>("/api/v1/users/me/profile", { auth: true });
}

/**
 * Saves the whole profile, and returns what was actually stored.
 *
 * <strong>This replaces everything.</strong> The endpoint is a PUT, so whatever
 * is not in `profile` is cleared -- which is safe only because all four editor
 * sections read one profile loaded by `ProfileProvider` rather than each
 * starting from `emptyProfile()`. If a screen ever builds its draft from
 * anywhere else, saving it will erase the fields it does not know about.
 *
 * The response is not the submitted object: blank fields come back null and
 * links come back normalised, so callers should use what is returned rather
 * than what they sent.
 *
 * Never cached -- `apiFetch` refuses to combine `auth` with a cache policy,
 * because the data cache is keyed on the URL and would hand one user's profile
 * to the next caller.
 */
export async function saveProfile(profile: UserProfile): Promise<UserProfile> {
  return apiFetch<UserProfile>("/api/v1/users/me/profile", {
    method: "PUT",
    body: JSON.stringify(profile),
    auth: true,
  });
}

/** The signed-in user's email preferences. Defaults if never edited. */
export async function getNotificationPreferences(): Promise<NotificationPreferences> {
  return apiFetch<NotificationPreferences>("/api/v1/users/me/notification-preferences", {
    auth: true,
  });
}

/** Saves all five switches at once. Same replace-everything shape as above. */
export async function saveNotificationPreferences(
  preferences: NotificationPreferences,
): Promise<NotificationPreferences> {
  return apiFetch<NotificationPreferences>("/api/v1/users/me/notification-preferences", {
    method: "PUT",
    body: JSON.stringify(preferences),
    auth: true,
  });
}

/**
 * The interest vocabulary, already in the order the picker should show it.
 *
 * Public and identical for everyone, so unlike everything else here it takes no
 * token. It is fetched rather than hardcoded because the profile stores slugs
 * and the database owns the slug-to-label mapping; a second copy in the
 * frontend would be two lists that must agree with nothing checking that they
 * do.
 */
export async function getInterests(): Promise<Interest[]> {
  return apiFetch<Interest[]>("/api/v1/interests");
}
