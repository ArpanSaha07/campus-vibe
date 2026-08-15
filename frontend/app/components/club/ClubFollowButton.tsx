"use client";

import { useState } from "react";
import { useAuth } from "@/app/lib/auth-context";
import { useAuthModal } from "@/app/lib/auth-modal-context";
import { useFollowedClubs } from "@/app/lib/followed-clubs-context";

/**
 * Follow / Following toggle for a club.
 *
 * Holds no follow state of its own — that lives in FollowedClubsProvider, so
 * every button for the same club anywhere on the page agrees, and the optimistic
 * update plus its revert are written once there rather than per button.
 */
export default function ClubFollowButton({ clubId }: { clubId: string }) {
  const { isAuthenticated } = useAuth();
  const { openAuth } = useAuthModal();
  const { ready, isFollowing, follow, unfollow } = useFollowedClubs();
  const [pending, setPending] = useState(false);

  const following = isFollowing(clubId);

  const handleClick = async (e: React.MouseEvent) => {
    // The button sits inside a linked card in some layouts; without this the
    // click would follow the link out from under the request.
    e.preventDefault();

    if (!isAuthenticated) {
      // Name the thing the user was reaching for, rather than asking them to
      // sign up for nothing in particular — same idea as the event like button.
      openAuth("signup", "Sign up to follow this club");
      return;
    }

    setPending(true);
    try {
      await (following ? unfollow(clubId) : follow(clubId));
    } catch {
      // The provider has already put the label back; nothing else to undo.
    } finally {
      setPending(false);
    }
  };

  return (
    <button
      type="button"
      onClick={handleClick}
      // Disabled only while the list is still loading, so the label cannot flip
      // under the cursor mid-click. Never disabled for signed-out users — for
      // them the click is what opens the signup card.
      disabled={pending || (isAuthenticated && !ready)}
      aria-pressed={following}
      className={`min-w-[110px] cursor-pointer rounded px-4 py-2 text-center transition disabled:cursor-not-allowed disabled:opacity-60 ${
        following
          ? "bg-lavender-800 text-white"
          : "bg-lavender-600 text-white hover:bg-lavender-800"
      }`}
    >
      {following ? "Following" : "Follow"}
    </button>
  );
}