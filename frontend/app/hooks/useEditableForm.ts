"use client";

import { useCallback, useMemo, useState } from "react";

/**
 * Compares two values for the purpose of deciding whether Save should light up.
 *
 * Arrays of strings are compared as sets, not sequences. Remove an interest and
 * add it back and it lands at the end of the array rather than where it was --
 * a plain deep compare would call that a change and offer to save a difference
 * nobody can see. Order carries no meaning in any field this hook guards.
 */
function sameValue(a: unknown, b: unknown): boolean {
  if (a === b) return true;

  if (Array.isArray(a) && Array.isArray(b)) {
    if (a.length !== b.length) return false;
    const left = [...a].map(String).sort();
    const right = [...b].map(String).sort();
    return left.every((value, index) => value === right[index]);
  }

  if (a && b && typeof a === "object" && typeof b === "object") {
    const keys = new Set([...Object.keys(a), ...Object.keys(b)]);
    return [...keys].every((key) =>
      sameValue((a as Record<string, unknown>)[key], (b as Record<string, unknown>)[key]),
    );
  }

  return false;
}

/**
 * A form that knows whether it has been changed.
 *
 * Every section of the profile editor is the same shape: load a value, let it
 * be edited, and keep Save disabled until it differs from what was loaded.
 * That last part is the whole reason this exists -- an always-enabled Save
 * teaches people to press it after doing nothing, and then they cannot tell a
 * saved form from an untouched one.
 *
 * `commit` is called after a successful save, and is what makes the button go
 * quiet again: the draft becomes the new baseline. Deliberately not automatic
 * on change, or the button would never enable.
 */
export function useEditableForm<T extends object>(initial: T) {
  const [baseline, setBaseline] = useState<T>(initial);
  const [draft, setDraft] = useState<T>(initial);

  const dirty = useMemo(() => !sameValue(baseline, draft), [baseline, draft]);

  /** Change one field, leaving the rest of the draft alone. */
  const setField = useCallback(<K extends keyof T>(key: K, value: T[K]) => {
    setDraft((current) => ({ ...current, [key]: value }));
  }, []);

  /** Accept the draft as the new saved state. Call after the save succeeds. */
  const commit = useCallback(() => {
    setDraft((current) => {
      setBaseline(current);
      return current;
    });
  }, []);

  /** Throw the draft away and go back to the last saved state. */
  const reset = useCallback(() => setDraft(baseline), [baseline]);

  return { draft, setDraft, setField, dirty, commit, reset };
}
