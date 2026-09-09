"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/app/lib/auth-context";
import { isAdmin } from "@/app/lib/user";
import { getAllClubs } from "@/app/lib/club";
import { listEvents } from "@/app/lib/event";
import {
  approveClubAdminRequest,
  listClubAdminRequests,
  rejectClubAdminRequest,
} from "@/app/lib/club-admin-requests";
import {
  approveClubCreationRequest,
  listClubCreationRequests,
  rejectClubCreationRequest,
} from "@/app/lib/club-creation-requests";
import { revalidateClubs } from "@/app/lib/actions/revalidate";
import type { ClubAdminRequest, ClubCreationRequest } from "@/app/types";
import SectionHeading from "@/app/components/ui/SectionHeading";
import StatTile from "@/app/components/ui/StatTile";
import EmptyState from "@/app/components/ui/EmptyState";
import Button from "@/app/components/ui/Button";
import Link from "next/link"; 

/**
 * One row of the merged Pending requests list.
 *
 * The two kinds queue together because that is what a reviewer wants — one list,
 * oldest first — but they stay separate underneath: a claim installs an owner on
 * a club that already exists, a proposal has to create the club first. So the
 * kind decides which endpoint the Approve button calls, and `id` is only unique
 * within a kind.
 */
type PendingRow =
  | { kind: "claim"; id: number; at: string; request: ClubAdminRequest }
  | { kind: "proposal"; id: number; at: string; request: ClubCreationRequest };

export default function AdminDashboardPage() {
  const { user, loading } = useAuth();
  const [clubCount, setClubCount] = useState<number | null>(null);
  const [eventCount, setEventCount] = useState<number | null>(null);
  const [rows, setRows] = useState<PendingRow[] | null>(null);
  const [requestsError, setRequestsError] = useState(false);
  const [actionError, setActionError] = useState("");

  useEffect(() => {
    if (loading || !user || !isAdmin(user)) return;
    let cancelled = false;
    getAllClubs()
      .then((clubs) => !cancelled && setClubCount(clubs.length))
      .catch(() => !cancelled && setClubCount(null));
    listEvents()
      .then((events) => !cancelled && setEventCount(events.length))
      .catch(() => !cancelled && setEventCount(null));
    // Two endpoints, one list. Promise.all rather than sequential so a slow
    // queue does not hold up the other, and allSettled is deliberately not used:
    // a half-loaded review queue that looks complete is worse than an error,
    // because approving from it is a decision made on partial information.
    Promise.all([listClubAdminRequests("PENDING"), listClubCreationRequests("PENDING")])
      .then(([claims, proposals]) => {
        if (cancelled) return;
        const merged: PendingRow[] = [
          ...claims.map((request) => ({
            kind: "claim" as const,
            id: request.id,
            at: request.requestedAt,
            request,
          })),
          ...proposals.map((request) => ({
            kind: "proposal" as const,
            id: request.id,
            at: request.requestedAt,
            request,
          })),
        ];
        merged.sort((a, b) => a.at.localeCompare(b.at));
        setRows(merged);
      })
      .catch(() => {
        if (!cancelled) {
          setRows([]);
          setRequestsError(true);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [loading, user]);

  async function review(row: PendingRow, action: "approve" | "reject") {
    setActionError("");
    try {
      if (row.kind === "claim") {
        await (action === "approve" ? approveClubAdminRequest : rejectClubAdminRequest)(row.id);
      } else {
        await (action === "approve"
          ? approveClubCreationRequest
          : rejectClubCreationRequest)(row.id);
      }
      // Matched on kind as well as id: the two queues number their rows
      // independently, so claim 3 and proposal 3 both exist.
      setRows((prev) =>
        prev?.filter((r) => !(r.kind === row.kind && r.id === row.id)) ?? null,
      );
      if (action === "approve" && row.kind === "proposal") {
        setClubCount((prev) => (prev === null ? prev : prev + 1));
        // Approving created a club. The clubs list is cached for five minutes,
        // so drop it rather than let the new club be missing from /clubs while
        // its owner is being told they have one.
        await revalidateClubs();
      }
    } catch (error) {
      // The backend refuses an approval whose slug was taken while the proposal
      // waited, and says so in a sentence. Showing it beats a generic failure:
      // the reviewer has to reject this one and ask for another name, which
      // they cannot work out from "didn't go through".
      const message =
        error instanceof Error && error.message.trim() !== ""
          ? error.message
          : "That review didn't go through. Refresh and try again.";
      setActionError(message);
    }
  }

  if (!loading && user && !isAdmin(user)) {
    return (
      <main className="max-w-7xl mx-auto w-full px-4 sm:px-6 py-16">
        <EmptyState
          title="Admins only"
          body="This dashboard manages the whole platform. If you should have access, contact the CampusVibe team."
          action={<Button href="/" variant="secondary">Back to home</Button>}
        />
      </main>
    );
  }

  return (
    <main className="max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-10 fade-up">
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
        <div>
          <p className="ticket-label text-lavender-600">Admin dashboard</p>
          <h1 className="font-display text-3xl font-bold text-ink-900 mt-1">
            Platform overview
          </h1>
        </div>
        {/* The only place a club can be created from. POST /api/v1/clubs is
            admin-only, and the form branches on the same isAdmin check, so an
            admin arriving here gets the full form with logo, photos and links
            -- all of which save, because creating a club now makes them its
            owner. */}
        <Button href="/create-club">Create a club</Button>
      </div>

      {/* Overview */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 mt-8">
        <Link href={"/clubs"}>
          <StatTile label="Clubs" value={clubCount ?? "—"} hint="Active club pages" />
        </Link>
        <Link href={"/events"}>
          <StatTile label="Events" value={eventCount ?? "—"} hint="All events on the platform" />
        </Link>
        <StatTile
          label="Pending requests"
          value={rows === null ? "…" : rows.length}
          hint="New clubs proposed, and claims on ownerless ones"
        />
      </div>

      {/* Pending requests -- both kinds, one list */}
      <section className="mt-12">
        <SectionHeading
          title="Pending requests"
          subtitle="Approving a proposal creates the club and makes the requester its owner. Approving a claim hands them an existing club that has none."
        />

        {actionError && <p className="text-sm text-alert-600 mb-4">{actionError}</p>}

        {rows === null && !requestsError && (
          <p className="font-mono text-sm text-ink-600">Loading requests…</p>
        )}

        {requestsError && (
          <EmptyState
            title="Requests didn't load"
            body="The request service didn't respond — it may not be running. Refresh to try again."
          />
        )}

        {rows && rows.length === 0 && !requestsError && (
          <EmptyState
            title="No pending requests"
            body="When somebody proposes a club, or asks to run one that has no owner, it lands here."
          />
        )}

        {rows && rows.length > 0 && (
          <ul className="space-y-4">
            {rows.map((row) => (
              <li
                key={`${row.kind}-${row.id}`}
                className="rounded-2xl border border-mist-200 bg-white p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4"
              >
                <div className="min-w-0">
                  <span className="ticket-label text-lavender-600">
                    {row.kind === "proposal" ? "New club" : "Ownership claim"}
                  </span>
                  <p className="font-semibold text-ink-900 mt-1">
                    {row.request.userName}
                    {row.kind === "proposal" ? (
                      <>
                        <span className="text-ink-600 font-normal"> wants to start </span>
                        {row.request.name}
                        <span className="text-ink-600 font-normal">
                          {" "}
                          ({row.request.proposedSlug})
                        </span>
                      </>
                    ) : (
                      <>
                        <span className="text-ink-600 font-normal"> wants to manage </span>
                        {row.request.clubName}
                      </>
                    )}
                  </p>
                  <p className="font-mono text-xs text-ink-600 mt-1">
                    {row.request.userEmail} ·{" "}
                    {new Date(row.at).toLocaleDateString(undefined, {
                      month: "short",
                      day: "numeric",
                    })}
                  </p>
                  {row.kind === "proposal" && row.request.description && (
                    <p className="text-sm text-ink-600 mt-2 line-clamp-2">
                      {row.request.description}
                    </p>
                  )}
                  {row.request.message && (
                    <p className="text-sm text-ink-600 mt-2 line-clamp-2">
                      &ldquo;{row.request.message}&rdquo;
                    </p>
                  )}
                </div>
                <div className="flex gap-2 shrink-0">
                  <Button onClick={() => review(row, "approve")}>Approve</Button>
                  <Button onClick={() => review(row, "reject")} variant="secondary">
                    Reject
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

    </main>
  );
}
