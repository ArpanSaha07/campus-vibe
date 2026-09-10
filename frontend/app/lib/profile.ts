import { apiFetch } from "@/app/lib/api";
import type { NotificationPreferences, UserProfile } from "@/app/types";

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
