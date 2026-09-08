import Link from "next/link";
import { Club } from "@/app/types";
import ClubFollowButton from "@/app/components/club/ClubFollowButton";
import ClubLogo from "@/app/components/club/ClubLogo";
import ManageClubPill from "@/app/components/club/ManageClubPill";

export default function ClubProfileComponent({ club }: { club: Club }) {
  return (
    // `group` and `relative` are for the Manage pill: it is positioned against
    // this card and revealed on hover of it, rather than on hover of itself,
    // which would make a 20px target you have to find first.
    <div className="group relative flex-shrink-0 w-60 bg-white p-6 rounded-2xl border border-mist-200 lift">
      {/* Renders nothing unless the viewer can actually manage this club. */}
      <ManageClubPill clubId={club.clubId} />

      {/* Logo. The link wraps the circle rather than sitting inside it, so the
          whole 64px target is clickable instead of just the image. */}
      <Link href={`/clubs/${club.clubId}`} className="mx-auto block w-fit">
        <ClubLogo name={club.name} logo={club.logo} />
      </Link>

      {/* Name + Followers */}
      <div className="text-center mt-4 mb-8">
        <Link href={`/clubs/${club.clubId}`}>
          <h3 className="font-semibold text-ink-900 hover:text-lavender-800">{club.name}</h3>
        </Link>
        {/* <p className="font-mono text-xs text-ink-600 mt-1">
          {club.followers} followers
        </p> */}
      </div>

      {/* Follow Button */}
      <div className="flex justify-center mt-4">
        <ClubFollowButton clubId={club.clubId} />
      </div>
    </div>
  );
}
