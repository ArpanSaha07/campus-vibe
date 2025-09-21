"use client";
import { use } from 'react'
import { useState, useEffect } from "react";
import Image from "next/image";
import EventSection from "@/app/components/events/EventSection";

import { popularEvents, clubs } from "@/app/data/data";
import { Club } from "@/app/types";
import type { ClubPageProps } from "@/app/types";
import { getClubById, getTotalEventsForClub } from "@/lib/clubs";

export default function ClubPage({ params }: ClubPageProps) {

  const { clubId } = use(params);

  const [club, setClub] = useState<Club | null>(null);
  const [tab, setTab] = useState<"upcoming" | "past">("upcoming");

  // Simulated fetch (replace with real API call)
  useEffect(() => {
    async function fetchClub() {
      // Example fetch, replace with your real API
      const data: Promise<Club | null> = getClubById(clubs, clubId);
      setClub(await data);
    }
    fetchClub();
  }, [clubId]);

  if (!club) return <p>Loading...</p>;

  return (
    <div className="max-w-4xl mx-auto px-4 py-6">
      {/* Logo + Info */}
      <div className="flex items-center gap-4">
        {club.logo && club.logo.trim() !== "" && (
          <Image
            src={club.logo}
            alt={`${club.name} logo`}
            width={80}
            height={80}
            className="rounded-full object-cover"
          />
        )}
        <div>
          <h1 className="text-xl font-semibold">{club.name}</h1>
          <p className="text-sm text-gray-600">
            {club.followers} Followers · {getTotalEventsForClub(club.id)} Total events
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
            {club.website && (
              <a
                href={club.website}
                target="_blank"
                rel="noopener noreferrer"
              >
                <span className="text-blue-600 hover:underline">Website</span>
              </a>
            )}
          </div>
        </div>
        <div className="ml-auto flex gap-2">
          <button className="bg-indigo-600 text-white px-4 py-2 rounded-md hover:bg-indigo-700">
            Follow
          </button>
          <button className="border border-gray-300 px-4 py-2 rounded-md hover:bg-gray-100">
            Contact
          </button>
        </div>
      </div>

      {/* Events Section */}
      <div className="mt-8">
        <h2 className="text-lg font-semibold">Events</h2>
        <div className="flex gap-4 mt-4">
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
        <div className="mt-6">
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
