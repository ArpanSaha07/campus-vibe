"use client";

import { createContext, useContext, type ReactNode } from "react";
import type { ManagedClub } from "@/app/types";

/**
 * The club the current `/manage/[clubId]` screen is about, resolved once by the
 * layout and read by every page inside it.
 *
 * Before this, each page did `clubs.find(c => c.clubId === clubId)` against the
 * managed-clubs list. That worked only for someone with an assignment — a
 * platform admin manages every club and holds an assignment in none, so the
 * lookup missed and the dashboard refused to open for the one account that can
 * administer anything. Resolving in the layout means one request, one answer,
 * and one place where "who may open this" is decided.
 *
 * Deliberately not part of `ManagedClubsProvider`: that holds the clubs *you
 * run*, app-wide and cached for the navbar. This is one club, scoped to a
 * route, and is refetched whenever the route changes.
 */
interface ManageClubContextType {
  club: ManagedClub;
  /** Your role here, or null if you are a platform admin with no assignment. */
  role: ManagedClub["role"];
  /** True when you can open this dashboard only because you are platform staff. */
  viaPlatformAdmin: boolean;
  /**
   * Re-reads the club behind the layout's header, without the loading screen.
   * Called by the club editor after a save, so a new name or logo shows at once.
   */
  reload: () => Promise<void>;
}

const ManageClubContext = createContext<ManageClubContextType | undefined>(undefined);

export function ManageClubProvider({
  club,
  reload,
  children,
}: {
  club: ManagedClub;
  reload: () => Promise<void>;
  children: ReactNode;
}) {
  return (
    <ManageClubContext.Provider
      value={{ club, role: club.role, viaPlatformAdmin: club.role === null, reload }}
    >
      {children}
    </ManageClubContext.Provider>
  );
}

export function useManageClub() {
  const context = useContext(ManageClubContext);
  if (context === undefined) {
    throw new Error("useManageClub must be used within a /manage/[clubId] layout");
  }
  return context;
}
