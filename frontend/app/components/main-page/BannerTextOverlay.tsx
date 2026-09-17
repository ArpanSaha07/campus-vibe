type BannerTextOverlayProps = {
  eyebrow: string;
  title: string;
  description: string;
};

// White text over a banner photo: pinned to the bottom below md, to the left and
// vertically centred at md and up. Sits over a BannerShadow so it stays legible.
export default function BannerTextOverlay({ eyebrow, title, description }: BannerTextOverlayProps) {
  return (
    <div className="pointer-events-none absolute inset-0 flex flex-col justify-end px-5 pb-10 text-white md:w-1/2 md:justify-center md:px-10 md:pb-0 lg:px-14">
      <h2 className="font-display font-extrabold drop-shadow-sm">
        <span className="block text-2xl leading-tight md:text-3xl lg:text-4xl">{eyebrow}</span>
        <span className="block text-4xl leading-[1.05] lg:text-6xl">{title}</span>
      </h2>
      <p className="mt-3 max-w-xl text-sm leading-relaxed line-clamp-2 drop-shadow-sm md:mt-4 md:text-[0.9375rem] md:line-clamp-3 lg:line-clamp-4">
        {description}
      </p>
    </div>
  );
}
