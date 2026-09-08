"use client";

import { useMemo } from "react";
import { useEventFormats } from "@/app/hooks/useEventFormats";

/**
 * What kind of thing an event is — Workshop, Panel, Screening.
 *
 * Its own component rather than a reuse of `InterestPicker`, because the two
 * vocabularies are shaped differently and pretending otherwise would cost more
 * than it saved. A format's group is a plain label that nothing is ever tagged
 * with, so there is no `parentSlug` to filter on and no hierarchy to flatten —
 * and with twenty-two entries in five groups there is nothing to search
 * through, so this shows all of them at once instead of a filter and a query
 * box.
 *
 * There is deliberately no event *category* anywhere: format is a tag. See
 * decision D2 in interests_and_categories.md.
 */
export default function EventFormatPicker({
  selected,
  onChange,
  max = 8,
}: {
  selected: string[];
  onChange: (formats: string[]) => void;
  max?: number;
}) {
  const { formats, failed } = useEventFormats();

  // Grouped in the order the server sent, which is the order V29 seeded.
  const groups = useMemo(() => {
    const byGroup = new Map<string, { slug: string; label: string }[]>();
    for (const format of formats ?? []) {
      const bucket = byGroup.get(format.groupLabel) ?? [];
      bucket.push(format);
      byGroup.set(format.groupLabel, bucket);
    }
    return [...byGroup.entries()];
  }, [formats]);

  const atLimit = selected.length >= max;

  function toggle(slug: string) {
    onChange(
      selected.includes(slug)
        ? selected.filter((value) => value !== slug)
        : [...selected, slug],
    );
  }

  if (failed) {
    return (
      <p className="text-sm font-semibold text-alert-600">
        The format list didn&apos;t load. Refresh to try again.
      </p>
    );
  }

  if (formats === null) {
    return <p className="font-mono text-sm text-ink-600">Loading formats…</p>;
  }

  return (
    <div>
      {groups.map(([groupLabel, entries]) => (
        <div key={groupLabel} className="mt-4 first:mt-0">
          <p className="text-xs font-semibold uppercase tracking-wide text-ink-600">
            {groupLabel}
          </p>
          <ul className="mt-2 flex flex-wrap gap-2">
            {entries.map((format) => {
              const isChosen = selected.includes(format.slug);
              return (
                <li key={format.slug}>
                  <button
                    type="button"
                    aria-pressed={isChosen}
                    // Only the unchosen ones go dead at the limit -- a chosen
                    // pill must stay live or there would be no way to swap one
                    // out without starting over.
                    disabled={!isChosen && atLimit}
                    onClick={() => toggle(format.slug)}
                    className={`rounded-full px-4 py-2 text-xs font-semibold transition-colors ${
                      isChosen
                        ? "bg-lavender-600 text-white hover:bg-lavender-800"
                        : "border border-mist-200 text-ink-900 hover:border-lavender-300 hover:bg-lavender-50 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:border-mist-200 disabled:hover:bg-transparent"
                    }`}
                  >
                    {format.label}
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      ))}

      {atLimit && (
        <p className="mt-3 text-sm font-semibold text-ink-600">
          That&apos;s {max} — the most you can pick.
        </p>
      )}
    </div>
  );
}
