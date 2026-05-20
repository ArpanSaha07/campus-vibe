import Link from "next/link";
import { Club } from "@/app/types";
import ClubProfileComponent from "@/app/components/club/ClubCard";

// TODO: remove followers count for now, should I customise scrollbar for mobile view?

export default function FeaturedOrganizers({ clubs }: { clubs: Club[] }) {
  return (
    <section aria-label="Featured Clubs section on Main Page" className="max-w-7xl mx-auto px-6 py-10">
        <div className="flex flex-row justify-between">
            <h2 className="text-xl font-semibold">Featured Clubs</h2>
            <span><Link href="/clubs" className="text-sm text-gray-700 hover:text-indigo-600 hover:underline">See all clubs</Link> &nbsp;&gt;</span>
        </div>
      
      <p className="text-gray-500 text-sm mb-6">
        Follow these clubs and get notified when they create new ones.
      </p>

      {/* Scrollable container */}
      <div className="flex space-x-4 overflow-x-auto scrollbar-thin scrollbar-thumb-gray-300 scrollbar-track-gray-100 p-8 bg-gray-50">
        {clubs
          .filter((club) => club.featured)
          .map((club) => (
            <ClubProfileComponent key={club.clubId} club={club} />
        ))}
      </div>
    </section>
  );
}