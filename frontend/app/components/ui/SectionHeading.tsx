import Link from "next/link";

export default function SectionHeading({
  title,
  subtitle,
  moreHref,
  moreLabel,
}: {
  title: string;
  subtitle?: string;
  moreHref?: string;
  moreLabel?: string;
}) {
  return (
    <div className="flex items-end justify-between gap-4 mb-2">
      <div>
        <h2 className="font-display text-2xl font-bold text-ink-900">{title}</h2>
        {subtitle && <p className="text-sm text-ink-600 mt-1">{subtitle}</p>}
      </div>
      {moreHref && (
        <Link
          href={moreHref}
          className="shrink-0 text-md font-semibold text-lavender-600 hover:text-lavender-800"
        >
          {moreLabel ?? "See all"} →
        </Link>
      )}
    </div>
  );
}
