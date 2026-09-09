"use client";

import { use, useEffect, useState } from "react";
import { useManageClub } from "@/app/lib/manage-club-context";
import { listClubAdmins, setClubOfficialEmail } from "@/app/lib/club-admin-requests";
import { useAuth } from "@/app/lib/auth-context";
import { isAdmin } from "@/app/lib/user";
import { listEventsByClub } from "@/app/lib/event";
import type { EventInstance, ManagedClub } from "@/app/types";
import SectionHeading from "@/app/components/ui/SectionHeading";
import StatTile from "@/app/components/ui/StatTile";
import EmptyState from "@/app/components/ui/EmptyState";
import Button from "@/app/components/ui/Button";
import EventCard from "@/app/components/event/EventCard";

/**
 * Club overview: the three numbers that answer "how is the club doing", and
 * the next few events.
 *
 * Deliberately no analytics beyond counts. Anything richer needs data the
 * backend does not collect yet, and a tile showing a plausible-looking number
 * nobody computed is worse than no tile.
 */
export default function ClubOverviewPage({
  params,
}: {
  params: Promise<{ clubId: string }>;
}) {
  const { clubId } = use(params);
  // From the layout, which already resolved it — including for a platform admin
  // who holds no assignment here and so appears in no managed-clubs list.
  const { club } = useManageClub();

  const [events, setEvents] = useState<EventInstance[] | null>(null);
  const [adminCount, setAdminCount] = useState<number | null>(null);
  const [loadFailed, setLoadFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;

    // Both calls are club-scoped, so this page costs two requests regardless of
    // how many events the club has — the old dashboard fetched every event on
    // the platform and filtered in the browser.
    Promise.all([listEventsByClub(clubId), listClubAdmins(clubId)])
      .then(([clubEvents, admins]) => {
        if (cancelled) return;
        setEvents(clubEvents);
        setAdminCount(admins.length);
      })
      .catch(() => {
        if (cancelled) return;
        setEvents([]);
        setLoadFailed(true);
      });

    return () => {
      cancelled = true;
    };
  }, [clubId]);

  const now = new Date();
  const upcoming = events?.filter((event) => event.dateTime >= now) ?? [];
  const nextUp = [...upcoming].sort(
    (a, b) => a.dateTime.getTime() - b.dateTime.getTime(),
  );

  return (
    <div className="space-y-10">
      <section>
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-3">
          <StatTile
            label="Followers"
            value={club.followers}
            hint="Students following this club"
          />
          <StatTile
            label="Upcoming events"
            value={events === null ? "…" : upcoming.length}
            hint="Still to happen"
          />
          <StatTile
            label="Team"
            value={adminCount === null ? "…" : adminCount}
            hint="Owner and admins"
          />
        </div>

        {loadFailed && (
          <p className="mt-4 text-sm text-alert-600">
            Some of this club&apos;s data didn&apos;t load. Refresh to try again.
          </p>
        )}
      </section>

      <section>
        <SectionHeading
          title="Next up"
          subtitle="The events your followers are about to see."
          moreHref={`/manage/${clubId}/events`}
          moreLabel="All events"
        />

        {events === null && (
          <p className="font-mono text-sm text-ink-600">Loading events…</p>
        )}

        {events !== null && nextUp.length === 0 && (
          <EmptyState
            title="Nothing on the calendar"
            body="No events yet — be the first to host one. Your followers get notified as soon as you publish."
            action={<Button href="/create-event">Create event</Button>}
          />
        )}

        {nextUp.length > 0 && (
          <div className="flex gap-6 overflow-x-auto pb-4">
            {nextUp.slice(0, 4).map((event) => (
              <EventCard key={event.eventId} event={event} />
            ))}
          </div>
        )}
      </section>

      <OfficialEmailPanel clubId={clubId} club={club} />

    </div>
  );
}

/**
 * The club's official email, and — for a platform admin — the field that writes
 * it.
 *
 * <p>Read-only for everyone else, and that is the design rather than a
 * limitation: the address is the club's recovery channel, so whoever currently
 * runs the club must not be able to point it somewhere they control. The
 * backend enforces it with `hasRole('ADMIN')`; this only decides what to draw.
 *
 * <p>Saving always leaves the address unverified. That is not a bug in this
 * panel — verified means somebody opened the club inbox and redeemed a link
 * sent to it, which no administrative write can stand in for (ADR-006). The
 * round trip ships with SES; until then every club reads as unverified, which
 * is true.
 */
function OfficialEmailPanel({ clubId, club }: { clubId: string; club: ManagedClub }) {
  const { user } = useAuth();
  const platformAdmin = isAdmin(user);

  // Seeded from the club the layout resolved, then owned locally: the context
  // holds one immutable club and has no setter, so without this the panel would
  // go on showing the old address until a reload.
  const [officialEmail, setOfficialEmail] = useState(club?.officialEmail ?? null);
  const [verified, setVerified] = useState(club?.officialEmailVerified ?? false);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(club?.officialEmail ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function save() {
    setError("");
    setSaving(true);
    try {
      const trimmed = draft.trim();
      const updated = await setClubOfficialEmail(clubId, trimmed === "" ? null : trimmed);
      setOfficialEmail(updated.officialEmail);
      setVerified(updated.officialEmailVerified);
      setEditing(false);
    } catch {
      setError("That didn't save. Check the address and try again.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="rounded-2xl border border-mist-200 p-6">
      <div className="flex items-start justify-between gap-4">
        <h2 className="font-display text-xl font-bold text-ink-900">Official club email</h2>
        {platformAdmin && !editing && (
          <Button
            variant="secondary"
            onClick={() => {
              setDraft(officialEmail ?? "");
              setEditing(true);
            }}
          >
            {officialEmail ? "Change" : "Set"}
          </Button>
        )}
      </div>

      {editing ? (
        <div className="mt-4">
          <label htmlFor="officialEmail" className="block text-sm font-medium text-ink-900">
            Address
          </label>
          <input
            id="officialEmail"
            type="email"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            disabled={saving}
            placeholder="robotics@campus.com"
            className="mt-1 w-full rounded-lg border border-mist-200 px-3 py-2 font-mono text-sm"
          />
          <p className="mt-2 text-xs text-ink-600">
            Leave it empty to clear the address. Saving always marks it unverified — the
            club has to confirm it from that inbox, which is what makes it trustworthy.
          </p>
          {error && <p className="mt-2 text-sm text-alert-600">{error}</p>}
          <div className="mt-3 flex gap-2">
            <Button onClick={save} disabled={saving}>
              {saving ? "Saving…" : "Save"}
            </Button>
            <Button
              variant="secondary"
              onClick={() => {
                setEditing(false);
                setError("");
              }}
              disabled={saving}
            >
              Cancel
            </Button>
          </div>
        </div>
      ) : officialEmail ? (
        <>
          <p className="mt-2 font-mono text-sm text-ink-900">{officialEmail}</p>
          <p className="mt-2 text-sm text-ink-600">
            {verified
              ? "Verified. Security notices about your club go here."
              : "Not verified yet, so it can't be used to confirm admin changes."}
          </p>
        </>
      ) : (
        <p className="mt-2 text-sm text-ink-600">
          Not set yet. This is your club&apos;s own address — the one that stays with the
          club as execs change — and it&apos;s where security notices go.
        </p>
      )}

      {!platformAdmin && (
        <p className="mt-3 text-xs text-ink-600">
          Only the CampusVibe team can set or change this, so it stays a reliable way to
          recover the club. Email us to have it updated.
        </p>
      )}
    </section>
  );
}
