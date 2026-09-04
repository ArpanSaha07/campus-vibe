"use client";

import Link from "next/link";
import { SlidersHorizontal } from "lucide-react";
import { useAuth } from "@/app/lib/auth-context";
import { useManagedClubs } from "@/app/lib/managed-clubs-context";
import { isAdmin } from "@/app/lib/user";

/**
 * A shortcut into a club's dashboard, shown on its card to people who can
 * actually open one.
 *
 * <strong>Visibility only.</strong> Every screen behind the link re-derives
 * authority from the database, so someone who forced this to render would reach
 * a dashboard whose every request 403s. What it saves is the detour through
 * `/clubs/{id}` and the navbar for the two people who have a reason to go
 * straight there: a platform admin filling in a club's details, and an owner or
 * admin spotting their own club in a grid.
 *
 * A client component nested inside the server-rendered card, rather than making
 * the card itself a client component. The card is in four grids, most of them
 * long; pushing all of that into the client to decide one pill would be a poor
 * trade.
 *
 * Renders nothing at all for everyone else — not a disabled state, not a
 * tooltip. A control you cannot use is noise, and on a public listing it also
 * quietly advertises that a dashboard exists.
 */
export default function ManageClubPill({ clubId }: { clubId: string }) {
  const { user } = useAuth();
  const { roleIn } = useManagedClubs();

  // Two independent reasons, and either is enough. A platform admin manages
  // every club; a club's own owner or admin manages that one.
  const mayManage = (user != null && isAdmin(user)) || roleIn(clubId) !== null;
  if (!mayManage) return null;

  return (
    <Link
      href={`/manage/${clubId}`}
      // Hidden until the card is hovered or the link itself is focused, so a
      // keyboard user can still reach it — a pill that appears only on hover is
      // unreachable without a mouse, which is the usual way this pattern breaks.
      className="absolute right-3 top-3 z-10 inline-flex items-center gap-1.5 rounded-full bg-lavender-600 px-2.5 py-1 text-xs font-semibold text-white opacity-0 shadow-sm transition-opacity duration-150 focus-visible:opacity-100 group-hover:opacity-100"
    >
      <SlidersHorizontal className="h-3 w-3" aria-hidden="true" />
      Manage
    </Link>
  );
}
