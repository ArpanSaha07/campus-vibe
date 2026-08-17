"use client";

import { useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useManagedClubs } from "@/app/lib/managed-clubs-context";
import ClubLogo from "@/app/components/club/ClubLogo";
import ClubRoleBadge from "@/app/components/manage/ClubRoleBadge";
import EmptyState from "@/app/components/ui/EmptyState";
import Button from "@/app/components/ui/Button";

/**
 * Picks which club to manage.
 *
 * Managing several clubs is now ordinary — one person can run the robotics club
 * and help with the film society — so there has to be a choice somewhere. When
 * there is only one it goes straight through rather than showing a page with a
 * single card on it.
 */
export default function ManageIndexPage() {
  const { ready, failed, clubs } = useManagedClubs();
  const router = useRouter();

  const onlyClub = ready && !failed && clubs.length === 1 ? clubs[0] : null;

  useEffect(() => {
    // replace, not push: this page is a junction, and Back should return to
    // wherever the user came from rather than bouncing them through again.
    if (onlyClub) router.replace(`/manage/${onlyClub.clubId}`);
  }, [onlyClub, router]);

  if (!ready || onlyClub) {
    return (
      <main className="mx-auto w-full max-w-5xl px-4 py-16 sm:px-6 lg:px-8">
        <p className="font-mono text-sm text-ink-600">Loading your clubs…</p>
      </main>
    );
  }

  return (
    <main className="mx-auto w-full max-w-5xl px-4 py-10 sm:px-6 lg:px-8 fade-up">
      <p className="ticket-label text-lavender-600">Club dashboard</p>
      <h1 className="mt-1 font-display text-4xl font-bold text-ink-900">
        Clubs you manage
      </h1>
      <p className="mt-2 max-w-xl text-ink-600">
        Pick a club to manage its page, its events and its team.
      </p>

      <div className="mt-8">
        {failed ? (
          <EmptyState
            title="We couldn't load your clubs"
            body="The server didn't answer. Refresh to try again."
          />
        ) : clubs.length === 0 ? (
          <EmptyState
            title="You don't manage a club yet"
            body="Run a club on campus? Ask to manage its page and the CampusVibe team will set you up as its owner. Already on a team? Ask your club's owner to invite you."
            action={<Button href="/clubs">Find your club</Button>}
          />
        ) : (
          <ul className="grid grid-cols-1 gap-6 sm:grid-cols-2">
            {clubs.map((club) => (
              <li key={club.clubId}>
                <Link
                  href={`/manage/${club.clubId}`}
                  className="flex h-full items-center gap-4 rounded-2xl border border-mist-200 bg-white p-5 lift"
                >
                  <ClubLogo name={club.clubName} logo={club.logo} size="md" />
                  <div className="min-w-0">
                    <p className="truncate font-display text-lg font-bold text-ink-900">
                      {club.clubName}
                    </p>
                    <p className="mt-0.5 font-mono text-xs text-ink-600">
                      {club.followers} {club.followers === 1 ? "follower" : "followers"}
                    </p>
                    <ClubRoleBadge role={club.role} className="mt-2" />
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </main>
  );
}
