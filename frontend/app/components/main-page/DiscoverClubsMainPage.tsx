import { connection } from "next/server";
import { getAllClubs } from "@/app/lib/club";
import ClubProfileComponent from "@/app/components/club/ClubCard";
import SectionHeading from "@/app/components/ui/SectionHeading";

/**
 * The homepage's Featured clubs row: every club a platform admin marked
 * Promoted on the create form, which is `clubs.featured`.
 *
 * Fetches for itself, and the homepage wraps it in Suspense, so a slow backend
 * holds up this row rather than the whole page. Filtered from the cached club
 * list rather than a query of its own, because that list is already fetched
 * and cached for five minutes by /clubs.
 *
 * Renders nothing when there are no featured clubs or the list cannot be
 * fetched (Arpan, 2026-09-17): the row is an extra, and a backend that is down
 * must not take the rest of the homepage with it.
 */
export default async function FeaturedClubs() {
  // Request time, never build time: the build has no backend (BUG-027). See the
  // note in app/(main)/clubs/page.tsx on why connection() and not force-dynamic.
  await connection();

  let clubs;
  try {
    clubs = (await getAllClubs()).filter((club) => club.featured);
  } catch (error) {
    console.error("Featured clubs could not be loaded:", error);
    return null;
  }

  if (clubs.length === 0) return null;

  return (
    <section aria-label="Featured Clubs section on Main Page" className="max-w-7xl mx-auto px-4 sm:px-6 pb-8">
      <SectionHeading
        title="Featured clubs"
        subtitle="Follow a club and never miss what they host next."
        moreHref="/clubs"
        moreLabel="See all clubs"
      />

      {/* Scrollable container */}
      <div className="flex space-x-6 overflow-x-auto p-6 rounded-2xl bg-mist-100">
        {clubs.map((club) => (
          <ClubProfileComponent key={club.clubId} club={club} />
        ))}
      </div>
    </section>
  );
}
