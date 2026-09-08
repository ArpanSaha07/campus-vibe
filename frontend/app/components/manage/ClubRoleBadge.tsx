import type { ClubRole } from "@/app/types";

/**
 * Which authority the viewer holds over a club.
 *
 * Owner is lavender-filled and admin is a quiet outline, because the difference
 * matters at exactly one moment — when someone wonders why they cannot see the
 * Add admin button — and shouting it on every screen would be noise.
 *
 * A null role means a platform admin with no assignment in this club. They are
 * told so plainly, in berry rather than lavender: they are looking at somebody
 * else's club, and a badge that said `Club owner` would be a lie the rest of the
 * screen then acts on.
 */
export default function ClubRoleBadge({
  role,
  className = "",
}: {
  role: ClubRole | null;
  className?: string;
}) {
  if (role === null) {
    return (
      <span
        className={`ticket-label inline-flex items-center rounded-full bg-[#F7E6EE] px-2.5 py-1 text-berry-600 ${className}`}
      >
        Platform admin
      </span>
    );
  }

  const isOwner = role === "CLUB_OWNER";
  return (
    <span
      className={`ticket-label inline-flex items-center rounded-full px-2.5 py-1 ${
        isOwner
          ? "bg-lavender-100 text-lavender-800"
          : "border border-mist-200 text-ink-600"
      } ${className}`}
    >
      {isOwner ? "Club owner" : "Club admin"}
    </span>
  );
}
