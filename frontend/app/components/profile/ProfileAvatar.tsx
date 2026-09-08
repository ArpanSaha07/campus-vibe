/**
 * The user's first initial in a lavender circle.
 *
 * A placeholder, not a fallback. There is no avatar field on `User` to fall
 * back from and no upload anywhere in the app, so this is the whole avatar for
 * now — when uploads land it grows an image branch the way ClubLogo has one.
 *
 * Not ClubLogo with different props: almost all of that component is the three
 * separate ways a logo URL can fail to render, and none of them can happen
 * here.
 *
 * `aria-hidden` because the name is always rendered as text beside it. The
 * letter carries no information a screen reader has not already been given,
 * and reading out a lone "A" is noise.
 */
export default function ProfileAvatar({
  name,
  className = "",
}: {
  name: string;
  className?: string;
}) {
  return (
    <span
      aria-hidden="true"
      className={`flex h-24 w-24 shrink-0 items-center justify-center rounded-full bg-lavender-200 ${className}`}
    >
      <span className="font-display text-4xl font-bold text-lavender-800">
        {name.trim().charAt(0).toUpperCase()}
      </span>
    </span>
  );
}
