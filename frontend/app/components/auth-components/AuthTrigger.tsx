"use client";

import type { ReactNode } from "react";
import { useAuthModal, type AuthModalView } from "@/app/lib/auth-modal-context";

// A bare button that raises the auth modal, for parents that are Server
// Components and so cannot call `useAuthModal` themselves (the footer, for one).
// Unstyled on purpose: the caller passes the classes that make it look like
// whatever it sits among.
export default function AuthTrigger({
  view = "signup",
  title,
  className = "",
  children,
}: {
  view?: AuthModalView;
  /** Contextual headline for the signup view, e.g. "Sign up to save events". */
  title?: string;
  className?: string;
  children: ReactNode;
}) {
  const { openAuth } = useAuthModal();

  return (
    <button type="button" onClick={() => openAuth(view, title)} className={className}>
      {children}
    </button>
  );
}
