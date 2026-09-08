import type { UserProfile } from "@/app/types";

/**
 * The bio and study details, or the prompt to write them.
 *
 * Every field is optional and independent, so this has to read well at each
 * stage of being filled in — bio only, studies only, some of the studies, or
 * nothing at all. Hence one wholly separate empty branch for "nothing yet",
 * and a study list built by filtering: a card headed About with three blank
 * rows under it looks broken, while the same card with only a degree in it
 * looks finished.
 *
 * Degree, faculty and subjects share one row of pills rather than sitting in a
 * labelled list. Each value already says what it is — "BSc Computer Science"
 * needs no caption reading Degree — and one flat row keeps a student with six
 * subjects from stacking six rows.
 *
 * `profile` is null today for everyone, since no endpoint returns one — so the
 * empty branch is the live path, not a rarely-hit corner. That is fine: it is
 * also what a brand-new account will see once the edit form exists.
 */
export default function ProfileAboutCard({ profile }: { profile: UserProfile | null }) {
  // Trimmed before testing, so a field holding only spaces counts as unset
  // rather than rendering an empty line under its own label.
  const bio = profile?.bio?.trim() || null;
  const faculty = profile?.faculty?.trim() || null;
  const degree = profile?.degree?.trim() || null;
  const subjects = profile?.subjects?.filter((subject) => subject.trim()) ?? [];

  // Degree first, then faculty, then subjects — broadest to narrowest, so the
  // row reads as an answer to "what are you studying" rather than a bag of
  // tags. Falsy entries are dropped here so the render below stays a plain map.
  const studies = [degree, faculty, ...subjects].filter((value): value is string => Boolean(value));
  const hasStudies = studies.length > 0;

  return (
    <section className="rounded-2xl border border-mist-200 bg-white p-6">
      <h2 className="font-display text-2xl font-bold text-ink-900">About</h2>

      {!bio && !hasStudies ? (
        <p className="mt-3 text-ink-600">
          Nothing here yet. Add a bio and what you&apos;re studying, so the clubs you
          follow know who&apos;s turning up.
        </p>
      ) : (
        <>
          {/* whitespace-pre-line so the paragraph breaks someone typed survive.
              Without it a considered three-paragraph bio renders as one slab. */}
          {bio ? (
            <p className="mt-3 whitespace-pre-line leading-relaxed text-ink-900">{bio}</p>
          ) : (
            <p className="mt-3 text-ink-600">No bio yet.</p>
          )}

          {hasStudies && (
            /* A list, not a row of spans: to a screen reader these are five
               unrelated facts, and "list of 5 items" is the only thing that
               says where one ends and the next begins once the labels are
               gone. */
            <ul className="mt-6 flex flex-wrap gap-2 border-t border-mist-200 pt-5">
              {studies.map((study) => (
                <li
                  key={study}
                  /* Outlined in berry with no fill and no hover — these state
                     something, they do nothing. A filled pill would read as a
                     chip you can select, and a hover response would promise a
                     click that never comes. */
                  className="rounded-full border border-berry-500 px-4 py-2 text-xs font-semibold text-berry-500"
                >
                  {study}
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </section>
  );
}
