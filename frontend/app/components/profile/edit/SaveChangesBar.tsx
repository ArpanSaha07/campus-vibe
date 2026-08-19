"use client";

import { useState } from "react";
import Button from "@/app/components/ui/Button";

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
 */
export default function SaveChangesBar({
  dirty,
  onSave,
}: {
  dirty: boolean;
  onSave: () => Promise<void>;
}) {
  const [state, setState] = useState<"idle" | "saving" | "saved" | "failed">("idle");

  async function save() {
    setState("saving");
    try {
      await onSave();
      setState("saved");
      window.setTimeout(() => setState("idle"), 4000);
    } catch {
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
          <span className="font-semibold text-alert-600">
            That didn&apos;t save. Try again in a moment.
          </span>
        )}
      </p>
    </div>
  );
}
