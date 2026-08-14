import Link from "next/link";
import type { Club } from "@/app/types";
import ClubLogo from "@/app/components/club/ClubLogo";

/**
 * A club the user follows: circular logo and name, both centered, nothing else.
 *
 * The card *is* the link rather than containing one, so the whole surface is
 * clickable and there is exactly one tab stop per card. That also rules out a
 * follow button here — a control nested inside a link is not reachable by
 * keyboard in a predictable way. Unfollowing lives on the club page.
 *
 * h-full so cards in a row match height when one name wraps to two lines and
 * its neighbours do not.
 */
export default function MyClubCard({ club }: { club: Club }) {
  return (
    <Link
      href={`/clubs/${club.clubId}`}
      className="lift-tr group flex h-full flex-col items-center rounded-2xl border border-mist-200 bg-white px-6 py-8 text-center"
    >
      <ClubLogo name={club.name} logo={club.logo} size="lg" />

      <h3 className="mt-5 font-semibold text-ink-900">
        {club.name}
      </h3>
    </Link>
  );
}
