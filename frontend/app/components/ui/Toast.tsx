"use client";

import { useEffect, useRef } from "react";
import { AlertCircle, CheckCircle2, X } from "lucide-react";

type Tone = "error" | "success";

/**
 * A message that hovers over the page instead of moving it.
 *
 * Built for form submission failures. An inline error panel above a long form
 * has to push the fields down to appear, and on the create-club form the panel
 * sat above the fold while the submit button sat below it — so a failed submit
 * looked like nothing at all had happened. This is anchored to the viewport, so
 * it is visible from wherever the button was pressed, and it leaves the form
 * exactly as the user left it.
 *
 * Per-field errors do NOT belong here. They belong beside their field, where
 * the correction is made; `FormField` renders those. This is for the failures
 * that have no field — a rejected request, a dropped connection.
 *
 * `role="alert"` rather than a live region on a wrapper: the element is mounted
 * at the moment there is something to say, which is exactly the case
 * `role="alert"` is specified for, and it interrupts the screen reader the way
 * a failed submit should.
 */
export default function Toast({
  message,
  tone = "error",
  onDismiss,
  autoHideMs = 8000,
}: {
  /** Null or empty renders nothing at all. */
  message: string | null;
  tone?: Tone;
  onDismiss: () => void;
  /** 0 keeps it up until dismissed. */
  autoHideMs?: number;
}) {
  // The dismiss callback is read through a ref so that a caller passing an
  // inline arrow -- which every caller does -- cannot restart the timer on
  // every render and keep the toast up forever.
  const onDismissRef = useRef(onDismiss);
  useEffect(() => {
    onDismissRef.current = onDismiss;
  }, [onDismiss]);

  useEffect(() => {
    if (!message || autoHideMs <= 0) return;
    const timer = setTimeout(() => onDismissRef.current(), autoHideMs);
    return () => clearTimeout(timer);
  }, [message, autoHideMs]);

  if (!message) return null;

  const Icon = tone === "error" ? AlertCircle : CheckCircle2;
  const iconColor = tone === "error" ? "text-alert-600" : "text-go-600";

  return (
    <div
      // pointer-events-none on the positioner, auto on the card: the strip
      // spans the viewport width so the card can centre in it, and without this
      // that invisible strip would swallow clicks on whatever it crosses.
      className="pointer-events-none fixed inset-x-0 bottom-6 z-50 flex justify-center px-4"
    >
      <div
        role="alert"
        className="toast-in pointer-events-auto flex max-w-md items-start gap-3 rounded-2xl border border-mist-200 bg-white px-4 py-3 shadow-lift"
      >
        <Icon className={`mt-0.5 h-5 w-5 flex-shrink-0 ${iconColor}`} aria-hidden="true" />
        <p className="text-sm text-ink-900">{message}</p>
        <button
          type="button"
          onClick={onDismiss}
          aria-label="Dismiss"
          className="-mr-1 ml-1 flex-shrink-0 rounded-full p-1 text-ink-600 transition-colors hover:bg-lavender-50 hover:text-ink-900"
        >
          <X className="h-4 w-4" aria-hidden="true" />
        </button>
      </div>
    </div>
  );
}
