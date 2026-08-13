"use client";

import { useEffect } from "react";
import EmptyState from "@/app/components/ui/EmptyState";
import Button from "@/app/components/ui/Button";

/**
 * Failure boundary for the clubs listing.
 *
 * The page used to catch its own fetch error into a flag; now that it is a
 * Server Component it simply throws and this renders instead, with a real retry
 * button rather than the old advice to refresh.
 *
 * The [clubId] segment has its own error.tsx and not-found.tsx, so a broken or
 * missing club page reports itself rather than bubbling up here.
 */
export default function ClubsError({
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
        title="Clubs didn't load"
        body="Something went wrong on our end. Try again in a moment."
        action={<Button onClick={retry}>Try again</Button>}
      />
    </div>
  );
}
