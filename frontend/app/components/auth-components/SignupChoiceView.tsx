"use client";

import Button from "@/app/components/ui/Button";
import GoogleAuthButton from "@/app/components/auth-components/GoogleAuthButton";
import AuthDivider from "@/app/components/auth-components/AuthDivider";
import { AUTH_MODAL_TITLE_ID, type AuthModalView } from "@/app/lib/auth-modal-context";

// Method picker. Nothing is asked of the user yet — Google is one click, and
// the email form only appears for people who want it.

export default function SignupChoiceView({
  title,
  onNavigate,
  onSuccess,
}: {
  title?: string;
  onNavigate: (view: AuthModalView) => void;
  onSuccess: () => void;
}) {
  return (
    <div>
      <h2
        id={AUTH_MODAL_TITLE_ID}
        className="font-display mb-7 text-center text-3xl font-bold text-ink-900"
      >
        {title ?? "Sign up to CampusVibe"}
      </h2>

      <GoogleAuthButton label="Continue with Google" onSuccess={onSuccess} />

      <AuthDivider />

      <Button
        variant="secondary"
        size="lg"
        className="w-full"
        onClick={() => onNavigate("signup-email")}
      >
        Sign up with email
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
    </div>
  );
}
