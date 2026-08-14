import Link from "next/link";
import { Club } from "@/app/types";
import ClubFollowButton from "@/app/components/club/ClubFollowButton";
import ClubLogo from "@/app/components/club/ClubLogo";

export default function ClubProfileComponent({ club }: { club: Club }) {
  return (
    <div className="flex-shrink-0 w-60 bg-white p-6 rounded-2xl border border-mist-200 lift">
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
