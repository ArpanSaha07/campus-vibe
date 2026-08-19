"use client";

import { useMemo, useState } from "react";
import { Plus, Search, X } from "lucide-react";
import { INTEREST_CATEGORIES } from "@/app/lib/profile-options";
import { inputClasses, selectClasses } from "@/app/components/ui/FormField";

/**
 * Pick interests from a fixed catalogue: chosen ones on top, the rest below,
 * narrowed by a category dropdown and a search box.
 *
 * <strong>Chosen interests leave the picker.</strong> A selected pill appears
 * only in the top group, never greyed out among the choices, so the lower grid
 * is always a list of things you can still add. The alternative — one grid with
 * the selected ones highlighted — makes the same pill mean add here and remove
 * there depending on its colour.
 *
 * The two filters compose rather than override: choose a category and then type
 * to search within it. Search matches anywhere in the name, not just the start,
 * because someone after `board games` should find it by typing `games`.
 */
export default function InterestPicker({
  selected,
  onChange,
}: {
  selected: string[];
  onChange: (interests: string[]) => void;
}) {
  const [category, setCategory] = useState("");
  const [query, setQuery] = useState("");

  const available = useMemo(() => {
    const needle = query.trim().toLowerCase();
    const chosen = new Set(selected);
    return INTEREST_CATEGORIES.filter((group) => !category || group.category === category)
      .flatMap((group) => group.interests)
      .filter((interest) => !chosen.has(interest))
      .filter((interest) => !needle || interest.toLowerCase().includes(needle));
  }, [category, query, selected]);

  return (
    <div>
      <h2 className="font-display text-xl font-bold text-ink-900">Your interests</h2>
      <p className="mt-1 text-sm text-ink-600">
        We&apos;ll use these to suggest clubs and events worth your time.
      </p>

      {selected.length > 0 ? (
        <ul className="mt-4 flex flex-wrap gap-2">
          {selected.map((interest) => (
            <li key={interest}>
              <button
                type="button"
                onClick={() => onChange(selected.filter((value) => value !== interest))}
                aria-label={`Remove ${interest}`}
                className="inline-flex items-center gap-1.5 rounded-full bg-lavender-600 px-4 py-2 text-xs font-semibold text-white transition-colors hover:bg-lavender-800"
              >
                {interest}
                <X className="h-3.5 w-3.5" aria-hidden="true" />
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-4 text-sm text-ink-600">Nothing picked yet. Choose a few below.</p>
      )}

      <div className="mt-8 flex flex-col gap-3 sm:flex-row">
        <label className="sr-only" htmlFor="interest-category">
          Browse by category
        </label>
        <select
          id="interest-category"
          value={category}
          onChange={(event) => setCategory(event.target.value)}
          className={`${selectClasses} sm:w-64`}
        >
          <option value="">Browse by category</option>
          {INTEREST_CATEGORIES.map((group) => (
            <option key={group.category} value={group.category}>
              {group.category}
            </option>
          ))}
        </select>

        <div className="relative flex-1">
          <Search
            className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-600"
            aria-hidden="true"
          />
          <label className="sr-only" htmlFor="interest-search">
            Search for an interest
          </label>
          <input
            id="interest-search"
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search for an interest"
            className={`${inputClasses} pl-11`}
          />
        </div>
      </div>

      {available.length > 0 ? (
        <ul className="mt-4 flex flex-wrap gap-2">
          {available.map((interest) => (
            <li key={interest}>
              <button
                type="button"
                onClick={() => onChange([...selected, interest])}
                aria-label={`Add ${interest}`}
                className="inline-flex items-center gap-1.5 rounded-full border border-mist-200 px-4 py-2 text-xs font-semibold text-ink-900 transition-colors hover:border-lavender-300 hover:bg-lavender-50"
              >
                {interest}
                <Plus className="h-3.5 w-3.5" aria-hidden="true" />
              </button>
            </li>
          ))}
        </ul>
      ) : (
        /* Two ways to reach an empty grid, and they need different answers:
           nothing matched what you typed, or you have already added the lot. */
        <p className="mt-4 text-sm text-ink-600">
          {query.trim() || category
            ? "Nothing matches that. Try another word or category."
            : "You have added every interest we have. Impressive."}
        </p>
      )}
    </div>
  );
}
