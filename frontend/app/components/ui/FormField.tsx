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
  "w-full rounded-full border border-transparent bg-mist-100 px-4 py-2.5 text-ink-900 placeholder-ink-600/60 transition-colors focus:bg-white focus:outline-none";

/**
 * The same, plus the chevron a native select needs once `appearance-none` has
 * taken its own away. The image itself is `.select-chevron` in `globals.css` —
 * a data URI cannot go in a Tailwind arbitrary value, because it has spaces in
 * it.
 */
export const selectClasses = `${inputClasses} select-chevron appearance-none bg-[length:16px] bg-[right_1rem_center] bg-no-repeat pr-10`;

/**
 * The same, squared off for multi-line text.
 *
 * A pill radius is right for a control one line tall and wrong for one that is
 * six: the curve eats the first and last lines of text. design-guidelines.md
 * gives inputs a 12px radius, which is what `rounded-xl` is — `inputClasses`
 * only goes full because every single-line control in the app is a pill.
 */
export const textareaClasses = `${inputClasses} rounded-xl resize-y`;

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
  required = false,
  children,
}: {
  label: string;
  htmlFor: string;
  hint?: string;
  error?: string;
  /**
   * Marks the field required in the label.
   *
   * Says so where the decision is made rather than at submit time. It is a
   * word, not an asterisk: an asterisk needs a legend somewhere else on the
   * page to mean anything, and mono uppercase is already how this system
   * prints machine facts.
   *
   * It does NOT set the control's `required` attribute — that would hand
   * validation to the browser's own bubbles and pre-empt the messages in
   * `clubValidator`. Pass `aria-required` on the control for that half.
   */
  required?: boolean;
  children: ReactNode;
}) {
  return (
    <div>
      <label
        htmlFor={htmlFor}
        className="flex flex-wrap items-baseline gap-x-2 text-sm font-semibold text-ink-900"
      >
        {label}
        {required && <span className="ticket-label text-ink-600">Required</span>}
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
