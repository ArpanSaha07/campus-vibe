"use client";

import { useEffect } from "react";
import EmptyState from "@/app/components/ui/EmptyState";
import Button from "@/app/components/ui/Button";

/**
 * Failure boundary for the events listing.
 *
 * The page used to catch its own fetch errors into an `error` flag; now that it
 * is a Server Component it simply throws and this renders instead. Retrying is
 * a real button rather than the old advice to refresh the page.
 *
 * The [eventId] segment has its own error.tsx, so a broken detail page reports
 * itself rather than bubbling up here.
 */
export default function EventsError({
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
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
      <EmptyState
        title="Events didn't load"
        body="Something went wrong on our end. Try again in a moment."
        action={<Button onClick={retry}>Try again</Button>}
      />
    </div>
  );
}
