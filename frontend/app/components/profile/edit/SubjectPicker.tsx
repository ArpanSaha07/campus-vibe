"use client";

import { useState } from "react";
import { Plus, X } from "lucide-react";
import { inputClasses } from "@/app/components/ui/FormField";

const MAX_SUBJECTS = 12;

/**
 * Free-text subject chips.
 *
 * Free text, unlike interests, because nobody can enumerate every course and
 * programme a university offers — and a picker that cannot express what you
 * study is worse than a box you type into.
 *
 * Enter adds, so the common case never touches the mouse. A bare input inside a
 * form would submit the form instead, which is why this is a button plus a
 * keydown handler rather than a nested form of its own.
 */
export default function SubjectPicker({
  subjects,
  onChange,
}: {
  subjects: string[];
  onChange: (subjects: string[]) => void;
}) {
  const [draft, setDraft] = useState("");

  const trimmed = draft.trim();
  // Case-insensitive: Calculus and calculus are the same subject typed by the
  // same person on two different days, not two subjects.
  const duplicate = subjects.some((s) => s.toLowerCase() === trimmed.toLowerCase());
  const full = subjects.length >= MAX_SUBJECTS;
  const canAdd = trimmed.length > 0 && !duplicate && !full;

  function add() {
    if (!canAdd) return;
    onChange([...subjects, trimmed]);
    setDraft("");
  }

  return (
    <div>
      <label htmlFor="subject-input" className="block text-sm font-semibold text-ink-900">
        Subjects
      </label>

      <div className="mt-2 flex gap-2">
        <input
          id="subject-input"
          type="text"
          value={draft}
          maxLength={60}
          disabled={full}
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={(event) => {
            if (event.key !== "Enter") return;
            event.preventDefault();
            add();
          }}
          placeholder={full ? "That is plenty of subjects" : "e.g. Organic Chemistry"}
          className={inputClasses}
        />
        <button
          type="button"
          onClick={add}
          disabled={!canAdd}
          className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-lavender-600 px-5 text-sm font-semibold text-white transition-colors hover:bg-lavender-800 disabled:pointer-events-none disabled:opacity-50"
        >
          <Plus className="h-4 w-4" aria-hidden="true" />
          Add
        </button>
      </div>

      <p className="mt-1.5 text-sm text-ink-600">
        {duplicate
          ? "You have already added that one."
          : full
            ? `${MAX_SUBJECTS} is the limit — remove one to add another.`
            : "Press Enter or Add after each subject."}
      </p>

      {subjects.length > 0 && (
        <ul className="mt-4 flex flex-wrap gap-2">
          {subjects.map((subject) => (
            <li key={subject}>
              <button
                type="button"
                onClick={() => onChange(subjects.filter((value) => value !== subject))}
                aria-label={`Remove ${subject}`}
                className="inline-flex items-center gap-1.5 rounded-full border border-berry-500 px-4 py-2 text-xs font-semibold text-berry-500 transition-colors hover:bg-berry-100"
              >
                {subject}
                <X className="h-3.5 w-3.5" aria-hidden="true" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
