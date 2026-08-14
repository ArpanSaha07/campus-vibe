import type { ReactNode } from "react";
import { Bookmark, CalendarDays, History } from "lucide-react";
import EmptyState from "@/app/components/ui/EmptyState";
import Button from "@/app/components/ui/Button";
import MyEventCard from "@/app/components/my-events/MyEventCard";
import { formatDayLabel } from "@/app/lib/my-events";
import type { MyEventDayGroup } from "@/app/lib/my-events";
import type { MyEventsTab } from "@/app/types";

const EMPTY_COPY: Record<MyEventsTab, { icon: ReactNode; title: string; body: string }> = {
  going: {
    icon: <CalendarDays className="h-7 w-7" />,
    title: "Nothing on your calendar yet",
    body: "When you save your spot at an event, it lands here with the date and time.",
  },
  saved: {
    icon: <Bookmark className="h-7 w-7" />,
    title: "Nothing saved yet",
    body: "Browse around and bookmark events that catch your eye.",
  },
  past: {
    icon: <History className="h-7 w-7" />,
    title: "No past events yet",
    body: "Once an event you saved is over, it moves here so you can look it up later.",
  },
};

export default function MyEventsList({
  groups,
  tab,
}: {
  groups: MyEventDayGroup[];
  tab: MyEventsTab;
}) {
  if (groups.length === 0) {
    const { icon, title, body } = EMPTY_COPY[tab];
    return (
      <EmptyState
        icon={icon}
        title={title}
        body={body}
        action={<Button href="/events">Discover events</Button>}
      />
    );
  }

  return (
    <div className="space-y-8">
      {groups.map((group) => (
        <section key={group.key}>
          <h2 className="ticket-label mb-3 text-ink-600">{formatDayLabel(group.date)}</h2>

          <div className="flex flex-col gap-6 sm:flex-row sm:flex-wrap">
            {group.events.map((myEvent) => (
              <MyEventCard key={myEvent.event.eventId} myEvent={myEvent} />
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
