"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";
import { Download } from "lucide-react";
import {
  getAdminInstagram,
  setInstagramAccountCount,
  startAdminInstagramImport,
} from "@/app/lib/admin-instagram";
import { parseApiError } from "@/app/lib/auth-errors";
import type { AdminInstagram, InstagramImportRun } from "@/app/types";
import SectionHeading from "@/app/components/ui/SectionHeading";
import FormField, { inputClasses } from "@/app/components/ui/FormField";
import Button from "@/app/components/ui/Button";
import EmptyState from "@/app/components/ui/EmptyState";
import Toast from "@/app/components/ui/Toast";

/** How often the section asks whether a run has finished. */
const POLL_MS = 5000;

const timeFormat = new Intl.DateTimeFormat("en-CA", {
  dateStyle: "medium",
  timeStyle: "short",
  timeZone: "America/Toronto",
});

/**
 * The admin dashboard's Instagram import controls.
 *
 * Two controls and a record. N says how many accounts, from the top of the
 * ranked account list, every run checks; Import now runs over those N at once
 * instead of waiting for 9:00 or 21:00. Accounts a club turned auto-import on
 * for are checked on top of N, and ones it turned off are skipped even inside
 * it. Each event a run publishes gets its event page straight away, because an
 * event page is built from the event itself.
 */
export default function AdminInstagramImport() {
  const [state, setState] = useState<AdminInstagram | null>(null);
  const [loadFailed, setLoadFailed] = useState(false);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState<"save" | "import" | null>(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const load = useCallback(async () => {
    try {
      const next = await getAdminInstagram();
      setState(next);
      setLoadFailed(false);
      return next;
    } catch {
      setLoadFailed(true);
      return null;
    }
  }, []);

  useEffect(() => {
    void load().then((next) => {
      if (next) setDraft(String(next.accountCount));
    });
  }, [load]);

  const running = state?.running ?? false;
  useEffect(() => {
    if (!running) return;
    const id = window.setInterval(() => void load(), POLL_MS);
    return () => window.clearInterval(id);
  }, [running, load]);

  async function save(e: FormEvent) {
    e.preventDefault();
    const n = Number(draft);
    if (!Number.isInteger(n) || n < 1 || (state && n > state.totalAccounts)) {
      setError(`Enter a whole number from 1 to ${state?.totalAccounts ?? "the list size"}.`);
      return;
    }
    setBusy("save");
    setError("");
    try {
      const next = await setInstagramAccountCount(n);
      setState(next);
      setDraft(String(next.accountCount));
      setNotice(`Runs now check the first ${next.accountCount} accounts.`);
    } catch (err) {
      setError(parseApiError(err, "We couldn't save that number. Try again."));
    } finally {
      setBusy(null);
    }
  }

  async function importNow() {
    setBusy("import");
    setError("");
    try {
      setState(await startAdminInstagramImport());
      setNotice("Import started. New events and their pages appear as it publishes them.");
    } catch (err) {
      setError(parseApiError(err, "We couldn't start an import. Try again."));
      void load();
    } finally {
      setBusy(null);
    }
  }

  return (
    <section className="mt-12" aria-labelledby="admin-instagram">
      <SectionHeading
        title="Instagram import"
        subtitle="Events are read from club Instagram accounts twice a day, at 9:00 and 21:00. Choose how many accounts each run checks, or run one now."
      />

      {loadFailed && !state && (
        <div className="mt-6">
          <EmptyState title="Import settings didn't load" body="The server didn't answer. Refresh to try again." />
        </div>
      )}

      {!state && !loadFailed && <p className="mt-6 font-mono text-sm text-ink-600">Loading…</p>}

      {state && (
        <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-2">
          {/* Accounts checked */}
          <div className="rounded-2xl border border-mist-200 bg-white p-5 sm:p-6">
            <h3 id="admin-instagram" className="font-display text-lg font-bold text-ink-900">
              Accounts checked
            </h3>
            <p className="mt-2 text-sm text-ink-600">
              Each run checks the first N accounts of the ranked list of {state.totalAccounts}, in order.
              {state.clubOptIns > 0 && (
                <>
                  {" "}
                  {state.clubOptIns} {state.clubOptIns === 1 ? "club has" : "clubs have"} turned
                  auto-import on and {state.clubOptIns === 1 ? "is" : "are"} checked as well.
                </>
              )}
            </p>
            <form onSubmit={save} noValidate className="mt-4">
              <FormField
                label="Number of accounts"
                htmlFor="ig-account-count"
                hint="More accounts means more events, and a longer, costlier run."
              >
                <div className="flex gap-2">
                  <input
                    id="ig-account-count"
                    type="number"
                    inputMode="numeric"
                    min={1}
                    max={state.totalAccounts}
                    value={draft}
                    onChange={(e) => setDraft(e.target.value)}
                    className={`${inputClasses} max-w-40 font-mono`}
                  />
                  <Button
                    type="submit"
                    variant="secondary"
                    disabled={busy !== null || draft === String(state.accountCount)}
                  >
                    {busy === "save" ? "Saving…" : "Save"}
                  </Button>
                </div>
              </FormField>
            </form>
          </div>

          {/* Import now */}
          <div className="flex flex-col rounded-2xl border border-mist-200 bg-white p-5 sm:p-6">
            <h3 className="font-display text-lg font-bold text-ink-900">Import now</h3>
            <p className="mt-2 text-sm text-ink-600">
              Check the first {state.accountCount} accounts now instead of waiting for the next run.
              Every event found gets its own event page.
            </p>
            <div className="mt-4">
              <Button
                onClick={() => void importNow()}
                disabled={!state.importAvailable || state.running || busy !== null}
              >
                <Download className="h-4 w-4" aria-hidden="true" />
                {state.running || busy === "import" ? "Importing…" : "Import now"}
              </Button>
            </div>
            <p role="status" className="mt-3 font-mono text-xs text-ink-600">
              {!state.importAvailable
                ? "Importing isn't switched on for this server: the fetcher URL or the Claude key is missing."
                : state.running
                  ? "A run is going. This updates when it finishes."
                  : null}
            </p>
          </div>
        </div>
      )}

      {state && state.recentRuns.length > 0 && (
        <div className="mt-6 overflow-x-auto rounded-2xl border border-mist-200 bg-white">
          <table className="w-full min-w-[640px] text-left text-sm">
            <caption className="sr-only">Recent import runs</caption>
            <thead>
              <tr className="border-b border-mist-200">
                {["Started", "Run", "Accounts", "Fetched", "Events found", "Published", "Status"].map((h) => (
                  <th key={h} scope="col" className="ticket-label px-4 py-3 font-normal text-ink-600">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="font-mono text-xs text-ink-900">
              {state.recentRuns.map((run) => (
                <RunRow key={run.id} run={run} />
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Toast message={error || null} tone="error" onDismiss={() => setError("")} />
      <Toast message={!error && notice ? notice : null} tone="success" onDismiss={() => setNotice("")} />
    </section>
  );
}

const STATUS_LABEL: Record<InstagramImportRun["status"], string> = {
  RUNNING: "Running",
  SUCCEEDED: "Done",
  PARTIAL: "Done, some failed",
  FAILED: "Failed",
};

function RunRow({ run }: { run: InstagramImportRun }) {
  const kind = run.handle
    ? `Club: @${run.handle}`
    : run.trigger === "MANUAL"
      ? "Admin, now"
      : "Scheduled";
  return (
    <tr className="border-b border-mist-200 last:border-0">
      <td className="px-4 py-3 whitespace-nowrap">{timeFormat.format(new Date(run.startedAt))}</td>
      <td className="px-4 py-3 whitespace-nowrap">{kind}</td>
      <td className="px-4 py-3">{run.accountsRequested}</td>
      <td className="px-4 py-3 whitespace-nowrap">
        {run.storiesFetched} stories · {run.postsFetched} posts
      </td>
      <td className="px-4 py-3">{run.status === "RUNNING" ? "…" : run.eventsFound}</td>
      <td className="px-4 py-3">{run.status === "RUNNING" ? "…" : run.eventsPublished}</td>
      <td
        className={`px-4 py-3 whitespace-nowrap ${run.status === "FAILED" ? "text-alert-600" : ""}`}
        title={run.error ?? undefined}
      >
        {STATUS_LABEL[run.status]}
      </td>
    </tr>
  );
}
