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
import type { ClubAdminRequest } from "@/app/types";
import SectionHeading from "@/app/components/ui/SectionHeading";
import StatTile from "@/app/components/ui/StatTile";
import EmptyState from "@/app/components/ui/EmptyState";
import Button from "@/app/components/ui/Button";

export default function AdminDashboardPage() {
  const { user, loading } = useAuth();
  const [clubCount, setClubCount] = useState<number | null>(null);
  const [eventCount, setEventCount] = useState<number | null>(null);
  const [requests, setRequests] = useState<ClubAdminRequest[] | null>(null);
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
    listClubAdminRequests("PENDING")
      .then((pending) => !cancelled && setRequests(pending))
      .catch(() => {
        if (!cancelled) {
          setRequests([]);
          setRequestsError(true);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [loading, user]);

  async function review(id: number, action: "approve" | "reject") {
    setActionError("");
    try {
      if (action === "approve") {
        await approveClubAdminRequest(id);
      } else {
        await rejectClubAdminRequest(id);
      }
      setRequests((prev) => prev?.filter((r) => r.id !== id) ?? null);
    } catch {
      setActionError("That review didn't go through. Refresh and try again.");
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
      <p className="ticket-label text-lavender-600">Admin dashboard</p>
      <h1 className="font-display text-3xl font-bold text-ink-900 mt-1">Platform overview</h1>

      {/* Overview */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 mt-8">
        <StatTile label="Clubs" value={clubCount ?? "—"} hint="Active club pages" />
        <StatTile label="Events" value={eventCount ?? "—"} hint="All events on the platform" />
        <StatTile
          label="Pending requests"
          value={requests === null ? "…" : requests.length}
          hint="Club admin access requests"
        />
      </div>

      {/* Club admin requests */}
      <section className="mt-12">
        <SectionHeading
          title="Club admin requests"
          subtitle="Approving assigns the club to the requester and grants club admin access."
        />

        {actionError && <p className="text-sm text-alert-600 mb-4">{actionError}</p>}

        {requests === null && (
          <p className="font-mono text-sm text-ink-600">Loading requests…</p>
        )}

        {requestsError && (
          <EmptyState
            title="Requests didn't load"
            body="The request service didn't respond — it may not be running. Refresh to try again."
          />
        )}

        {requests && requests.length === 0 && !requestsError && (
          <EmptyState
            title="No pending requests"
            body="When a student asks to manage a club, the request lands here."
          />
        )}

        {requests && requests.length > 0 && (
          <ul className="space-y-4">
            {requests.map((request) => (
              <li
                key={request.id}
                className="rounded-2xl border border-mist-200 bg-white p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4"
              >
                <div className="min-w-0">
                  <p className="font-semibold text-ink-900">
                    {request.userName}
                    <span className="text-ink-600 font-normal"> wants to manage </span>
                    {request.clubName}
                  </p>
                  <p className="font-mono text-xs text-ink-600 mt-1">
                    {request.userEmail} ·{" "}
                    {new Date(request.requestedAt).toLocaleDateString(undefined, {
                      month: "short",
                      day: "numeric",
                    })}
                  </p>
                  {request.message && (
                    <p className="text-sm text-ink-600 mt-2 line-clamp-2">
                      &ldquo;{request.message}&rdquo;
                    </p>
                  )}
                </div>
                <div className="flex gap-2 shrink-0">
                  <Button onClick={() => review(request.id, "approve")}>Approve</Button>
                  <Button onClick={() => review(request.id, "reject")} variant="secondary">
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
