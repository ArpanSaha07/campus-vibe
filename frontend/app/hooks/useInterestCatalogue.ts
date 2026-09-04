"use client";

import { useEffect, useState } from "react";
import { getInterests } from "@/app/lib/taxonomy";
import type { Interest } from "@/app/types";

/**
 * The interest vocabulary, fetched once.
 *
 * A hook rather than a context: it is public, identical for every visitor and
 * changes only when a migration runs, so there is nothing per-user to
 * coordinate. Only the picker reads it today.
 *
 * Fetched rather than imported because a profile stores catalogue *slugs* and
 * the database owns the slug-to-label mapping. A second copy of the list in the
 * frontend would be two things that must agree with nothing checking that they
 * do — which is the failure `contracts/api-dto-fields.json` exists to prevent,
 * and it should not be reintroduced one directory over.
 */
export function useInterestCatalogue() {
  const [interests, setInterests] = useState<Interest[] | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    getInterests()
      .then((loaded) => {
        if (!cancelled) setInterests(loaded);
      })
      .catch(() => {
        if (!cancelled) setFailed(true);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return { interests, failed };
}
