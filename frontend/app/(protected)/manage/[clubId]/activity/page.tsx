"use client";

import { use, useCallback, useEffect, useState } from "react";
import { History } from "lucide-react";
import { listClubAuditLogs } from "@/app/lib/club-admin-requests";
import type { ClubAuditLog } from "@/app/types";
import SectionHeading from "@/app/components/ui/SectionHeading";
import EmptyState from "@/app/components/ui/EmptyState";
import Button from "@/app/components/ui/Button";

/** How many entries a page asks for. Matches the server's own default. */
const PAGE_SIZE = 25;

/**
 * What has happened to this club, and who did it.
 *
 * Read-only, and there is no control here that could be mistaken for an edit —
 * §22 makes the log immutable to owners and admins alike, and the database
 * enforces it with a trigger rather than trusting this screen not to offer one.
 *
 * Visible to the whole management team, per §19. An admin who cannot see what
 * changed cannot notice a change they did not expect, which is most of the point.
 */
export default function ClubActivityPage({
  params,
}: {
  params: Promise<{ clubId: string }>;
}) {
  const { clubId } = use(params);

  const [entries, setEntries] = useState<ClubAuditLog[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  // False once a page comes back short, which is how a keyset cursor knows it
  // has reached the end without a separate count query.
  const [hasMore, setHasMore] = useState(true);

  const loadFirstPage = useCallback(async () => {
    try {
      const page = await listClubAuditLogs(clubId, { limit: PAGE_SIZE });
      setEntries(page);
      setHasMore(page.length === PAGE_SIZE);
      setFailed(false);
    } catch {
      setEntries([]);
      setFailed(true);
    }
  }, [clubId]);

  useEffect(() => {
    void loadFirstPage();
  }, [loadFirstPage]);

  async function loadMore() {
    if (!entries || entries.length === 0) return;
    setLoadingMore(true);
    try {
      const page = await listClubAuditLogs(clubId, {
        // The last id on screen, so the next page starts strictly below it.
        before: entries[entries.length - 1].id,
        limit: PAGE_SIZE,
      });
      setEntries([...entries, ...page]);
      setHasMore(page.length === PAGE_SIZE);
    } catch {
      setFailed(true);
    } finally {
      setLoadingMore(false);
    }
  }

  return (
    <div>
      <SectionHeading
        title="Activity"
        subtitle="Every change to this club's team and ownership, with who made it. This record can't be edited or deleted by anyone."
      />

      {entries === null && (
        <p className="mt-6 font-mono text-sm text-ink-600">Loading the log…</p>
      )}

      {failed && (
        <div className="mt-6">
          <EmptyState
            title="The activity log didn't load"
            body="The server didn't answer. Refresh to try again."
          />
        </div>
      )}

      {entries !== null && !failed && entries.length === 0 && (
        <div className="mt-6">
          <EmptyState
            icon={<History className="h-7 w-7" aria-hidden="true" />}
            title="Nothing has happened yet"
            body="Inviting an admin, removing one, or handing the club over will all show up here."
          />
        </div>
      )}

      {entries !== null && !failed && entries.length > 0 && (
        <>
          <ol className="mt-6 space-y-1">
            {entries.map((entry) => (
              <ActivityRow key={entry.id} entry={entry} />
            ))}
          </ol>

          {hasMore && (
            <div className="mt-6 flex justify-center">
              <Button variant="secondary" onClick={loadMore} disabled={loadingMore}>
                {loadingMore ? "Loading…" : "Load more"}
              </Button>
            </div>
          )}
        </>
      )}
    </div>
  );
}

function ActivityRow({ entry }: { entry: ClubAuditLog }) {
  return (
    <li className="flex gap-4 rounded-2xl border border-transparent px-4 py-3 transition-colors hover:border-mist-200 hover:bg-white">
      <span
        className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-lavender-600"
        aria-hidden="true"
      />
      <div className="min-w-0">
        <p className="text-sm text-ink-900">{describe(entry)}</p>
        <p className="mt-0.5 font-mono text-xs text-ink-600">
          <time dateTime={entry.createdAt}>{formatWhen(entry.createdAt)}</time>
        </p>
      </div>
    </li>
  );
}

/**
 * Turns an entry into a sentence.
 *
 * Done here rather than on the server so the wording can change without a
 * redeploy of the API, and so an entry written a year ago is described in
 * today's words. Every branch falls back gracefully: metadata keys are absent
 * rather than empty when there was nothing to record, so `??` is the normal
 * path and not an error case.
 */
function describe(entry: ClubAuditLog): string {
  const who = entry.actorName;
  const target =
    entry.metadata?.targetName ??
    entry.metadata?.invitedEmail ??
    entry.metadata?.targetEmail ??
    "someone";

  switch (entry.action) {
    case "CLUB_ADMIN_INVITED":
      return `${who} invited ${target} to help run the club`;
    case "CLUB_ADMIN_ADDED":
      return `${who} accepted an invitation and became a club admin`;
    case "CLUB_ADMIN_DECLINED":
      return `${who} declined an invitation to help run the club`;
    case "CLUB_ADMIN_REMOVED":
      return entry.metadata?.wasInvitation === "true"
        ? `${who} cancelled the invitation for ${target}`
        : `${who} removed ${target} as a club admin`;
    case "OWNERSHIP_TRANSFER_REQUESTED":
      return `${who} offered ownership of the club to ${target}`;
    case "OWNERSHIP_TRANSFER_COMPLETED": {
      const from = entry.metadata?.fromName ?? "the previous owner";
      const to = entry.metadata?.toName ?? who;
      const after =
        entry.metadata?.outgoingBecomes === "REVOKED"
          ? `, and ${from} left the club`
          : `, and ${from} stayed on as an admin`;
      return `Ownership passed from ${from} to ${to}${after}`;
    }
    case "OWNERSHIP_TRANSFER_DECLINED":
      return `${who} declined to take ownership of the club`;
    case "OWNERSHIP_TRANSFER_CANCELLED":
      return entry.metadata?.reason === "SUCCESSOR_REMOVED"
        ? `The handover to ${target} was cancelled because they left the club`
        : `${who} withdrew the offer of ownership to ${target}`;
    default:
      // An action this build does not know about — a newer backend, or an old
      // entry whose action was retired. Showing the raw name beats showing
      // nothing, and beats crashing the page.
      return `${who}: ${entry.action}`;
  }
}

function formatWhen(iso: string): string {
  return new Date(iso).toLocaleString(undefined, {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}
