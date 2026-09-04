"use client";

/**
 * An on/off switch.
 *
 * `role="switch"` rather than a checkbox: both are two-state, but a screen
 * reader announces a switch as on or off, which is what this is, instead of
 * checked or unchecked, which reads as a choice being ticked.
 *
 * Takes a label it never draws. Every current caller renders its own heading
 * and description beside the switch, so drawing one here would duplicate it --
 * but a switch with no accessible name at all is announced as nothing.
 */
export default function Toggle({
  checked,
  onChange,
  label,
  disabled = false,
}: {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label: string;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors duration-150 disabled:opacity-50 ${
        checked ? "bg-lavender-600" : "bg-mist-200"
      }`}
    >
      <span
        aria-hidden="true"
        className={`inline-block h-5 w-5 transform rounded-full bg-white shadow-sm transition-transform duration-150 ${
          checked ? "translate-x-[22px]" : "translate-x-0.5"
        }`}
      />
    </button>
  );
}
