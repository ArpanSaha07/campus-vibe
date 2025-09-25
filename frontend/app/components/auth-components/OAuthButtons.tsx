"use client";
import { useEffect, useRef, useState } from "react";
import { googleSignIn } from "@/app/lib/user";

export default function OAuthButtons() {
  const buttonRef = useRef<HTMLDivElement | null>(null);
  const [gisReady, setGisReady] = useState(false);
  const clientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;

  useEffect(() => {
    if (!clientId) return; // No client id set, skip GIS initialization

    function init() {
      const google = (window as any).google;
      if (!google?.accounts?.id) return;

      google.accounts.id.initialize({
        client_id: clientId,
        callback: async (response: any) => {
          const idToken = response?.credential;
          if (!idToken) return;
          await googleSignIn(idToken);
          window.location.href = "/";
        },
        auto_select: false,
        ux_mode: "popup",
      });

      if (buttonRef.current) {
        google.accounts.id.renderButton(buttonRef.current, {
          theme: "outline",
          size: "large",
          type: "standard",
          text: "continue_with",
          shape: "rectangular",
        });
      }

      setGisReady(true);
    }

    // Load GIS script if not present
    const existing = document.querySelector<HTMLScriptElement>(
      'script[src="https://accounts.google.com/gsi/client"]'
    );
    if (existing) {
      existing.addEventListener("load", init, { once: true });
      // If it's already loaded, init immediately
      if ((window as any).google?.accounts?.id) init();
      return () => existing.removeEventListener("load", init);
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
  }, [clientId]);

  async function handleGoogleDevFallback() {
    const idToken = window.prompt("Paste Google ID token:") || "";
    if (!idToken) return;
    await googleSignIn(idToken);
    window.location.href = "/";
  }

  return (
    <div>
      <div className="flex items-center my-4">
        <hr className="flex-grow border-t border-gray-300" />
        <span className="px-2 text-sm text-gray-500">Or sign in with</span>
        <hr className="flex-grow border-t border-gray-300" />
      </div>
      <div className="flex flex-col items-center gap-3">
        {/* Google Identity Services button renders here when configured */}
        {clientId ? (
          <div ref={buttonRef} />
        ) : (
          <p className="text-xs text-gray-500">
            NEXT_PUBLIC_GOOGLE_CLIENT_ID is not set; using dev fallback.
          </p>
        )}
        {/* Fallback for local/dev without GIS or missing client id */}
        <button
          type="button"
          className="px-4 py-2 border rounded text-sm"
          onClick={handleGoogleDevFallback}
        >
          Continue with Google (dev)
        </button>
      </div>
    </div>
  );
}
