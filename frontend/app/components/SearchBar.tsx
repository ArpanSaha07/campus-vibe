"use client";

import { FormEvent, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Search } from "lucide-react";
import { searchClubs, searchEvents } from "@/app/lib/search";
import type { Club, EventInstance } from "@/app/types";

const DEBOUNCE_MS = 300;
const MIN_QUERY_LENGTH = 2;

/**
 * Debounced hybrid-search box with a typeahead panel (top events + clubs).
 * Enter always goes to the full results page: /events?q=…
 */
export default function SearchBar({ className = "" }: { className?: string }) {
  const [query, setQuery] = useState("");
  const [events, setEvents] = useState<EventInstance[]>([]);
  const [clubs, setClubs] = useState<Club[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const requestSeq = useRef(0);
  const router = useRouter();

  useEffect(() => {
    const q = query.trim();
    if (q.length < MIN_QUERY_LENGTH) {
      setEvents([]);
      setClubs([]);
      setOpen(false);
      setLoading(false);
      return;
    }
    setLoading(true);
    const seq = ++requestSeq.current;
    const timer = setTimeout(async () => {
      try {
        const [eventResults, clubResults] = await Promise.all([
          searchEvents(q, 5),
          searchClubs(q, 3),
        ]);
        if (seq !== requestSeq.current) return; // stale response
        setEvents(eventResults);
        setClubs(clubResults);
        setOpen(true);
      } catch {
        if (seq !== requestSeq.current) return;
        setEvents([]);
        setClubs([]);
        setOpen(true);
      } finally {
        if (seq === requestSeq.current) setLoading(false);
      }
    }, DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [query]);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  function goToResults(e?: FormEvent) {
    e?.preventDefault();
    const q = query.trim();
    if (!q) return;
    setOpen(false);
    router.push(`/events?q=${encodeURIComponent(q)}`);
  }

  const hasResults = events.length > 0 || clubs.length > 0;

  return (
    <div ref={containerRef} className={`group relative ${className}`}>
      <form onSubmit={goToResults} role="search">
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => query.trim().length >= MIN_QUERY_LENGTH && setOpen(true)}
          onKeyDown={(e) => e.key === "Escape" && setOpen(false)}
          placeholder="Search events and clubs"
          aria-label="Search events and clubs"
          aria-expanded={open}
          className="w-full rounded-full border border-gray-300 py-2 pl-4 pr-10 text-sm placeholder-gray-500 focus:border-black focus:ring-black group-hover:shadow-md transition-all"
        />
        <button
          type="submit"
          aria-label="Search"
          className="absolute right-1 top-1/2 -translate-y-1/2 flex items-center justify-center h-8 w-8 rounded-full bg-orange-600 hover:bg-orange-700 group-hover:shadow-md transition-all"
        >
          <Search className="h-4 w-4 text-white" />
        </button>
      </form>

      {open && (
        <div className="absolute left-0 right-0 top-full mt-2 z-50 rounded-2xl border border-gray-200 bg-white shadow-lg overflow-hidden">
          <div className="max-h-96 overflow-y-auto py-1">
            {loading && (
              <p className="px-4 py-3 text-sm text-gray-500">Searching…</p>
            )}

            {!loading && !hasResults && (
              <p className="px-4 py-3 text-sm text-gray-500">
                No matches for &ldquo;{query.trim()}&rdquo;
              </p>
            )}

            {!loading && events.length > 0 && (
              <section aria-label="Event results">
                <p className="px-4 pt-2 pb-1 text-xs font-semibold uppercase tracking-wide text-gray-400">
                  Events
                </p>
                {events.map((event) => (
                  <Link
                    key={event.eventId}
                    href={`/events/${event.eventId}`}
                    onClick={() => setOpen(false)}
                    className="block px-4 py-2 hover:bg-gray-100"
                  >
                    <p className="text-sm font-medium line-clamp-1">{event.title}</p>
                    <p className="text-xs text-gray-500">
                      {event.dateTime.toLocaleDateString(undefined, {
                        month: "short",
                        day: "numeric",
                      })}
                      {event.location.name && ` · ${event.location.name}`}
                    </p>
                  </Link>
                ))}
              </section>
            )}

            {!loading && clubs.length > 0 && (
              <section aria-label="Club results">
                <p className="px-4 pt-2 pb-1 text-xs font-semibold uppercase tracking-wide text-gray-400">
                  Clubs
                </p>
                {clubs.map((club) => (
                  <Link
                    key={club.clubId}
                    href={`/clubs/${club.clubId}`}
                    onClick={() => setOpen(false)}
                    className="block px-4 py-2 hover:bg-gray-100"
                  >
                    <p className="text-sm font-medium line-clamp-1">{club.name}</p>
                    <p className="text-xs text-gray-500">{club.followers} followers</p>
                  </Link>
                ))}
              </section>
            )}
          </div>

          {!loading && hasResults && (
            <button
              type="button"
              onClick={() => goToResults()}
              className="w-full border-t border-gray-100 px-4 py-2.5 text-left text-sm font-medium text-orange-600 hover:bg-gray-50"
            >
              See all results for &ldquo;{query.trim()}&rdquo;
            </button>
          )}
        </div>
      )}
    </div>
  );
}
