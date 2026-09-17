// Darkens the edge of a banner photo that carries text: from the bottom below md,
// from the left at md and up, fading out by the centre.
export default function BannerShadow() {
  return (
    <div
      aria-hidden="true"
      className="pointer-events-none absolute inset-0 bg-linear-to-t from-ink-900/80 via-ink-900/45 via-30% to-transparent to-60% md:bg-linear-to-r md:via-ink-900/40 md:via-25% md:to-50%"
    />
  );
}
