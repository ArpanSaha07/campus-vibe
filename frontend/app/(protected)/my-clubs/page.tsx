"use client";

import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { useFollowedClubs } from "@/app/lib/followed-clubs-context";
import MyClubsGrid from "@/app/components/my-clubs/MyClubsGrid";
import EmptyState from "@/app/components/ui/EmptyState";
import Button from "@/app/components/ui/Button";

// Sign-in is already enforced by (protected)/layout.tsx, which also supplies
// the navbar and footer — this page renders the panel only.
//
// The list comes from FollowedClubsProvider rather than a fetch of its own.
// Both used to call GET /users/me/clubs, so opening this page made the same
// request twice; now the provider owns it and this page reads the result.

export default function MyClubsPage() {
  const { ready, clubs, failed } = useFollowedClubs();

  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-10 sm:px-6 lg:px-8 fade-up">
      <Link
        href="/"
        className="inline-flex items-center gap-2 text-sm font-semibold text-ink-600 transition-colors hover:text-lavender-600"
      >
        <ArrowLeft className="h-4 w-4" aria-hidden="true" />
        Back to home
      </Link>

      <h1 className="mt-4 font-display text-4xl font-bold text-ink-900">Your clubs</h1>
      <p className="mt-2 max-w-xl text-ink-600">
        The clubs you follow. Open one to see what it has coming up.
      </p>

      <div className="mt-8">
        {!ready ? (
          <p className="font-mono text-sm text-ink-600">Loading your clubs…</p>
        ) : failed ? (
          <EmptyState
            title="Your clubs didn't load"
            body="Something went wrong on our end. Refresh to try again."
          />
        ) : clubs.length === 0 ? (
          <EmptyState
            title="You're not following any clubs yet"
            body="Follow a club and it will show up here, along with everything it puts on."
            action={<Button href="/clubs">Explore clubs</Button>}
          />
        ) : (
          <MyClubsGrid clubs={clubs} />
        )}
      </div>
    </div>
  );
}
