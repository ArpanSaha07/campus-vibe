import type { ReactNode } from "react";

/** "onLavender" keeps chips legible when the surface behind them is already lavender. */
type Surface = "default" | "onLavender";

const restClasses: Record<Surface, string> = {
  default: "bg-lavender-100 text-lavender-800 hover:bg-lavender-200",
  onLavender: "bg-white text-lavender-800 border border-lavender-200 hover:bg-lavender-50",
};

export default function Chip({
  children,
  selected = false,
  surface = "default",
  onClick,
}: {
  children: ReactNode;
  selected?: boolean;
  surface?: Surface;
  onClick?: () => void;
}) {
  const classes = selected ? "bg-lavender-600 text-white" : restClasses[surface];
  if (onClick) {
    return (
      <button
        type="button"
        onClick={onClick}
        aria-pressed={selected}
        className={`rounded-full px-4 py-2 text-xs font-semibold transition-colors ${classes}`}
      >
        {children}
      </button>
    );
  }
  return (
    <span className={`rounded-full px-4 py-2 text-s font-semibold ${classes}`}>
      {children}
    </span>
  );
}
