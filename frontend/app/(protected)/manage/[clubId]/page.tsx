"use client";

import { use, useEffect, useState } from "react";
import { useManagedClubs } from "@/app/lib/managed-clubs-context";
import { listClubAdmins } from "@/app/lib/club-admin-requests";
import { listEventsByClub } from "@/app/lib/event";
import type { EventInstance } from "@/app/types";
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
  const { clubs } = useManagedClubs();
  const club = clubs.find((candidate) => candidate.clubId === clubId);

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
            value={club ? club.followers : "—"}
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

      {/* The official club email is organisational, and only a platform admin
          can change it — so this states the fact rather than offering a field
          that would be refused. */}
      <section className="rounded-2xl border border-mist-200 p-6">
        <h2 className="font-display text-xl font-bold text-ink-900">Official club email</h2>
        {club?.officialEmail ? (
          <>
            <p className="mt-2 font-mono text-sm text-ink-900">{club.officialEmail}</p>
            <p className="mt-2 text-sm text-ink-600">
              {club.officialEmailVerified
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
        <p className="mt-3 text-xs text-ink-600">
          Only the CampusVibe team can set or change this, so it stays a reliable way to
          recover the club. Email us to have it updated.
        </p>
      </section>
    </div>
  );
}
