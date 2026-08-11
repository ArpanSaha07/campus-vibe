"use client";

import { useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";
import ClubCard from "@/app/components/club/ClubCard";
import Button from "@/app/components/ui/Button";
import EmptyState from "@/app/components/ui/EmptyState";
import SectionHeading from "@/app/components/ui/SectionHeading";
import PlanTimeline from "@/app/components/planner/PlanTimeline";
import PlannerLoadingState from "@/app/components/planner/PlannerLoadingState";
import PlannerPromptInput from "@/app/components/planner/PlannerPromptInput";
import { useAuth } from "@/app/lib/auth-context";
import { buildMockPlan, PLANNER_DELAY_MS, PLANNER_PROMPT_KEY } from "@/app/lib/planner";
import type { Plan } from "@/app/types";

/**
 * Planner results surface. Owns the whole prompt → loading → plan cycle in
 * client state; there is no session object to restore from yet, so a refresh
 * regenerates from the prompt in the URL.
 */
export default function PlannerClient({ initialPrompt }: { initialPrompt: string }) {
  const { isAuthenticated, loading: authLoading } = useAuth();
  const [prompt, setPrompt] = useState(initialPrompt);
  const [refinements, setRefinements] = useState<string[]>([]);
  const [plan, setPlan] = useState<Plan | null>(null);
  const [generating, setGenerating] = useState(false);
  const [draft, setDraft] = useState("");
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // A guest who signed in lands back here without the query string.
  useEffect(() => {
    if (initialPrompt) return;
    const stashed = sessionStorage.getItem(PLANNER_PROMPT_KEY);
    if (stashed) setPrompt(stashed);
  }, [initialPrompt]);

  // Stands in for the RAG call: same prompt in, same plan out, after a delay.
  useEffect(() => {
    if (authLoading || !isAuthenticated || !prompt) return;
    setGenerating(true);
    timer.current = setTimeout(() => {
      setPlan(buildMockPlan(prompt, refinements));
      setGenerating(false);
      sessionStorage.removeItem(PLANNER_PROMPT_KEY);
    }, PLANNER_DELAY_MS);
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, [authLoading, isAuthenticated, prompt, refinements]);

  function startPlan() {
    const q = draft.trim();
    if (!q) return;
    setDraft("");
    setRefinements([]);
    setPlan(null);
    setPrompt(q);
  }

  function refinePlan() {
    const q = draft.trim();
    if (!q) return;
    setDraft("");
    setRefinements((prev) => [...prev, q]);
  }

  // One view at a time. Resolving auth counts as loading whenever there is a
  // prompt to answer, so the page never renders an empty gap while it waits.
  const view: "pending" | "sign-in" | "start" | "loading" | "plan" = authLoading
    ? prompt
      ? "loading"
      : "pending"
    : !isAuthenticated
      ? "sign-in"
      : !prompt
        ? "start"
        : generating || !plan
          ? "loading"
          : "plan";

  return (
    <Shell prompt={prompt} refinements={refinements}>
      {view === "sign-in" && (
        <EmptyState
          title="Sign in to see your plan"
          body="The planner builds on your interests, saved events and followed clubs, so it needs to know who you are. Your prompt is saved — you will not have to type it again."
          action={<Button href="/login">Sign in</Button>}
        />
      )}

      {view === "start" && (
        <div>
          <EmptyState
            title="Nothing to plan yet"
            body="Tell the planner what you are trying to do — an evening, a weekend, or a way to meet people."
          />
          <div className="mx-auto mt-6 max-w-2xl">
            <PlannerPromptInput
              id="planner-start"
              label="What would you like to plan?"
              value={draft}
              placeholder="What would you like to plan?"
              submitLabel="Make a plan"
              onChange={setDraft}
              onSubmit={startPlan}
            />
          </div>
        </div>
      )}

      {view === "loading" && <PlannerLoadingState />}

      {view === "plan" && plan && (
        <div className="space-y-12">
          <section aria-label="Plan overview">
            <h2 className="font-display text-2xl font-bold text-ink-900">{plan.title}</h2>
            <p className="mt-2 text-ink-600">{plan.summary}</p>
          </section>

          <section aria-label="Recommended events">
            <SectionHeading title="Recommended events" />
            <PlanTimeline slots={plan.slots} />
          </section>

          <section aria-label="Recommended clubs">
            <SectionHeading
              title="Clubs worth following"
              subtitle="Related to the events above."
            />
            <div className="flex space-x-6 overflow-x-auto p-6 rounded-2xl bg-mist-100">
              {plan.clubs.map((club) => (
                <ClubCard key={club.clubId} club={club} />
              ))}
            </div>
          </section>

          <section aria-label="Suggested next actions">
            <SectionHeading title="Next steps" />
            <ul className="mt-2 space-y-2">
              {plan.nextSteps.map((step) => (
                <li key={step} className="flex gap-3 text-sm text-ink-600">
                  <span aria-hidden="true" className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-lavender-300" />
                  {step}
                </li>
              ))}
            </ul>
          </section>

          <section aria-label="Refine this plan" className="rounded-2xl bg-lavender-100 p-6 sm:p-8">
            <h2 className="font-display text-xl font-bold text-ink-900">Not quite right?</h2>
            <p className="mt-1 mb-4 text-sm text-ink-600">
              Ask for a change and the planner will rework it — try &ldquo;only free events&rdquo; or
              &ldquo;something after 6 PM&rdquo;.
            </p>
            <PlannerPromptInput
              id="planner-followup"
              label="Refine this plan"
              value={draft}
              placeholder="Refine this plan"
              submitLabel="Refine"
              onChange={setDraft}
              onSubmit={refinePlan}
            />
          </section>
        </div>
      )}
    </Shell>
  );
}

/** Prompt header and page chrome, shown in every state so the page never jumps. */
function Shell({
  prompt,
  refinements,
  children,
}: {
  prompt: string;
  refinements: string[];
  children: ReactNode;
}) {
  return (
    <main className="max-w-7xl mx-auto w-full px-4 sm:px-6 py-10 sm:py-16">
      <header className="mb-10">
        <span className="ticket-label inline-block rounded-full border border-mist-200 bg-mist-100 px-3 py-1 text-ink-600">
          Sample plan — not connected to the AI service yet
        </span>
        <p className="ticket-label mt-6 text-ink-600">Your request</p>
        <h1 className="font-display mt-1 text-3xl sm:text-4xl font-bold text-ink-900">
          {prompt || "Plan with CampusVibe"}
        </h1>
        {refinements.length > 0 && (
          <ul className="mt-4 flex flex-wrap gap-2">
            {refinements.map((refinement, index) => (
              <li
                key={`${refinement}-${index}`}
                className="rounded-full bg-lavender-100 px-4 py-1.5 text-xs font-semibold text-lavender-800"
              >
                {refinement}
              </li>
            ))}
          </ul>
        )}
      </header>
      {children}
    </main>
  );
}
