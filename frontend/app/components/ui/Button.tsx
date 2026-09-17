import Link from "next/link";
import type { ReactNode } from "react";

type Variant = "primary" | "secondary" | "berry" | "outline";
type Size = "md" | "lg";

const variantClasses: Record<Variant, string> = {
  primary: "bg-lavender-600 text-white hover:bg-lavender-800",
  secondary: "bg-white text-ink-900 border border-mist-200 hover:bg-lavender-50",
  berry: "bg-berry-600 text-white hover:bg-berry-700",
  // Border-only hover, no fill change. For buttons that sit beside a filled
  // one and must not compete with it — the Google button in the auth modal.
  outline: "bg-white text-ink-900 border border-mist-200 hover:border-lavender-600",
};

// A minimum height plus vertical padding, not a fixed height. A one-line label
// is the same 40 or 48px either way, but a label that wraps in a narrow column
// -- the event page's calendar button in its sidebar -- grew past a fixed
// `h-12`, and its lines sat on the button's top and bottom edges.
const sizeClasses: Record<Size, string> = {
  md: "min-h-10 px-5 py-2 text-sm",
  lg: "min-h-12 px-7 py-2.5 text-base",
};

interface ButtonProps {
  children: ReactNode;
  variant?: Variant;
  size?: Size;
  href?: string;
  /** With `href`: a plain anchor opening in a new tab, for links off the site. */
  external?: boolean;
  onClick?: () => void;
  type?: "button" | "submit";
  disabled?: boolean;
  className?: string;
}

export default function Button({
  children,
  variant = "primary",
  size = "md",
  href,
  external,
  onClick,
  type = "button",
  disabled,
  className = "",
}: ButtonProps) {
  const classes = `inline-flex items-center justify-center gap-2 rounded-full text-center font-semibold
    transition-colors duration-150 active:scale-[0.98] disabled:opacity-50 disabled:pointer-events-none
    ${variantClasses[variant]} ${sizeClasses[size]} ${className}`;

  if (href && external) {
    return (
      <a href={href} target="_blank" rel="noopener noreferrer" className={classes}>
        {children}
      </a>
    );
  }
  if (href) {
    return (
      <Link href={href} className={classes}>
        {children}
      </Link>
    );
  }
  return (
    <button type={type} onClick={onClick} disabled={disabled} className={classes}>
      {children}
    </button>
  );
}
