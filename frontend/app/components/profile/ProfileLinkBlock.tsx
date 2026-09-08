import Link from "next/link";
import { ChevronRight } from "lucide-react";
import type { ReactNode } from "react";

/**
 * A full-width card that is entirely one link, for the two routes the profile
 * hands off to.
 *
 * The Meetup page this borrows from lists the user's groups inline. Ours does
 * not: My clubs and My events are whole pages with their own filters, empty
 * states and loading, and a second rendering of either here would be a copy to
 * keep in step for no gain. So these are doors, not previews — which is also
 * why the block carries no count. A number would need a fetch this page
 * otherwise does not make, and could disagree with the page it points at.
 *
 * Built from spans rather than divs and paragraphs: the whole card is an
 * anchor, and block-level flow content inside one is worth avoiding even where
 * the parser tolerates it.
 */
export default function ProfileLinkBlock({
  href,
  title,
  description,
  icon,
}: {
  href: string;
  title: string;
  description: string;
  icon: ReactNode;
}) {
  return (
    <Link
      href={href}
      className="lift flex items-center gap-4 rounded-2xl border border-mist-200 bg-white p-5 transition-colors hover:border-lavender-300"
    >
      <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-lavender-100 text-lavender-600">
        {icon}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block font-display text-lg font-bold text-ink-900">{title}</span>
        <span className="block text-sm text-ink-600">{description}</span>
      </span>
      <ChevronRight className="h-5 w-5 shrink-0 text-ink-600" aria-hidden="true" />
    </Link>
  );
}
