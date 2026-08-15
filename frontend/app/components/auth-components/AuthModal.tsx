"use client";

import { useCallback, useEffect, useRef } from "react";
import { ArrowLeft, X } from "lucide-react";
import {
  AUTH_MODAL_TITLE_ID,
  useAuthModal,
  type AuthModalView,
} from "@/app/lib/auth-modal-context";
import SignupChoiceView from "@/app/components/auth-components/SignupChoiceView";
import EmailSignupView from "@/app/components/auth-components/EmailSignupView";
import LoginView from "@/app/components/auth-components/LoginView";
import RecoverPasswordView from "@/app/components/auth-components/RecoverPasswordView";
import ResetPasswordView from "@/app/components/auth-components/ResetPasswordView";
import VerifyEmailView from "@/app/components/auth-components/VerifyEmailView";

// The auth card. Mounted once at the root so any trigger — the navbar, a like
// button, anything added later — can raise it without the user losing the page
// they were on.

/** Where the back arrow goes. Views absent from this map show no arrow. */
const BACK_TARGET: Partial<Record<AuthModalView, AuthModalView>> = {
  "signup-email": "signup",
  recover: "login",
};

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

export default function AuthModal() {
  const { state, openAuth, closeAuth } = useAuthModal();
  const cardRef = useRef<HTMLDivElement | null>(null);
  const view = state?.view;

  // Whatever had focus before the modal opened, so it can be handed back on
  // close — otherwise focus falls to the top of the document and a keyboard
  // user loses their place entirely.
  const previouslyFocused = useRef<HTMLElement | null>(null);

  const isOpen = state !== null;

  useEffect(() => {
    if (!isOpen) return;
    previouslyFocused.current = document.activeElement as HTMLElement | null;
    const { body } = document;
    const previousOverflow = body.style.overflow;
    body.style.overflow = "hidden";
    return () => {
      body.style.overflow = previousOverflow;
      previouslyFocused.current?.focus?.();
    };
  }, [isOpen]);

  // Re-runs per view: each one replaces the card's contents, so focus has to be
  // placed again. A view whose first field carries autoFocus has already done
  // it by the time effects run — stealing focus back to the close button there
  // would undo the more useful placement.
  useEffect(() => {
    if (!isOpen) return;
    const card = cardRef.current;
    if (!card || card.contains(document.activeElement)) return;
    card.querySelector<HTMLElement>(FOCUSABLE)?.focus();
  }, [isOpen, view]);

  // Escape is bound to the document, not to the overlay. Clicking any
  // non-focusable part of the card — a heading, the "or" rule — hands focus to
  // <body>, and a keydown there never reaches an overlay-level React handler.
  useEffect(() => {
    if (!isOpen) return;
    const onEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape") closeAuth();
    };
    document.addEventListener("keydown", onEscape);
    return () => document.removeEventListener("keydown", onEscape);
  }, [isOpen, closeAuth]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key !== "Tab") return;

      // Trap: a modal that lets Tab wander onto the page behind it is a modal
      // in appearance only.
      const focusable = Array.from(
        cardRef.current?.querySelectorAll<HTMLElement>(FOCUSABLE) ?? []
      );
      if (focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      const active = document.activeElement;

      if (e.shiftKey && active === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && active === last) {
        e.preventDefault();
        first.focus();
      }
    },
    []
  );

  if (!state) return null;

  const backTarget = BACK_TARGET[state.view];
  const navigate = (next: AuthModalView) => openAuth(next, state.title);

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center overflow-y-auto bg-ink-900/30 p-4 backdrop-blur-sm"
      onMouseDown={(e) => {
        // mousedown, not click: a click that starts inside the card and ends on
        // the backdrop (a sloppy drag while selecting text) should not close it.
        if (e.target === e.currentTarget) closeAuth();
      }}
      onKeyDown={handleKeyDown}
    >
      <div
        ref={cardRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={AUTH_MODAL_TITLE_ID}
        className="auth-modal-card relative my-auto w-full max-w-md rounded-2xl border border-mist-200 bg-white p-8 shadow-lift"
      >
        {backTarget && (
          <button
            type="button"
            onClick={() => navigate(backTarget)}
            aria-label="Back"
            className="absolute top-4 left-4 rounded-full p-2 text-ink-600 hover:bg-lavender-50 hover:text-ink-900"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
        )}

        <button
          type="button"
          onClick={closeAuth}
          aria-label="Close"
          className="absolute top-4 right-4 rounded-full p-2 text-ink-600 hover:bg-lavender-50 hover:text-ink-900"
        >
          <X className="h-5 w-5" />
        </button>

        <div className="pt-6">
          {state.view === "signup" && (
            <SignupChoiceView title={state.title} onNavigate={navigate} onSuccess={closeAuth} />
          )}
          {state.view === "signup-email" && (
            <EmailSignupView onNavigate={navigate} onSuccess={closeAuth} />
          )}
          {state.view === "login" && <LoginView onNavigate={navigate} onSuccess={closeAuth} />}
          {state.view === "recover" && <RecoverPasswordView onNavigate={navigate} />}
          {state.view === "reset-password" && (
            <ResetPasswordView token={state.token ?? null} onNavigate={navigate} />
          )}
          {state.view === "verify-email" && (
            <VerifyEmailView
              token={state.token ?? null}
              onNavigate={navigate}
              onSuccess={closeAuth}
            />
          )}
        </div>
      </div>
    </div>
  );
}
