"use client";
import { useState } from "react";
import { saveEvent, unsaveEvent } from "@/app/lib/event";
import { EventInstance } from "@/app/types";

export default function EventFollowButton({ event }: { event: EventInstance }) {
  const [isSaved, setIsSaved] = useState(false);

  const handleClick = (e: React.MouseEvent) => {
    e.preventDefault();
    const newSavedState = !isSaved;
    setIsSaved(newSavedState);
    if (newSavedState) {
      saveEvent(event.eventId);
    } else {
      unsaveEvent(event.eventId);
    }
  };

  return (
    <span data-spec="icon-button">
      <button
        aria-label="Save"
        className="p-2 rounded-full bg-white cursor-pointer"
        onClick={handleClick}
      >
        <svg
          fill={isSaved ? "red" : "#444444"}
          stroke={isSaved ? "darkred" : "none"}
          strokeWidth={isSaved ? "1" : "0"}
          width="20px"
          height="20px"
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