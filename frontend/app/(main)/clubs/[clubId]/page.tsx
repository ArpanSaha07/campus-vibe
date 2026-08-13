import type { Metadata } from "next";
import { notFound } from "next/navigation";
import ClubFollowButton from "@/app/components/club/ClubFollowButton";
import ClubLogo from "@/app/components/club/ClubLogo";
import ClubEventTabs from "@/app/components/club/ClubEventTabs";
import Button from "@/app/components/ui/Button";

import { popularEvents } from "@/app/data/data";
import type { ClubPageProps } from "@/app/types";
import { getClubById, getTotalEventsForClub } from "@/app/lib/club";

// A Server Component on purpose. The club is fetched before anything is sent,
// so a real club arrives in the first response instead of after a hydration
// round trip, and an unknown slug gets a genuine 404 rather than a 200 carrying
// an error message. Both were wrong while this was a client page: `club` began
// as null, so every valid club briefly rendered its own "not found" state.

export async function generateMetadata({ params }: ClubPageProps): Promise<Metadata> {
  const { clubId } = await params;
  const club = await getClubById(clubId).catch(() => null);
  if (!club) return { title: "Club not found · CampusVibe" };

  return {
    title: `${club.name} · CampusVibe`,
    description: club.description || `Events and updates from ${club.name}.`,
  };
}

export default async function ClubPage({ params }: ClubPageProps) {
  const { clubId } = await params;
  const club = await getClubById(clubId);

  // Called in the page body rather than inside a Suspense boundary: the docs
  // note a streamed response can no longer change its status, so checking here
  // is what makes this an actual 404. notFound() returns `never`, so no
  // `return` is needed and `club` is a Club from this line on.
  if (!club) notFound();

  // Counted from the club's own events rather than guessed. This used to be
  // Math.random(), so the number changed on every load.
  const totalEvents = await getTotalEventsForClub(club.clubId);

  return (
    <div className="max-w-7xl mx-auto py-10 px-4 sm:px-6 fade-up">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-4">
        {/* alt is set here, unlike the card call sites: this is the page header,
            so the name beside it is an <h1> rather than the logo's own label. */}
        <ClubLogo name={club.name} logo={club.logo} size="lg" alt={`${club.name} logo`} />
        <div>
          <h1 className="font-display text-3xl font-bold text-ink-900">{club.name}</h1>
          <p className="font-mono text-xs text-ink-600 mt-1">
            {club.followers} followers · {totalEvents} events
          </p>
          <div className="flex gap-3 mt-2 text-sm">
            {club.socialLinks?.facebook && (
              <a
                href={club.socialLinks.facebook}
                target="_blank"
                rel="noopener noreferrer"
                className="text-lavender-600 font-semibold hover:text-lavender-800"
              >
                Facebook
              </a>
            )}
            {club.socialLinks?.website && (
              <a
                href={club.socialLinks.website}
                target="_blank"
                rel="noopener noreferrer"
                className="text-lavender-600 font-semibold hover:text-lavender-800"
              >
                Website
              </a>
            )}
          </div>
        </div>
        <div className="sm:ml-auto flex gap-2">
          <ClubFollowButton clubId={club.clubId} />
          <Button variant="secondary">Contact</Button>
        </div>
      </div>

      {club.description && (
        <p className="text-ink-600 max-w-2xl mt-6 leading-relaxed">{club.description}</p>
      )}

      {/* Still mock events for both tabs — the per-club event endpoint is a
          separate task (todo.md). Only the club itself is wired up here. */}
      <ClubEventTabs upcomingEvents={popularEvents} pastEvents={popularEvents} />
    </div>
  );
}
