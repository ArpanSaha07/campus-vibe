'use client';

import { Upload, X } from 'lucide-react';
import Image from 'next/image';
import { LogoPreviewProps, ImageGalleryProps } from '@/app/types';

/**
 * The file-picker surfaces shared by the club forms.
 *
 * Styled from `.claude/design-guidelines.md` rather than the slate/blue palette
 * these carried from an earlier iteration: mist hairlines, lavender on hover,
 * `alert-600` for the destructive control. The empty state is a `button` rather
 * than a `div` with an onClick so it can be reached by keyboard at all.
 *
 * `ImageGallery` is not rendered by the create form — banner photos moved to
 * the club editor. It stays here because that editor is the next thing to want
 * it (BUG-043) and `POST /clubs/{id}/images` has always been reachable.
 */

const dropzoneClasses =
  'w-full rounded-2xl border-2 border-dashed border-mist-200 bg-mist-100 p-8 text-center transition-colors hover:border-lavender-300 hover:bg-lavender-50 disabled:cursor-not-allowed disabled:opacity-50';

/** The corner control that clears a chosen file. */
function RemoveButton({
  onRemove,
  isDisabled,
  label,
  size = 'md',
}: {
  onRemove: () => void;
  isDisabled: boolean;
  label: string;
  size?: 'sm' | 'md';
}) {
  return (
    <button
      type="button"
      onClick={onRemove}
      disabled={isDisabled}
      aria-label={label}
      className="absolute right-1.5 top-1.5 rounded-full bg-ink-900/70 p-1 text-white transition-colors hover:bg-alert-600 disabled:opacity-50"
    >
      <X className={size === 'sm' ? 'h-3 w-3' : 'h-4 w-4'} aria-hidden="true" />
    </button>
  );
}

export function LogoPreview({
  logoPreview,
  onRemove,
  onUploadClick,
  isDisabled = false,
}: LogoPreviewProps) {
  if (!logoPreview) {
    return (
      <button
        type="button"
        onClick={onUploadClick}
        disabled={isDisabled}
        className={dropzoneClasses}
      >
        <Upload className="mx-auto mb-2 h-8 w-8 text-lavender-600" aria-hidden="true" />
        <p className="text-sm font-semibold text-ink-900">Add a logo</p>
        <p className="ticket-label mt-1 text-ink-600">PNG OR JPG · UP TO 5MB</p>
      </button>
    );
  }

  return (
    <div className="relative h-32 w-32 overflow-hidden rounded-2xl border border-mist-200 bg-mist-100">
      <Image src={logoPreview} alt="Logo preview" fill className="object-cover" />
      <RemoveButton onRemove={onRemove} isDisabled={isDisabled} label="Remove logo" />
    </div>
  );
}

export function ImageGallery({
  imagePreviews,
  imageCount,
  maxImages,
  onRemove,
  onUploadClick,
  isDisabled = false,
}: ImageGalleryProps) {
  if (imagePreviews.length === 0) {
    return (
      <button
        type="button"
        onClick={onUploadClick}
        disabled={isDisabled}
        className={dropzoneClasses}
      >
        <Upload className="mx-auto mb-2 h-8 w-8 text-lavender-600" aria-hidden="true" />
        <p className="text-sm font-semibold text-ink-900">Add photos</p>
        <p className="ticket-label mt-1 text-ink-600">PNG OR JPG · UP TO 5MB EACH</p>
      </button>
    );
  }

  return (
    <div className="grid grid-cols-3 gap-4">
      {imagePreviews.map((preview, index) => (
        <div
          key={index}
          className="relative h-24 w-24 overflow-hidden rounded-xl border border-mist-200 bg-mist-100"
        >
          <Image src={preview} alt={`Photo ${index + 1}`} fill className="object-cover" />
          <RemoveButton
            onRemove={() => onRemove(index)}
            isDisabled={isDisabled}
            label={`Remove photo ${index + 1}`}
            size="sm"
          />
        </div>
      ))}
      {imageCount < maxImages && (
        <button
          type="button"
          onClick={onUploadClick}
          disabled={isDisabled}
          aria-label="Add another photo"
          className="flex h-24 w-24 items-center justify-center rounded-xl border-2 border-dashed border-mist-200 bg-mist-100 transition-colors hover:border-lavender-300 hover:bg-lavender-50 disabled:opacity-50"
        >
          <Upload className="h-5 w-5 text-lavender-600" aria-hidden="true" />
        </button>
      )}
    </div>
  );
}
