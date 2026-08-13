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
import { followClub, getMyClubs, unfollowClub } from "@/app/lib/club";

// Which clubs the signed-in user follows, held once for the whole app.
//
// A Follow button on its own cannot know whether it should read "Follow" or
// "Following" — that answer lives on the server. Fetching per button would mean
// one request per card on a grid of twelve, all asking the same question, so the
// list is fetched once here and every button reads from it.
//
// Only the ids are kept. The My clubs page needs whole Club objects and fetches
// them itself; duplicating them here would give two copies to keep in step for
// no gain, since that page has no Follow buttons on it.

interface FollowedClubsContextType {
  /** False until the list has loaded, so a button can avoid flashing the wrong label. */
  ready: boolean;
  isFollowing: (clubId: string) => boolean;
  /** Resolves once the server has accepted; rejects (after reverting) if it has not. */
  follow: (clubId: string) => Promise<void>;
  unfollow: (clubId: string) => Promise<void>;
}

const FollowedClubsContext = createContext<FollowedClubsContextType | undefined>(undefined);

export function FollowedClubsProvider({ children }: { children: ReactNode }) {
  const { isAuthenticated, loading: authLoading } = useAuth();
  const [followedIds, setFollowedIds] = useState<Set<string>>(new Set());
  const [ready, setReady] = useState(false);

  useEffect(() => {
    // Wait for auth to settle: during the initial /users/me round trip
    // isAuthenticated is still false, and fetching then would 403 and then need
    // doing again the moment the user resolved.
    if (authLoading) return;

    if (!isAuthenticated) {
      // Signed out is a known answer, not a pending one — the button should
      // render "Follow" immediately rather than waiting on a request that
      // would only 403.
      setFollowedIds(new Set());
      setReady(true);
      return;
    }

    let cancelled = false;
    setReady(false);
    getMyClubs()
      .then((clubs) => {
        if (!cancelled) setFollowedIds(new Set(clubs.map((club) => club.clubId)));
      })
      .catch(() => {
        // A failed load leaves every button reading "Follow". That is the safe
        // way round: following again is idempotent server-side, whereas showing
        // "Following" for a club the user does not follow offers an unfollow
        // that would do nothing.
        if (!cancelled) setFollowedIds(new Set());
      })
      .finally(() => {
        if (!cancelled) setReady(true);
      });

    return () => {
      cancelled = true;
    };
  }, [isAuthenticated, authLoading]);

  const isFollowing = useCallback((clubId: string) => followedIds.has(clubId), [followedIds]);

  // Both writes are optimistic and revert on failure, so a click feels
  // immediate but a dropped request never leaves the UI claiming something the
  // database does not agree with. The error is rethrown so a caller can react.
  const mutate = useCallback(
    async (clubId: string, next: boolean, request: (id: string) => Promise<void>) => {
      setFollowedIds((current) => {
        const updated = new Set(current);
        if (next) updated.add(clubId);
        else updated.delete(clubId);
        return updated;
      });

      try {
        await request(clubId);
      } catch (error) {
        setFollowedIds((current) => {
          const reverted = new Set(current);
          if (next) reverted.delete(clubId);
          else reverted.add(clubId);
          return reverted;
        });
        throw error;
      }
    },
    [],
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
    () => ({ ready, isFollowing, follow, unfollow }),
    [ready, isFollowing, follow, unfollow],
  );

  return (
    <FollowedClubsContext.Provider value={value}>{children}</FollowedClubsContext.Provider>
  );
}

export function useFollowedClubs() {
  const context = useContext(FollowedClubsContext);
  if (context === undefined) {
    throw new Error("useFollowedClubs must be used within FollowedClubsProvider");
  }
  return context;
}
