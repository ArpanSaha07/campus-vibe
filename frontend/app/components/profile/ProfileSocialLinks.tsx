import { Facebook, Instagram, Linkedin, type LucideIcon } from "lucide-react";
import { normaliseProfileLink } from "@/app/lib/profile";
import type { UserProfile } from "@/app/types";

// Ordered here rather than at the call site, so two profiles never list the
// same networks in a different sequence.
const NETWORKS: { key: keyof UserProfile["socialLinks"]; label: string; Icon: LucideIcon }[] = [
  { key: "instagram", label: "Instagram", Icon: Instagram },
  { key: "facebook", label: "Facebook", Icon: Facebook },
  { key: "linkedin", label: "LinkedIn", Icon: Linkedin },
];

/**
 * A row of icons for wherever else this person can be found.
 *
 * Icon-only, so each link carries an aria-label naming both the person and the
 * network — an unlabelled icon link is announced as its URL, and three of those
 * in a row is the worst version of this component.
 *
 * Takes the links possibly-absent and decides for itself whether to appear,
 * so the page has one expression rather than a guard wrapped around a
 * component that guards again.
 *
 * Renders nothing when no link survives normalisation, rather than an empty
 * row or greyed-out icons. Placeholders for networks someone has not joined
 * are noise, and on a page that will eventually be public they would also
 * invite reading absence as a fact about the person.
 */
export default function ProfileSocialLinks({
  links,
  name,
}: {
  links: UserProfile["socialLinks"] | null | undefined;
  name: string;
}) {
  // Built with a loop rather than map().filter(): filtering does not narrow
  // `href` away from null, and a type predicate to say what the loop already
  // proves would be the longer way round.
  const shown: { key: string; label: string; Icon: LucideIcon; href: string }[] = [];
  for (const { key, label, Icon } of NETWORKS) {
    const href = normaliseProfileLink(links?.[key]);
    if (href) shown.push({ key, label, Icon, href });
  }

  if (shown.length === 0) return null;

  return (
    <ul className="mt-4 flex flex-wrap items-center gap-2">
      {shown.map(({ key, label, Icon, href }) => (
        <li key={key}>
          <a
            href={href}
            target="_blank"
            // noreferrer as well as noopener: the first stops the opened page
            // reaching back through window.opener, the second stops it being
            // told which profile sent it.
            rel="noopener noreferrer"
            aria-label={`${name} on ${label}`}
            className="flex h-9 w-9 items-center justify-center rounded-full border border-mist-200 text-ink-600 transition-colors hover:border-lavender-300 hover:text-lavender-600"
          >
            <Icon className="h-4 w-4" aria-hidden="true" />
          </a>
        </li>
      ))}
    </ul>
  );
}
