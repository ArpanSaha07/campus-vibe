"use client";

import { useState } from "react";
import { MailCheck } from "lucide-react";
import { validateEmail } from "@/app/lib/validators/authValidator";
import { requestPasswordReset } from "@/app/lib/user";
import Button from "@/app/components/ui/Button";
import AuthTextField from "@/app/components/auth-components/AuthTextField";
import { AUTH_MODAL_TITLE_ID, type AuthModalView } from "@/app/lib/auth-modal-context";

// Asks the backend to mail a reset link.
//
// The confirmation below is shown whatever the answer, and the request is not
// awaited for its result: POST /forgot-password returns 204 for an unknown
// address, for a Google account, and for a real one alike. Reporting a failure
// here would undo that on the client and turn this screen into an account
// oracle. Errors are swallowed for the same reason.

export default function RecoverPasswordView({
  onNavigate,
}: {
  onNavigate: (view: AuthModalView) => void;
}) {
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | undefined>();
  const [sent, setSent] = useState(false);
  const [sending, setSending] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const emailError = validateEmail(email);
    setError(emailError);
    if (emailError) return;

    setSending(true);
    try {
      await requestPasswordReset(email.trim());
    } catch {
      // Deliberately ignored — see the note at the top of this file.
    } finally {
      setSending(false);
      setSent(true);
    }
  }

  if (sent) {
    return (
      <div className="text-center">
        <span className="mb-5 inline-flex h-16 w-16 items-center justify-center rounded-full bg-lavender-100 text-lavender-600">
          <MailCheck className="h-7 w-7" />
        </span>
        <h2 id={AUTH_MODAL_TITLE_ID} className="font-display text-2xl font-bold text-ink-900">
          Check your email
        </h2>
        <p className="mx-auto mt-2 max-w-sm text-sm text-ink-600">
          If an account exists for {email.trim()}, we sent it a link to reset the password. The
          link expires in one hour.
        </p>
        <Button variant="secondary" size="lg" className="mt-6 w-full" onClick={() => onNavigate("login")}>
          Back to log in
        </Button>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} noValidate>
      <h2 id={AUTH_MODAL_TITLE_ID} className="font-display mb-2 text-3xl font-bold text-ink-900">
        Recover password
      </h2>
      <p className="mb-6 text-sm text-ink-600">
        Enter the email associated with your account and we will send you a secure link to reset
        your password.
      </p>

      <AuthTextField
        label="Email"
        type="email"
        value={email}
        onChange={setEmail}
        error={error}
        autoComplete="email"
        disabled={sending}
        autoFocus
      />

      <Button type="submit" size="lg" className="mt-2 w-full" disabled={sending}>
        {sending ? "Sending..." : "Send link"}
      </Button>
    </form>
  );
}
