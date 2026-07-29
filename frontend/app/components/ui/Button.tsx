import Link from "next/link";
import type { ReactNode } from "react";

type Variant = "primary" | "secondary" | "berry";
type Size = "md" | "lg";

const variantClasses: Record<Variant, string> = {
  primary: "bg-lavender-600 text-white hover:bg-lavender-800",
  secondary: "bg-white text-ink-900 border border-mist-200 hover:bg-lavender-50",
  berry: "bg-berry-600 text-white hover:bg-berry-700",
};

const sizeClasses: Record<Size, string> = {
  md: "h-10 px-5 text-sm",
  lg: "h-12 px-7 text-base",
};

interface ButtonProps {
  children: ReactNode;
  variant?: Variant;
  size?: Size;
  href?: string;
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
  onClick,
  type = "button",
  disabled,
  className = "",
}: ButtonProps) {
  const classes = `inline-flex items-center justify-center gap-2 rounded-full font-semibold
    transition-colors duration-150 active:scale-[0.98] disabled:opacity-50 disabled:pointer-events-none
    ${variantClasses[variant]} ${sizeClasses[size]} ${className}`;

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
