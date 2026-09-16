"use client";

import { useState } from "react";
import Link from "next/link";
import { Plus, Trash2 } from "lucide-react";
import { groupConversations, MAX_CONVERSATIONS } from "@/app/lib/planner";
import type { PlannerConversationSummary, PlannerUsage } from "@/app/types";

/**
 * Saved chats, newest first and grouped by day, with the daily usage meter at
 * the foot. The same panel renders fixed on desktop and in the phone drawer.
 */
export default function ConversationSidebar({
  conversations,
  activeId,
  usage,
  onDelete,
  onNavigate,
  now,
}: {
  conversations: PlannerConversationSummary[];
  activeId: string | null;
  usage: PlannerUsage | null;
  onDelete: (id: string) => Promise<void>;
  /** Called when a link inside is followed, so the drawer can close. */
  onNavigate?: () => void;
  /** Injected by tests; the grouping reads the clock otherwise. */
  now?: Date;
}) {
  const [confirmingId, setConfirmingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  async function confirmDelete(id: string) {
    setDeletingId(id);
    setDeleteError(null);
    try {
      await onDelete(id);
      setConfirmingId(null);
    } catch {
      setDeleteError("That chat could not be deleted. Try again.");
    } finally {
      setDeletingId(null);
    }
  }

  const groups = groupConversations(conversations, now);
  const atCap = conversations.length >= MAX_CONVERSATIONS;

  return (
    <nav aria-label="Planner chats" className="flex h-full flex-col px-3 py-4">
      <Link
        href="/planner"
        onClick={onNavigate}
        className="flex h-10 flex-shrink-0 items-center justify-center gap-2 rounded-full bg-lavender-600 text-sm font-semibold text-white transition-colors hover:bg-lavender-800"
      >
        <Plus className="h-4 w-4" aria-hidden="true" />
        New chat
      </Link>

      <div className="-mx-3 mt-2 min-h-0 flex-1 overflow-y-auto px-3">
        {groups.length === 0 && (
          <p className="px-3 pt-4 text-sm text-ink-600">Your chats will show up here.</p>
        )}
        {groups.map((group) => (
          <section key={group.label} aria-label={group.label}>
            <h2 className="ticket-label mt-5 mb-1 px-3 text-ink-600">{group.label}</h2>
            <ul className="flex flex-col gap-0.5">
              {group.conversations.map((conversation) => {
                const active = conversation.id === activeId;
                const title = conversation.title || "New chat";

                if (confirmingId === conversation.id) {
                  return (
                    <li
                      key={conversation.id}
                      className="rounded-xl border border-mist-200 bg-white px-3 py-2.5"
                    >
                      <p className="text-sm font-medium text-ink-900">Delete this chat?</p>
                      <p className="mt-0.5 truncate text-xs text-ink-600">{title}</p>
                      <div className="mt-2 flex gap-2">
                        <button
                          type="button"
                          onClick={() => confirmDelete(conversation.id)}
                          disabled={deletingId === conversation.id}
                          className="rounded-full bg-berry-600 px-3 py-1 text-xs font-semibold text-white hover:bg-berry-700 disabled:opacity-50"
                        >
                          {deletingId === conversation.id ? "Deleting…" : "Delete"}
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setConfirmingId(null);
                            setDeleteError(null);
                          }}
                          className="rounded-full px-3 py-1 text-xs font-semibold text-ink-900 hover:bg-lavender-50"
                        >
                          Cancel
                        </button>
                      </div>
                      {deleteError && (
                        <p role="alert" className="mt-2 text-xs text-alert-600">
                          {deleteError}
                        </p>
                      )}
                    </li>
                  );
                }

                return (
                  <li
                    key={conversation.id}
                    className={`group flex h-9 items-center gap-2 rounded-xl border pr-1 text-sm text-ink-900 ${
                      active
                        ? "border-mist-200 bg-white font-medium"
                        : "border-transparent hover:bg-white/70"
                    }`}
                  >
                    <Link
                      href={`/planner/${encodeURIComponent(conversation.id)}`}
                      onClick={onNavigate}
                      aria-current={active ? "page" : undefined}
                      className="min-w-0 flex-1 truncate py-2 pl-3"
                    >
                      {title}
                    </Link>
                    <button
                      type="button"
                      onClick={() => {
                        setConfirmingId(conversation.id);
                        setDeleteError(null);
                      }}
                      aria-label={`Delete ${title}`}
                      className={`flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-lg text-ink-600 hover:bg-lavender-50 hover:text-berry-600 focus-visible:opacity-100 ${
                        active ? "" : "opacity-0 group-hover:opacity-100"
                      }`}
                    >
                      <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                    </button>
                  </li>
                );
              })}
            </ul>
          </section>
        ))}
      </div>

      {usage && (
        <div className="flex flex-shrink-0 flex-col gap-2 border-t border-mist-200 px-3 pt-4 pb-1">
          <p className="text-[13px] font-medium text-ink-900">
            {Math.max(0, usage.limit - usage.used)} of {usage.limit} messages left today
          </p>
          <div
            role="meter"
            aria-label="Messages left today"
            aria-valuemin={0}
            aria-valuemax={usage.limit}
            aria-valuenow={Math.max(0, usage.limit - usage.used)}
            className="h-1.5 overflow-hidden rounded-full bg-lavender-200"
          >
            <div
              className="h-full rounded-full bg-lavender-600"
              style={{ width: `${usage.limit > 0 ? (Math.max(0, usage.limit - usage.used) / usage.limit) * 100 : 0}%` }}
            />
          </div>
          <div className="ticket-label flex justify-between text-ink-600">
            <span>Resets at midnight</span>
            <span className={atCap ? "text-berry-600" : undefined}>
              {conversations.length}/{MAX_CONVERSATIONS} chats
            </span>
          </div>
        </div>
      )}
    </nav>
  );
}
