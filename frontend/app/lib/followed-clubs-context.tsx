"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { useAuth } from "@/app/lib/auth-context";
import { followClub, getMyClubs, unfollowClub } from "@/app/lib/club";
import type { Club } from "@/app/types";

// Which clubs the signed-in user follows, held once for the whole app.
//
// A Follow button on its own cannot know whether it should read `Follow` or
// `Following` — that answer lives on the server. Fetching per button would mean
// one request per card on a grid of twelve, all asking the same question, so the
// list is fetched once here and every button reads from it.
//
// Two things this deliberately does NOT do:
//
//   - It does not fetch on mount. The provider sits in the root layout, so an
//     eager fetch would hit /users/me/clubs on every route a signed-in user
//     opens, including the ones with no Follow button anywhere on them. Loading
//     starts when the first consumer appears instead.
//   - It does not keep ids only. It already receives whole Club objects, so the
//     My clubs page reads them from here rather than fetching the same endpoint
//     a second time — which is exactly what it used to do.

interface FollowedClubsContextType {
  /** False until the list has loaded, so a button can avoid flashing the wrong label. */
  ready: boolean;
  /** The followed clubs themselves, already sorted by name server-side. */
  clubs: Club[];
  /** True when the load failed, as opposed to finding nothing. */
  failed: boolean;
  isFollowing: (clubId: string) => boolean;
  /** Resolves once the server has accepted; rejects (after reverting) if it has not. */
  follow: (clubId: string) => Promise<void>;
  unfollow: (clubId: string) => Promise<void>;
  /** Called by useFollowedClubs on mount. Triggers the one load, at most once. */
  requestLoad: () => void;
}

const FollowedClubsContext = createContext<FollowedClubsContextType | undefined>(undefined);

export function FollowedClubsProvider({ children }: { children: ReactNode }) {
  const { isAuthenticated, loading: authLoading } = useAuth();
  const [clubs, setClubs] = useState<Club[]>([]);
  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState(false);

  // Whether anything on this page actually needs the list. A ref, not state,
  // because setting it must not itself cause a render.
  const wanted = useRef(false);
  const [wantedTick, setWantedTick] = useState(0);

  const requestLoad = useCallback(() => {
    if (wanted.current) return;
    wanted.current = true;
    setWantedTick((n) => n + 1); // wake the effect below exactly once
  }, []);

  useEffect(() => {
    if (!wanted.current) return;

    // Wait for auth to settle: during the initial /users/me round trip
    // isAuthenticated is still false, and fetching then would 403 and need
    // doing again the moment the user resolved.
    if (authLoading) return;

    if (!isAuthenticated) {
      // Signed out is a known answer, not a pending one — the button should
      // render `Follow` immediately rather than waiting on a request that
      // would only 403.
      setClubs([]);
      setFailed(false);
      setReady(true);
      return;
    }

    let cancelled = false;
    setReady(false);
    getMyClubs()
      .then((results) => {
        if (cancelled) return;
        setClubs(results);
        setFailed(false);
      })
      .catch(() => {
        // A failed load leaves every button reading `Follow`. That is the safe
        // way round: following again is idempotent server-side, whereas showing
        // `Following` for a club the user does not follow offers an unfollow
        // that would do nothing. `failed` lets the My clubs page tell this
        // apart from following nothing.
        if (cancelled) return;
        setClubs([]);
        setFailed(true);
      })
      .finally(() => {
        if (!cancelled) setReady(true);
      });

    return () => {
      cancelled = true;
    };
  }, [isAuthenticated, authLoading, wantedTick]);

  const followedIds = useMemo(() => new Set(clubs.map((club) => club.clubId)), [clubs]);

  const isFollowing = useCallback((clubId: string) => followedIds.has(clubId), [followedIds]);

  // Both writes are optimistic and revert on failure, so a click feels
  // immediate but a dropped request never leaves the UI claiming something the
  // database does not agree with. The error is rethrown so a caller can react.
  //
  // Following optimistically adds a placeholder club: the id is what every
  // button reads, and the real record arrives with the next load. The My clubs
  // page is the only place the rest of the fields show, and it is not a page
  // you can follow from.
  const mutate = useCallback(
    async (clubId: string, next: boolean, request: (id: string) => Promise<void>) => {
      const previous = clubs;
      setClubs((current) =>
        next
          ? current.some((club) => club.clubId === clubId)
            ? current
            : [...current, placeholderClub(clubId)]
          : current.filter((club) => club.clubId !== clubId),
      );

      try {
        await request(clubId);
      } catch (error) {
        setClubs(previous);
        throw error;
      }
    },
    [clubs],
  );

  const follow = useCallback(
    (clubId: string) => mutate(clubId, true, followClub),
    [mutate],
  );

  const unfollow = useCallback(
    (clubId: string) => mutate(clubId, false, unfollowClub),
    [mutate],
  );

  const value = useMemo(
    () => ({ ready, clubs, failed, isFollowing, follow, unfollow, requestLoad }),
    [ready, clubs, failed, isFollowing, follow, unfollow, requestLoad],
  );

  return (
    <FollowedClubsContext.Provider value={value}>{children}</FollowedClubsContext.Provider>
  );
}

/**
 * Stand-in for a club followed during this render, before the server list has
 * caught up. Only the id is real, which is all any Follow button reads.
 */
function placeholderClub(clubId: string): Club {
  return {
    clubId,
    name: clubId,
    description: "",
    category: null,
    interests: [],
    followers: 0,
    logo: "",
    socialLinks: { email: "" },
    featured: false,
    images: [],
    createdAt: new Date(),
  };
}

export function useFollowedClubs() {
  const context = useContext(FollowedClubsContext);
  if (context === undefined) {
    throw new Error("useFollowedClubs must be used within FollowedClubsProvider");
  }

  // Consuming the list is what asks for it. A route with no Follow button and
  // no My clubs grid never calls this hook, so it never makes the request.
  const { requestLoad } = context;
  useEffect(() => {
    requestLoad();
  }, [requestLoad]);

  return context;
}
