"use client";

import { useEffect, useRef, type FormEvent, type KeyboardEvent } from "react";
import { ArrowUp, Square } from "lucide-react";
import { MAX_PROMPT_LENGTH } from "@/app/lib/planner";

/** Grows with its text up to this height, then scrolls. */
const MAX_HEIGHT_PX = 200;

/**
 * The message box. Enter sends and Shift+Enter starts a new line. While a
 * reply streams, the send button becomes a stop button. With no messages left
 * today the box is disabled and says why, rather than failing on send.
 */
export default function PlannerComposer({
  value,
  onChange,
  onSubmit,
  onStop,
  streaming = false,
  sendDisabled = false,
  messagesLeft,
  limit,
  placeholder,
}: {
  value: string;
  onChange: (value: string) => void;
  onSubmit: (text: string) => void;
  onStop?: () => void;
  streaming?: boolean;
  /** Another chat is still replying; one reply streams at a time. */
  sendDisabled?: boolean;
  /** Null when unknown, e.g. for a guest. */
  messagesLeft: number | null;
  limit?: number;
  placeholder: string;
}) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const outOfMessages = messagesLeft !== null && messagesLeft <= 0;
  const canSend = !streaming && !sendDisabled && !outOfMessages && value.trim().length > 0;

  useEffect(() => {
    const fit = () => {
      const textarea = textareaRef.current;
      if (!textarea) return;
      textarea.style.height = "auto";
      textarea.style.height = `${Math.min(textarea.scrollHeight, MAX_HEIGHT_PX)}px`;
    };
    fit();
    // The padding changes at the sm breakpoint, so a rotated phone needs a refit.
    window.addEventListener("resize", fit);
    return () => window.removeEventListener("resize", fit);
  }, [value]);

  function submit() {
    if (canSend) onSubmit(value);
  }

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    submit();
  }

  function handleKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
    // isComposing: Enter that confirms an IME candidate is not a send.
    if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault();
      submit();
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-2.5">
      {/* One line with the button beside it on a phone, as in the design; a
          taller box with the button underneath from sm up. */}
      <div className="flex items-end gap-2 rounded-2xl border border-transparent bg-mist-100 py-1.5 pr-1.5 pl-4 transition-colors focus-within:border-lavender-300 sm:flex-col sm:items-stretch sm:gap-3 sm:pt-3.5 sm:pr-3 sm:pb-3 sm:pl-[18px]">
        <label htmlFor="planner-composer" className="sr-only">
          Message the planner
        </label>
        <textarea
          id="planner-composer"
          ref={textareaRef}
          rows={1}
          value={value}
          maxLength={MAX_PROMPT_LENGTH}
          disabled={outOfMessages}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={outOfMessages ? "You've used today's messages. They reset at midnight." : placeholder}
          className="focus-ring-inherit min-w-0 flex-1 resize-none bg-transparent py-2 sm:w-full sm:flex-none sm:py-0 text-[15px] leading-normal text-ink-900 placeholder-ink-600 disabled:cursor-not-allowed"
        />
        <div className="flex flex-shrink-0 justify-end">
          {streaming ? (
            <button
              type="button"
              onClick={onStop}
              aria-label="Stop the reply"
              className="flex h-10 w-10 items-center justify-center rounded-full bg-ink-900 text-white hover:bg-lavender-800"
            >
              <Square className="h-3.5 w-3.5 fill-current" aria-hidden="true" />
            </button>
          ) : (
            <button
              type="submit"
              aria-label="Send"
              disabled={!canSend}
              className="flex h-10 w-10 items-center justify-center rounded-full bg-lavender-600 text-white transition-colors hover:bg-lavender-800 disabled:pointer-events-none disabled:opacity-50"
            >
              <ArrowUp className="h-[18px] w-[18px]" aria-hidden="true" />
            </button>
          )}
        </div>
      </div>
      {messagesLeft !== null && limit !== undefined && (
        <p className="text-center text-xs text-ink-600">
          {messagesLeft} of {limit} messages left today
          <span className="hidden sm:inline"> · Suggestions only include events that haven&apos;t ended</span>
        </p>
      )}
    </form>
  );
}
