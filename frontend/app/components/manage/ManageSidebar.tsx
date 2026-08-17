"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { CalendarDays, LayoutDashboard, Users, ExternalLink } from "lucide-react";

/**
 * The club-management rail.
 *
 * Every section here is visible to owners and admins alike — the two roles see
 * the same navigation, and differ only in the actions offered inside
 * Administrators. Hiding whole sections by role would leave admins guessing at
 * what exists; per §3.2 they may see the team, they just cannot change it.
 *
 * A persistent rail on desktop and a scrolling tab strip on mobile, rather than
 * a hamburger: with four destinations, a menu that hides them costs a tap and
 * buys nothing.
 */

const sections = [
  { segment: "", label: "Overview", icon: LayoutDashboard },
  { segment: "events", label: "Events", icon: CalendarDays },
  { segment: "admins", label: "Administrators", icon: Users },
] as const;

export default function ManageSidebar({ clubId }: { clubId: string }) {
  const pathname = usePathname();
  const base = `/manage/${clubId}`;

  return (
    <nav aria-label="Club management" className="lg:w-56 lg:shrink-0">
      <ul className="flex gap-1 overflow-x-auto pb-2 lg:flex-col lg:overflow-visible lg:pb-0">
        {sections.map(({ segment, label, icon: Icon }) => {
          const href = segment ? `${base}/${segment}` : base;
          // Exact match for Overview, prefix match for the rest — otherwise
          // Overview would light up on every child route, since its href is a
          // prefix of all of them.
          const active = segment ? pathname.startsWith(href) : pathname === base;

          return (
            <li key={label}>
              <Link
                href={href}
                aria-current={active ? "page" : undefined}
                className={`flex items-center gap-2.5 whitespace-nowrap rounded-full px-4 py-2.5 text-sm font-semibold transition-colors duration-150 ${
                  active
                    ? "bg-lavender-50 text-lavender-800"
                    : "text-ink-600 hover:bg-lavender-50 hover:text-lavender-800"
                }`}
              >
                <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />
                {label}
              </Link>
            </li>
          );
        })}

        <li className="lg:mt-4 lg:border-t lg:border-mist-200 lg:pt-4">
          <Link
            href={`/clubs/${clubId}`}
            className="flex items-center gap-2.5 whitespace-nowrap rounded-full px-4 py-2.5 text-sm font-semibold text-ink-600 transition-colors duration-150 hover:bg-lavender-50 hover:text-lavender-800"
          >
            <ExternalLink className="h-4 w-4 shrink-0" aria-hidden="true" />
            View public page
          </Link>
        </li>
      </ul>
    </nav>
  );
}
