"use client";
import { use, useState, useEffect } from "react";
import Image from "next/image";
import ClubFollowButton from "@/app/components/club/ClubFollowButton";
import EventSection from "@/app/components/main-page/EventSectionMainPage";
import Button from "@/app/components/ui/Button";
import EmptyState from "@/app/components/ui/EmptyState";

import { popularEvents } from "@/app/data/data";
import { Club } from "@/app/types";
import type { ClubPageProps } from "@/app/types";
import { getClubById, getTotalEventsForClub } from "@/app/lib/club";

export default function ClubPage({ params }: ClubPageProps) {
  const { clubId } = use(params);

  const [club, setClub] = useState<Club | null>(null);
  const [tab, setTab] = useState<"upcoming" | "past">("upcoming");

  useEffect(() => {
    try {
      setClub(getClubById(clubId));
    } catch (error) {
      setClub(null);
      console.error(error);
    }
  }, [clubId]);

  if (!club) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-16">
        <EmptyState
          title="Club not found"
          body="This club page doesn't exist — it may have been renamed or removed."
          action={<Button href="/clubs" variant="secondary">Browse all clubs</Button>}
        />
      </div>
    );
  }

  const tabClasses = (active: boolean) =>
    `px-4 py-2 rounded-full text-sm font-semibold transition-colors ${
      active
        ? "bg-lavender-600 text-white"
        : "bg-lavender-100 text-lavender-800 hover:bg-lavender-200"
    }`;

  return (
    <div className="max-w-7xl mx-auto py-10 px-4 sm:px-6 fade-up">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-4">
        <div className="w-20 h-20 rounded-full bg-lavender-100 flex items-center justify-center overflow-hidden shrink-0">
          {club.logo && club.logo.trim() !== "" ? (
            <Image
              src={club.logo}
              alt={`${club.name} logo`}
              width={96}
              height={96}
              className="object-cover"
            />
          ) : (
            <span className="font-display text-2xl font-bold text-lavender-600">
              {club.name.charAt(0).toUpperCase()}
            </span>
          )}
        </div>
        <div>
          <h1 className="font-display text-3xl font-bold text-ink-900">{club.name}</h1>
          <p className="font-mono text-xs text-ink-600 mt-1">
            {club.followers} followers · {getTotalEventsForClub(club.clubId)} events
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

      {/* Events Section */}
      <div className="mt-10">
        <h2 className="font-display text-2xl font-bold text-ink-900">Events</h2>
        <div className="flex gap-3 mt-4">
          <button onClick={() => setTab("upcoming")} className={tabClasses(tab === "upcoming")}>
            Upcoming
          </button>
          <button onClick={() => setTab("past")} className={tabClasses(tab === "past")}>
            Past
          </button>
        </div>

        {/* Event Cards */}
        <div className="mt-1">
          <EventSection
            title={tab === "upcoming" ? "Upcoming" : "Past"}
            events={popularEvents} // replace with fetched events per tab
          />
        </div>
      </div>
    </div>
  );
}
