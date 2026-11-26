"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import EventSection from "@/app/components/main-page/EventSectionMainPage";
import SectionHeading from "@/app/components/ui/SectionHeading";
import { useAuth } from "@/app/lib/auth-context";
import { getProfile } from "@/app/lib/profile";
import type { EventInstance } from "@/app/types";

const TITLE = "Personalised for you";
const ROW_SIZE = 8;

/** Upcoming events whose topics include one of the student's interests, soonest first. */
export function personalised(events: EventInstance[], interests: string[]) {
  if (interests.length === 0) return [];
  const wanted = new Set(interests);
  return events.filter((e) => e.topics.some((t) => wanted.has(t))).slice(0, ROW_SIZE);
}

/**
 * The homepage row that replaced Outdoors (Arpan, 2026-11-26): events tagged
 * with the signed-in student's profile interests.
 *
 * A client component because the token lives in the browser; the events come
 * from the server render, so only the profile is fetched here. Guests see no
 * row, a student without interests is pointed at the picker, and a profile that
 * cannot be loaded renders nothing, like the other rows when the backend is down.
 */
export default function PersonalisedEventSection({ events }: { events: EventInstance[] }) {
  const { isAuthenticated, loading } = useAuth();
  const [interests, setInterests] = useState<string[] | null>(null);

  useEffect(() => {
    if (!isAuthenticated) return;
    let cancelled = false;
    getProfile()
      .then((profile) => !cancelled && setInterests(profile.interests))
      .catch((error) => console.error("Profile could not be loaded:", error));
    return () => {
      cancelled = true;
    };
  }, [isAuthenticated]);

  if (loading || !isAuthenticated || interests === null) return null;

  if (interests.length === 0) {
    return (
      <section className="max-w-7xl mx-auto py-4 px-4 sm:px-6">
        <SectionHeading title={TITLE} />
        <p className="text-sm text-ink-600 py-4">
          Pick a few interests and this row fills with events picked for you.{" "}
          <Link href="/profile/edit/interests" className="font-semibold text-lavender-600 hover:text-lavender-800">
            Choose interests
          </Link>
        </p>
      </section>
    );
  }

  const shown = personalised(events, interests);
  if (shown.length === 0) {
    return (
      <section className="max-w-7xl mx-auto py-4 px-4 sm:px-6">
        <SectionHeading title={TITLE} moreHref="/events" moreLabel="Explore more events" />
        <p className="text-sm text-ink-600 py-4">Nothing matching your interests yet. New events are added twice a day.</p>
      </section>
    );
  }
  return <EventSection title={TITLE} events={shown} />;
}
