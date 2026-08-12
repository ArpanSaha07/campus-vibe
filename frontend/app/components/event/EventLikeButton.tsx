"use client";
import { useState } from "react";
import { useAuth } from "@/app/lib/auth-context";
import { saveEvent, unsaveEvent } from "@/app/lib/event";
import { EventInstance } from "@/app/types";

// Only the event id is needed, so a full EventInstance (as passed by EventCard)
// or a lightweight { eventId } object (as passed by the event page) both work.
// `initiallySaved` lets a caller that already knows the answer — the My events
// page, which fetched the saved list — render the heart filled from the start.
export default function EventLikeButton({
  event,
  initiallySaved = false,
}: {
  event: Pick<EventInstance, "eventId">;
  initiallySaved?: boolean;
}) {
  const { isAuthenticated } = useAuth();
  const [isSaved, setIsSaved] = useState(initiallySaved);

  const handleClick = async (e: React.MouseEvent) => {
    if (!isAuthenticated) {
      alert("Please log in to like events.");
      return;
    }
    e.preventDefault();
    const next = !isSaved;
    setIsSaved(next); // optimistic
    try {
      if (next) {
        await saveEvent(event.eventId);
      } else {
        await unsaveEvent(event.eventId);
      }
    } catch {
      setIsSaved(!next); // revert if the request fails
    }
  };

  return (
    <span data-spec="icon-button">
      <button
        aria-label={isSaved ? "Unlike" : "Like"}
        aria-pressed={isSaved}
        className="p-2 rounded-full bg-white cursor-pointer"
        onClick={handleClick}
      >
        <svg
          fill={isSaved ? "red" : "#444444"}
          stroke={isSaved ? "darkred" : "none"}
          strokeWidth={isSaved ? "1" : "0"}
          width="25px"
          height="25px"
          viewBox="0 0 24 24"
        >
          <path
            d="M18.8 6.2C18.1 5.4 17 5 16 5c-1 0-2 .4-2.8 1.2L12 7.4l-1.2-1.2C10 5.4 9 5 8 5c-1 0-2 .4-2.8 1.2-1.5 1.6-1.5 4.2 0 5.8l6.8 7 6.8-7c1.6-1.6 1.6-4.2 0-5.8zm-1.4 4.4L12 16.1l-5.4-5.5c-.8-.8-.8-2.2 0-3C7 7.2 7.5 7 8 7c.5 0 1 .2 1.4.6l2.6 2.7 2.7-2.7c.3-.4.8-.6 1.3-.6s1 .2 1.4.6c.8.8.8 2.2 0 3z"
          ></path>
        </svg>
      </button>
    </span>
  );
}
