import type { ReactNode } from "react";
import Link from "next/link";
import { Mail } from "lucide-react";

// Shared building blocks for the static legal pages (/privacy-policy,
// /terms-of-service), so both read as one document style.

export function LegalPage({
  title,
  lastUpdated,
  children,
}: {
  title: string;
  lastUpdated: string;
  children: ReactNode;
}) {
  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 md:py-16 fade-up">
      <div className="max-w-3xl mx-auto">
        <p className="ticket-label text-lavender-600">Legal</p>
        <h1 className="font-display text-3xl sm:text-4xl font-bold text-ink-900 mt-1 mb-3">{title}</h1>
        <p className="text-sm text-ink-600">
          <span className="ticket-label">Last updated</span>{" "}
          <span className="font-mono">{lastUpdated}</span>
        </p>
        {children}
      </div>
    </div>
  );
}

export function sectionId(number: number) {
  return `section-${number}`;
}

export function Section({ number, title, children }: { number: number; title: string; children: ReactNode }) {
  return (
    <section
      id={sectionId(number)}
      className="scroll-mt-24 border-t border-mist-200 pt-8 mt-8 first:border-t-0 first:pt-0 first:mt-0"
    >
      <h2 className="font-display text-2xl font-bold text-ink-900 flex items-baseline gap-3">
        <span className="font-mono text-sm font-medium text-lavender-600">
          {String(number).padStart(2, "0")}
        </span>
        {title}
      </h2>
      <div className="mt-4 space-y-4 text-[0.9375rem] leading-relaxed text-ink-900">{children}</div>
    </section>
  );
}

export function Subsection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="space-y-4 pt-2">
      <h3 className="text-lg font-semibold text-ink-900">{title}</h3>
      {children}
    </div>
  );
}

export function BulletList({ items }: { items: string[] }) {
  return (
    <ul className="space-y-2 pl-1">
      {items.map((item) => (
        <li key={item} className="flex gap-3">
          <span aria-hidden="true" className="mt-2.5 h-1.5 w-1.5 shrink-0 rounded-full bg-lavender-500" />
          <span>{item}</span>
        </li>
      ))}
    </ul>
  );
}

// Titles are passed in order; entry i links to <Section number={i + 1}>.
export function TableOfContents({ titles }: { titles: string[] }) {
  return (
    <nav aria-labelledby="legal-contents" className="mt-8 rounded-2xl bg-mist-100 p-5 sm:p-6">
      <h2 id="legal-contents" className="ticket-label text-ink-600">
        Contents
      </h2>
      <ol className="mt-3 grid gap-x-6 gap-y-2 sm:grid-cols-2">
        {titles.map((sectionTitle, index) => (
          <li key={sectionTitle}>
            <a
              href={`#${sectionId(index + 1)}`}
              className="flex items-baseline gap-2 text-sm text-ink-900 hover:text-lavender-600 transition-colors"
            >
              <span className="font-mono text-xs text-lavender-600">{String(index + 1).padStart(2, "0")}</span>
              {sectionTitle}
            </a>
          </li>
        ))}
      </ol>
    </nav>
  );
}

export function ContactCard({ email }: { email: string }) {
  return (
    <div className="rounded-2xl border border-mist-200 p-5">
      <Link
        href={`mailto:${email}`}
        className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full border border-lavender-500 bg-transparent text-ink-900 hover:border-lavender-600 hover:bg-lavender-50 hover:text-lavender-800 transition-colors"
      >
        <Mail className="h-4 w-4" aria-hidden="true" />
        Email
      </Link>
    </div>
  );
}
