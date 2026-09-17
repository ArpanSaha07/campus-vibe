import { Facebook, Globe, Instagram, Link, Linkedin, Mail, type LucideIcon } from "lucide-react";
import { instagramHandle, isEmailShaped, normaliseWebLink } from "@/app/lib/links";
import type { Club } from "@/app/types";

/**
 * Where else to find a club: Instagram, Facebook, LinkedIn, Linktree, its
 * website, its inbox.
 *
 * A sibling of `ProfileSocialLinks` rather than a reuse of it, and deliberately
 * so: that one is typed to `UserProfile["socialLinks"]`, which is
 * instagram/facebook/linkedin. The two sets overlap without matching — a club
 * also has a website, a contact email and, since 2026-09-16, a Linktree — so one
 * component serving both would take a union and branch on it to render six
 * networks for one caller and three for the other. The visual treatment is
 * shared instead — same 36px circles, same hover, same rule about rendering
 * nothing rather than greying out what is absent.
 *
 * Ordered here rather than at the call site, so two clubs never list the same
 * networks in a different sequence. Instagram leads because for a student club
 * it is where the actual updates are; the website is usually a faculty page
 * nobody reads.
 */

type Network = "instagram" | "facebook" | "linkedin" | "linktree" | "website" | "email";

const NETWORKS: { key: Network; label: string; Icon: LucideIcon }[] = [
  { key: "instagram", label: "Instagram", Icon: Instagram },
  { key: "facebook", label: "Facebook", Icon: Facebook },
  { key: "linkedin", label: "LinkedIn", Icon: Linkedin },
  // Lucide has no Linktree mark -- it dropped brand icons, and the service was
  // never among them. A plain chain link reads as "the rest of their links",
  // which is what a Linktree is, and stays true if a club moves to Beacons or
  // Carrd later.
  { key: "linktree", label: "Linktree", Icon: Link },
  { key: "website", label: "website", Icon: Globe },
  { key: "email", label: "email", Icon: Mail },
];

/**
 * The href for one network, or null when there is nothing usable stored.
 *
 * Every value goes through a normaliser even though the backend only accepts
 * http(s) on write: a row written before that rule existed would still be
 * rendered, and a bare `instagram.com/mcgillski` resolved against this origin
 * is a 404 on CampusVibe rather than a link to Instagram.
 *
 * LinkedIn and Linktree need no step of their own: they are whole links, so
 * they fall through to `normaliseWebLink` with website and facebook.
 *
 * Instagram takes the extra step because clubs type a handle at least as often
 * as a URL. `instagramHandle` accepts `@name`, `name` and either URL form, and
 * a handle is rebuilt into a canonical profile URL. Email is the one value that
 * must never see `normaliseWebLink` — it has no scheme, so it would be read as
 * a bare host and become `https://hello@club.ca`.
 */
function hrefFor(key: Network, links: Club["socialLinks"]): string | null {
  if (key === "email") {
    const email = links.email?.trim() ?? "";
    return email !== "" && isEmailShaped(email) ? `mailto:${email}` : null;
  }

  const raw = links[key];

  if (key === "instagram") {
    const handle = instagramHandle(raw);
    if (handle) return `https://www.instagram.com/${handle}`;
  }

  return normaliseWebLink(raw);
}

/**
 * Icon-only, so each link carries an aria-label naming both the club and the
 * network — an unlabelled icon link is announced as its URL, and six of those
 * in a row is the worst version of this component.
 *
 * Takes the links possibly-absent and decides for itself whether to appear, so
 * the page has one expression rather than a guard wrapped around a component
 * that guards again. Renders nothing when no link survives, rather than an
 * empty row or greyed-out icons: a placeholder for a network a club has not
 * joined is noise, and it invites reading absence as a fact about the club.
 */
export default function ClubSocialLinks({
  links,
  name,
}: {
  links: Club["socialLinks"] | null | undefined;
  name: string;
}) {
  if (!links) return null;

  // Built with a loop rather than map().filter(): filtering does not narrow
  // `href` away from null, and a type predicate to say what the loop already
  // proves would be the longer way round. Same shape as ProfileSocialLinks.
  const shown: { key: Network; label: string; Icon: LucideIcon; href: string }[] = [];
  for (const { key, label, Icon } of NETWORKS) {
    const href = hrefFor(key, links);
    if (href) shown.push({ key, label, Icon, href });
  }

  if (shown.length === 0) return null;

  return (
    <ul className="flex flex-wrap items-center gap-2">
      {shown.map(({ key, label, Icon, href }) => (
        <li key={key}>
          <a
            href={href}
            // No target on mailto: handing a mail client to a new tab leaves an
            // empty one behind. The rest open away from the club page.
            target={key === "email" ? undefined : "_blank"}
            // noreferrer as well as noopener: the first stops the opened page
            // reaching back through window.opener, the second stops it being
            // told which club page sent it.
            rel={key === "email" ? undefined : "noopener noreferrer"}
            aria-label={
              key === "email" || key === "website"
                ? `${name} ${label}`
                : `${name} on ${label}`
            }
            className="flex h-9 w-9 items-center justify-center rounded-full border border-mist-200 text-ink-600 transition-colors hover:border-lavender-300 hover:text-lavender-600"
          >
            <Icon className="h-4 w-4" aria-hidden="true" />
          </a>
        </li>
      ))}
    </ul>
  );
}
