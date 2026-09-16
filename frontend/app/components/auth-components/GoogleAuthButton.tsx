"use client";

import { useEffect, useRef, useState } from "react";
import { useAuth } from "@/app/lib/auth-context";
import { parseApiError } from "@/app/lib/auth-errors";

// Google's own Sign in with Google button, rendered by Google Identity
// Services and styled only through the options GIS exposes.
//
// It used to be a button of ours with Google's real one hidden behind it and
// clicks forwarded by `.click()`. That broke on 2026-09-15: GIS began serving
// the button to newer Chrome as a cross-origin iframe
// (`accounts.google.com/gsi/button`), and nothing in our page can click into
// one. The selector found no `div[role="button"]`, so every click answered
// "not ready yet" while the script, the client id and the origin were all
// fine (BUG-057). The proxy depended on Google's private DOM, which was never
// ours to depend on — the shape changed under us with no warning and no error.
// ADR-018 records the choice to stop.
//
// The cost is visible and deliberate: `theme`, `size`, `shape` and `text` are
// the whole of our control, so the border-only hover of the `outline` Button
// variant is impossible here. `theme: "outline"` with `shape: "pill"` is the
// closest the API comes to the design's white, full-radius, mist-bordered
// button (design-guidelines.md:64,75).

const GIS_SRC = "https://accounts.google.com/gsi/client";

// GIS accepts 200-400; outside that it falls back to its own default width.
const MIN_WIDTH = 200;
const MAX_WIDTH = 400;

// How long GIS gets to paint before we call it a failure. Generous, because
// the alternative — telling a user on a slow connection that sign-in is broken
// — is worse than a few seconds of reserved space.
const RENDER_TIMEOUT_MS = 8000;

/** `loading` reserves space; `unavailable` is the honest version of BUG-057. */
type Status = "loading" | "ready" | "unavailable";

export default function GoogleAuthButton({
  text,
  onSuccess,
  disabled,
}: {
  /** Maps to the GIS `text` option — Google owns the wording, we pick which. */
  text: "signin_with" | "continue_with";
  /** Called after the token exchange succeeds — used to close the modal. */
  onSuccess?: () => void;
  disabled?: boolean;
}) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [status, setStatus] = useState<Status>("loading");
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
    const container = containerRef.current;
    if (!container) return;

    let cancelled = false;
    let initialised = false;
    let renderedWidth = 0;

    // GIS paints asynchronously and reports nothing when it paints nothing —
    // no exception, no console error, no callback. Watching the container is
    // the only way to tell a slow render from a failed one, and BUG-057 was
    // exactly the failed one.
    const observer = new MutationObserver(() => {
      if (!cancelled && container.childElementCount > 0) setStatus("ready");
    });
    observer.observe(container, { childList: true });

    const timeout = setTimeout(() => {
      if (!cancelled && container.childElementCount === 0) setStatus("unavailable");
    }, RENDER_TIMEOUT_MS);

    function fail() {
      if (!cancelled) setStatus("unavailable");
    }

    function paint() {
      const google = window.google;
      // Re-read through the ref rather than closing over the narrowed
      // `container`: `paint` is hoisted, so TypeScript cannot know the guard
      // above already ran by the time GIS calls it back.
      const node = containerRef.current;
      if (!google?.accounts?.id || !node || cancelled) return;

      if (!initialised) {
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
        initialised = true;
      }

      // Google's button is a fixed pixel width, not a fluid one, so it is
      // measured from the container rather than hardcoded — the old 320 was
      // narrower than the modal it sat in. Falls back to the maximum where
      // there is nothing to measure (jsdom, or a container not yet laid out).
      const measured = Math.round(node.getBoundingClientRect().width);
      const width = Math.min(Math.max(measured || MAX_WIDTH, MIN_WIDTH), MAX_WIDTH);
      if (width === renderedWidth) return;
      renderedWidth = width;

      // Cleared first so a re-render cannot stack two Google buttons in the box.
      node.innerHTML = "";
      google.accounts.id.renderButton(node, {
        theme: "outline",
        size: "large",
        type: "standard",
        shape: "pill",
        text,
        width,
      });
    }

    paint();

    // Re-measure when the viewport changes under the modal. Guarded because a
    // missing ResizeObserver must degrade to a button at its first width, not
    // to no button at all.
    let resize: ResizeObserver | undefined;
    if (typeof ResizeObserver !== "undefined") {
      resize = new ResizeObserver(() => paint());
      resize.observe(container);
    }

    const existing = document.querySelector<HTMLScriptElement>(`script[src="${GIS_SRC}"]`);
    if (!window.google?.accounts?.id) {
      if (existing) {
        existing.addEventListener("load", paint, { once: true });
        existing.addEventListener("error", fail, { once: true });
      } else {
        const script = document.createElement("script");
        script.src = GIS_SRC;
        script.async = true;
        script.defer = true;
        script.onload = paint;
        script.onerror = fail;
        document.head.appendChild(script);
      }
    }

    return () => {
      cancelled = true;
      observer.disconnect();
      resize?.disconnect();
      clearTimeout(timeout);
    };
  }, [clientId, googleSignIn, text]);

  if (!clientId) {
    return (
      <p className="rounded-xl bg-mist-100 px-4 py-3 text-center text-sm text-ink-600">
        Google sign-in is not configured.
      </p>
    );
  }

  return (
    <div>
      {/* Google's button, painted here by GIS. `min-h` reserves its height so
          the modal does not jump when it arrives. Nothing of ours goes inside:
          whatever GIS puts here is the real, clickable control. */}
      <div
        ref={containerRef}
        data-testid="google-button-container"
        className={`flex min-h-[44px] items-center justify-center ${
          disabled || pending ? "pointer-events-none opacity-50" : ""
        }`}
      />

      {status === "unavailable" && (
        <p className="mt-2 text-sm text-alert-600">
          Google sign-in could not load. Check your connection, or use the email option instead.
        </p>
      )}
      {pending && <p className="mt-2 text-center text-sm text-ink-600">Signing you in...</p>}
      {error && <p className="mt-2 text-sm text-alert-600">{error}</p>}
    </div>
  );
}
