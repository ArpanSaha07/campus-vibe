"use client";

import { use, useCallback, useEffect, useState } from "react";
import { Info, Trash2, UserPlus } from "lucide-react";
import { useAuth } from "@/app/lib/auth-context";
import { useManagedClubs } from "@/app/lib/managed-clubs-context";
import {
  getPendingOwnershipTransfer,
  inviteClubAdmin,
  listClubAdmins,
  removeClubAdmin,
} from "@/app/lib/club-admin-requests";
import { parseApiError } from "@/app/lib/auth-errors";
import type { ClubAdmin, OwnershipTransfer } from "@/app/types";
import ClubRoleBadge from "@/app/components/manage/ClubRoleBadge";
import SectionHeading from "@/app/components/ui/SectionHeading";
import EmptyState from "@/app/components/ui/EmptyState";
import Button from "@/app/components/ui/Button";
import TransferOwnershipPanel from "@/app/components/manage/TransferOwnershipPanel";

/**
 * The club's management team, and — for the owner — the controls that change it.
 *
 * Owners and admins see the same list, per §3.2: knowing who your
 * co-administrators are is not a privileged act. What differs is the actions,
 * and the note at the foot says so rather than leaving an admin to wonder why
 * their screen looks emptier than the owner's.
 *
 * Every control here is a convenience, never a boundary. `isClubOwner` is
 * re-checked server-side on both the invite and the remove, so hiding a button
 * is only about not offering someone a click that would fail.
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
  const [transfer, setTransfer] = useState<OwnershipTransfer | null>(null);
  const [failed, setFailed] = useState(false);

  const load = useCallback(async () => {
    try {
      // Together, because removing an admin can cancel a pending handover and
      // accepting one rewrites the team: showing either from a stale read makes
      // the screen contradict itself.
      const [team, pending] = await Promise.all([
        listClubAdmins(clubId),
        getPendingOwnershipTransfer(clubId),
      ]);
      setAdmins(team);
      setTransfer(pending);
      setFailed(false);
    } catch {
      setAdmins([]);
      setTransfer(null);
      setFailed(true);
    }
  }, [clubId]);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <div>
      <SectionHeading
        title="Administrators"
        subtitle="Everyone who can manage this club. Each of them uses their own CampusVibe account."
      />

      {viewerIsOwner && <InviteAdminForm clubId={clubId} onInvited={load} />}

      {admins === null && (
        <p className="mt-6 font-mono text-sm text-ink-600">Loading the team…</p>
      )}

      {failed && (
        <div className="mt-6">
          <EmptyState
            title="The team didn't load"
            body="The server didn't answer. Refresh to try again."
          />
        </div>
      )}

      {admins !== null && !failed && (
        <ul className="mt-6 space-y-3">
          {admins.map((admin) => (
            <AdminRow
              key={admin.assignmentId}
              admin={admin}
              clubId={clubId}
              isYou={admin.userId !== null && admin.userId === user?.id}
              viewerIsOwner={viewerIsOwner}
              onRemoved={load}
            />
          ))}
        </ul>
      )}

      {viewerIsOwner && admins !== null && !failed && (
        <TransferOwnershipPanel
          clubId={clubId}
          admins={admins}
          pending={transfer}
          onChanged={load}
        />
      )}

      <div className="mt-8 flex gap-3 rounded-2xl border border-mist-200 bg-mist-100 p-5">
        <Info className="mt-0.5 h-5 w-5 shrink-0 text-lavender-600" aria-hidden="true" />
        <div className="text-sm text-ink-600">
          {viewerIsOwner ? (
            <>
              <p className="font-semibold text-ink-900">About your team</p>
              <p className="mt-1">
                Admins can manage this club&apos;s page and its events. Only you can
                invite and remove them, or hand the club over. Your own row
                can&apos;t be removed — the club is never left without an owner, so
                leaving means handing it to someone else first.
              </p>
            </>
          ) : (
            <>
              <p className="font-semibold text-ink-900">Who can change this list</p>
              <p className="mt-1">
                Only the club owner can add or remove admins, or hand over ownership.
                You can manage the club page and its events like any other admin.
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

/**
 * One row of the team.
 *
 * A pending invitation is a row like any other rather than a separate list.
 * The owner's question is "who is on my team", and someone invited last Tuesday
 * who has not answered belongs in that answer — filed away under its own
 * heading, they would be forgotten and re-invited.
 */
function AdminRow({
  admin,
  clubId,
  isYou,
  viewerIsOwner,
  onRemoved,
}: {
  admin: ClubAdmin;
  clubId: string;
  isYou: boolean;
  viewerIsOwner: boolean;
  onRemoved: () => Promise<void>;
}) {
  const [removing, setRemoving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const pending = admin.status === "PENDING";
  // Null for an invitation to an address that has no account yet — there is no
  // name to show until somebody claims it.
  const label = admin.userName ?? admin.invitedEmail ?? "Invited";
  const sublabel = admin.userName ? admin.userEmail : null;
  const removable = viewerIsOwner && admin.role !== "CLUB_OWNER";

  async function remove() {
    setRemoving(true);
    setError(null);
    try {
      await removeClubAdmin(clubId, admin.assignmentId);
      await onRemoved();
    } catch (err) {
      setError(parseApiError(err, "That didn't work. Try again."));
      setRemoving(false);
    }
  }

  return (
    <li className="rounded-2xl border border-mist-200 bg-white p-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex min-w-0 items-center gap-4">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-lavender-100 font-display text-lg font-bold text-lavender-600">
            {label.charAt(0).toUpperCase()}
          </span>
          <div className="min-w-0">
            <p className="truncate font-semibold text-ink-900">
              {label}
              {isYou && <span className="ml-2 font-normal text-ink-600">(you)</span>}
            </p>
            {sublabel && (
              <p className="truncate font-mono text-xs text-ink-600">{sublabel}</p>
            )}
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-3">
          {pending && (
            <span className="ticket-label rounded-full bg-[#F7E6EE] px-2.5 py-1 text-berry-600">
              Invite pending
            </span>
          )}
          <ClubRoleBadge role={admin.role} />
          {removable && (
            <button
              type="button"
              onClick={remove}
              disabled={removing}
              // The label carries the name because a screen reader hears a
              // column of identical "Remove" buttons otherwise.
              aria-label={
                pending ? `Cancel the invitation for ${label}` : `Remove ${label}`
              }
              className="rounded-full p-2 text-ink-600 transition-colors hover:bg-berry-50 hover:text-berry-600 disabled:opacity-50"
            >
              <Trash2 className="h-4 w-4" aria-hidden="true" />
            </button>
          )}
        </div>
      </div>

      {error && <p className="mt-3 text-sm text-berry-600">{error}</p>}
    </li>
  );
}

/**
 * Invite by address.
 *
 * Deliberately not a user picker. The person joining a club's exec team in
 * September frequently has no CampusVibe account in August, and a picker can
 * only offer accounts that already exist — the owner would be told to go and
 * chase a signup before they could do the thing they came here to do. An
 * address works either way: the invitation waits until someone signs up with it.
 */
function InviteAdminForm({
  clubId,
  onInvited,
}: {
  clubId: string;
  onInvited: () => Promise<void>;
}) {
  const [email, setEmail] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sentTo, setSentTo] = useState<string | null>(null);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    const address = email.trim();
    if (!address || sending) return;

    setSending(true);
    setError(null);
    setSentTo(null);
    try {
      await inviteClubAdmin(clubId, address);
      await onInvited();
      setSentTo(address);
      setEmail("");
    } catch (err) {
      setError(parseApiError(err, "We couldn't send that invitation. Try again."));
    } finally {
      setSending(false);
    }
  }

  return (
    <form
      onSubmit={submit}
      className="mt-6 rounded-2xl border border-mist-200 bg-white p-5"
    >
      <label htmlFor="invite-email" className="font-semibold text-ink-900">
        Invite an admin
      </label>
      <p className="mt-1 text-sm text-ink-600">
        They&apos;ll get an email and choose whether to accept. If they&apos;re not on
        CampusVibe yet, they can sign up with this address and the invitation will be
        waiting.
      </p>

      <div className="mt-4 flex flex-col gap-3 sm:flex-row">
        <input
          id="invite-email"
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="name@university.edu"
          className="h-10 w-full flex-1 rounded-full border border-mist-200 px-4 text-sm text-ink-900 outline-none placeholder:text-ink-600/60"
        />
        <Button type="submit" disabled={sending}>
          <UserPlus className="h-4 w-4" aria-hidden="true" />
          {sending ? "Sending…" : "Send invite"}
        </Button>
      </div>

      {/* aria-live so the outcome is announced; both messages share the region
          so a success never sits underneath a stale failure. */}
      <div aria-live="polite">
        {error && <p className="mt-3 text-sm text-berry-600">{error}</p>}
        {sentTo && (
          <p className="mt-3 text-sm text-ink-600">
            Invitation sent to <span className="font-mono">{sentTo}</span>. They
            aren&apos;t an admin until they accept.
          </p>
        )}
      </div>
    </form>
  );
}
