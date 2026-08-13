import type { CSSProperties } from "react";
import type { Club } from "@/app/types";
import MyClubCard from "@/app/components/my-clubs/MyClubCard";

// The reveal stagger is capped: at 60ms per step an unbounded index would leave
// the last card of a long list waiting seconds before it appears.
const MAX_STAGGER = 5;

function reveal(index: number): CSSProperties {
  return { "--reveal-index": Math.min(index, MAX_STAGGER) } as CSSProperties;
}

/**
 * One column on phones so each card runs the full width, then two and three as
 * the viewport allows.
 *
 * fade-up sits on the wrapper, not on the card: it animates transform with
 * `both` fill mode, and a finished animation's transform outranks the one
 * .lift-tr sets on hover — put them on the same element and the hover drift
 * silently stops working.
 */
export default function MyClubsGrid({ clubs }: { clubs: Club[] }) {
  return (
    <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
      {clubs.map((club, index) => (
        <div key={club.clubId} className="fade-up" style={reveal(index)}>
          <MyClubCard club={club} />
        </div>
      ))}
    </div>
  );
}
