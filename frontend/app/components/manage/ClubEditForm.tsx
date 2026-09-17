'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Image from 'next/image';
import InterestPicker from '@/app/components/profile/edit/InterestPicker';
import Button from '@/app/components/ui/Button';
import FormField, {
  inputClasses,
  selectClasses,
  textareaClasses,
} from '@/app/components/ui/FormField';
import Toast from '@/app/components/ui/Toast';
import ClubLogo from '@/app/components/club/ClubLogo';
import { ImageGallery, LogoPreview } from '@/app/components/PhotoFileUploadPreview';
import { useClubCategories } from '@/app/hooks/useClubCategories';
import { useManageClub } from '@/app/lib/manage-club-context';
import { useManagedClubs } from '@/app/lib/managed-clubs-context';
import { revalidateClubs, revalidateEvents } from '@/app/lib/actions/revalidate';
import { parseApiError } from '@/app/lib/auth-errors';
import { parseSocialLinks, toClub } from '@/app/lib/adapters';
import { instagramHandle } from '@/app/lib/links';
import { readPreview } from '@/app/lib/image-preview';
import {
  getClubForEdit,
  updateClub,
  uploadClubImages,
  uploadClubLogo,
} from '@/app/lib/services/clubService';
import {
  ACCEPTED_IMAGE_TYPES,
  validateClubForm,
  validateImageFile,
} from '@/app/lib/validators/clubValidator';
import type { ApiClub, ClubSocialLinks, FormErrors } from '@/app/types';

/** Per save, not per club: the endpoint takes a batch, and ten is plenty to pick at once. */
const MAX_NEW_PHOTOS = 10;

interface Fields {
  name: string;
  description: string;
  category: string | null;
  interests: string[];
  socialLinks: ClubSocialLinks;
}

function fieldsFrom(api: ApiClub): Fields {
  const links = parseSocialLinks(api.socialLinks);
  return {
    name: api.name,
    description: api.description ?? '',
    category: api.category,
    interests: api.interests,
    socialLinks: {
      email: links.email ?? '',
      website: links.website ?? '',
      facebook: links.facebook ?? '',
      // Stored as the full URL the server built; the field asks for the handle.
      instagram: links.instagram ? (instagramHandle(links.instagram) ?? links.instagram) : '',
      // Whole links, so no handle round trip -- what is stored is what the
      // field shows. Every key must appear here: one left out is read as empty
      // and saved back as empty, quietly clearing it.
      linkedin: links.linkedin ?? '',
      linktree: links.linktree ?? '',
    },
  };
}

/**
 * The club editor — every property of a club, for everyone who can open its
 * dashboard (CEM-01).
 *
 * Owner, club admin and platform admin alike: `PUT /clubs/{id}` and both upload
 * endpoints are guarded by `canManageClub`, and Arpan chose on 2026-09-15 not
 * to narrow that. Two things are deliberately absent. The slug is the club's
 * URL and does not change (CEM-03). The official email is the club's recovery
 * channel and stays a platform admin's alone, in its panel on the Overview.
 *
 * Photos are add-only: there is no delete endpoint, so existing ones are shown
 * but cannot be removed from here.
 *
 * Seeded from an uncached read, not the layout's `ManagedClub`, which carries
 * only the name and logo.
 */
export default function ClubEditForm({ clubId }: { clubId: string }) {
  const { reload } = useManageClub();
  const { refresh: refreshManagedClubs } = useManagedClubs();
  const { categories, failed: categoriesFailed } = useClubCategories();

  const [club, setClub] = useState<ApiClub | null>(null);
  const [loadFailed, setLoadFailed] = useState(false);
  const [fields, setFields] = useState<Fields | null>(null);

  const [logo, setLogo] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const [photos, setPhotos] = useState<File[]>([]);
  const [photoPreviews, setPhotoPreviews] = useState<string[]>([]);
  const logoInputRef = useRef<HTMLInputElement>(null);
  const photoInputRef = useRef<HTMLInputElement>(null);

  const [errors, setErrors] = useState<FormErrors>({});
  const [photoError, setPhotoError] = useState('');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState('');

  const load = useCallback(async () => {
    const api = await getClubForEdit(clubId);
    setClub(api);
    setFields(fieldsFrom(api));
  }, [clubId]);

  useEffect(() => {
    load().catch(() => setLoadFailed(true));
  }, [load]);

  function set<K extends keyof Fields>(key: K, value: Fields[K]) {
    setFields((prev) => (prev ? { ...prev, [key]: value } : prev));
  }

  function setLink(key: keyof ClubSocialLinks, value: string) {
    setFields((prev) =>
      prev ? { ...prev, socialLinks: { ...prev.socialLinks, [key]: value } } : prev,
    );
    if (errors.social) setErrors((prev) => ({ ...prev, social: undefined }));
  }

  async function pickLogo(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    const check = validateImageFile(file);
    if (!check.valid) {
      setErrors((prev) => ({ ...prev, logo: check.error }));
      return;
    }
    setErrors((prev) => ({ ...prev, logo: undefined }));
    setLogo(file);
    setLogoPreview(await readPreview(file));
  }

  function clearLogo() {
    setLogo(null);
    setLogoPreview(null);
    if (logoInputRef.current) logoInputRef.current.value = '';
  }

  async function pickPhotos(event: React.ChangeEvent<HTMLInputElement>) {
    const picked = Array.from(event.target.files ?? []);
    // Cleared so picking the same file again after removing it still fires.
    event.target.value = '';
    const room = MAX_NEW_PHOTOS - photos.length;
    const accepted: File[] = [];
    let refusal = '';
    for (const file of picked.slice(0, room)) {
      const check = validateImageFile(file);
      if (check.valid) accepted.push(file);
      else refusal = `${file.name}: ${check.error}`;
    }
    if (picked.length > room) refusal = `Up to ${MAX_NEW_PHOTOS} photos at a time.`;
    setPhotoError(refusal);
    if (accepted.length === 0) return;
    const previews = await Promise.all(accepted.map(readPreview));
    setPhotos((prev) => [...prev, ...accepted]);
    setPhotoPreviews((prev) => [...prev, ...previews]);
  }

  function removePhoto(index: number) {
    setPhotos((prev) => prev.filter((_, i) => i !== index));
    setPhotoPreviews((prev) => prev.filter((_, i) => i !== index));
  }

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!fields || !club || saving) return;

    setSaved('');
    // The create form's rules, minus the name-availability check: the slug does
    // not change on rename, so a name another club's slug would take is not a
    // conflict. `propose` because the contact email is optional here — a club
    // born by proposal may have none.
    const found = await validateClubForm(
      { ...fields, logo: null, message: '' },
      async () => false,
      'propose',
    );
    if (errors.logo) found.logo = errors.logo;
    setErrors(found);
    if (Object.keys(found).length > 0) return;

    setSaving(true);
    const renamed = fields.name.trim() !== club.name;
    let step = 'The club details';
    try {
      await updateClub(clubId, fields);
      if (logo) {
        step = 'The details saved, but the logo';
        await uploadClubLogo(clubId, logo);
      }
      if (photos.length > 0) {
        step = logo
          ? 'The details and logo saved, but the photos'
          : 'The details saved, but the photos';
        await uploadClubImages(clubId, photos);
      }
    } catch (error) {
      setErrors({ general: `${step} didn't save. ${parseApiError(error, 'Try again in a moment.')}` });
      return;
    } finally {
      setSaving(false);
    }

    setSaved('Saved. Your club page shows the changes now.');
    clearLogo();
    setPhotos([]);
    setPhotoPreviews([]);

    // After the write, never inside its try (BUG-045), and awaited in a catch of
    // its own (BUG-047): a failure here is a stale screen, not a failed save.
    try {
      await revalidateClubs();
      // Every event carries its organizer's name, and the event reads are cached.
      if (renamed) await revalidateEvents();
      refreshManagedClubs();
      await reload();
      await load();
    } catch {
      setSaved('Saved — reload the page to see every change.');
    }
  }

  if (loadFailed) {
    return (
      <p className="text-sm text-alert-600">
        This club didn&apos;t load, so there is nothing to edit yet. Refresh to try again.
      </p>
    );
  }

  if (!club || !fields) {
    return <p className="font-mono text-sm text-ink-600">Loading the club…</p>;
  }

  const current = toClub(club);

  return (
    <div>
      <header>
        <h2 className="font-display text-2xl font-bold text-ink-900">Club page</h2>
        <p className="mt-1 text-ink-600">
          Everything students see on your club&apos;s page. Changes go live when you save.
        </p>
        <p className="mt-2 flex flex-wrap items-baseline gap-x-2 text-ink-600">
          <span className="ticket-label">URL</span>
          <span className="font-mono text-xs break-all">
            /clubs/<span className="text-lavender-600">{clubId}</span>
          </span>
        </p>
      </header>

      {/* noValidate: our validator writes the messages, not the browser (BUG-049). */}
      <form onSubmit={submit} noValidate className="mt-8 max-w-2xl space-y-10">
        <div className="space-y-6">
          <FormField label="Club name" htmlFor="name" required error={errors.name}>
            <input
              id="name"
              type="text"
              value={fields.name}
              onChange={(e) => set('name', e.target.value)}
              maxLength={100}
              disabled={saving}
              autoComplete="off"
              className={inputClasses}
            />
          </FormField>

          <FormField
            label="Description"
            htmlFor="description"
            required
            error={errors.description}
            hint={`${fields.description.length}/1000 characters`}
          >
            <textarea
              id="description"
              rows={5}
              value={fields.description}
              onChange={(e) => set('description', e.target.value)}
              maxLength={1000}
              disabled={saving}
              className={textareaClasses}
            />
          </FormField>
        </div>

        <div className="space-y-6 border-t border-mist-200 pt-10">
          <FormField
            label="Category"
            htmlFor="category"
            hint="What the club is. What it is about goes below."
          >
            <select
              id="category"
              value={fields.category ?? ''}
              onChange={(e) => set('category', e.target.value || null)}
              disabled={saving || categories === null}
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
            selected={fields.interests}
            onChange={(slugs) => set('interests', slugs)}
            title="What is this club about?"
            description="Students who share these interests will find you."
            max={8}
            capChoices
          />
        </div>

        <div className="space-y-6 border-t border-mist-200 pt-10">
          <FormField
            label="Logo"
            htmlFor="logo"
            error={errors.logo}
            hint={logo ? 'Replaces the current logo when you save.' : undefined}
          >
            <div className="flex flex-wrap items-center gap-6">
              {!logo && <ClubLogo name={fields.name} logo={current.logo} size="lg" />}
              {logo ? (
                <LogoPreview
                  logoPreview={logoPreview}
                  onRemove={clearLogo}
                  onUploadClick={() => logoInputRef.current?.click()}
                  isDisabled={saving}
                />
              ) : (
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => logoInputRef.current?.click()}
                  disabled={saving}
                >
                  {club.logo ? 'Replace logo' : 'Add a logo'}
                </Button>
              )}
            </div>
            <input
              ref={logoInputRef}
              id="logo"
              type="file"
              accept={ACCEPTED_IMAGE_TYPES.join(',')}
              onChange={pickLogo}
              disabled={saving}
              className="sr-only"
            />
          </FormField>

          <FormField
            label="Photos"
            htmlFor="photos"
            error={photoError || undefined}
            hint="Shown on your club page. New photos are added when you save."
          >
            {current.images.length > 0 && (
              <div className="mb-4 grid grid-cols-3 gap-4 sm:grid-cols-4">
                {current.images.map((src, index) => (
                  <div
                    key={src}
                    className="relative h-24 w-full overflow-hidden rounded-xl border border-mist-200 bg-mist-100"
                  >
                    <Image
                      src={src}
                      alt={`Club photo ${index + 1}`}
                      fill
                      sizes="160px"
                      className="object-cover"
                    />
                  </div>
                ))}
              </div>
            )}
            <ImageGallery
              imagePreviews={photoPreviews}
              imageCount={photos.length}
              maxImages={MAX_NEW_PHOTOS}
              onRemove={removePhoto}
              onUploadClick={() => photoInputRef.current?.click()}
              isDisabled={saving}
            />
            <input
              ref={photoInputRef}
              id="photos"
              type="file"
              multiple
              accept={ACCEPTED_IMAGE_TYPES.join(',')}
              onChange={pickPhotos}
              disabled={saving}
              className="sr-only"
            />
          </FormField>
        </div>

        <div className="space-y-6 border-t border-mist-200 pt-10">
          <FormField
            label="Contact email"
            htmlFor="social_email"
            error={errors.social}
            hint="Shown on your club page. Your official club email is separate and set on the Overview."
          >
            <input
              id="social_email"
              type="email"
              value={fields.socialLinks.email}
              onChange={(e) => setLink('email', e.target.value)}
              placeholder="hello@yourclub.ca"
              disabled={saving}
              className={inputClasses}
            />
          </FormField>

          <FormField label="Website" htmlFor="social_website">
            <input
              id="social_website"
              type="url"
              value={fields.socialLinks.website}
              onChange={(e) => setLink('website', e.target.value)}
              placeholder="https://yourclub.ca"
              disabled={saving}
              className={inputClasses}
            />
          </FormField>

          <FormField label="Instagram" htmlFor="social_instagram">
            <input
              id="social_instagram"
              type="text"
              value={fields.socialLinks.instagram}
              onChange={(e) => setLink('instagram', e.target.value)}
              placeholder="yourclub"
              disabled={saving}
              className={inputClasses}
            />
          </FormField>

          <FormField label="Facebook" htmlFor="social_facebook">
            <input
              id="social_facebook"
              type="url"
              value={fields.socialLinks.facebook}
              onChange={(e) => setLink('facebook', e.target.value)}
              placeholder="https://facebook.com/yourclub"
              disabled={saving}
              className={inputClasses}
            />
          </FormField>

          <FormField label="LinkedIn" htmlFor="social_linkedin">
            <input
              id="social_linkedin"
              type="url"
              value={fields.socialLinks.linkedin}
              onChange={(e) => setLink('linkedin', e.target.value)}
              placeholder="https://linkedin.com/company/yourclub"
              disabled={saving}
              className={inputClasses}
            />
          </FormField>

          <FormField label="Linktree" htmlFor="social_linktree">
            <input
              id="social_linktree"
              type="url"
              value={fields.socialLinks.linktree}
              onChange={(e) => setLink('linktree', e.target.value)}
              placeholder="https://linktr.ee/yourclub"
              disabled={saving}
              className={inputClasses}
            />
          </FormField>
        </div>

        <div className="flex flex-wrap items-center gap-4 border-t border-mist-200 pt-8">
          <Button type="submit" size="lg" disabled={saving}>
            {saving ? 'Saving…' : 'Save changes'}
          </Button>
        </div>
      </form>

      <Toast
        message={errors.general ?? null}
        onDismiss={() => setErrors((prev) => ({ ...prev, general: undefined }))}
      />
      <Toast message={saved || null} tone="success" onDismiss={() => setSaved('')} />
    </div>
  );
}
