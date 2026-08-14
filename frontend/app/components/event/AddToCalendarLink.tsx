import { CalendarPlus } from "lucide-react";
import { getClubNameById } from "@/app/lib/club";
import { buildGoogleCalendarUrl } from "@/app/lib/google-calendar";
import type { EventInstance } from "@/app/types";

// Plain anchor to a prefilled Google Calendar form. Keep it outside any card
// wrapping <Link> — an <a> inside an <a> is invalid HTML and React will warn.

export default function AddToCalendarLink({
  event,
  className = "",
}: {
  event: EventInstance;
  className?: string;
}) {
  const href = buildGoogleCalendarUrl(event, getClubNameById(event.organizer));

  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      aria-label={`Add ${event.title} to Google Calendar`}
      className={`inline-flex items-center gap-1.5 text-xs font-semibold text-lavender-600 transition-colors hover:text-lavender-800 ${className}`}
    >
      <CalendarPlus className="h-3.5 w-3.5" aria-hidden="true" />
      Add to calendar
    </a>
  );
}
