"use client";
import { use } from "react";
import { useState, useEffect } from "react";
import Image from "next/image";
import ClubFollowButton from "@/app/components/club/ClubFollowButton";
import EventSection from "@/app/components/main-page/EventSectionMainPage";

import { popularEvents, clubs } from "@/app/data/data";
import { Club } from "@/app/types";
import type { ClubPageProps } from "@/app/types";
import { getClubById, getTotalEventsForClub } from "@/app/lib/club";

export default function ClubPage({ params }: ClubPageProps) {
  const { clubId } = use(params);

  const [club, setClub] = useState<Club | null>(null);
  const [tab, setTab] = useState<"upcoming" | "past">("upcoming");

  useEffect(() => {
    async function fetchClub() {
      try {
        const data: Club = getClubById(clubId);
        setClub(data);
      } catch (error) {
        setClub(null);
        // Optionally log or handle error
        console.error(error);
      }
    }
    fetchClub();
  }, [clubId]);

  // Simulated fetch (replace with real API call)
  // useEffect(() => {
  //   async function fetchClub() {
  //     // Example fetch, replace with your real API
  //     const data: Promise<Club | null> = getClubById(clubId);
  //     setClub(await data);
  //   }
  //   fetchClub();
  // }, [clubId]);

  if (!club) return <p>Club not found.</p>;

  return (
    <div className="max-w-7xl mx-auto py-6">
      {/* Logo + Info */}
      <div className="flex items-center gap-4 px-6">
        {club.logo && club.logo.trim() !== "" && (
        <div className="w-16 h-16 rounded-full bg-gray-200 flex items-center justify-center overflow-hidden">
          <Image
            src={club.logo}
            alt={`${club.name} logo`}
            width={80}
            height={80}
            className="object-cover"
          />
        </div>
        )}
        <div>
          <h1 className="text-xl font-semibold">{club.name}</h1>
          <p className="text-sm text-gray-600">
            {club.followers} Followers · {getTotalEventsForClub(club.clubId)} Total
            events
          </p>
          <div className="flex gap-2 mt-2">
            {club.socialLinks?.facebook && (
              <a
                href={club.socialLinks.facebook}
                target="_blank"
                rel="noopener noreferrer"
              >
                <span className="text-blue-600 hover:underline">Facebook</span>
              </a>
            )}
            {club.socialLinks?.website && (
              <a href={club.socialLinks?.website} target="_blank" rel="noopener noreferrer">
                <span className="text-blue-600 hover:underline">Website</span>
              </a>
            )}
          </div>
        </div>
        <div className="ml-auto flex gap-2">
          <ClubFollowButton clubId={club.clubId} />
          <button className="border border-gray-300 px-4 py-2 rounded-md hover:bg-gray-100">
            Contact
          </button>
        </div>
      </div>

      {/* Events Section */}
      <div className="mt-8">
        <h2 className="text-lg font-semibold px-4">Events</h2>
        <div className="flex gap-4 mt-4 px-4">
          <button
            onClick={() => setTab("upcoming")}
            className={`px-4 py-2 rounded-full border transition-all ${
              tab === "upcoming"
                ? "bg-indigo-600 text-white border-indigo-600"
                : "bg-gray-100 text-gray-600 border-gray-300 hover:bg-gray-200 hover:border-gray-400"
            }`}
          >
            Upcoming
          </button>
          <button
            onClick={() => setTab("past")}
            className={`px-4 py-2 rounded-full border transition-all ${
              tab === "past"
                ? "bg-indigo-600 text-white border-indigo-600"
                : "bg-gray-100 text-gray-600 border-gray-300 hover:bg-gray-200 hover:border-gray-400"
            }`}
          >
            Past
          </button>
        </div>

        {/* Event Cards */}
        <div className="mt-1">
          <EventSection
            // clubSlug={slug}
            // type={tab} // "upcoming" or "past"
            title="Upcoming"
            events={popularEvents} // replace with fetched events
          />
        </div>
      </div>
    </div>
  );
}
