"use client";

import { useState } from "react";
import { MailCheck } from "lucide-react";
import { validateEmail } from "@/app/lib/validators/authValidator";
import Button from "@/app/components/ui/Button";
import AuthTextField from "@/app/components/auth-components/AuthTextField";
import { AUTH_MODAL_TITLE_ID, type AuthModalView } from "@/app/lib/auth-modal-context";

// NOT WIRED UP. The backend has no password reset — AuthenticationController
// exposes login, register and google only, and there is no reset-token table or
// mail sender behind it. Submitting validates the address and shows the
// confirmation, but sends nothing. Tracked as a P1 in .claude/TODO/todo.md;
// the request belongs on the line marked TODO below once the endpoint lands.

export default function RecoverPasswordView({
  onNavigate,
}: {
  onNavigate: (view: AuthModalView) => void;
}) {
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | undefined>();
  const [sent, setSent] = useState(false);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const emailError = validateEmail(email);
    setError(emailError);
    if (emailError) return;
    // TODO: await requestPasswordReset(email.trim()) once
    // POST /api/v1/auth/forgot-password exists.
    setSent(true);
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
        autoFocus
      />

      <Button type="submit" size="lg" className="mt-2 w-full">
        Send link
      </Button>
    </form>
  );
}
