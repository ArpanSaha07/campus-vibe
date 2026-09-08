"use client";

import { useState } from "react";
import { ArrowRightLeft } from "lucide-react";
import {
  cancelOwnershipTransfer,
  offerOwnership,
} from "@/app/lib/club-admin-requests";
import { parseApiError } from "@/app/lib/auth-errors";
import type { ClubAdmin, OutgoingOwner, OwnershipTransfer } from "@/app/types";
import Button from "@/app/components/ui/Button";

/**
 * Handing the club to somebody else.
 *
 * Deliberately the last thing on the Administrators tab, behind a disclosure,
 * and styled as a warning rather than a primary action. It is the one operation
 * on this screen the club cannot undo by itself: once ownership moves, getting
 * it back needs the new owner to agree, and if they will not, it needs
 * CampusVibe. Everything else here is reversible in two clicks.
 *
 * The successor list is the club's own active admins, because that is the
 * eligibility rule the server enforces. Rendering a dropdown rather than a text
 * field is not the check — it just means the owner cannot pick something that
 * would be refused.
 */
export default function TransferOwnershipPanel({
  clubId,
  admins,
  pending,
  onChanged,
}: {
  clubId: string;
  admins: ClubAdmin[];
  pending: OwnershipTransfer | null;
  onChanged: () => Promise<void>;
}) {
  const [open, setOpen] = useState(false);
  const [toUserId, setToUserId] = useState<string>("");
  const [outgoing, setOutgoing] = useState<OutgoingOwner>("CLUB_ADMIN");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Only active admins. A pending invitation is not membership, and the server
  // refuses it — offering it here would produce a confusing 400.
  const candidates = admins.filter(
    (a) => a.role === "CLUB_ADMIN" && a.status === "ACTIVE" && a.userId !== null,
  );

  async function offer() {
    if (!toUserId) return;
    setBusy(true);
    setError(null);
    try {
      await offerOwnership(clubId, Number(toUserId), outgoing);
      await onChanged();
      setOpen(false);
      setToUserId("");
    } catch (err) {
      setError(parseApiError(err, "That didn't work. Try again."));
    } finally {
      setBusy(false);
    }
  }

  async function withdraw() {
    setBusy(true);
    setError(null);
    try {
      await cancelOwnershipTransfer(clubId);
      await onChanged();
    } catch (err) {
      setError(parseApiError(err, "That didn't work. Try again."));
    } finally {
      setBusy(false);
    }
  }

  if (pending) {
    return (
      <div className="mt-6 rounded-2xl border border-berry-600/30 bg-[#F7E6EE] p-5">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            <p className="font-semibold text-ink-900">
              Waiting for {pending.toUserName} to accept the club
            </p>
            <p className="mt-1 text-sm text-ink-600">
              You are still the owner until they do. When they accept, you will{" "}
              {pending.outgoingBecomes === "CLUB_ADMIN"
                ? "stay on as a club admin."
                : "no longer be an administrator of this club."}
            </p>
          </div>
          <Button variant="secondary" onClick={withdraw} disabled={busy}>
            Withdraw
          </Button>
        </div>
        {error && <p className="mt-3 text-sm text-berry-600">{error}</p>}
      </div>
    );
  }

  return (
    <div className="mt-6 rounded-2xl border border-mist-200 bg-white p-5">
      <div className="flex items-start gap-3">
        <ArrowRightLeft
          className="mt-0.5 h-5 w-5 shrink-0 text-ink-600"
          aria-hidden="true"
        />
        <div className="min-w-0 flex-1">
          <p className="font-semibold text-ink-900">Hand over the club</p>
          <p className="mt-1 text-sm text-ink-600">
            Every club has exactly one owner. Handing it over makes someone else
            responsible for the club and its team — you can&apos;t take it back on
            your own.
          </p>

          {!open && (
            <button
              type="button"
              onClick={() => setOpen(true)}
              disabled={candidates.length === 0}
              className="mt-3 text-sm font-semibold text-berry-600 hover:text-berry-700 disabled:opacity-50 disabled:hover:text-berry-600"
            >
              {candidates.length === 0
                ? "Invite an admin first — ownership can only pass to one of them"
                : "Transfer ownership →"}
            </button>
          )}

          {open && (
            <div className="mt-4 space-y-4">
              <div>
                <label
                  htmlFor="transfer-to"
                  className="block text-sm font-semibold text-ink-900"
                >
                  Hand the club to
                </label>
                <select
                  id="transfer-to"
                  value={toUserId}
                  onChange={(e) => setToUserId(e.target.value)}
                  className="mt-1.5 h-10 w-full rounded-full border border-mist-200 bg-white px-4 text-sm text-ink-900 outline-none focus:border-lavender-600 sm:max-w-sm"
                >
                  <option value="">Choose an admin…</option>
                  {candidates.map((admin) => (
                    <option key={admin.assignmentId} value={String(admin.userId)}>
                      {admin.userName} — {admin.userEmail}
                    </option>
                  ))}
                </select>
              </div>

              <fieldset>
                <legend className="text-sm font-semibold text-ink-900">
                  Afterwards, you
                </legend>
                <div className="mt-1.5 space-y-2">
                  <label className="flex items-center gap-2.5 text-sm text-ink-600">
                    <input
                      type="radio"
                      name="outgoing"
                      value="CLUB_ADMIN"
                      checked={outgoing === "CLUB_ADMIN"}
                      onChange={() => setOutgoing("CLUB_ADMIN")}
                      className="accent-lavender-600"
                    />
                    Stay on as a club admin
                  </label>
                  <label className="flex items-center gap-2.5 text-sm text-ink-600">
                    <input
                      type="radio"
                      name="outgoing"
                      value="REVOKED"
                      checked={outgoing === "REVOKED"}
                      onChange={() => setOutgoing("REVOKED")}
                      className="accent-lavender-600"
                    />
                    Leave the club entirely
                  </label>
                </div>
              </fieldset>

              <div className="flex flex-wrap gap-3">
                <Button variant="berry" onClick={offer} disabled={busy || !toUserId}>
                  {busy ? "Sending…" : "Send the offer"}
                </Button>
                <Button
                  variant="secondary"
                  onClick={() => {
                    setOpen(false);
                    setError(null);
                  }}
                  disabled={busy}
                >
                  Cancel
                </Button>
              </div>

              <p className="text-sm text-ink-600">
                Nothing changes until they accept. You can withdraw the offer up
                to that point.
              </p>
            </div>
          )}

          {error && <p className="mt-3 text-sm text-berry-600">{error}</p>}
        </div>
      </div>
    </div>
  );
}
