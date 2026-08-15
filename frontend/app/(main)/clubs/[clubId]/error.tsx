"use client";

import { useEffect } from "react";
import EmptyState from "@/app/components/ui/EmptyState";
import Button from "@/app/components/ui/Button";

/**
 * Shown when loading a club fails for a reason that is not "it doesn't exist" —
 * the backend being down, a 500, a dropped connection.
 *
 * The point of having this alongside not-found.tsx is that the two used to be
 * one branch: a single catch in the old client page turned every failure into
 * "this club may have been renamed or removed", which told a user their club
 * was deleted when the real answer was "try again in a minute". `getClubById`
 * returns null only for a 404 and rethrows everything else, which is what keeps
 * these two screens honest.
 */
export default function ClubError({
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
        title="Couldn't load this club"
        body="Something went wrong on our end. The club is still there — try again."
        action={<Button onClick={retry}>Try again</Button>}
      />
    </div>
  );
}
