"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Bell, GraduationCap, Heart, Settings, UserPen } from "lucide-react";

/**
 * The settings rail.
 *
 * Same shape as ManageSidebar -- a column on desktop, a scrolling strip of
 * pills on mobile -- because it is the same problem, and a settings screen that
 * navigated differently from the club dashboard would be a second thing to
 * learn for no reason.
 *
 * Five sections rather than one long page: each saves independently, and a
 * single Save at the foot of everything would make the button mean different
 * things depending on how far you had scrolled.
 */
const SECTIONS = [
  { segment: "", label: "Edit profile", icon: UserPen },
  { segment: "program", label: "Program info", icon: GraduationCap },
  { segment: "interests", label: "Interests", icon: Heart },
  { segment: "notifications", label: "Email updates", icon: Bell },
  // Last: the section you visit least, and the only one with irreversible
  // actions in it.
  { segment: "account", label: "Account", icon: Settings },
] as const;

const BASE = "/profile/edit";

export default function ProfileEditSidebar() {
  const pathname = usePathname();

  return (
    <nav aria-label="Profile settings" className="lg:w-56 lg:shrink-0">
      <ul className="flex gap-1 overflow-x-auto pb-2 lg:flex-col lg:overflow-visible lg:pb-0">
        {SECTIONS.map(({ segment, label, icon: Icon }) => {
          const href = segment ? `${BASE}/${segment}` : BASE;
          // Exact match for the index, prefix for the rest — its href is a
          // prefix of every other one, so it would otherwise always be active.
          const active = segment ? pathname.startsWith(href) : pathname === BASE;

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
      </ul>
    </nav>
  );
}
