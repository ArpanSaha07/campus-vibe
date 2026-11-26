import Link from "next/link";
import { ArrowRight } from "lucide-react";

/**
 * The homepage's six intent cards, under the banner: type-led, two of them
 * double-width so the grid is not uniform (Arpan, 2026-11-26, from the design
 * canvas). Each card runs a `/events?q=` search for its phrase.
 *
 * That is the text search ADR-001 D6 ruled out for category tiles; Arpan chose
 * it knowingly over a real tag filter, which /events does not have yet, and
 * skipped a superseding ADR. Swap `query` for a filter when one exists.
 */
const CATEGORIES = [
  { name: "Meet new people", blurb: "Socials, mixers and club nights", query: "social mixer", wide: true },
  { name: "Build your career", blurb: "Info sessions, fairs and networking", query: "career networking", wide: false },
  { name: "Try something new", blurb: "Workshops and beginner-friendly firsts", query: "beginner friendly", wide: false },
  { name: "Find free food", blurb: "Events with food on the table", query: "free food", wide: false },
  { name: "Get active", blurb: "Intramurals, climbing and runs", query: "sports fitness", wide: false },
  { name: "Find your community", blurb: "Cultural, faith and identity groups", query: "cultural community", wide: true },
];

export default function CategoriesSection() {
  return (
    <section aria-label="Browse by what you are after" className="max-w-7xl mx-auto px-4 sm:px-6 pt-2 pb-6">
      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        {CATEGORIES.map(({ name, blurb, query, wide }) => (
          <Link
            key={name}
            href={`/events?q=${encodeURIComponent(query)}`}
            className={`group lift flex min-h-36 flex-col justify-between gap-6 rounded-2xl border border-mist-200 bg-white p-5 sm:min-h-44 sm:p-6
              transition-colors hover:border-lavender-300 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-lavender-300
              ${wide ? "col-span-2" : ""}`}
          >
            <span className="flex flex-col gap-2">
              <span
                className={`font-display font-bold leading-[1.08] tracking-[-0.01em] text-ink-900 group-hover:text-lavender-800 transition-colors
                  ${wide ? "text-2xl sm:text-4xl" : "text-xl sm:text-[1.625rem]"}`}
              >
                {name}
              </span>
              <span className="text-sm text-ink-600">{blurb}</span>
            </span>
            <ArrowRight
              className="h-5 w-5 self-end text-lavender-600 transition-transform duration-150 group-hover:translate-x-1 motion-reduce:transition-none motion-reduce:group-hover:translate-x-0"
              aria-hidden="true"
            />
          </Link>
        ))}
      </div>
    </section>
  );
}
