"use client";

import type { ReactNode } from "react";
import { ProfileProvider } from "@/app/lib/profile-context";

/**
 * Wraps both the profile page and every settings section in one profile load.
 *
 * Here rather than on `profile/edit/layout.tsx` so that moving between viewing
 * your profile and editing it does not refetch, and -- more importantly -- so
 * that the editor's sections cannot each start from a different idea of what
 * the profile is. See `ProfileProvider` for what goes wrong when they do.
 *
 * Sign-in is already enforced by `(protected)/layout.tsx`, which also supplies
 * the navbar and footer.
 */
export default function ProfileLayout({ children }: { children: ReactNode }) {
  return <ProfileProvider>{children}</ProfileProvider>;
}
