"use client";

import { useEffect, useRef, useState } from "react";
import { CheckCircle2, MailWarning } from "lucide-react";
import { verifyEmail } from "@/app/lib/user";
import { parseApiError } from "@/app/lib/auth-errors";
import Button from "@/app/components/ui/Button";
import { AUTH_MODAL_TITLE_ID, type AuthModalView } from "@/app/lib/auth-modal-context";

// Where a confirmation email lands: /?auth=verify-email&token=…
// Redeems on mount — the user already acted by clicking the link in their
// inbox, so asking them to press a second button here would be ceremony.

export default function VerifyEmailView({
  token,
  onNavigate,
  onSuccess,
}: {
  token: string | null;
  onNavigate: (view: AuthModalView) => void;
  onSuccess: () => void;
}) {
  const [state, setState] = useState<"working" | "done" | "failed">("working");
  const [error, setError] = useState("");
  // React runs effects twice in development Strict Mode. The token is
  // single-use, so a second redemption would fail and show the user an error
  // for a link that in fact worked.
  const attempted = useRef(false);

  useEffect(() => {
    if (attempted.current) return;
    attempted.current = true;

    if (!token) {
      setState("failed");
      setError("This confirmation link is incomplete.");
      return;
    }

    verifyEmail(token)
      .then(() => setState("done"))
      .catch((err) => {
        setState("failed");
        setError(parseApiError(err, "This confirmation link is invalid or has expired."));
      });
  }, [token]);

  if (state === "working") {
    return (
      <div className="text-center">
        <h2 id={AUTH_MODAL_TITLE_ID} className="font-display text-2xl font-bold text-ink-900">
          Confirming your email
        </h2>
        <p className="mt-2 text-sm text-ink-600">One moment.</p>
      </div>
    );
  }

  if (state === "done") {
    return (
      <div className="text-center">
        <span className="mb-5 inline-flex h-16 w-16 items-center justify-center rounded-full bg-lavender-100 text-lavender-600">
          <CheckCircle2 className="h-7 w-7" />
        </span>
        <h2 id={AUTH_MODAL_TITLE_ID} className="font-display text-2xl font-bold text-ink-900">
          Email confirmed
        </h2>
        <p className="mx-auto mt-2 max-w-sm text-sm text-ink-600">
          Thanks — your address is verified.
        </p>
        <Button size="lg" className="mt-6 w-full" onClick={onSuccess}>
          Continue
        </Button>
      </div>
    );
  }

  return (
    <div className="text-center">
      <span className="mb-5 inline-flex h-16 w-16 items-center justify-center rounded-full bg-mist-100 text-ink-600">
        <MailWarning className="h-7 w-7" />
      </span>
      <h2 id={AUTH_MODAL_TITLE_ID} className="font-display text-2xl font-bold text-ink-900">
        That link did not work
      </h2>
      <p className="mx-auto mt-2 max-w-sm text-sm text-ink-600">{error}</p>
      <p className="mx-auto mt-2 max-w-sm text-sm text-ink-600">
        Confirmation links expire, and each one can only be used once. Sign in and we
        will send you a fresh one.
      </p>
      <Button variant="secondary" size="lg" className="mt-6 w-full" onClick={() => onNavigate("login")}>
        Log in
      </Button>
    </div>
  );
}
