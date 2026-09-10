'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import InterestPicker from '@/app/components/profile/edit/InterestPicker';
import Button from '@/app/components/ui/Button';
import FormField, {
  inputClasses,
  selectClasses,
  textareaClasses,
} from '@/app/components/ui/FormField';
import Toast from '@/app/components/ui/Toast';
import { useClubCategories } from '@/app/hooks/useClubCategories';
import { useCreateClubForm } from '@/app/hooks/useCreateClubForm';
import { useAuth } from '@/app/lib/auth-context';
import { isAdmin } from '@/app/lib/user';
import { useManagedClubs } from '@/app/lib/managed-clubs-context';
import { revalidateClubs } from '@/app/lib/actions/revalidate';
import { clubSlug } from '@/app/lib/services/clubService';
import { LogoPreview } from '../PhotoFileUploadPreview';
import { ClubFormErrorBoundary } from './ClubFormErrorBoundary';

/**
 * The one club-creation form, on both paths.
 *
 * A platform admin creates the club directly and becomes its owner, so the logo
 * is collected and saved. Everyone else submits a proposal for review, which
 * carries everything except the logo — a proposal has no club id and no S3 key,
 * so that one control is **absent** rather than disabled. There is no note
 * promising it later either; the requester adds it from /manage/[clubId] once
 * approval makes them the owner. See ADR-004 and its 2026-09-10 amendment.
 *
 * The four contact links are on both paths. They were once admin-only for the
 * same reason as the logo, which was wrong: they need no club id and no S3 key,
 * and leaving them out meant a club born by proposal reached its public page
 * with an empty contact block.
 *
 * <strong>Every field here maps to a column on `Club`</strong>, and nothing on
 * `Club` that a creator may set is missing:
 * `id` (derived, shown read-only) · `name` · `description` · `category_slug` ·
 * `club_interests` · `logo` · `social_links` · `official_email`. `followers`,
 * `featured` and `created_at` are the server's to set.
 *
 * **`official_email` is seeded from the contact email below** and is not a
 * field of its own (Arpan, 2026-09-10). It was unsettable at creation until
 * then, on the reasoning that writing it must reset its verified stamp — which
 * is about a club that already has one. Changing it afterwards is still a
 * platform admin's alone, through its own endpoint, and a seeded address is
 * unverified like any other (ADR-006).
 *
 * Banner photos used to be here, ten pickers deep. They are a club's own
 * content rather than part of deciding it should exist, so they moved to the
 * club editor with every other after-the-fact field (BUG-043).
 */
export default function CreateClubForm() {
  const router = useRouter();
  const { user } = useAuth();
  const { refresh } = useManagedClubs();
  const admin = isAdmin(user);
  const [submitted, setSubmitted] = useState(false);

  const {
    formData,
    errors,
    isSubmitting,
    logoPreview,
    logoInputRef,
    handleInputChange,
    handleLogoChange,
    removeLogo,
    handleSubmit,
    setCategory,
    setInterests,
    dismissGeneralError,
  } = useCreateClubForm(admin ? 'create' : 'propose', async (createdClubId) => {
    if (createdClubId) {
      // The managed-clubs provider is what draws the Manage link and decides
      // where /manage forwards to. Without this refresh the admin owns a club
      // the UI does not know about until a full reload. Synchronous: it bumps
      // a tick the provider's effect watches, so there is nothing to await.
      refresh();
      // And /clubs is cached for five minutes, so without this the club they
      // just made is missing from the grid they go back to.
      await revalidateClubs();
      router.push(`/manage/${createdClubId}`);
      return;
    }
    setSubmitted(true);
  });

  const { categories, failed: categoriesFailed } = useClubCategories();

  // Club.id is a slug the client decides, not something the server generates,
  // so it is derived from the name here and sent as `id` on both paths —
  // `proposed_slug` on a proposal. It is only *shown* on the admin path; see
  // the note on the preview below. See `clubSlug`.
  const slug = clubSlug(formData.name);

  // A proposal has nowhere to send anyone: no club exists, and nothing notifies
  // the requester when it is reviewed (notifications are not built). Saying so
  // is the honest end of the flow -- better than the silent form reset this
  // used to do, which looked like nothing had happened.
  if (submitted) {
    return (
      <main className="mx-auto w-full max-w-2xl px-4 py-16 sm:px-6 lg:px-8 fade-up">
        <p className="ticket-label text-lavender-600">Submitted</p>
        <h1 className="mt-2 font-display text-4xl font-bold text-ink-900">
          Your club is with a reviewer
        </h1>
        <p className="mt-3 text-ink-600">
          If it is approved the club is created and you become its owner. It will appear
          under Manage, and that is where you add a logo, photos and links. Nothing emails
          you yet, so check back.
        </p>
        <div className="mt-8 flex flex-wrap gap-3">
          <Button href="/clubs">Browse clubs</Button>
          <Button variant="secondary" onClick={() => setSubmitted(false)}>
            Propose another
          </Button>
        </div>
      </main>
    );
  }

  return (
    <ClubFormErrorBoundary>
      <main className="mx-auto w-full max-w-2xl px-4 py-10 sm:px-6 sm:py-16 lg:px-8 fade-up">
        <header>
          <p className="ticket-label text-lavender-600">
            {admin ? 'New club' : 'Club proposal'}
          </p>
          <h1 className="mt-2 font-display text-4xl font-bold text-ink-900">
            {admin ? 'Create a club' : 'Propose a club'}
          </h1>
          <p className="mt-3 text-ink-600">
            {admin
              ? 'You become its owner, so you can add the rest from its dashboard straight after.'
              : 'Tell us about the club. The platform administrator reviews it, and approving it makes you its owner.'}
          </p>
        </header>

        {/* noValidate for the same reason FormField refuses to set `required`
            on a control: the browser's own constraint checking pre-empts
            `clubValidator` entirely. A form with an invalid type=email or
            type=url control never fires submit at all, so our message beside
            the field is never written and the user gets a native bubble
            instead. Found when the contact email became optional on the
            proposal path -- a typo there was silently unsubmittable. */}
        <form onSubmit={handleSubmit} noValidate className="mt-10 space-y-10">
          {/* The basics — name, url and description. One group, no heading:
              a heading over the first group of a short form labels the form. */}
          <div className="space-y-6">
            <FormField
              label="Club name"
              htmlFor="name"
              required
              error={errors.name}
              hint={slug ? undefined : 'This is what students search for.'}
            >
              <input
                type="text"
                id="name"
                name="name"
                value={formData.name}
                onChange={handleInputChange}
                placeholder="Quantum Computing Society"
                disabled={isSubmitting}
                maxLength={100}
                autoComplete="off"
                aria-required="true"
                className={inputClasses}
              />
            </FormField>

            {/* Admin path only. The slug is still derived and still sent on
                both paths — it is `proposed_slug` on a proposal — but only an
                admin is choosing it here and now. A proposer's club may not be
                approved at all, and if it is, the address is settled at
                approval against whatever else has been created since; showing
                it while they type promises a URL nobody can hold for them.

                Rendered only once there is one, so an empty form is not
                fronted by an empty address. */}
            {admin && slug && !errors.name && (
              <p className="-mt-4 flex flex-wrap items-baseline gap-x-2 text-ink-600">
                <span className="ticket-label">URL</span>
                {/* font-mono without .ticket-label: that utility uppercases,
                    and a slug is a literal value, not a printed label. */}
                <span className="font-mono text-xs break-all">
                  /clubs/<span className="text-lavender-600">{slug}</span>
                </span>
              </p>
            )}

            <FormField
              label="Description"
              htmlFor="description"
              required
              error={errors.description}
              hint={`${formData.description.length}/1000 characters`}
            >
              <textarea
                id="description"
                name="description"
                value={formData.description}
                onChange={handleInputChange}
                placeholder="What the club does, who it is for, and when it meets."
                rows={5}
                maxLength={1000}
                disabled={isSubmitting}
                aria-required="true"
                className={textareaClasses}
              />
            </FormField>
          </div>

          {/* Two vocabularies, and they answer different questions. Both load
              from the server rather than being hardcoded, so neither list can
              drift from the one the foreign key checks against. See ADR-001. */}
          <div className="space-y-6 border-t border-mist-200 pt-10">
            <FormField
              label="Category"
              htmlFor="category"
              hint="What the club is. What it is about goes below."
            >
              <select
                id="category"
                name="category"
                value={formData.category ?? ''}
                onChange={(event) => setCategory(event.target.value || null)}
                disabled={isSubmitting || categories === null}
                className={selectClasses}
              >
                <option value="">
                  {categoriesFailed
                    ? "Categories didn't load"
                    : categories === null
                      ? 'Loading categories…'
                      : 'Select a category'}
                </option>
                {(categories ?? []).map((category) => (
                  <option key={category.slug} value={category.slug}>
                    {category.label}
                  </option>
                ))}
              </select>
            </FormField>

            <InterestPicker
              selected={formData.interests}
              onChange={setInterests}
              title="What is this club about?"
              // The cap is not stated here any more: `max` already enforces it,
              // and InterestPicker says so at the limit, where it matters.
              description="Students who share these interests will find you."
              max={8}
              capChoices
            />
          </div>

          {/* The logo exists only on the admin path. A proposal has no club id
              and no S3 key, so there is nothing to upload against — it is
              absent rather than disabled, and nothing here promises it later.
              The requester adds it from /manage/[clubId] once approval makes
              them the owner. */}
          {admin && (
            <div className="space-y-6 border-t border-mist-200 pt-10">
              <FormField label="Logo" htmlFor="logo" error={errors.logo}>
                <LogoPreview
                  logoPreview={logoPreview}
                  onRemove={removeLogo}
                  onUploadClick={() => logoInputRef.current?.click()}
                  isDisabled={isSubmitting}
                />
                <input
                  ref={logoInputRef}
                  id="logo"
                  type="file"
                  accept="image/*"
                  onChange={handleLogoChange}
                  disabled={isSubmitting}
                  className="sr-only"
                />
              </FormField>
            </div>
          )}

          {/* On both paths. These four are what a club page shows and what
              somebody looking for the club actually needs; dropping them from
              the proposal meant a club born by approval arrived with an empty
              contact block and its new owner had to go and add what nobody had
              asked them for. Carried onto the club at approval. */}
          <div className="space-y-6 border-t border-mist-200 pt-10">
              <div className="space-y-6 pt-2">
                {/* Required for an admin creating the club outright, optional
                    for a proposal — a student may not have an address for the
                    club yet, and refusing the form over it would be refusing
                    the club. `clubValidator` checks the shape either way. */}
                <FormField
                  label="Contact email"
                  htmlFor="social_email"
                  required={admin}
                  error={errors.social}
                  hint={
                    admin
                      ? "Shown on the club's page, and kept as the club's own address for recovery."
                      : "Shown on the club's page once it is approved, and kept as the club's own address for recovery."
                  }
                >
                  <input
                    type="email"
                    id="social_email"
                    name="social_email"
                    value={formData.socialLinks.email}
                    onChange={handleInputChange}
                    placeholder="hello@ssmu.ca"
                    disabled={isSubmitting}
                    aria-required={admin}
                    className={inputClasses}
                  />
                </FormField>

                <FormField label="Website" htmlFor="social_website">
                  <input
                    type="url"
                    id="social_website"
                    name="social_website"
                    value={formData.socialLinks.website}
                    onChange={handleInputChange}
                    placeholder="https://yourclub.ca"
                    disabled={isSubmitting}
                    className={inputClasses}
                  />
                </FormField>

                {/* The handle alone, and the server puts instagram.com in front
                    of it (`WebLinks.normaliseInstagram`) -- Arpan, 2026-09-10.
                    That half is bookkeeping rather than something a club has to
                    tell us, and the stored value is still the full URL, which
                    is what an href needs. A leading @ is stripped, and a pasted
                    profile URL is reduced to its handle rather than refused. */}
                <FormField
                  label="Instagram"
                  htmlFor="social_instagram"
                  // hint="Just the club's instagram handle."
                >
                  <input
                    type="text"
                    id="social_instagram"
                    name="social_instagram"
                    value={formData.socialLinks.instagram}
                    onChange={handleInputChange}
                    placeholder="yourclub002"
                    disabled={isSubmitting}
                    className={inputClasses}
                  />
                </FormField>

                <FormField label="Facebook" htmlFor="social_facebook">
                  <input
                    type="url"
                    id="social_facebook"
                    name="social_facebook"
                    value={formData.socialLinks.facebook}
                    onChange={handleInputChange}
                    placeholder="https://facebook.com/yourclub"
                    disabled={isSubmitting}
                    className={inputClasses}
                  />
                </FormField>
              </div>
          </div>

          {!admin && (
            <div className="border-t border-mist-200 pt-10">
              <FormField
                label="Anything the reviewer should know"
                htmlFor="message"
                error={errors.message}
                hint={`${formData.message.length}/2000 characters`}
              >
                <textarea
                  id="message"
                  name="message"
                  value={formData.message}
                  onChange={handleInputChange}
                  disabled={isSubmitting}
                  rows={4}
                  maxLength={2000}
                  placeholder="Who is behind this club, and what are you planning?"
                  className={textareaClasses}
                />
              </FormField>
            </div>
          )}

          <div className="border-t border-mist-200 pt-8">
            <Button type="submit" size="lg" disabled={isSubmitting} className="w-full">
              {isSubmitting
                ? admin
                  ? 'Creating…'
                  : 'Submitting…'
                : admin
                  ? 'Create club'
                  : 'Submit for review'}
            </Button>
            <p className="mt-3 text-center text-sm text-ink-600">
              {admin
                ? 'You can change any of this from the club dashboard afterwards.'
                : 'You can propose another club while this one is being reviewed.'}
            </p>
          </div>
        </form>
      </main>

      {/* Submission failures hover rather than push the form around. An inline
          panel had to be at the top to be found, which is exactly where nobody
          is looking after pressing a button at the bottom of a long form.
          Per-field errors stay beside their field, where the fix is made. */}
      <Toast message={errors.general ?? null} onDismiss={dismissGeneralError} />
    </ClubFormErrorBoundary>
  );
}
