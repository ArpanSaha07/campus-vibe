import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Image from "next/image";
import ClubFollowButton from "@/app/components/club/ClubFollowButton";
import ClubLogo from "@/app/components/club/ClubLogo";
import ClubEventTabs from "@/app/components/club/ClubEventTabs";
import ClubSocialLinks from "@/app/components/club/ClubSocialLinks";
import Chip from "@/app/components/ui/Chip";
import SectionHeading from "@/app/components/ui/SectionHeading";

import type { ClubPageProps, EventInstance } from "@/app/types";
import { getClubById } from "@/app/lib/club";
import { listEventsByClub } from "@/app/lib/event";
import { hasEnded } from "@/app/lib/event-time";
import { getClubCategories, getInterests, labelFor } from "@/app/lib/taxonomy";

// A Server Component on purpose. The club is fetched before anything is sent,
// so a real club arrives in the first response instead of after a hydration
// round trip, and an unknown slug gets a genuine 404 rather than a 200 carrying
// an error message. Both were wrong while this was a client page: `club` began
// as null, so every valid club briefly rendered its own "not found" state.
//
// The page is one container — `max-w-7xl mx-auto px-4 sm:px-6` — and nothing
// below it opens a second one. That is the whole of the alignment fix: the
// events used to arrive inside `EventSectionMainPage`, which re-applies the
// same max width and the same gutter, so they sat one gutter right of the <h1>.

export async function generateMetadata({ params }: ClubPageProps): Promise<Metadata> {
  const { clubId } = await params;
  const club = await getClubById(clubId).catch(() => null);
  if (!club) return { title: "Club not found · CampusVibe" };

  return {
    title: `${club.name} · CampusVibe`,
    description: club.description || `Events and updates from ${club.name}.`,
  };
}

/**
 * Soonest first for what is coming, most recent first for what is done.
 *
 * The line between the two is `hasEnded` — the event's *end* against now, not
 * its start. An event that began an hour ago and runs until midnight has not
 * happened yet as far as someone reading this page is concerned, and filing it
 * under Past is the exact failure BUG-058 was about: a running event looked
 * over on the dashboards. `event-time.ts` is the one definition of that line,
 * and the backend's `?upcoming=true` keeps an event while `end_time > now()`,
 * so this agrees with the API rather than inventing a second rule.
 */
function splitByDate(events: EventInstance[]): {
  upcoming: EventInstance[];
  past: EventInstance[];
} {
  // One clock reading for the whole split, so an event cannot land in both
  // lists or in neither by being compared against two different `now`s.
  const now = new Date();

  return {
    upcoming: events
      .filter((event) => !hasEnded(event, now))
      .sort((a, b) => a.dateTime.getTime() - b.dateTime.getTime()),
    past: events
      .filter((event) => hasEnded(event, now))
      .sort((a, b) => b.dateTime.getTime() - a.dateTime.getTime()),
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

  // The club's real events, filtered server-side by organizerId. Both tabs used
  // to render `popularEvents` — the same eight mock rows twice — while this
  // club's own events were already being fetched by `getTotalEventsForClub`,
  // counted, and thrown away.
  //
  // Deliberately not caught, unlike the two vocabularies below: a club's events
  // are half of what this page is for, so a failure to load them is a genuine
  // failure that error.tsx should show, not an empty state that would tell the
  // reader this club runs nothing. The labels are cosmetic, so a failure there
  // costs the chips and nothing else.
  const [events, categories, interests] = await Promise.all([
    listEventsByClub(club.clubId),
    getClubCategories().catch(() => []),
    getInterests().catch(() => []),
  ]);

  const { upcoming, past } = splitByDate(events);

  // Stored as slugs, and `sports-recreation` is not something to show a human.
  const categoryLabel = club.category ? labelFor(categories, club.category) : null;
  const interestLabels = club.interests.map((slug) => labelFor(interests, slug));

  return (
    // w-full is load-bearing, exactly as on the event page: this div is a flex
    // item of the (main) layout's column, and a flex item with auto cross-axis
    // margins (mx-auto) is not stretched — it shrink-to-fits its content
    // instead, so max-w-7xl never comes into play and the page collapses to
    // whatever its text needs. The old markup omitted it too and got away with
    // it: the nested container inside EventSectionMainPage was supplying the
    // width. Removing that container is what exposed this.
    <div className="w-full max-w-7xl mx-auto py-10 px-4 sm:px-6 fade-up">
      {/* Identity */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-4">
        {/* alt is set here, unlike the card call sites: this is the page header,
            so the name beside it is an <h1> rather than the logo's own label. */}
        <ClubLogo name={club.name} logo={club.logo} size="lg" alt={`${club.name} logo`} />

        <div>
          <h1 className="font-display text-3xl font-bold text-ink-900">{club.name}</h1>
          {/* Plain secondary text rather than .ticket-label: that utility
              uppercases, and it is for printed labels — DATE, PRICE — never for
              a value, which is how a club slug once rendered as
              QUANTUM-COMPUTING-SOCIETY. */}
          {/* {categoryLabel && <p className="text-sm text-ink-600 mt-1.5">{categoryLabel}</p>} */}
        </div>

        <div className="sm:ml-auto">
          <ClubFollowButton clubId={club.clubId} />
        </div>
      </div>

      {/* About. Each child decides for itself whether it appears, so an empty
          one contributes no gap rather than a blank row. */}
      <div className="mt-6 flex flex-col gap-4">
        {club.description && (
          <p className="text-ink-600 max-w-2xl leading-relaxed">{club.description}</p>
        )}

        {interestLabels.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {interestLabels.map((label) => (
              <Chip key={label}>{label}</Chip>
            ))}
          </div>
        )}

        <ClubSocialLinks links={club.socialLinks} name={club.name} />
      </div>

      <hr className="mt-10 border-mist-200" />

      <ClubEventTabs clubName={club.name} upcomingEvents={upcoming} pastEvents={past} />

      {/* The club's own photos, last: the events answer the question a visitor
          arrived with, and these are what you look at once they have. Uploaded
          from /manage, and already mapped to same-origin, versioned /media
          paths by toClub — never the raw S3 keys, which next/image throws on
          during render. */}
      {club.images.length > 0 && (
        <>
          <hr className="mt-10 border-mist-200" />
          <section className="mt-8">
            <SectionHeading title="Photos" />
            {/* auto-fill, not auto-fit: auto-fit collapses the tracks nothing
                landed in, so a club with one photo stretched it across the whole
                1232px row at 192px tall — a 6:1 letterbox that crops all but a
                band out of any real photograph. auto-fill keeps the empty tracks,
                so one photo is the same ~290px tile as one of eight. */}
            <div className="mt-4 grid gap-4 grid-cols-[repeat(auto-fill,minmax(min(280px,100%),1fr))]">
              {club.images.map((src, index) => (
                // 4:3, because that is what a phone camera shoots by default:
                // such a photo fills this box exactly, and a 3:2 one loses ~11%
                // off the sides. A flat height could not do that — the tile is
                // as wide as its track, so only a ratio keeps the shape honest
                // as the track grows. Images are addressed by position, so two
                // of them can legitimately be the same URL; the index keeps the
                // key unique when they are.
                <div
                  key={`${index}-${src}`}
                  className="relative aspect-[4/3] overflow-hidden rounded-2xl bg-mist-100"
                >
                  <Image
                    src={src}
                    alt={`${club.name} photo ${index + 1}`}
                    fill
                    sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 300px"
                    className="object-cover"
                  />
                </div>
              ))}
            </div>
          </section>
        </>
      )}
    </div>
  );
}
