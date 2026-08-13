"use client";

import { useState } from "react";
import { useAuth } from "@/app/lib/auth-context";
import { parseApiError } from "@/app/lib/auth-errors";
import {
  hasErrors,
  validateSignup,
  MIN_PASSWORD_LENGTH,
  type AuthFieldErrors,
} from "@/app/lib/validators/authValidator";
import Button from "@/app/components/ui/Button";
import AuthTextField from "@/app/components/auth-components/AuthTextField";
import { AUTH_MODAL_TITLE_ID, type AuthModalView } from "@/app/lib/auth-modal-context";

export default function EmailSignupView({
  onNavigate,
  onSuccess,
}: {
  onNavigate: (view: AuthModalView) => void;
  onSuccess: () => void;
}) {
  const { register } = useAuth();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fieldErrors, setFieldErrors] = useState<AuthFieldErrors>({});
  const [formError, setFormError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setFormError("");

    const errors = validateSignup(name, email, password);
    setFieldErrors(errors);
    if (hasErrors(errors)) return;

    setLoading(true);
    try {
      await register(name.trim(), email.trim(), password);
      onSuccess();
    } catch (err) {
      setFormError(parseApiError(err, "We could not create your account."));
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} noValidate>
      <h2
        id={AUTH_MODAL_TITLE_ID}
        className="font-display mb-6 text-center text-3xl font-bold text-ink-900"
      >
        Sign up with email
      </h2>

      <AuthTextField
        label="Full name"
        value={name}
        onChange={setName}
        error={fieldErrors.name}
        autoComplete="name"
        disabled={loading}
        autoFocus
      />
      <AuthTextField
        label="Email"
        type="email"
        value={email}
        onChange={setEmail}
        error={fieldErrors.email}
        autoComplete="email"
        disabled={loading}
      />
      <AuthTextField
        label="Password"
        type="password"
        value={password}
        onChange={setPassword}
        error={fieldErrors.password}
        autoComplete="new-password"
        minLength={MIN_PASSWORD_LENGTH}
        disabled={loading}
      />

      {formError && <p className="mb-4 text-sm text-alert-600">{formError}</p>}

      <Button type="submit" size="lg" className="w-full" disabled={loading}>
        {loading ? "Creating account..." : "Sign up"}
      </Button>

      <p className="mt-6 text-center text-sm text-ink-600">
        Already have an account?{" "}
        <button
          type="button"
          onClick={() => onNavigate("login")}
          className="font-semibold text-lavender-600 hover:text-lavender-800"
        >
          Log in
        </button>
      </p>
    </form>
  );
}
