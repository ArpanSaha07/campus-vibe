"use client";

import { use, useCallback, useEffect, useState, type ReactNode } from "react";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { useManagedClubs } from "@/app/lib/managed-clubs-context";
import { ManageClubProvider } from "@/app/lib/manage-club-context";
import { getManagedClub } from "@/app/lib/club-admin-requests";
import { ApiError } from "@/app/lib/api";
import type { ManagedClub } from "@/app/types";
import ClubLogo from "@/app/components/club/ClubLogo";
import ClubRoleBadge from "@/app/components/manage/ClubRoleBadge";
import ManageSidebar from "@/app/components/manage/ManageSidebar";
import EmptyState from "@/app/components/ui/EmptyState";
import Button from "@/app/components/ui/Button";

/**
 * The shell every club-management screen sits in: club identity, the caller's
 * role, and the section rail.
 *
 * The club is loaded from `GET /clubs/{id}/managed` rather than picked out of
 * the managed-clubs list. The list is built from assignments, and a platform
 * admin manages every club while holding an assignment in none — so the lookup
 * missed for the one account that can administer anything, and the dashboard
 * refused to open while `curl` against the same club succeeded. Asking the
 * server is also simply the more honest question: it answers "may you manage
 * this", which is what this screen needs, rather than "is it on your list".
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
  // Only for the back-link: it is about the clubs you run, which is a different
  // question from the one above.
  const { clubs } = useManagedClubs();

  const [club, setClub] = useState<ManagedClub | null>(null);
  const [state, setState] = useState<"loading" | "ready" | "denied" | "failed">("loading");

  const load = useCallback(async () => {
    setState("loading");
    try {
      setClub(await getManagedClub(clubId));
      setState("ready");
    } catch (error) {
      // 403 and 404 are the same answer on purpose — see the message below.
      // Anything else is the server being broken, which is worth saying
      // differently so a refresh is offered rather than a dead end.
      const status = error instanceof ApiError ? error.status : 0;
      setState(status === 403 || status === 404 ? "denied" : "failed");
    }
  }, [clubId]);

  useEffect(() => {
    void load();
  }, [load]);

  if (state === "loading") {
    return (
      <main className="mx-auto w-full max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
        <p className="font-mono text-sm text-ink-600">Loading your club…</p>
      </main>
    );
  }

  if (state === "failed") {
    return (
      <main className="mx-auto w-full max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
        <EmptyState
          title="We couldn't check your access"
          body="The server didn't answer, so we can't tell whether you manage this club. Refresh to try again."
        />
      </main>
    );
  }

  // Covers both "this club does not exist" and "it does, but not for you". They
  // are deliberately the same message: telling an outsider that a club exists
  // but is closed to them is more than they need to know.
  if (state === "denied" || !club) {
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
          it would point at a picker holding a single card. A platform admin
          browsing a club they do not run gets it only if they run several of
          their own, which is the right answer: the picker lists theirs. */}
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
        <div className="min-w-0 flex-1">
          <ManageClubProvider club={club}>{children}</ManageClubProvider>
        </div>
      </div>
    </main>
  );
}
