import type { ReactNode } from "react";

export default function Chip({
  children,
  selected = false,
  onClick,
}: {
  children: ReactNode;
  selected?: boolean;
  onClick?: () => void;
}) {
  const classes = selected
    ? "bg-lavender-600 text-white"
    : "bg-lavender-100 text-lavender-800 hover:bg-lavender-200";
  if (onClick) {
    return (
      <button
        type="button"
        onClick={onClick}
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
