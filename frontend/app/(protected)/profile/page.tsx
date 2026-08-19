"use client";

import Link from "next/link";
import { CalendarDays, Ticket, Users } from "lucide-react";
import { useAuth } from "@/app/lib/auth-context";
import ProfileAvatar from "@/app/components/profile/ProfileAvatar";
import ProfileAboutCard from "@/app/components/profile/ProfileAboutCard";
import ProfileLinkBlock from "@/app/components/profile/ProfileLinkBlock";
import ProfileSocialLinks from "@/app/components/profile/ProfileSocialLinks";
import type { UserProfile } from "@/app/types";

// Sign-in is already enforced by (protected)/layout.tsx, which also supplies
// the navbar and footer — this page renders the panel only. It moved here from
// app/profile/page.tsx, which sat outside the group and so drew a second,
// placeholder navbar of its own and redirected every visitor away.

/** Placeholder for the profile read. See the call site. */
function loadProfile(): UserProfile | null {
  return null;
}

export default function ProfilePage() {
  const { user } = useAuth();

  // Unreachable in practice — ProtectedRoute renders nothing until it has a
  // user. It is here because the context type still admits null, and a guard
  // is cheaper than asserting non-null on every line below.
  if (!user) return null;

  // Pinned to en-US rather than the host locale, for the reason recorded on
  // formatDayLabel: the word beside it is hardcoded English, and an unpinned
  // format produced a mixed-language line on a non-English machine (BUG-025).
  const joined = new Date(user.createdAt).toLocaleDateString("en-US", {
    month: "short",
    year: "numeric",
  });

  // Nothing returns a UserProfile yet — no column, no endpoint, and the edit
  // form that writes it is the next piece of work. Null is honest rather than
  // a stub: it is the same value a new account will send, and it renders the
  // same empty states.
  //
  // Behind a function rather than written inline as `const profile = null`,
  // which TypeScript narrows to the type `null` — and then to `never` inside
  // `profile?.socialLinks`, which is an error rather than the undefined you
  // would expect. This is also the seam the fetch drops into.
  const profile = loadProfile();

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-10 sm:px-6 lg:px-8 fade-up">
      <div className="flex flex-col gap-8 lg:flex-row lg:gap-10">
        {/* Identity. Sticky on wide screens only: on a phone this is simply the
            first thing in the column, and pinning it there would eat the screen
            the content needs. */}
        <aside className="lg:w-80 lg:shrink-0">
          <div className="rounded-2xl border border-mist-200 bg-white p-6 lg:sticky lg:top-6">
            <ProfileAvatar name={user.name} />

            {/* The <h1> — the person is what this page is about, so the page
                carries no separate title above it. */}
            <h1 className="mt-5 break-words font-display text-3xl font-bold text-ink-900">
              {user.name}
            </h1>
            {/* break-all, not break-words: a long address has no spaces to
                break at and would otherwise push the card wider than its
                column. */}
            <p className="mt-1 break-all text-sm text-ink-600">{user.email}</p>

            <Link
              href="/profile/edit"
              className="mt-3 inline-block text-sm font-semibold text-lavender-600 transition-colors hover:text-lavender-800"
            >
              Edit profile
            </Link>

            <p className="mt-5 flex items-center gap-2 border-t border-mist-200 pt-5 font-mono text-xs text-ink-600">
              <CalendarDays className="h-4 w-4 shrink-0" aria-hidden="true" />
              Joined {joined}
            </p>

            {/* Below the joined date, and inside the identity card: these say
                where this person is, which is the same question the name and
                the address answer. */}
            <ProfileSocialLinks links={profile?.socialLinks} name={user.name} />
          </div>
        </aside>

        {/* min-w-0 so a long unbroken bio shrinks this column rather than
            stretching the flex row past the viewport. */}
        <div className="min-w-0 flex-1 space-y-6">
          <ProfileAboutCard profile={profile} />

          <ProfileLinkBlock
            href="/my-clubs"
            title="My clubs"
            description="The clubs you follow, and what they have coming up."
            icon={<Users className="h-5 w-5" aria-hidden="true" />}
          />
          <ProfileLinkBlock
            href="/my-events"
            title="My events"
            description="Everything you're going to, saved, or have already been to."
            icon={<Ticket className="h-5 w-5" aria-hidden="true" />}
          />
        </div>
      </div>
    </div>
  );
}
