"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { usePathname, useRouter } from "next/navigation";
import { ApiError } from "@/app/lib/api";
import { useAuth } from "@/app/lib/auth-context";
import {
  PlannerReplyError,
  createConversation,
  deleteConversation,
  getConversation,
  getUsage,
  listConversations,
  sendPlannerMessage,
} from "@/app/lib/planner-api";
import { titleFromPrompt } from "@/app/lib/planner";
import type { PlannerConversationSummary, PlannerMessage, PlannerUsage } from "@/app/types";

/**
 * Planner state that must outlive a route change.
 *
 * Mounted in the planner layout, which Next keeps across `/planner` and
 * `/planner/[conversationId]`. The first message of a new chat creates the
 * chat and moves the URL to it while the reply is still streaming, so the
 * thread and the stream cannot live in the page, which remounts on that move.
 */

export type PlannerStatus = "loading" | "guest" | "ready" | "unavailable";

export type ThreadState = {
  status: "loading" | "ready" | "missing" | "error";
  messages: PlannerMessage[];
};

interface PlannerContextValue {
  status: PlannerStatus;
  conversations: PlannerConversationSummary[];
  usage: PlannerUsage | null;
  threads: Record<string, ThreadState>;
  /** The chat whose reply is streaming. One reply streams at a time. */
  streamingId: string | null;
  /** Why the last attempt to start a new chat failed. */
  newChatError: string | null;
  reload: () => void;
  loadThread: (id: string) => void;
  /** Resolves true once the message is in a thread; false when nothing was sent. */
  send: (conversationId: string | null, text: string) => Promise<boolean>;
  retry: (conversationId: string, replyId: string) => void;
  stop: () => void;
  remove: (id: string) => Promise<void>;
}

const PlannerContext = createContext<PlannerContextValue | undefined>(undefined);

export function usePlanner(): PlannerContextValue {
  const value = useContext(PlannerContext);
  if (!value) throw new Error("usePlanner must be used inside PlannerProvider");
  return value;
}

/** A failure in words for the user; never the raw response body. */
export function plannerErrorMessage(err: unknown): string {
  if (err instanceof ApiError) {
    if (err.status === 429) return "You've used all of today's messages. They reset at midnight.";
    if (err.status === 503) return "The planner is unavailable right now. Try again in a few minutes.";
    if (err.status === 404) return "This chat no longer exists.";
  }
  if (err instanceof PlannerReplyError && err.message) return err.message;
  return "Something went wrong with that reply. Try again.";
}

function isAbort(err: unknown): boolean {
  return err instanceof DOMException && err.name === "AbortError";
}

function withConversation(
  list: PlannerConversationSummary[],
  summary: PlannerConversationSummary,
): PlannerConversationSummary[] {
  return [summary, ...list.filter((c) => c.id !== summary.id)];
}

export function PlannerProvider({ children }: { children: ReactNode }) {
  const { isAuthenticated, loading: authLoading } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  const [status, setStatus] = useState<PlannerStatus>("loading");
  const [conversations, setConversations] = useState<PlannerConversationSummary[]>([]);
  const [usage, setUsage] = useState<PlannerUsage | null>(null);
  const [threads, setThreads] = useState<Record<string, ThreadState>>({});
  const [streamingId, setStreamingId] = useState<string | null>(null);
  const [newChatError, setNewChatError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  const abortRef = useRef<AbortController | null>(null);
  const threadsRef = useRef(threads);
  threadsRef.current = threads;
  const localIds = useRef(0);

  useEffect(() => {
    if (authLoading) return;
    if (!isAuthenticated) {
      setStatus("guest");
      setConversations([]);
      setUsage(null);
      setThreads({});
      return;
    }
    let cancelled = false;
    setStatus("loading");
    listConversations()
      .then((body) => {
        if (cancelled) return;
        setConversations(body.conversations);
        setUsage(body.usage);
        setStatus("ready");
      })
      .catch(() => {
        if (!cancelled) setStatus("unavailable");
      });
    return () => {
      cancelled = true;
    };
  }, [authLoading, isAuthenticated, reloadKey]);

  // A reply still streaming when the planner is left is abandoned, not leaked.
  useEffect(() => () => abortRef.current?.abort(), []);

  const reload = useCallback(() => {
    setThreads({});
    setReloadKey((key) => key + 1);
  }, []);

  const updateThread = useCallback(
    (id: string, update: (messages: PlannerMessage[]) => PlannerMessage[]) => {
      setThreads((prev) => ({
        ...prev,
        [id]: { status: "ready", messages: update(prev[id]?.messages ?? []) },
      }));
    },
    [],
  );

  const updateMessage = useCallback(
    (id: string, messageId: string, update: (message: PlannerMessage) => PlannerMessage) => {
      updateThread(id, (messages) => messages.map((m) => (m.id === messageId ? update(m) : m)));
    },
    [updateThread],
  );

  const loadThread = useCallback((id: string) => {
    const existing = threadsRef.current[id];
    if (existing && existing.status !== "error") return;
    setThreads((prev) => ({ ...prev, [id]: { status: "loading", messages: [] } }));
    getConversation(id)
      .then((body) => {
        if (!body) {
          setThreads((prev) => ({ ...prev, [id]: { status: "missing", messages: [] } }));
          return;
        }
        setThreads((prev) => ({ ...prev, [id]: { status: "ready", messages: body.messages } }));
      })
      .catch(() => {
        setThreads((prev) => ({ ...prev, [id]: { status: "error", messages: [] } }));
      });
  }, []);

  const streamReply = useCallback(
    async (id: string, text: string) => {
      const n = ++localIds.current;
      const replyId = `local-reply-${n}`;
      updateThread(id, (messages) => [
        ...messages,
        { id: `local-user-${n}`, role: "user", content: text, status: "complete", picks: [] },
        { id: replyId, role: "assistant", content: "", status: "streaming", picks: [] },
      ]);
      setConversations((list) => {
        const current = list.find((c) => c.id === id);
        return current ? withConversation(list, { ...current, lastActiveAt: new Date() }) : list;
      });
      setUsage((u) => (u ? { ...u, used: u.used + 1 } : u));

      const controller = new AbortController();
      abortRef.current = controller;
      setStreamingId(id);
      try {
        const reply = await sendPlannerMessage(id, text, {
          signal: controller.signal,
          onDelta: (delta) =>
            updateMessage(id, replyId, (m) => ({ ...m, content: m.content + delta })),
        });
        updateMessage(id, replyId, (m) => ({
          ...m,
          id: reply.messageId,
          status: "complete",
          picks: reply.picks,
        }));
        setUsage(reply.usage);
        setConversations((list) => withConversation(list, reply.conversation));
      } catch (err) {
        updateMessage(id, replyId, (m) =>
          isAbort(err)
            ? { ...m, status: "stopped" }
            : { ...m, status: "failed", error: plannerErrorMessage(err) },
        );
        // A failed reply is refunded by the server, so the count is re-read
        // rather than guessed.
        getUsage()
          .then(setUsage)
          .catch(() => {});
      } finally {
        if (abortRef.current === controller) abortRef.current = null;
        setStreamingId(null);
      }
    },
    [updateThread, updateMessage],
  );

  const send = useCallback(
    async (conversationId: string | null, raw: string) => {
      const text = raw.trim();
      if (!text || abortRef.current) return false;
      setNewChatError(null);

      let id = conversationId;
      if (!id) {
        try {
          const created = await createConversation();
          const summary = {
            ...created.conversation,
            title: created.conversation.title || titleFromPrompt(text),
          };
          id = summary.id;
          setConversations((list) =>
            withConversation(
              list.filter((c) => c.id !== created.evictedId),
              summary,
            ),
          );
          setThreads((prev) => {
            const next = { ...prev, [summary.id]: { status: "ready" as const, messages: [] } };
            if (created.evictedId) delete next[created.evictedId];
            return next;
          });
          router.replace(`/planner/${encodeURIComponent(summary.id)}`);
        } catch (err) {
          setNewChatError(plannerErrorMessage(err));
          return false;
        }
      }
      void streamReply(id, text);
      return true;
    },
    [router, streamReply],
  );

  const retry = useCallback(
    (conversationId: string, replyId: string) => {
      if (abortRef.current) return;
      const messages = threadsRef.current[conversationId]?.messages ?? [];
      const index = messages.findIndex((m) => m.id === replyId);
      const question = messages[index - 1];
      if (index < 1 || question.role !== "user") return;
      updateThread(conversationId, (list) =>
        list.filter((m) => m.id !== replyId && m.id !== question.id),
      );
      void streamReply(conversationId, question.content);
    },
    [streamReply, updateThread],
  );

  const stop = useCallback(() => abortRef.current?.abort(), []);

  const remove = useCallback(
    async (id: string) => {
      await deleteConversation(id);
      setConversations((list) => list.filter((c) => c.id !== id));
      setThreads((prev) => {
        const next = { ...prev };
        delete next[id];
        return next;
      });
      if (pathname === `/planner/${encodeURIComponent(id)}`) router.replace("/planner");
    },
    [pathname, router],
  );

  const value = useMemo<PlannerContextValue>(
    () => ({
      status,
      conversations,
      usage,
      threads,
      streamingId,
      newChatError,
      reload,
      loadThread,
      send,
      retry,
      stop,
      remove,
    }),
    [status, conversations, usage, threads, streamingId, newChatError, reload, loadThread, send, retry, stop, remove],
  );

  return <PlannerContext.Provider value={value}>{children}</PlannerContext.Provider>;
}
