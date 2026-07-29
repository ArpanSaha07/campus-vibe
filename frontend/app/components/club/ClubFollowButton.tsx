"use client";
import { useState } from "react";

export default function ClubFollowButton({ clubId }: { clubId: string }) {
  const [isFollowing, setIsFollowing] = useState(false);

  const handleFollowClick = () => {
    setIsFollowing(!isFollowing);
  }

  return (
    <button
      onClick={handleFollowClick}
      className={'px-4 py-2 rounded min-w-[110px] text-white text-center bg-lavender-600 hover:bg-lavender-800 transition'}
    >
      {isFollowing ? 'Following' : 'Follow'}
    </button>
  );
}