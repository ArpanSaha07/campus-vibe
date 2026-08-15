"use client";

import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";

// Auth lives in a modal over whatever the user was already doing, so that
// clicking a user-only action never costs them their place on the page. The
// open/close state is global because the triggers are scattered — the navbar,
// the like button on a card, anything added later.

export type AuthModalView =
  /** Choose a method: Google, or continue to the email form. */
  | "signup"
  /** Name/email/password form reached from the signup choice. */
  | "signup-email"
  | "login"
  /** Ask for a reset link. */
  | "recover"
  /** Landed from a reset email; carries a token in the URL. */
  | "reset-password"
  /** Landed from a confirmation email; carries a token in the URL. */
  | "verify-email";

/** Every view heads itself with this id so the dialog can point at the heading. */
export const AUTH_MODAL_TITLE_ID = "auth-modal-title";

export interface AuthModalState {
  view: AuthModalView;
  /**
   * Contextual headline for the signup view, e.g. "Sign up to save events".
   * Meetup does this — the card names the thing you were reaching for. Falls
   * back to a generic headline when a trigger has nothing specific to say.
   */
  title?: string;
  /**
   * Single-use token from a reset or confirmation email. Held in state rather
   * than left in the URL: AuthModalUrlTrigger strips it immediately, because a
   * live credential in the address bar survives in history and in anything the
   * user copies.
   */
  token?: string;
}

interface AuthModalContextType {
  /** null while closed. */
  state: AuthModalState | null;
  openAuth: (view?: AuthModalView, title?: string, token?: string) => void;
  closeAuth: () => void;
}

const AuthModalContext = createContext<AuthModalContextType | undefined>(undefined);

export function AuthModalProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthModalState | null>(null);

  const openAuth = useCallback(
    (view: AuthModalView = "signup", title?: string, token?: string) => {
      setState({ view, title, token });
    },
    []
  );

  const closeAuth = useCallback(() => setState(null), []);

  const value = useMemo(
    () => ({ state, openAuth, closeAuth }),
    [state, openAuth, closeAuth]
  );

  return <AuthModalContext.Provider value={value}>{children}</AuthModalContext.Provider>;
}

export function useAuthModal() {
  const context = useContext(AuthModalContext);
  if (context === undefined) {
    throw new Error("useAuthModal must be used within AuthModalProvider");
  }
  return context;
}
