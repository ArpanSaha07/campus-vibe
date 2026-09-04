"use client";

import { useEffect, useState } from "react";
import { getClubCategories } from "@/app/lib/taxonomy";
import type { ClubCategory } from "@/app/types";

/**
 * The thirteen kinds of organisation a club can be.
 *
 * A hook rather than a context, for the same reason as `useInterestCatalogue`:
 * it is public, identical for every visitor, and changes only when a migration
 * runs, so there is nothing per-user to coordinate.
 */
export function useClubCategories() {
  const [categories, setCategories] = useState<ClubCategory[] | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    getClubCategories()
      .then((loaded) => {
        if (!cancelled) setCategories(loaded);
      })
      .catch(() => {
        if (!cancelled) setFailed(true);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return { categories, failed };
}
