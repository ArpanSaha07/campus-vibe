import type { Metadata } from "next";
import { getAllClubs } from "@/app/lib/club";
import ClubProfileComponent from "@/app/components/club/ClubCard";
import EmptyState from "@/app/components/ui/EmptyState";
import Button from "@/app/components/ui/Button";

// A Server Component, like /events. The list is fetched before anything is
// sent, so the grid arrives in the first response instead of after a hydration
// round trip, and the `Loading clubs…` line is gone with it. getAllClubs is
// cached for five minutes (app/lib/cache.ts), so repeat visitors do not each
// cost a backend query.
//
// No notFound() here: /clubs always exists, and no clubs is an empty state.

export const metadata: Metadata = {
  title: "Explore clubs · CampusVibe",
  description: "Find your community and get involved.",
};

export default async function ClubsPage() {
  const clubs = await getAllClubs();

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 fade-up">
      <p className="ticket-label text-lavender-600">Find your people</p>
      <h1 className="font-display text-3xl font-bold text-ink-900 mt-1 mb-2">Explore clubs</h1>
      <p className="text-ink-600 max-w-xl">
        Find your community and get involved. Can&apos;t find your club? Start your own page.
      </p>

      {clubs.length === 0 ? (
        <div className="mt-8">
          <EmptyState
            title="No clubs yet"
            body="Your club could be the first one here."
            action={<Button href="/create-club">Start a club page</Button>}
          />
        </div>
      ) : (
        <div className="mt-8 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 justify-items-center">
          {clubs.map((club) => (
            <ClubProfileComponent key={club.clubId} club={club} />
          ))}
        </div>
      )}
    </div>
  );
}
