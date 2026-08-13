"use client";

import { useId, useState } from "react";
import { Eye, EyeOff } from "lucide-react";

// Labelled input for the auth modal. Password fields get a reveal toggle, which
// matters most here: these forms are where a typo costs you the whole attempt.
// Styling follows .claude/design-guidelines.md — mist-100 fill, radius 12,
// transparent border that turns lavender on focus.

export default function AuthTextField({
  label,
  type = "text",
  value,
  onChange,
  error,
  autoComplete,
  disabled,
  minLength,
  required = true,
  autoFocus,
}: {
  label: string;
  type?: "text" | "email" | "password";
  value: string;
  onChange: (value: string) => void;
  error?: string;
  autoComplete?: string;
  disabled?: boolean;
  minLength?: number;
  required?: boolean;
  autoFocus?: boolean;
}) {
  const id = useId();
  const errorId = `${id}-error`;
  const [revealed, setRevealed] = useState(false);
  const isPassword = type === "password";

  const borderClasses = error
    ? "border-alert-600 bg-white"
    : "border-transparent bg-mist-100 focus:bg-white focus:border-lavender-300";

  return (
    <div className="mb-4">
      <label htmlFor={id} className="mb-1.5 block text-sm font-semibold text-ink-900">
        {label}
      </label>
      <div className="relative">
        <input
          id={id}
          type={isPassword && revealed ? "text" : type}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          autoComplete={autoComplete}
          disabled={disabled}
          minLength={minLength}
          required={required}
          autoFocus={autoFocus}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? errorId : undefined}
          className={`w-full rounded-xl border px-4 py-2.5 text-ink-900 outline-none transition-colors
            ${isPassword ? "pr-11" : ""} ${borderClasses}`}
        />
        {isPassword && (
          <button
            type="button"
            onClick={() => setRevealed((r) => !r)}
            aria-label={revealed ? "Hide password" : "Show password"}
            className="absolute top-1/2 right-3 -translate-y-1/2 rounded-full p-1 text-ink-600 hover:text-ink-900"
          >
            {revealed ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
          </button>
        )}
      </div>
      {error && (
        <p id={errorId} className="mt-1.5 text-sm text-alert-600">
          {error}
        </p>
      )}
    </div>
  );
}
