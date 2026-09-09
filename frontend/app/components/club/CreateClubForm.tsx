'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { AlertCircle } from 'lucide-react';
import InterestPicker from "@/app/components/profile/edit/InterestPicker";
import { useClubCategories } from "@/app/hooks/useClubCategories";
import { useCreateClubForm } from '@/app/hooks/useCreateClubForm';
import { useAuth } from '@/app/lib/auth-context';
import { isAdmin } from '@/app/lib/user';
import { useManagedClubs } from '@/app/lib/managed-clubs-context';
import { revalidateClubs } from '@/app/lib/actions/revalidate';
import { LogoPreview, ImageGallery } from '../PhotoFileUploadPreview';
import { ClubFormErrorBoundary } from './ClubFormErrorBoundary';

/**
 * The one club-creation form, on both paths.
 *
 * A platform admin creates the club directly and becomes its owner, so the
 * logo, banners and links are collected and saved. Everyone else submits a
 * proposal for review, which carries text only — a proposal has no club id and
 * no S3 key, so those controls are **absent** rather than disabled. There is no
 * note promising them later either; the requester adds them from
 * /manage/[clubId] once approval makes them the owner. See ADR-004.
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
    imagePreviews,
    logoInputRef,
    imagesInputRef,
    handleInputChange,
    handleLogoChange,
    handleImagesChange,
    removeImage,
    removeLogo,
    handleSubmit,
    setCategory,
    setInterests,
  } = useCreateClubForm(admin ? 'create' : 'propose', async (createdClubId) => {
    if (createdClubId) {
      // The managed-clubs provider is what draws the Manage link and decides
      // where /manage forwards to. Without this refresh the admin owns a club
      // the UI does not know about until a full reload.
      await refresh();
      // And /clubs is cached for five minutes, so without this the club they
      // just made is missing from the grid they go back to.
      await revalidateClubs();
      router.push(`/manage/${createdClubId}`);
      return;
    }
    setSubmitted(true);
  });

  const { categories, failed: categoriesFailed } = useClubCategories();

  // A proposal has nowhere to send anyone: no club exists, and nothing notifies
  // the requester when it is reviewed (notifications are not built). Saying so
  // is the honest end of the flow -- better than the silent form reset this
  // used to do, which looked like nothing had happened.
  if (submitted) {
    return (
      <div className="min-h-screen py-12 px-4 sm:px-6 lg:px-8">
        <div className="max-w-2xl mx-auto">
          <h1 className="text-4xl font-bold mb-2">Proposal submitted</h1>
          <p className="text-slate-400">
            An administrator will review it. If it is approved the club is created and
            you become its owner, and it appears under Manage — that is where you add a
            logo, photos and links. Nothing emails you yet, so check back.
          </p>
          <div className="mt-8 flex gap-3">
            <button
              type="button"
              onClick={() => router.push('/clubs')}
              className="bg-orange-600 hover:bg-orange-700 font-semibold py-3 px-5 rounded-lg transition-colors duration-200"
            >
              Browse clubs
            </button>
            <button
              type="button"
              onClick={() => setSubmitted(false)}
              className="border border-slate-600 hover:border-slate-400 font-semibold py-3 px-5 rounded-lg transition-colors duration-200"
            >
              Propose another
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <ClubFormErrorBoundary>
      <div className="min-h-screen py-12 px-4 sm:px-6 lg:px-8">
        <div className="max-w-2xl mx-auto">
          {/* Header */}
          <div className="mb-8">
            <h1 className="text-4xl font-bold mb-2">
              {admin ? 'Create a New Club' : 'Propose a New Club'}
            </h1>
            <p className="text-slate-400">
              {admin
                ? 'Start building your campus community'
                : 'Tell us about the club. An administrator reviews it, and approving it makes you its owner.'}
            </p>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-8">
            {/* General Error */}
            {errors.general && (
              <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-4 flex items-start gap-3">
                <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
                <p className="text-red-400 text-sm">{errors.general}</p>
              </div>
            )}

            {/* Club Name */}
            <div>
              <label htmlFor="name" className="block text-sm font-semibold mb-2">
                Club Name *
              </label>
              <input
                type="text"
                id="name"
                name="name"
                value={formData.name}
                onChange={handleInputChange}
                placeholder="Enter club name"
                disabled={isSubmitting}
                className="w-full px-4 py-2 bg-gray-100 border border-slate-600 rounded-lg placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:opacity-50"
              />
              {errors.name && (
                <p className="text-red-400 text-sm mt-1">{errors.name}</p>
              )}
            </div>

            {/* Description */}
            <div>
              <label htmlFor="description" className="block text-sm font-semibold mb-2">
                Description *
              </label>
              <textarea
                id="description"
                name="description"
                value={formData.description}
                onChange={handleInputChange}
                placeholder="Describe your club..."
                rows={4}
                disabled={isSubmitting}
                className="w-full px-4 py-2 bg-gray-100 border border-slate-600 rounded-lg placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none disabled:opacity-50"
              />
              <p className="text-slate-400 text-sm mt-1">
                {formData.description.length}/1000 characters
              </p>
              {errors.description && (
                <p className="text-red-400 text-sm mt-1">{errors.description}</p>
              )}
            </div>

            {/* What kind of organisation this is. One value, from a fixed list
                of thirteen -- see decision D1. Categories load from the server
                rather than being hardcoded here, so the list cannot drift from
                the one the foreign key checks against. */}
            <div>
              <label htmlFor="category" className="block text-sm font-semibold mb-2">
                Category
              </label>
              <select
                id="category"
                value={formData.category ?? ""}
                onChange={(event) => setCategory(event.target.value || null)}
                disabled={isSubmitting || categories === null}
                className="w-full px-4 py-2 bg-gray-100 border border-slate-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:opacity-50"
              >
                <option value="">
                  {categoriesFailed
                    ? "Categories didn't load"
                    : categories === null
                      ? "Loading categories…"
                      : "Select a category"}
                </option>
                {(categories ?? []).map((category) => (
                  <option key={category.slug} value={category.slug}>
                    {category.label}
                  </option>
                ))}
              </select>
              <p className="text-slate-400 text-sm mt-1">
                What the club <em>is</em>. What it is <em>about</em> goes below.
              </p>
            </div>

            {/* What the club is about -- the axis that actually finds it. A
                category alone cannot answer `show me AI clubs`; these can,
                because they are the same slugs students pick as their own
                interests. See decision D7. */}
            <div>
              <InterestPicker
                selected={formData.interests}
                onChange={setInterests}
                title="What is this club about?"
                description="Pick up to eight. Students who share these interests will find you."
                max={8}
              />
            </div>

            {/* Images and links exist only on the admin path. A proposal has
                no club id and no S3 key, so there is nothing to upload against
                -- they are absent rather than disabled, and nothing here
                promises them later. The requester adds them from
                /manage/[clubId] once approval makes them the owner. */}
            {admin && (
              <>
              {/* Club Logo */}
              <div>
                <label className="block text-sm font-semibold mb-2">
                  Club Logo
                </label>
                <LogoPreview
                  logoPreview={logoPreview}
                  onRemove={removeLogo}
                  onUploadClick={() => logoInputRef.current?.click()}
                  isDisabled={isSubmitting}
                  error={errors.logo}
                />
                <input
                  ref={logoInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleLogoChange}
                  disabled={isSubmitting}
                  className="hidden"
                />
                {errors.logo && (
                  <p className="text-red-400 text-sm mt-1">{errors.logo}</p>
                )}
              </div>

              {/* Club Images */}
              <div>
                <label className="block text-sm font-semibold mb-2">
                  Club Photos ({formData.images.length}/10)
                </label>
                <ImageGallery
                  imagePreviews={imagePreviews}
                  imageCount={formData.images.length}
                  maxImages={10}
                  onRemove={removeImage}
                  onUploadClick={() => imagesInputRef.current?.click()}
                  isDisabled={isSubmitting}
                  error={errors.images}
                />
                <input
                  ref={imagesInputRef}
                  type="file"
                  accept="image/*"
                  multiple
                  onChange={handleImagesChange}
                  disabled={isSubmitting}
                  className="hidden"
                />
                {errors.images && (
                  <p className="text-red-400 text-sm mt-1">{errors.images}</p>
                )}
              </div>

              {/* Social Links */}
              <div className="space-y-4">
                <h3 className="text-lg font-semibold">Contact & Social Links</h3>

                {/* Email */}
                <div>
                  <label htmlFor="social_email" className="block text-sm font-medium mb-2">
                    Email *
                  </label>
                  <input
                    type="email"
                    id="social_email"
                    name="social_email"
                    value={formData.socialLinks.email}
                    onChange={handleInputChange}
                    placeholder="club@campus.edu"
                    disabled={isSubmitting}
                    className="w-full px-4 py-2 bg-gray-100 border border-slate-600 rounded-lg placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:opacity-50"
                  />
                </div>

                {/* Website */}
                <div>
                  <label htmlFor="social_website" className="block text-sm font-medium mb-2">
                    Website
                  </label>
                  <input
                    type="url"
                    id="social_website"
                    name="social_website"
                    value={formData.socialLinks.website}
                    onChange={handleInputChange}
                    placeholder="https://yourclub.com"
                    disabled={isSubmitting}
                    className="w-full px-4 py-2 bg-gray-100 border border-slate-600 rounded-lg placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:opacity-50"
                  />
                </div>

                {/* Facebook */}
                <div>
                  <label htmlFor="social_facebook" className="block text-sm font-medium mb-2">
                    Facebook
                  </label>
                  <input
                    type="url"
                    id="social_facebook"
                    name="social_facebook"
                    value={formData.socialLinks.facebook}
                    onChange={handleInputChange}
                    placeholder="https://facebook.com/yourclub"
                    disabled={isSubmitting}
                    className="w-full px-4 py-2 bg-gray-100 border border-slate-600 rounded-lg placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:opacity-50"
                  />
                </div>

                {/* Instagram */}
                <div>
                  <label htmlFor="social_instagram" className="block text-sm font-medium mb-2">
                    Instagram
                  </label>
                  <input
                    type="text"
                    id="social_instagram"
                    name="social_instagram"
                    value={formData.socialLinks.instagram}
                    onChange={handleInputChange}
                    placeholder="@yourclub"
                    disabled={isSubmitting}
                    className="w-full px-4 py-2 bg-gray-100 border border-slate-600 rounded-lg placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:opacity-50"
                  />
                </div>

                {errors.social && (
                  <p className="text-red-400 text-sm mt-1">{errors.social}</p>
                )}
              </div>
              </>
            )}

            {!admin && (
              <div>
                <label htmlFor="message" className="block text-sm font-semibold mb-2">
                  Anything the reviewer should know
                </label>
                <textarea
                  id="message"
                  name="message"
                  value={formData.message}
                  onChange={handleInputChange}
                  disabled={isSubmitting}
                  rows={4}
                  maxLength={2000}
                  placeholder="Who is behind this club, and what are you planning?"
                  className="w-full px-4 py-3 rounded-lg border border-slate-600 bg-transparent focus:outline-none focus:ring-2 focus:ring-orange-500"
                />
                <p className="text-slate-400 text-xs mt-1">
                  {formData.message.length}/2000
                </p>
                {errors.message && (
                  <p className="text-red-400 text-sm mt-1">{errors.message}</p>
                )}
              </div>
            )}

            {/* Submit Button */}
            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full bg-orange-600 hover:bg-orange-700 disabled:bg-slate-600 disabled:opacity-50 font-semibold py-3 rounded-lg transition-colors duration-200"
            >
              {isSubmitting
                ? admin
                  ? 'Creating Club...'
                  : 'Submitting...'
                : admin
                  ? 'Create Club'
                  : 'Submit for review'}
            </button>
          </form>
        </div>
      </div>
    </ClubFormErrorBoundary>
  );
}
