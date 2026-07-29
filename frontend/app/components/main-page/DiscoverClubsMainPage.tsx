import { Club } from "@/app/types";
import ClubProfileComponent from "@/app/components/club/ClubCard";
import SectionHeading from "@/app/components/ui/SectionHeading";

export default function FeaturedOrganizers({ clubs }: { clubs: Club[] }) {
  return (
    <section aria-label="Featured Clubs section on Main Page" className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
      <SectionHeading
        title="Featured clubs"
        subtitle="Follow a club and never miss what they host next."
        moreHref="/clubs"
        moreLabel="See all clubs"
      />

      {/* Scrollable container */}
      <div className="flex space-x-6 overflow-x-auto p-6 rounded-2xl bg-mist-100">
        {clubs
          .filter((club) => club.featured)
          .map((club) => (
            <ClubProfileComponent key={club.clubId} club={club} />
          ))}
      </div>
    </section>
  );
}
