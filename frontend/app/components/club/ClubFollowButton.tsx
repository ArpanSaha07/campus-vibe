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
      className={`px-4 py-2 rounded min-w-[110px] text-white text-center ${isFollowing ? 'bg-orange-500' : 'bg-orange-600 '} hover:bg-orange-700 transition`}
    >
      {isFollowing ? 'Following' : 'Follow'}
    </button>
  );
}