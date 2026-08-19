import type { ReactNode } from "react";

/**
 * Shared input styling, exported rather than wrapped in an Input component.
 *
 * The forms here need native `input`, `textarea` and `select` with their own
 * attributes, and three thin wrappers that each forward a different set of
 * props would be more code than the string they share. design-guidelines.md
 * pins the values: mist-100 fill, transparent border, radius 12, and on focus
 * a white fill with a lavender-300 ring.
 */
export const inputClasses =
  "w-full rounded-xl border border-transparent bg-mist-100 px-4 py-2.5 text-ink-900 placeholder-ink-600/60 transition-colors focus:border-lavender-300 focus:bg-white focus:outline-none";

/** The same, plus room for the chevron a native select draws on the right. */
export const selectClasses = `${inputClasses} appearance-none bg-[length:16px] bg-[right_1rem_center] bg-no-repeat pr-10`;

/**
 * Label, optional hint, optional error, wrapped around one control.
 *
 * `htmlFor` is required rather than optional: a label that is not bound to its
 * control is the most common way a form ends up unusable with a screen reader,
 * and it is invisible when testing by eye.
 */
export default function FormField({
  label,
  htmlFor,
  hint,
  error,
  children,
}: {
  label: string;
  htmlFor: string;
  hint?: string;
  error?: string;
  children: ReactNode;
}) {
  return (
    <div>
      <label htmlFor={htmlFor} className="block text-sm font-semibold text-ink-900">
        {label}
      </label>
      <div className="mt-2">{children}</div>
      {/* Hint is hidden once there is an error: two lines of small print under
          one field, one of them stale, is worse than the error alone. */}
      {error ? (
        <p className="mt-1.5 text-sm text-alert-600">{error}</p>
      ) : hint ? (
        <p className="mt-1.5 text-sm text-ink-600">{hint}</p>
      ) : null}
    </div>
  );
}
