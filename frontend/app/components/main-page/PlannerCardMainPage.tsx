"use client";

import { FormEvent, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, Sparkles } from "lucide-react";
import Button from "@/app/components/ui/Button";
import Chip from "@/app/components/ui/Chip";
import { useAuth } from "@/app/lib/auth-context";

/** Guest prompts survive the trip through sign-in here. */
export const PLANNER_PROMPT_KEY = "campusvibe.planner.prompt";

/** Chip label → the starting query it drops into the input. */
const SUGGESTIONS: { label: string; prompt: string }[] = [
  { label: "Plan my weekend", prompt: "Plan my weekend around campus events I'd enjoy" },
  { label: "Find free events", prompt: "Find free events happening this week" },
  { label: "Beginner-friendly clubs", prompt: "Show me beginner-friendly clubs with social events" },
  {
    label: "Meet people with similar interests",
    prompt: "Help me meet people who share my interests",
  },
];

/**
 * Homepage entry point for the AI planner: a natural-language prompt box plus
 * suggestion chips. Only signed-in users get an answer, so a guest submission
 * stashes the prompt and asks them to sign in rather than throwing it away.
 */
export default function PlannerCard() {
  const [prompt, setPrompt] = useState("");
  const [needsSignIn, setNeedsSignIn] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const { isAuthenticated, loading } = useAuth();
  const router = useRouter();

  // Restore a prompt the user typed before being sent off to sign in.
  useEffect(() => {
    const stashed = sessionStorage.getItem(PLANNER_PROMPT_KEY);
    if (stashed) setPrompt(stashed);
  }, []);

  function pickSuggestion(suggestion: string) {
    setPrompt(suggestion);
    setNeedsSignIn(false);
    inputRef.current?.focus();
  }

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const q = prompt.trim();
    if (!q || loading) {
      inputRef.current?.focus();
      return;
    }

    if (!isAuthenticated) {
      sessionStorage.setItem(PLANNER_PROMPT_KEY, q);
      setNeedsSignIn(true);
      return;
    }

    sessionStorage.removeItem(PLANNER_PROMPT_KEY);
    router.push(`/planner?prompt=${encodeURIComponent(q)}`);
  }

  return (
    <section aria-label="Plan with CampusVibe" className="max-w-7xl mx-auto py-4 px-4 sm:px-6">
      <div className="rounded-2xl border border-lavender-200 bg-lavender-100 px-6 py-10 sm:px-10 sm:py-14">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="font-display mt-3 text-3xl sm:text-4xl font-bold text-ink-900">
            <div className="inline-flex items-center gap-3">
              Plan with CampusVibe 
              <Sparkles className="h-7 w-7" aria-hidden="true" />
            </div> 
            
          </h2>
          <p className="mt-2 text-sm text-ink-600">
            Ask for events, clubs, or a personalized plan.
          </p>

          <form onSubmit={handleSubmit} className="mt-6">
            <label htmlFor="planner-prompt" className="sr-only">
              What would you like to plan?
            </label>
            {/* The whole pill carries the focus ring, so the input inside opts out of its own. */}
            <div className="flex items-center gap-2 rounded-full bg-white border border-transparent p-1.5 pl-5 transition-colors focus-within:border-lavender-300">
              <input
                id="planner-prompt"
                ref={inputRef}
                type="text"
                value={prompt}
                onChange={(e) => {
                  setPrompt(e.target.value);
                  setNeedsSignIn(false);
                }}
                placeholder="What would you like to plan?"
                className="focus-ring-inherit flex-1 min-w-0 bg-transparent text-sm text-ink-900 placeholder-ink-600"
              />
              <Button type="submit" disabled={loading} className="shrink-0">
                <span className="hidden sm:inline">Make a plan</span>
                <ArrowRight className="h-4 w-4" aria-hidden="true" />
              </Button>
            </div>
          </form>

          <ul className="mt-4 flex flex-wrap justify-center gap-2">
            {SUGGESTIONS.map((suggestion) => (
              <li key={suggestion.label}>
                <Chip surface="onLavender" onClick={() => pickSuggestion(suggestion.prompt)}>
                  {suggestion.label}
                </Chip>
              </li>
            ))}
          </ul>

          {needsSignIn && (
            <div
              role="status"
              className="mt-6 flex flex-col sm:flex-row items-center justify-center gap-3 rounded-xl border border-lavender-200 bg-white px-4 py-3"
            >
              <p className="text-sm text-ink-600">
                Sign in for suggestions built around your interests.
              </p>
              <Button href="/login" className="shrink-0">
                Sign in
              </Button>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
