'use client';

import { AlertCircle } from 'lucide-react';
import InterestPicker from "@/app/components/profile/edit/InterestPicker";
import { useClubCategories } from "@/app/hooks/useClubCategories";
import { useCreateClubForm } from '@/app/hooks/useCreateClubForm';
import { LogoPreview, ImageGallery } from '../PhotoFileUploadPreview';
import { ClubFormErrorBoundary } from './ClubFormErrorBoundary';

export default function CreateClubForm() {
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
  } = useCreateClubForm();

  const { categories, failed: categoriesFailed } = useClubCategories();

  return (
    <ClubFormErrorBoundary>
      <div className="min-h-screen py-12 px-4 sm:px-6 lg:px-8">
        <div className="max-w-2xl mx-auto">
          {/* Header */}
          <div className="mb-8">
            <h1 className="text-4xl font-bold mb-2">Create a New Club</h1>
            <p className="text-slate-400">Start building your campus community</p>
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

            {/* Said plainly rather than letting three fields quietly go
                nowhere. Creating a club grants the creator no authority over
                it, and all three of these are written by endpoints guarded by
                canManageClub -- so sending them would 403. See the P0 at the
                top of todo.md. */}
            <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-4">
              <p className="text-sm">
                <strong>The logo, images and links below aren&apos;t saved yet.</strong> A
                new club has no owner until an administrator approves your request to run
                it, and only its owner can upload to it. Everything above is saved now;
                come back for the rest once you have been approved.
              </p>
            </div>

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

            {/* Submit Button */}
            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full bg-orange-600 hover:bg-orange-700 disabled:bg-slate-600 disabled:opacity-50 font-semibold py-3 rounded-lg transition-colors duration-200"
            >
              {isSubmitting ? 'Creating Club...' : 'Create Club'}
            </button>
          </form>
        </div>
      </div>
    </ClubFormErrorBoundary>
  );
}
