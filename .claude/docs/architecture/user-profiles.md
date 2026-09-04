# User profiles

**Code as of:** the profile-backend work of 2026-08-20, uncommitted at the time
of writing. Re-stamp with the real sha once it lands. Every claim below was read
from the code, and the endpoint behaviours are covered by `UserProfileIT`,
`NotificationPreferencesIT`, `InterestCatalogueIT` and `MyAccountIT`, all of
which run against real PostgreSQL with `ddl-auto: validate`.

**State:** live. Profile content and email preferences persist end to end.
**Three things are deliberately still missing** and are written up in
*Known gaps*: nobody can view anybody else's profile, so the two visibility
toggles govern nothing yet; there is no photo upload; and interests are stored
but nothing reads them.

---

## In one paragraph

A profile is the part of a student the account itself does not hold: a bio, a
degree and faculty, the subjects they study, three social links, a set of
interests, and two switches for what other people are allowed to see. It lives
in its own table keyed on the user id rather than as columns on `users`, and it
is written by one endpoint that replaces the whole thing at once. Interests are
drawn from a fixed vocabulary held in the database and enforced by a foreign
key; subjects, next to them, are free text. Email preferences are five booleans
in a third table with their own endpoint, because they answer a different
question for a different reader. On the frontend, one provider loads the profile
once for all five settings screens, and that is not a performance decision — it
is what stops the editor erasing itself.

---

## Read this before you change anything here

- **The write replaces everything.** `PUT /api/v1/users/me/profile` is not a
  patch, and the four editor screens each submit a *whole* profile even though
  each shows a slice of one. That is only safe because `ProfileProvider` loads
  one profile above all of them. **Anything that builds a draft from
  `emptyProfile()` instead of the loaded profile will erase every field it does
  not show, the first time someone presses Save.** `savingReplacesEverythingRatherThanMerging`
  in `UserProfileIT` pins the server half of this.
- **`ProfileLinks.normalise` checks the scheme before assuming https, and that
  order is the security property.** Reversed, `javascript:alert(1)` becomes
  `https://javascript:alert(1)` — an https URL that passes a scheme check and
  reaches an `href`. There is a test named after exactly that on both sides of
  the wire.
- **`UserProfile` is not on `User`, and must not become so.** `User` is the
  Spring Security principal and `JWTAuthenticationFilter` re-loads it on every
  authenticated request. Separately, the frontend contract test keys on
  `Record<keyof User, true>`, so a field added to `User` fails type-check until
  the backend serialises it too.
- **A profile stores interest *slugs*, never labels.** The label is the part
  that gets revised, and keying on it would move everybody's choices whenever a
  word changed.
- **Absence is a supported state.** Every account that predates this work has no
  profile row, so a read with no row answers with a complete empty profile
  rather than a 404, and a write creates the row on the way past.

---

## Why a separate table

`users` is the security principal. `JWTAuthenticationFilter` looks the row up on
every single authenticated request in order to decide what the caller may do,
and nothing on a profile participates in that decision. Putting a bio in that
query would make every request in the system pay for a column two screens read.

The table is keyed on `user_id` as its primary key rather than carrying its own
`BIGSERIAL`. A profile has no identity apart from the person it describes and
there can only ever be one, so a shared primary key says both of those things in
the schema instead of in a comment plus a unique index.

### Why the row is created lazily

Not at sign-up. Every account that exists today predates the table, so a
create-on-registration hook would still have to cope with profiles that are
absent — and then a profile would have two ways to come into being instead of
one. Creating it on first write means there is exactly one path, and the *no row
yet* case is exercised constantly rather than only by old accounts.

---

## Why the write is a PUT

This is the decision the whole feature is shaped around, and it comes from the
UI rather than from taste.

The editor is five screens behind a rail. Three of them — *Edit profile*,
*Program info*, *Interests* — each own a slice of one profile, and each calls
the same save with a complete `UserProfile` object. When nothing persisted, that
was harmless. The moment it does, the question becomes: what does it mean for
*Program info* to submit `bio: null`?

There are two honest answers and one dishonest one.

- **PATCH with absent-means-untouched.** A Java record cannot distinguish an
  absent key from an explicit `null` without wrapping every component in an
  `Optional` or a `JsonNullable`. That is real machinery, invented here, to
  express something no caller actually needs.
- **PUT with full replace.** `null` means *clear this field* and nothing else.
  The cost is that the client must hold the whole profile before it may save —
  which is a requirement, not an accident, and is met by `ProfileProvider`.
- **PATCH where null means untouched.** Rejected: it makes clearing a bio
  impossible, which is a thing people legitimately want to do.

PUT was chosen. The consequence is documented at both ends: on
`UserProfileUpdateRequest`, on `saveProfile`, and in `ProfileProvider`'s header,
because the invariant lives on the frontend and the endpoint cannot enforce it.

The name is the exception. It sits on `users`, not on the profile, so it is
written by `PATCH /api/v1/users/me` — genuinely a patch, changing one named
field and leaving the rest of the account alone. The *Edit profile* screen
therefore makes two calls, and only makes the first one when the name actually
changed.

---

## The interest catalogue

Interests are a closed vocabulary; subjects, sitting next to them in the same
form, are free text. The asymmetry is deliberate and worth not *fixing*.

An interest exists so that two people who both picked it are discoverable as the
same thing. `Board games`, `board games` and `Boardgames` are three groups of
one, so the value has to come from a shared list. A subject is never matched
against anything — nobody can enumerate every course McGill offers, and a closed
list that is missing your programme tells you your programme does not exist.

The list lives in `interest_catalogue`, seeded by `V20`. That makes it Flyway's
by the `database-lifecycle` rule for system lookups: it must exist identically
in every environment, it changes rarely, and no user action creates or destroys
a row. The schema (`V19`) and the rows (`V20`) are separate files so that
revising the list later is a new migration rather than an edit to an applied
one.

**Keyed on `slug`, not `label`.** The 76 entries were invented for a campus
audience and have had no product review, so renames are likely. With a label
key, renaming `LGBTQ+` would have to rewrite every `user_interests` row that
referenced it inside the same migration, or orphan them. With a slug it is an
`UPDATE` of one column in one row and nobody's selections move.

**`GET /api/v1/interests` is public**, and the frontend fetches it rather than
holding a copy. It previously held the only copy, as `INTEREST_CATEGORIES` in
`lib/profile-options.ts`. That constant is gone: two vocabularies that must
agree with nothing checking that they do is precisely the failure
`contracts/api-dto-fields.json` exists to prevent, and it should not be
reintroduced one directory over. `DEGREES` and `MCGILL_FACULTIES` stayed in that
file, because nothing stores a foreign key to a degree — and faculties get
renamed, which a `CHECK` constraint would turn into a migration that has to ship
before the frontend can.

**The FK is `ON DELETE RESTRICT`, not `CASCADE`, and that asymmetry is
intentional.** Deleting a *profile* should take its choices with it; retiring an
*interest* should not silently delete it from every profile that picked it.
RESTRICT makes that attempt fail loudly, so retiring an entry is a decision
somebody makes on purpose.

The service still checks slugs against the catalogue before writing, so an
unknown one is a 400 naming the slug rather than a constraint violation
surfacing as a 500. The key is what makes the guarantee true; the check only
decides what the caller is told.

---

## Why email preferences are their own table

They are not profile content. A profile is what other students see; preferences
are what the mail path may send, and the two are read by different code for
different reasons. When something eventually asks *may I email this person about
tomorrow's event*, it should read five booleans without dragging a bio, a
faculty and three social links along with it — and a profile read should not be
loading mail policy either.

**A read does not create a row.** `NotificationPreferencesService` returns a
transient entity when none exists. Persisting on read would turn every visit to
the settings screen into an INSERT and, worse, would freeze today's defaults into
rows for people who never touched a switch — so changing a default later would
only affect accounts that had never looked at it.

That makes the entity's field initialisers the *meaning* of an absent row, and
they have to agree with `V21`'s column defaults and with the editor's initial
state. All three say the same thing: everything on except `productNews`. Four of
them are why somebody signed up; the fifth is marketing they did not ask for.

**There is deliberately no switch for password resets or email confirmations.**
Those are transactional — the person asked for each one — and a preference that
could silence them would lock somebody out of their own account with no way
back in.

---

## The social links

Three columns, not the single opaque JSON string that `clubs.social_links` uses.
That column is unvalidated, the contract test can only see one field name for
it, and every reader has to parse it and handle the parse failing. Naming the
three links lets the schema, the DTO and the TypeScript interface all agree, and
the deliberate divergence from the existing table is recorded in `V18` so it
does not read as an oversight.

### The check happens twice, on purpose

`normaliseProfileLink` (`frontend/app/lib/profile.ts`) runs in the browser and is
therefore **not a control** — anything holding a token can PUT straight past it.
`ProfileLinks.normalise` (backend) is the control. The frontend copy stays
because it guards the *render*, and a row written before the server rule existed
would still reach an `href`.

Both refuse any scheme other than http and https, and both check the scheme
*before* assuming https for a bare `instagram.com/someone`. Both have a test
named after that ordering, because the failure is silent: reverse the two steps
and every hostile scheme becomes a valid-looking https URL.

One known false refusal: `instagram.com:443/x` is read as a scheme of
`instagram.com`, because dots are legal in a scheme, and is refused. Nobody types
that, and the alternative — special-casing anything containing a dot — is a rule
an attacker gets to aim at.

---

## The frontend shape

```
app/(protected)/profile/
├── layout.tsx              mounts ProfileProvider over everything below
├── page.tsx                the read-only profile
└── edit/
    ├── layout.tsx          the settings rail (server component)
    ├── page.tsx            name, bio, links, visibility  → 2 endpoints
    ├── program/page.tsx    degree, faculty, subjects
    ├── interests/page.tsx  the picker
    ├── notifications/page.tsx   loads and saves independently
    └── account/page.tsx    email (local only), password reset, closure (disabled)
```

`ProfileProvider` is mounted at `(protected)/profile/layout.tsx` rather than at
`profile/edit/layout.tsx`, so that moving between viewing your profile and
editing it does not refetch — and, far more importantly, so the editor's
sections cannot each start from a different idea of what the profile is.

**Notifications loads its own data** rather than going through the provider.
They are not profile content, and unlike the profile they are edited by exactly
one screen which owns all five switches. There is no slice to clobber.

### Two seams that had to be widened

- **`useEditableForm` gained `reinitialise(next)`.** `initial` is only read on
  the first render — `useState` ignores it afterwards — so a form that mounts
  before its data arrives had no way to pick that data up. Distinct from
  `commit`, which promotes what the user typed; `reinitialise` discards the
  draft, so it is only ever called with a value from the server.
- **`AuthContext` gained `refreshUser()` and `applyUser(user)`.** `user` is
  fetched once, on mount. Renaming yourself would otherwise leave the navbar and
  the profile header showing the old name until a reload. `applyUser` is the
  cheap path for a caller that already holds the PATCH response, which is what
  the edit screen uses.

`SaveChangesBar` now shows what the server said rather than a fixed sentence.
The refusals this screen can provoke are specific and actionable — a link that
is not http, an interest outside the catalogue, too many subjects — and *try
again in a moment* is wrong for every one of them, because trying again
unchanged will fail again.

---

## The API contract

Four DTOs were added to `contracts/api-dto-fields.json` and to both asserting
tests: `UserProfileDTO`, `ProfileSocialLinksDTO`, `NotificationPreferencesDTO`,
`InterestDTO`.

**`ProfileSocialLinksDTO` is contracted in its own right, and that is not
redundant.** The contract records a nested object as a *single field name* —
`UserProfileDTO` contributes `socialLinks` and says nothing about what is inside
it, exactly as `MyEventDTO` contributes `event`. Without an entry of its own,
renaming `instagram` on one side would break the app with both suites still
green. Pinning it required extracting the previously-anonymous inline object type
in `types/index.ts` into a named `ProfileSocialLinks` interface, because
`Record<keyof T, true>` needs a name to key on.

Both sides carry a symmetry test, so a half-finished change fails loudly rather
than quietly stopping checking something.

---

## Endpoints

| Method | Path | Auth | Notes |
|---|---|---|---|
| `GET` | `/api/v1/users/me/profile` | required | Complete empty profile when no row exists |
| `PUT` | `/api/v1/users/me/profile` | required | Full replace; answers with what was stored |
| `GET` | `/api/v1/users/me/notification-preferences` | required | Defaults when no row exists |
| `PUT` | `/api/v1/users/me/notification-preferences` | required | Full replace |
| `PATCH` | `/api/v1/users/me` | required | `{ name }` only; answers with `UserDTO` |
| `GET` | `/api/v1/interests` | **public** | The catalogue, already in order |

Everything under `/api/v1/users/me` needed **no** `SecurityFilterChainConfig`
entry — it is in no `permitAll` list and falls through to
`.anyRequest().authenticated()`. `GET /api/v1/interests` needed one, and it was
added inside the existing public-GET block; matchers are evaluated in order and
the first match wins, which is why the narrower `.authenticated()` matchers above
it must stay above it.

The acting user always comes off the token, never from a path variable. That is
what makes it impossible for one user to read or write another's profile, and it
is asserted directly (`oneUsersProfileIsInvisibleToAnother`,
`oneUserCannotRenameAnother`).

Note that an unauthenticated request answers **403, not 401** — that is app-wide
behaviour from `DelegatedAuthEntryPoint` routing `AuthenticationException`
through `DefaultExceptionHandler`, not something specific to these routes.

---

## Known gaps

1. **Nobody can view anybody else's profile.** `showInterests` and
   `showSocialLinks` are stored, editable, and govern how a profile looks *to
   other people* — and `/profile` only ever shows you your own, where you always
   see everything. **Both switches currently control nothing.** Closing this
   needs a route, a decision about what a visitor may see, and a public read
   endpoint; the visibility flags are already in place for it.
2. **Interests are stored and never read.** Nothing suggests clubs or events
   from them, and the picker's own copy says *we'll use these to suggest clubs
   and events worth your time*, which is a promise the system does not yet keep.
3. **No photo upload.** `ProfileAvatar` draws the first initial, and the editor
   says so in words rather than showing a disabled button. There is no avatar
   column on `users` or on the profile. S3 is already wired for club logos and
   event banners, so it is the same path with a different owner.
4. **The email address cannot be changed.** The field renders on
   `/profile/edit/account` and its Save commits locally only. It is the login
   identifier, so it needs a confirm-by-mail round trip — `AuthTokenPurpose`
   would gain an `EMAIL_CHANGE` member and `auth_tokens` (V11) already has the
   machinery.
5. **Account closure has no endpoint.** The confirmation panel is built and its
   destructive button is deliberately `disabled` with a note, because the
   nearest wired action is sign-out and that would tell somebody their data was
   gone while every row of it remained. A club owner cannot simply leave, so
   closure has to refuse or force a transfer first.
6. **The catalogue and the faculty list have had no product review.** 76
   interests invented for a campus audience, and 12 faculties transcribed by hand
   — and faculties do get renamed.
7. **The catalogue serves only profiles so far — clubs are meant to share it.**
   [`interests_and_categories.md`](../decisions/interests_and_categories.md)
   decides that clubs carry tags drawn from this same `interest_catalogue`,
   which is what will make *clubs you might like* a direct join on shared slugs
   rather than a mapping. Events get their **own** vocabulary, because they also
   need format words such as *Workshop* and must exclude interest words such as
   *Make friends*. Until that work lands, clubs have no classification at all
   and `event_categories` (V3) is still free text with no key.
   `user_preferred_categories` was dropped in V22.

   Two things there touch this table directly. The catalogue will need entries
   it currently lacks once clubs use it — there is no `engineering`, for one.
   And `interest_catalogue.category`, the twelve picker groups, becomes the last
   overloaded use of the word *category* once `club_categories` exists; renaming
   it `group_label` is free while V19 and V20 are uncommitted and costs a
   migration afterwards.
