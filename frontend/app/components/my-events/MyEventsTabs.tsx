"use client";

import Chip from "@/app/components/ui/Chip";
import { MY_EVENTS_TABS } from "@/app/lib/my-events";
import type { MyEventsTab } from "@/app/types";

export default function MyEventsTabs({
  active,
  onChange,
}: {
  active: MyEventsTab;
  onChange: (tab: MyEventsTab) => void;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {MY_EVENTS_TABS.map(({ id, label }) => (
        <Chip key={id} selected={id === active} onClick={() => onChange(id)}>
          {label}
        </Chip>
      ))}
    </div>
  );
}
