"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import AssistantMessage from "@/app/components/planner/AssistantMessage";
import PlannerComposer from "@/app/components/planner/PlannerComposer";
import PlannerEmptyState from "@/app/components/planner/PlannerEmptyState";
import { usePlanner } from "@/app/components/planner/PlannerProvider";
import Button from "@/app/components/ui/Button";
import EmptyState from "@/app/components/ui/EmptyState";
import { useAuthModal } from "@/app/lib/auth-modal-context";
import { chatToEvict, PLANNER_PROMPT_KEY } from "@/app/lib/planner";

/**
 * The right-hand pane: a new chat, or the thread of an existing one, with the
 * message box pinned under it. State lives in PlannerProvider; this component
 * owns only the draft and which view to show.
 */
export default function PlannerChat({
  conversationId,
  initialPrompt = "",
}: {
  conversationId: string | null;
  /** From the homepage card, sent as the first message of a new chat. */
  initialPrompt?: string;
}) {
  const planner = usePlanner();
  const { status, usage, threads, streamingId, loadThread, send, retry, stop, reload } = planner;
  const { openAuth } = useAuthModal();
  const router = useRouter();
  const [draft, setDraft] = useState("");
  const [needsSignIn, setNeedsSignIn] = useState(false);
  const promptHandled = useRef(false);
  const threadEndRef = useRef<HTMLDivElement>(null);

  const thread = conversationId ? threads[conversationId] : undefined;
  const messagesLeft = usage ? Math.max(0, usage.limit - usage.used) : null;
  const streaming = streamingId !== null;

  useEffect(() => {
    if (conversationId && status === "ready") loadThread(conversationId);
  }, [conversationId, status, loadThread]);

  // A prompt typed before signing in comes back into the box. It is not sent
  // on its own: a message spends one of the day's fifteen.
  useEffect(() => {
    const stashed = sessionStorage.getItem(PLANNER_PROMPT_KEY);
    if (stashed) setDraft(stashed);
  }, []);

  // The homepage card's prompt is sent once, as soon as the planner is ready.
  useEffect(() => {
    if (promptHandled.current || conversationId || !initialPrompt) return;
    if (status === "loading") return;
    promptHandled.current = true;
    if (status === "ready" && messagesLeft !== 0) {
      void submit(initialPrompt);
    } else {
      setDraft(initialPrompt);
    }
    // submit is recreated each render and reads current state; the ref makes this run once.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status, conversationId, initialPrompt, messagesLeft]);

  const messageCount = thread?.messages.length ?? 0;
  const lastContentLength = thread?.messages[messageCount - 1]?.content.length ?? 0;
  useEffect(() => {
    threadEndRef.current?.scrollIntoView?.({ block: "end" });
  }, [messageCount, lastContentLength]);

  async function submit(text: string) {
    const trimmed = text.trim();
    if (!trimmed) return;
    if (status === "guest") {
      sessionStorage.setItem(PLANNER_PROMPT_KEY, trimmed);
      setNeedsSignIn(true);
      return;
    }
    if (status !== "ready") return;
    setDraft("");
    sessionStorage.removeItem(PLANNER_PROMPT_KEY);
    const accepted = await send(conversationId, trimmed);
    if (!accepted) setDraft(trimmed);
  }

  if (status === "loading") {
    return <CenteredPane><p className="text-sm text-ink-600">Loading your chats…</p></CenteredPane>;
  }

  if (status === "unavailable") {
    return (
      <CenteredPane>
        <EmptyState
          title="The planner is unavailable"
          body="It could not be reached just now. Your chats are safe; try again in a few minutes."
          action={<Button onClick={reload}>Try again</Button>}
        />
      </CenteredPane>
    );
  }

  if (conversationId && status === "guest") {
    return (
      <CenteredPane>
        <EmptyState
          title="Sign in to see this chat"
          body="Planner chats are saved to your account."
          action={<Button onClick={() => openAuth("login", "Sign in to see your planner chats")}>Sign in</Button>}
        />
      </CenteredPane>
    );
  }

  if (!conversationId) {
    const evict = status === "ready" ? chatToEvict(planner.conversations) : null;
    return (
      <div className="flex min-h-0 flex-1 flex-col justify-center overflow-y-auto px-4 pt-8 pb-16 sm:px-6">
        <PlannerEmptyState
          evictTitle={evict ? evict.title || "New chat" : null}
          onSuggestion={(prompt) => {
            setDraft(prompt);
            setNeedsSignIn(false);
          }}
          composer={
            <PlannerComposer
              value={draft}
              onChange={(value) => {
                setDraft(value);
                setNeedsSignIn(false);
              }}
              onSubmit={submit}
              sendDisabled={streaming}
              messagesLeft={messagesLeft}
              limit={usage?.limit}
              placeholder="What would you like to plan?"
            />
          }
          notice={
            // Gated on status too: signing in from the modal leaves this page
            // mounted, and the prompt to sign in must not outlive the reason for it.
            needsSignIn && status === "guest" ? (
              <div
                role="status"
                className="flex w-full flex-col items-center justify-center gap-3 rounded-xl border border-lavender-200 bg-white px-4 py-3 sm:flex-row"
              >
                <p className="text-sm text-ink-600">
                  Sign in for suggestions built around your interests. Your message is kept.
                </p>
                <Button
                  onClick={() => openAuth("login", "Sign in for suggestions built around your interests")}
                  className="shrink-0"
                >
                  Sign in
                </Button>
              </div>
            ) : planner.newChatError ? (
              <p role="alert" className="text-sm text-alert-600">
                {planner.newChatError}
              </p>
            ) : null
          }
        />
      </div>
    );
  }

  if (!thread || thread.status === "loading") {
    return <CenteredPane><p className="text-sm text-ink-600">Loading this chat…</p></CenteredPane>;
  }

  if (thread.status === "missing") {
    return (
      <CenteredPane>
        <EmptyState
          title="This chat is gone"
          body="It was deleted, or it was your oldest chat and made room for a new one."
          action={<Button onClick={() => router.replace("/planner")}>Start a new chat</Button>}
        />
      </CenteredPane>
    );
  }

  if (thread.status === "error") {
    return (
      <CenteredPane>
        <EmptyState
          title="This chat didn't load"
          body="Something went wrong on our side."
          action={<Button onClick={() => loadThread(conversationId)}>Try again</Button>}
        />
      </CenteredPane>
    );
  }

  const lastMessage = thread.messages[thread.messages.length - 1];

  return (
    <>
      <div className="min-h-0 flex-1 overflow-y-auto">
        <div className="mx-auto flex w-full max-w-[960px] flex-col gap-10 px-4 pt-5 pb-6 sm:px-6 sm:pt-10">
          {thread.messages.map((message) =>
            message.role === "user" ? (
              <div
                key={message.id}
                className="max-w-[min(560px,85%)] self-end whitespace-pre-wrap rounded-2xl bg-lavender-100 px-4 py-3 text-[15px] leading-normal text-ink-900"
              >
                {message.content}
              </div>
            ) : (
              <AssistantMessage
                key={message.id}
                message={message}
                onFollowUp={submit}
                followUpsDisabled={streaming || messagesLeft === 0}
                onRetry={
                  message.status === "failed" && message === lastMessage && !streaming
                    ? () => retry(conversationId, message.id)
                    : undefined
                }
              />
            ),
          )}
          <div ref={threadEndRef} />
        </div>
      </div>
      <div className="flex-shrink-0 border-t border-mist-200 bg-white px-3 pt-3 pb-4 sm:border-t-0 sm:px-6 sm:py-6">
        <div className="mx-auto w-full max-w-[960px]">
          <PlannerComposer
            value={draft}
            onChange={setDraft}
            onSubmit={submit}
            onStop={stop}
            streaming={streamingId === conversationId}
            sendDisabled={streaming}
            messagesLeft={messagesLeft}
            limit={usage?.limit}
            placeholder="Ask a follow-up, or plan something new…"
          />
        </div>
      </div>
    </>
  );
}

function CenteredPane({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-0 flex-1 items-center justify-center overflow-y-auto px-4 py-10 sm:px-6">
      <div className="w-full max-w-xl">{children}</div>
    </div>
  );
}
