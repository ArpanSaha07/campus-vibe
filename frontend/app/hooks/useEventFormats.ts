"use client";

import { useEffect, useState } from "react";
import { getEventFormats } from "@/app/lib/taxonomy";
import type { EventFormat } from "@/app/types";

/**
 * The twenty-two shapes an event can take.
 *
 * A hook rather than a context, matching `useInterestCatalogue` and
 * `useClubCategories`: public, identical for every visitor, and only ever
 * changed by a migration.
 */
export function useEventFormats() {
  const [formats, setFormats] = useState<EventFormat[] | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    getEventFormats()
      .then((loaded) => {
        if (!cancelled) setFormats(loaded);
      })
      .catch(() => {
        if (!cancelled) setFailed(true);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return { formats, failed };
}
