"use client";

import { useState } from "react";
import { CheckCircle2 } from "lucide-react";
import { resetPassword } from "@/app/lib/user";
import { parseApiError } from "@/app/lib/auth-errors";
import Button from "@/app/components/ui/Button";
import AuthTextField from "@/app/components/auth-components/AuthTextField";
import { AUTH_MODAL_TITLE_ID, type AuthModalView } from "@/app/lib/auth-modal-context";
import { MIN_PASSWORD_LENGTH } from "@/app/lib/validators/authValidator";

// Where a reset email lands: /?auth=reset-password&token=…
// AuthModalUrlTrigger pulls the token off the URL and hands it here, then
// strips it — a reset token in the address bar survives in history and in
// anything the user pastes.

export default function ResetPasswordView({
  token,
  onNavigate,
}: {
  token: string | null;
  onNavigate: (view: AuthModalView) => void;
}) {
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [fieldError, setFieldError] = useState<string | undefined>();
  const [formError, setFormError] = useState("");
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setFormError("");

    if (password.length < MIN_PASSWORD_LENGTH) {
      setFieldError(`Password must be at least ${MIN_PASSWORD_LENGTH} characters`);
      return;
    }
    if (password !== confirm) {
      setFieldError("The two passwords do not match");
      return;
    }
    setFieldError(undefined);

    if (!token) {
      setFormError("This reset link is incomplete. Request a new one.");
      return;
    }

    setLoading(true);
    try {
      await resetPassword(token, password);
      setDone(true);
    } catch (err) {
      setFormError(parseApiError(err, "This reset link is invalid or has expired."));
    } finally {
      setLoading(false);
    }
  }

  if (done) {
    return (
      <div className="text-center">
        <span className="mb-5 inline-flex h-16 w-16 items-center justify-center rounded-full bg-lavender-100 text-lavender-600">
          <CheckCircle2 className="h-7 w-7" />
        </span>
        <h2 id={AUTH_MODAL_TITLE_ID} className="font-display text-2xl font-bold text-ink-900">
          Password updated
        </h2>
        <p className="mx-auto mt-2 max-w-sm text-sm text-ink-600">
          You can now sign in with your new password.
        </p>
        <Button size="lg" className="mt-6 w-full" onClick={() => onNavigate("login")}>
          Log in
        </Button>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} noValidate>
      <h2 id={AUTH_MODAL_TITLE_ID} className="font-display mb-2 text-3xl font-bold text-ink-900">
        Choose a new password
      </h2>
      <p className="mb-6 text-sm text-ink-600">
        Pick something you have not used here before.
      </p>

      <AuthTextField
        label="New password"
        type="password"
        value={password}
        onChange={setPassword}
        autoComplete="new-password"
        minLength={MIN_PASSWORD_LENGTH}
        disabled={loading}
        autoFocus
      />
      <AuthTextField
        label="Confirm new password"
        type="password"
        value={confirm}
        onChange={setConfirm}
        error={fieldError}
        autoComplete="new-password"
        disabled={loading}
      />

      {formError && (
        <p className="mb-4 text-sm text-alert-600">
          {formError}{" "}
          <button
            type="button"
            onClick={() => onNavigate("recover")}
            className="font-semibold text-lavender-600 hover:text-lavender-800"
          >
            Request a new link
          </button>
        </p>
      )}

      <Button type="submit" size="lg" className="w-full" disabled={loading}>
        {loading ? "Saving..." : "Save new password"}
      </Button>
    </form>
  );
}
