"use client";

import { FormEvent } from "react";
import { ArrowRight } from "lucide-react";
import Button from "@/app/components/ui/Button";

/**
 * The planner's prompt pill, used both to start a plan and to refine one.
 * The wrapper carries the focus ring so the input can opt out of its own —
 * see `.focus-ring-inherit` in globals.css.
 */
export default function PlannerPromptInput({
  id,
  label,
  value,
  placeholder,
  submitLabel,
  disabled,
  onChange,
  onSubmit,
}: {
  id: string;
  label: string;
  value: string;
  placeholder: string;
  submitLabel: string;
  disabled?: boolean;
  onChange: (value: string) => void;
  onSubmit: () => void;
}) {
  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (value.trim()) onSubmit();
  }

  return (
    <form onSubmit={handleSubmit}>
      <label htmlFor={id} className="sr-only">
        {label}
      </label>
      <div className="flex items-center gap-2 rounded-full bg-mist-100 border border-transparent p-1.5 pl-5 transition-colors focus-within:bg-white focus-within:border-lavender-300">
        <input
          id={id}
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          disabled={disabled}
          className="focus-ring-inherit flex-1 min-w-0 bg-transparent text-sm text-ink-900 placeholder-ink-600 disabled:opacity-50"
        />
        <Button type="submit" disabled={disabled} className="shrink-0">
          <span className="hidden sm:inline">{submitLabel}</span>
          <ArrowRight className="h-4 w-4" aria-hidden="true" />
        </Button>
      </div>
    </form>
  );
}
