"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";
import { Download, Instagram, Pencil } from "lucide-react";
import {
  getClubInstagram,
  importClubInstagramNow,
  toHandleInput,
  updateClubInstagram,
} from "@/app/lib/club-instagram";
import { parseApiError } from "@/app/lib/auth-errors";
import type { ClubInstagram } from "@/app/types";
import SectionHeading from "@/app/components/ui/SectionHeading";
import FormField, { inputClasses } from "@/app/components/ui/FormField";
import Button from "@/app/components/ui/Button";
import Toggle from "@/app/components/ui/Toggle";
import Toast from "@/app/components/ui/Toast";
import EmptyState from "@/app/components/ui/EmptyState";

/** How often the page asks whether a started import has finished. */
const POLL_MS = 5000;

const timeFormat = new Intl.DateTimeFormat("en-CA", {
  dateStyle: "medium",
  timeStyle: "short",
  timeZone: "America/Toronto",
});

/**
 * Connect your club's Instagram: the handle, auto-import, and Import now.
 *
 * Three steps in one column, in the order a club takes them. The two controls
 * below the handle stay visible but disabled until a handle is saved, so a
 * club sees what connecting unlocks before it has done it.
 *
 * The handle is the same value as the Instagram field on Edit Club page —
 * stored once, in the club's contact links — so changing it in either place
 * changes both.
 */
export default function ClubInstagramPanel({ clubId }: { clubId: string }) {
  const [state, setState] = useState<ClubInstagram | null>(null);
  const [loadFailed, setLoadFailed] = useState(false);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState<"save" | "toggle" | "import" | null>(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const load = useCallback(async () => {
    try {
      const next = await getClubInstagram(clubId);
      setState(next);
      setLoadFailed(false);
      return next;
    } catch {
      setLoadFailed(true);
      return null;
    }
  }, [clubId]);

  useEffect(() => {
    void load().then((next) => {
      if (next && !next.handle) setEditing(true);
    });
  }, [load]);

  // While this club's own run is going, ask every few seconds until it ends.
  // A scheduled run over other accounts never sets `running`.
  const running = state?.running ?? false;
  useEffect(() => {
    if (!running) return;
    const id = window.setInterval(() => void load(), POLL_MS);
    return () => window.clearInterval(id);
  }, [running, load]);

  if (loadFailed && !state) {
    return (
      <div>
        <Heading />
        <div className="mt-6">
          <EmptyState
            title="Your Instagram settings didn't load"
            body="The server didn't answer. Refresh to try again."
          />
        </div>
      </div>
    );
  }

  if (!state) {
    return (
      <div>
        <Heading />
        <p className="mt-6 font-mono text-sm text-ink-600">Loading…</p>
      </div>
    );
  }

  const connected = state.handle !== null;

  async function save(e: FormEvent) {
    e.preventDefault();
    const handle = toHandleInput(draft);
    if (!handle) {
      setError("Enter your club's Instagram handle, like yourclub.");
      return;
    }
    setBusy("save");
    setError("");
    try {
      const next = await updateClubInstagram(clubId, { handle });
      setState(next);
      setEditing(false);
      // Saving never imports; say so, so nobody waits for events that are not coming.
      setNotice(`Connected @${next.handle}. Press Import now to pull in its events.`);
    } catch (err) {
      setError(parseApiError(err, "We couldn't save that account. Try again."));
    } finally {
      setBusy(null);
    }
  }

  async function setAutoImport(on: boolean) {
    if (!state?.handle) return;
    setBusy("toggle");
    setError("");
    try {
      setState(await updateClubInstagram(clubId, { handle: state.handle, autoImport: on }));
      setNotice(on ? "Auto-import is on." : "Auto-import is off.");
    } catch (err) {
      setError(parseApiError(err, "We couldn't change auto-import. Try again."));
    } finally {
      setBusy(null);
    }
  }

  async function importNow() {
    setBusy("import");
    setError("");
    try {
      setState(await importClubInstagramNow(clubId));
      setNotice(`Importing @${state?.handle}. This page updates when it finishes.`);
    } catch (err) {
      setError(parseApiError(err, "We couldn't start an import. Try again."));
      void load();
    } finally {
      setBusy(null);
    }
  }

  const cooldownUntil = state.nextImportAllowedAt ? new Date(state.nextImportAllowedAt) : null;
  const importDisabled =
    !connected || !state.importAvailable || state.running || cooldownUntil !== null || busy !== null;

  return (
    <div>
      <Heading />

      <div className="mt-6 space-y-4">
        {/* 1. The account */}
        <section
          aria-labelledby="ig-account"
          className="rounded-2xl border border-mist-200 bg-white p-5 sm:p-6"
        >
          <StepLabel n={1} id="ig-account" title="Your club's account" />

          {connected && !editing ? (
            <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
              <a
                href={`https://instagram.com/${state.handle}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2.5 rounded-full bg-lavender-50 px-4 py-2 font-semibold text-lavender-800 transition-colors hover:bg-lavender-100"
              >
                <Instagram className="h-4 w-4" aria-hidden="true" />@{state.handle}
              </a>
              <Button
                variant="secondary"
                onClick={() => {
                  setDraft(state.handle ?? "");
                  setEditing(true);
                }}
              >
                <Pencil className="h-4 w-4" aria-hidden="true" />
                Change account
              </Button>
            </div>
          ) : (
            <form onSubmit={save} className="mt-4" noValidate>
              <FormField
                label="Instagram handle"
                htmlFor="ig-handle"
                hint="The account your club posts events on. This is also the Instagram link on your club page."
              >
                <div className="flex flex-col gap-3 sm:flex-row">
                  <div className="relative flex-1">
                    <span
                      aria-hidden="true"
                      className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 font-semibold text-ink-600"
                    >
                      @
                    </span>
                    <input
                      id="ig-handle"
                      type="text"
                      autoComplete="off"
                      autoCapitalize="none"
                      spellCheck={false}
                      placeholder="yourclub"
                      value={draft}
                      onChange={(e) => setDraft(e.target.value)}
                      className={`${inputClasses} pl-8`}
                    />
                  </div>
                  <div className="flex gap-2">
                    <Button type="submit" disabled={busy !== null}>
                      {busy === "save" ? "Saving…" : connected ? "Save" : "Connect"}
                    </Button>
                    {connected && (
                      <Button variant="secondary" onClick={() => setEditing(false)}>
                        Cancel
                      </Button>
                    )}
                  </div>
                </div>
              </FormField>
            </form>
          )}
        </section>

        {/* 2. Auto-import */}
        <section
          aria-labelledby="ig-auto"
          className={`rounded-2xl border border-mist-200 bg-white p-5 sm:p-6 ${connected ? "" : "opacity-60"}`}
        >
          <div className="flex items-start justify-between gap-4">
            <div>
              <StepLabel n={2} id="ig-auto" title="Auto-import" />
              <p className="mt-2 text-sm text-ink-600">
                Twice a day, CampusVibe reads your new posts and stories and publishes the ones
                that announce an event. Each event links back to the post on Instagram.
              </p>
            </div>
            <Toggle
              checked={state.autoImport}
              onChange={(on) => void setAutoImport(on)}
              label="Auto-import events from Instagram"
              disabled={!connected || busy !== null}
            />
          </div>
          {!connected && (
            <p className="mt-3 text-sm text-ink-600">Connect an account first.</p>
          )}
        </section>

        {/* 3. Import now */}
        <section
          aria-labelledby="ig-now"
          className={`rounded-2xl border border-mist-200 bg-white p-5 sm:p-6 ${connected ? "" : "opacity-60"}`}
        >
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <StepLabel n={3} id="ig-now" title="Import now" />
              <p className="mt-2 text-sm text-ink-600">
                Just posted something? Pull it in now instead of waiting for the next run.
                {connected && <> Only @{state.handle} is checked.</>}
              </p>
            </div>
            <Button onClick={() => void importNow()} disabled={importDisabled} className="shrink-0">
              <Download className="h-4 w-4" aria-hidden="true" />
              {state.running || busy === "import" ? "Importing…" : "Import now"}
            </Button>
          </div>

          <ImportStatus state={state} cooldownUntil={cooldownUntil} />
        </section>
      </div>

      <Toast message={error || null} tone="error" onDismiss={() => setError("")} />
      <Toast message={!error && notice ? notice : null} tone="success" onDismiss={() => setNotice("")} />
    </div>
  );
}

function Heading() {
  return (
    <SectionHeading
      title="Connect Instagram"
      subtitle="Link your club's Instagram and the events you announce there show up on CampusVibe."
    />
  );
}

function StepLabel({ n, id, title }: { n: number; id: string; title: string }) {
  return (
    <div className="flex items-center gap-3">
      <span className="ticket-label text-lavender-600">Step {n}</span>
      <h3 id={id} className="font-display text-lg font-bold text-ink-900">
        {title}
      </h3>
    </div>
  );
}

/** One line of machine facts under Import now: why it is off, or what happened last. */
function ImportStatus({
  state,
  cooldownUntil,
}: {
  state: ClubInstagram;
  cooldownUntil: Date | null;
}) {
  let line: string | null = null;
  if (state.handle === null) {
    line = "Connect an account first.";
  } else if (!state.importAvailable) {
    line = "Importing isn't switched on for CampusVibe yet.";
  } else if (state.running) {
    line = `Importing @${state.handle} now. This page updates when it finishes.`;
  } else if (state.lastRunStatus === "FAILED") {
    line = "Your last import didn't go through. Try again.";
  } else if (cooldownUntil) {
    line = `Imported recently. You can import again after ${timeFormat.format(cooldownUntil)}.`;
  }

  const lastRun =
    !state.running && state.lastRunStatus !== null && state.lastRunStatus !== "FAILED"
      ? `Last import: ${state.lastRunPublished ?? 0} new ${state.lastRunPublished === 1 ? "event" : "events"} published`
      : null;

  return (
    <div role="status" className="mt-4 space-y-1 border-t border-mist-200 pt-4 font-mono text-xs text-ink-600">
      {line && <p>{line}</p>}
      {lastRun && <p>{lastRun}</p>}
      {state.handle !== null && (
        <p>
          Last imported:{" "}
          {state.lastImportedAt ? timeFormat.format(new Date(state.lastImportedAt)) : "never"} ·{" "}
          {state.eventsFound} {state.eventsFound === 1 ? "event" : "events"} found so far
        </p>
      )}
    </div>
  );
}
