"use client";

import { useEffect, useState } from "react";
import { Club } from "@/app/types";
import { getAllClubs } from "@/app/lib/club";
import ClubProfileComponent from "@/app/components/club/ClubCard";
import EmptyState from "@/app/components/ui/EmptyState";
import Button from "@/app/components/ui/Button";

export default function ClubsPage() {
  const [clubs, setClubs] = useState<Club[] | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    let cancelled = false;
    getAllClubs()
      .then((results) => {
        if (!cancelled) setClubs(results);
      })
      .catch(() => {
        if (!cancelled) {
          setError(true);
          setClubs([]);
        }
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 fade-up">
      <p className="ticket-label text-lavender-600">Find your people</p>
      <h1 className="font-display text-3xl font-bold text-ink-900 mt-1 mb-2">Explore clubs</h1>
      <p className="text-ink-600 max-w-xl">
        Find your community and get involved. Can&apos;t find your club? Start your own page.
      </p>

      {error && (
        <div className="mt-8">
          <EmptyState
            title="Clubs didn't load"
            body="Something went wrong on our end. Refresh to try again."
          />
        </div>
      )}

      {clubs === null && !error && (
        <p className="mt-8 font-mono text-sm text-ink-600">Loading clubs…</p>
      )}

      {clubs && clubs.length === 0 && !error && (
        <div className="mt-8">
          <EmptyState
            title="No clubs yet"
            body="Your club could be the first one here."
            action={<Button href="/create-club">Start a club page</Button>}
          />
        </div>
      )}

      {clubs && clubs.length > 0 && (
        <div className="mt-8 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 justify-items-center">
          {clubs.map((club) => (
            <ClubProfileComponent key={club.clubId} club={club} />
          ))}
        </div>
      )}
    </div>
  );
}
