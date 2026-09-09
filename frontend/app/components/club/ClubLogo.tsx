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
 * Whether next/image can be handed this value at all.
 *
 * It accepts a root-relative path or an absolute http(s) URL, and **throws**
 * (`Failed to construct 'URL': Invalid URL`) on anything else. A throw during
 * render is not something `onError` can catch — that fires on a failed *load*,
 * long after this has already taken the page down.
 *
 * What actually arrives here that is neither: a raw S3 object key.
 * `ClubController.uploadLogo` stores `clubs/{id}/logo-{filename}` in
 * `clubs.logo`, and `ClubDTO` hands that key to the browser untouched, because
 * there is no read path that turns a key into a URL — not for club logos, club
 * images, event banners or avatars. Until there is, a club whose logo has been
 * uploaded renders its initial, which is the same fallback as a club with no
 * logo and is at least true: we cannot address the image.
 */
function isRenderableSrc(value: string): boolean {
  // Served by the frontend itself, e.g. /new-campusvibe-logo.png.
  if (value.startsWith("/")) return true;
  try {
    const { protocol } = new URL(value);
    return protocol === "http:" || protocol === "https:";
  } catch {
    return false;
  }
}

/**
 * A club's logo in a lavender circle, falling back to the club's first initial.
 *
 * Four cases collapse into one here, which is why this is a component rather
 * than repeated markup:
 *
 *  - no logo at all — `null` from the backend, already mapped to a placeholder
 *    by toClub(), or an empty string in seed data;
 *  - a logo string that is only whitespace, which is truthy and would otherwise
 *    render an <Image> with a blank src;
 *  - a logo that is not addressable as an image at all — today, an S3 object
 *    key. See isRenderableSrc: this one has to be caught *before* rendering,
 *    because next/image throws on it rather than failing to load;
 *  - a logo that is present, well-formed and unfetchable — a stale path, or an
 *    S3 object that went away. Nothing but a load error can detect this one,
 *    and without it the circle renders empty, which reads as a layout bug
 *    rather than a missing image.
 *
 * alt is empty by design: every current caller renders the club's name as text
 * immediately beside this, so a description here would be read out twice. Pass
 * `alt` explicitly at a call site where that stops being true.
 */
export default function ClubLogo({
  name,
  logo,
  size = "lg",
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
  const src = logo?.trim() ?? "";
  const showImage = src !== "" && isRenderableSrc(src) && !failed;

  return (
    <span
      className={`flex ${box} shrink-0 items-center justify-center overflow-hidden rounded-full bg-lavender-100 ${className}`}
    >
      {showImage ? (
        <Image
          src={src}
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
