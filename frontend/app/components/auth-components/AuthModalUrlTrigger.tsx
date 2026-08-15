"use client";

import { useEffect } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useAuthModal, type AuthModalView } from "@/app/lib/auth-modal-context";

// The bridge between server-side auth checks and a client-side modal.
//
// Auth is a modal now, not a page, and a Server Component or middleware cannot
// call `openAuth`. All they can do is redirect. So they redirect to `/?auth=login`
// and this component turns that parameter back into an open modal.
//
// The parameter is stripped immediately afterwards: without that, dismissing the
// modal leaves a URL that re-opens it on the next refresh, and any link the user
// copied would carry the prompt to whoever they sent it to.

const VIEWS: readonly AuthModalView[] = [
  "signup",
  "signup-email",
  "login",
  "recover",
  "reset-password",
  "verify-email",
];

export default function AuthModalUrlTrigger() {
  const searchParams = useSearchParams();
  const pathname = usePathname();
  const router = useRouter();
  const { openAuth } = useAuthModal();

  const requested = searchParams.get("auth");
  const token = searchParams.get("token");

  useEffect(() => {
    if (!requested) return;

    // Anything unrecognised still opens the modal rather than failing silently —
    // the user was sent here because they need to sign in either way.
    const view = VIEWS.includes(requested as AuthModalView)
      ? (requested as AuthModalView)
      : "login";
    openAuth(view, undefined, token ?? undefined);

    const rest = new URLSearchParams(searchParams);
    rest.delete("auth");
    // The token is a live single-use credential. Leaving it in the address bar
    // puts it in browser history and in any URL the user copies out.
    rest.delete("token");
    const query = rest.toString();
    router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
  }, [requested, token, searchParams, pathname, router, openAuth]);

  return null;
}
