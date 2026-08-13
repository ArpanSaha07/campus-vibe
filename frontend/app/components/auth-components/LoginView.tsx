"use client";

import { useState } from "react";
import { useAuth } from "@/app/lib/auth-context";
import { parseApiError } from "@/app/lib/auth-errors";
import { hasErrors, validateLogin, type AuthFieldErrors } from "@/app/lib/validators/authValidator";
import Button from "@/app/components/ui/Button";
import AuthTextField from "@/app/components/auth-components/AuthTextField";
import AuthDivider from "@/app/components/auth-components/AuthDivider";
import GoogleAuthButton from "@/app/components/auth-components/GoogleAuthButton";
import { AUTH_MODAL_TITLE_ID, type AuthModalView } from "@/app/lib/auth-modal-context";

export default function LoginView({
  onNavigate,
  onSuccess,
}: {
  onNavigate: (view: AuthModalView) => void;
  onSuccess: () => void;
}) {
  const { login } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fieldErrors, setFieldErrors] = useState<AuthFieldErrors>({});
  const [formError, setFormError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setFormError("");

    const errors = validateLogin(email, password);
    setFieldErrors(errors);
    if (hasErrors(errors)) return;

    setLoading(true);
    try {
      await login(email.trim(), password);
      onSuccess();
    } catch (err) {
      setFormError(parseApiError(err, "That email and password did not match."));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div>
      <h2
        id={AUTH_MODAL_TITLE_ID}
        className="font-display mb-7 text-center text-3xl font-bold text-ink-900"
      >
        Log in to CampusVibe
      </h2>

      <GoogleAuthButton label="Log in with Google" onSuccess={onSuccess} disabled={loading} />

      <AuthDivider />

      <form onSubmit={handleSubmit} noValidate>
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
          autoComplete="current-password"
          disabled={loading}
        />

        {formError && <p className="mb-4 text-sm text-alert-600">{formError}</p>}

        <Button type="submit" size="lg" className="w-full" disabled={loading}>
          {loading ? "Logging in..." : "Log in"}
        </Button>
      </form>

      <button
        type="button"
        onClick={() => onNavigate("recover")}
        className="mt-4 block w-full text-center text-sm font-semibold text-lavender-600 hover:text-lavender-800"
      >
        Forgot password?
      </button>

      <p className="mt-4 text-center text-sm text-ink-600">
        Do not have an account yet?{" "}
        <button
          type="button"
          onClick={() => onNavigate("signup")}
          className="font-semibold text-lavender-600 hover:text-lavender-800"
        >
          Sign up
        </button>
      </p>
    </div>
  );
}
