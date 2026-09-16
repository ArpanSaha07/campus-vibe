"use client";

import { useEffect, useState, type ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { PanelLeft, SquarePen, X } from "lucide-react";
import ConversationSidebar from "@/app/components/planner/ConversationSidebar";
import { usePlanner } from "@/app/components/planner/PlannerProvider";

/** The chat id in `/planner/{id}`, or null on a new chat. */
function activeIdFrom(pathname: string): string | null {
  const match = pathname.match(/^\/planner\/([^/]+)/);
  return match ? decodeURIComponent(match[1]) : null;
}

/**
 * Two panes under the navbar: saved chats on the left, the conversation on the
 * right. Below `lg` the chat list moves into a drawer opened from a slim bar,
 * so the conversation keeps the full width of a phone.
 */
export default function PlannerShell({ children }: { children: ReactNode }) {
  const { status, conversations, usage, remove } = usePlanner();
  const pathname = usePathname();
  const activeId = activeIdFrom(pathname);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const signedIn = status === "ready";

  // Any navigation closes the drawer, including Back.
  useEffect(() => setDrawerOpen(false), [pathname]);

  useEffect(() => {
    if (!drawerOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setDrawerOpen(false);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [drawerOpen]);

  const activeTitle = activeId
    ? (conversations.find((c) => c.id === activeId)?.title ?? "Chat")
    : "New chat";

  const sidebar = (onNavigate?: () => void) => (
    <ConversationSidebar
      conversations={conversations}
      activeId={activeId}
      usage={usage}
      onDelete={remove}
      onNavigate={onNavigate}
    />
  );

  return (
    <div className="flex min-h-0 flex-1">
      {signedIn && (
        <aside className="hidden w-[280px] flex-shrink-0 border-r border-mist-200 bg-mist-100 lg:block">
          {sidebar()}
        </aside>
      )}

      <div className="flex min-w-0 flex-1 flex-col">
        {signedIn && (
          <div className="flex h-12 flex-shrink-0 items-center justify-between border-b border-mist-200 bg-mist-100 px-1 lg:hidden">
            <button
              type="button"
              onClick={() => setDrawerOpen(true)}
              aria-label="Open chats"
              aria-expanded={drawerOpen}
              aria-controls="planner-drawer"
              className="flex h-11 w-11 items-center justify-center rounded-full text-ink-900 hover:bg-lavender-50"
            >
              <PanelLeft className="h-5 w-5" aria-hidden="true" />
            </button>
            <span className="min-w-0 flex-1 truncate text-center text-sm font-semibold text-ink-900">
              {activeTitle}
            </span>
            <Link
              href="/planner"
              aria-label="New chat"
              className="flex h-11 w-11 items-center justify-center rounded-full text-ink-900 hover:bg-lavender-50"
            >
              <SquarePen className="h-5 w-5" aria-hidden="true" />
            </Link>
          </div>
        )}

        {children}
      </div>

      {signedIn && drawerOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <button
            type="button"
            aria-label="Close chats"
            tabIndex={-1}
            onClick={() => setDrawerOpen(false)}
            className="absolute inset-0 bg-ink-900/40"
          />
          <div
            id="planner-drawer"
            role="dialog"
            aria-modal="true"
            aria-label="Planner chats"
            className="absolute inset-y-0 left-0 flex w-[300px] max-w-[85vw] flex-col bg-mist-100 shadow-lift"
          >
            <div className="flex justify-end px-1 pt-1">
              <button
                type="button"
                onClick={() => setDrawerOpen(false)}
                aria-label="Close chats"
                className="flex h-11 w-11 items-center justify-center rounded-full text-ink-900 hover:bg-lavender-50"
              >
                <X className="h-5 w-5" aria-hidden="true" />
              </button>
            </div>
            <div className="min-h-0 flex-1">{sidebar(() => setDrawerOpen(false))}</div>
          </div>
        </div>
      )}
    </div>
  );
}
