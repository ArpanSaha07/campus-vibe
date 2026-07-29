"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/app/lib/auth-context";
import { listEvents } from "@/app/lib/event";
import type { EventInstance } from "@/app/types";
import EventCard from "@/app/components/event/EventCard";
import SectionHeading from "@/app/components/ui/SectionHeading";
import StatTile from "@/app/components/ui/StatTile";
import EmptyState from "@/app/components/ui/EmptyState";
import Button from "@/app/components/ui/Button";

export default function DashboardPage() {
  const { user } = useAuth();
  const [upcoming, setUpcoming] = useState<EventInstance[] | null>(null);

  useEffect(() => {
    let cancelled = false;
    listEvents()
      .then((events) => {
        if (cancelled) return;
        const now = new Date();
        setUpcoming(
          events
            .filter((e) => e.dateTime >= now)
            .sort((a, b) => a.dateTime.getTime() - b.dateTime.getTime())
            .slice(0, 8)
        );
      })
      .catch(() => {
        if (!cancelled) setUpcoming([]);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const firstName = user?.name?.split(" ")[0] ?? "there";

  return (
    <main className="max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-10 fade-up">
      <p className="ticket-label text-lavender-600">Your dashboard</p>
      <h1 className="font-display text-3xl font-bold text-ink-900 mt-1">
        Hey {firstName} — what are you going to this week?
      </h1>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 mt-8">
        <StatTile
          label="Upcoming events"
          value={upcoming === null ? "…" : upcoming.length}
          hint="On campus, soonest first"
        />
        <StatTile label="Saved events" value={0} hint="Bookmark events to see them here" />
        <StatTile label="Followed clubs" value={0} hint="Follow clubs to see them here" />
      </div>

      {/* Upcoming events */}
      <section className="mt-12">
        <SectionHeading title="Upcoming events" moreHref="/events" moreLabel="Explore all" />
        {upcoming === null && (
          <p className="font-mono text-sm text-ink-600">Loading events…</p>
        )}
        {upcoming && upcoming.length === 0 && (
          <EmptyState
            title="Nothing on the calendar yet"
            body="When clubs publish events, the soonest ones show up here."
            action={<Button href="/events" variant="secondary">Browse events</Button>}
          />
        )}
        {upcoming && upcoming.length > 0 && (
          <div className="flex space-x-6 overflow-x-auto pb-4">
            {upcoming.map((event) => (
              <EventCard key={event.eventId} event={event} />
            ))}
          </div>
        )}
      </section>

      {/* Saved events */}
      <section className="mt-12">
        <SectionHeading title="Saved events" />
        <EmptyState
          title="No saved events"
          body="Tap the heart on any event to keep it here for later."
          action={<Button href="/events" variant="secondary">Find something to save</Button>}
        />
      </section>

      {/* Followed clubs */}
      <section className="mt-12">
        <SectionHeading title="Followed clubs" />
        <EmptyState
          title="You're not following any clubs"
          body="Follow a club and you'll never miss what they host next."
          action={<Button href="/clubs" variant="secondary">Discover clubs</Button>}
        />
      </section>
    </main>
  );
}
