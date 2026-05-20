'use client';

import { Upload, X } from 'lucide-react';
import Image from 'next/image';
import { LogoPreviewProps, ImageGalleryProps } from '@/app/types';


export function LogoPreview({
  logoPreview,
  onRemove,
  onUploadClick,
  isDisabled = false,
  error,
}: LogoPreviewProps) {
  if (!logoPreview) {
    return (
      <div
        onClick={onUploadClick}
        className="border-2 border-dashed border-slate-600 rounded-lg p-8 text-center cursor-pointer hover:border-blue-500 hover:bg-gray-100/50 transition-colors"
      >
        <Upload className="w-8 h-8 text-slate-400 mx-auto mb-2" />
        <p className="text-slate-300 text-sm">Click to upload logo</p>
        <p className="text-slate-500 text-xs">PNG, JPG up to 5MB</p>
      </div>
    );
  }

  return (
    <div className="relative w-32 h-32 rounded-lg overflow-hidden bg-gray-100">
      <Image
        src={logoPreview}
        alt="Logo preview"
        fill
        className="object-cover"
      />
      <button
        type="button"
        onClick={onRemove}
        disabled={isDisabled}
        className="absolute top-1 right-1 bg-red-500 rounded-full p-1 hover:bg-red-600 disabled:opacity-50"
      >
        <X className="w-4 h-4" />
      </button>
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
  error,
}: ImageGalleryProps) {
  if (imagePreviews.length === 0) {
    return (
      <div
        onClick={onUploadClick}
        className="border-2 border-dashed border-slate-600 rounded-lg p-8 text-center cursor-pointer hover:border-blue-500 hover:bg-gray-100/50 transition-colors"
      >
        <Upload className="w-8 h-8 text-slate-400 mx-auto mb-2" />
        <p className="text-slate-300 text-sm">Click to upload photos</p>
        <p className="text-slate-500 text-xs">PNG, JPG up to 5MB each</p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-3 gap-4">
      {imagePreviews.map((preview, index) => (
        <div
          key={index}
          className="relative w-24 h-24 rounded-lg overflow-hidden bg-gray-100"
        >
          <Image
            src={preview}
            alt={`Photo ${index + 1}`}
            fill
            className="object-cover"
          />
          <button
            type="button"
            onClick={() => onRemove(index)}
            disabled={isDisabled}
            className="absolute top-1 right-1 bg-red-500 rounded-full p-1 hover:bg-red-600 disabled:opacity-50"
          >
            <X className="w-3 h-3" />
          </button>
        </div>
      ))}
      {imageCount < maxImages && (
        <div
          onClick={onUploadClick}
          className="w-24 h-24 border-2 border-dashed border-slate-600 rounded-lg flex items-center justify-center cursor-pointer hover:border-blue-500 hover:bg-gray-100/50 transition-colors"
        >
          <Upload className="w-5 h-5 text-slate-400" />
        </div>
      )}
    </div>
  );
}
