import type { UserProfile } from "@/app/types";

/**
 * The loading and failure lines every settings section shows above its form.
 *
 * One component because all four sections are in the same position -- they
 * render before `ProfileProvider`'s first read lands -- and because a section
 * whose form is hidden still needs to say why. Renders nothing once the profile
 * is there, so the caller can drop it in unconditionally.
 *
 * Not `EmptyState`: that is a card for a whole panel with nothing in it, and
 * these sit under a heading that has already said what the screen is.
 */
export default function ProfileSectionState({
  profile,
  failed,
}: {
  profile: UserProfile | null;
  failed: boolean;
}) {
  if (failed) {
    return (
      <p className="mt-8 font-semibold text-alert-600">
        Your profile didn&apos;t load, so there is nothing safe to edit here. Refresh to try
        again.
      </p>
    );
  }

  if (!profile) {
    return <p className="mt-8 font-mono text-sm text-ink-600">Loading your profile…</p>;
  }

  return null;
}
