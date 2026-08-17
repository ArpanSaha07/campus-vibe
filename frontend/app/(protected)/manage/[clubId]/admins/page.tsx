"use client";

import { use, useEffect, useState } from "react";
import { Info } from "lucide-react";
import { useAuth } from "@/app/lib/auth-context";
import { useManagedClubs } from "@/app/lib/managed-clubs-context";
import { listClubAdmins } from "@/app/lib/club-admin-requests";
import type { ClubAdmin } from "@/app/types";
import ClubRoleBadge from "@/app/components/manage/ClubRoleBadge";
import SectionHeading from "@/app/components/ui/SectionHeading";
import EmptyState from "@/app/components/ui/EmptyState";

/**
 * The club's management team.
 *
 * Read-only in this pass. Invite, remove and transfer-ownership are the next
 * slice — they need verification tokens, email delivery and acceptance pages,
 * and shipping the buttons before the workflows behind them would mean an
 * owner clicking Add admin and nothing happening.
 *
 * Owners and admins see the same list, per §3.2. What differs is the actions,
 * and the note at the foot says so rather than leaving an admin to wonder why
 * their screen looks emptier than the owner's.
 */
export default function ClubAdminsPage({
  params,
}: {
  params: Promise<{ clubId: string }>;
}) {
  const { clubId } = use(params);
  const { user } = useAuth();
  const { isOwnerOf } = useManagedClubs();
  const viewerIsOwner = isOwnerOf(clubId);

  const [admins, setAdmins] = useState<ClubAdmin[] | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    listClubAdmins(clubId)
      .then((team) => {
        if (!cancelled) setAdmins(team);
      })
      .catch(() => {
        if (cancelled) return;
        setAdmins([]);
        setFailed(true);
      });
    return () => {
      cancelled = true;
    };
  }, [clubId]);

  return (
    <div>
      <SectionHeading
        title="Administrators"
        subtitle="Everyone who can manage this club. Each of them uses their own CampusVibe account."
      />

      {admins === null && (
        <p className="font-mono text-sm text-ink-600">Loading the team…</p>
      )}

      {failed && (
        <EmptyState
          title="The team didn't load"
          body="The server didn't answer. Refresh to try again."
        />
      )}

      {admins !== null && !failed && (
        <ul className="space-y-3">
          {admins.map((admin) => {
            const isYou = admin.userId === user?.id;
            return (
              <li
                key={admin.assignmentId}
                className="flex flex-col gap-3 rounded-2xl border border-mist-200 bg-white p-5 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="flex min-w-0 items-center gap-4">
                  <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-lavender-100 font-display text-lg font-bold text-lavender-600">
                    {admin.userName.charAt(0).toUpperCase()}
                  </span>
                  <div className="min-w-0">
                    <p className="truncate font-semibold text-ink-900">
                      {admin.userName}
                      {isYou && (
                        <span className="ml-2 font-normal text-ink-600">(you)</span>
                      )}
                    </p>
                    <p className="truncate font-mono text-xs text-ink-600">
                      {admin.userEmail}
                    </p>
                  </div>
                </div>

                <div className="flex shrink-0 items-center gap-3">
                  {admin.status === "PENDING" && (
                    <span className="ticket-label rounded-full bg-[#F7E6EE] px-2.5 py-1 text-berry-600">
                      Invite pending
                    </span>
                  )}
                  <ClubRoleBadge role={admin.role} />
                </div>
              </li>
            );
          })}
        </ul>
      )}

      <div className="mt-8 flex gap-3 rounded-2xl border border-mist-200 bg-mist-100 p-5">
        <Info className="mt-0.5 h-5 w-5 shrink-0 text-lavender-600" aria-hidden="true" />
        <div className="text-sm text-ink-600">
          {viewerIsOwner ? (
            <>
              <p className="font-semibold text-ink-900">Adding and removing admins</p>
              <p className="mt-1">
                Inviting admins and handing over ownership are coming next. Both will
                confirm through your club&apos;s official email, so a change of leadership
                can&apos;t happen without the club knowing.
              </p>
            </>
          ) : (
            <>
              <p className="font-semibold text-ink-900">Who can change this list</p>
              <p className="mt-1">
                Only the club owner can add or remove admins, or hand over ownership. You
                can manage the club page and its events like any other admin.
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
