import Image from "next/image";

/**
 * An event image that is never cropped or stretched.
 *
 * Instagram posters are portrait (stories are 9:16, posts 4:5), and the card
 * and banner frames are landscape. `object-cover` would cut the date and venue
 * off the poster, so the whole image is shown with `object-contain`, and a
 * blurred, enlarged copy of the same image fills the space around it. The frame
 * keeps the size it always had.
 *
 * Used for imported events only; uploaded banners are chosen for the frame and
 * keep `object-cover`.
 *
 * `fit="card"` is the event card's exception (Arpan, 2026-11-26): whole, a
 * portrait poster in the 160px card frame is only a third of the card wide, so
 * there it fills a centred box 80% of the frame's width and is cropped top and
 * bottom, anchored to the top, where a poster's title usually sits. The event
 * page banner keeps the whole poster.
 */
export default function EventPoster({
  src,
  alt,
  sizes,
  priority,
  rounded = "",
  fit = "whole",
}: {
  src: string;
  alt: string;
  sizes?: string;
  priority?: boolean;
  rounded?: string;
  fit?: "whole" | "card";
}) {
  return (
    <div className={`relative w-full h-full overflow-hidden bg-ink-900 ${rounded}`}>
      <Image
        src={src}
        alt=""
        aria-hidden="true"
        fill
        sizes={sizes}
        className="object-cover scale-125 blur-2xl opacity-60"
      />
      {fit === "card" ? (
        <div className="absolute inset-y-0 left-1/2 w-4/5 -translate-x-1/2">
          <Image
            src={src}
            alt={alt}
            fill
            sizes={sizes}
            priority={priority}
            quality={90}
            className="object-cover object-top"
          />
        </div>
      ) : (
        <Image src={src} alt={alt} fill sizes={sizes} priority={priority} quality={90} className="object-contain" />
      )}
    </div>
  );
}
