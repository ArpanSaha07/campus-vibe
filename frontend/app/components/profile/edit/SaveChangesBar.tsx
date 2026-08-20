"use client";

import { useEffect, useRef, useState } from "react";
import Button from "@/app/components/ui/Button";
import { parseApiError } from "@/app/lib/auth-errors";

/**
 * The Save changes button, dark until there is something to save.
 *
 * Disabled while the form matches what was loaded. An always-enabled Save
 * teaches people to press it after doing nothing, and then a saved form and an
 * untouched one look identical -- which is exactly the state this screen must
 * never leave someone in.
 *
 * The confirmation clears itself after a few seconds. A permanent `Saved` would
 * still be sitting there during the next edit, claiming something about work it
 * predates.
 *
 * A failure shows what the server said rather than a fixed sentence. The
 * refusals this screen can provoke are specific and actionable -- a link that
 * is not http, an interest that is not in the catalogue, too many subjects --
 * and "try again in a moment" is wrong for every one of them: trying again
 * unchanged will fail again. The generic line is kept as the fallback for the
 * cases where there is genuinely nothing to say, such as a dropped connection.
 */
export default function SaveChangesBar({
  dirty,
  onSave,
}: {
  dirty: boolean;
  onSave: () => Promise<void>;
}) {
  const [state, setState] = useState<"idle" | "saving" | "saved" | "failed">("idle");
  const [error, setError] = useState("");
  const timer = useRef<number | undefined>(undefined);

  // Without this, navigating away inside the four seconds leaves a timer that
  // fires setState on an unmounted component.
  useEffect(() => () => window.clearTimeout(timer.current), []);

  async function save() {
    setState("saving");
    setError("");
    try {
      await onSave();
      setState("saved");
      timer.current = window.setTimeout(() => setState("idle"), 4000);
    } catch (err) {
      setError(parseApiError(err, "That didn't save. Try again in a moment."));
      setState("failed");
    }
  }

  return (
    <div className="mt-8 flex flex-wrap items-center gap-4 border-t border-mist-200 pt-6">
      <Button onClick={save} disabled={!dirty || state === "saving"}>
        {state === "saving" ? "Saving…" : "Save changes"}
      </Button>

      {/* aria-live so the outcome is announced — the only other signal is the
          button going quiet again, which a screen reader user will not notice. */}
      <p aria-live="polite" className="text-sm">
        {state === "saved" && <span className="font-semibold text-go-600">Changes saved.</span>}
        {state === "failed" && (
          <span className="font-semibold text-alert-600">{error}</span>
        )}
      </p>
    </div>
  );
}
