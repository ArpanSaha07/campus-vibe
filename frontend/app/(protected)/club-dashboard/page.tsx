"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useAuth } from "@/app/lib/auth-context";
import { isClubAdmin } from "@/app/lib/user";
import { getMyClub } from "@/app/lib/club-admin-requests";
import { listEvents } from "@/app/lib/event";
import type { Club, EventInstance } from "@/app/types";
import EventCard from "@/app/components/event/EventCard";
import SectionHeading from "@/app/components/ui/SectionHeading";
import StatTile from "@/app/components/ui/StatTile";
import EmptyState from "@/app/components/ui/EmptyState";
import Button from "@/app/components/ui/Button";

export default function ClubDashboardPage() {
  const { user, loading } = useAuth();
  const [club, setClub] = useState<Club | null>(null);
  const [clubError, setClubError] = useState(false);
  const [events, setEvents] = useState<EventInstance[] | null>(null);

  useEffect(() => {
    if (loading || !user || !isClubAdmin(user)) return;
    let cancelled = false;
    getMyClub()
      .then((myClub) => {
        if (cancelled) return;
        setClub(myClub);
        return listEvents().then((all) => {
          if (!cancelled) {
            setEvents(all.filter((e) => e.organizer === myClub.clubId));
          }
        });
      })
      .catch(() => {
        if (!cancelled) {
          setClubError(true);
          setEvents([]);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [loading, user]);

  if (!loading && user && !isClubAdmin(user)) {
    return (
      <main className="max-w-7xl mx-auto w-full px-4 sm:px-6 py-16">
        <EmptyState
          title="This dashboard is for club admins"
          body="Run a club? Request club admin access and an admin will review it."
          action={<Button href="/clubs" variant="secondary">Browse clubs</Button>}
        />
      </main>
    );
  }

  const upcomingCount =
    events?.filter((e) => e.dateTime >= new Date()).length ?? 0;

  return (
    <main className="max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-10 fade-up">
      <p className="ticket-label text-lavender-600">Club dashboard</p>
      <h1 className="font-display text-3xl font-bold text-ink-900 mt-1">
        {club ? club.name : "Your club"}
      </h1>

      {clubError && (
        <div className="mt-8">
          <EmptyState
            title="Couldn't load your club"
            body="The club service didn't respond. Refresh to try again."
          />
        </div>
      )}

      {!clubError && (
        <>
          {/* Overview */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 mt-8">
            <StatTile
              label="Followers"
              value={club ? club.followers : "…"}
              hint="People who follow your club"
            />
            <StatTile
              label="Upcoming events"
              value={events === null ? "…" : upcomingCount}
              hint="Published and on the calendar"
            />
            <StatTile
              label="Total events"
              value={events === null ? "…" : events.length}
              hint="All time"
            />
          </div>

          {/* Events */}
          <section className="mt-12">
            <SectionHeading title="Your events" />
            <div className="mb-6">
              <Button href="/create-event">Create event</Button>
            </div>
            {events === null && (
              <p className="font-mono text-sm text-ink-600">Loading events…</p>
            )}
            {events && events.length === 0 && (
              <EmptyState
                title="No events yet"
                body="Your first event is one form away — give your followers something to show up for."
                action={<Button href="/create-event">Create your first event</Button>}
              />
            )}
            {events && events.length > 0 && (
              <div className="flex space-x-6 overflow-x-auto pb-4">
                {events.map((event) => (
                  <EventCard key={event.eventId} event={event} />
                ))}
              </div>
            )}
          </section>

          {/* Media + Settings */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-12">
            <section className="rounded-2xl border border-mist-200 p-6">
              <h2 className="font-display text-xl font-bold text-ink-900">Media</h2>
              <p className="text-sm text-ink-600 mt-2">
                Your logo and photos are the first thing students see. Keep them fresh.
              </p>
              <div className="mt-4">
                <Button href={club ? `/clubs/${club.clubId}` : "/clubs"} variant="secondary">
                  View club page
                </Button>
              </div>
            </section>
            <section className="rounded-2xl border border-mist-200 p-6">
              <h2 className="font-display text-xl font-bold text-ink-900">Settings</h2>
              <p className="text-sm text-ink-600 mt-2">
                Description, social links, and contact info live on your club page.
              </p>
              <div className="mt-4">
                <Link
                  href={club ? `/clubs/${club.clubId}` : "/clubs"}
                  className="text-sm font-semibold text-lavender-600 hover:text-lavender-800"
                >
                  Edit club details →
                </Link>
              </div>
            </section>
          </div>
        </>
      )}
    </main>
  );
}
