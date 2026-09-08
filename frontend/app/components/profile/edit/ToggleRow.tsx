"use client";

import Link from "next/link";
import { ArrowRight } from "lucide-react";
import Toggle from "@/app/components/ui/Toggle";

/**
 * One visibility switch: what it controls, what that means, and a way to go and
 * edit the thing itself.
 *
 * The link matters more than it looks. A switch that says `Show interests` when
 * you have chosen none is a control over nothing, and without a route to the
 * list the only way to find out is to save and go look at your profile.
 */
export default function ToggleRow({
  title,
  description,
  checked,
  onChange,
  linkHref,
  linkLabel,
}: {
  title: string;
  description: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  linkHref?: string;
  linkLabel?: string;
}) {
  return (
    <div className="flex items-start justify-between gap-6 py-5">
      <div className="min-w-0">
        <h3 className="font-semibold text-ink-900">{title}</h3>
        <p className="mt-1 text-sm text-ink-600">{description}</p>
        {linkHref && linkLabel && (
          <Link
            href={linkHref}
            className="mt-2 inline-flex items-center gap-1.5 text-sm font-semibold text-lavender-600 transition-colors hover:text-lavender-800"
          >
            {linkLabel}
            <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
          </Link>
        )}
      </div>
      <Toggle checked={checked} onChange={onChange} label={title} />
    </div>
  );
}
