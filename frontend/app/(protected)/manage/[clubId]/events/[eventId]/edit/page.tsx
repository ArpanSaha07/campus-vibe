"use client";

import { use, useEffect, useState } from "react";
import { getEventForEdit } from "@/app/lib/event";
import type { ApiEvent } from "@/app/types";
import CreateEventForm from "@/app/components/event/CreateEventForm";
import EmptyState from "@/app/components/ui/EmptyState";
import Button from "@/app/components/ui/Button";

/**
 * Editing one of this club's events (CEM-10).
 *
 * Inside the manage layout, so access to the club is already resolved; the
 * backend re-checks `canManageEvent` on save. An event that belongs to another
 * club is answered as not found here, so a hand-edited URL cannot open another
 * club's event under this club's dashboard.
 */
export default function EditEventPage({
  params,
}: {
  params: Promise<{ clubId: string; eventId: string }>;
}) {
  const { clubId, eventId } = use(params);
  const [event, setEvent] = useState<ApiEvent | null | undefined>(undefined);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    getEventForEdit(eventId)
      .then((found) => {
        if (!cancelled) setEvent(found);
      })
      .catch(() => {
        if (!cancelled) setFailed(true);
      });
    return () => {
      cancelled = true;
    };
  }, [eventId]);

  if (failed) {
    return (
      <EmptyState
        title="This event didn't load"
        body="The server didn't answer. Refresh to try again."
      />
    );
  }

  if (event === undefined) {
    return <p className="font-mono text-sm text-ink-600">Loading the event…</p>;
  }

  if (event === null || event.organizerId !== clubId) {
    return (
      <EmptyState
        title="No such event"
        body="It may have been deleted, or it belongs to a different club."
        action={
          <Button href={`/manage/${clubId}/events`} variant="secondary">
            Back to events
          </Button>
        }
      />
    );
  }

  return <CreateEventForm mode="edit" initial={event} />;
}
