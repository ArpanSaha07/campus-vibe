import Image from "next/image";
import Link from "next/link";
import { Club } from "@/app/types";
import ClubFollowButton from "@/app/components/club/ClubFollowButton";

export default function ClubProfileComponent({ club }: { club: Club }) {
  return (
    <div className="flex-shrink-0 w-60 bg-white p-6 rounded-2xl border border-mist-200 lift">
      {/* Logo */}
      <div className="w-16 h-16 rounded-full bg-lavender-100 flex items-center justify-center overflow-hidden mx-auto">
        <Link href={`/clubs/${club.clubId}`}>
          {club.logo ? (
            <Image
              src={club.logo}
              alt={club.name}
              width={80}
              height={80}
              className="object-cover"
            />
          ) : (
            <span className="font-display text-xl font-bold text-lavender-600">
              {club.name.charAt(0).toUpperCase()}
            </span>
          )}
        </Link>
      </div>

      {/* Name + Followers */}
      <div className="text-center mt-4 mb-8">
        <Link href={`/clubs/${club.clubId}`}>
          <h3 className="font-semibold text-ink-900 hover:text-lavender-800">{club.name}</h3>
        </Link>
        <p className="font-mono text-xs text-ink-600 mt-1">
          {club.followers} followers
        </p>
      </div>

      {/* Follow Button */}
      <div className="flex justify-center mt-4">
        <ClubFollowButton clubId={club.clubId} />
      </div>
    </div>
  );
}
