"use client";

import { use, type ReactNode } from "react";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { useManagedClubs } from "@/app/lib/managed-clubs-context";
import ClubLogo from "@/app/components/club/ClubLogo";
import ClubRoleBadge from "@/app/components/manage/ClubRoleBadge";
import ManageSidebar from "@/app/components/manage/ManageSidebar";
import EmptyState from "@/app/components/ui/EmptyState";
import Button from "@/app/components/ui/Button";

/**
 * The shell every club-management screen sits in: club identity, the caller's
 * role, and the section rail.
 *
 * A client component because the whole area depends on who is signed in, and
 * `useManagedClubs` is the only source of the caller's role. `params` is a
 * promise in this version of Next, hence `use()`.
 *
 * The check below decides what to *draw*. It is not the security boundary —
 * every endpoint these pages call re-derives authority from the database, so a
 * user who edits their way past this sees a dashboard whose every request 403s.
 */
export default function ManageClubLayout({
  children,
  params,
}: {
  children: ReactNode;
  params: Promise<{ clubId: string }>;
}) {
  const { clubId } = use(params);
  const { ready, failed, clubs } = useManagedClubs();

  const club = clubs.find((candidate) => candidate.clubId === clubId);

  if (!ready) {
    return (
      <main className="mx-auto w-full max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
        <p className="font-mono text-sm text-ink-600">Loading your club…</p>
      </main>
    );
  }

  if (failed) {
    return (
      <main className="mx-auto w-full max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
        <EmptyState
          title="We couldn't check your access"
          body="The server didn't answer, so we can't tell which clubs you manage. Refresh to try again."
        />
      </main>
    );
  }

  // Covers both "this club does not exist" and "it does, but not for you". They
  // are deliberately the same message: telling an outsider that a club exists
  // but is closed to them is more than they need to know.
  if (!club) {
    return (
      <main className="mx-auto w-full max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
        <EmptyState
          title="You don't manage this club"
          body="Only a club's owner and its admins can open its dashboard. If you should be on the team, ask the club's owner to invite you."
          action={
            <Button href="/manage" variant="secondary">
              Back to your clubs
            </Button>
          }
        />
      </main>
    );
  }

  return (
    <main className="mx-auto w-full max-w-7xl px-4 py-8 sm:px-6 lg:px-8 fade-up">
      {/* Shown only to people who manage more than one club — for everyone else
          it would point at a picker holding a single card. */}
      {clubs.length > 1 && (
        <Link
          href="/manage"
          className="inline-flex items-center gap-2 text-sm font-semibold text-ink-600 transition-colors hover:text-lavender-600"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden="true" />
          All your clubs
        </Link>
      )}

      <header className="mt-4 flex items-start gap-4 border-b border-mist-200 pb-6">
        <ClubLogo name={club.clubName} logo={club.logo} size="md" />
        <div className="min-w-0">
          <p className="ticket-label text-lavender-600">Manage</p>
          <h1 className="mt-1 truncate font-display text-3xl font-bold text-ink-900">
            {club.clubName}
          </h1>
          <ClubRoleBadge role={club.role} className="mt-2" />
        </div>
      </header>

      <div className="mt-6 flex flex-col gap-8 lg:flex-row lg:gap-10">
        <ManageSidebar clubId={clubId} />
        <div className="min-w-0 flex-1">{children}</div>
      </div>
    </main>
  );
}
