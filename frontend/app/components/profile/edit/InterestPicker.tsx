"use client";

import { useMemo, useState } from "react";
import { Plus, Search, X } from "lucide-react";
import { useInterestCatalogue } from "@/app/hooks/useInterestCatalogue";
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
 *
 * <strong>`selected` holds catalogue slugs, not labels.</strong> The label is
 * what gets revised — the list has had no product review — and keying on it
 * would move everybody's choices every time a word changed. Everything visible
 * here is looked up from the fetched catalogue.
 */
export default function InterestPicker({
  selected,
  onChange,
  title = "Your interests",
  description = "We'll use these to suggest clubs and events worth your time.",
  max,
}: {
  selected: string[];
  onChange: (interests: string[]) => void;
  /** Overridden where this is not a profile — a club picks topics, not hobbies. */
  title?: string;
  description?: string;
  /**
   * Optional ceiling. A profile has none: somebody interested in everything
   * only gets a busier feed, which is their business. A club has one, because a
   * club tagged with everything matches every student and quietly degrades
   * recommendations for all of them.
   */
  max?: number;
}) {
  const { interests, failed } = useInterestCatalogue();
  const [category, setCategory] = useState("");
  const [query, setQuery] = useState("");

  const bySlug = useMemo(
    () => new Map((interests ?? []).map((interest) => [interest.slug, interest])),
    [interests],
  );

  // The groups are the rows with no parent -- V26 promoted them from a text
  // column so that an event can be tagged with one. Here they are only ever
  // headings and filter options.
  const groups = useMemo(
    () => (interests ?? []).filter((interest) => interest.parentSlug === null),
    [interests],
  );

  const atLimit = max !== undefined && selected.length >= max;

  const available = useMemo(() => {
    const needle = query.trim().toLowerCase();
    const chosen = new Set(selected);
    return (interests ?? [])
      // A profile states specific interests, so only leaves are offered here.
      // An event picker would drop this line: tagging a jam night `music` is
      // exactly right, where claiming `music` as your whole personality is not.
      .filter((interest) => interest.parentSlug !== null)
      .filter((interest) => !chosen.has(interest.slug))
      .filter((interest) => !category || interest.parentSlug === category)
      .filter((interest) => !needle || interest.label.toLowerCase().includes(needle));
  }, [interests, category, query, selected]);

  return (
    <div>
      <h2 className="font-display text-xl font-bold text-ink-900">{title}</h2>
      <p className="mt-1 text-sm text-ink-600">{description}</p>

      {atLimit && (
        <p className="mt-3 text-sm font-semibold text-ink-600">
          That&apos;s {max} — the most you can pick. Remove one to swap it out.
        </p>
      )}

      {selected.length > 0 ? (
        <ul className="mt-4 flex flex-wrap gap-2">
          {selected.map((slug) => (
            <li key={slug}>
              <button
                type="button"
                onClick={() => onChange(selected.filter((value) => value !== slug))}
                aria-label={`Remove ${bySlug.get(slug)?.label ?? slug}`}
                className="inline-flex items-center gap-1.5 rounded-full bg-lavender-600 px-4 py-2 text-xs font-semibold text-white transition-colors hover:bg-lavender-800"
              >
                {/* Falls back to the slug for an interest that has been retired
                    from the catalogue since it was picked. Showing it is what
                    lets someone take it off; hiding it would leave a choice
                    they can neither see nor remove. */}
                {bySlug.get(slug)?.label ?? slug}
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
          {groups.map((group) => (
            <option key={group.slug} value={group.slug}>
              {group.label}
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
            <li key={interest.slug}>
              <button
                type="button"
                disabled={atLimit}
                onClick={() => onChange([...selected, interest.slug])}
                aria-label={`Add ${interest.label}`}
                className="inline-flex items-center gap-1.5 rounded-full border border-mist-200 px-4 py-2 text-xs font-semibold text-ink-900 transition-colors hover:border-lavender-300 hover:bg-lavender-50 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:border-mist-200 disabled:hover:bg-transparent"
              >
                {interest.label}
                <Plus className="h-3.5 w-3.5" aria-hidden="true" />
              </button>
            </li>
          ))}
        </ul>
      ) : (
        /* Four ways to reach an empty grid, and they need different answers:
           the catalogue is still loading, it failed to load, nothing matched
           what you typed, or you have already added the lot. */
        <p className="mt-4 text-sm text-ink-600">
          {failed ? (
            <span className="font-semibold text-alert-600">
              The interest list didn&apos;t load. Refresh to try again.
            </span>
          ) : interests === null ? (
            <span className="font-mono">Loading interests…</span>
          ) : query.trim() || category ? (
            "Nothing matches that. Try another word or category."
          ) : (
            "You have added every interest we have. Impressive."
          )}
        </p>
      )}
    </div>
  );
}
