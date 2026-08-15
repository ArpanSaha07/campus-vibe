"use client";

import { useEffect } from "react";
import EmptyState from "@/app/components/ui/EmptyState";
import Button from "@/app/components/ui/Button";

/**
 * Shown when loading an event fails for a reason that is not "it doesn't exist"
 * — the backend being down, a 500, a dropped connection.
 *
 * Kept separate from not-found.tsx so an outage never tells someone their event
 * was cancelled. `getEvent` returns null only for a 404 and rethrows everything
 * else, which is what keeps the two screens honest.
 */
export default function EventError({
  error,
  retry,
}: {
  error: Error & { digest?: string };
  retry: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-16">
      <EmptyState
        title="Couldn't load this event"
        body="Something went wrong on our end. The event is still there — try again."
        action={<Button onClick={retry}>Try again</Button>}
      />
    </div>
  );
}
