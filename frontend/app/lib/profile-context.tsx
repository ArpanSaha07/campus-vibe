"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { useAuth } from "@/app/lib/auth-context";
import { getProfile, saveProfile } from "@/app/lib/profile";
import type { UserProfile } from "@/app/types";

/**
 * The signed-in user's profile, loaded once for every screen that shows or
 * edits it.
 *
 * **This exists to stop the editor erasing itself.** `/profile/edit`,
 * `/profile/edit/program` and `/profile/edit/interests` each own a slice of one
 * profile -- bio and links, degree and subjects, interests -- but each submits a
 * *whole* `UserProfile` to a PUT that replaces everything. While every section
 * seeded its draft from `emptyProfile()` that was harmless, because nothing
 * persisted. The moment it does, saving on the program page writes `bio: null`
 * over the bio typed on the page before.
 *
 * One load, above all of them, is what makes each draft start from the real
 * saved profile, so the fields a section does not show are carried through its
 * save untouched. Anything that builds a draft from another source reintroduces
 * the bug.
 *
 * Modelled on `ManagedClubsProvider`: waits for auth to settle before fetching,
 * because a request sent before the token is read just 403s.
 */
interface ProfileContextType {
  /** The loaded profile, or null while the first read is in flight. */
  profile: UserProfile | null;
  /** True when the read failed. `profile` stays null. */
  failed: boolean;
  /**
   * Saves the whole profile and adopts the server's answer.
   *
   * Rejects on failure so `SaveChangesBar` can show it — deliberately not
   * swallowed here, or a failed save would look identical to a successful one.
   */
  save: (next: UserProfile) => Promise<void>;
}

const ProfileContext = createContext<ProfileContextType | undefined>(undefined);

export function ProfileProvider({ children }: { children: ReactNode }) {
  const { isAuthenticated, loading: authLoading } = useAuth();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (authLoading || !isAuthenticated) return;

    let cancelled = false;
    getProfile()
      .then((loaded) => {
        if (!cancelled) {
          setProfile(loaded);
          setFailed(false);
        }
      })
      .catch(() => {
        if (!cancelled) setFailed(true);
      });

    return () => {
      cancelled = true;
    };
  }, [authLoading, isAuthenticated]);

  const save = useCallback(async (next: UserProfile) => {
    // The response, not `next`: the server trims blanks to null and rewrites
    // links, so adopting what was sent would leave the form disagreeing with
    // the database until the next reload.
    setProfile(await saveProfile(next));
  }, []);

  return (
    <ProfileContext.Provider value={{ profile, failed, save }}>
      {children}
    </ProfileContext.Provider>
  );
}

export function useProfile() {
  const context = useContext(ProfileContext);
  if (context === undefined) {
    throw new Error("useProfile must be used within a /profile layout");
  }
  return context;
}
