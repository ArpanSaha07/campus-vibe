"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useAuth } from "@/app/lib/auth-context";
import { parseApiError } from "@/app/lib/auth-errors";
import Button from "@/app/components/ui/Button";

// A "Continue with Google" button whose styling we own.
//
// The backend's GoogleTokenVerifier checks a Google *ID token*, and Google
// Identity Services only hands one out through `accounts.id`. Its rendered
// button cannot be restyled — it is Google-controlled markup — so the design's
// border-only hover is impossible on it. The workaround is the standard one:
// render Google's button into a visually hidden box and forward clicks to it
// from the button the design actually calls for. `.click()` inside a real click
// handler keeps the user-activation Google needs to open its popup.
//
// The alternative was the OAuth code flow (`accounts.oauth2`), which allows a
// fully custom button but returns an auth code, not an ID token — that would
// mean rewriting GoogleTokenVerifier and AuthenticationService too.

function GoogleGlyph() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true">
      <path
        fill="#4285F4"
        d="M17.64 9.2c0-.64-.06-1.25-.16-1.84H9v3.48h4.84a4.14 4.14 0 0 1-1.8 2.72v2.26h2.92c1.7-1.57 2.68-3.88 2.68-6.62Z"
      />
      <path
        fill="#34A853"
        d="M9 18c2.43 0 4.47-.8 5.96-2.18l-2.92-2.26c-.8.54-1.84.86-3.04.86-2.34 0-4.32-1.58-5.03-3.7H.96v2.33A9 9 0 0 0 9 18Z"
      />
      <path
        fill="#FBBC05"
        d="M3.97 10.72a5.4 5.4 0 0 1 0-3.44V4.95H.96a9 9 0 0 0 0 8.1l3.01-2.33Z"
      />
      <path
        fill="#EA4335"
        d="M9 3.58c1.32 0 2.5.45 3.44 1.35l2.58-2.58C13.46.89 11.42 0 9 0A9 9 0 0 0 .96 4.95l3.01 2.33C4.68 5.16 6.66 3.58 9 3.58Z"
      />
    </svg>
  );
}

export default function GoogleAuthButton({
  label,
  onSuccess,
  disabled,
}: {
  label: string;
  /** Called after the token exchange succeeds — used to close the modal. */
  onSuccess?: () => void;
  disabled?: boolean;
}) {
  const hiddenRef = useRef<HTMLDivElement | null>(null);
  const [ready, setReady] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const { googleSignIn } = useAuth();
  const clientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;

  // onSuccess through a ref so a caller passing an inline arrow does not
  // re-run the GIS setup — renderButton would append a second button each time.
  const onSuccessRef = useRef(onSuccess);
  useEffect(() => {
    onSuccessRef.current = onSuccess;
  }, [onSuccess]);

  useEffect(() => {
    if (!clientId) return;
    // Re-bound after the guard so `initialize` sees a `string` rather than the
    // component-scope `string | undefined`; GIS silently renders nothing when
    // client_id is undefined.
    const resolvedClientId = clientId;
    let cancelled = false;

    function init() {
      const google = window.google;
      if (!google?.accounts?.id || !hiddenRef.current || cancelled) return;

      google.accounts.id.initialize({
        client_id: resolvedClientId,
        callback: async (response) => {
          const idToken = response?.credential;
          if (!idToken) {
            setError("Google did not return a sign-in token.");
            return;
          }
          setPending(true);
          setError("");
          try {
            await googleSignIn(idToken);
            onSuccessRef.current?.();
          } catch (err) {
            setError(parseApiError(err, "Google sign-in failed."));
          } finally {
            setPending(false);
          }
        },
        error_callback: () => setError("Google sign-in could not start."),
      });

      // Cleared first so a re-run cannot stack two Google buttons in the box.
      hiddenRef.current.innerHTML = "";
      google.accounts.id.renderButton(hiddenRef.current, {
        theme: "outline",
        size: "large",
        type: "standard",
        text: "continue_with",
        width: 320,
      });
      setReady(true);
    }

    const src = "https://accounts.google.com/gsi/client";
    const existing = document.querySelector<HTMLScriptElement>(`script[src="${src}"]`);

    if (window.google?.accounts?.id) {
      init();
    } else if (existing) {
      existing.addEventListener("load", init, { once: true });
    } else {
      const script = document.createElement("script");
      script.src = src;
      script.async = true;
      script.defer = true;
      script.onload = init;
      document.head.appendChild(script);
    }

    return () => {
      cancelled = true;
    };
  }, [clientId, googleSignIn]);

  const handleClick = useCallback(() => {
    // Google renders its clickable surface as div[role=button]; the fallback
    // covers a markup change on their side without breaking the flow silently.
    const target =
      hiddenRef.current?.querySelector<HTMLElement>('div[role="button"]') ??
      hiddenRef.current?.querySelector<HTMLElement>("button");
    if (!target) {
      setError("Google sign-in is not ready yet. Try again in a moment.");
      return;
    }
    setError("");
    target.click();
  }, []);

  if (!clientId) {
    return (
      <p className="rounded-xl bg-mist-100 px-4 py-3 text-center text-sm text-ink-600">
        Google sign-in is not configured.
      </p>
    );
  }

  return (
    <div>
      <Button
        variant="outline"
        size="lg"
        className="w-full"
        onClick={handleClick}
        disabled={disabled || pending || !ready}
      >
        <GoogleGlyph />
        {pending ? "Signing you in..." : label}
      </Button>

      {/* Google's own button. Kept in the DOM because it is the only thing that
          can start the ID-token flow, clipped to nothing because it cannot be
          styled to match. */}
      <div className="relative h-0 overflow-hidden" aria-hidden="true">
        <div ref={hiddenRef} className="pointer-events-none absolute top-0 left-0 opacity-0" />
      </div>

      {error && <p className="mt-2 text-sm text-alert-600">{error}</p>}
    </div>
  );
}
