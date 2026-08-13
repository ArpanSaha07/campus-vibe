"use client";

import { useState } from "react";
import Image from "next/image";

type Size = "sm" | "md" | "lg";

// px is what next/image is asked to produce; the box classes are what the
// browser paints it into. They are kept together so a size can never be
// requested at one scale and rendered at another.
const sizes: Record<Size, { box: string; initial: string; px: number }> = {
  sm: { box: "h-12 w-12", initial: "text-lg", px: 48 },
  md: { box: "h-16 w-16", initial: "text-xl", px: 64 },
  lg: { box: "h-20 w-20", initial: "text-3xl", px: 80 },
};

/**
 * A club's logo in a lavender circle, falling back to the club's first initial.
 *
 * Three cases collapse into one here, which is why this is a component rather
 * than repeated markup:
 *
 *  - no logo at all — `null` from the backend, already mapped to a placeholder
 *    by toClub(), or an empty string in seed data;
 *  - a logo string that is only whitespace, which is truthy and would otherwise
 *    render an <Image> with a blank src;
 *  - a logo that is present but unfetchable — a stale path, or an S3 object
 *    that went away. Nothing but a load error can detect this one, and without
 *    it the circle renders empty, which reads as a layout bug rather than a
 *    missing image.
 *
 * alt is empty by design: every current caller renders the club's name as text
 * immediately beside this, so a description here would be read out twice. Pass
 * `alt` explicitly at a call site where that stops being true.
 */
export default function ClubLogo({
  name,
  logo,
  size = "md",
  alt = "",
  className = "",
}: {
  name: string;
  logo?: string | null;
  size?: Size;
  alt?: string;
  className?: string;
}) {
  const [failed, setFailed] = useState(false);
  const { box, initial, px } = sizes[size];
  const showImage = Boolean(logo?.trim()) && !failed;

  return (
    <span
      className={`flex ${box} shrink-0 items-center justify-center overflow-hidden rounded-full bg-lavender-100 ${className}`}
    >
      {showImage ? (
        <Image
          src={logo as string}
          alt={alt}
          width={px}
          height={px}
          className="h-full w-full object-cover"
          onError={() => setFailed(true)}
        />
      ) : (
        <span className={`font-display ${initial} font-bold text-lavender-600`}>
          {name.charAt(0).toUpperCase()}
        </span>
      )}
    </span>
  );
}
