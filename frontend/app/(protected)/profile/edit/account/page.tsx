"use client";

import { useState } from "react";
import { useAuth } from "@/app/lib/auth-context";
import { requestPasswordReset } from "@/app/lib/user";
import { useEditableForm } from "@/app/hooks/useEditableForm";
import SaveChangesBar from "@/app/components/profile/edit/SaveChangesBar";
import FormField, { inputClasses } from "@/app/components/ui/FormField";
import Button from "@/app/components/ui/Button";

/**
 * Email, password, and the way out.
 *
 * The three are separated by rules rather than gathered under one Save, because
 * only the first is an edit. Changing a password and closing an account are
 * actions with their own confirmation, and a single Save changes covering all
 * three would be a button whose meaning depended on which field you touched
 * last.
 */
export default function AccountPage() {
  const { user } = useAuth();

  const { draft, setField, dirty, commit } = useEditableForm({ email: user?.email ?? "" });
  const [resetState, setResetState] = useState<"idle" | "sending" | "sent" | "failed">("idle");
  const [confirmingClose, setConfirmingClose] = useState(false);

  if (!user) return null;

  // A Google account has no password here to change — it is held by Google, and
  // offering a reset would send a link that sets a password the sign-in button
  // never asks for.
  const usesPassword = user.authProvider === "LOCAL";

  async function sendReset() {
    if (!user) return;
    setResetState("sending");
    try {
      await requestPasswordReset(user.email);
      setResetState("sent");
    } catch {
      setResetState("failed");
    }
  }

  return (
    <div>
      <h2 className="font-display text-2xl font-bold text-ink-900">Account</h2>
      <p className="mt-1 text-ink-600">How you sign in, and how to leave.</p>

      <div className="mt-8">
        <FormField
          label="Email address"
          htmlFor="email"
          hint="You will have to confirm the new address before it takes effect."
        >
          <input
            id="email"
            type="email"
            value={draft.email}
            onChange={(event) => setField("email", event.target.value)}
            className={inputClasses}
          />
        </FormField>

        <SaveChangesBar
          dirty={dirty}
          onSave={async () => {
            commit();
          }}
        />
      </div>

      <section className="mt-10 border-t border-mist-200 pt-8">
        <h3 className="font-display text-xl font-bold text-ink-900">Password</h3>
        {usesPassword ? (
          <>
            <p className="mt-1 max-w-lg text-sm text-ink-600">
              We will email you a link to set a new one. Changing it does not sign you out
              of your other sessions.
            </p>
            <div className="mt-4 flex flex-wrap items-center gap-4">
              <Button
                variant="secondary"
                onClick={sendReset}
                disabled={resetState === "sending" || resetState === "sent"}
              >
                {resetState === "sending" ? "Sending…" : "Email me a reset link"}
              </Button>
              <p aria-live="polite" className="text-sm">
                {resetState === "sent" && (
                  <span className="font-semibold text-go-600">
                    Sent. Check {user.email}.
                  </span>
                )}
                {resetState === "failed" && (
                  <span className="font-semibold text-alert-600">
                    That didn&apos;t send. Try again in a moment.
                  </span>
                )}
              </p>
            </div>
          </>
        ) : (
          <p className="mt-1 max-w-lg text-sm text-ink-600">
            You sign in with Google, so there is no CampusVibe password to change. Manage
            it in your Google account.
          </p>
        )}
      </section>

      <section className="mt-10 border-t border-mist-200 pt-8">
        <h3 className="font-display text-xl font-bold text-ink-900">Close your account</h3>
        <p className="mt-1 max-w-lg text-sm text-ink-600">
          Your bookmarks, RSVPs and club follows go with it. If you run a club, hand it to
          someone else first — an owner cannot leave a club without one.
        </p>

        {/* Two steps rather than a browser confirm(): a native dialog cannot say
            what is about to be lost, and it looks identical to every other one. */}
        {confirmingClose ? (
          <div className="mt-4 rounded-2xl border border-alert-600/30 bg-alert-600/5 p-5">
            <p className="font-semibold text-ink-900">
              Close this account for good?
            </p>
            <p className="mt-1 text-sm text-ink-600">
              This cannot be undone, and {user.email} would have to start over.
            </p>
            {/* Disabled, and saying so. There is no endpoint that closes an
                account, and the nearest thing available -- signing out -- would
                leave someone believing their data was gone when every row of it
                is still there. A button that lies is worse than one that is
                off. */}
            <div className="mt-4 flex flex-wrap items-center gap-3">
              <Button variant="berry" disabled>
                Yes, close my account
              </Button>
              <Button variant="secondary" onClick={() => setConfirmingClose(false)}>
                Keep it
              </Button>
            </div>
            <p className="mt-3 text-sm font-semibold text-ink-600">
              Closing an account isn&apos;t wired up yet. Email us and we will do it by
              hand in the meantime.
            </p>
          </div>
        ) : (
          <Button variant="secondary" className="mt-4" onClick={() => setConfirmingClose(true)}>
            Close account
          </Button>
        )}
      </section>
    </div>
  );
}
