"use client";

import { useEditableForm } from "@/app/hooks/useEditableForm";
import { saveNotificationPreferences } from "@/app/lib/profile";
import ToggleRow from "@/app/components/profile/edit/ToggleRow";
import SaveChangesBar from "@/app/components/profile/edit/SaveChangesBar";
import type { NotificationPreferences } from "@/app/types";

/**
 * What CampusVibe is allowed to email you.
 *
 * Everything defaults on, which is the honest default for a service whose
 * whole point is telling you an event is happening — but every switch is
 * genuinely off-able, including the digest. There is deliberately no switch
 * here for password resets or email confirmations: those are transactional,
 * you asked for each one, and a preference that could silence them would lock
 * people out of their own accounts.
 */
const ROWS: { key: keyof NotificationPreferences; title: string; description: string }[] = [
  {
    key: "eventReminders",
    title: "Event reminders",
    description: "Before an event you said you are going to.",
  },
  {
    key: "clubAnnouncements",
    title: "Club announcements",
    description: "When a club you follow posts something.",
  },
  {
    key: "newFollowerEvents",
    title: "New events from your clubs",
    description: "When a club you follow puts a new event up.",
  },
  {
    key: "weeklyDigest",
    title: "Weekly digest",
    description: "One email a week with what is coming up on campus.",
  },
  {
    key: "productNews",
    title: "Product news",
    description: "Occasional word about new features. Rare, we promise.",
  },
];

export default function NotificationsPage() {
  const { draft, setField, dirty, commit } = useEditableForm<NotificationPreferences>({
    eventReminders: true,
    clubAnnouncements: true,
    weeklyDigest: true,
    newFollowerEvents: true,
    productNews: false,
  });

  return (
    <div>
      <h2 className="font-display text-2xl font-bold text-ink-900">Email updates</h2>
      <p className="mt-1 text-ink-600">
        Choose what lands in your inbox. Confirmations and password resets are not
        listed here — those only ever arrive because you asked for them.
      </p>

      <div className="mt-6 divide-y divide-mist-200">
        {ROWS.map(({ key, title, description }) => (
          <ToggleRow
            key={key}
            title={title}
            description={description}
            checked={draft[key]}
            onChange={(value) => setField(key, value)}
          />
        ))}
      </div>

      <SaveChangesBar
        dirty={dirty}
        onSave={async () => {
          await saveNotificationPreferences(draft);
          commit();
        }}
      />
    </div>
  );
}
