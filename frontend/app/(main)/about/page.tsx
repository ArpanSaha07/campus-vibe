import type { Metadata } from "next";
import type { CSSProperties } from "react";
import Button from "@/app/components/ui/Button";

// Static content, no data fetching, so this route prerenders at build time
// without needing a backend.

export const metadata: Metadata = {
  title: "About · CampusVibe",
  description: "CampusVibe brings McGill campus events and clubs together in one place.",
};

const FEATURES: { title: string; body: string }[] = [
  { title: "Discover campus events in one place", body: "instead of checking multiple platforms." },
  { title: "Search and filter events", body: "based on your interests and preferences." },
  { title: "Follow your favorite clubs", body: "and keep up with what they are organizing." },
  { title: "Bookmark events", body: "you want to attend and easily find them again." },
  { title: "Keep track of upcoming opportunities", body: "so important events do not slip by." },
  { title: "Discover new clubs and activities", body: "beyond the ones you already follow." },
  { title: "Get more relevant event recommendations", body: "based on your interests and activity." },
  { title: "Add events to your calendar", body: "to better organize your campus schedule." },
  { title: "For club organizers:", body: "create, update, and manage your events from one place." },
  { title: "Reach more students", body: "by making club events easier to discover across the McGill community." },
];

export default function AboutPage() {
  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 md:py-16">
      <header className="max-w-3xl fade-up">
        <h1 className="font-display text-4xl sm:text-5xl font-bold text-ink-900 mt-1 leading-[1.05]">
          About CampusVibe
        </h1>
        <p className="mt-5 text-lg text-ink-600 leading-relaxed">
          CampusVibe is a community platform built for McGill students and student organizations. It helps
          students discover and keep track of events happening on and around the McGill campus, while giving club
          organizers one place to manage their events and reach more students.
        </p>
      </header>

      <section
        className="mt-12 md:mt-16 grid gap-6 md:grid-cols-12 border-t border-mist-200 pt-10 md:pt-12 fade-up"
        style={{ "--reveal-index": 1 } as CSSProperties}
      >
        <h2 className="md:col-span-4 font-display text-2xl font-bold text-ink-900">Why CampusVibe exists</h2>
        <div className="md:col-span-8 space-y-4 text-[0.9375rem] leading-relaxed text-ink-900 max-w-2xl">
          <p className="font-display text-xl font-semibold text-lavender-800 leading-snug">
            CampusVibe was created after repeatedly discovering interesting events only after they had already
            happened.
          </p>
          <p>
            Keeping track of opportunities across Instagram pages, newsletters, Facebook, club websites, and other
            platforms made it easy to miss events from favorite clubs, including valuable networking, academic,
            social, and career opportunities.
          </p>
          <p>
            CampusVibe brings those events together in one place so students can spend less time searching and
            more time participating.
          </p>
        </div>
      </section>

      <section
        className="mt-12 md:mt-16 border-t border-mist-200 pt-10 md:pt-12 fade-up"
        style={{ "--reveal-index": 2 } as CSSProperties}
      >
        <h2 className="font-display text-2xl font-bold text-ink-900">What you can do with CampusVibe</h2>
        <ul className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map((feature, index) => (
            <li key={feature.title} className="rounded-2xl border border-mist-200 bg-white p-5 hover:bg-gray-50 transition-colors">
              <span className="font-mono text-sm font-medium text-lavender-600">
                {String(index + 1).padStart(2, "0")}
              </span>
              <p className="mt-2 text-[0.9375rem] leading-relaxed text-ink-600">
                <strong className="font-semibold text-ink-900">{feature.title}</strong> {feature.body}
              </p>
            </li>
          ))}
        </ul>
      </section>

      <section
        className="mt-12 md:mt-16 rounded-2xl bg-lavender-50 px-6 py-10 sm:px-10 flex flex-col md:flex-row md:items-center md:justify-between gap-6 fade-up"
        style={{ "--reveal-index": 3 } as CSSProperties}
      >
        <p className="font-display text-xl sm:text-2xl font-semibold text-ink-900 max-w-2xl leading-snug">
          CampusVibe is built specifically for the <span className="text-lavender-600">McGill community</span>,
          with the goal of making campus life easier to explore, organize, and enjoy.
        </p>
        <div className="flex flex-wrap gap-3 shrink-0">
          <Button href="/events">Discover events</Button>
          <Button href="/clubs" variant="secondary">
            Explore clubs
          </Button>
        </div>
      </section>
    </div>
  );
}
