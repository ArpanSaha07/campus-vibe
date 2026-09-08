"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { useAuth } from "@/app/lib/auth-context";
import {
  getManagedClubs,
  listMyClubInvitations,
  listMyOwnershipTransfers,
} from "@/app/lib/club-admin-requests";
import type {
  ClubInvitation,
  ClubRole,
  ManagedClub,
  OwnershipTransfer,
} from "@/app/types";

// Which clubs the signed-in user may manage, held once for the whole app.
//
// This replaces `isClubAdmin(user)`. That read a role off the JWT, which was
// wrong twice over: it could not say *which* club, and a role claim outlives
// the access it describes, so someone removed from a club kept seeing the
// dashboard link until their token expired. This asks the server instead.
//
// Unlike FollowedClubsProvider this loads eagerly once auth settles rather than
// waiting for a consumer to ask. The navbar is a consumer on every page, so
// lazy loading would buy nothing and only add a frame where the nav is wrong.
//
// Visibility only. The backend re-checks authority on every request, so a stale
// or tampered value here changes what is drawn and nothing else.

interface ManagedClubsContextType {
  /** False until the list has loaded. Guard on this before rendering "you manage nothing". */
  ready: boolean;
  clubs: ManagedClub[];
  /**
   * Invitations waiting on this user, across every club.
   *
   * Loaded here rather than only on /invitations because the navbar is the
   * only way someone who manages nothing yet would ever find that page — the
   * email link aside, and an email is easy to lose.
   */
  invitations: ClubInvitation[];
  /**
   * Clubs being handed to this user, waiting on them to accept or decline.
   *
   * Separate from invitations because they are a different offer — an
   * invitation asks you to help run a club, this asks you to become
   * responsible for it — but they surface in the same two places, so they load
   * together.
   */
  ownershipTransfers: OwnershipTransfer[];
  /** Everything waiting on an answer, for the navbar badge. */
  pendingAnswers: number;
  /** True when the club request failed, as opposed to the user managing nothing. */
  failed: boolean;
  /** The same distinction for invitations, which fail independently. */
  invitationsFailed: boolean;
  /** The user's role in one club, or null if they do not manage it. */
  roleIn: (clubId: string) => ClubRole | null;
  isOwnerOf: (clubId: string) => boolean;
  /** Re-fetches both — call after anything that changes the caller's own assignments. */
  refresh: () => void;
}

const ManagedClubsContext = createContext<ManagedClubsContextType | undefined>(undefined);

export function ManagedClubsProvider({ children }: { children: ReactNode }) {
  const { isAuthenticated, loading: authLoading } = useAuth();
  const [clubs, setClubs] = useState<ManagedClub[]>([]);
  const [invitations, setInvitations] = useState<ClubInvitation[]>([]);
  const [ownershipTransfers, setOwnershipTransfers] = useState<OwnershipTransfer[]>([]);
  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState(false);
  const [invitationsFailed, setInvitationsFailed] = useState(false);
  const [reloadTick, setReloadTick] = useState(0);

  const refresh = useCallback(() => setReloadTick((n) => n + 1), []);

  useEffect(() => {
    // Wait for auth to settle: during the initial /users/me round trip
    // isAuthenticated is still false, and fetching then would only 403.
    if (authLoading) return;

    if (!isAuthenticated) {
      // Signed out is a known answer, not a pending one.
      setClubs([]);
      setInvitations([]);
      setOwnershipTransfers([]);
      setFailed(false);
      setInvitationsFailed(false);
      setReady(true);
      return;
    }

    let cancelled = false;
    setReady(false);
    // allSettled, not all: an unreadable invitation list must not make the app
    // believe the user manages nothing, which is what a rejected Promise.all
    // would do. The two answers are independent and are treated that way.
    Promise.allSettled([
      getManagedClubs(),
      listMyClubInvitations(),
      listMyOwnershipTransfers(),
    ])
      .then(([managed, waiting, handovers]) => {
        if (cancelled) return;
        // Fail closed on the clubs: an unreadable list hides management UI
        // rather than showing links that would 403 on click. `failed` lets a
        // dashboard distinguish this from genuinely managing nothing.
        setClubs(managed.status === "fulfilled" ? managed.value : []);
        setFailed(managed.status !== "fulfilled");
        setInvitations(waiting.status === "fulfilled" ? waiting.value : []);
        setOwnershipTransfers(handovers.status === "fulfilled" ? handovers.value : []);
        // One flag for both offers: they load together and the screen that
        // reports the failure shows them in one list.
        setInvitationsFailed(waiting.status !== "fulfilled" || handovers.status !== "fulfilled");
      })
      .finally(() => {
        if (!cancelled) setReady(true);
      });

    return () => {
      cancelled = true;
    };
  }, [isAuthenticated, authLoading, reloadTick]);

  const byId = useMemo(
    () => new Map(clubs.map((club) => [club.clubId, club])),
    [clubs],
  );

  const roleIn = useCallback(
    (clubId: string) => byId.get(clubId)?.role ?? null,
    [byId],
  );

  const isOwnerOf = useCallback(
    (clubId: string) => byId.get(clubId)?.role === "CLUB_OWNER",
    [byId],
  );

  const value = useMemo(
    () => ({
      ready,
      clubs,
      invitations,
      ownershipTransfers,
      pendingAnswers: invitations.length + ownershipTransfers.length,
      failed,
      invitationsFailed,
      roleIn,
      isOwnerOf,
      refresh,
    }),
    [ready, clubs, invitations, ownershipTransfers, failed, invitationsFailed,
     roleIn, isOwnerOf, refresh],
  );

  return (
    <ManagedClubsContext.Provider value={value}>{children}</ManagedClubsContext.Provider>
  );
}

export function useManagedClubs() {
  const context = useContext(ManagedClubsContext);
  if (context === undefined) {
    throw new Error("useManagedClubs must be used within ManagedClubsProvider");
  }
  return context;
}
