"use client";
import { useEffect, useRef, useState } from "react";
import { useAuth } from "@/app/lib/auth-context";

export default function OAuthButtons() {
  const buttonRef = useRef<HTMLDivElement | null>(null);
  const [gisReady, setGisReady] = useState(false);
  const [error, setError] = useState("");
  const { googleSignIn } = useAuth();
  const clientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;

  useEffect(() => {
    if (!clientId) return;

    function init() {
      const google = (window as any).google;
      if (!google?.accounts?.id) return;

      google.accounts.id.initialize({
        client_id: clientId,
        callback: async (response: any) => {
          const idToken = response?.credential;
          if (!idToken) {
            setError("Failed to get Google token");
            return;
          }
          try {
            await googleSignIn(idToken);
            window.location.href = "/";
          } catch (err) {
            setError(err instanceof Error ? err.message : "Google sign-in failed");
          }
        },
        error_callback: () => {
          setError("Google sign-in initialization failed");
        },
      });

      if (buttonRef.current) {
        google.accounts.id.renderButton(buttonRef.current, {
          theme: "outline",
          size: "large",
          type: "standard",
          text: "continue_with",
        });
      }

      setGisReady(true);
    }

    const existing = document.querySelector<HTMLScriptElement>(
      'script[src="https://accounts.google.com/gsi/client"]'
    );

    if (existing) {
      if ((window as any).google?.accounts?.id) {
        init();
      } else {
        existing.addEventListener("load", init, { once: true });
      }
      return;
    }

    const script = document.createElement("script");
    script.src = "https://accounts.google.com/gsi/client";
    script.async = true;
    script.defer = true;
    script.onload = init;
    document.head.appendChild(script);

    return () => {
      script.onload = null;
    };
  }, [clientId, googleSignIn]);

  return (
    <div>
      <div className="flex items-center my-4">
        <hr className="flex-grow border-t border-gray-300" />
        <span className="px-2 text-sm text-gray-500">Or sign in with</span>
        <hr className="flex-grow border-t border-gray-300" />
      </div>
      <div className="flex flex-col items-center gap-3">
        {clientId ? (
          <div ref={buttonRef} />
        ) : (
          <p className="text-xs text-gray-500">
            Google sign-in not configured
          </p>
        )}
        {error && <p className="text-red-500 text-xs">{error}</p>}
      </div>
    </div>
  );
}

