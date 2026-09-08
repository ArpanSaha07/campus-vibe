"use client";
import { useEffect } from "react";

/**
 * Preloads Google Identity Services once, at the app root, so the script is
 * already in flight by the time a sign-in button mounts.
 *
 * It deliberately holds no "loaded" state and gates nothing on it. Children
 * render immediately, and `GoogleAuthButton` owns the whole readiness
 * question itself — it re-checks `window.google`, reuses an existing script
 * tag and waits on its `load` event (GoogleAuthButton.tsx). This component is
 * a head start, not a gate; a flag here would have been dead either way.
 */
export function GoogleProvider({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    const src = "https://accounts.google.com/gsi/client";
    if (document.querySelector(`script[src="${src}"]`)) {
      return;
    }
    const s = document.createElement("script");
    s.src = src;
    s.async = true;
    s.defer = true;
    document.head.appendChild(s);
  }, []);

  return <>{children}</>;
}
