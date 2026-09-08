"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { MailOpen } from "lucide-react";
import { useAuth } from "@/app/lib/auth-context";
import { useManagedClubs } from "@/app/lib/managed-clubs-context";
import {
  acceptClubInvitation,
  acceptOwnership,
  declineClubInvitation,
  declineOwnership,
} from "@/app/lib/club-admin-requests";
import { parseApiError } from "@/app/lib/auth-errors";
import type { ClubInvitation, OwnershipTransfer } from "@/app/types";
import ClubLogo from "@/app/components/club/ClubLogo";
import ClubRoleBadge from "@/app/components/manage/ClubRoleBadge";
import EmptyState from "@/app/components/ui/EmptyState";
import Button from "@/app/components/ui/Button";

/**
 * Invitations waiting on the signed-in user.
 *
 * This is where the invitation email lands, which is why it sits at a fixed
 * path outside `/manage` rather than inside it: the person opening the link may
 * manage no clubs at all, and `/manage` is not even in the navbar for them.
 *
 * Accepting is a plain authenticated POST — there is no token in the link. The
 * session is the proof, which is stronger than a mailed secret: a forwarded
 * email cannot accept on someone else's behalf.
 *
 * The list comes from `ManagedClubsProvider` rather than a fetch of its own,
 * because the navbar already needs the count to show the way here. Answering an
 * invitation calls `refresh()`, which reloads both the invitations and the
 * clubs — accepting changes each of them in one act.
 */
export default function ClubInvitationsPage() {
  const { user } = useAuth();
  const { ready, invitations, ownershipTransfers, invitationsFailed } =
    useManagedClubs();
  const nothingWaiting = invitations.length === 0 && ownershipTransfers.length === 0;

  return (
    <main className="mx-auto w-full max-w-3xl px-4 py-10 sm:px-6 lg:px-8 fade-up">
      <p className="ticket-label text-lavender-600">Club invitations</p>
      <h1 className="mt-1 font-display text-4xl font-bold text-ink-900">
        Invitations for you
      </h1>
      <p className="mt-2 text-ink-600">
        Clubs that have asked you to help run them, or to take them on entirely.
        Accepting adds the club to your dashboard; it changes nothing about your
        own account.
      </p>

      {/* The one thing that stops an invitation being answerable, surfaced
          before the button that would fail rather than after it. */}
      {user && !user.emailVerified && (
        <div className="mt-6 rounded-2xl border border-berry-600/30 bg-[#F7E6EE] p-5">
          <p className="font-semibold text-ink-900">Confirm your email address first</p>
          <p className="mt-1 text-sm text-ink-600">
            An invitation is sent to an address, so answering one means proving that
            address is yours. Check your inbox for the confirmation link we sent when
            you signed up.
          </p>
        </div>
      )}

      <div className="mt-8">
        {!ready && (
          <p className="font-mono text-sm text-ink-600">Loading your invitations…</p>
        )}

        {ready && invitationsFailed && (
          <EmptyState
            title="We couldn't load your invitations"
            body="The server didn't answer. Refresh to try again."
          />
        )}

        {ready && !invitationsFailed && nothingWaiting && (
          <EmptyState
            icon={<MailOpen className="h-7 w-7" aria-hidden="true" />}
            title="Nothing waiting"
            body="When a club owner invites you to help run their club, or offers to hand you one, it will show up here."
            action={<Button href="/clubs">Browse clubs</Button>}
          />
        )}

        {ready && !invitationsFailed && !nothingWaiting && (
          <ul className="space-y-4">
            {/* Handovers first: being offered a club is the bigger decision,
                and burying it under three admin invitations would be wrong. */}
            {ownershipTransfers.map((transfer) => (
              <OwnershipCard key={transfer.transferId} transfer={transfer} />
            ))}
            {invitations.map((invitation) => (
              <InvitationCard key={invitation.invitationId} invitation={invitation} />
            ))}
          </ul>
        )}
      </div>
    </main>
  );
}

function InvitationCard({ invitation }: { invitation: ClubInvitation }) {
  const router = useRouter();
  const { refresh } = useManagedClubs();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function accept() {
    setBusy(true);
    setError(null);
    try {
      const club = await acceptClubInvitation(invitation.invitationId);
      // The navbar and the dashboard guard both read the provider, so it has to
      // learn about the new club before we navigate into it — otherwise the
      // guard runs against a stale list and bounces the user straight back out.
      refresh();
      router.push(`/manage/${club.clubId}`);
    } catch (err) {
      setError(parseApiError(err, "We couldn't accept that invitation. Try again."));
      setBusy(false);
    }
  }

  async function decline() {
    setBusy(true);
    setError(null);
    try {
      await declineClubInvitation(invitation.invitationId);
      refresh();
    } catch (err) {
      setError(parseApiError(err, "We couldn't decline that invitation. Try again."));
      setBusy(false);
    }
  }

  return (
    <li className="rounded-2xl border border-mist-200 bg-white p-6">
      <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex min-w-0 items-center gap-4">
          <ClubLogo name={invitation.clubName} logo={invitation.clubLogo} size="md" />
          <div className="min-w-0">
            <p className="truncate font-display text-lg font-bold text-ink-900">
              {invitation.clubName}
            </p>
            <p className="mt-0.5 text-sm text-ink-600">
              {invitation.invitedByName
                ? `${invitation.invitedByName} invited you to help run this club.`
                : "You've been invited to help run this club."}
            </p>
            <ClubRoleBadge role={invitation.role} className="mt-2" />
          </div>
        </div>

        <div className="flex shrink-0 gap-3">
          <Button onClick={accept} disabled={busy}>
            Accept
          </Button>
          <Button variant="secondary" onClick={decline} disabled={busy}>
            Decline
          </Button>
        </div>
      </div>

      {error && <p className="mt-4 text-sm text-berry-600">{error}</p>}
    </li>
  );
}

/**
 * Being handed a whole club.
 *
 * Visibly heavier than an invitation card, because it is a heavier decision:
 * accepting makes you the person responsible for the club, its events and its
 * team, and the previous owner cannot take it back unilaterally. The card says
 * what changes for the outgoing owner too, since that is a fact about the club
 * the incoming owner should not discover afterwards.
 */
function OwnershipCard({ transfer }: { transfer: OwnershipTransfer }) {
  const router = useRouter();
  const { refresh } = useManagedClubs();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function accept() {
    setBusy(true);
    setError(null);
    try {
      const club = await acceptOwnership(transfer.transferId);
      refresh();
      router.push(`/manage/${club.clubId}`);
    } catch (err) {
      setError(parseApiError(err, "We couldn't accept that club. Try again."));
      setBusy(false);
    }
  }

  async function decline() {
    setBusy(true);
    setError(null);
    try {
      await declineOwnership(transfer.transferId);
      refresh();
    } catch (err) {
      setError(parseApiError(err, "We couldn't decline that. Try again."));
      setBusy(false);
    }
  }

  return (
    <li className="rounded-2xl border border-lavender-600/40 bg-lavender-50 p-6">
      <span className="ticket-label text-lavender-600">Ownership offer</span>

      <div className="mt-3 flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex min-w-0 items-center gap-4">
          <ClubLogo name={transfer.clubName} logo={transfer.clubLogo} size="md" />
          <div className="min-w-0">
            <p className="truncate font-display text-lg font-bold text-ink-900">
              {transfer.clubName}
            </p>
            <p className="mt-0.5 text-sm text-ink-600">
              {transfer.fromUserName} wants to make you the owner of this club.
            </p>
          </div>
        </div>

        <div className="flex shrink-0 gap-3">
          <Button onClick={accept} disabled={busy}>
            Accept the club
          </Button>
          <Button variant="secondary" onClick={decline} disabled={busy}>
            Decline
          </Button>
        </div>
      </div>

      <p className="mt-4 border-t border-lavender-600/20 pt-4 text-sm text-ink-600">
        As owner you manage the club page and its events, and you are the only
        person who can invite admins, remove them, and hand the club on.{" "}
        {transfer.outgoingBecomes === "CLUB_ADMIN"
          ? `${transfer.fromUserName} will stay on as a club admin.`
          : `${transfer.fromUserName} will leave the club when you accept.`}
      </p>

      {error && <p className="mt-4 text-sm text-berry-600">{error}</p>}
    </li>
  );
}
